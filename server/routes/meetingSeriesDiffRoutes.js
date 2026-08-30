import express from "express";
import {
  getPairwiseDiff,
  getSeriesTimeline,
} from "../controllers/meetingSeriesDiffController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

// GET /api/series-diff/:seriesId/timeline
router.get("/:seriesId/timeline", getSeriesTimeline);

// GET /api/series-diff/compare?m1Id=...&m2Id=...
router.get("/compare", getPairwiseDiff);

export default router;
