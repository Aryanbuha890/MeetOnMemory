import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AiMeetingNotesDashboard from "../AiMeetingNotesDashboard.jsx";
import AppContent from "../../context/AppContent";
import { aiMeetingNoteApi } from "../../services/aiMeetingNoteApi";

vi.mock("../../services/aiMeetingNoteApi", () => ({
  aiMeetingNoteApi: {
    getAnalytics: vi.fn(),
    getNotes: vi.fn(),
    getTemplates: vi.fn(),
    getCrossMeetingActionItems: vi.fn(),
    generateAiNote: vi.fn(),
    toggleActionItemStatus: vi.fn(),
    reviewNote: vi.fn(),
    restoreVersion: vi.fn(),
  },
}));

const MOCK_ANALYTICS = {
  totalNotes: 12,
  averageQualityScore: 91.5,
  qualityBreakdown: {
    clarity: 92,
    completeness: 94,
    actionability: 88,
    decisionClarity: 92,
  },
  totalActionItems: 36,
  completedActionItems: 28,
  actionCompletionRate: 78,
  reviewStatusDistribution: {
    draft: 2,
    in_review: 3,
    reviewed: 4,
    approved: 3,
  },
  monthlyTrends: [
    {
      monthKey: "2026-03",
      label: "Mar 2026",
      count: 12,
      actionCount: 36,
    },
  ],
  topTags: [
    { name: "Executive", count: 5 },
    { name: "Product", count: 4 },
  ],
  typeDistribution: {
    executive: 5,
    product: 4,
    engineering: 3,
  },
};

const MOCK_NOTES = {
  notes: [
    {
      _id: "note-1",
      title: "H2 Engineering Strategy & Roadmap",
      meetingType: "engineering",
      reviewStatus: "approved",
      date: "2026-03-15T00:00:00.000Z",
      summary:
        "The team agreed on architecture milestones and decoupled the microservice data stores.",
      content:
        "## Summary\nDecoupled microservices.\n\n## Action Items\n- [ ] Finalize API contract",
      qualityScore: {
        overallScore: 94,
        clarity: 95,
        completeness: 96,
        actionability: 92,
        decisionClarity: 93,
      },
      actionItems: [
        {
          id: "act-1",
          task: "Finalize API contract for billing service",
          owner: "Lead Engineer",
          priority: "high",
          status: "pending",
          dueDate: "2026-03-25T00:00:00.000Z",
        },
      ],
      decisions: [
        {
          decision: "Adopt event-driven queues for notifications",
          impact: "Reduces server load by 40%",
        },
      ],
      version: 1,
      versionHistory: [],
    },
  ],
  pagination: { total: 1, page: 1, limit: 20, pages: 1 },
};

const MOCK_TEMPLATES = [
  {
    id: "executive",
    name: "Executive Briefing",
    category: "Leadership",
    description: "High-level strategic overview focusing on business impact.",
    structure: ["Executive Summary", "Strategic Alignment", "Key Decisions"],
  },
  {
    id: "product",
    name: "Product & Spec Review",
    category: "Product",
    description: "Detailed feature specification and user story walkthrough.",
    structure: ["Feature Objective", "User Stories", "Action Items"],
  },
];

const MOCK_CROSS_ACTIONS = {
  total: 1,
  completedCount: 0,
  pendingCount: 1,
  actionItems: [
    {
      id: "act-1",
      task: "Finalize API contract for billing service",
      owner: "Lead Engineer",
      priority: "high",
      status: "pending",
      noteId: "note-1",
      noteTitle: "H2 Engineering Strategy & Roadmap",
    },
  ],
};

const renderComponent = (userData = { organization: { _id: "org-123" } }) => {
  return render(
    <MemoryRouter>
      <AppContent.Provider value={{ userData, loading: false }}>
        <AiMeetingNotesDashboard />
      </AppContent.Provider>
    </MemoryRouter>,
  );
};

describe("AiMeetingNotesDashboard (#2381)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiMeetingNoteApi.getAnalytics.mockResolvedValue({
      success: true,
      data: MOCK_ANALYTICS,
    });
    aiMeetingNoteApi.getNotes.mockResolvedValue({
      success: true,
      data: MOCK_NOTES,
    });
    aiMeetingNoteApi.getTemplates.mockResolvedValue({
      success: true,
      data: MOCK_TEMPLATES,
    });
    aiMeetingNoteApi.getCrossMeetingActionItems.mockResolvedValue({
      success: true,
      data: MOCK_CROSS_ACTIONS,
    });
    aiMeetingNoteApi.generateAiNote.mockResolvedValue({
      success: true,
      data: {
        _id: "note-2",
        title: "Synthesized Sprint Note",
        meetingType: "general",
        reviewStatus: "draft",
        date: new Date().toISOString(),
        summary: "Synthesized summary",
        content: "## Notes\nSynthesized content",
        actionItems: [],
        decisions: [],
      },
    });
    aiMeetingNoteApi.toggleActionItemStatus.mockResolvedValue({
      success: true,
      data: { noteId: "note-1", action: { id: "act-1", status: "completed" } },
    });
  });

  it("renders header and summary KPI stats", async () => {
    renderComponent();

    expect(screen.getByText("AI Meeting Notes Dashboard")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/12/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/91\.5%/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/36/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/78%/).length).toBeGreaterThan(0);
    });
  });

  it("switches across all dashboard tabs", async () => {
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getAllByText("H2 Engineering Strategy & Roadmap").length,
      ).toBeGreaterThan(0);
    });

    // Switch to AI Generator tab
    fireEvent.click(screen.getByRole("button", { name: /AI Generator/i }));
    await waitFor(() => {
      expect(screen.getByText("AI Meeting Note Synthesis")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/e\.g\., Q3 Product Roadmap Alignment/i),
      ).toBeInTheDocument();
    });

    // Switch to Cross-Meeting Actions tab
    fireEvent.click(
      screen.getByRole("button", { name: /Cross-Meeting Actions/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText("Cross-Meeting Action Items Directory"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Finalize API contract for billing service"),
      ).toBeInTheDocument();
    });

    // Switch to Note Templates tab
    fireEvent.click(screen.getByRole("button", { name: /Note Templates/i }));
    await waitFor(() => {
      expect(screen.getByText("Executive Briefing")).toBeInTheDocument();
      expect(screen.getByText("Product & Spec Review")).toBeInTheDocument();
    });

    // Switch to Quality & Trends tab
    fireEvent.click(screen.getByRole("button", { name: /Quality & Trends/i }));
    await waitFor(() => {
      expect(screen.getByText("Monthly Notes Volume")).toBeInTheDocument();
      expect(
        screen.getByText("Quality Dimension Breakdown"),
      ).toBeInTheDocument();
    });
  });

  it("allows generating an AI note from the generator tab", async () => {
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /AI Generator/i }));
    await waitFor(() => {
      expect(screen.getByText("AI Meeting Note Synthesis")).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText(
      /e\.g\., Q3 Product Roadmap Alignment/i,
    );
    fireEvent.change(titleInput, {
      target: { value: "Synthesized Sprint Note" },
    });

    const submitBtn = screen.getByRole("button", {
      name: /Generate Structured Notes/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(aiMeetingNoteApi.generateAiNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Synthesized Sprint Note",
        }),
      );
    });
  });
});
