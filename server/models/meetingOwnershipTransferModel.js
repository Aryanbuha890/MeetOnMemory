import mongoose from "mongoose";

const meetingOwnershipTransferSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // For querying inbox
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d;
      },
    },
  },
  { timestamps: true },
);

// Optional: ensure only one pending transfer per meeting at a time
meetingOwnershipTransferSchema.index(
  { meeting: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

const MeetingOwnershipTransfer = mongoose.model(
  "MeetingOwnershipTransfer",
  meetingOwnershipTransferSchema,
);

export default MeetingOwnershipTransfer;
