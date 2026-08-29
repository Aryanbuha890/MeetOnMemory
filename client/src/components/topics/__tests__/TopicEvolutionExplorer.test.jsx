// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TopicEvolutionExplorer from "../TopicEvolutionExplorer.jsx";
import topicApi from "../../../services/topicApi.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../../services/topicApi.js", () => ({
  default: {
    getTopicEvolutionTimeline: vi.fn(),
  },
}));

describe("TopicEvolutionExplorer Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with initial empty state and fetches timeline data", async () => {
    topicApi.getTopicEvolutionTimeline.mockResolvedValue({
      data: {
        success: true,
        data: {
          queryTopic: "",
          availableTopics: ["Architecture", "Database Migration"],
          timeline: [],
          metrics: {
            totalMeetings: 0,
            totalDecisionsCount: 0,
            totalActionItemsCount: 0,
          },
        },
      },
    });

    render(<TopicEvolutionExplorer />);

    expect(screen.getByTestId("topic-evolution-explorer")).toBeInTheDocument();
    expect(
      screen.getByText("Cross-Meeting Topic Evolution Explorer"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(topicApi.getTopicEvolutionTimeline).toHaveBeenCalled();
    });

    expect(screen.getByText("Architecture")).toBeInTheDocument();
    expect(screen.getByText("Database Migration")).toBeInTheDocument();
  });

  it("renders chronological timeline nodes when data exists", async () => {
    const mockTimeline = [
      {
        meetingId: "m1",
        title: "Sprint Planning",
        date: "2026-02-01T10:00:00.000Z",
        participantCount: 5,
        topicsDiscussed: [{ name: "Architecture", cluster: "Engineering" }],
        decisions: [{ id: "d1", text: "Adopt microservices pattern" }],
        actionItems: [
          { id: "a1", text: "Draft RFP document", assignee: "Bob" },
        ],
        sentiment: "positive",
      },
    ];

    topicApi.getTopicEvolutionTimeline.mockResolvedValue({
      data: {
        success: true,
        data: {
          queryTopic: "Architecture",
          availableTopics: ["Architecture"],
          timeline: mockTimeline,
          metrics: {
            totalMeetings: 1,
            totalDecisionsCount: 1,
            totalActionItemsCount: 1,
          },
        },
      },
    });

    render(<TopicEvolutionExplorer initialTopic="Architecture" />);

    await waitFor(() => {
      expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
    });

    expect(screen.getByTestId("metric-meetings")).toHaveTextContent("1");
    expect(screen.getByTestId("metric-decisions")).toHaveTextContent("1");
    expect(screen.getByTestId("metric-actions")).toHaveTextContent("1");
    expect(
      screen.getByText("• Adopt microservices pattern"),
    ).toBeInTheDocument();
    expect(screen.getByText("• Draft RFP document")).toBeInTheDocument();
  });

  it("allows searching for a custom topic", async () => {
    topicApi.getTopicEvolutionTimeline.mockResolvedValue({
      data: {
        success: true,
        data: {
          queryTopic: "",
          availableTopics: [],
          timeline: [],
          metrics: {
            totalMeetings: 0,
            totalDecisionsCount: 0,
            totalActionItemsCount: 0,
          },
        },
      },
    });

    render(<TopicEvolutionExplorer />);

    const searchInput = screen.getByTestId("topic-search-input");
    fireEvent.change(searchInput, { target: { value: "Security Audit" } });

    const submitBtn = screen.getByTestId("topic-search-submit");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(topicApi.getTopicEvolutionTimeline).toHaveBeenCalledWith(
        "Security Audit",
        {
          startDate: "",
          endDate: "",
        },
      );
    });
  });

  it("switches to comparison view mode", async () => {
    topicApi.getTopicEvolutionTimeline.mockResolvedValue({
      data: {
        success: true,
        data: {
          queryTopic: "",
          availableTopics: [],
          timeline: [],
          metrics: {
            totalMeetings: 0,
            totalDecisionsCount: 0,
            totalActionItemsCount: 0,
          },
        },
      },
    });

    render(<TopicEvolutionExplorer />);

    await waitFor(() => {
      expect(topicApi.getTopicEvolutionTimeline).toHaveBeenCalled();
    });

    const compBtn = screen.getByTestId("view-comparison-btn");
    fireEvent.click(compBtn);

    expect(screen.getByTestId("select-meeting-a")).toBeInTheDocument();
    expect(screen.getByTestId("select-meeting-b")).toBeInTheDocument();
  });

  it("synthesizes topic journey AI summary when button is clicked", async () => {
    const mockTimeline = [
      {
        meetingId: "m1",
        title: "Sprint Planning",
        date: "2026-02-01T10:00:00.000Z",
        participantCount: 5,
        topicsDiscussed: [{ name: "Architecture", cluster: "Engineering" }],
        decisions: [{ id: "d1", text: "Adopt microservices pattern" }],
        actionItems: [],
        sentiment: "positive",
      },
    ];

    topicApi.getTopicEvolutionTimeline.mockResolvedValue({
      data: {
        success: true,
        data: {
          queryTopic: "Architecture",
          availableTopics: [],
          timeline: mockTimeline,
          metrics: {
            totalMeetings: 1,
            totalDecisionsCount: 1,
            totalActionItemsCount: 0,
          },
        },
      },
    });

    render(<TopicEvolutionExplorer initialTopic="Architecture" />);

    await waitFor(() => {
      expect(screen.getByTestId("synthesize-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("synthesize-btn"));

    await waitFor(() => {
      expect(
        screen.getByText(/AI Topic Journey Synthesis/i),
      ).toBeInTheDocument();
    });
  });
});
