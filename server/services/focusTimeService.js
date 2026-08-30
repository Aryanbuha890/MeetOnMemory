import FocusTimeBlock from "../models/focusTimeBlockModel.js";
import { startOfDay, endOfDay, addDays, getDay } from "date-fns";

class FocusTimeService {
  /**
   * Create a new focus time block
   */
  static async createBlock(userId, data) {
    const block = new FocusTimeBlock({
      ...data,
      userId,
    });
    return await block.save();
  }

  /**
   * Get all focus time blocks for a user
   */
  static async getUserBlocks(userId) {
    return await FocusTimeBlock.find({ userId }).sort({ startTime: 1 });
  }

  /**
   * Update a focus time block
   */
  static async updateBlock(userId, blockId, data) {
    return await FocusTimeBlock.findOneAndUpdate(
      { _id: blockId, userId },
      data,
      { new: true, runValidators: true },
    );
  }

  /**
   * Delete a focus time block
   */
  static async deleteBlock(userId, blockId) {
    return await FocusTimeBlock.findOneAndDelete({ _id: blockId, userId });
  }

  /**
   * Expand a recurring block over a date range to find specific active occurrences.
   * Assumes startTime and endTime represent the time of day for the block.
   */
  static expandRecurringBlock(block, rangeStart, rangeEnd) {
    const occurrences = [];
    const blockStart = new Date(block.startTime);
    const blockEnd = new Date(block.endTime);

    const durationMs = blockEnd.getTime() - blockStart.getTime();

    // Iterate through each day in the range
    let currentDay = startOfDay(rangeStart);
    const endDay = endOfDay(rangeEnd);

    while (currentDay <= endDay) {
      const dayOfWeek = getDay(currentDay);
      if (block.daysOfWeek.includes(dayOfWeek)) {
        // Construct the slot for this day
        const slotStart = new Date(currentDay);
        slotStart.setHours(
          blockStart.getHours(),
          blockStart.getMinutes(),
          blockStart.getSeconds(),
          blockStart.getMilliseconds(),
        );

        const slotEnd = new Date(slotStart.getTime() + durationMs);

        // Check if the expanded slot falls within the actual date range
        if (slotEnd > rangeStart && slotStart < rangeEnd) {
          // We also make sure the recurring block started before this generated slot
          if (slotStart >= blockStart) {
            occurrences.push({
              start: slotStart,
              end: slotEnd,
              blockId: block._id,
              title: block.title || "Focus Time",
              policy: block.policy || "warn",
              allowOverride: block.allowOverride !== false,
            });
          }
        }
      }
      currentDay = addDays(currentDay, 1);
    }

    return occurrences;
  }

  /**
   * Get all active focus time intervals for a user within a specific date range.
   */
  static async getActiveIntervals(userId, rangeStart, rangeEnd) {
    const blocks = await FocusTimeBlock.find({ userId });

    const intervals = [];

    blocks.forEach((block) => {
      if (block.isRecurring) {
        const recurringIntervals = this.expandRecurringBlock(
          block,
          rangeStart,
          rangeEnd,
        );
        intervals.push(...recurringIntervals);
      } else {
        const blockStart = new Date(block.startTime);
        const blockEnd = new Date(block.endTime);

        if (blockEnd > rangeStart && blockStart < rangeEnd) {
          intervals.push({
            start: blockStart,
            end: blockEnd,
            blockId: block._id,
            title: block.title || "Focus Time",
            policy: block.policy || "warn",
            allowOverride: block.allowOverride !== false,
          });
        }
      }
    });

    return intervals;
  }

  /**
   * Check if a specific time slot intersects with any focus time block
   */
  static async isTimeSlotProtected(userId, startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const intervals = await this.getActiveIntervals(userId, start, end);

    // Check for any overlap
    return intervals.some((interval) => {
      return start < interval.end && end > interval.start;
    });
  }

  /**
   * Check conflicts against focus time blocks with policy enforcement details
   */
  static async checkConflicts(userId, startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const intervals = await this.getActiveIntervals(userId, start, end);

    const conflicts = intervals.filter(
      (interval) => start < interval.end && end > interval.start,
    );

    const hasHardBlock = conflicts.some(
      (c) => c.policy === "block" || c.allowOverride === false,
    );

    return {
      hasConflict: conflicts.length > 0,
      hasHardBlock,
      conflicts,
      allowOverride: !hasHardBlock,
    };
  }

  /**
   * Calculate analytics for a user in a date range
   */
  static async calculateAnalytics(userId, startDate, endDate) {
    const intervals = await this.getActiveIntervals(userId, startDate, endDate);

    let hoursProtected = 0;
    intervals.forEach((interval) => {
      // Calculate overlap with the requested date range
      const actualStart =
        interval.start < startDate ? startDate : interval.start;
      const actualEnd = interval.end > endDate ? endDate : interval.end;

      const durationMs = actualEnd.getTime() - actualStart.getTime();
      if (durationMs > 0) {
        hoursProtected += durationMs / (1000 * 60 * 60);
      }
    });

    // A simple streak logic: count consecutive days backwards from endDate with at least one block
    let streak = 0;
    let currentCheckDay = startOfDay(endDate);

    // Sort intervals backwards
    const sortedIntervals = [...intervals].sort((a, b) => b.start - a.start);

    // Let's iterate up to 30 days backwards to find streaks
    for (let i = 0; i < 30; i++) {
      const hasBlockOnDay = sortedIntervals.some((interval) => {
        return (
          interval.start >= currentCheckDay &&
          interval.start <= endOfDay(currentCheckDay)
        );
      });

      if (hasBlockOnDay) {
        streak++;
      } else if (i > 0) {
        // If it's not the first day checked and there's no block, streak ends
        // We allow the first day (today) to have no blocks yet without breaking previous streaks
        break;
      }

      currentCheckDay = addDays(currentCheckDay, -1);
    }

    return {
      hoursProtected: Number(hoursProtected.toFixed(1)),
      streak,
    };
  }
}

export default FocusTimeService;
