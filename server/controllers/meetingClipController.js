import mongoose from "mongoose";
import MeetingClip from "../models/meetingClipModel.js";
import Meeting from "../models/meetingModel.js";
import clipExtractionService from "../services/clipExtractionService.js";
import meetingClipExportService from "../services/meetingClipExportService.js";
import { canAccessMeetingDoc } from "../middleware/rbac.js";

const CLIP_MODERATOR_ROLES = new Set(["owner", "admin", "moderator"]);

const clipError = (res, status, error) =>
  res.status(status).json({ error, message: error });

const canManageClip = (clip, user) => {
  if (!clip?.createdBy || !user?._id) return false;
  return (
    clip.createdBy.toString() === user._id.toString() ||
    CLIP_MODERATOR_ROLES.has(user.role)
  );
};

/**
 * Resolve :clipId and the meeting it belongs to, then confirm the caller
 * may see that meeting. Cross-tenant ids return 404 so existence is not leaked.
 */
const loadAccessibleClip = async (req, res) => {
  const { clipId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(clipId)) {
    clipError(res, 400, "Invalid clip ID");
    return null;
  }

  const clip = await MeetingClip.findById(clipId);
  if (!clip) {
    clipError(res, 404, "Clip not found");
    return null;
  }

  const meeting = await Meeting.findById(clip.meeting);
  if (!meeting || !canAccessMeetingDoc(meeting, req.user)) {
    clipError(res, 404, "Clip not found");
    return null;
  }

  return { clip, meeting };
};

const authorizeMeetingAccess = async (req, res, meetingId) => {
  if (!meetingId || !mongoose.Types.ObjectId.isValid(meetingId)) {
    clipError(res, 400, "Invalid meeting ID");
    return null;
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting || !canAccessMeetingDoc(meeting, req.user)) {
    clipError(res, 403, "Forbidden: You don't have access to this resource");
    return null;
  }

  return meeting;
};

/**
 * Create a new meeting clip
 */
export const createClip = async (req, res) => {
  try {
    const { meetingId, title, description, startTime, endTime, labels } =
      req.body;

    if (
      !meetingId ||
      !title ||
      startTime === undefined ||
      endTime === undefined
    ) {
      return clipError(res, 400, "Missing required fields");
    }

    const meeting = await authorizeMeetingAccess(req, res, meetingId);
    if (!meeting) return;

    const transcriptSegments = await clipExtractionService.extractSegments(
      meetingId,
      startTime,
      endTime,
    );

    const newClip = new MeetingClip({
      meeting: meetingId,
      createdBy: req.user._id,
      title,
      description,
      startTime,
      endTime,
      labels,
      transcriptSegments,
    });

    await newClip.save();

    res.status(201).json(newClip);
  } catch (error) {
    console.error("Error creating meeting clip:", error);
    clipError(res, 500, error.message || "Failed to create meeting clip");
  }
};

/**
 * Get all clips for a specific meeting
 */
export const getClipsForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const clips = await MeetingClip.find({ meeting: meetingId })
      .populate("createdBy", "name email")
      .populate("annotations.user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(clips);
  } catch (error) {
    console.error("Error fetching meeting clips:", error);
    clipError(res, 500, "Failed to fetch meeting clips");
  }
};

/**
 * Update a meeting clip
 */
export const updateClip = async (req, res) => {
  try {
    const ctx = await loadAccessibleClip(req, res);
    if (!ctx) return;

    if (!canManageClip(ctx.clip, req.user)) {
      return clipError(
        res,
        403,
        "Forbidden: You don't have permission to update this clip",
      );
    }

    const { title, description, labels } = req.body;

    if (title) ctx.clip.title = title;
    if (description !== undefined) ctx.clip.description = description;
    if (labels) ctx.clip.labels = labels;

    await ctx.clip.save();

    res.status(200).json(ctx.clip);
  } catch (error) {
    console.error("Error updating meeting clip:", error);
    clipError(res, 500, "Failed to update meeting clip");
  }
};

