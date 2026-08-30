import mongoose from "mongoose";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import FocusTimeService from "../services/focusTimeService.js";
import FocusTimeBlock from "../models/focusTimeBlockModel.js";
import { addDays } from "date-fns";

let mockBlocks = [];

vi.mock("../models/focusTimeBlockModel.js", () => {
  return {
    default: {
      find: vi.fn().mockImplementation(({ userId }) => {
        const filtered = mockBlocks.filter(
          (b) => !userId || b.userId?.toString() === userId?.toString(),
        );
        return {
          sort: vi.fn().mockResolvedValue(filtered),
          then: (resolve) => Promise.resolve(filtered).then(resolve),
          catch: (reject) => Promise.resolve(filtered).catch(reject),
          [Symbol.iterator]: function* () {
            yield* filtered;
          },
        };
      }),
      create: vi.fn().mockImplementation((data) => {
        const block = {
          _id: new mongoose.Types.ObjectId().toString(),
          ...data,
        };
        mockBlocks.push(block);
        return Promise.resolve(block);
      }),
      deleteMany: vi.fn().mockImplementation(() => {
        mockBlocks = [];
        return Promise.resolve();
      }),
    },
  };
});

describe("FocusTimeService", () => {
  const userId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    mockBlocks = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockBlocks = [];
  });

  describe("expandRecurringBlock", () => {
    it("should expand a recurring block over a date range", () => {
      const today = new Date();
      const nextWeek = addDays(today, 7);

      const blockStart = new Date(2023, 0, 1, 9, 0, 0, 0);
      const blockEnd = new Date(2023, 0, 1, 11, 0, 0, 0);

      const block = {
        startTime: blockStart.toISOString(),
        endTime: blockEnd.toISOString(),
        isRecurring: true,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Everyday
      };

      const occurrences = FocusTimeService.expandRecurringBlock(
        block,
        today,
        nextWeek,
      );

      // Should find at least one occurrence in a 7-day span
      expect(occurrences.length).toBeGreaterThan(0);
      occurrences.forEach((occ) => {
        expect(occ.start.getHours()).toBe(9);
        expect(occ.end.getHours()).toBe(11);
      });
    });
  });

  describe("getActiveIntervals", () => {
    it("should return intervals for non-recurring blocks", async () => {
      const today = new Date();
      const tomorrow = addDays(today, 1);

      await FocusTimeBlock.create({
        userId,
        startTime: today,
        endTime: tomorrow,
        isRecurring: false,
      });

      const intervals = await FocusTimeService.getActiveIntervals(
        userId,
        addDays(today, -1),
        addDays(tomorrow, 1),
      );

      expect(intervals.length).toBe(1);
    });
  });

  describe("isTimeSlotProtected", () => {
    it("should return true if a slot overlaps with a focus block", async () => {
      const start = new Date("2024-01-01T10:00:00Z");
      const end = new Date("2024-01-01T12:00:00Z");

      await FocusTimeBlock.create({
        userId,
        startTime: start,
        endTime: end,
        isRecurring: false,
      });

      // Complete overlap
      const result = await FocusTimeService.isTimeSlotProtected(
        userId,
        new Date("2024-01-01T10:30:00Z"),
        new Date("2024-01-01T11:30:00Z"),
      );

      expect(result).toBe(true);
    });

    it("should return false if there is no overlap", async () => {
      const start = new Date("2024-01-01T10:00:00Z");
      const end = new Date("2024-01-01T12:00:00Z");

      await FocusTimeBlock.create({
        userId,
        startTime: start,
        endTime: end,
        isRecurring: false,
      });

      // No overlap
      const result = await FocusTimeService.isTimeSlotProtected(
        userId,
        new Date("2024-01-01T13:00:00Z"),
        new Date("2024-01-01T14:00:00Z"),
      );

      expect(result).toBe(false);
    });
  });

  describe("checkConflicts", () => {
    it("should detect conflict and differentiate warn vs strict block", async () => {
      const start = new Date("2024-01-01T10:00:00Z");
      const end = new Date("2024-01-01T12:00:00Z");

      await FocusTimeBlock.create({
        userId,
        startTime: start,
        endTime: end,
        isRecurring: false,
        policy: "block",
        allowOverride: false,
      });

      const conflict = await FocusTimeService.checkConflicts(
        userId,
        new Date("2024-01-01T10:30:00Z"),
        new Date("2024-01-01T11:30:00Z"),
      );

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.hasHardBlock).toBe(true);
      expect(conflict.allowOverride).toBe(false);
      expect(conflict.conflicts.length).toBe(1);
    });

    it("should allow override for warn policy", async () => {
      const start = new Date("2024-01-01T10:00:00Z");
      const end = new Date("2024-01-01T12:00:00Z");

      await FocusTimeBlock.create({
        userId,
        startTime: start,
        endTime: end,
        isRecurring: false,
        policy: "warn",
        allowOverride: true,
      });

      const conflict = await FocusTimeService.checkConflicts(
        userId,
        new Date("2024-01-01T10:30:00Z"),
        new Date("2024-01-01T11:30:00Z"),
      );

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.hasHardBlock).toBe(false);
      expect(conflict.allowOverride).toBe(true);
    });
  });
});
