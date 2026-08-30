import ActionItem from "../models/actionItemModel.js";
import Membership from "../models/membershipModel.js";
import { generateText } from "./GenerativeAIService.js";
import { logActivity } from "./activityService.js";

class WorkloadService {
  /**
   * Get the current workload for all members in an organization.
   * Groups open/in-progress action items by assignee.
   */
  static async getWorkload(organizationId) {
    const DEFAULT_CAPACITY = 10;

    // Get all organization members
    const memberships = await Membership.find({
      organization: organizationId,
      status: "active",
    }).populate("user", "name email avatarUrl");

    // Get all open action items for the organization
    const actionItems = await ActionItem.find({
      organization: organizationId,
      status: { $in: ["open", "in-progress"] },
    })
      .populate("assignee", "name email avatarUrl")
      .populate("sourceMeetingId", "title date")
      .lean();

    const memberMap = new Map();

    // Initialize all members with 0 workload
    memberships.forEach((m) => {
      if (m.user) {
        memberMap.set(m.user._id.toString(), {
          user: m.user,
          actionItems: [],
          loadScore: 0,
          capacity: DEFAULT_CAPACITY,
          role: m.role || "member",
          team: m.role ? `${m.role.toUpperCase()} Team` : "General Team",
        });
      }
    });

    // Assign action items to members
    actionItems.forEach((item) => {
      if (item.assignee) {
        const userId = item.assignee._id.toString();
        if (!memberMap.has(userId)) {
          memberMap.set(userId, {
            user: item.assignee,
            actionItems: [],
            loadScore: 0,
            capacity: DEFAULT_CAPACITY,
            role: "member",
            team: "General Team",
          });
        }

        const memberData = memberMap.get(userId);
        memberData.actionItems.push(item);

        let score = 1;
        if (item.priority === "high") score = 2;
        if (item.priority === "urgent") score = 3;
        memberData.loadScore += score;
      }
    });

    const workloads = Array.from(memberMap.values()).map((w) => {
      let status = "optimal";
      if (w.loadScore > w.capacity) status = "overloaded";
      else if (w.loadScore <= 2) status = "underloaded";
      return {
        ...w,
        status,
        itemCount: w.actionItems.length,
      };
    });

    return workloads;
  }

