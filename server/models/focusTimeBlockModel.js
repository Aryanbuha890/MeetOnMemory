import mongoose from "mongoose";

const focusTimeBlockSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "Focus Time",
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    daysOfWeek: {
      type: [Number], // 0-6 where 0 is Sunday
      default: [],
      validate: {
        validator: function (v) {
          if (!this.isRecurring) return true;
          return v && v.length > 0 && v.every((day) => day >= 0 && day <= 6);
        },
        message:
          "Recurring blocks must specify at least one valid day of the week (0-6).",
      },
    },
    timezone: {
      type: String,
      default: "UTC",
    },
    allowOverride: {
      type: Boolean,
      default: true,
    },
    policy: {
      type: String,
      enum: ["warn", "block"],
      default: "warn",
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("FocusTimeBlock", focusTimeBlockSchema);
