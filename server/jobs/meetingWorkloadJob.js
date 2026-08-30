import cron from "node-cron";
import Organization from "../models/organizationModel.js";
import MeetingWorkloadService from "../services/meetingWorkloadService.js";
import { createNotifications } from "../services/notificationService.js";

let isInitialized = false;
/** @type {import("node-cron").ScheduledTask | null} */
let workloadTask = null;

export const startMeetingWorkloadJob = () => {
  if (isInitialized) {
    console.warn("⚠️ Meeting Workload job already initialized");
    return;
  }

  // Run weekly on Sunday at midnight
  workloadTask = cron.schedule("0 0 * * 0", async () => {
    try {
      console.log("⏰ Running scheduled Meeting Workload job...");
      const orgs = await Organization.find({
        visibility: { $ne: "suspended" },
      });
      let notificationsSent = 0;

      for (const org of orgs) {
        const workloads = await MeetingWorkloadService.getTeamWorkload(org._id);
        const overloadedUsers = workloads.filter(
          (w) => w.riskStatus === "overloaded",
        );

        if (overloadedUsers.length > 0) {
          const userIds = overloadedUsers.map((w) => w.user._id);
          await createNotifications(userIds, {
            title: "Meeting Workload Alert",
            description:
              "Your meeting workload for the past week exceeded the recommended threshold.",
            category: "system",
            actionUrl: "/analytics?tab=workload",
            actionLabel: "View Workload",
            metadata: { organizationId: org._id },
          });
          notificationsSent += userIds.length;
        }
      }
      console.log(
        `✅ Meeting Workload job completed. Sent ${notificationsSent} alerts.`,
      );
    } catch (error) {
      console.error("❌ Error in scheduled Meeting Workload job:", error);
    }
  });

  isInitialized = true;
  console.log("✅ Meeting Workload job scheduled (0 0 * * 0)");
};

export const stopMeetingWorkloadJob = () => {
  if (workloadTask) {
    workloadTask.stop();
    workloadTask = null;
  }

  if (isInitialized) {
    isInitialized = false;
    console.log("Meeting Workload job stopped");
  }
};

export const isMeetingWorkloadJobInitialized = () => isInitialized;

export default startMeetingWorkloadJob;
