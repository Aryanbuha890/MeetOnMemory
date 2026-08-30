import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DecisionVotingPanel from "../DecisionVotingPanel.jsx";
import decisionVoteApi from "../../../services/decisionVoteApi";

vi.mock("../../../services/decisionVoteApi", () => ({
  decisionVoteApi: {
    getMeetingDecisionsConsensus: vi.fn(),
    castVote: vi.fn(),
  },
  default: {
    getMeetingDecisionsConsensus: vi.fn(),
    castVote: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DecisionVotingPanel Component", () => {
  const mockDecisions = [
    {
      decision: {
        _id: "dec123",
        text: "Switch production to Kubernetes cluster",
      },
      consensus: {
        consensusRate: 80,
        threshold: 60,
        status: "passed",
        stats: { approve: 4, reject: 1, abstain: 0 },
        votes: [
          { userId: "user1", vote: "approve" },
          { userId: "user2", vote: "reject" },
        ],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    decisionVoteApi.getMeetingDecisionsConsensus.mockResolvedValue({
      success: true,
      data: mockDecisions,
    });
    decisionVoteApi.castVote.mockResolvedValue({
      success: true,
    });
  });

  it("fetches and renders decision consensus data on mount", async () => {
    render(<DecisionVotingPanel meetingId="meet123" />);

    expect(screen.getByText("Loading decision consensus...")).toBeDefined();

    await waitFor(() => {
      expect(
        screen.getByText("Collaborative Decision Consensus"),
      ).toBeDefined();
    });

    expect(
      screen.getByText("Switch production to Kubernetes cluster"),
    ).toBeDefined();
    expect(screen.getByText("Consensus Passed")).toBeDefined();
    expect(screen.getByText("Consensus: 80% (Req: 60%)")).toBeDefined();
  });

  it("sends API cast vote request when voting action buttons are clicked", async () => {
    render(<DecisionVotingPanel meetingId="meet123" />);

    await waitFor(() => {
      expect(
        screen.getByText("Collaborative Decision Consensus"),
      ).toBeDefined();
    });

    const approveBtn = screen.getByTestId("vote-approve-dec123");
    fireEvent.click(approveBtn);

    expect(decisionVoteApi.castVote).toHaveBeenCalledWith("dec123", "approve");
  });
});
