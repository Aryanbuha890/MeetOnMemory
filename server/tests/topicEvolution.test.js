import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import MeetingTopic from "../models/meetingTopicModel.js";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import { getTopicEvolutionTimeline } from "../controllers/topicController.js";

const organizationId = new mongoose.Types.ObjectId();
const meeting1Id = new mongoose.Types.ObjectId();
const meeting2Id = new mongoose.Types.ObjectId();

beforeAll(async () => {
  await mongoose.connect(`${process.env.TEST_MONGODB_URI}/topic_evolution`);
});

describe("getTopicEvolutionTimeline controller", () => {
  test("computes cross-meeting evolution timeline for a specific topic", async () => {
    const userId = new mongoose.Types.ObjectId();
    await Meeting.create([
      {
        _id: meeting1Id,
        title: "Sprint Planning Architecture Sync",
        organization: organizationId,
        uploadedBy: userId,
        date: new Date("2026-02-01"),
      },
      {
        _id: meeting2Id,
        title: "Database Migration Retrospective",
        organization: organizationId,
        uploadedBy: userId,
        date: new Date("2026-02-15"),
      },
    ]);

    await MeetingTopic.create([
      {
        meeting: meeting1Id,
        organization: organizationId,
        topics: [{ name: "Database Migration" }],
      },
      {
        meeting: meeting2Id,
        organization: organizationId,
        topics: [{ name: "Database Migration" }],
      },
    ]);

    await Decision.create([
      {
        text: "Migrate database to PostgreSQL in Q2",
        sourceMeetingId: meeting1Id,
        organization: organizationId,
      },
      {
        text: "Database migration completed successfully",
        sourceMeetingId: meeting2Id,
        organization: organizationId,
      },
    ]);

    await ActionItem.create([
      {
        text: "Set up staging database cluster",
        sourceMeetingId: meeting1Id,
        organization: organizationId,
        assigneeName: "Alice",
      },
    ]);

    const req = {
      user: { organization: organizationId },
      query: { topic: "Database Migration" },
    };

    const res = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (payload) {
        this.body = payload;
        return this;
      },
    };

    await getTopicEvolutionTimeline(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics.totalMeetings).toBe(2);
    expect(res.body.data.timeline).toHaveLength(2);
    expect(res.body.data.timeline[0].title).toBe(
      "Sprint Planning Architecture Sync",
    );
    expect(res.body.data.timeline[1].title).toBe(
      "Database Migration Retrospective",
    );
    expect(res.body.data.timeline[0].decisions).toHaveLength(1);
    expect(res.body.data.timeline[0].actionItems).toHaveLength(1);
  });
});
