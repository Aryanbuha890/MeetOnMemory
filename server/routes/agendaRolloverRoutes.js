import express from "express";
import {
  handleAgendaRollover,
  previewAgendaRollover,
} from "../controllers/agendaRolloverController.js";
import userAuth from "../middleware/userAuth.js";
import { verifyMeetingAccess } from "../middleware/meetingAuth.js";

const router = express.Router();

router.use(userAuth);

router.get("/rollover/preview", previewAgendaRollover);
router.post("/:meetingId/rollover", verifyMeetingAccess, handleAgendaRollover);

export default router;
