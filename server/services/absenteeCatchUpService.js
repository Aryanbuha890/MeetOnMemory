import Meeting from "../models/meetingModel.js";
import MeetingRsvp from "../models/meetingRsvpModel.js";
import AbsenteeCatchUp from "../models/absenteeCatchUpModel.js";
import userModel from "../models/userModel.js";
import { generateAbsenteeCatchUpAI } from "./GenerativeAIService.js";
import EmailService from "./EmailService.js";
import { createNotification } from "./notificationService.js";

class AbsenteeCatchUpService {
  /**
   * Process a meeting to identify absentees and generate their catch-up digests.
   * @param {string} meetingId
   */
  static async processMeetingAbsentees(meetingId) {
    try {
      const meeting =
        await Meeting.findById(meetingId).populate("participants.user");
      if (!meeting) throw new Error("Meeting not found");
      if (meeting.status !== "completed") {
        console.log(
          `[AbsenteeCatchUpService] Meeting ${meetingId} is not completed. Skipping.`,
        );
        return;
      }

      // 1. Find RSVPs for this meeting
      const rsvps = await MeetingRsvp.find({ meetingId }).populate("userId");

      // 2. Determine actual participants
      const participantIds = meeting.participants
        .filter((p) => p.user)
        .map((p) => p.user._id.toString());

      // 3. Identify absentees: users who RSVP'd but didn't attend
      const absentees = rsvps
        .filter(
          (rsvp) =>
            rsvp.userId && !participantIds.includes(rsvp.userId._id.toString()),
        )
        .map((rsvp) => rsvp.userId);

      if (absentees.length === 0) {
        console.log(
          `[AbsenteeCatchUpService] No absentees found for meeting ${meetingId}.`,
        );
        return;
      }

      console.log(
        `[AbsenteeCatchUpService] Found ${absentees.length} absentees for meeting ${meetingId}. Generating digests...`,
      );

      const meetingSummary = {
        title: meeting.title,
        date: meeting.date,
        summary:
          meeting.summary ||
          (meeting.structuredMoM && meeting.structuredMoM.summary) ||
          "No general summary available.",
      };

      const decisions = meeting.structuredMoM?.decisions || [];
      const actionItems = meeting.structuredMoM?.action_items || [];

      // Generate a digest for each absentee
      for (const absentee of absentees) {
        const existing = await AbsenteeCatchUp.findOne({
          meetingId,
          userId: absentee._id,
        });
        if (existing) {
          console.log(
            `[AbsenteeCatchUpService] Catch-up already exists for user ${absentee._id} in meeting ${meetingId}. Skipping.`,
          );
          continue;
        }

        const absenteeName =
          `${absentee.firstName || absentee.name || "Participant"} ${absentee.lastName || ""}`.trim();
        const mentions = [];

        try {
          const aiResult = await generateAbsenteeCatchUpAI(
            meeting.title,
            absenteeName,
            meetingSummary,
            actionItems,
            decisions,
            mentions,
          );

          await AbsenteeCatchUp.create({
            meetingId,
            userId: absentee._id,
            content: aiResult,
            status: "delivered",
            sentAt: new Date(),
          });

          if (absentee.email) {
            await EmailService.sendAbsenteeCatchUpEmail({
              to: absentee.email,
              recipientName: absenteeName,
              meetingTitle: meeting.title,
              catchUpSummary:
                aiResult.overview ||
                aiResult.catchUpReport ||
                meetingSummary.summary,
              catchUpLink: `${process.env.CLIENT_URL || "http://localhost:5173"}/catch-up`,
            });
          }

          await createNotification(
            absentee._id,
            "Meeting Catch-Up Pack",
            `You missed "${meeting.title}". A personalized catch-up digest is ready for review.`,
            "meetings",
            "/catch-up",
            "View Catch-Up",
            { meetingId: meeting._id },
          );
        } catch (aiErr) {
          console.error(
            `[AbsenteeCatchUpService] Failed to generate AI digest for ${absenteeName}:`,
            aiErr,
          );
        }
      }
    } catch (error) {
      console.error(
        "[AbsenteeCatchUpService] Error processing absentees:",
        error,
      );
    }
  }

