import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import Decision from "../models/decisionModel.js";
import DecisionVote from "../models/decisionVoteModel.js";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import AuditLog from "../models/auditLogModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import { calculateConsensus } from "../services/decisionConsensusService.js";

let testMeeting;
let testDecision;
let ownerToken, adminToken, memberToken;
let testOwner, testAdmin, testMember;

const orgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await User.deleteMany({ email: /consensus-.*@example\.com/ });
  await Meeting.deleteMany({ title: "Consensus Meeting" });
  await Decision.deleteMany({});
  await DecisionVote.deleteMany({});
  await AuditLog.deleteMany({});

  // 1. Create different role users
  testOwner = await User.create({
    name: "Consensus Owner",
    email: `consensus-owner-${Date.now()}@example.com`,
    password: "Password123!",
    role: "owner",
    organization: orgId,
    clerkUserId: `clerk_owner_${Date.now()}`,
  });

  testAdmin = await User.create({
    name: "Consensus Admin",
    email: `consensus-admin-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `clerk_admin_${Date.now()}`,
  });

  testMember = await User.create({
    name: "Consensus Member",
    email: `consensus-member-${Date.now()}@example.com`,
    password: "Password123!",
    role: "member",
    organization: orgId,
    clerkUserId: `clerk_member_${Date.now()}`,
  });

  ownerToken = createClerkTestToken({
    clerkUserId: testOwner.clerkUserId,
    email: testOwner.email,
  });

  adminToken = createClerkTestToken({
    clerkUserId: testAdmin.clerkUserId,
    email: testAdmin.email,
  });

  memberToken = createClerkTestToken({
    clerkUserId: testMember.clerkUserId,
    email: testMember.email,
  });

  // 2. Create Meeting
  testMeeting = await Meeting.create({
    title: "Consensus Meeting",
    uploadedBy: testAdmin._id,
    organization: orgId,
    date: new Date(),
  });

  // 3. Create Decision
  testDecision = await Decision.create({
    text: "Implement microservices architecture",
    sourceMeetingId: testMeeting._id,
    organization: orgId,
    consensusThreshold: 60, // 60%
  });
});

describe("Collaborative Decision Consensus Engine & Impact Matrix (#2553)", () => {
  it("should record user votes and compute role-weighted scores", async () => {
    // 1. Member votes Approve (weight 1)
    const res1 = await request(app)
      .post(`/api/decisions/${testDecision._id}/vote`)
      .set(authHeader(memberToken))
      .send({ vote: "approve" });

    expect(res1.statusCode).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.consensus.stats.approve).toBe(1);

    // 2. Owner votes Reject (weight 3, vetoes)
    const res2 = await request(app)
      .post(`/api/decisions/${testDecision._id}/vote`)
      .set(authHeader(ownerToken))
      .send({ vote: "reject" });

    expect(res2.statusCode).toBe(200);
    expect(res2.body.consensus.status).toBe("vetoed");
    expect(res2.body.consensus.stats.reject).toBe(3);
  });

  it("should mark consensus status as passed dynamically when threshold is breached", async () => {
    // Owner votes Approve (weight 3)
    await DecisionVote.create({
      decisionId: testDecision._id,
      userId: testOwner._id,
      vote: "approve",
      weight: 3,
    });

    // Member votes Reject (weight 1)
    await DecisionVote.create({
      decisionId: testDecision._id,
      userId: testMember._id,
      vote: "reject",
      weight: 1,
    });

    // Consensus rate = 3 / (3 + 1) * 100 = 75% >= 60%
    const res = await calculateConsensus(testDecision._id);
    expect(res.consensusRate).toBe(75);
    expect(res.status).toBe("passed");

    // Check that an audit log log entry was generated
    const auditLogs = await AuditLog.find({ entityId: testDecision._id });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toBe("DECISION_CONSENSUS_PASSED");
  });

  it("should retrieve consensus distribution for a decision", async () => {
    await DecisionVote.create({
      decisionId: testDecision._id,
      userId: testAdmin._id,
      vote: "approve",
      weight: 3,
    });

    const res = await request(app)
      .get(`/api/decisions/${testDecision._id}/consensus`)
      .set(authHeader(adminToken));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats.approve).toBe(3);
  });

  it("should fetch all decisions consensus details for a meeting", async () => {
    const res = await request(app)
      .get(`/api/decisions/meeting/${testMeeting._id}`)
      .set(authHeader(adminToken));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].decision.text).toBe(
      "Implement microservices architecture",
    );
  });
});
