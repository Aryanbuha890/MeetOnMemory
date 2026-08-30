// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EscalationDashboard from "../EscalationDashboard";
import AppContent from "../../context/AppContent";
import * as escalationApi from "../../services/escalationApi";

vi.mock("../../services/escalationApi", () => ({
  getEscalationDashboardMetrics: vi.fn(),
  getPolicies: vi.fn(),
  getEscalationHistory: vi.fn(),
  createPolicy: vi.fn(),
  updatePolicy: vi.fn(),
  deletePolicy: vi.fn(),
  triggerManualEscalation: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("EscalationDashboard Run History & Manual Trigger UI (#2456)", () => {
  const mockAdminUser = {
    _id: "u_admin",
    role: "admin",
    organization: "org_100",
  };

  const mockMemberUser = {
    _id: "u_member",
    role: "member",
    organization: "org_100",
  };

  const mockMetrics = {
    metrics: {
      totalEscalated: 5,
      activeEscalated: 2,
      resolvedEscalated: 3,
      resolutionRate: 60,
    },
    activeEscalatedItems: [
      {
        _id: "item_1",
        text: "Overdue Security Patch",
        dueDate: "2026-08-20T00:00:00.000Z",
        status: "overdue",
        assignee: { name: "Bob" },
      },
    ],
  };

  const mockPolicies = [
    {
      _id: "policy_1",
      name: "Critical Escalation",
      isActive: true,
      steps: [{ delayHours: 24, actionType: "notify", targetRole: "manager" }],
    },
  ];

  const mockHistory = [
    {
      _id: "event_1",
      policy: { name: "Critical Escalation" },
      actionItem: { text: "Overdue Security Patch", sourceMeetingId: "m_1" },
      stepIndex: 0,
      status: "success",
      actionTaken: "Triggered step 0. Action 'notify' executed.",
      triggeredAt: "2026-08-27T10:00:00.000Z",
    },
    {
      _id: "event_2",
      policy: { name: "Critical Escalation" },
      actionItem: { text: "Fix database index", sourceMeetingId: "m_2" },
      stepIndex: 1,
      status: "failed",
      actionTaken: "Triggered step 1 failed.",
      errorDetails: "No target user found for role manager",
      triggeredAt: "2026-08-27T11:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    escalationApi.getEscalationDashboardMetrics.mockResolvedValue(mockMetrics);
    escalationApi.getPolicies.mockResolvedValue(mockPolicies);
    escalationApi.getEscalationHistory.mockResolvedValue(mockHistory);
  });

  const renderDashboard = (userData = mockAdminUser) => {
    return render(
      <AppContent.Provider value={{ userData }}>
        <EscalationDashboard />
      </AppContent.Provider>,
    );
  };

  it("renders metrics, active items, policies, and run history audit trail", async () => {
    renderDashboard(mockAdminUser);

    await waitFor(() => {
      expect(screen.getByText("Escalation Dashboard")).toBeInTheDocument();
      expect(screen.getAllByText("Critical Escalation")[0]).toBeInTheDocument();
      expect(
        screen.getAllByText("Overdue Security Patch")[0],
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Escalation Run History & Audit Trail"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fix database index")).toBeInTheDocument();
    expect(
      screen.getByText("⚠️ No target user found for role manager"),
    ).toBeInTheDocument();
  });

  it("restricts manual trigger button for non-admin users", async () => {
    renderDashboard(mockMemberUser);

    await waitFor(() => {
      expect(screen.getByTestId("manual-trigger-btn")).toBeInTheDocument();
    });

    const triggerBtn = screen.getByTestId("manual-trigger-btn");
    expect(triggerBtn).toBeDisabled();
    expect(screen.getByText("Admin Only")).toBeInTheDocument();
  });

  it("opens confirmation modal and triggers manual escalation for admin user", async () => {
    escalationApi.triggerManualEscalation.mockResolvedValue({
      success: true,
      message: "Manual escalation evaluation completed successfully.",
      result: { eventsCreated: 2 },
    });

    renderDashboard(mockAdminUser);

    await waitFor(() => {
      expect(screen.getByTestId("manual-trigger-btn")).toBeInTheDocument();
    });

    // Click Trigger Manual Run button
    fireEvent.click(screen.getByTestId("manual-trigger-btn"));

    // Confirmation modal appears
    expect(screen.getByText("Confirm Manual Run")).toBeInTheDocument();

    // Confirm trigger
    fireEvent.click(screen.getByTestId("confirm-trigger-btn"));

    await waitFor(() => {
      expect(escalationApi.triggerManualEscalation).toHaveBeenCalledWith({
        organizationId: "org_100",
      });
    });
  });
});
