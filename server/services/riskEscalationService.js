import MeetingRisk from "../models/meetingRiskModel.js";
import RiskEscalation from "../models/riskEscalationModel.js";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import Meeting from "../models/meetingModel.js";

export const evaluateRiskEscalations = async () => {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find Open risks that have a score >= 10 (High or Critical), created > 48h ago, and have NO mitigation plan
    const risksToEscalate = await MeetingRisk.find({
      status: "Open",
      riskScore: { $gte: 10 },
      createdAt: { $lt: fortyEightHoursAgo },
      $or: [
        { mitigationPlan: { $exists: false } },
        { mitigationPlan: null },
        { mitigationPlan: "" },
      ],
    });

    console.log(
      `[Risk Escalation Engine] Found ${risksToEscalate.length} risks breaching 48h SLA.`,
    );

    for (const risk of risksToEscalate) {
      // Avoid duplicate escalations for the same risk
      const alreadyEscalated = await RiskEscalation.findOne({
        riskId: risk._id,
      });
      if (alreadyEscalated) continue;

      const meeting = await Meeting.findById(risk.meetingId);
      const meetingTitle = meeting?.title || "Unknown Meeting";

      // 1. Create Escalation Audit Log
      await RiskEscalation.create({
        riskId: risk._id,
        organizationId: risk.organizationId,
        reason: `SLA breach: ${risk.riskScore >= 15 ? "Critical" : "High"} risk "${risk.title}" (Score: ${risk.riskScore}) from meeting "${meetingTitle}" has not been mitigated within 48 hours.`,
        escalatedAt: new Date(),
      });

      // 2. Alert organization owners & administrators
      const admins = await User.find({
        organization: risk.organizationId,
        role: { $in: ["admin", "owner"] },
      });

      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          title: "⚠️ Risk Escalation Alert",
          description: `Risk "${risk.title}" (Score: ${risk.riskScore}) in meeting "${meetingTitle}" requires urgent mitigation. SLA breached (48h).`,
          category: "system",
          actionUrl: "/meeting-risks/dashboard",
          actionLabel: "Mitigate Risk",
        });
      }
    }
  } catch (error) {
    console.error("❌ Error in evaluateRiskEscalations service:", error);
    throw error;
  }
};
