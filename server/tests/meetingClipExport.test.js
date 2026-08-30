/** @jest-environment node */
import { jest } from "@jest/globals";

// Mock jsdom virtually to bypass Jest CJS/ESM loader issues with EXODUS bytes
jest.unstable_mockModule(
  "jsdom",
  () => {
    return {
      JSDOM: class JSDOM {
        constructor() {
          this.window = {};
        }
      },
    };
  },
  { virtual: true },
);

import request from "supertest";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import MeetingClip from "../models/meetingClipModel.js";

// Mock fluent-ffmpeg
jest.unstable_mockModule(
  "fluent-ffmpeg",
  () => {
    const mockFfmpegInstance = {
      input: jest.fn().mockReturnThis(),
      setStartTime: jest.fn().mockReturnThis(),
      setDuration: jest.fn().mockReturnThis(),
      output: jest.fn(function (op) {
        this._outputPath = op;
        return this;
      }),
      on: jest.fn(function (event, callback) {
        if (!this._callbacks) this._callbacks = {};
        this._callbacks[event] = callback;
        return this;
      }),
      run: jest.fn(function () {
        if (global.__mockFfmpegError) {
          setTimeout(() => {
            if (this._callbacks?.error) {
              this._callbacks.error(new Error(global.__mockFfmpegError));
            }
          }, 10);
          return this;
        }
        setTimeout(() => {
          if (this._callbacks?.progress) {
            this._callbacks.progress({ percent: 50 });
          }
          setTimeout(() => {
            const clipsDir = path.resolve("uploads/clips");
            if (!fs.existsSync(clipsDir)) {
              fs.mkdirSync(clipsDir, { recursive: true });
            }
            fs.writeFileSync(this._outputPath, "mock output content");
            if (this._callbacks?.end) {
              this._callbacks.end();
            }
          }, 50);
        }, 25);
        return this;
      }),
      mergeToFile: jest.fn(function (outputPath, _tempDir) {
        this._outputPath = outputPath;
        if (global.__mockFfmpegError) {
          setTimeout(() => {
            if (this._callbacks?.error) {
              this._callbacks.error(new Error(global.__mockFfmpegError));
            }
          }, 10);
          return this;
        }
        setTimeout(() => {
          if (this._callbacks?.progress) {
            this._callbacks.progress({ percent: 50 });
          }
          setTimeout(() => {
            const clipsDir = path.resolve("uploads/clips");
            if (!fs.existsSync(clipsDir)) {
              fs.mkdirSync(clipsDir, { recursive: true });
            }
            fs.writeFileSync(outputPath, "mock merged content");
            if (this._callbacks?.end) {
              this._callbacks.end();
            }
          }, 50);
        }, 25);
        return this;
      }),
    };

    const mockFfmpegConstructor = jest.fn(() => mockFfmpegInstance);
    // Add ffprobe static helper
    mockFfmpegConstructor.ffprobe = jest.fn((sourcePath, callback) => {
      if (global.__mockFfmpegError) {
        return callback(new Error(global.__mockFfmpegError));
      }
      callback(null, { format: { duration: 100 } });
    });

    return {
      default: mockFfmpegConstructor,
    };
  },
  { virtual: true },
);

const { app } = await import("../server.js");
const { createClerkTestToken, authHeader } =
  await import("./helpers/clerkTestAuth.js");

let testUser, otherOrgUser, viewerUser;
let userToken, otherUserToken, viewerToken;
let meeting;
let clip1, clip2;

