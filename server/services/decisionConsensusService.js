import Decision from "../models/decisionModel.js";
import DecisionVote from "../models/decisionVoteModel.js";
import AuditLog from "../models/auditLogModel.js";

export const getRoleWeight = (role) => {
  switch (role) {
    case "owner":
      return 3;
    case "admin":
      return 3;
    case "moderator":
      return 2;
    case "member":
      return 1;
    case "guest":
      return 0.5;
    default:
      return 1;
  }
};

export const calculateConsensus = async (decisionId) => {
  const decision = await Decision.findById(decisionId);
  if (!decision) {
    throw new Error("Decision not found");
  }

  const votes = await DecisionVote.find({ decisionId }).populate("userId");
  const threshold = decision.consensusThreshold || 60;

  let approveWeighted = 0;
  let rejectWeighted = 0;
  let abstainWeighted = 0;
  let vetoed = false;

  const voteDetails = votes.map((v) => {
    const role = v.userId?.role || "member";
    const weight = getRoleWeight(role);

    if (v.vote === "approve") {
      approveWeighted += weight;
    } else if (v.vote === "reject") {
      rejectWeighted += weight;
      if (role === "owner" || role === "admin") {
        vetoed = true;
      }
    } else if (v.vote === "abstain") {
      abstainWeighted += weight;
    }

    return {
      userId: v.userId?._id,
      name: v.userId?.name,
      role,
      vote: v.vote,
      weight,
    };
  });

  const totalWeighted = approveWeighted + rejectWeighted;
  const consensusRate =
    totalWeighted > 0 ? (approveWeighted / totalWeighted) * 100 : 0;

  let consensusStatus = "open";
  if (votes.length > 0) {
    if (vetoed) {
      consensusStatus = "vetoed";
    } else if (consensusRate >= threshold) {
      consensusStatus = "passed";
    } else {
      consensusStatus = "failed";
    }
  }

  const oldStatus = decision.status;
  decision.status = consensusStatus;
  await decision.save();

  if (consensusStatus === "passed" && oldStatus !== "passed") {
    try {
      const orgId = decision.organization;
      if (orgId) {
        const firstApprove = votes.find((v) => v.vote === "approve");
        await AuditLog.create({
          organization: orgId,
          actor: firstApprove?.userId?._id || decision.organization,
          action: "DECISION_CONSENSUS_PASSED",
          entity: "Decision",
          entityId: decision._id,
          details: {
            title: decision.text,
            consensusRate,
            threshold,
            votesCount: votes.length,
          },
        });
      }
    } catch (auditErr) {
      console.error("Error creating decision consensus audit log:", auditErr);
    }
  }

  return {
    decisionId,
    consensusRate,
    threshold,
    status: consensusStatus,
    vetoed,
    stats: {
      approve: approveWeighted,
      reject: rejectWeighted,
      abstain: abstainWeighted,
      totalVotes: votes.length,
    },
    votes: voteDetails,
  };
};
