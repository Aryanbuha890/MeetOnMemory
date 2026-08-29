// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import NudgeInbox from "../NudgeInbox.jsx";
import { getMyNudges, updateNudgeStatus } from "../../api/meetingNudgeApi.js";

vi.mock("../../api/meetingNudgeApi.js", () => ({
  getMyNudges: vi.fn(),
  updateNudgeStatus: vi.fn(),
}));

const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("NudgeInbox Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton state initially", async () => {
    getMyNudges.mockReturnValue(new Promise(() => {})); // Never resolves during test

    renderWithRouter(<NudgeInbox organizationId="org123" />);

    expect(screen.getByTestId("nudge-inbox-loading")).toBeInTheDocument();
  });

  it("renders error state when fetching fails and handles retry", async () => {
    getMyNudges.mockRejectedValueOnce(new Error("Network Error"));

    renderWithRouter(<NudgeInbox organizationId="org123" />);

    await waitFor(() => {
      expect(screen.getByTestId("nudge-inbox-error")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Failed to load preparation nudges."),
    ).toBeInTheDocument();

    getMyNudges.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByTestId("nudge-inbox-retry-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("nudge-inbox-empty")).toBeInTheDocument();
    });
  });

  it("renders empty state when no nudges are returned", async () => {
    getMyNudges.mockResolvedValue([]);

    renderWithRouter(<NudgeInbox organizationId="org123" />);

    await waitFor(() => {
      expect(screen.getByTestId("nudge-inbox-empty")).toBeInTheDocument();
    });

    expect(screen.getByText("All Caught Up!")).toBeInTheDocument();
  });

  it("renders pending nudges with correct /meeting/:id links", async () => {
    const mockNudges = [
      {
        _id: "nudge1",
        meetingId: { _id: "m123", title: "Product Architecture Review" },
        nudgeType: "UNRESOLVED_ACTION_ITEMS",
        context: { count: 3 },
      },
    ];

    getMyNudges.mockResolvedValue(mockNudges);

    renderWithRouter(<NudgeInbox organizationId="org123" />);

    await waitFor(() => {
      expect(screen.getByTestId("nudge-inbox")).toBeInTheDocument();
    });

    const link = screen.getByText("Product Architecture Review");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/meeting/m123");
    expect(
      screen.getByText(/You have 3 unresolved action items to complete/i),
    ).toBeInTheDocument();
  });

  it("handles mark as done and dismiss actions", async () => {
    const mockNudges = [
      {
        _id: "nudge1",
        meetingId: { _id: "m123", title: "Product Sync" },
        nudgeType: "AGENDA_REVIEW",
      },
    ];

    getMyNudges.mockResolvedValue(mockNudges);
    updateNudgeStatus.mockResolvedValue({ success: true });

    renderWithRouter(<NudgeInbox organizationId="org123" />);

    await waitFor(() => {
      expect(screen.getByText("Product Sync")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Mark as Done"));

    await waitFor(() => {
      expect(updateNudgeStatus).toHaveBeenCalledWith("nudge1", "ACTED_ON");
      expect(screen.getByTestId("nudge-inbox-empty")).toBeInTheDocument();
    });
  });
});
