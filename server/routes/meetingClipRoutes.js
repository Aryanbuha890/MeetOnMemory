import express from "express";
import {
  trimClipController,
  mergeClipsController,
} from "../controllers/meetingClipController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";

const router = express.Router();

// Apply authentication middleware to all clip routes
router.use(userAuth);
router.use(requireOrgMembership);

router.post(
  "/:clipId/trim",
  requirePermission("meetings", "edit"),
  trimClipController,
);
router.post(
  "/merge",
  requirePermission("meetings", "edit"),
  mergeClipsController,
);

export default router;
