import BreakoutRoom from "../models/breakoutRoomModel.js";
import Meeting from "../models/meetingModel.js";
import { generateText } from "./GenerativeAIService.js";

export const breakoutRoomService = {
  createRoom: async (meetingId, name) => {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const newRoom = new BreakoutRoom({
      meetingId,
      name,
      participants: [],
      status: "pending",
    });

    return await newRoom.save();
  },

  assignParticipants: async (roomId, participantIds) => {
    const room = await BreakoutRoom.findById(roomId);
    if (!room) {
      throw new Error("Breakout room not found");
    }

    room.participants = participantIds;
    return await room.save();
  },

  randomAssignParticipants: async ({
    meetingId,
    roomIds,
    participantIds,
    socketIo,
  }) => {
    if (!meetingId) {
      throw new Error("Meeting ID is required");
    }
    if (!roomIds || roomIds.length === 0) {
      throw new Error("No active breakout rooms provisioned.");
    }

    let participants = participantIds || [];

    // If no participantIds passed, extract from Meeting model
    if (!participants || participants.length === 0) {
      const meeting = await Meeting.findById(meetingId);
      if (meeting?.participants?.length) {
        participants = meeting.participants.map(
          (p) => p.user || p._id || p.id || p.name || p,
        );
      }
    }

    if (participants.length === 0) {
      return { success: true, message: "Roster empty.", allocations: [] };
    }

    // Shuffle Roster via Fisher-Yates array displacement algorithm
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Distribute participants round-robin into breakout buckets
    const allocations = roomIds.map((id) => ({
      roomId: id.toString(),
      members: [],
    }));
    shuffled.forEach((participant, idx) => {
      allocations[idx % roomIds.length].members.push(participant);
    });

    // Write distribution maps down to persistent store concurrently
    await Promise.all(
      allocations.map((alloc) =>
        BreakoutRoom.findByIdAndUpdate(
          alloc.roomId,
          { participants: alloc.members },
          { new: true },
        ),
      ),
    );

    // Notify clients of group shuffles via Socket.IO if available
    if (socketIo) {
      socketIo
        .to(`meeting:${meetingId}`)
        .emit("breakout_shuffled", { allocations });
      socketIo.to(meetingId.toString()).emit("breakout:shuffled", {
        roomId: meetingId,
        allocations,
      });
    }

    return { success: true, allocations };
  },

  broadcastToAllRooms: async ({ meetingId, message, sender, socketIo }) => {
    if (!meetingId || !message) {
      throw new Error("Meeting ID and message are required.");
    }

    const payload = {
      sender: sender || "Host Notification",
      message,
      timestamp: Date.now(),
      roomId: meetingId,
    };

    if (socketIo) {
      // Broadcast over the meeting channels and breakout namespaces
      socketIo
        .to(`meeting:${meetingId}`)
        .emit("breakout_broadcast_received", payload);
      socketIo.to(meetingId.toString()).emit("breakout:broadcast", payload);
    }

    return { success: true, message: "Broadcast dispatched to all rooms." };
  },

  closeAllBreakoutRooms: async ({ meetingId, socketIo }) => {
    if (!meetingId) {
      throw new Error("Meeting ID is required.");
    }

    await BreakoutRoom.updateMany(
      { meetingId },
      { status: "closed", participants: [], closeTime: new Date() },
    );

    if (socketIo) {
      socketIo.to(`meeting:${meetingId}`).emit("breakout_closed_all");
      socketIo
        .to(meetingId.toString())
        .emit("breakout:closed-all", { roomId: meetingId });
    }

    return {
      success: true,
      message: "All breakout rooms closed and participants recalled.",
    };
  },

  startRoom: async (roomId) => {
    const room = await BreakoutRoom.findById(roomId);
    if (!room) {
      throw new Error("Breakout room not found");
    }

    room.status = "active";
    room.startTime = new Date();
    return await room.save();
  },

  closeRoom: async (roomId) => {
    const room = await BreakoutRoom.findById(roomId);
    if (!room) {
      throw new Error("Breakout room not found");
    }

    room.status = "closed";
    room.closeTime = new Date();

    // Summarize the transcript using AI if there is one
    if (room.transcript && room.transcript.length > 0) {
      try {
        const transcriptText = room.transcript
          .map((t) => `${t.speakerName}: ${t.text}`)
          .join("\n");

        const prompt = `Please summarize the following discussion from a breakout room named "${room.name}":\n\n${transcriptText}\n\nSummary:`;
        const summary = await generateText(
          prompt,
          `Breakout room ${room.name} summary`,
        );
        room.summary = summary.trim();
      } catch (err) {
        console.error(
          `Failed to generate summary for breakout room ${roomId}`,
          err,
        );
        room.summary = "Summary generation failed.";
      }
    }

    await room.save();

    const meeting = await Meeting.findById(room.meetingId);
    if (meeting) {
      const roomNote = `\n\n--- Breakout Room: ${room.name} Summary ---\n${room.summary || "No summary available."}\n`;
      meeting.description = (meeting.description || "") + roomNote;
      await meeting.save();
    }

    return room;
  },

  getRoomsForMeeting: async (meetingId) => {
    return await BreakoutRoom.find({ meetingId }).populate(
      "participants",
      "name email",
    );
  },

  addTranscriptEvent: async (roomId, speakerId, speakerName, text) => {
    const room = await BreakoutRoom.findById(roomId);
    if (!room) {
      throw new Error("Breakout room not found");
    }
    room.transcript.push({
      speakerId,
      speakerName,
      text,
      timestamp: new Date(),
    });
    return await room.save();
  },
};

export default breakoutRoomService;
