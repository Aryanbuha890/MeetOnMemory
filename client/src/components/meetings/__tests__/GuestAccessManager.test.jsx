import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GuestAccessManager from "../GuestAccessManager.jsx";
import * as guestAccessApi from "../../../services/guestAccessApi.js";

vi.mock("../../../services/guestAccessApi.js", () => ({
  getHostAnalytics: vi.fn(),
  exportFeedbackCSV: vi.fn(),
  createGuestToken: vi.fn(),
  revokeGuestToken: vi.fn(),
  getMeetingGuestTokens: vi.fn(),
}));

const mockAnalyticsData = {
  metrics: {
    totalViews: 42,
    totalJoins: 18,
    feedbackCount: 3,
  },
  tokens: [
    {
      id: "token-1",
      token: "secret-key-abc-123",
      guestEmail: "reviewer@client.com",
      label: "Client Security Reviewer",
      createdAt: "2026-10-01T09:00:00.000Z",
      lastUsedAt: "2026-10-01T10:30:00.000Z",
      isActive: true,
      currentViews: 5,
      viewCount: 5,
      maxViews: 10,
      joinCount: 2,
    },
    {
      id: "token-2",
      token: "secret-key-xyz-789",
      guestEmail: "auditor@external.org",
      label: "Audit Token",
      createdAt: "2026-09-20T09:00:00.000Z",
      lastUsedAt: null,
      isActive: false,
      currentViews: 0,
      viewCount: 0,
      maxViews: 1,
      joinCount: 0,
    },
  ],
  feedback: [
    {
      id: "fb-1",
      guestName: "Alice Auditor",
      guestEmail: "reviewer@client.com",
      rating: 5,
      comments: "Exceptional clarity in the technical breakdown.",
      createdAt: "2026-10-01T11:00:00.000Z",
    },
  ],
};

describe("GuestAccessManager Component (#2454)", () => {
  const mockMeetingId = "meeting-123";

  beforeEach(() => {
    vi.clearAllMocks();
    guestAccessApi.getHostAnalytics.mockResolvedValue(mockAnalyticsData);
    guestAccessApi.createGuestToken.mockResolvedValue({
      token: "new-generated-token-999",
    });
    guestAccessApi.revokeGuestToken.mockResolvedValue({
      message: "Token revoked successfully",
    });
    guestAccessApi.exportFeedbackCSV.mockResolvedValue(new Blob());
  });

  it("renders the host analytics header and numerical telemetry metric cards", async () => {
    render(<GuestAccessManager meetingId={mockMeetingId} />);

    expect(
      screen.getByText(/External Token Analytics & Guest Access/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("total-views-value")).toHaveTextContent("42");
      expect(screen.getByTestId("total-joins-value")).toHaveTextContent("18");
      expect(screen.getByTestId("total-feedback-value")).toHaveTextContent("3");
    });
  });

  it("renders token distribution history with label, last used metadata, and active badges", async () => {
    render(<GuestAccessManager meetingId={mockMeetingId} />);

    await waitFor(() => {
      const row1 = screen.getByTestId("token-row-token-1");
      expect(row1).toBeInTheDocument();
      expect(row1).toHaveTextContent("Client Security Reviewer");
      expect(row1).toHaveTextContent("secret-key-abc-123");
      expect(row1).toHaveTextContent("Active");

      const row2 = screen.getByTestId("token-row-token-2");
      expect(row2).toBeInTheDocument();
      expect(row2).toHaveTextContent("Audit Token");
      expect(row2).toHaveTextContent("Revoked");
      expect(row2).toHaveTextContent("Never");
    });
  });

  it("renders peer feedback loop list with rating and comments", async () => {
    render(<GuestAccessManager meetingId={mockMeetingId} />);

    await waitFor(() => {
      const fbItem = screen.getByTestId("feedback-item-fb-1");
      expect(fbItem).toBeInTheDocument();
      expect(fbItem).toHaveTextContent("Alice Auditor");
      expect(fbItem).toHaveTextContent("⭐️ 5/5");
      expect(fbItem).toHaveTextContent(
        "Exceptional clarity in the technical breakdown.",
      );
    });
  });

  it("triggers CSV export when clicking Export Feedback CSV button", async () => {
    render(<GuestAccessManager meetingId={mockMeetingId} />);

    const exportBtn = screen.getByTestId("export-feedback-csv-btn");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(guestAccessApi.exportFeedbackCSV).toHaveBeenCalledWith(
        mockMeetingId,
      );
    });
  });

  it("revokes an active token upon clicking the Revoke button", async () => {
    render(<GuestAccessManager meetingId={mockMeetingId} />);

    await waitFor(() => {
      expect(screen.getByTestId("revoke-token-token-1")).toBeInTheDocument();
    });

    const revokeBtn = screen.getByTestId("revoke-token-token-1");
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(guestAccessApi.revokeGuestToken).toHaveBeenCalledWith("token-1");
    });
  });

  it("generates a new guest link via create form", async () => {
    render(<GuestAccessManager meetingId={mockMeetingId} />);

    const toggleFormBtn = screen.getByTestId("toggle-create-token-btn");
    fireEvent.click(toggleFormBtn);

    expect(
      screen.getByText(/Generate Secure Guest Access Key/i),
    ).toBeInTheDocument();

    const emailInput = screen.getByTestId("guest-email-input");
    const labelInput = screen.getByTestId("guest-label-input");
    const expiryInput = screen.getByTestId("guest-expiry-input");

    fireEvent.change(emailInput, {
      target: { value: "partner@external.com" },
    });
    fireEvent.change(labelInput, {
      target: { value: "Partner Access" },
    });
    fireEvent.change(expiryInput, {
      target: { value: "2026-10-15T12:00" },
    });

    const submitBtn = screen.getByTestId("submit-create-token-btn");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(guestAccessApi.createGuestToken).toHaveBeenCalledWith(
        mockMeetingId,
        expect.objectContaining({
          guestEmail: "partner@external.com",
          label: "Partner Access",
          expiresAt: "2026-10-15T12:00",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("copy-link-btn")).toBeInTheDocument();
      expect(screen.getByText(/new-generated-token-999/i)).toBeInTheDocument();
    });
  });
});
