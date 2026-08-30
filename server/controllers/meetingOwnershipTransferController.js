import MeetingOwnershipTransfer from "../models/meetingOwnershipTransferModel.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import AuditLog from "../models/auditLogModel.js";
import { createNotification } from "../services/notificationService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

const errorResponse = (res, statusCode, message, errorData) =>
  sendError(res, statusCode, message, errorData);
const successResponse = (res, statusCode, message, data) =>
  sendSuccess(res, data, message, statusCode);

// 1. Initiate Transfer
export const initiateTransfer = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { targetUserId } = req.body;
    const fromUserId = req.user._id;

    if (String(targetUserId) === String(fromUserId)) {
      return errorResponse(res, 400, "Cannot transfer ownership to yourself");
    }

    const meeting = await Meeting.findOne({
      _id: meetingId,
      uploadedBy: fromUserId, // Must be the current owner
    });

    if (!meeting) {
      return errorResponse(
        res,
        404,
        "Meeting not found or you are not the owner",
      );
    }

    const toUser = await User.findById(targetUserId);
    if (
      !toUser ||
      String(toUser.organization) !== String(meeting.organization)
    ) {
      return errorResponse(
        res,
        400,
        "Target user not found or not in the same organization",
      );
    }

    // Check if there's already a pending transfer
    const existing = await MeetingOwnershipTransfer.findOne({
      meeting: meetingId,
      status: "pending",
    });

    if (existing) {
      return errorResponse(
        res,
        400,
        "A transfer request is already pending for this meeting",
      );
    }

    const transfer = await MeetingOwnershipTransfer.create({
      meeting: meetingId,
      organization: meeting.organization,
      fromUser: fromUserId,
      toUser: targetUserId,
      status: "pending",
    });

    // Notify the target user
    await createNotification(
      targetUserId,
      "Meeting Ownership Transfer Request",
      `${req.user.name} wants to transfer ownership of the meeting "${meeting.title}" to you.`,
      "system",
      "/notifications?tab=all",
      "View Transfer",
      { transferId: transfer._id, meetingId },
      true,
    );

    return successResponse(
      res,
      201,
      "Transfer request initiated successfully",
      { transfer },
    );
  } catch (error) {
    console.error("Error initiating transfer:", error);
    return errorResponse(res, 500, "Failed to initiate transfer");
  }
};

// 2. Get Transfer Inbox (Pending requests to the user)
export const getTransferInbox = async (req, res) => {
  try {
    const userId = req.user._id;

    const transfers = await MeetingOwnershipTransfer.find({
      toUser: userId,
      status: "pending",
    })
      .populate("meeting", "title date")
      .populate("fromUser", "name email")
      .sort({ createdAt: -1 });

    return successResponse(res, 200, "Fetched transfer inbox", { transfers });
  } catch (error) {
    console.error("Error fetching transfer inbox:", error);
    return errorResponse(res, 500, "Failed to fetch transfers");
  }
};

// 3. Accept Transfer
export const acceptTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    const userId = req.user._id;

    const transfer = await MeetingOwnershipTransfer.findOne({
      _id: transferId,
      toUser: userId,
      status: "pending",
    }).populate("meeting", "title");

    if (!transfer) {
      return errorResponse(
        res,
        404,
        "Transfer request not found or not pending",
      );
    }

    if (new Date() > transfer.expiresAt) {
      transfer.status = "expired";
      await transfer.save();
      return errorResponse(res, 400, "This transfer request has expired");
    }

    // Process the transfer
    const meeting = await Meeting.findById(transfer.meeting._id);
    if (!meeting) {
      return errorResponse(res, 404, "Meeting not found");
    }

    meeting.uploadedBy = userId;
    await meeting.save();

    transfer.status = "accepted";
    await transfer.save();

    // Audit Log
    await AuditLog.create({
      organization: transfer.organization,
      user: userId,
      action: "meeting_transferred",
      resource: "Meeting",
      resourceId: meeting._id,
      details: {
        fromUser: transfer.fromUser,
        toUser: userId,
        meetingTitle: meeting.title,
      },
    });

    // Notify the original owner
    await createNotification(
      transfer.fromUser,
      "Transfer Accepted",
      `${req.user.name} has accepted ownership of the meeting "${meeting.title}".`,
      "system",
      `/meetings/${meeting._id}`,
      "View Meeting",
      { meetingId: meeting._id },
      true,
    );

    return successResponse(res, 200, "Transfer accepted successfully");
  } catch (error) {
    console.error("Error accepting transfer:", error);
    return errorResponse(res, 500, "Failed to accept transfer");
  }
};

// 4. Reject Transfer
export const rejectTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    const userId = req.user._id;

    const transfer = await MeetingOwnershipTransfer.findOne({
      _id: transferId,
      toUser: userId,
      status: "pending",
    }).populate("meeting", "title");

    if (!transfer) {
      return errorResponse(
        res,
        404,
        "Transfer request not found or not pending",
      );
    }

    transfer.status = "rejected";
    await transfer.save();

    // Notify the original owner
    await createNotification(
      transfer.fromUser,
      "Transfer Rejected",
      `${req.user.name} has declined ownership of the meeting "${transfer.meeting?.title}".`,
      "system",
      "",
      "",
      {},
      true,
    );

    return successResponse(res, 200, "Transfer rejected successfully");
  } catch (error) {
    console.error("Error rejecting transfer:", error);
    return errorResponse(res, 500, "Failed to reject transfer");
  }
};
