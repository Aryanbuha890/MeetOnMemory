// server/controllers/minutesApprovalController.js

import mongoose from "mongoose";
import MinutesApproval from "../models/minutesApprovalModel.js";

/**
 * HTTP handlers for /api/meetings/:meetingId/minutes-approval (Issue #2575).
 *
 * `minutesApprovalRoutes.js` imported `getApprovalStatus`, `submitApproval`
 * and `respondApproval`. None of them existed, so importing the router threw a
 * SyntaxError at startup.
 *
 * The router is mounted with `mergeParams: true` under a prefix that carries
 * `:meetingId`, so these read the meeting from `req.params.meetingId` — not
 * the `:minutesId` the older mock-store exports in this file use.
 * `models/minutesApprovalModel.js` is one document per meeting, which is what
 * the route shape implies.
 */

/** Response statuses an approver may record. */
const RESPONSES = ["approved", "rejected"];

/**
 * Recomputes the document status from its individual approvals.
 *
 * One rejection is decisive — there is no point asking the remaining
 * approvers to weigh in on minutes that are going to be revised. Otherwise
 * every approver has to have approved.
 */
const deriveStatus = (approvals) => {
  if (approvals.some((a) => a.status === "rejected")) return "rejected";
  if (approvals.length > 0 && approvals.every((a) => a.status === "approved"))
    return "approved";
  return "pending";
};

/**
 * @desc   Current approval state for a meeting's minutes
 * @route  GET /api/meetings/:meetingId/minutes-approval
 * @access Private
 */
export const getApprovalStatus = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(meetingId))) {
      return res.status(400).json({ error: "Invalid meeting id" });
    }

    const approval = await MinutesApproval.findOne({ meetingId })
      .populate("submittedBy", "name email")
      .populate("approvals.approver", "name email")
      .lean();

    // Minutes that have never been submitted are not an error — the client
    // needs to distinguish "not submitted" from "pending", so say which.
    if (!approval) {
      return res
        .status(200)
        .json({ success: true, data: null, status: "not_submitted" });
    }

    return res
      .status(200)
      .json({ success: true, data: approval, status: approval.status });
  } catch (_error) {
    return res.status(500).json({ error: "Failed to fetch approval status" });
  }
};

/**
 * @desc   Submit minutes for approval
 * @route  POST /api/meetings/:meetingId/minutes-approval/submit
 * @access Private
 */
export const submitApproval = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const snapshotSummary = req.body?.snapshotSummary || req.body?.summary;
    const approvers = req.body?.approvers || req.body?.approverIds;

    if (!mongoose.Types.ObjectId.isValid(String(meetingId))) {
      return res.status(400).json({ error: "Invalid meeting id" });
    }

    if (!snapshotSummary || !String(snapshotSummary).trim()) {
      return res.status(400).json({ error: "snapshotSummary is required" });
    }

    if (!Array.isArray(approvers) || approvers.length === 0) {
      return res
        .status(400)
        .json({ error: "approvers must be a non-empty array" });
    }

    const invalid = approvers.filter(
      (id) => !mongoose.Types.ObjectId.isValid(String(id)),
    );
    if (invalid.length > 0) {
      return res
        .status(400)
        .json({ error: `Invalid approver id(s): ${invalid.join(", ")}` });
    }

    const existing = await MinutesApproval.findOne({ meetingId });
    if (existing && existing.status === "pending") {
      return res.status(409).json({
        error: "Minutes for this meeting are already awaiting approval",
      });
    }

    const payload = {
      meetingId,
      submittedBy: req.user._id,
      snapshotSummary: String(snapshotSummary),
      status: "pending",
      approvals: [...new Set(approvers.map(String))].map((approver) => ({
        approver,
        status: "pending",
        comment: "",
        respondedAt: null,
      })),
    };

    // `meetingId` is unique on the model, so a resubmission updates the
    // existing document rather than colliding with it.
    const approval = await MinutesApproval.findOneAndUpdate(
      { meetingId },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return res.status(201).json({ success: true, data: approval });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to submit minutes" });
  }
};

/**
 * @desc   Record an approver's decision
 * @route  PUT /api/meetings/:meetingId/minutes-approval/respond
 * @access Private
 */
export const respondApproval = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { status, comment } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(String(meetingId))) {
      return res.status(400).json({ error: "Invalid meeting id" });
    }

    if (!RESPONSES.includes(status)) {
      return res
        .status(400)
        .json({ error: `status must be one of: ${RESPONSES.join(", ")}` });
    }

    const approval = await MinutesApproval.findOne({ meetingId });
    if (!approval) {
      return res
        .status(404)
        .json({ error: "No minutes have been submitted for this meeting" });
    }

    // Being listed as an approver *is* the authorization. Anyone else
    // responding would silently change the outcome of the vote.
    const userId = req.user._id.toString();
    const entry = approval.approvals.find(
      (a) => a.approver?.toString() === userId,
    );

    if (!entry) {
      return res
        .status(403)
        .json({ error: "You are not an approver for these minutes" });
    }

    entry.status = status;
    entry.comment = comment ? String(comment) : "";
    entry.respondedAt = new Date();

    approval.status = deriveStatus(approval.approvals);
    await approval.save();

    return res.status(200).json({ success: true, data: approval });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to record approval" });
  }
};
