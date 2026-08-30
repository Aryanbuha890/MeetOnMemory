import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateROIFactors,
  getROIRecords,
  getROIRecordById,
  getROIRecordByMeeting,
  createROIRecord,
  updateROIRecord,
  deleteROIRecord,
  getROIDashboardSummary,
  simulateWhatIf,
} from "../controllers/meetingROIController.js";
import MeetingROI from "../models/meetingROIModel.js";

vi.mock("../models/meetingROIModel.js", () => {
  const MockModel = vi.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    this.save = vi.fn().mockResolvedValue(this);
  });
  MockModel.find = vi.fn();
  MockModel.findById = vi.fn();
  MockModel.findOne = vi.fn();
  MockModel.findByIdAndDelete = vi.fn();
  MockModel.countDocuments = vi.fn();
  return {
    default: MockModel,
  };
});

describe("Meeting ROI Controller (#2383)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateROIFactors", () => {
    it("correctly computes labor cost, direct cost, net value and positive ROI %", () => {
      const factors = calculateROIFactors({
        durationMinutes: 60,
        attendeeCount: 4,
        avgHourlyRate: 50,
        directCosts: {
          venue: 100,
          softwareLicenses: 50,
        },
        decisionValue: 1000,
      });

      // labor = (60/60) * 4 * 50 = 200
      expect(factors.laborCost).toBe(200);
      // direct = 100 + 50 = 150
      expect(factors.totalDirectCost).toBe(150);
      // total = 350
      expect(factors.totalMeetingCost).toBe(350);
      // decision = 1000
      expect(factors.decisionValue).toBe(1000);
      // net = 1000 - 350 = 650
      expect(factors.netValue).toBe(650);
      // ROI = ((1000 - 350) / 350) * 100 = 185.7%
      expect(factors.roiPercentage).toBe(185.7);
    });

    it("handles zero total cost with positive decision value", () => {
      const factors = calculateROIFactors({
        durationMinutes: 0,
        attendeeCount: 0,
        avgHourlyRate: 0,
        directCosts: {},
        decisionValue: 500,
      });
      expect(factors.totalMeetingCost).toBe(0);
      expect(factors.roiPercentage).toBe(100);
    });
  });

  describe("getROIRecords", () => {
    it("returns paginated ROI records for organization", async () => {
      const mockQueryChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi
          .fn()
          .mockResolvedValue([
            { _id: "roi-1", title: "Q3 Strategy Planning", roiPercentage: 150 },
          ]),
      };
      MeetingROI.find.mockReturnValue(mockQueryChain);
      MeetingROI.countDocuments.mockResolvedValue(1);

      const req = {
        user: { organization: "org-123" },
        query: {
          search: "Strategy",
          meetingType: "strategy",
          page: 1,
          limit: 10,
        },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await getROIRecords(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            records: expect.any(Array),
            pagination: expect.objectContaining({ total: 1, page: 1 }),
          }),
        }),
      );
    });

    it("returns 400 when organization ID is missing", async () => {
      const req = { user: {}, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getROIRecords(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("createROIRecord", () => {
    it("creates an ROI record successfully", async () => {
      const req = {
        user: { id: "user-1", organization: "org-123" },
        body: {
          title: "Architecture Review",
          meetingType: "review",
          durationMinutes: 45,
          attendeeCount: 5,
          avgHourlyRate: 80,
          decisionValue: 2000,
        },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await createROIRecord(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Meeting ROI record created successfully",
        }),
      );
    });

    it("returns 400 when title is missing", async () => {
      const req = {
        user: { organization: "org-123" },
        body: { title: "" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await createROIRecord(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getROIRecordById", () => {
    it("returns record if found and authorized", async () => {
      const mockQueryChain = {
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue({
          _id: "roi-1",
          organization: "org-123",
          title: "Roadmap Sync",
        }),
      };
      MeetingROI.findById.mockReturnValue(mockQueryChain);

      const req = {
        params: { id: "roi-1" },
        user: { organization: "org-123" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getROIRecordById(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it("returns 404 if record not found", async () => {
      const mockQueryChain = {
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(null),
      };
      MeetingROI.findById.mockReturnValue(mockQueryChain);

      const req = {
        params: { id: "non-existent" },
        user: { organization: "org-123" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getROIRecordById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("getROIRecordByMeeting", () => {
    it("returns ROI record linked to a meeting", async () => {
      const mockQueryChain = {
        lean: vi.fn().mockResolvedValue({
          _id: "roi-1",
          meeting: "meeting-123",
          title: "Sprint Review",
        }),
      };
      MeetingROI.findOne.mockReturnValue(mockQueryChain);

      const req = { params: { meetingId: "meeting-123" } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getROIRecordByMeeting(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ meeting: "meeting-123" }),
        }),
      );
    });
  });

  describe("updateROIRecord", () => {
    it("updates record fields and recalculates factors", async () => {
      const mockDoc = {
        _id: "roi-1",
        organization: "org-123",
        title: "Old Title",
        durationMinutes: 60,
        attendeeCount: 4,
        avgHourlyRate: 50,
        directCosts: {},
        decisionValue: 500,
        qualityMetrics: { toObject: () => ({ efficiencyRating: 4 }) },
        save: vi.fn().mockResolvedValue(true),
      };
      MeetingROI.findById.mockResolvedValue(mockDoc);

      const req = {
        params: { id: "roi-1" },
        user: { organization: "org-123" },
        body: {
          title: "New Title",
          decisionValue: 1200,
        },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await updateROIRecord(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockDoc.title).toBe("New Title");
      expect(mockDoc.decisionValue).toBe(1200);
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe("deleteROIRecord", () => {
    it("deletes record successfully", async () => {
      MeetingROI.findById.mockResolvedValue({
        _id: "roi-1",
        organization: "org-123",
      });
      MeetingROI.findByIdAndDelete.mockResolvedValue(true);

      const req = {
        params: { id: "roi-1" },
        user: { organization: "org-123" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await deleteROIRecord(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(MeetingROI.findByIdAndDelete).toHaveBeenCalledWith("roi-1");
    });
  });

  describe("getROIDashboardSummary", () => {
    it("computes comprehensive summary aggregations, trends, benchmarks, and recommendations", async () => {
      const mockRecords = [
        {
          _id: "r1",
          meetingType: "strategy",
          date: new Date("2026-03-01"),
          totalMeetingCost: 300,
          laborCost: 200,
          totalDirectCost: 100,
          decisionValue: 1500,
          netValue: 1200,
          roiPercentage: 400,
          directCosts: { venue: 100 },
          qualityMetrics: {
            efficiencyRating: 5,
            goalAchievementRate: 90,
            attendeeEngagementScore: 85,
            decisionSpeedMinutes: 15,
            actionItemsCount: 4,
            actionItemsCompletedCount: 4,
          },
        },
        {
          _id: "r2",
          meetingType: "standup",
          date: new Date("2026-03-05"),
          totalMeetingCost: 150,
          laborCost: 150,
          totalDirectCost: 0,
          decisionValue: 100,
          netValue: -50,
          roiPercentage: -33.3,
          directCosts: {},
          qualityMetrics: {
            efficiencyRating: 3,
            goalAchievementRate: 70,
            attendeeEngagementScore: 75,
            decisionSpeedMinutes: 25,
            actionItemsCount: 2,
            actionItemsCompletedCount: 1,
          },
        },
      ];

      const mockQueryChain = {
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockRecords),
      };
      MeetingROI.find.mockReturnValue(mockQueryChain);

      const req = {
        user: { organization: "org-123" },
        query: { timeframe: "all" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getROIDashboardSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            summary: expect.objectContaining({
              totalMeetings: 2,
              totalCost: 450,
              totalDecisionValue: 1600,
              netValue: 1150,
              positiveROICount: 1,
            }),
            roiByType: expect.any(Array),
            monthlyTrends: expect.any(Array),
            costBreakdown: expect.any(Object),
            qualityMetrics: expect.any(Object),
            topPerformers: expect.any(Array),
            lowestPerformers: expect.any(Array),
            benchmarks: expect.any(Object),
            recommendations: expect.any(Array),
          }),
        }),
      );
    });

    it("returns empty baseline when no records exist", async () => {
      const mockQueryChain = {
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      };
      MeetingROI.find.mockReturnValue(mockQueryChain);

      const req = { user: { organization: "org-123" }, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getROIDashboardSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            summary: expect.objectContaining({ totalMeetings: 0 }),
          }),
        }),
      );
    });
  });

  describe("simulateWhatIf", () => {
    it("simulates scenario and returns single and monthly projections with savings", async () => {
      const req = {
        body: {
          attendeeCount: 3,
          durationMinutes: 45,
          avgHourlyRate: 60,
          directCost: 20,
          estimatedDecisionValue: 800,
          frequencyPerMonth: 4,
        },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await simulateWhatIf(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            singleMeeting: expect.objectContaining({
              laborCost: 135,
              totalCost: 155,
              decisionValue: 800,
            }),
            monthlyProjection: expect.objectContaining({
              projectedCost: 620,
              projectedDecisionValue: 3200,
              frequencyPerMonth: 4,
            }),
          }),
        }),
      );
    });
  });
});
