import MindMap from "../models/mindMapModel.js";
import { resolveMeetingSocketAccess } from "../utils/meetingSocketAccess.js";

const validateMindMapPayload = (nodes, connections) => {
  if (!Array.isArray(nodes) || !Array.isArray(connections)) {
    return false;
  }

  if (nodes.length > 500 || connections.length > 500) {
    return false;
  }

  for (const node of nodes) {
    if (!node || typeof node.id !== "string" || !node.id.trim()) {
      return false;
    }
    if (
      node.text !== undefined &&
      (typeof node.text !== "string" || node.text.length > 1000)
    ) {
      return false;
    }
    if (node.x !== undefined && typeof node.x !== "number") {
      return false;
    }
    if (node.y !== undefined && typeof node.y !== "number") {
      return false;
    }
    if (
      node.color !== undefined &&
      (typeof node.color !== "string" || node.color.length > 50)
    ) {
      return false;
    }
  }

  for (const conn of connections) {
    if (!conn || typeof conn.id !== "string" || !conn.id.trim()) {
      return false;
    }
    if (typeof conn.source !== "string" || !conn.source.trim()) {
      return false;
    }
    if (typeof conn.target !== "string" || !conn.target.trim()) {
      return false;
    }
  }

  return true;
};

export default (io) => {
  io.on("connection", (socket) => {
    socket.on("mindmap:join", async ({ meetingId }) => {
      try {
        if (!meetingId) return;

        const access = await resolveMeetingSocketAccess(meetingId, socket);
        if (!access.authorized) {
          socket.emit("mindmap:error", {
            message: "Forbidden: You don't have access to this meeting",
          });
          return;
        }

        const roomName = `mindmap:${meetingId}`;
        socket.join(roomName);

        // Fetch current mind map and initialize
        let mindMap = await MindMap.findOne({ meetingId });
        if (!mindMap) {
          mindMap = { meetingId, nodes: [], connections: [] };
        }

        socket.emit("mindmap:init", mindMap);
      } catch (err) {
        console.error("Error joining mindmap socket room:", err);
        socket.emit("mindmap:error", {
          message: "Failed to join mindmap room",
        });
      }
    });

    socket.on(
      "mindmap:update-all",
      async ({ meetingId, nodes, connections }) => {
        try {
          if (!meetingId) return;

          const access = await resolveMeetingSocketAccess(meetingId, socket);
          if (!access.authorized) return;

          // Validate payload size and types
          if (!validateMindMapPayload(nodes, connections)) {
            socket.emit("mindmap:error", {
              message:
                "Invalid mind map payload structure or size limit exceeded",
            });
            return;
          }

          // Persist to DB
          await MindMap.findOneAndUpdate(
            { meetingId },
            { $set: { nodes: nodes || [], connections: connections || [] } },
            { upsert: true, new: true },
          );

          const roomName = `mindmap:${meetingId}`;
          socket.to(roomName).emit("mindmap:changed", { nodes, connections });
        } catch (err) {
          console.error("Error saving/broadcasting mindmap update:", err);
        }
      },
    );

    socket.on("mindmap:node-drag", async ({ meetingId, nodeId, x, y }) => {
      try {
        if (!meetingId || !nodeId) return;
        if (
          typeof nodeId !== "string" ||
          typeof x !== "number" ||
          typeof y !== "number"
        ) {
          return;
        }

        const access = await resolveMeetingSocketAccess(meetingId, socket);
        if (!access.authorized) return;

        // Update single node position in DB
        await MindMap.updateOne(
          { meetingId, "nodes.id": nodeId },
          { $set: { "nodes.$.x": x, "nodes.$.y": y } },
        );

        const roomName = `mindmap:${meetingId}`;
        socket.to(roomName).emit("mindmap:node-moved", { nodeId, x, y });
      } catch (err) {
        console.error("Error updates node drag coordinates:", err);
      }
    });
  });
};
