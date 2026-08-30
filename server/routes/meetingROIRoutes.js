import express from "express";
import {
  getROIRecords,
  getROIRecordById,
  getROIRecordByMeeting,
  createROIRecord,
  updateROIRecord,
  deleteROIRecord,
  getROIDashboardSummary,
  simulateWhatIf,
} from "../controllers/meetingROIController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

// All routes require user authentication and organization membership
router.use(userAuth);
router.use(requireOrgMembership);

// Analytics & Insights
router.get("/analytics/summary", getROIDashboardSummary);
router.post("/simulate", simulateWhatIf);

// Meeting-linked lookup
router.get("/meeting/:meetingId", getROIRecordByMeeting);

// CRUD Records
router.get("/records", getROIRecords);
router.post("/records", createROIRecord);
router.get("/records/:id", getROIRecordById);
router.put("/records/:id", updateROIRecord);
router.delete("/records/:id", deleteROIRecord);

export default router;
