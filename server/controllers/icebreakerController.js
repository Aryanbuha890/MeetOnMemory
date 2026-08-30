// server/controllers/icebreakerController.js

import mongoose from "mongoose";
import Icebreaker from "../models/icebreakerModel.js";

/**
 * HTTP handlers for /api/icebreakers (Issue #2575).
 *
 * `icebreakerRoutes.js` imported `generate`, `select` and
 * `getActiveIcebreaker` from this module. None of them existed, so importing
 * the router threw a SyntaxError and took the whole server down with it.
 *
 * The exports this file *did* have — `selectIcebreaker` and
 * `handleIcebreakerReaction` — are socket handlers: they take `(io, roomId,
 * ...)`, not `(req, res)`, and are wired up in `socket/`. They were never
 * usable as route handlers. The three below are the HTTP surface, written
 * against `models/icebreakerModel.js`, which already described this feature.
 */

/** Categories the model's enum accepts. */
const CATEGORIES = ["fun", "deep", "work-related"];

/**
 * @desc   Pick a random prompt from the organization's library
 * @route  POST /api/icebreakers/generate
 * @access Private
 */
export const generate = async (req, res) => {
  try {
    const organization = req.user?.organization;
    if (!organization) {
      return res
        .status(403)
        .json({ error: "Organization membership is required" });
    }

    const { category } = req.body || {};
    const match = { organization };

    if (category && category !== "all") {
      if (!CATEGORIES.includes(category)) {
        return res
          .status(400)
          .json({ error: `category must be one of: ${CATEGORIES.join(", ")}` });
      }
      match.category = category;
    }

    // $sample does the selection in the database, so a large prompt library
    // is not loaded into the process just to pick one row from it.
    const [prompt] = await Icebreaker.aggregate([
      { $match: match },
      { $sample: { size: 1 } },
    ]);

    if (!prompt) {
      return res
        .status(404)
        .json({ error: "No icebreaker prompts available for this category" });
    }

    return res.status(200).json({ success: true, data: prompt });
  } catch (_error) {
    return res.status(500).json({ error: "Failed to generate icebreaker" });
  }
};

/**
 * @desc   Record that a prompt was used in a meeting
 * @route  POST /api/icebreakers/select
 * @access Private
 */
export const select = async (req, res) => {
  try {
    const organization = req.user?.organization;
    if (!organization) {
      return res
        .status(403)
        .json({ error: "Organization membership is required" });
    }

    const { icebreakerId, meetingId } = req.body || {};

    if (
      !icebreakerId ||
      !mongoose.Types.ObjectId.isValid(String(icebreakerId))
    ) {
      return res
        .status(400)
        .json({ error: "A valid icebreakerId is required" });
    }
    if (!meetingId || !mongoose.Types.ObjectId.isValid(String(meetingId))) {
      return res.status(400).json({ error: "A valid meetingId is required" });
    }

    // The organization filter is part of the query, not a check afterwards —
    // a prompt from another tenant simply does not match.
    const updated = await Icebreaker.findOneAndUpdate(
      { _id: icebreakerId, organization },
      { $addToSet: { usedInMeetings: meetingId } },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ error: "Icebreaker not found" });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (_error) {
    return res.status(500).json({ error: "Failed to select icebreaker" });
  }
};

/**
 * @desc   The most recent prompt used in a meeting
 * @route  GET /api/icebreakers/meeting/:meetingId
 * @access Private
 */
export const getActiveIcebreaker = async (req, res) => {
  try {
    const organization = req.user?.organization;
    if (!organization) {
      return res
        .status(403)
        .json({ error: "Organization membership is required" });
    }

    const { meetingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(meetingId))) {
      return res.status(400).json({ error: "Invalid meeting id" });
    }

    const active = await Icebreaker.findOne({
      organization,
      usedInMeetings: meetingId,
    })
      .sort({ updatedAt: -1 })
      .lean();

    // No prompt used yet is an ordinary state for a meeting, not an error.
    return res.status(200).json({ success: true, data: active || null });
  } catch (_error) {
    return res.status(500).json({ error: "Failed to fetch active icebreaker" });
  }
};

// Mock persistent storage for session-scoped icebreaker states
const icebreakerSessions = {};

const getSessionData = (roomId) => {
  if (!icebreakerSessions[roomId]) {
    icebreakerSessions[roomId] = { current: null, history: [], reactions: {} };
  }
  return icebreakerSessions[roomId];
};

export const selectIcebreaker = (io, roomId, icebreakerText) => {
  const session = getSessionData(roomId);

  // Push old one to history if it exists
  if (session.current) {
    session.history.unshift({
      text: session.current,
      timestamp: new Date(),
      reactions: { ...session.reactions },
    });
  }

  // Set new state
  session.current = icebreakerText;
  session.reactions = { "🔥": 0, "😂": 0, "❤️": 0, "🙌": 0 };

  // Broadcast updated live state to everyone in the room
  io.to(roomId).emit("icebreaker:sync", {
    current: session.current,
    history: session.history,
    reactions: session.reactions,
  });
};

export const handleIcebreakerReaction = (io, roomId, emoji) => {
  const session = getSessionData(roomId);
  if (session.reactions[emoji] !== undefined) {
    session.reactions[emoji] += 1;
  }

  // Broadcast dynamic live feedback delta
  io.to(roomId).emit("icebreaker:reaction_update", {
    reactions: session.reactions,
  });
};
