import MindMap from "../models/mindMapModel.js";
import ActionItem from "../models/actionItemModel.js";
import Meeting from "../models/meetingModel.js";

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
