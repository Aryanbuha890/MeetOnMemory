import mongoose from "mongoose";

const meetingRsvpSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "tentative", "waitlisted"],
      default: "pending",
    },
    declineReason: {
      type: String,
      trim: true,
      default: "",
    },
    availabilityNote: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

// Ensure a user can only have one RSVP per meeting
meetingRsvpSchema.index({ meetingId: 1, userId: 1 }, { unique: true });

const MeetingRsvp = mongoose.model("MeetingRsvp", meetingRsvpSchema);

export default MeetingRsvp;
