import Meeting from "../models/meetingModel.js";
import AuditService from "./AuditService.js";
import { NotFoundError } from "../utils/errors.js";

/**
 * Calculates recommended durations based on previous completions of similar agenda items
 */
export const analyzeAgendaItemPacing = async (organizationId, itemText) => {
  if (!itemText) return null;

  // Search for past meetings in the same organization
  const pastMeetings = await Meeting.find({
    organization: organizationId,
    "agendaItems.text": itemText,
    deletedAt: null,
  });

  let totalActual = 0;
  let totalPlanned = 0;
  let count = 0;

  for (const meeting of pastMeetings) {
    const matchingItem = meeting.agendaItems.find(
      (item) => item.text.toLowerCase() === itemText.toLowerCase(),
    );
    if (
      matchingItem &&
      matchingItem.status === "completed" &&
      matchingItem.actualDuration > 0
    ) {
      // actualDuration is in ms, duration is in minutes
      totalActual += matchingItem.actualDuration / 60000;
      totalPlanned += matchingItem.duration || 0;
      count++;
    }
  }

  if (count === 0) return null;

  const avgActual = totalActual / count;
  const avgPlanned = totalPlanned / count;

  return {
    itemText,
    count,
    avgPlanned: Math.round(avgPlanned),
    avgActual: Math.round(avgActual),
    recommendation: Math.round(avgActual), // recommended duration in minutes
  };
};

export const rolloverAgenda = async (
  sourceMeetingId,
  targetMeetingId,
  userId,
) => {
  const sourceMeeting = await Meeting.findById(sourceMeetingId);
  if (!sourceMeeting) throw new NotFoundError("Source meeting not found");

  const targetMeeting = await Meeting.findById(targetMeetingId);
  if (!targetMeeting) throw new NotFoundError("Target meeting not found");

  // Filter unfinished items: status !== "completed"
  const unfinishedItems = sourceMeeting.agendaItems.filter(
    (item) => item.status !== "completed",
  );

  const rolledOverItems = [];
  const analyticsRecommendations = [];

  for (const item of unfinishedItems) {
    const pacing = await analyzeAgendaItemPacing(
      targetMeeting.organization,
      item.text,
    );

    const recommendedDuration = pacing ? pacing.recommendation : item.duration;

    rolledOverItems.push({
      text: item.text,
      description: item.description || "",
      duration: recommendedDuration,
      position: rolledOverItems.length,
      status: "pending",
      rolledOver: true,
      sourceAgendaItemId: item._id,
    });

    if (pacing) {
      analyticsRecommendations.push(pacing);
    }
  }

  // Update target meeting's agenda
  targetMeeting.agendaItems = rolledOverItems;
  await targetMeeting.save();

  // Log in Audit Service
  await AuditService.logAction({
    actorId: userId,
    action: "AGENDA_ROLLOVER",
    entity: "Meeting",
    entityId: targetMeetingId,
    organizationId: targetMeeting.organization || sourceMeeting.organization,
    details: {
      sourceMeetingId,
      rolledOverCount: rolledOverItems.length,
      items: rolledOverItems.map((i) => ({
        text: i.text,
        originalDuration: i.duration,
      })),
    },
  });

  return {
    success: true,
    agendaItems: targetMeeting.agendaItems,
    analytics: analyticsRecommendations,
  };
};
