import { getFreeBusy } from "./calendarService.js";
import FocusTimeService from "./focusTimeService.js";
/**
 * Core scheduling algorithm: participant availability → ranked slot proposals.
 */
class SmartScheduler {
  /**
   * @param {Object} params
   * @param {Array} params.participants - User docs with email/name/_id
   * @param {number} params.duration - minutes
   * @param {{ start: Date, end: Date }} params.dateRange
   * @param {Object} params.preferences
   * @param {string|import("mongoose").Types.ObjectId} params.organizerUserId
   */
  static async generateProposals({
    participants,
    duration,
    dateRange,
    preferences,
    organizerUserId,
  }) {
    const emails = participants.map((p) => p.email).filter(Boolean);
    const raw = await getFreeBusy(
      organizerUserId,
      emails,
      dateRange.start,
      dateRange.end,
    );

    // Prefer Google free/busy map (email → { busy: [...] }); empty is OK.
    const freeBusyData = raw?.google || {};

    // Fetch Focus Time intervals for all participants
    const focusTimeData = {};
    for (const participant of participants) {
      const userId = participant._id || participant.id;
      if (userId) {
        const intervals = await FocusTimeService.getActiveIntervals(
          userId,
          dateRange.start,
          dateRange.end,
        );
        focusTimeData[userId] = intervals;
      }
    }

    const allSlots = this.generateTimeSlots(
      dateRange.start,
      dateRange.end,
      duration,
      preferences || {},
    );

    const scoredSlots = allSlots.map((slot) => {
      const analysis = this.analyzeSlot(
        slot,
        participants,
        freeBusyData,
        focusTimeData,
        preferences || {},
      );
      return {
        startTime: slot.start,
        endTime: slot.end,
        score: analysis.score,
        conflicts: analysis.conflicts,
        attendeeCount: analysis.attendeeCount,
      };
    });

    return scoredSlots
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .filter((slot) => slot.score > 0);
  }

  static generateTimeSlots(startDate, endDate, duration, preferences) {
    const slots = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    const step = 30 * 60 * 1000;

    while (current < end) {
      const slotStart = new Date(current);
      const slotEnd = new Date(current.getTime() + duration * 60 * 1000);

      if (this.isValidSlot(slotStart, slotEnd, preferences)) {
        slots.push({ start: slotStart, end: slotEnd });
      }

      current.setTime(current.getTime() + step);
    }

    return slots;
  }

  static isValidSlot(start, end, preferences) {
    const dayOfWeek = start.getDay();
    const hour = start.getHours();

    if (preferences.avoidWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return false;
    }

    if (hour < 9 || hour >= 18) {
      return false;
    }

    if (end.getHours() >= 18 && end.getMinutes() > 0) {
      return false;
    }

    return true;
  }

  static analyzeSlot(
    slot,
    participants,
    freeBusyData,
    focusTimeData,
    preferences,
  ) {
    let score = 100;
    const conflicts = [];
    let availableCount = 0;

    participants.forEach((participant) => {
      const userId = participant._id || participant.id;
      const busyIntervals = freeBusyData[participant.email]?.busy || [];
      const focusIntervals = focusTimeData[userId] || [];

      const isBusyCalendar = this.hasConflict(slot, busyIntervals);
      const isBusyFocusTime = this.hasConflict(slot, focusIntervals);
      const hasHardFocusBlock = focusIntervals.some(
        (fi) =>
          this.hasConflict(slot, [fi]) &&
          (fi.policy === "block" || fi.allowOverride === false),
      );
      const isBusy = isBusyCalendar || isBusyFocusTime;

      if (hasHardFocusBlock) {
        conflicts.push(userId);
        score -= 100; // Heavily penalize or disqualify hard focus blocks
      } else if (isBusy) {
        conflicts.push(userId);
        score -= 20;
      } else {
        availableCount++;
      }
    });

    const attendanceRate =
      participants.length > 0 ? availableCount / participants.length : 0;
    score += attendanceRate * 20;

    const hour = slot.start.getHours();
    if (
      preferences.preferredTimes?.includes("morning") &&
      hour >= 9 &&
      hour < 12
    ) {
      score += 10;
    } else if (
      preferences.preferredTimes?.includes("afternoon") &&
      hour >= 13 &&
      hour < 17
    ) {
      score += 10;
    }

    if (hour < 9 || hour >= 17) {
      score -= 15;
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      conflicts,
      attendeeCount: availableCount,
    };
  }

  static hasConflict(slot, busyIntervals) {
    return busyIntervals.some((busy) => {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      return slot.start < busyEnd && slot.end > busyStart;
    });
  }
}

export default SmartScheduler;
