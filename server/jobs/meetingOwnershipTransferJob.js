import MeetingOwnershipTransfer from "../models/meetingOwnershipTransferModel.js";
import { createNotification } from "../services/notificationService.js";

let intervalId = null;

export const startMeetingOwnershipTransferJob = () => {
  if (intervalId) return;

  // Run every 12 hours
  intervalId = setInterval(
    async () => {
      try {
        const now = new Date();
        const expiredTransfers = await MeetingOwnershipTransfer.find({
          status: "pending",
          expiresAt: { $lt: now },
        });

        for (const transfer of expiredTransfers) {
          transfer.status = "expired";
          await transfer.save();

          // Notify the original owner that it expired
          await createNotification(
            transfer.fromUser,
            "Transfer Request Expired",
            `Your request to transfer a meeting to a new owner has expired.`,
            "system",
          );
        }
      } catch (error) {
        console.error("Error in meeting ownership transfer job:", error);
      }
    },
    12 * 60 * 60 * 1000,
  ); // 12 hours
};

export const stopMeetingOwnershipTransferJob = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};