/**
 * Delete a meeting clip
 */
export const deleteClip = async (req, res) => {
  try {
    const ctx = await loadAccessibleClip(req, res);
    if (!ctx) return;

    if (!canManageClip(ctx.clip, req.user)) {
      return clipError(
        res,
        403,
        "Forbidden: You don't have permission to delete this clip",
      );
    }

    await MeetingClip.findByIdAndDelete(ctx.clip._id);

    res.status(200).json({ message: "Clip deleted successfully" });
  } catch (error) {
    console.error("Error deleting meeting clip:", error);
    clipError(res, 500, "Failed to delete meeting clip");
  }
};

/**
 * Add an annotation to a clip
 */
export const addAnnotation = async (req, res) => {
  try {
    const { text, timestamp } = req.body;

    if (!text || timestamp === undefined) {
      return clipError(res, 400, "Text and timestamp are required");
    }

    const ctx = await loadAccessibleClip(req, res);
    if (!ctx) return;

    const newAnnotation = {
      text,
      timestamp,
      user: req.user._id,
    };

    ctx.clip.annotations.push(newAnnotation);
    await ctx.clip.save();

    await ctx.clip.populate("annotations.user", "name email");

    const addedAnnotation =
      ctx.clip.annotations[ctx.clip.annotations.length - 1];

    res.status(201).json(addedAnnotation);
  } catch (error) {
    console.error("Error adding annotation to clip:", error);
    clipError(res, 500, "Failed to add annotation");
  }
};

/**
 * Trim a meeting clip file boundaries
 */
export const trimClipController = async (req, res) => {
  try {
    const ctx = await loadAccessibleClip(req, res);
    if (!ctx) return;

    if (!canManageClip(ctx.clip, req.user)) {
      return clipError(
        res,
        403,
        "Forbidden: You don't have permission to modify this clip",
      );
    }

    const { startTime, endTime } = req.body;
    if (startTime === undefined || endTime === undefined) {
      return clipError(res, 400, "startTime and endTime are required");
    }

    const io = req.app.get("io");
    const updatedClip = await meetingClipExportService.trimClip(
      ctx.clip._id,
      startTime,
      endTime,
      io,
    );

    res.status(200).json({ success: true, data: updatedClip });
  } catch (error) {
    console.error("Error trimming meeting clip:", error);
    clipError(res, 500, error.message || "Failed to trim meeting clip");
  }
};

/**
 * Merge multiple meeting clips
 */
export const mergeClipsController = async (req, res) => {
  try {
    const { clipIds, title } = req.body;
    if (!clipIds || clipIds.length === 0) {
      return clipError(res, 400, "clipIds are required for merge");
    }

    // Verify access to all source clips
    const clips = await MeetingClip.find({ _id: { $in: clipIds } });
    if (clips.length !== clipIds.length) {
      return clipError(res, 400, "Some clips were not found");
    }

    // Validate merge scope: all clips must belong to the same meeting
    const firstMeetingId = clips[0].meeting.toString();
    const sameMeeting = clips.every(
      (c) => c.meeting.toString() === firstMeetingId,
    );
    if (!sameMeeting) {
      return clipError(res, 400, "Cannot merge clips from different meetings");
    }

    // RBAC verification for all clips
    for (const clip of clips) {
      const meeting = await Meeting.findById(clip.meeting);
      if (!meeting || !canAccessMeetingDoc(meeting, req.user)) {
        return clipError(
          res,
          403,
          "Forbidden: You don't have access to all selected clips",
        );
      }
    }

    const io = req.app.get("io");
    const userId = req.user._id;
    const compilation = await meetingClipExportService.mergeClips(
      clipIds,
      title,
      userId,
      io,
    );

    res.status(200).json({ success: true, data: compilation });
  } catch (error) {
    console.error("Error merging meeting clips:", error);
    clipError(res, 500, error.message || "Failed to merge meeting clips");
  }
};
