import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingROIDashboard from "../MeetingROIDashboard.jsx";
import AppContent from "../../context/AppContent";
import { meetingROIApi } from "../../services/meetingROIApi";

vi.mock("../../services/meetingROIApi", () => ({
  meetingROIApi: {
    getROIDashboardSummary: vi.fn(),
    getROIRecords: vi.fn(),
    createROIRecord: vi.fn(),
    updateROIRecord: vi.fn(),
    deleteROIRecord: vi.fn(),
    simulateWhatIf: vi.fn(),
  },
}));

const MOCK_SUMMARY = {
  summary: {
    totalMeetings: 8,
    totalCost: 2800,
    totalLaborCost: 2400,
    totalDirectCost: 400,
    totalDecisionValue: 8400,
    netValue: 5600,
    averageROI: 200,
    positiveROICount: 7,
    positiveROIPercentage: 87.5,
    averageQualityScore: 4.4,
  },
  roiByType: [
    {
      type: "strategy",
      meetingCount: 3,
      totalCost: 1200,
      decisionValue: 5000,
      netValue: 3800,
      avgROI: 316.7,
      avgQuality: 4.7,
    },
    {
      type: "standup",
      meetingCount: 5,
      totalCost: 1600,
      decisionValue: 3400,
      netValue: 1800,
      avgROI: 112.5,
      avgQuality: 4.2,
    },
  ],
  monthlyTrends: [
    {
      monthKey: "2026-03",
      label: "Mar 2026",
      meetingCount: 8,
      totalCost: 2800,
      decisionValue: 8400,
      netValue: 5600,
      avgROI: 200,
    },
  ],
  costBreakdown: {
    laborCost: 2400,
    directCosts: {
      venue: 200,
      softwareLicenses: 100,
      refreshments: 100,
      materialsAndEquipment: 0,
      externalConsultants: 0,
      other: 0,
    },
    totalCost: 2800,
    laborPercentage: 86,
    directPercentage: 14,
  },
  qualityMetrics: {
    avgEfficiencyRating: 4.4,
    avgGoalAchievementRate: 90,
    avgEngagementScore: 88,
    avgDecisionSpeedMinutes: 18,
    totalActionItems: 24,
    completedActionItems: 20,
    completionRate: 83,
  },
  topPerformers: [
    {
      _id: "rec-1",
      title: "H2 Strategic Architecture Alignment",
      meetingType: "strategy",
      date: "2026-03-10T00:00:00.000Z",
      durationMinutes: 60,
      attendeeCount: 5,
      totalMeetingCost: 400,
      decisionValue: 2500,
      netValue: 2100,
      roiPercentage: 525,
    },
  ],
  lowestPerformers: [
    {
      _id: "rec-2",
      title: "Ad-hoc Sync",
      meetingType: "standup",
      date: "2026-03-12T00:00:00.000Z",
      durationMinutes: 45,
      attendeeCount: 6,
      totalMeetingCost: 350,
      decisionValue: 100,
      netValue: -250,
      roiPercentage: -71.4,
    },
  ],
  benchmarks: {
    industryAverageROI: 145,
    industryAvgCostPerAttendeeHour: 68,
    industryDecisionRealizationRate: 74,
    industryQualityScore: 4.1,
  },
  recommendations: [
    {
      id: "rec-neg-roi",
      type: "warning",
      title: "Mitigate Low Decision Value in Recurring Sessions",
      description: "Shift status-updates to asynchronous digests.",
      potentialSavings: "$250",
    },
  ],
};

const MOCK_RECORDS = {
  records: [
    {
      _id: "rec-1",
      title: "H2 Strategic Architecture Alignment",
      meetingType: "strategy",
      date: "2026-03-10T00:00:00.000Z",
      durationMinutes: 60,
      attendeeCount: 5,
      avgHourlyRate: 80,
      totalMeetingCost: 400,
      decisionValue: 2500,
      roiPercentage: 525,
      netValue: 2100,
    },
  ],
  pagination: {
    total: 1,
    page: 1,
    limit: 10,
    pages: 1,
  },
};

const renderComponent = (userData = { organization: { _id: "org-123" } }) => {
  return render(
    <MemoryRouter>
      <AppContent.Provider value={{ userData, loading: false }}>
        <MeetingROIDashboard />
      </AppContent.Provider>
    </MemoryRouter>,
  );
};

describe("MeetingROIDashboard (#2383)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingROIApi.getROIDashboardSummary.mockResolvedValue({
      success: true,
      data: MOCK_SUMMARY,
    });
    meetingROIApi.getROIRecords.mockResolvedValue({
      success: true,
      data: MOCK_RECORDS,
    });
    meetingROIApi.simulateWhatIf.mockResolvedValue({
      success: true,
      data: {
        singleMeeting: {
          totalCost: 195,
          decisionValue: 1200,
          netValue: 1005,
          roiPercentage: 515.4,
        },
        monthlyProjection: {
          projectedCost: 780,
          projectedDecisionValue: 4800,
          projectedNetValue: 4020,
          projectedROI: 515.4,
          costSavingsVsBaseline: 780,
        },
      },
    });
  });

  it("renders dashboard title and summary KPI statistics", async () => {
    renderComponent();

    expect(screen.getByText("Meeting ROI Dashboard")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("$2,800").length).toBeGreaterThan(0);
      expect(screen.getAllByText("$8,400").length).toBeGreaterThan(0);
      expect(screen.getByText("+$5,600")).toBeInTheDocument();
      expect(screen.getAllByText(/200%/).length).toBeGreaterThan(0);
    });
  });

  it("allows switching between navigation tabs", async () => {
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("Monthly Financial ROI Trends"),
      ).toBeInTheDocument();
    });

    // Switch to Top & Lowest Performers tab
    fireEvent.click(screen.getByRole("button", { name: /Top & Lowest ROI/i }));
    await waitFor(() => {
      expect(
        screen.getByText("Top Performing Meetings (High ROI)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Lowest & Negative ROI Meetings (Optimization Targets)",
        ),
      ).toBeInTheDocument();
    });

    // Switch to Industry Benchmarks tab
    fireEvent.click(
      screen.getByRole("button", { name: /Industry Benchmarks/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText("Industry Benchmark Comparisons"),
      ).toBeInTheDocument();
    });

    // Switch to What-If Simulator tab
    fireEvent.click(screen.getByRole("button", { name: /What-If Simulator/i }));
    await waitFor(() => {
      expect(
        screen.getByText("What-If Meeting ROI Simulator"),
      ).toBeInTheDocument();
    });

    // Switch to Smart Recommendations tab
    fireEvent.click(
      screen.getByRole("button", { name: /Smart Recommendations/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText("Mitigate Low Decision Value in Recurring Sessions"),
      ).toBeInTheDocument();
    });

    // Switch to ROI Records Directory tab
    fireEvent.click(
      screen.getByRole("button", { name: /ROI Records Directory/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText("H2 Strategic Architecture Alignment"),
      ).toBeInTheDocument();
    });
  });

  it("opens add ROI record modal when clicking button", async () => {
    renderComponent();

    const addBtn = screen.getByRole("button", { name: /Add ROI Record/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("Add Meeting ROI Record")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/e\.g\., Executive Strategy Alignment/i),
    ).toBeInTheDocument();
  });
});
