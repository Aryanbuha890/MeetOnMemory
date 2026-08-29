import express from "express";
import protect from "../middleware/userAuth.js";
import GuestAccessController, {
  getHostAnalytics,
  exportFeedbackCSV,
  submitGuestFeedback,
  recordGuestJoin,
} from "../controllers/guestAccessController.js";

const router = express.Router();

// --- Authenticated Host / Admin Routes ---
router.post(
  "/meetings/:meetingId/guest-tokens",
  protect,
  GuestAccessController.createToken,
);
router.get(
  "/meetings/:meetingId/guest-tokens",
  protect,
  GuestAccessController.getMeetingTokens,
);
router.post(
  "/guest-tokens/:tokenId/revoke",
  protect,
  GuestAccessController.revokeToken,
);
router.delete(
  "/guest-tokens/:tokenId",
  protect,
  GuestAccessController.revokeToken,
);

// Host Analytics & Feedback Export
router.get("/meetings/:meetingId/guest-analytics", protect, getHostAnalytics);
router.get("/analytics/:meetingId", protect, getHostAnalytics);
router.get(
  "/meetings/:meetingId/guest-feedback/export",
  protect,
  exportFeedbackCSV,
);
router.get("/feedback/export", protect, exportFeedbackCSV);

// --- Unauthenticated Guest Routes ---
router.get("/guest/meeting/:token", GuestAccessController.getGuestMeetingData);
router.post("/guest/meeting/:token/join", recordGuestJoin);
router.post(
  "/guest/meeting/:token/comments",
  GuestAccessController.addGuestComment,
);
router.post("/guest/meeting/:token/feedback", submitGuestFeedback);

export default router;
