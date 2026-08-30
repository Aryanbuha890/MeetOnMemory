import express from "express";
import protect from "../middleware/userAuth.js";
import {
  createRisk,
  getRisksByOrganization,
  getRisksByMeeting,
  updateRisk,
  deleteRisk,
  linkActionItem,
  exportOrganizationRisks,
  updateRiskStatus,
  mitigateRisk,
  getRiskDashboard,
} from "../controllers/meetingRiskController.js";

const router = express.Router();

router.use(protect);

router.post("/", createRisk);
router.get("/dashboard", getRiskDashboard);
router.get("/organization/:organizationId/export", exportOrganizationRisks);
router.get("/organization/:organizationId", getRisksByOrganization);
router.get("/meeting/:meetingId", getRisksByMeeting);
router.patch("/:riskId/status", updateRiskStatus);
router.put("/:riskId/mitigate", mitigateRisk);
router.put("/:riskId", updateRisk);
router.delete("/:riskId", deleteRisk);
router.post("/:riskId/action-items", linkActionItem);

export default router;
