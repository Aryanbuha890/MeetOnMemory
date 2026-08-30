import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";
import {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  generateAiNote,
  reviewNote,
  toggleActionItemStatus,
  getCrossMeetingActionItems,
  getNoteTemplates,
  restoreNoteVersion,
  getNotesAnalytics,
} from "../controllers/aiMeetingNoteController.js";

const router = express.Router();

// Apply authentication and organization membership to all AI meeting note routes
router.use(userAuth);
router.use(requireOrgMembership);

// Reusable Templates & Analytics
router.get("/templates", getNoteTemplates);
router.get("/analytics/summary", getNotesAnalytics);

// Cross-meeting extracted action items
router.get("/actions/cross-meeting", getCrossMeetingActionItems);

// AI Note Generation & Extraction
router.post("/generate", generateAiNote);

// Note CRUD
router.get("/records", getNotes);
router.get("/records/:id", getNoteById);
router.post("/records", createNote);
router.put("/records/:id", updateNote);
router.delete("/records/:id", deleteNote);

// Review & Versioning Workflows
router.patch("/:id/review", reviewNote);
router.patch("/:id/actions/:actionId", toggleActionItemStatus);
router.post("/:id/restore/:version", restoreNoteVersion);

export default router;
