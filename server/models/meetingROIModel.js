import mongoose from "mongoose";

const decisionDetailSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "revenue",
        "cost_savings",
        "efficiency",
        "risk_mitigation",
        "other",
      ],
      default: "revenue",
    },
    estimatedValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    realizedStatus: {
      type: String,
      enum: ["projected", "in_progress", "realized"],
      default: "projected",
    },
  },
  { _id: true },
);

const directCostsSchema = new mongoose.Schema(
  {
    venue: { type: Number, default: 0, min: 0 },
    softwareLicenses: { type: Number, default: 0, min: 0 },
    refreshments: { type: Number, default: 0, min: 0 },
    materialsAndEquipment: { type: Number, default: 0, min: 0 },
    externalConsultants: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const qualityMetricsSchema = new mongoose.Schema(
  {
    efficiencyRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 4,
    },
    goalAchievementRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 85,
    },
    attendeeEngagementScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 80,
    },
    decisionSpeedMinutes: {
      type: Number,
      default: 20,
      min: 0,
    },
    actionItemsCount: {
      type: Number,
      default: 3,
      min: 0,
    },
    actionItemsCompletedCount: {
      type: Number,
      default: 2,
      min: 0,
    },
  },
  { _id: false },
);

const meetingROISchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    meetingType: {
      type: String,
      enum: [
        "strategy",
        "planning",
        "1-on-1",
        "retrospective",
        "sales_client",
        "standup",
        "review",
        "workshop",
        "other",
      ],
      default: "strategy",
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      default: 60,
    },
    attendeeCount: {
      type: Number,
      required: true,
      min: 1,
      default: 4,
    },
    avgHourlyRate: {
      type: Number,
      required: true,
      min: 0,
      default: 65,
    },
    laborCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    directCosts: {
      type: directCostsSchema,
      default: () => ({}),
    },
    totalDirectCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMeetingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    decisionValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    decisionDetails: {
      type: [decisionDetailSchema],
      default: [],
    },
    netValue: {
      type: Number,
      default: 0,
    },
    roiPercentage: {
      type: Number,
      default: 0,
    },
    qualityMetrics: {
      type: qualityMetricsSchema,
      default: () => ({}),
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Pre-save hook to compute costs and ROI percentage automatically
 */
meetingROISchema.pre("save", function (next) {
  const durationHours = (this.durationMinutes || 60) / 60;
  const attendees = this.attendeeCount || 1;
  const hourly = this.avgHourlyRate || 0;

  this.laborCost = Math.round(durationHours * attendees * hourly * 100) / 100;

  const direct = this.directCosts || {};
  this.totalDirectCost =
    (direct.venue || 0) +
    (direct.softwareLicenses || 0) +
    (direct.refreshments || 0) +
    (direct.materialsAndEquipment || 0) +
    (direct.externalConsultants || 0) +
    (direct.other || 0);

  this.totalMeetingCost =
    Math.round((this.laborCost + this.totalDirectCost) * 100) / 100;

  if (Array.isArray(this.decisionDetails) && this.decisionDetails.length > 0) {
    const totalDecisionSum = this.decisionDetails.reduce(
      (sum, item) => sum + (Number(item.estimatedValue) || 0),
      0,
    );
    if (this.decisionValue === 0 || this.isModified("decisionDetails")) {
      this.decisionValue = totalDecisionSum;
    }
  }

  this.netValue =
    Math.round(((this.decisionValue || 0) - this.totalMeetingCost) * 100) / 100;

  if (this.totalMeetingCost > 0) {
    this.roiPercentage =
      Math.round(
        (((this.decisionValue || 0) - this.totalMeetingCost) /
          this.totalMeetingCost) *
          100 *
          10,
      ) / 10;
  } else if ((this.decisionValue || 0) > 0) {
    this.roiPercentage = 100;
  } else {
    this.roiPercentage = 0;
  }

  if (typeof next === "function") {
    next();
  }
});

const MeetingROI =
  mongoose.models.MeetingROI || mongoose.model("MeetingROI", meetingROISchema);

export default MeetingROI;
