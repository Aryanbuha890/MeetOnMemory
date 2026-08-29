import express from "express";
import {
  createRoom,
  getRooms,
  assignParticipants,
  randomAssignParticipants,
  broadcastToAllRooms,
  closeAllBreakoutRooms,
  startRoom,
  closeRoom,
} from "../controllers/breakoutRoomController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router({ mergeParams: true });

// All routes require user authentication
router.use(userAuth);

// Routes for /api/meetings/:meetingId/breakout-rooms and /api/breakouts
router.post("/", createRoom);
router.get("/", getRooms);
router.post("/random-assign", randomAssignParticipants);
router.post("/broadcast", broadcastToAllRooms);
router.post("/close-all", closeAllBreakoutRooms);

// Routes for specific breakout room
router.put("/:roomId/participants", assignParticipants);
router.post("/:roomId/start", startRoom);
router.post("/:roomId/close", closeRoom);

export default router;
