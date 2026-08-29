import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import MeetingClip from "../models/meetingClipModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let testUser, otherOrgUser;
let userToken, otherUserToken;
let meeting;
let clip1, clip2, otherClip;

const orgId = new mongoose.Types.ObjectId().toString();
const otherOrgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await User.deleteMany({ email: /clip-export-.*@example\.com/ });
  await Meeting.deleteMany({ title: /Clip Test.*/ });
  await MeetingClip.deleteMany({});

  testUser = await User.create({
    name: "Clip Exporter",
    email: `clip-export-org-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `clerk_clip_${Date.now()}`,
  });

  otherOrgUser = await User.create({
    name: "Other Exporter",
    email: `clip-export-other-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: otherOrgId,
    clerkUserId: `clerk_clip_other_${Date.now()}`,
  });

  userToken = createClerkTestToken({
    clerkUserId: testUser.clerkUserId,
    email: testUser.email,
  });

  otherUserToken = createClerkTestToken({
    clerkUserId: otherOrgUser.clerkUserId,
    email: otherOrgUser.email,
  });

  meeting = await Meeting.create({
    title: "Clip Test Meeting",
    uploadedBy: testUser._id,
    organization: orgId,
    date: new Date(),
    fileUrl: "uploads/test_meeting.mp4",
  });

  clip1 = await MeetingClip.create({
    meeting: meeting._id,
    createdBy: testUser._id,
    title: "Clip One",
    startTime: 10,
    endTime: 30,
  });

  clip2 = await MeetingClip.create({
    meeting: meeting._id,
    createdBy: testUser._id,
    title: "Clip Two",
    startTime: 40,
    endTime: 60,
  });

  const otherMeeting = await Meeting.create({
    title: "Clip Test Other Org",
    uploadedBy: otherOrgUser._id,
    organization: otherOrgId,
    date: new Date(),
  });

  otherClip = await MeetingClip.create({
    meeting: otherMeeting._id,
    createdBy: otherOrgUser._id,
    title: "Other Clip",
    startTime: 5,
    endTime: 15,
  });
});

describe("Meeting Clip Trimming & Merging Pipeline API (#2588)", () => {
  it("should trim clip start/end boundaries and update fileUrl", async () => {
    const res = await request(app)
      .post(`/api/clips/${clip1._id}/trim`)
      .set(authHeader(userToken))
      .send({
        startTime: 12,
        endTime: 28,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.startTime).toBe(12);
    expect(data.endTime).toBe(28);
    expect(data.fileUrl).toContain("trimmed_");
  });

  it("should prevent non-owners or non-admins from trimming clips", async () => {
    const res = await request(app)
      .post(`/api/clips/${clip1._id}/trim`)
      .set(authHeader(otherUserToken))
      .send({
        startTime: 12,
        endTime: 28,
      });

    expect(res.statusCode).toBe(403);
  });

  it("should merge multiple clips and save compilation metadata", async () => {
    const res = await request(app)
      .post("/api/clips/merge")
      .set(authHeader(userToken))
      .send({
        clipIds: [clip1._id.toString(), clip2._id.toString()],
        title: "Marketing Compilation",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const compilation = res.body.data;
    expect(compilation.title).toBe("Marketing Compilation");
    expect(compilation.isCompilation).toBe(true);
    expect(compilation.mergedClips.length).toBe(2);
    expect(compilation.endTime).toBe(40); // (30-10) + (60-40) = 40s duration
  });

  it("should fail to merge clips from other organizations (cross-tenant safety)", async () => {
    const res = await request(app)
      .post("/api/clips/merge")
      .set(authHeader(userToken))
      .send({
        clipIds: [clip1._id.toString(), otherClip._id.toString()],
        title: "Unsafe Compilation",
      });

    expect(res.statusCode).toBe(403);
  });
});
