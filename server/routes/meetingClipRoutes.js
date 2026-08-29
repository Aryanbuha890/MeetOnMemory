import express from "express";
import {
  trimClipController,
  mergeClipsController,
} from "../controllers/meetingClipController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

// Apply authentication middleware to all clip routes
router.use(userAuth);
router.use(requireOrgMembership);

router.post("/:clipId/trim", trimClipController);
router.post("/merge", mergeClipsController);

export default router;
