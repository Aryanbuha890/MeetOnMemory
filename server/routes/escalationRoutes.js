import express from "express";
import {
  getEscalationPolicies,
  getEscalationPolicyById,
  createEscalationPolicy,
  updateEscalationPolicy,
  deleteEscalationPolicy,
  getEscalationPolicyDashboard,
  getEscalationHistory,
  triggerManualEscalation,
} from "../controllers/escalationController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Protected routes
router.use(userAuth);

router.get("/dashboard", getEscalationPolicyDashboard);
router.get("/history", getEscalationHistory);
router.get("/events", getEscalationHistory);
router.post("/trigger", triggerManualEscalation);
router.post("/:id/trigger", triggerManualEscalation);
router.get("/", getEscalationPolicies);
router.get("/:id", getEscalationPolicyById);
router.post("/", createEscalationPolicy);
router.put("/:id", updateEscalationPolicy);
router.delete("/:id", deleteEscalationPolicy);

export default router;
