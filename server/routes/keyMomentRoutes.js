import express from "express";
import {
  createKeyMoment,
  getKeyMomentsForMeeting,
  updateKeyMoment,
  deleteKeyMoment,
  exportKeyMoments,
} from "../controllers/keyMomentController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

router.use(userAuth);

router.post("/", createKeyMoment);
router.get("/export", exportKeyMoments);
router.get("/meeting/:meetingId/export", exportKeyMoments);
router.get("/meeting/:meetingId", getKeyMomentsForMeeting);
router.patch("/:id", updateKeyMoment);
router.put("/:id", updateKeyMoment);
router.delete("/:id", deleteKeyMoment);

export default router;
