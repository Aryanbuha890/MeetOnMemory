import cron from "node-cron";
import { evaluateRiskEscalations } from "../services/riskEscalationService.js";

let isInitialized = false;
let riskEscalationTask = null;

export const startRiskEscalationJob = () => {
  if (isInitialized) {
    console.warn("⚠️ Risk Escalation job already initialized");
    return;
  }

  // Run daily at midnight
  riskEscalationTask = cron.schedule("0 0 * * *", async () => {
    try {
      console.log("⏰ Running scheduled Risk Escalation job...");
      await evaluateRiskEscalations();
    } catch (error) {
      console.error("❌ Error in scheduled Risk Escalation job:", error);
    }
  });

  isInitialized = true;
  console.log("✅ Risk Escalation job scheduled daily (0 0 * * *)");
};

export const stopRiskEscalationJob = () => {
  if (riskEscalationTask) {
    riskEscalationTask.stop();
    riskEscalationTask = null;
  }

  if (isInitialized) {
    isInitialized = false;
    console.log("Risk Escalation job stopped");
  }
};

export const isRiskEscalationJobInitialized = () => isInitialized;

export default startRiskEscalationJob;
