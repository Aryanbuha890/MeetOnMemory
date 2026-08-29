import mongoose from "mongoose";
import MindMap from "../models/mindMapModel.js";
import ActionItem from "../models/actionItemModel.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";

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

// GET /api/mindmap/:meetingId
export const getMindMap = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    let mindMap = await MindMap.findOne({ meetingId });
    if (!mindMap) {
      return res.status(200).json({
        success: true,
        data: { meetingId, nodes: [], connections: [] },
      });
    }
    res.status(200).json({ success: true, data: mindMap });
  } catch (error) {
    next(error);
  }
};

// POST /api/mindmap/:meetingId
export const saveMindMap = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { nodes, connections } = req.body;

    // Validate structure and sizes
    if (!validateMindMapPayload(nodes, connections)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mind map payload" });
    }

    let mindMap = await MindMap.findOne({ meetingId });
    if (mindMap) {
      mindMap.nodes = nodes || [];
      mindMap.connections = connections || [];
      await mindMap.save();
    } else {
      mindMap = await MindMap.create({
        meetingId,
        nodes: nodes || [],
        connections: connections || [],
      });
    }

    res.status(200).json({ success: true, data: mindMap });
  } catch (error) {
    next(error);
  }
};

// POST /api/mindmap/:meetingId/convert-node
export const convertNodeToActionItem = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { nodeId, assignee, dueDate, priority } = req.body;

    const mindMap = await MindMap.findOne({ meetingId });
    if (!mindMap) {
      return res
        .status(404)
        .json({ success: false, message: "Mind map not found" });
    }

    const node = mindMap.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return res
        .status(404)
        .json({ success: false, message: "Node not found" });
    }

    if (node.isActionItem) {
      return res
        .status(400)
        .json({ success: false, message: "Node is already an action item" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    // Validate ActionItem assignee if supplied
    if (assignee) {
      if (!mongoose.Types.ObjectId.isValid(assignee)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid assignee ID format" });
      }

      const user = await User.findById(assignee);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "Assignee user not found" });
      }

      const meetingOrgId = meeting.organization
        ? meeting.organization.toString()
        : null;
      const requesterOrgId =
        req.user && req.user.organization
          ? req.user.organization.toString()
          : null;
      const userOrgId = user.organization ? user.organization.toString() : null;

      const targetOrgId = meetingOrgId || requesterOrgId;
      const isOrgMember = targetOrgId && userOrgId === targetOrgId;
      const isParticipant =
        meeting.participants &&
        meeting.participants.some((p) => p.toString() === assignee);

      if (!isParticipant && !isOrgMember) {
        return res.status(403).json({
          success: false,
          message:
            "Forbidden: Assignee is not a valid participant or organization member of this meeting",
        });
      }
    }

    // Create Action Item
    const actionItem = await ActionItem.create({
      text: node.text || "Mind map brainstorm item",
      assignee: assignee || null,
      assignedBy: req.user._id || req.user.id,
      status: "open",
      priority: priority || "medium",
      sourceMeetingId: meetingId,
      organization: meeting.organization || req.user.organization || null,
      dueDate: dueDate || null,
    });

    node.isActionItem = true;
    node.actionItemId = actionItem._id;
    await mindMap.save();

    res.status(201).json({
      success: true,
      data: {
        actionItem,
        node,
      },
    });
  } catch (error) {
    next(error);
  }
};
