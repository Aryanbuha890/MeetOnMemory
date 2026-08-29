import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/keyMomentModel.js", () => {
  const MockKeyMoment = {
    create: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  };
  return { default: MockKeyMoment };
});

vi.mock("../models/meetingModel.js", () => {
  const MockMeeting = {
    findById: vi.fn(),
    findOne: vi.fn(),
  };
  return { default: MockMeeting };
});

vi.mock("../socket/keyMomentSocket.js", () => ({
  getKeyMomentsRoom: vi.fn((id) => `meeting:${id}:key-moments`),
}));

const {
  createKeyMoment,
  getKeyMomentsForMeeting,
  updateKeyMoment,
  deleteKeyMoment,
  exportKeyMoments,
} = await import("../controllers/keyMomentController.js");
const KeyMoment = (await import("../models/keyMomentModel.js")).default;
const Meeting = (await import("../models/meetingModel.js")).default;

describe("keyMomentController (#2465)", () => {
  let req, res;
  const mockUserId = "507f1f77bcf86cd799439011";
  const mockMeetingId = "507f1f77bcf86cd799439012";
  const mockMomentId = "507f1f77bcf86cd799439013";

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: {
        _id: mockUserId,
        name: "Test User",
        email: "test@example.com",
        role: "member",
        organization: "507f1f77bcf86cd799439099",
      },
      params: {},
      query: {},
      body: {},
      app: {
        get: vi.fn().mockReturnValue({
          to: vi.fn().mockReturnValue({
            emit: vi.fn(),
          }),
        }),
      },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };
  });

  describe("createKeyMoment", () => {
    it("creates and returns a new key moment for authorized meeting participant", async () => {
      req.body = {
        meetingId: mockMeetingId,
        snippet: "Adopt typescript across frontend",
        startTime: 30,
        endTime: 45,
        category: "decision",
        note: "Approved by lead",
      };

      Meeting.findById.mockResolvedValueOnce({
        _id: mockMeetingId,
        uploadedBy: mockUserId,
        participants: [{ user: mockUserId }],
        organization: "507f1f77bcf86cd799439099",
      });

      KeyMoment.create.mockResolvedValueOnce({
        _id: mockMomentId,
        meetingId: mockMeetingId,
        snippet: "Adopt typescript across frontend",
        startTime: 30,
        endTime: 45,
        category: "decision",
      });

      KeyMoment.findById.mockReturnValueOnce({
        populate: vi.fn().mockResolvedValueOnce({
          _id: mockMomentId,
          snippet: "Adopt typescript across frontend",
          startTime: 30,
          category: "decision",
          userId: { _id: mockUserId, name: "Test User" },
        }),
      });

      await createKeyMoment(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          keyMoment: expect.objectContaining({
            snippet: "Adopt typescript across frontend",
          }),
        }),
      );
    });

    it("rejects creation if end time is before start time", async () => {
      req.body = {
        meetingId: mockMeetingId,
        snippet: "Invalid timing",
        startTime: 100,
        endTime: 50,
      };

      Meeting.findById.mockResolvedValueOnce({
        _id: mockMeetingId,
        uploadedBy: mockUserId,
        participants: [],
        organization: "507f1f77bcf86cd799439099",
      });

      await createKeyMoment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "End time cannot be before start time",
        }),
      );
    });
  });

  describe("getKeyMomentsForMeeting", () => {
    it("returns all key moments sorted for authorized viewer", async () => {
      req.params = { meetingId: mockMeetingId };

      Meeting.findById.mockResolvedValueOnce({
        _id: mockMeetingId,
        uploadedBy: mockUserId,
        organization: "507f1f77bcf86cd799439099",
      });

      KeyMoment.find.mockReturnValueOnce({
        populate: vi.fn().mockReturnValueOnce({
          sort: vi
            .fn()
            .mockResolvedValueOnce([
              { _id: mockMomentId, startTime: 10, snippet: "Point 1" },
            ]),
        }),
      });

      await getKeyMomentsForMeeting(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          keyMoments: expect.any(Array),
        }),
      );
    });
  });

  describe("updateKeyMoment", () => {
    it("allows author to update snippet, title, category, timestamp, and note", async () => {
      req.params = { id: mockMomentId };
      req.body = {
        title: "Updated roadmap decision",
        category: "decision",
        timestamp: 40,
        note: "Updated context note",
      };

      const mockMoment = {
        _id: mockMomentId,
        meetingId: mockMeetingId,
        userId: mockUserId,
        snippet: "Old snippet",
        category: "insight",
        startTime: 10,
        endTime: 20,
        note: "Old note",
        save: vi.fn().mockResolvedValue(true),
      };

      KeyMoment.findById.mockResolvedValueOnce(mockMoment);
      Meeting.findById.mockResolvedValueOnce({
        _id: mockMeetingId,
        uploadedBy: mockUserId,
      });

      KeyMoment.findById.mockReturnValueOnce({
        populate: vi.fn().mockResolvedValueOnce({
          ...mockMoment,
          snippet: "Updated roadmap decision",
          startTime: 40,
          note: "Updated context note",
        }),
      });

      await updateKeyMoment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockMoment.snippet).toBe("Updated roadmap decision");
      expect(mockMoment.startTime).toBe(40);
      expect(mockMoment.save).toHaveBeenCalled();
    });

    it("forbids unauthorized users from updating key moments", async () => {
      req.params = { id: mockMomentId };
      req.body = { note: "Attempted edit" };

      KeyMoment.findById.mockResolvedValueOnce({
        _id: mockMomentId,
        meetingId: mockMeetingId,
        userId: "different_user_999",
        startTime: 10,
        endTime: 20,
      });

      Meeting.findById.mockResolvedValueOnce({
        _id: mockMeetingId,
        uploadedBy: "different_user_999",
      });

      await updateKeyMoment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Not authorized to update this key moment",
        }),
      );
    });
  });

  describe("deleteKeyMoment", () => {
    it("allows author or meeting owner to delete a key moment", async () => {
      req.params = { id: mockMomentId };

      const mockMoment = {
        _id: mockMomentId,
        meetingId: mockMeetingId,
        userId: mockUserId,
        deleteOne: vi.fn().mockResolvedValue(true),
      };

      KeyMoment.findById.mockResolvedValueOnce(mockMoment);
      Meeting.findById.mockResolvedValueOnce({
        _id: mockMeetingId,
        uploadedBy: mockUserId,
      });

      await deleteKeyMoment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockMoment.deleteOne).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Key moment deleted successfully",
        }),
      );
    });
  });

  describe("exportKeyMoments", () => {
    it("formats and sends key moments as CSV file download", async () => {
      req.query = { meetingId: mockMeetingId };

      Meeting.findById.mockResolvedValueOnce({
        _id: mockMeetingId,
        uploadedBy: mockUserId,
        organization: "507f1f77bcf86cd799439099",
      });

      KeyMoment.find.mockReturnValueOnce({
        populate: vi.fn().mockReturnValueOnce({
          sort: vi.fn().mockResolvedValueOnce([
            {
              startTime: 65,
              category: "decision",
              snippet: 'Launch "Feature A" on Monday',
              note: "Priority 1",
              userId: { name: "Alice", email: "alice@test.com" },
            },
            {
              startTime: 135,
              category: "action_item",
              snippet: "Write documentation",
              note: "",
              userId: { name: "Bob", email: "bob@test.com" },
            },
          ]),
        }),
      });

      await exportKeyMoments(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        `attachment; filename="session-${mockMeetingId}-moments.csv"`,
      );
      expect(res.status).toHaveBeenCalledWith(200);

      const sentCsv = res.send.mock.calls[0][0];
      expect(sentCsv).toContain(
        "Timestamp,Category,Key Moment Title,Note,Author",
      );
      expect(sentCsv).toContain(
        '"1:05","decision","Launch ""Feature A"" on Monday","Priority 1","Alice"',
      );
      expect(sentCsv).toContain(
        '"2:15","action_item","Write documentation","","Bob"',
      );
    });

    it("supports sessionId query parameter as fallback", async () => {
      req.query = { sessionId: mockMeetingId };

      Meeting.findById.mockResolvedValueOnce({
        _id: mockMeetingId,
        uploadedBy: mockUserId,
        organization: "507f1f77bcf86cd799439099",
      });

      KeyMoment.find.mockReturnValueOnce({
        populate: vi.fn().mockReturnValueOnce({
          sort: vi.fn().mockResolvedValueOnce([]),
        }),
      });

      await exportKeyMoments(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
    });

    it("returns 400 when meeting ID is missing or invalid", async () => {
      req.query = { meetingId: "invalid_id" };

      await exportKeyMoments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Valid meeting ID is required",
        }),
      );
    });
  });
});
