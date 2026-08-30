import mongoose from "mongoose";

const escalationEventSchema = new mongoose.Schema(
  {
    actionItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActionItem",
      required: true,
      index: true,
    },
    policy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EscalationPolicy",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    stepIndex: {
      type: Number,
      required: true,
    },
    actionTaken: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["success", "failed", "pending"],
      default: "success",
    },
    errorDetails: {
      type: String,
      default: "",
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const EscalationEvent =
  mongoose.models.EscalationEvent ||
  mongoose.model("EscalationEvent", escalationEventSchema);

export default EscalationEvent;
