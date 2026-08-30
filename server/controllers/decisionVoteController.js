import Decision from "../models/decisionModel.js";
import DecisionVote from "../models/decisionVoteModel.js";
import {
  calculateConsensus,
  getRoleWeight,
} from "../services/decisionConsensusService.js";

export const castVote = async (req, res, next) => {
  try {
    const { decisionId } = req.params;
    const { vote } = req.body;
    const userId = req.user._id || req.user.id;

    if (!["approve", "reject", "abstain"].includes(vote)) {
      return res.status(400).json({
        success: false,
        message: "Vote must be one of: approve, reject, abstain",
      });
    }

    const decision = await Decision.findById(decisionId);
    if (!decision) {
      return res
        .status(404)
        .json({ success: false, message: "Decision not found" });
    }

    const role = req.user.role || "member";
    const weight = getRoleWeight(role);

    // Save or update vote
    await DecisionVote.findOneAndUpdate(
      { decisionId, userId },
      { $set: { vote, weight } },
      { new: true, upsert: true },
    );

    // Dynamic consensus recalculation
    const consensusResult = await calculateConsensus(decisionId);

    res.status(200).json({
      success: true,
      message: "Vote cast successfully",
      consensus: consensusResult,
    });
  } catch (error) {
    next(error);
  }
};

export const getConsensus = async (req, res, next) => {
  try {
    const { decisionId } = req.params;

    const decision = await Decision.findById(decisionId);
    if (!decision) {
      return res
        .status(404)
        .json({ success: false, message: "Decision not found" });
    }

    const consensusResult = await calculateConsensus(decisionId);

    res.status(200).json({
      success: true,
      data: consensusResult,
    });
  } catch (error) {
    next(error);
  }
};

export const getMeetingDecisionsConsensus = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const decisions = await Decision.find({
      sourceMeetingId: meetingId,
    }).lean();

    const data = [];
    for (const dec of decisions) {
      const consensusResult = await calculateConsensus(dec._id);
      data.push({
        decision: dec,
        consensus: consensusResult,
      });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
