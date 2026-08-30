import mongoose from "mongoose";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Meeting from "../models/meetingModel.js";
import MeetingSeries from "../models/meetingSeriesModel.js";
import { createMeeting } from "../services/MeetingService.js";
import { createSeries } from "../controllers/meetingSeriesController.js";

// Mock MeetingStorageService
vi.mock("../services/MeetingStorageService.js", () => ({
  createMeetingRecord: vi.fn((data) => ({
    _id: "m_mock",
    ...data,
  })),
}));

vi.mock("../services/MeetingService.js", () => {
  const actual = vi.importActual("../services/MeetingService.js");
  return {
    ...actual,
    createMeeting: async (uploaderId, orgId, data) => {
      const { createMeetingRecord } =
        await import("../services/MeetingStorageService.js");
      return await createMeetingRecord({
        uploadedBy: uploaderId,
        organization: orgId || null,
        title: data.title.trim(),
        auditNote: data.auditNote || "",
        date: new Date(),
        time: data.time || "",
        participants: data.participants || [],
        agendaItems: [],
        status: "uploaded",
      });
    },
  };
});

describe("Meeting Focus Time Audit Notes (#2067)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores auditNote in created meeting record", async () => {
    const uploaderId = new mongoose.Types.ObjectId().toString();
    const meetingData = {
      title: "Focus Overriding Sync",
      auditNote: "Override due to tight release schedule",
      time: "10:00",
      participants: [],
    };

    const res = await createMeeting(uploaderId, null, meetingData);
    expect(res.auditNote).toBe("Override due to tight release schedule");
  });

  it("saves auditNote in meeting series and generated occurrences", async () => {
    const req = {
      user: {
        _id: new mongoose.Types.ObjectId().toString(),
        organization: new mongoose.Types.ObjectId().toString(),
      },
      body: {
        title: "Daily Standup Series",
        recurrencePattern: "daily",
        startDate: "2026-08-23T00:00:00.000Z",
        endDate: "2026-08-25T00:00:00.000Z",
        time: "09:30",
        duration: 30,
        auditNote: "Series scheduled over daily focal zones",
      },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // Mock models
    vi.spyOn(MeetingSeries.prototype, "save").mockResolvedValue({});
    vi.spyOn(Meeting, "insertMany").mockResolvedValue([
      { title: "Occur 1", auditNote: req.body.auditNote },
    ]);

    await createSeries(req, res);

    expect(Meeting.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          auditNote: "Series scheduled over daily focal zones",
        }),
      ]),
    );
  });
});
