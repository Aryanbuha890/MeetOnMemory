import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external model and service dependencies
vi.mock("../models/actionItemModel.js", () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock("../models/membershipModel.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock("../services/GenerativeAIService.js", () => ({
  generateText: vi.fn(),
}));

vi.mock("../services/activityService.js", () => ({
  logActivity: vi.fn(),
}));

import WorkloadService from "../services/workloadService.js";
import ActionItem from "../models/actionItemModel.js";
import Membership from "../models/membershipModel.js";
import { generateText } from "../services/GenerativeAIService.js";

describe("WorkloadService (#2464)", () => {
  const mockOrgId = "org_123";

  const mockMemberships = [
    {
      user: {
        _id: { toString: () => "user_1" },
        name: "Alice",
        email: "alice@test.com",
      },
      role: "admin",
      status: "active",
    },
    {
      user: {
        _id: { toString: () => "user_2" },
        name: "Bob",
        email: "bob@test.com",
      },
      role: "member",
      status: "active",
    },
  ];

  const mockActionItems = [
    {
      _id: { toString: () => "item_1" },
      text: "Refactor API Layer",
      priority: "high",
      assignee: {
        _id: { toString: () => "user_1" },
        name: "Alice",
      },
    },
    {
      _id: { toString: () => "item_2" },
      text: "Fix CSS Bug",
      priority: "medium",
      assignee: {
        _id: { toString: () => "user_1" },
        name: "Alice",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWorkload", () => {
    it("computes workload scores, capacity limits, and member status", async () => {
      Membership.find.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockMemberships),
      });

      const findQuery = {
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockActionItems),
      };
      ActionItem.find.mockReturnValue(findQuery);

      const workloads = await WorkloadService.getWorkload(mockOrgId);

      expect(workloads).toBeDefined();
      expect(workloads.length).toBe(2);

      const alice = workloads.find((w) => w.user._id.toString() === "user_1");
      const bob = workloads.find((w) => w.user._id.toString() === "user_2");

      expect(alice).toBeDefined();
      expect(alice.loadScore).toBe(3); // high (2) + medium (1)
      expect(alice.capacity).toBe(10);
      expect(alice.status).toBe("optimal");

      expect(bob).toBeDefined();
      expect(bob.loadScore).toBe(0);
      expect(bob.status).toBe("underloaded");
    });
  });

  describe("suggestRebalance", () => {
    it("returns heuristic fallback recommendations when AI service fails or returns empty", async () => {
      // Overloaded user with 15 load score
      const heavyItems = Array.from({ length: 6 }).map((_, i) => ({
        _id: { toString: () => `item_${i}` },
        text: `Heavy Task ${i}`,
        priority: "urgent",
        assignee: { _id: { toString: () => "user_1" }, name: "Alice" },
      }));

      Membership.find.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockMemberships),
      });

      ActionItem.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(heavyItems),
      });

      generateText.mockRejectedValue(new Error("AI service unavailable"));

      const result = await WorkloadService.suggestRebalance(mockOrgId);

      expect(result).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].fromUserId).toBe("user_1");
      expect(result.suggestions[0].toUserId).toBe("user_2");
    });
  });

  describe("executeRebalance", () => {
    it("batch reassigns action items and returns status results", async () => {
      const mockItem = {
        _id: "item_1",
        text: "Refactor API Layer",
        assignee: "user_1",
        save: vi.fn().mockResolvedValue(true),
      };

      ActionItem.findOne.mockResolvedValue(mockItem);

      const reassignments = [
        {
          actionItemId: "item_1",
          toUserId: "user_2",
        },
      ];

      const results = await WorkloadService.executeRebalance(
        mockOrgId,
        reassignments,
        "actor_1",
        null,
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("success");
      expect(mockItem.assignee).toBe("user_2");
      expect(mockItem.save).toHaveBeenCalled();
    });

    it("handles missing parameters gracefully", async () => {
      const reassignments = [{ actionItemId: "item_1" }]; // missing toUserId

      const results = await WorkloadService.executeRebalance(
        mockOrgId,
        reassignments,
        "actor_1",
        null,
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("error");
      expect(results[0].error).toBe("Missing parameters");
    });
  });
});
