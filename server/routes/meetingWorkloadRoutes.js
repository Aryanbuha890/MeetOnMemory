import express from "express";
import {
  getHeatmap,
  getTeamWorkload,
} from "../controllers/meetingWorkloadController.js";

const router = express.Router();

// Base path is /api/meeting-workload mounted in index.js

router.get("/heatmap", getHeatmap);
router.get("/team", getTeamWorkload);

export default router;
