import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import ActionItemSlaBreach from "../models/actionItemSlaBreachModel.js";
import AuditLog from "../models/auditLogModel.js";
import ActionItemSlaService from "../services/actionItemSlaService.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let adminToken;
let adminUser;
let meeting;
let actionItem;

const orgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await User.deleteMany({ email: /snooze-admin.*@example\.com/ });
  await Meeting.deleteMany({ organization: orgId });
  await ActionItem.deleteMany({ organization: orgId });
  await ActionItemSlaBreach.deleteMany({ organization: orgId });
  await AuditLog.deleteMany({});

  adminUser = await User.create({
    name: "Snooze Admin",
    email: `snooze-admin-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `user_snooze_admin_${Date.now()}`,
  });

  adminToken = createClerkTestToken({
    clerkUserId: adminUser.clerkUserId,
    email: adminUser.email,
  });

  meeting = await Meeting.create({
    title: "Snooze Planning",
    date: new Date(),
    duration: 30,
    organization: orgId,
    uploadedBy: adminUser._id,
  });

  actionItem = await ActionItem.create({
    text: "Snooze the task SLA breaches",
    sourceMeetingId: meeting._id,
    organization: orgId,
    assignee: adminUser._id,
    dueDate: new Date(),
    status: "open",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
  });
});

describe("Action Item Snooze & Custom Notification Follow-up Pipeline (#2589)", () => {
  it("should permit snoozing an action item and generate snooze/unsnooze audit logs", async () => {
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // snooze for 2 hours

    // 1. Snooze task
    const snoozeRes = await request(app)
      .patch(`/api/action-items/${actionItem._id}`)
      .set(authHeader(adminToken))
      .send({
        snoozedUntil: futureDate.toISOString(),
      });

    expect(snoozeRes.statusCode).toBe(200);
    expect(snoozeRes.body.success).toBe(true);
    expect(new Date(snoozeRes.body.data.snoozedUntil).getTime()).toBeCloseTo(
      futureDate.getTime(),
      -2,
    );

    // Verify audit log
    const snoozeLogs = await AuditLog.find({ action: "ACTION_ITEM_SNOOZED" });
    expect(snoozeLogs.length).toBe(1);
    expect(snoozeLogs[0].entityId.toString()).toBe(actionItem._id.toString());

    // 2. Unsnooze task
    const unsnoozeRes = await request(app)
      .patch(`/api/action-items/${actionItem._id}`)
      .set(authHeader(adminToken))
      .send({
        snoozedUntil: null,
      });

    expect(unsnoozeRes.statusCode).toBe(200);
    expect(unsnoozeRes.body.success).toBe(true);
    expect(unsnoozeRes.body.data.snoozedUntil).toBeNull();

    // Verify unsnooze audit log
    const unsnoozeLogs = await AuditLog.find({
      action: "ACTION_ITEM_UNSNOOZED",
    });
    expect(unsnoozeLogs.length).toBe(1);
  });

  it("should support updating custom warning offsets and trigger audit logs", async () => {
    const res = await request(app)
      .patch(`/api/action-items/${actionItem._id}`)
      .set(authHeader(adminToken))
      .send({
        customWarningOffsets: [180, 60],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customWarningOffsets).toEqual([180, 60]);

    // Verify audit log
    const logs = await AuditLog.find({
      action: "ACTION_ITEM_ALERT_OPTIONS_UPDATED",
    });
    expect(logs.length).toBe(1);
  });

  it("should skip SLA breach detection on snoozed action items", async () => {
    // Modify item to be snoozed
    actionItem.snoozedUntil = new Date(Date.now() + 1 * 60 * 60 * 1000); // snoozed for 1h
    // Backdate createdAt to force a breach condition
    actionItem.createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
    await actionItem.save();

    const result = await ActionItemSlaService.detectBreaches(orgId);
    // Since it's snoozed, it should bypass breach detection
    expect(result.newBreaches).toBe(0);
  });
});
