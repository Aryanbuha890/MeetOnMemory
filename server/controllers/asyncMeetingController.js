// server/controllers/asyncMeetingController.js

import mongoose from "mongoose";
import AsyncMeeting from "../models/asyncMeetingModel.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";

/**
 * HTTP handlers for /api/async-meetings (Issue #2575).
 *
 * `asyncMeetingRoutes.js` imported `createAsyncMeeting`, `getAsyncMeetings`,
 * `getAsyncMeetingById` and `submitUpdate` from this module. None of them
 * existed, so importing the router threw
 *
 *   SyntaxError: The requested module '../controllers/asyncMeetingController.js'
 *   does not provide an export named 'createAsyncMeeting'
 *
 * and, because `routes/index.js` imports that router, the whole server failed
 * to start.
 *
 * `models/asyncMeetingModel.js` already described exactly this feature, so the
 * handlers below are written against it rather than against the in-memory
 * objects the older exports in this file use. Those older exports are left
 * untouched: `tests/asyncMeeting*.test.js` exercises them directly, and
 * rewriting them is a separate change from making the process boot.
 */

/** Only a participant, the creator, or an admin may read an async meeting. */
const canAccess = (doc, user) => {
  if (!doc || !user?._id) return false;

  const userId = user._id.toString();
  if (doc.creator?.toString() === userId) return true;
  if ((doc.participants || []).some((p) => p?.toString() === userId))
    return true;

  return ["owner", "admin"].includes(user.role);
};

/**
 * @desc   Create an asynchronous meeting
 * @route  POST /api/async-meetings
 * @access Private
 */
export const createAsyncMeeting = async (req, res) => {
  try {
    const { title, template, deadline, participants, originalMeetingId } =
      req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "title is required" });
    }

    if (!Array.isArray(template) || template.length === 0) {
      return res
        .status(400)
        .json({ error: "template must contain at least one question" });
    }

    // A deadline in the past would create a meeting that is locked the moment
    // it exists. `convertToAsync` below already rejects that; the model does
    // not, so the check belongs here too.
    const parsedDeadline = new Date(deadline);
    if (!deadline || Number.isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({ error: "deadline must be a valid date" });
    }
    if (parsedDeadline <= new Date()) {
      return res.status(400).json({ error: "deadline must be in the future" });
    }

    const participantIds = Array.isArray(participants) ? participants : [];
    const invalid = participantIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(String(id)),
    );
    if (invalid.length > 0) {
      return res
        .status(400)
        .json({ error: `Invalid participant id(s): ${invalid.join(", ")}` });
    }

    if (
      originalMeetingId &&
      !mongoose.Types.ObjectId.isValid(String(originalMeetingId))
    ) {
      return res.status(400).json({ error: "originalMeetingId is not valid" });
    }

    const asyncMeeting = await AsyncMeeting.create({
      title: String(title).trim(),
      template: template.map((q) => String(q)),
      deadline: parsedDeadline,
      participants: participantIds,
      originalMeetingId: originalMeetingId || null,
      creator: req.user._id,
    });

    return res.status(201).json({ success: true, data: asyncMeeting });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to create async meeting" });
  }
};

/**
 * @desc   List async meetings the caller creates or participates in
 * @route  GET /api/async-meetings
 * @access Private
 */
export const getAsyncMeetings = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const { status } = req.query;
    const query = {
      $or: [{ creator: req.user._id }, { participants: req.user._id }],
    };

    if (status && status !== "all") {
      if (!["pending", "locked", "completed"].includes(status)) {
        return res.status(400).json({ error: "Unsupported status filter" });
      }
      query.status = status;
    }

    const [meetings, total] = await Promise.all([
      AsyncMeeting.find(query)
        .sort({ deadline: 1 })
        .skip(skip)
        .limit(limit)
        .populate("creator", "name email")
        .populate("participants", "name email")
        .lean(),
      AsyncMeeting.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: meetings,
      pagination: buildPaginationMeta({ total, page, limit }),
    });
  } catch (_error) {
    return res.status(500).json({ error: "Failed to fetch async meetings" });
  }
};

/**
 * @desc   Fetch a single async meeting
 * @route  GET /api/async-meetings/:id
 * @access Private
 */