const orgId = new mongoose.Types.ObjectId().toString();
const otherOrgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  global.__mockFfmpegError = null;

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

  // Role: guest (lacks meetings:edit permission)
  viewerUser = await User.create({
    name: "Clip Viewer",
    email: `clip-export-viewer-${Date.now()}@example.com`,
    password: "Password123!",
    role: "guest",
    organization: orgId,
    clerkUserId: `clerk_clip_viewer_${Date.now()}`,
  });

  userToken = createClerkTestToken({
    clerkUserId: testUser.clerkUserId,
    email: testUser.email,
  });

  otherUserToken = createClerkTestToken({
    clerkUserId: otherOrgUser.clerkUserId,
    email: otherOrgUser.email,
  });

  viewerToken = createClerkTestToken({
    clerkUserId: viewerUser.clerkUserId,
    email: viewerUser.email,
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
    fileUrl: "uploads/clips/trimmed_clip1.mp4",
  });

  clip2 = await MeetingClip.create({
    meeting: meeting._id,
    createdBy: testUser._id,
    title: "Clip Two",
    startTime: 40,
    endTime: 60,
    fileUrl: "uploads/clips/trimmed_clip2.mp4",
  });

  // Create physical mock files
  const uploadsDir = path.resolve("uploads");
  const clipsDir = path.resolve("uploads/clips");
  if (!fs.existsSync(clipsDir)) {
    fs.mkdirSync(clipsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(uploadsDir, "test_meeting.mp4"),
    "dummy video data",
  );
  fs.writeFileSync(
    path.join(clipsDir, "trimmed_clip1.mp4"),
    "dummy clip 1 video data",
  );
  fs.writeFileSync(
    path.join(clipsDir, "trimmed_clip2.mp4"),
    "dummy clip 2 video data",
  );
});

