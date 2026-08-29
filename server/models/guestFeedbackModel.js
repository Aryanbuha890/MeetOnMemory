import mongoose from "mongoose";

const guestFeedbackSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    guestName: {
      type: String,
      default: "Anonymous Guest",
      trim: true,
    },
    guestEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comments: {
      type: String,
      default: "",
      trim: true,
    },
    token: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

guestFeedbackSchema.index({ meetingId: 1, createdAt: -1 });

const GuestFeedback = mongoose.model("GuestFeedback", guestFeedbackSchema);
export default GuestFeedback;
