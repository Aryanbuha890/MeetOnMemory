// server/models/membershipModel.js
import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member", "viewer"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["active", "suspended", "removed", "inactive", "deactivated"],
      default: "active",
    },
    capacity: {
      weeklyHours: {
        type: Number,
        default: 40,
        min: 0,
        max: 168,
      },
      maxConcurrentMeetings: {
        type: Number,
        default: 5,
        min: 1,
      },
    },
    roleHistory: [
      {
        previousRole: {
          type: String,
        },
        newRole: {
          type: String,
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          default: "",
        },
      },
    ],
    engagementScore: {
      type: Number,
      default: 0,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

// Compound index to prevent duplicate memberships
membershipSchema.index({ user: 1, organization: 1 }, { unique: true });
membershipSchema.index({ organization: 1, status: 1 });
membershipSchema.index({ user: 1, status: 1 });
membershipSchema.index({ joinedAt: -1 });

const Membership =
  mongoose.models.Membership || mongoose.model("Membership", membershipSchema);

export default Membership;
