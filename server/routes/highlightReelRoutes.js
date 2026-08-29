import express from "express";
import {
  generateHighlightReel,
  getHighlightReel,
  exportHighlightReelHtml,
  updateHighlightReel,
} from "../controllers/highlightReelController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Enforce user authentication across all highlight reel endpoints
router.use(userAuth);

router.post("/:meetingId/highlight-reel/generate", generateHighlightReel);

router.get("/:meetingId/highlight-reel", getHighlightReel);

router.put("/:meetingId/highlight-reel", updateHighlightReel);

router.get("/:meetingId/highlight-reel/export", exportHighlightReelHtml);

export default router;
