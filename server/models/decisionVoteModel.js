import mongoose from "mongoose";

const decisionVoteSchema = new mongoose.Schema(
  {
    decisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    vote: {
      type: String,
      enum: ["approve", "reject", "abstain"],
      required: true,
    },
    weight: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  { timestamps: true },
);

// Prevent duplicate votes: one user can vote only once per decision
decisionVoteSchema.index({ decisionId: 1, userId: 1 }, { unique: true });

const DecisionVote =
  mongoose.models.DecisionVote ||
  mongoose.model("DecisionVote", decisionVoteSchema);

export default DecisionVote;
