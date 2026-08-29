import express from "express";
import {
  getMindMap,
  saveMindMap,
  convertNodeToActionItem,
} from "../controllers/mindMapController.js";
import userAuth from "../middleware/userAuth.js";
import { verifyMeetingAccess } from "../middleware/meetingAuth.js";

const router = express.Router();

router.use(userAuth);

router.get("/:meetingId", verifyMeetingAccess, getMindMap);
router.post("/:meetingId", verifyMeetingAccess, saveMindMap);
router.post(
  "/:meetingId/convert-node",
  verifyMeetingAccess,
  convertNodeToActionItem,
);

export default router;
