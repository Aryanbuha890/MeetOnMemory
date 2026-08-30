import mongoose from "mongoose";

const conflictAuditSchema = new mongoose.Schema(
  {
    conflictId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConflictSet",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["resolved", "dismissed", "reopened"],
      required: true,
    },
    resolutionType: {
      type: String,
      enum: ["kept_member", "custom_value", "dismissed", null],
      default: null,
    },
    keptMemoryId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    customValue: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      default: "",
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actionAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const ConflictAudit =
  mongoose.models.ConflictAudit ||
  mongoose.model("ConflictAudit", conflictAuditSchema);

export default ConflictAudit;
