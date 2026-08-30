import Meeting from "../models/meetingModel.js";
import MeetingTemplate from "../models/meetingTemplateModel.js";
import AuditService from "./AuditService.js";
import { NotFoundError } from "../utils/errors.js";

/**
 * Clones an existing meeting into a new draft.
 * Strips ephemeral data like transcripts, recordings, and analytics.
 */
export const cloneMeeting = async (meetingId, userId, options) => {
  const {
    includeAgenda = true,
    includeParticipants = true,
    includeCustomFields = true,
    newDate = new Date(),
  } = options;

  const originalMeeting = await Meeting.findById(meetingId).lean();
  if (!originalMeeting) {
    throw new NotFoundError("Meeting not found to clone.");
  }

  const cloneData = {
    title: `${originalMeeting.title} (Clone)`,
    description: originalMeeting.description,
    meetingType: originalMeeting.meetingType,
    organization: originalMeeting.organization,
    uploadedBy: userId, // The user cloning the meeting
    clonedFrom: meetingId,
    date: newDate,
    time: originalMeeting.time || "",
    duration: originalMeeting.duration,
    location: originalMeeting.location,
    venue: originalMeeting.venue,
    venueCoordinates: originalMeeting.venueCoordinates,
    policyDetails: originalMeeting.policyDetails,
    allowObservers: originalMeeting.allowObservers,
    requireQuiz: originalMeeting.requireQuiz,
    maxParticipants: originalMeeting.maxParticipants,
    reminderEnabled: originalMeeting.reminderEnabled,
    reminderMinutesBefore: originalMeeting.reminderMinutesBefore,
    nudgesEnabled: originalMeeting.nudgesEnabled,

    // Default resets
    recordingType: "upload",
    fileUrl: "",
    transcript: "",
    encryptedTranscript: null,
    isTranscriptEncrypted: false,
    transcriptEncryptionVersion: null,
  };

  if (includeAgenda && originalMeeting.agendaItems) {
    cloneData.agendaItems = originalMeeting.agendaItems.map((item) => ({
      text: item.text,
      description: item.description,
      duration: item.duration,
      position: item.position,
      status: "pending",
      startedAt: null,
      completedAt: null,
      actualDuration: 0,
    }));
  } else {
    cloneData.agendaItems = [];
  }

  if (includeParticipants && originalMeeting.participants) {
    cloneData.participants = originalMeeting.participants.map((p) => ({
      user: p.user,
      name: p.name,
      email: p.email,
      role: p.role,
      rsvpStatus: "pending", // Reset RSVP status
      rsvpReason: "",
    }));
  } else {
    cloneData.participants = [];
  }

  if (includeCustomFields && originalMeeting.customFields) {
    cloneData.customFields = originalMeeting.customFields;
  } else {
    cloneData.customFields = [];
  }

  const newMeeting = new Meeting(cloneData);
  await newMeeting.save();

  await AuditService.logEvent("MEETING_CLONED", userId, newMeeting._id, {
    organizationId: newMeeting.organization,
    details: `Meeting cloned from ${meetingId}`,
    metadata: {
      clonedFrom: meetingId,
      options,
    },
  });

  return newMeeting;
};

/**
 * Instantiates a new meeting draft from a MeetingTemplate.
 */
export const instantiateFromTemplate = async (
  templateId,
  userId,
  options = {},
) => {
  const { newDate = new Date() } = options;
  const template = await MeetingTemplate.findById(templateId).lean();
  if (!template) {
    throw new NotFoundError("Meeting template not found.");
  }

  const draftData = {
    title: template.title || template.name,
    description: template.description,
    organization: template.organizationId,
    uploadedBy: userId,
    date: newDate,
    duration: template.defaultDuration,
    recordingType: "upload",
    agendaItems: [],
    participants: [],
  };

  if (template.agendaBlocks) {
    draftData.agendaItems = template.agendaBlocks.map((block, idx) => ({
      text: block.title,
      description: block.description,
      duration: block.duration,
      position: idx,
      status: "pending",
      actualDuration: 0,
    }));
  }

  if (template.defaultParticipants) {
    draftData.participants = template.defaultParticipants.map((email) => ({
      name: email.split("@")[0], // Basic name extraction or lookup could be better
      email: email,
      rsvpStatus: "pending",
    }));
  }

  const newMeeting = new Meeting(draftData);
  await newMeeting.save();

  await AuditService.logEvent("MEETING_INSTANTIATED", userId, newMeeting._id, {
    organizationId: newMeeting.organization,
    details: `Meeting instantiated from template ${templateId}`,
    metadata: {
      templateId,
    },
  });

  return newMeeting;
};
