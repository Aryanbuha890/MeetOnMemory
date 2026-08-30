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
import MindMap from "../models/mindMapModel.js";
import ActionItem from "../models/actionItemModel.js";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

const { app } = await import("../server.js");

let testMeeting;
let testUser;
let userToken;
const orgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await User.deleteMany({ email: /mindmap-.*@example\.com/ });
  await Meeting.deleteMany({ title: "MindMap Meeting" });
  await MindMap.deleteMany({});
  await ActionItem.deleteMany({});

  testUser = await User.create({
    name: "MindMap Organizer",
    email: `mindmap-org-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `clerk_mm_${Date.now()}`,
  });

  userToken = createClerkTestToken({
    clerkUserId: testUser.clerkUserId,
    email: testUser.email,
  });

  testMeeting = await Meeting.create({
    title: "MindMap Meeting",
    uploadedBy: testUser._id,
    organization: orgId,
    date: new Date(),
  });
});

describe("Collaborative Live Mind Map & Brainstorming Board Sync Engine (#2592)", () => {
  it("should fetch a blank mind map if none exists", async () => {
    const res = await request(app)
      .get(`/api/mindmap/${testMeeting._id}`)
      .set(authHeader(userToken));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nodes.length).toBe(0);
  });

  it("should save mind map nodes and connections", async () => {
    const nodes = [
      { id: "node-1", text: "Original Idea", x: 100, y: 150 },
      { id: "node-2", text: "Sub Idea", x: 300, y: 250 },
    ];
    const connections = [{ id: "conn-1", source: "node-1", target: "node-2" }];

    const res = await request(app)
      .post(`/api/mindmap/${testMeeting._id}`)
      .set(authHeader(userToken))
      .send({ nodes, connections });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nodes.length).toBe(2);
    expect(res.body.data.connections.length).toBe(1);
  });

  it("should convert a node to an ActionItem", async () => {
    // 1. Create a mind map first
    const nodes = [
      { id: "node-1", text: "Implement OAuth2 Flow", x: 100, y: 150 },
    ];
    await MindMap.create({
      meetingId: testMeeting._id,
      nodes,
      connections: [],
    });

    // 2. Trigger conversion
    const res = await request(app)
      .post(`/api/mindmap/${testMeeting._id}/convert-node`)
      .set(authHeader(userToken))
      .send({
        nodeId: "node-1",
        priority: "high",
        dueDate: new Date().toISOString(),
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.node.isActionItem).toBe(true);
    expect(res.body.data.node.actionItemId).toBeDefined();

    // 3. Check if ActionItem document is created in DB
    const actionItem = await ActionItem.findOne({
      sourceMeetingId: testMeeting._id,
      text: "Implement OAuth2 Flow",
    });
    expect(actionItem).toBeDefined();
    expect(actionItem.priority).toBe("high");
  });

  it("should deny access to GET /api/mindmap/:meetingId for an unauthorized user", async () => {
    const unauthUser = await User.create({
      name: "Unauthorized User",
      email: `mindmap-unauth-${Date.now()}@example.com`,
      password: "Password123!",
      role: "member",
      organization: new mongoose.Types.ObjectId().toString(),
      clerkUserId: `clerk_mm_unauth_${Date.now()}`,
    });

    const unauthToken = createClerkTestToken({
      clerkUserId: unauthUser.clerkUserId,
      email: unauthUser.email,
    });

    const res = await request(app)
      .get(`/api/mindmap/${testMeeting._id}`)
      .set(authHeader(unauthToken));

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("should deny access to POST /api/mindmap/:meetingId for an unauthorized user", async () => {
    const unauthUser = await User.create({
      name: "Unauthorized User",
      email: `mindmap-unauth-${Date.now()}@example.com`,
      password: "Password123!",
      role: "member",
      organization: new mongoose.Types.ObjectId().toString(),
      clerkUserId: `clerk_mm_unauth_${Date.now()}`,
    });

    const unauthToken = createClerkTestToken({
      clerkUserId: unauthUser.clerkUserId,
      email: unauthUser.email,
    });

    const res = await request(app)
      .post(`/api/mindmap/${testMeeting._id}`)
      .set(authHeader(unauthToken))
      .send({ nodes: [], connections: [] });

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("should fail to convert a node to an ActionItem if assignee is unauthorized", async () => {
    const nodes = [
      { id: "node-1", text: "Implement OAuth2 Flow", x: 100, y: 150 },
    ];
    await MindMap.create({
      meetingId: testMeeting._id,
      nodes,
      connections: [],
    });

    const unauthUser = await User.create({
      name: "Unauthorized User",
      email: `mindmap-unauth-${Date.now()}@example.com`,
      password: "Password123!",
      role: "member",
      organization: new mongoose.Types.ObjectId().toString(),
      clerkUserId: `clerk_mm_unauth_${Date.now()}`,
    });

    const res = await request(app)
      .post(`/api/mindmap/${testMeeting._id}/convert-node`)
      .set(authHeader(userToken))
      .send({
        nodeId: "node-1",
        assignee: unauthUser._id.toString(),
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Assignee is not a valid participant");
  });
});
