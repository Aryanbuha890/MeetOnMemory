import cron from "node-cron";
import { processNotificationQueue } from "../services/notificationService.js";

let isInitialized = false;
let notificationBatchTask = null;

export const startNotificationBatchJob = () => {
  if (isInitialized) {
    console.warn("⚠️ Notification batch job already initialized");
    return;
  }

  // Run every 1 minute
  notificationBatchTask = cron.schedule("*/1 * * * *", async () => {
    try {
      console.log("⏰ Running scheduled Notification Batch job...");
      await processNotificationQueue();
    } catch (error) {
      console.error("❌ Error in scheduled Notification Batch job:", error);
    }
  });

  isInitialized = true;
  console.log("✅ Notification batch job scheduled (*/1 * * * *)");
};

export const stopNotificationBatchJob = () => {
  if (notificationBatchTask) {
    notificationBatchTask.stop();
    notificationBatchTask = null;
  }

  if (isInitialized) {
    isInitialized = false;
    console.log("Notification batch job stopped");
  }
};

export const isNotificationBatchJobInitialized = () => isInitialized;

export default startNotificationBatchJob;