afterEach(async () => {
  global.__mockFfmpegError = null;
  const filesToDelete = [
    path.resolve("uploads/test_meeting.mp4"),
    path.resolve("uploads/clips/trimmed_clip1.mp4"),
    path.resolve("uploads/clips/trimmed_clip2.mp4"),
  ];
  for (const f of filesToDelete) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch (_err) {}
    }
  }
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

    // Verify file actually got written
    const outputFilename = `trimmed_${clip1._id}.mp4`;
    const outputPath = path.resolve("uploads/clips", outputFilename);
    expect(fs.existsSync(outputPath)).toBe(true);
    fs.unlinkSync(outputPath); // cleanup
  });

  it("should fail trim when FFmpeg processing fails and leave DB unchanged", async () => {
    global.__mockFfmpegError = "FFmpeg binary crash";

    const res = await request(app)
      .post(`/api/clips/${clip1._id}/trim`)
      .set(authHeader(userToken))
      .send({
        startTime: 15,
        endTime: 25,
      });

    expect(res.statusCode).toBe(500);

    // Verify DB clip was not updated
    const freshClip = await MeetingClip.findById(clip1._id);
    expect(freshClip.startTime).toBe(10); // unchanged
    expect(freshClip.endTime).toBe(30); // unchanged

    // Verify partial file was unlinked
    const outputFilename = `trimmed_${clip1._id}.mp4`;
    const outputPath = path.resolve("uploads/clips", outputFilename);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("should prevent non-owners or non-admins from trimming clips", async () => {
    const res = await request(app)
      .post(`/api/clips/${clip1._id}/trim`)
      .set(authHeader(otherUserToken))
      .send({
        startTime: 12,
        endTime: 28,
      });

    expect(res.statusCode).toBe(404);
  });

  it("should block user with viewer role (lacks meetings:edit) from trimming clips", async () => {
    const res = await request(app)
      .post(`/api/clips/${clip1._id}/trim`)
      .set(authHeader(viewerToken))
      .send({
        startTime: 12,
        endTime: 28,
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain("permission to edit meetings");
  });

  it("should reject invalid trim boundaries before FFmpeg processing", async () => {
    // 1. Non-finite values
    let res = await request(app)
      .post(`/api/clips/${clip1._id}/trim`)
      .set(authHeader(userToken))
      .send({
        startTime: "abc",
        endTime: 20,
      });
    expect(res.statusCode).toBe(500);

    // 2. Negative start
    res = await request(app)
      .post(`/api/clips/${clip1._id}/trim`)
      .set(authHeader(userToken))
      .send({
        startTime: -5,
        endTime: 20,
      });
    expect(res.statusCode).toBe(500);

    // 3. start >= end
    res = await request(app)
      .post(`/api/clips/${clip1._id}/trim`)
      .set(authHeader(userToken))
      .send({
        startTime: 20,
        endTime: 15,
      });
    expect(res.statusCode).toBe(500);

    // 4. Exceeds actual duration (mock ffprobe returns 100)
    res = await request(app)
      .post(`/api/clips/${clip1._id}/trim`)
      .set(authHeader(userToken))
      .send({
        startTime: 10,
        endTime: 150,
      });
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain("exceeds source duration");
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

    // Verify output file got written
    const outputFilename = `merged_${compilation._id}.mp4`;
    const outputPath = path.resolve("uploads/clips", outputFilename);
    expect(fs.existsSync(outputPath)).toBe(true);
    fs.unlinkSync(outputPath); // cleanup
  });

  it("should preserve the requested clip ordering in the merged compilation", async () => {
    // 1. Order 1: [clip1, clip2]
    let res = await request(app)
      .post("/api/clips/merge")
      .set(authHeader(userToken))
      .send({
        clipIds: [clip1._id.toString(), clip2._id.toString()],
        title: "Order One Compilation",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.mergedClips[0]).toBe(clip1._id.toString());
    expect(res.body.data.mergedClips[1]).toBe(clip2._id.toString());

    // cleanup file
    let outputFilename = `merged_${res.body.data._id}.mp4`;
    let outputPath = path.resolve("uploads/clips", outputFilename);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    // 2. Order 2: [clip2, clip1]
    res = await request(app)
      .post("/api/clips/merge")
      .set(authHeader(userToken))
      .send({
        clipIds: [clip2._id.toString(), clip1._id.toString()],
        title: "Order Two Compilation",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.mergedClips[0]).toBe(clip2._id.toString());
    expect(res.body.data.mergedClips[1]).toBe(clip1._id.toString());

    // cleanup file
    outputFilename = `merged_${res.body.data._id}.mp4`;
    outputPath = path.resolve("uploads/clips", outputFilename);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  });

  it("should prevent orphaned compilation records if merge fails", async () => {
    global.__mockFfmpegError = "FFmpeg merge error";

    const res = await request(app)
      .post("/api/clips/merge")
      .set(authHeader(userToken))
      .send({
        clipIds: [clip1._id.toString(), clip2._id.toString()],
        title: "Failed Compilation",
      });

    expect(res.statusCode).toBe(500);

    // Verify no compilation record exists in the DB
    const compilationCount = await MeetingClip.countDocuments({
      title: "Failed Compilation",
      isCompilation: true,
    });
    expect(compilationCount).toBe(0);
  });

  it("should block user with viewer role from merging clips", async () => {
    const res = await request(app)
      .post("/api/clips/merge")
      .set(authHeader(viewerToken))
      .send({
        clipIds: [clip1._id.toString(), clip2._id.toString()],
        title: "Viewer Merged Compilation",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain("permission to edit meetings");
  });

  it("should fail to merge clips from other organizations (cross-tenant safety)", async () => {
    const res = await request(app)
      .post("/api/clips/merge")
      .set(authHeader(otherUserToken))
      .send({
        clipIds: [clip1._id.toString(), clip2._id.toString()],
        title: "Unsafe Compilation",
      });

    expect(res.statusCode).toBe(403);
  });

  it("should fail to merge clips belonging to different meetings", async () => {
    const otherMeetingSameOrg = await Meeting.create({
      title: "Different Meeting Same Tenant",
      uploadedBy: testUser._id,
      organization: orgId,
      date: new Date(),
    });

    const diffMeetingClip = await MeetingClip.create({
      meeting: otherMeetingSameOrg._id,
      createdBy: testUser._id,
      title: "Diff Meeting Clip",
      startTime: 0,
      endTime: 10,
    });

    const res = await request(app)
      .post("/api/clips/merge")
      .set(authHeader(userToken))
      .send({
        clipIds: [clip1._id.toString(), diffMeetingClip._id.toString()],
        title: "Cross Meeting Merger",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("different meetings");
  });

  it("should fail merge if any clip timing metadata is invalid", async () => {
    // Create a clip with invalid bounds directly in database
    const badClip = await MeetingClip.create({
      meeting: meeting._id,
      createdBy: testUser._id,
      title: "Bad Clip",
      startTime: 50,
      endTime: 40, // invalid range
    });

    const res = await request(app)
      .post("/api/clips/merge")
      .set(authHeader(userToken))
      .send({
        clipIds: [clip1._id.toString(), badClip._id.toString()],
        title: "Bad Timing Merge",
      });

    expect(res.statusCode).toBe(500);
  });
});
