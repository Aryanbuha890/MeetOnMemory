import mongoose from "mongoose";
import request from "supertest";
import { app } from "../server.js";
import User from "../models/userModel.js";
import notificationModel from "../models/notificationModel.js";
import NotificationPreference from "../models/notificationPreferenceModel.js";
import QueuedNotification from "../models/queuedNotificationModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import {
  createNotifications,
  processNotificationQueue,
  validateAndRepairLink,
} from "../services/notificationService.js";

let userToken;
let testUser;
const userId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await User.deleteMany({ email: /routing-user-.*@example\.com/ });
  await notificationModel.deleteMany({});
  await NotificationPreference.deleteMany({});
  await QueuedNotification.deleteMany({});

  testUser = await User.create({
    _id: userId,
    name: "Routing User",
    email: `routing-user-${Date.now()}@example.com`,
    password: "Password123!",
    role: "member",
    organization: new mongoose.Types.ObjectId().toString(),
    clerkUserId: `clerk_routing_${Date.now()}`,
  });

  userToken = createClerkTestToken({
    clerkUserId: testUser.clerkUserId,
    email: testUser.email,
  });

  // Default notification preferences
  await NotificationPreference.create({
    user: userId,
    routingPreferences: {
      slaAlerts: { slack: true, email: true, inApp: true },
      comments: { slack: true, email: true, inApp: true },
      recaps: { slack: true, email: true, inApp: true },
    },
    batchThresholdMinutes: 5,
  });
});

describe("Advanced Notification Routing Engine & Delivery Deduplication (#2554)", () => {
  it("should retrieve preferences via API and allow updates", async () => {
    // 1. Fetch preferences
    const getRes = await request(app)
      .get("/api/notifications/preferences")
      .set(authHeader(userToken));

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.preferences.batchThresholdMinutes).toBe(5);

    // 2. Update preferences
    const putRes = await request(app)
      .put("/api/notifications/preferences")
      .set(authHeader(userToken))
      .send({
        batchThresholdMinutes: 10,
        routingPreferences: {
          slaAlerts: { slack: false, email: true, inApp: true },
          comments: { slack: false, email: false, inApp: false },
          recaps: { slack: true, email: true, inApp: true },
        },
      });

    expect(putRes.statusCode).toBe(200);
    expect(putRes.body.success).toBe(true);
    expect(putRes.body.data.preferences.batchThresholdMinutes).toBe(10);
    expect(
      putRes.body.data.preferences.routingPreferences.slaAlerts.slack,
    ).toBe(false);
    expect(putRes.body.data.preferences.routingPreferences.comments.inApp).toBe(
      false,
    );
  });

  it("should queue outbound alerts inside batch threshold window", async () => {
    await createNotifications([userId], {
      title: "SLA Warning",
      description: "Action item due soon",
      category: "tasks",
    });

    const queued = await QueuedNotification.find({ userId });
    expect(queued.length).toBe(1);
    expect(queued[0].status).toBe("pending");
    expect(queued[0].title).toBe("SLA Warning");
  });

  it("should repair relative action URLs to absolute formats", () => {
    const relativeUrl = "/meetings/123";
    const repaired = validateAndRepairLink(relativeUrl);
    expect(repaired).toContain("http://");
    expect(repaired).toContain("/meetings/123");

    const absoluteUrl = "https://example.com/meetings/456";
    const matched = validateAndRepairLink(absoluteUrl);
    expect(matched).toBe(absoluteUrl);
  });

  it("should group multiple notifications into a single digest summary", async () => {
    // 1. Queue multiple comments alerts
    await createNotifications([userId], {
      title: "New Comment",
      description: "John left a note on layout review",
      category: "comments",
    });

    await createNotifications([userId], {
      title: "New Reply",
      description: "Sarah replied to layout review",
      category: "comments",
    });

    const queued = await QueuedNotification.find({ userId });
    expect(queued.length).toBe(2);

    // 2. Set processing time of queued alerts to past
    await QueuedNotification.updateMany(
      {},
      { $set: { processAfter: new Date(Date.now() - 1000) } },
    );

    // 3. Process queue
    await processNotificationQueue();

    // 4. Verify in-app notifications only contain ONE digest summary
    const logs = await notificationModel.find({ user: userId });
    expect(logs.length).toBe(1);
    expect(logs[0].title).toContain("[Digest]");
    expect(logs[0].title).toContain("2 new updates");
    expect(logs[0].description).toContain(
      "1. New Comment: John left a note on layout review",
    );
    expect(logs[0].description).toContain(
      "2. New Reply: Sarah replied to layout review",
    );

    // 5. Verify queued alerts marked as processed
    const processedQueues = await QueuedNotification.find({
      userId,
      status: "processed",
    });
    expect(processedQueues.length).toBe(2);
  });

  it("should respect user preferences and skip delivery if channel is disabled", async () => {
    // Turn off In-App routing channel for recap alerts
    await NotificationPreference.updateOne(
      { user: userId },
      { $set: { "routingPreferences.recaps.inApp": false } },
    );

    // Queue recap notification
    await createNotifications([userId], {
      title: "Meeting Summary Ready",
      description: "The summary for Weekly Sync is ready",
      category: "meetings",
    });

    await QueuedNotification.updateMany(
      {},
      { $set: { processAfter: new Date(Date.now() - 1000) } },
    );
    await processNotificationQueue();

    // In-app log should NOT be created since inApp is disabled
    const logs = await notificationModel.find({ user: userId });
    expect(logs.length).toBe(0);
  });
});
