import mongoose from "mongoose";

const keyTopicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    points: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

const decisionSchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      required: true,
      trim: true,
    },
    context: {
      type: String,
      default: "",
    },
    impact: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const actionItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    task: {
      type: String,
      required: true,
      trim: true,
    },
    owner: {
      type: String,
      default: "Unassigned",
      trim: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const qualityScoreSchema = new mongoose.Schema(
  {
    overallScore: { type: Number, min: 0, max: 100, default: 85 },
    clarity: { type: Number, min: 0, max: 100, default: 85 },
    completeness: { type: Number, min: 0, max: 100, default: 90 },
    actionability: { type: Number, min: 0, max: 100, default: 80 },
    decisionClarity: { type: Number, min: 0, max: 100, default: 85 },
  },
  { _id: false },
);

const versionHistorySchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    summary: {
      type: String,
      default: "",
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    editedAt: {
      type: Date,
      default: Date.now,
    },
    changeSummary: {
      type: String,
      default: "Edited notes",
    },
  },
  { _id: false },
);

const aiMeetingNoteSchema = new mongoose.Schema(
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
      index: true,
    },
    meetingType: {
      type: String,
      enum: [
        "general",
        "executive",
        "product",
        "engineering",
        "1-on-1",
        "retrospective",
        "sales",
        "workshop",
      ],
      default: "general",
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    rawContent: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
    },
    summary: {
      type: String,
      default: "",
    },
    keyTopics: {
      type: [keyTopicSchema],
      default: [],
    },
    decisions: {
      type: [decisionSchema],
      default: [],
    },
    actionItems: {
      type: [actionItemSchema],
      default: [],
    },
    qualityScore: {
      type: qualityScoreSchema,
      default: () => ({}),
    },
    reviewStatus: {
      type: String,
      enum: ["draft", "in_review", "reviewed", "approved"],
      default: "draft",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewFeedback: {
      type: String,
      default: "",
    },
    templateUsed: {
      type: String,
      default: "general",
    },
    version: {
      type: Number,
      default: 1,
    },
    versionHistory: {
      type: [versionHistorySchema],
      default: [],
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

const AiMeetingNote =
  mongoose.models.AiMeetingNote ||
  mongoose.model("AiMeetingNote", aiMeetingNoteSchema);

export default AiMeetingNote;
