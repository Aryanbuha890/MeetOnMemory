import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/breakoutRoomModel.js", () => {
  function MockBreakoutRoom(data) {
    Object.assign(this, data);
    this._id = "room-123";
    this.save = vi.fn().mockResolvedValue(this);
  }
  MockBreakoutRoom.findById = vi.fn();
  MockBreakoutRoom.find = vi.fn();
  MockBreakoutRoom.findByIdAndUpdate = vi.fn();
  MockBreakoutRoom.updateMany = vi.fn();
  return { default: MockBreakoutRoom };
});

vi.mock("../models/meetingModel.js", () => {
  const mockMeeting = {
    findById: vi.fn(),
  };
  return { default: mockMeeting };
});

vi.mock("../services/GenerativeAIService.js", () => ({
  generateText: vi.fn().mockResolvedValue("Generated breakout summary."),
}));

const {
  randomAssignParticipants,
  broadcastToAllRooms,
  closeAllBreakoutRooms,
  createRoom,
  startRoom,
  closeRoom,
} = await import("../controllers/breakoutRoomController.js");

const BreakoutRoom = (await import("../models/breakoutRoomModel.js")).default;
const Meeting = (await import("../models/meetingModel.js")).default;

describe("breakoutRoomController (#2453)", () => {
  let req, res, next, mockSocketIo;
  const mockMeetingId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
    req = {
      params: {},
      body: {},
      query: {},
      app: {
        get: vi.fn((key) => {
          if (key === "socketio" || key === "io") return mockSocketIo;
          return null;
        }),
      },
      user: {
        _id: "user-host-1",
        name: "Host User",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("randomAssignParticipants", () => {
    it("shuffles and distributes participants round-robin across provisioned rooms", async () => {
      req.params = { meetingId: mockMeetingId };
      req.body = {
        roomIds: ["room-1", "room-2"],
        participantIds: ["user-1", "user-2", "user-3", "user-4"],
      };

      BreakoutRoom.findByIdAndUpdate.mockImplementation((id, data) =>
        Promise.resolve({ _id: id, ...data }),
      );

      await randomAssignParticipants(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          allocations: expect.arrayContaining([
            expect.objectContaining({
              roomId: "room-1",
              members: expect.any(Array),
            }),
            expect.objectContaining({
              roomId: "room-2",
              members: expect.any(Array),
            }),
          ]),
        }),
      );
      expect(BreakoutRoom.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(mockSocketIo.to).toHaveBeenCalledWith(`meeting:${mockMeetingId}`);
      expect(mockSocketIo.emit).toHaveBeenCalledWith(
        "breakout_shuffled",
        expect.objectContaining({ allocations: expect.any(Array) }),
      );
    });

    it("falls back to Meeting participants if participantIds is not supplied in body", async () => {
      req.params = { meetingId: mockMeetingId };
      req.body = {
        roomIds: ["room-1"],
      };

      Meeting.findById.mockResolvedValue({
        _id: mockMeetingId,
        participants: [{ user: "user-alpha" }, { user: "user-beta" }],
      });

      BreakoutRoom.findByIdAndUpdate.mockResolvedValue({ _id: "room-1" });

      await randomAssignParticipants(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(BreakoutRoom.findByIdAndUpdate).toHaveBeenCalledWith(
        "room-1",
        expect.objectContaining({
          participants: expect.arrayContaining(["user-alpha", "user-beta"]),
        }),
        expect.any(Object),
      );
    });
  });

  describe("broadcastToAllRooms", () => {
    it("dispatches broadcast message payload across meeting namespaces", async () => {
      req.params = { meetingId: mockMeetingId };
      req.body = {
        message: "5 minutes remaining before recall!",
      };

      await broadcastToAllRooms(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Broadcast dispatched to all rooms.",
      });
      expect(mockSocketIo.to).toHaveBeenCalledWith(`meeting:${mockMeetingId}`);
      expect(mockSocketIo.emit).toHaveBeenCalledWith(
        "breakout_broadcast_received",
        expect.objectContaining({
          sender: "Host User",
          message: "5 minutes remaining before recall!",
        }),
      );
    });
  });

  describe("closeAllBreakoutRooms", () => {
    it("updates all breakout rooms to closed and emits close-all socket events", async () => {
      req.params = { meetingId: mockMeetingId };

      BreakoutRoom.updateMany.mockResolvedValue({ modifiedCount: 3 });

      await closeAllBreakoutRooms(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "All breakout rooms closed and participants recalled.",
      });
      expect(BreakoutRoom.updateMany).toHaveBeenCalledWith(
        { meetingId: mockMeetingId },
        expect.objectContaining({ status: "closed", participants: [] }),
      );
      expect(mockSocketIo.to).toHaveBeenCalledWith(`meeting:${mockMeetingId}`);
      expect(mockSocketIo.emit).toHaveBeenCalledWith("breakout_closed_all");
    });
  });

  describe("createRoom, startRoom, and closeRoom", () => {
    it("creates a new breakout room", async () => {
      req.params = { meetingId: mockMeetingId };
      req.body = { name: "Design Workshop" };

      Meeting.findById.mockResolvedValue({ _id: mockMeetingId });

      await createRoom(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: "Design Workshop",
            status: "pending",
          }),
        }),
      );
    });

    it("starts a breakout room", async () => {
      req.params = { roomId: "room-123" };

      const mockRoom = {
        _id: "room-123",
        status: "pending",
        save: vi.fn().mockResolvedValue({ _id: "room-123", status: "active" }),
      };
      BreakoutRoom.findById.mockResolvedValue(mockRoom);

      await startRoom(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRoom.status).toBe("active");
    });

    it("closes a breakout room and triggers description update", async () => {
      req.params = { roomId: "room-123" };

      const mockRoom = {
        _id: "room-123",
        meetingId: mockMeetingId,
        name: "Sync A",
        status: "active",
        transcript: [{ speakerName: "Alice", text: "Good points made." }],
        save: vi.fn().mockResolvedValue(true),
      };
      BreakoutRoom.findById.mockResolvedValue(mockRoom);

      const mockMeeting = {
        _id: mockMeetingId,
        description: "",
        save: vi.fn().mockResolvedValue(true),
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      await closeRoom(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRoom.status).toBe("closed");
      expect(mockMeeting.save).toHaveBeenCalled();
    });
  });
});
