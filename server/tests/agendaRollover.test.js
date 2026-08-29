import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import AuditLog from "../models/auditLogModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let sourceMeeting, targetMeeting;
let testUser, otherOrgUser;
let userToken, otherUserToken;

const orgId = new mongoose.Types.ObjectId().toString();
const otherOrgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await User.deleteMany({ email: /rollover-.*@example\.com/ });
  await Meeting.deleteMany({ title: /Rollover Meeting.*/ });
  await AuditLog.deleteMany({});

  testUser = await User.create({
    name: "Rollover Organizer",
    email: `rollover-org-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `clerk_roll_${Date.now()}`,
  });

  otherOrgUser = await User.create({
    name: "Other Org User",
    email: `rollover-other-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: otherOrgId,
    clerkUserId: `clerk_other_${Date.now()}`,
  });

  userToken = createClerkTestToken({
    clerkUserId: testUser.clerkUserId,
    email: testUser.email,
  });

  otherUserToken = createClerkTestToken({
    clerkUserId: otherOrgUser.clerkUserId,
    email: otherOrgUser.email,
  });

  // Create completed meeting with some finished and some unfinished agenda items
  sourceMeeting = await Meeting.create({
    title: "Rollover Meeting Source",
    uploadedBy: testUser._id,
    organization: orgId,
    date: new Date(),
    agendaItems: [
      {
        text: "Database Upgrade Options",
        duration: 10,
        status: "completed",
        actualDuration: 20 * 60000, // 20 minutes (overrun)
        position: 0,
      },
      {
        text: "UX Redesign Review",
        duration: 15,
        status: "pending",
        position: 1,
      },
      {
        text: "Feedback Loop Session",
        duration: 5,
        status: "skipped",
        position: 2,
      },
    ],
  });

  targetMeeting = await Meeting.create({
    title: "Rollover Meeting Target",
    uploadedBy: testUser._id,
    organization: orgId,
    date: new Date(),
    agendaItems: [],
  });
});

describe("Automated Recurring Agenda Rollover & Smart Template Recommendation (#2591)", () => {
  it("should fetch a preview of unfinished agenda items and recommend timing adjustments based on history", async () => {
    const res = await request(app)
      .get("/api/meetings/rollover/preview")
      .query({ sourceMeetingId: sourceMeeting._id.toString() })
      .set(authHeader(userToken));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const items = res.body.data.agendaItems;
    // Database Upgrade Options should NOT be there as it was completed.
    // UX Redesign Review and Feedback Loop Session should be present.
    expect(items.length).toBe(2);

    const uxReview = items.find((i) => i.text === "UX Redesign Review");
    const feedbackSession = items.find(
      (i) => i.text === "Feedback Loop Session",
    );
    expect(uxReview).toBeDefined();
    expect(feedbackSession).toBeDefined();

    // Check that custom properties are returned
    expect(uxReview.rolledOver).toBe(true);
    expect(uxReview.sourceAgendaItemId).toBeDefined();
  });

  it("should restrict preview checks across organization boundaries", async () => {
    const res = await request(app)
      .get("/api/meetings/rollover/preview")
      .query({ sourceMeetingId: sourceMeeting._id.toString() })
      .set(authHeader(otherUserToken));

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("should perform rollover on the target meeting draft and write an audit log", async () => {
    const res = await request(app)
      .post(`/api/meetings/${targetMeeting._id}/rollover`)
      .set(authHeader(userToken))
      .send({ sourceMeetingId: sourceMeeting._id.toString() });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const targetUpdated = await Meeting.findById(targetMeeting._id);
    expect(targetUpdated.agendaItems.length).toBe(2);
    expect(targetUpdated.agendaItems[0].text).toBe("UX Redesign Review");

    // Check that an audit log log entry was generated
    const auditLogs = await AuditLog.find({ entityId: targetMeeting._id });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toBe("AGENDA_ROLLOVER");
  });
});