  /**
   * Organizer generate and deliver catch-up packs for absentees of a meeting.
   * @param {string} meetingId
   * @param {Array<string>} [absenteeIds]
   * @param {string} [organizerId]
   */
  static async generateAndDeliverForMeeting(
    meetingId,
    absenteeIds = [],
    organizerId = null,
  ) {
    const meeting =
      await Meeting.findById(meetingId).populate("participants.user");
    if (!meeting) {
      throw new Error("Meeting not found");
    }

    let targetUsers = [];

    if (Array.isArray(absenteeIds) && absenteeIds.length > 0) {
      targetUsers = await userModel.find({ _id: { $in: absenteeIds } });
    } else {
      // Find RSVPs or absent participants
      const rsvps = await MeetingRsvp.find({ meetingId }).populate("userId");
      const participantUserIds = (meeting.participants || [])
        .filter((p) => p.user)
        .map((p) => (p.user._id || p.user).toString());

      const rsvpAbsentees = rsvps
        .filter(
          (rsvp) =>
            rsvp.userId &&
            !participantUserIds.includes(rsvp.userId._id.toString()),
        )
        .map((rsvp) => rsvp.userId);

      if (rsvpAbsentees.length > 0) {
        targetUsers = rsvpAbsentees;
      } else {
        // Fallback: target meeting participants or invited users excluding organizer
        const orgIdStr = organizerId ? organizerId.toString() : null;
        const uploadedByStr = meeting.uploadedBy
          ? meeting.uploadedBy.toString()
          : null;

        const candidateUsers = (meeting.participants || [])
          .map((p) => p.user)
          .filter(Boolean)
          .filter((u) => {
            const uId = (u._id || u).toString();
            return uId !== orgIdStr && uId !== uploadedByStr;
          });

        if (candidateUsers.length > 0) {
          const userIds = candidateUsers.map((u) => u._id || u);
          targetUsers = await userModel.find({ _id: { $in: userIds } });
        }
      }
    }

    const meetingSummary = {
      title: meeting.title,
      date: meeting.date,
      summary:
        meeting.summary ||
        meeting.structuredMoM?.summary ||
        "No general summary available.",
    };

    const decisions = meeting.structuredMoM?.decisions || [];
    const actionItems = meeting.structuredMoM?.action_items || [];
    const deliveredPacks = [];

    for (const userObj of targetUsers) {
      const uId = userObj._id || userObj.id;
      const userName =
        `${userObj.firstName || userObj.name || "Participant"} ${userObj.lastName || ""}`.trim();

      const aiResult = await generateAbsenteeCatchUpAI(
        meeting.title,
        userName,
        meetingSummary,
        actionItems,
        decisions,
        [],
      );

      const catchUpRecord = await AbsenteeCatchUp.findOneAndUpdate(
        { meetingId, userId: uId },
        {
          meetingId,
          userId: uId,
          content: aiResult,
          status: "delivered",
          sentAt: new Date(),
        },
        { upsert: true, new: true },
      ).populate("meetingId", "title date summary");

      // Deliver via Email
      if (userObj.email) {
        await EmailService.sendAbsenteeCatchUpEmail({
          to: userObj.email,
          recipientName: userName,
          meetingTitle: meeting.title,
          catchUpSummary:
            aiResult.overview ||
            aiResult.catchUpReport ||
            meetingSummary.summary,
          catchUpLink: `${process.env.CLIENT_URL || "http://localhost:5173"}/catch-up`,
        });
      }

      // Deliver via In-App Notification
      await createNotification(
        uId,
        "Meeting Catch-Up Pack",
        `Your organizer generated a catch-up pack for "${meeting.title}".`,
        "meetings",
        "/catch-up",
        "View Catch-Up",
        { meetingId: meeting._id },
      );

      deliveredPacks.push(catchUpRecord);
    }

    return {
      success: true,
      deliveredCount: deliveredPacks.length,
      status: "DISPATCHED",
      catchUps: deliveredPacks,
    };
  }

  /**
   * Fetches pending & delivered catch-ups for a user.
   * @param {string} userId
   */
  static async getPendingCatchUps(userId) {
    return AbsenteeCatchUp.find({
      userId,
      status: { $in: ["pending", "delivered", "read"] },
    })
      .populate("meetingId", "title date summary")
      .sort({ createdAt: -1 });
  }

  /**
   * Marks a catch-up as read.
   * @param {string} catchUpId
   */
  static async markAsRead(catchUpId) {
    return AbsenteeCatchUp.findByIdAndUpdate(
      catchUpId,
      { status: "read", readAt: new Date() },
      { new: true },
    );
  }

  /**
   * Manually deliver a catch-up (e.g., via email or push).
   * @param {string} catchUpId
   */
  static async deliverCatchUp(catchUpId) {
    const catchUp = await AbsenteeCatchUp.findById(catchUpId)
      .populate("userId")
      .populate("meetingId", "title date summary");
    if (!catchUp) return null;

    const userObj = catchUp.userId;
    const meeting = catchUp.meetingId;

    if (userObj && userObj.email && meeting) {
      const recipientName =
        `${userObj.firstName || userObj.name || "Participant"} ${userObj.lastName || ""}`.trim();
      await EmailService.sendAbsenteeCatchUpEmail({
        to: userObj.email,
        recipientName,
        meetingTitle: meeting.title,
        catchUpSummary:
          catchUp.content?.overview ||
          catchUp.content?.catchUpReport ||
          meeting.summary,
        catchUpLink: `${process.env.CLIENT_URL || "http://localhost:5173"}/catch-up`,
      });
    }

    if (userObj) {
      await createNotification(
        userObj._id || userObj.id,
        "Meeting Catch-Up Pack",
        `Your catch-up pack for "${meeting?.title || "your meeting"}" is ready.`,
        "meetings",
        "/catch-up",
        "View Catch-Up",
        { meetingId: meeting?._id },
      );
    }

    return AbsenteeCatchUp.findByIdAndUpdate(
      catchUpId,
      { status: "delivered", sentAt: new Date() },
      { new: true },
    );
  }
}

export default AbsenteeCatchUpService;