  /**
   * Suggest a workload rebalance using AI with a rule-based fallback.
   */
  static async suggestRebalance(organizationId) {
    const workloads = await this.getWorkload(organizationId);

    if (workloads.length === 0) {
      return {
        suggestions: [],
        message: "No active members found in organization.",
      };
    }

    // Calculate median load
    const loadScores = workloads.map((w) => w.loadScore).sort((a, b) => a - b);
    const medianLoad = loadScores[Math.floor((loadScores.length - 1) / 2)] || 0;

    const overloaded = workloads.filter(
      (w) => w.loadScore > medianLoad * 1.2 && w.loadScore > 2,
    );
    const underloaded = workloads.filter(
      (w) => w.loadScore <= medianLoad && w.actionItems.length < 5,
    );

    if (overloaded.length === 0 || underloaded.length === 0) {
      return {
        suggestions: [],
        message: "Workload is relatively balanced across team members.",
      };
    }

    let enrichedSuggestions = [];

    // Attempt AI-based recommendation first
    try {
      const prompt = `
You are an AI assistant helping a manager rebalance workload in an organization.
The following members are overloaded:
${overloaded.map((w) => `- ${w.user.name} (ID: ${w.user._id}): Load Score ${w.loadScore}`).join("\n")}

Their tasks:
${overloaded.map((w) => w.actionItems.map((a) => `Task: "${a.text}" | Priority: ${a.priority} | ID: ${a._id} | Assignee ID: ${w.user._id}`).join("\n")).join("\n")}

The following members have capacity:
${underloaded.map((w) => `- ${w.user.name} (ID: ${w.user._id}): Load Score ${w.loadScore}`).join("\n")}

Suggest 1-3 specific action item reassignments to balance the load.
Return the output as a JSON array of objects with the following keys exactly:
"actionItemId": (the string ID of the task)
"fromUserId": (the string ID of the current assignee)
"toUserId": (the string ID of the suggested new assignee)
"reason": (a brief explanation of why this reassignment makes sense)

Respond with ONLY valid JSON array. Do not include markdown formatting or extra text.
`;

      const responseText = await generateText(prompt, "system");
      if (responseText) {
        const cleanedText = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        const suggestions = JSON.parse(cleanedText);

        if (Array.isArray(suggestions)) {
          enrichedSuggestions = suggestions
            .map((s) => {
              let item = null;
              overloaded.forEach((w) => {
                const found = w.actionItems.find(
                  (a) => a._id.toString() === String(s.actionItemId),
                );
                if (found) item = found;
              });
              const fromUser = workloads.find(
                (w) => w.user._id.toString() === String(s.fromUserId),
              )?.user;
              const toUser = workloads.find(
                (w) => w.user._id.toString() === String(s.toUserId),
              )?.user;

              return {
                ...s,
                item,
                fromUser,
                toUser,
              };
            })
            .filter((s) => s.item && s.fromUser && s.toUser);
        }
      }
    } catch (error) {
      console.warn(
        "AI rebalance suggestion failed, resorting to heuristic fallback:",
        error.message,
      );
    }

    // Heuristic Fallback if AI produces no suggestions or fails
    if (enrichedSuggestions.length === 0) {
      const sortedOverloaded = [...overloaded].sort(
        (a, b) => b.loadScore - a.loadScore,
      );
      const sortedUnderloaded = [...underloaded].sort(
        (a, b) => a.loadScore - b.loadScore,
      );

      for (const over of sortedOverloaded) {
        if (sortedUnderloaded.length === 0) break;
        const targetUnder = sortedUnderloaded[0];

        // Pick a non-urgent item if possible
        const itemToReassign =
          over.actionItems.find((i) => i.priority !== "urgent") ||
          over.actionItems[0];

        if (
          itemToReassign &&
          over.user._id.toString() !== targetUnder.user._id.toString()
        ) {
          enrichedSuggestions.push({
            actionItemId: itemToReassign._id.toString(),
            fromUserId: over.user._id.toString(),
            toUserId: targetUnder.user._id.toString(),
            reason: `Rebalance workload: Reassigning task from overloaded ${over.user.name} (Load: ${over.loadScore}) to ${targetUnder.user.name} (Load: ${targetUnder.loadScore}).`,
            item: itemToReassign,
            fromUser: over.user,
            toUser: targetUnder.user,
          });
          // Avoid duplicate suggestions for the same item
          if (enrichedSuggestions.length >= 3) break;
        }
      }
    }

    return {
      suggestions: enrichedSuggestions,
      message:
        enrichedSuggestions.length > 0
          ? "Rebalance suggestions generated successfully."
          : "Workload is relatively balanced across team members.",
    };
  }

  /**
   * Execute batch reassignments
   */
  static async executeRebalance(organizationId, reassignments, actorId, io) {
    if (!reassignments || !Array.isArray(reassignments)) {
      throw new Error("Invalid reassignments array.");
    }

    const results = [];
    for (const req of reassignments) {
      const { actionItemId, toUserId } = req;
      if (!actionItemId || !toUserId) {
        results.push({
          actionItemId,
          status: "error",
          error: "Missing parameters",
        });
        continue;
      }

      try {
        const item = await ActionItem.findOne({
          _id: actionItemId,
          organization: organizationId,
        });
        if (!item) {
          results.push({
            actionItemId,
            status: "error",
            error: "Action item not found",
          });
          continue;
        }

        const oldAssignee = item.assignee;
        item.assignee = toUserId;
        await item.save();

        if (io) {
          await logActivity(
            io,
            organizationId,
            actorId,
            "actionItem.reassigned",
            "ActionItem",
            item._id,
            item.text,
            { from: oldAssignee, to: toUserId },
          );
        }

        results.push({ actionItemId, status: "success" });
      } catch (e) {
        console.error(`Failed to reassign ${actionItemId}:`, e);
        results.push({ actionItemId, status: "error", error: e.message });
      }
    }
    return results;
  }
}

export default WorkloadService;
