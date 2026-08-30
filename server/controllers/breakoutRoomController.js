import { z } from "zod";
import { breakoutRoomService } from "../services/breakoutRoomService.js";

// Zod schemas for validation
const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").trim(),
});

const assignParticipantsSchema = z.object({
  participantIds: z.array(z.string().min(1)),
});

const randomAssignSchema = z.object({
  meetingId: z.string().optional(),
  roomIds: z.array(z.string().min(1)).min(1, "At least one room is required"),
  participantIds: z.array(z.string()).optional(),
});

const broadcastSchema = z.object({
  meetingId: z.string().optional(),
  message: z.string().min(1, "Message is required").trim(),
});

export const createRoom = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const validatedData = createRoomSchema.parse(req.body);
    const room = await breakoutRoomService.createRoom(
      meetingId,
      validatedData.name,
    );
    return res.status(201).json({ success: true, data: room });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

export const getRooms = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const rooms = await breakoutRoomService.getRoomsForMeeting(meetingId);
    return res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
};

export const assignParticipants = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const validatedData = assignParticipantsSchema.parse(req.body);
    const room = await breakoutRoomService.assignParticipants(
      roomId,
      validatedData.participantIds,
    );
    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

export const randomAssignParticipants = async (req, res, next) => {
  try {
    const meetingId =
      req.params.meetingId || req.body.meetingId || req.query.meetingId;
    const validatedData = randomAssignSchema.parse({
      ...req.body,
      meetingId,
    });

    const socketIo = req.app?.get("socketio") || req.app?.get("io");
    const result = await breakoutRoomService.randomAssignParticipants({
      meetingId,
      roomIds: validatedData.roomIds,
      participantIds: validatedData.participantIds,
      socketIo,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

export const broadcastToAllRooms = async (req, res, next) => {
  try {
    const meetingId =
      req.params.meetingId || req.body.meetingId || req.query.meetingId;
    const validatedData = broadcastSchema.parse({
      ...req.body,
      meetingId,
    });

    const socketIo = req.app?.get("socketio") || req.app?.get("io");
    const result = await breakoutRoomService.broadcastToAllRooms({
      meetingId,
      message: validatedData.message,
      sender: req.user?.name || req.user?.email || "Host Notification",
      socketIo,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

export const closeAllBreakoutRooms = async (req, res, next) => {
  try {
    const meetingId =
      req.params.meetingId || req.body.meetingId || req.query.meetingId;

    if (!meetingId) {
      return res
        .status(400)
        .json({ success: false, error: "Meeting ID is required." });
    }

    const socketIo = req.app?.get("socketio") || req.app?.get("io");
    const result = await breakoutRoomService.closeAllBreakoutRooms({
      meetingId,
      socketIo,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const startRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const room = await breakoutRoomService.startRoom(roomId);
    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

export const closeRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const room = await breakoutRoomService.closeRoom(roomId);
    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
};

export default {
  createRoom,
  getRooms,
  assignParticipants,
  randomAssignParticipants,
  broadcastToAllRooms,
  closeAllBreakoutRooms,
  startRoom,
  closeRoom,
};
