import mongoose from "mongoose";

const highlightReelSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      unique: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    narrative: {
      type: String,
      required: true,
    },
    highlights: [
      {
        type: {
          type: String,
          enum: [
            "decision",
            "action_item",
            "insight",
            "breakthrough",
            "debate",
            "other",
          ],
          required: true,
        },
        timestamp: {
          type: Number, // Start time in seconds
          required: true,
        },
        endTime: {
          type: Number, // End time in seconds
        },
        speaker: {
          type: String,
          default: "Unknown",
        },
        excerpt: {
          type: String,
          required: true,
        },
        sentiment: {
          type: String,
          enum: ["positive", "neutral", "negative"],
          default: "neutral",
        },
        importance: {
          type: Number,
          min: 1,
          max: 10,
          default: 5,
        },
        aiRationale: {
          type: String,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    generatedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

const HighlightReel = mongoose.model("HighlightReel", highlightReelSchema);
export default HighlightReel;
