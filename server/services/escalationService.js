import ActionItem from "../models/actionItemModel.js";
import EscalationPolicy from "../models/escalationPolicyModel.js";
import EscalationEvent from "../models/escalationEventModel.js";
import Organization from "../models/organizationModel.js";
import { createNotification } from "./notificationService.js";

/**
 * Service to evaluate active escalation policies against overdue action items.
 */
export const evaluateEscalations = async (options = {}) => {
  const { policyId = null, organizationId = null } =
    typeof options === "string" ? { organizationId: options } : options || {};
  console.log(
    `[EscalationService] Starting escalation evaluation job (org: ${organizationId || "all"}, policy: ${policyId || "all"})...`,
  );

  const createdEvents = [];

  try {
    const policyQuery = { isActive: true };
    if (organizationId) policyQuery.organization = organizationId;
    if (policyId) policyQuery._id = policyId;

    const activePolicies = await EscalationPolicy.find(policyQuery).lean();
    if (!activePolicies.length) {
      console.log("[EscalationService] No active policies found.");
      return { evaluatedCount: 0, eventsCreated: 0, events: [] };
    }

    const orgIds = activePolicies.map((p) => p.organization);

    // Find open action items that have a due date in the past
    const now = new Date();
    const itemQuery = {
      organization: { $in: orgIds },
      status: {
        $in: ["open", "in-progress", "pending", "in_progress", "overdue"],
      },
      dueDate: { $lt: now, $ne: null },
    };

    const overdueItems = await ActionItem.find(itemQuery)
      .populate("assignee")
      .lean();

    if (!overdueItems.length) {
      console.log(
        "[EscalationService] No overdue action items found for policies.",
      );
      return { evaluatedCount: 0, eventsCreated: 0, events: [] };
    }

    // Group policies by organization for quick lookup
    const policiesByOrg = activePolicies.reduce((acc, policy) => {
      acc[policy.organization] = policy;
      return acc;
    }, {});

    // For each overdue item, evaluate the policy
    for (const item of overdueItems) {
      const policy = policiesByOrg[item.organization];
      if (!policy || !policy.steps || !policy.steps.length) continue;

      const hoursOverdue = (now - new Date(item.dueDate)) / (1000 * 60 * 60);

      // Sort steps by delayHours ascending
      const sortedSteps = [...policy.steps].sort(
        (a, b) => a.delayHours - b.delayHours,
      );

      // Find the most severe step that qualifies
      let stepToTrigger = null;
      let stepIndexToTrigger = -1;
      for (let i = 0; i < sortedSteps.length; i++) {
        if (hoursOverdue >= sortedSteps[i].delayHours) {
          stepToTrigger = sortedSteps[i];
          stepIndexToTrigger = i;
        }
      }

      if (!stepToTrigger) continue; // No step qualifies yet

      // Check if this step has already been triggered
      const existingEvent = await EscalationEvent.findOne({
        actionItem: item._id,
        policy: policy._id,
        stepIndex: stepIndexToTrigger,
      }).lean();

      if (existingEvent) continue; // Already triggered this step

      // Trigger the step!
      console.log(
        `[EscalationService] Triggering step ${stepIndexToTrigger} for item ${item._id}`,
      );

      let actionTaken = `Triggered step ${stepIndexToTrigger} (Delay: ${stepToTrigger.delayHours}h). `;
      let eventStatus = "success";
      let errorDetails = "";

      try {
        await executeStepAction(stepToTrigger, item, policy);
        actionTaken += `Action '${stepToTrigger.actionType}' executed successfully to '${stepToTrigger.targetRole}'.`;
      } catch (err) {
        console.error(
          `[EscalationService] Failed to execute step for item ${item._id}:`,
          err,
        );
        eventStatus = "failed";
        errorDetails = err.message || "Execution error";
        actionTaken += `Action '${stepToTrigger.actionType}' failed: ${err.message}`;
      }

      // Record the event
      const eventRecord = await EscalationEvent.create({
        actionItem: item._id,
        policy: policy._id,
        organization: item.organization,
        stepIndex: stepIndexToTrigger,
        actionTaken,
        status: eventStatus,
        errorDetails,
      });

      createdEvents.push(eventRecord);

      // Update item status if it wasn't overdue before
      if (item.status !== "overdue") {
        await ActionItem.updateOne({ _id: item._id }, { status: "overdue" });
      }
    }

    console.log(
      `[EscalationService] Escalation evaluation completed. ${createdEvents.length} events created.`,
    );
    return {
      evaluatedCount: overdueItems.length,
      eventsCreated: createdEvents.length,
      events: createdEvents,
    };
  } catch (error) {
    console.error("[EscalationService] Error in evaluateEscalations:", error);
    throw error;
  }
};

const executeStepAction = async (step, item, _policy) => {
  // Determine target users to notify or reassign
  let targetUserIds = [];

  if (step.targetRole === "owner" && item.assignee) {
    targetUserIds = [item.assignee._id];
  } else if (step.targetRole === "org_admin" || step.targetRole === "manager") {
    // Find org owner/admins
    const org = await Organization.findById(item.organization).lean();
    if (org) {
      targetUserIds.push(org.owner);
      const admins = org.members
        .filter((m) => m.role === "admin" && m.status === "active")
        .map((m) => m.userId);
      targetUserIds.push(...admins);
    }
  } else if (step.targetRole === "backupOwner" && step.backupOwner) {
    targetUserIds = [step.backupOwner];
  }

  // Remove duplicates and falsy values
  targetUserIds = [...new Set(targetUserIds.filter(Boolean))].map((id) =>
    id.toString(),
  );

  if (!targetUserIds.length) {
    throw new Error(`No target users found for role ${step.targetRole}`);
  }

  if (step.actionType === "notify") {
    for (const userId of targetUserIds) {
      await createNotification(
        userId,
        `Escalation: Overdue Action Item`,
        `Action Item "${item.text}" is overdue by ${step.delayHours} hours.`,
        "tasks",
        `/meetings/${item.sourceMeetingId}?actionItemId=${item._id}`,
        "View Action Item",
      );
    }
  } else if (step.actionType === "reassign") {
    // Reassign to the first valid target
    const newAssigneeId = targetUserIds[0];
    await ActionItem.updateOne({ _id: item._id }, { assignee: newAssigneeId });

    // Notify the new assignee
    await createNotification(
      newAssigneeId,
      `Escalation Reassignment`,
      `You have been assigned to an overdue Action Item "${item.text}".`,
      "tasks",
      `/meetings/${item.sourceMeetingId}?actionItemId=${item._id}`,
      "View Action Item",
    );
  }
};