export const getAsyncMeetingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "Invalid async meeting id" });
    }

    const meeting = await AsyncMeeting.findById(id)
      .populate("creator", "name email")
      .populate("participants", "name email")
      .populate("submissions.user", "name email");

    if (!meeting) {
      return res.status(404).json({ error: "Async meeting not found" });
    }

    if (!canAccess(meeting, req.user)) {
      return res
        .status(403)
        .json({ error: "Not authorized to view this async meeting" });
    }

    return res.status(200).json({ success: true, data: meeting });
  } catch (_error) {
    return res.status(500).json({ error: "Failed to fetch async meeting" });
  }
};

/**
 * @desc   Submit (or replace) the caller's answers
 * @route  POST /api/async-meetings/:id/submit
 * @access Private
 */
export const submitUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: "Invalid async meeting id" });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res
        .status(400)
        .json({ error: "answers must be a non-empty array" });
    }

    const malformed = answers.some((a) => !a?.question || !a?.answer);
    if (malformed) {
      return res
        .status(400)
        .json({ error: "each answer needs a question and an answer" });
    }

    const meeting = await AsyncMeeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: "Async meeting not found" });
    }

    if (!canAccess(meeting, req.user)) {
      return res
        .status(403)
        .json({ error: "Not authorized to submit to this async meeting" });
    }

    // The deadline is the point of an async meeting — enforce it here rather
    // than relying on `status`, which only changes when something updates it.
    if (
      meeting.status === "locked" ||
      new Date() > new Date(meeting.deadline)
    ) {
      return res.status(403).json({
        error:
          "SUBMISSION_LOCKED: The submission deadline has passed for this asynchronous meeting.",
      });
    }

    const userId = req.user._id.toString();
    const existing = meeting.submissions.find(
      (s) => s.user?.toString() === userId,
    );

    if (existing) {
      existing.answers = answers;
      existing.submittedAt = new Date();
    } else {
      meeting.submissions.push({
        user: req.user._id,
        answers,
        submittedAt: new Date(),
      });
    }

    await meeting.save();

    return res.status(200).json({ success: true, data: meeting });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to submit update" });
  }
};

// Mock persistent database tables
const asyncMeetings = {};
const reminderJobsLog = [];

// --- Submission Access Gatekeeper ---
export const submitAsyncResponse = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { userId, responses } = req.body;

    const meeting = asyncMeetings[meetingId];
    if (!meeting)
      return res.status(404).json({ error: "Async meeting not found" });

    // Late Submissions Blocked when Locked Constraint
    const now = new Date();
    if (now > new Date(meeting.deadline)) {
      return res.status(403).json({
        error:
          "SUBMISSION_LOCKED: The submission deadline has passed for this asynchronous meeting.",
      });
    }

    meeting.submissions[userId] = responses;
    return res
      .status(200)
      .json({ success: true, message: "Response submitted successfully" });
  } catch (_error) {
    return res.status(500).json({ error: "Internal submission failure" });
  }
};

// --- Conversion Eligibility Validation Engine ---
export const convertToAsync = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { deadline, attendees } = req.body;

    // Harden validation: ensure deadlines reside in the future and participants exist
    if (!deadline || new Date(deadline) <= new Date()) {
      return res.status(400).json({
        error: "INVALID_DEADLINE: Target deadline must be a future date.",
      });
    }
    if (!attendees || attendees.length === 0) {
      return res.status(400).json({
        error:
          "ELIGIBILITY_FAILED: Cannot convert an empty meeting without participants.",
      });
    }

    asyncMeetings[meetingId] = {
      meetingId,
      deadline: new Date(deadline).toISOString(),
      attendees,
      submissions: {},
      remindersSentCount: 0,
    };

    // Schedule automated notifications 24 hours prior to deadline target
    scheduleDeadlineReminderJob(meetingId, deadline);

    return res
      .status(201)
      .json({ success: true, data: asyncMeetings[meetingId] });
  } catch (_error) {
    return res
      .status(500)
      .json({ error: "Internal processing conversion fault" });
  }
};

// --- Reminder Scheduling Simulation Helper ---
const scheduleDeadlineReminderJob = (meetingId, deadlineIso) => {
  const reminderTime = new Date(
    new Date(deadlineIso).getTime() - 24 * 60 * 60 * 1000,
  );
  reminderJobsLog.push({
    meetingId,
    scheduledFor: reminderTime.toISOString(),
    fired: false,
  });
};

export const triggerScheduledReminders = () => {
  const now = new Date();
  reminderJobsLog.forEach((job) => {
    if (now >= new Date(job.scheduledFor) && !job.fired) {
      job.fired = true;
      const meeting = asyncMeetings[job.meetingId];
      if (meeting) meeting.remindersSentCount += 1;
    }
  });
};

export { asyncMeetings, reminderJobsLog };
