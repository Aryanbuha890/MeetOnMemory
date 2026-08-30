import mongoose from "mongoose";

const mindMapNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, default: "New Node" },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  color: { type: String, default: "#4f46e5" },
  isActionItem: { type: Boolean, default: false },
  actionItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ActionItem",
    default: null,
  },
});

const mindMapConnectionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
});

const mindMapSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      unique: true,
      index: true,
    },
    nodes: [mindMapNodeSchema],
    connections: [mindMapConnectionSchema],
  },
  { timestamps: true },
);

const MindMap =
  mongoose.models.MindMap || mongoose.model("MindMap", mindMapSchema);

export default MindMap;
