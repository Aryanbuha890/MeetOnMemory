import mongoose from "mongoose";

const riskEscalationSchema = new mongoose.Schema(
  {
    riskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeetingRisk",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    escalatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const RiskEscalation =
  mongoose.models.RiskEscalation ||
  mongoose.model("RiskEscalation", riskEscalationSchema);

export default RiskEscalation;
