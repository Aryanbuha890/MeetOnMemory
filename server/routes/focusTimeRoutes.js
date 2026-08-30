import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  createFocusTimeBlock,
  getFocusTimeBlocks,
  updateFocusTimeBlock,
  deleteFocusTimeBlock,
  getFocusTimeAnalytics,
  checkFocusTimeConflicts,
} from "../controllers/focusTimeController.js";

const router = express.Router();

router.use(userAuth); // Ensure all routes are protected

router.route("/").get(getFocusTimeBlocks).post(createFocusTimeBlock);

router.route("/analytics").get(getFocusTimeAnalytics);
router.route("/conflicts").get(checkFocusTimeConflicts);

router.route("/:id").put(updateFocusTimeBlock).delete(deleteFocusTimeBlock);

export default router;
