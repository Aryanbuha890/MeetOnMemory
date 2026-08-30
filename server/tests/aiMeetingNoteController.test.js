import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getNoteTemplates,
  getNotes,
  getNoteById,
  generateAiNote,
  createNote,
  updateNote,
  deleteNote,
  reviewNote,
  toggleActionItemStatus,
  getCrossMeetingActionItems,
  restoreNoteVersion,
  getNotesAnalytics,
  synthesizeAiNoteContent,
} from "../controllers/aiMeetingNoteController.js";
import AiMeetingNote from "../models/aiMeetingNoteModel.js";

vi.mock("../models/aiMeetingNoteModel.js", () => {
  const MockAiMeetingNote = vi.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    this.save = vi.fn().mockResolvedValue(this);
  });
  MockAiMeetingNote.find = vi.fn();
  MockAiMeetingNote.findById = vi.fn();
  MockAiMeetingNote.findByIdAndDelete = vi.fn();
  MockAiMeetingNote.countDocuments = vi.fn();
  return { default: MockAiMeetingNote };
});

describe("aiMeetingNoteController (#2381)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("synthesizeAiNoteContent helper", () => {
    it("synthesizes structured content, decisions, and action items from raw text", () => {
      const raw =
        "The team decided to launch the product in Q3.\nAction: John will finalize API contracts by Friday.\nWe concluded on microservices.";
      const res = synthesizeAiNoteContent(raw, "product", "Q3 Roadmap");

      expect(res.summary).toContain("Q3 Roadmap");
      expect(res.decisions.length).toBeGreaterThan(0);
      expect(res.actionItems.length).toBeGreaterThan(0);
      expect(res.qualityScore.overallScore).toBeGreaterThan(0);
      expect(res.content).toContain("## Summary");
    });
  });

  describe("getNoteTemplates", () => {
    it("returns the built-in note templates", async () => {
      const req = {};
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getNoteTemplates(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ id: "executive" }),
            expect.objectContaining({ id: "product" }),
          ]),
        }),
      );
    });
  });

  describe("getNotes", () => {
    it("returns paginated notes with search and filters", async () => {
      const mockNotes = [
        {
          _id: "note-1",
          title: "Executive Q2 Sync",
          meetingType: "executive",
          date: new Date(),
        },
      ];

      const mockQueryChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockNotes),
      };

      AiMeetingNote.find.mockReturnValue(mockQueryChain);
      AiMeetingNote.countDocuments.mockResolvedValue(1);

      const req = {
        user: { organization: "org-123" },
        query: {
          search: "Executive",
          meetingType: "executive",
          page: 1,
          limit: 10,
        },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getNotes(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            notes: mockNotes,
            pagination: expect.objectContaining({ total: 1 }),
          }),
        }),
      );
    });
  });

  describe("getNoteById", () => {
    it("returns note by id if found and permitted", async () => {
      const mockNote = {
        _id: "note-1",
        organization: "org-123",
        title: "Product Sync",
      };

      const mockQueryChain = {
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockNote),
      };

      AiMeetingNote.findById.mockReturnValue(mockQueryChain);

      const req = {
        params: { id: "note-1" },
        user: { organization: "org-123" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getNoteById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockNote }),
      );
    });

    it("returns 404 when note is not found", async () => {
      const mockQueryChain = {
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(null),
      };
      AiMeetingNote.findById.mockReturnValue(mockQueryChain);

      const req = {
        params: { id: "not-found" },
        user: { organization: "org-123" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getNoteById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("generateAiNote", () => {
    it("generates a new AI note with synthesized sections and saves", async () => {
      const req = {
        user: { id: "user-123", organization: "org-123" },
        body: {
          title: "Sprint Planning",
          rawContent: "Decided to ship v2. Action: Dave will write tests.",
          templateUsed: "product",
          meetingType: "product",
        },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await generateAiNote(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "AI Meeting Note generated successfully",
          data: expect.objectContaining({
            title: "Sprint Planning",
            version: 1,
          }),
        }),
      );
    });
  });

  describe("createNote", () => {
    it("creates a manual note and returns 201", async () => {
      const req = {
        user: { id: "user-123", organization: "org-123" },
        body: {
          title: "Manual 1-on-1 Note",
          meetingType: "1-on-1",
          content: "## Notes",
          summary: "Check-in summary",
        },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await createNote(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ title: "Manual 1-on-1 Note" }),
        }),
      );
    });
  });

  describe("updateNote", () => {
    it("updates note and appends current state to version history", async () => {
      const mockDoc = {
        _id: "note-1",
        organization: "org-123",
        title: "Old Title",
        content: "Old Content",
        summary: "Old Summary",
        version: 1,
        versionHistory: [],
        save: vi.fn().mockResolvedValue(true),
      };
      AiMeetingNote.findById.mockResolvedValue(mockDoc);

      const req = {
        params: { id: "note-1" },
        user: { id: "user-123", organization: "org-123" },
        body: {
          title: "New Title",
          content: "Updated Content",
        },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await updateNote(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockDoc.version).toBe(2);
      expect(mockDoc.versionHistory.length).toBe(1);
    });
  });

  describe("deleteNote", () => {
    it("deletes note successfully", async () => {
      const mockDoc = { _id: "note-1", organization: "org-123" };
      AiMeetingNote.findById.mockResolvedValue(mockDoc);
      AiMeetingNote.findByIdAndDelete.mockResolvedValue(mockDoc);

      const req = {
        params: { id: "note-1" },
        user: { organization: "org-123" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await deleteNote(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("reviewNote", () => {
    it("updates note review status and reviewer feedback", async () => {
      const mockDoc = {
        _id: "note-1",
        reviewStatus: "draft",
        save: vi.fn().mockResolvedValue(true),
      };
      AiMeetingNote.findById.mockResolvedValue(mockDoc);

      const req = {
        params: { id: "note-1" },
        user: { id: "user-approver", organization: "org-123" },
        body: { reviewStatus: "approved", reviewFeedback: "Looks great!" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await reviewNote(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockDoc.reviewStatus).toBe("approved");
      expect(mockDoc.reviewFeedback).toBe("Looks great!");
    });
  });

  describe("toggleActionItemStatus", () => {
    it("toggles action item completion status", async () => {
      const mockDoc = {
        _id: "note-1",
        actionItems: [
          {
            id: "act-1",
            task: "Write docs",
            status: "pending",
            completedAt: null,
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };
      AiMeetingNote.findById.mockResolvedValue(mockDoc);

      const req = {
        params: { id: "note-1", actionId: "act-1" },
        body: { status: "completed" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await toggleActionItemStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockDoc.actionItems[0].status).toBe("completed");
      expect(mockDoc.actionItems[0].completedAt).not.toBeNull();
    });
  });

  describe("getCrossMeetingActionItems", () => {
    it("aggregates action items across all notes for organization", async () => {
      const mockNotes = [
        {
          _id: "note-1",
          title: "Sprint Retrospective",
          meetingType: "retrospective",
          date: new Date(),
          actionItems: [
            {
              id: "act-1",
              task: "Refactor backend",
              owner: "Dev",
              priority: "high",
              status: "pending",
            },
            {
              id: "act-2",
              task: "Update documentation",
              owner: "Tech Writer",
              priority: "low",
              status: "completed",
            },
          ],
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockNotes),
      };
      AiMeetingNote.find.mockReturnValue(mockQueryChain);

      const req = {
        user: { organization: "org-123" },
        query: { status: "all" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getCrossMeetingActionItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total: 2,
            completedCount: 1,
            pendingCount: 1,
          }),
        }),
      );
    });
  });

  describe("restoreNoteVersion", () => {
    it("restores note content from historical version", async () => {
      const mockDoc = {
        _id: "note-1",
        version: 2,
        content: "Version 2 Content",
        summary: "Version 2 Summary",
        versionHistory: [
          {
            version: 1,
            content: "Version 1 Content",
            summary: "Version 1 Summary",
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };
      AiMeetingNote.findById.mockResolvedValue(mockDoc);

      const req = {
        params: { id: "note-1", version: "1" },
        user: { id: "user-123" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await restoreNoteVersion(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockDoc.content).toBe("Version 1 Content");
      expect(mockDoc.version).toBe(3);
    });
  });

  describe("getNotesAnalytics", () => {
    it("computes analytics KPIs, monthly trends, and tag distribution", async () => {
      const mockNotes = [
        {
          date: new Date("2026-03-01"),
          tags: ["Engineering", "Sprint"],
          meetingType: "engineering",
          qualityScore: {
            overallScore: 92,
            clarity: 90,
            completeness: 95,
            actionability: 90,
            decisionClarity: 93,
          },
          reviewStatus: "approved",
          actionItems: [{ status: "completed" }, { status: "pending" }],
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockNotes),
      };
      AiMeetingNote.find.mockReturnValue(mockQueryChain);

      const req = { user: { organization: "org-123" }, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getNotesAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalNotes: 1,
            averageQualityScore: 92,
            totalActionItems: 2,
            completedActionItems: 1,
            actionCompletionRate: 50,
          }),
        }),
      );
    });
  });
});
