import MeetingRsvp from "../models/meetingRsvpModel.js";
import Meeting from "../models/meetingModel.js";

/**
 * Initializes RSVP requests for a meeting's participants
 * @param {string} meetingId - The ID of the meeting
 * @param {Array<string>} userIds - Array of user IDs to send RSVPs to
 * @returns {Promise<Array>} Array of created RSVP records
 */
export const initializeRsvps = async (meetingId, userIds) => {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const existingRsvps = await MeetingRsvp.find({ meetingId });
  const existingUserIds = existingRsvps.map((rsvp) => rsvp.userId.toString());

  const newRsvpsToCreate = userIds
    .filter((userId) => !existingUserIds.includes(userId.toString()))
    .map((userId) => ({
      meetingId,
      userId,
      status: "pending",
    }));

  if (newRsvpsToCreate.length > 0) {
    await MeetingRsvp.insertMany(newRsvpsToCreate);
  }

  return await MeetingRsvp.find({ meetingId }).populate(
    "userId",
    "name email profilePicture",
  );
};

/**
 * Updates a user's RSVP status for a meeting
 * @param {string} meetingId - The ID of the meeting
 * @param {string} userId - The user's ID
 * @param {Object} updateData - Status and optional declineReason/availabilityNote
 * @returns {Promise<Object>} Updated RSVP record
 */
export const updateRsvpStatus = async (meetingId, userId, updateData) => {
  const { status, declineReason, availabilityNote } = updateData;

  const validStatuses = [
    "pending",
    "accepted",
    "declined",
    "tentative",
    "waitlisted",
  ];
  if (status && !validStatuses.includes(status)) {
    throw new Error("Invalid RSVP status");
  }

  const updateFields = {};
  if (status) updateFields.status = status;
  if (declineReason !== undefined) updateFields.declineReason = declineReason;
  if (availabilityNote !== undefined)
    updateFields.availabilityNote = availabilityNote;

  const updatedRsvp = await MeetingRsvp.findOneAndUpdate(
    { meetingId, userId },
    { $set: updateFields },
    { new: true, upsert: true },
  ).populate("userId", "name email profilePicture");

  // Synchronize RSVP status to Meeting document's participant list
  const meeting = await Meeting.findById(meetingId);
  if (meeting) {
    if (!Array.isArray(meeting.participants)) {
      meeting.participants = [];
    }

    const participantIdx = meeting.participants.findIndex(
      (p) => p.user?.toString() === userId.toString(),
    );

    if (participantIdx >= 0) {
      if (status) meeting.participants[participantIdx].rsvpStatus = status;
      if (declineReason !== undefined)
        meeting.participants[participantIdx].rsvpReason = declineReason;
    } else if (updatedRsvp.userId) {
      // Add user to participants if not already present
      meeting.participants.push({
        user: userId,
        name: updatedRsvp.userId.name || "Participant",
        email: updatedRsvp.userId.email || "",
        rsvpStatus: status || "pending",
        rsvpReason: declineReason || "",
      });
    }

    // Handle waitlist transitions
    if (!Array.isArray(meeting.waitlist)) {
      meeting.waitlist = [];
    }

    if (status === "waitlisted") {
      const waitlistIdx = meeting.waitlist.findIndex(
        (w) => w.user?.toString() === userId.toString(),
      );
      if (waitlistIdx < 0) {
        meeting.waitlist.push({
          user: userId,
          name: updatedRsvp.userId?.name || "",
          email: updatedRsvp.userId?.email || "",
          note: availabilityNote || "",
          joinedAt: new Date(),
        });
      }
    } else if (status === "accepted" || status === "declined") {
      meeting.waitlist = meeting.waitlist.filter(
        (w) => w.user?.toString() !== userId.toString(),
      );
    }

    await meeting.save();
  }

  return updatedRsvp;
};

/**
 * Retrieves pending RSVPs for a given user
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} List of pending RSVPs with populated meeting details
 */
export const getPendingRsvpsForUser = async (userId) => {
  return await MeetingRsvp.find({ userId, status: "pending" })
    .populate({
      path: "meetingId",
      select: "title date time location duration meetingType",
    })
    .sort({ createdAt: -1 });
};

/**
 * Retrieves all RSVPs (pending and past) for a given user
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} List of mapped RSVPs matching the frontend template
 */
export const getAllRsvpsForUser = async (userId) => {
  const rsvps = await MeetingRsvp.find({ userId })
    .populate({
      path: "meetingId",
      select: "title date time location",
    })
    .sort({ createdAt: -1 });

  return rsvps.map((r) => ({
    id: r._id,
    meetingId: r.meetingId?._id,
    meetingTitle: r.meetingId?.title || "Untitled Shared Workspace Sync",
    meetingDate: r.meetingId?.date,
    meetingTime: r.meetingId?.time,
    status: r.status.toUpperCase(),
    userNotes: r.availabilityNote || r.declineReason || "",
  }));
};

/**
 * Retrieves an RSVP summary for a specific meeting
 * @param {string} meetingId - The ID of the meeting
 * @returns {Promise<Object>} Summary of RSVP statuses
 */
export const getMeetingRsvpSummary = async (meetingId) => {
  const rsvps = await MeetingRsvp.find({ meetingId }).populate(
    "userId",
    "name email profilePicture",
  );

  const summary = {
    total: rsvps.length,
    accepted: 0,
    declined: 0,
    tentative: 0,
    pending: 0,
    waitlisted: 0,
    participants: rsvps,
  };

  rsvps.forEach((rsvp) => {
    if (summary[rsvp.status] !== undefined) {
      summary[rsvp.status]++;
    }
  });

  return summary;
};
