import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import MeetingQuiz from "../models/meetingQuizModel.js";
import QuizResponse from "../models/quizResponseModel.js";
import GamificationScore from "../models/gamificationScoreModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let testToken;
let testUser;
let testMeeting;
const orgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  // Cleanup collections
  await User.deleteMany({ email: /quiz-user-.*@example\.com/ });
  await Meeting.deleteMany({ title: "Retention Quiz Test Meeting" });
  await MeetingQuiz.deleteMany({});
  await QuizResponse.deleteMany({});
  await GamificationScore.deleteMany({ organization: orgId });

  // Create test user
  testUser = await User.create({
    name: "Quiz User",
    email: `quiz-user-${Date.now()}@example.com`,
    password: "Password123!",
    role: "member",
    organization: orgId,
    clerkUserId: `clerk_quiz_${Date.now()}`,
  });

  testToken = createClerkTestToken({
    clerkUserId: testUser.clerkUserId,
    email: testUser.email,
  });

  // Create meeting
  testMeeting = await Meeting.create({
    title: "Retention Quiz Test Meeting",
    description: "Discussion on system performance and SLA alerts.",
    summary: "Decided to implement strict alerts and auto-scale containers.",
    uploadedBy: testUser._id,
    organization: orgId,
    date: new Date(),
  });
});

describe("Meeting Knowledge Quiz & Retention Leaderboards API (#2556)", () => {
  it("should auto-generate a quiz when GET is called if it does not exist", async () => {
    const res = await request(app)
      .get(`/api/meetings/${testMeeting._id}/quiz`)
      .set(authHeader(testToken));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.quiz).toHaveProperty(
      "meetingId",
      testMeeting._id.toString(),
    );
    expect(res.body.quiz.questions.length).toBeGreaterThan(0);

    // Verify it was saved to MongoDB
    const quiz = await MeetingQuiz.findOne({ meetingId: testMeeting._id });
    expect(quiz).not.toBeNull();
    expect(quiz.questions.length).toBeGreaterThan(0);
  });

  it("should evaluate submitted answers, save responses, and award points on passing", async () => {
    // Generate quiz first
    const quizRes = await request(app)
      .get(`/api/meetings/${testMeeting._id}/quiz`)
      .set(authHeader(testToken));
    const quizId = quizRes.body.quiz._id;

    // All correct answers
    const answers = quizRes.body.quiz.questions.map((q, idx) => ({
      questionIndex: idx,
      selectedOptionIndex: q.correctOptionIndex,
    }));

    const res = await request(app)
      .post(`/api/meetings/${testMeeting._id}/quiz/submit`)
      .set(authHeader(testToken))
      .send({ answers });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.response.score).toBe(100);

    // Verify QuizResponse entry in DB
    const savedResponse = await QuizResponse.findOne({
      quizId,
      userId: testUser._id,
    });
    expect(savedResponse).not.toBeNull();
    expect(savedResponse.score).toBe(100);

    // Verify gamification points were awarded
    const score = await GamificationScore.findOne({
      user: testUser._id,
      organization: orgId,
    });
    expect(score).not.toBeNull();
    expect(score.totalPoints).toBe(100);
    expect(score.history[0].event).toBe("QUIZ_COMPLETED");
  });

  it("should reject duplicate submissions from the same user for a quiz", async () => {
    const quizRes = await request(app)
      .get(`/api/meetings/${testMeeting._id}/quiz`)
      .set(authHeader(testToken));

    const answers = quizRes.body.quiz.questions.map((q, idx) => ({
      questionIndex: idx,
      selectedOptionIndex: q.correctOptionIndex,
    }));

    // First submission
    await request(app)
      .post(`/api/meetings/${testMeeting._id}/quiz/submit`)
      .set(authHeader(testToken))
      .send({ answers });

    // Second submission
    const res = await request(app)
      .post(`/api/meetings/${testMeeting._id}/quiz/submit`)
      .set(authHeader(testToken))
      .send({ answers });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("already submitted");
  });

  it("should aggregate and return organization-wide quiz retention leaderboard data", async () => {
    const quizRes = await request(app)
      .get(`/api/meetings/${testMeeting._id}/quiz`)
      .set(authHeader(testToken));

    const answers = quizRes.body.quiz.questions.map((q, idx) => ({
      questionIndex: idx,
      selectedOptionIndex: q.correctOptionIndex,
    }));

    // Submit a response
    await request(app)
      .post(`/api/meetings/${testMeeting._id}/quiz/submit`)
      .set(authHeader(testToken))
      .send({ answers });

    // Fetch leaderboard
    const res = await request(app)
      .get("/api/meetings/quiz/leaderboard")
      .set(authHeader(testToken));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].user._id).toBe(testUser._id.toString());
    expect(res.body.data[0].avgScore).toBe(100);
    expect(res.body.data[0].totalAttempts).toBe(1);
  });
});
