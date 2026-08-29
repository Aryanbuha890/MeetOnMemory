import mongoose from "mongoose";

const resourceBookingSchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhysicalResource",
      required: true,
    },
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    title: {
      type: String,
      default: "Facility Reservation Event",
    },
    status: {
      type: String,
      enum: ["CONFIRMED", "CANCELLED", "PENDING"],
      default: "CONFIRMED",
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
  },
  { timestamps: true },
);

resourceBookingSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });
resourceBookingSchema.index({ meetingId: 1 });
resourceBookingSchema.index({ organization: 1 });
resourceBookingSchema.index({ resourceId: 1, status: 1 });

const ResourceBooking = mongoose.model(
  "ResourceBooking",
  resourceBookingSchema,
);
export default ResourceBooking;
