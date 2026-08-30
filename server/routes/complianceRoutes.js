import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  scanTranscriptDlp,
  getComplianceAuditLogs,
  requestEntityUnmask,
  reviewUnmaskRequest,
} from "../controllers/complianceController.js";

const router = express.Router();

router.use(userAuth);

router.post("/scan", scanTranscriptDlp);
router.get("/audit-logs", getComplianceAuditLogs);
router.post("/unmask-request/:auditId", requestEntityUnmask);
router.patch("/unmask-request/:auditId/:requestId", reviewUnmaskRequest);

export default router;
