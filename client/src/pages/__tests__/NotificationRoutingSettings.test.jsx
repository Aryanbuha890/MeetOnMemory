import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NotificationRoutingSettings from "../../components/notifications/NotificationRoutingSettings.jsx";
import { notificationApi } from "../../services/notificationApi";

vi.mock("../../services/notificationApi", () => ({
  notificationApi: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("NotificationRoutingSettings Component", () => {
  const mockPreferences = {
    routingPreferences: {
      slaAlerts: { slack: true, email: true, inApp: true },
      comments: { slack: true, email: false, inApp: true },
      recaps: { slack: false, email: true, inApp: true },
    },
    batchThresholdMinutes: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    notificationApi.getPreferences.mockResolvedValue({
      data: { preferences: mockPreferences },
    });
    notificationApi.updatePreferences.mockResolvedValue({
      data: { success: true },
    });
  });

  it("fetches and displays preferences on mount", async () => {
    render(<NotificationRoutingSettings />);

    expect(screen.getByText("Loading settings...")).toBeDefined();

    await waitFor(() => {
      expect(
        screen.getByText("Notification Channel Routing Settings"),
      ).toBeDefined();
    });

    expect(screen.getByDisplayValue("5")).toBeDefined();
  });

  it("sends API request when channel toggles are clicked", async () => {
    render(<NotificationRoutingSettings />);

    await waitFor(() => {
      expect(
        screen.getByText("Notification Channel Routing Settings"),
      ).toBeDefined();
    });

    // Toggle comments email setting (originally false, should become true)
    const toggleBtn = screen.getByTestId("toggle-comments-email");
    fireEvent.click(toggleBtn);

    expect(notificationApi.updatePreferences).toHaveBeenCalledWith({
      routingPreferences: expect.objectContaining({
        comments: expect.objectContaining({
          email: true,
        }),
      }),
    });
  });

  it("updates batch threshold limit value and triggers API update", async () => {
    render(<NotificationRoutingSettings />);

    await waitFor(() => {
      expect(
        screen.getByText("Notification Channel Routing Settings"),
      ).toBeDefined();
    });

    const thresholdInput = screen.getByTestId("batch-threshold-input");
    fireEvent.change(thresholdInput, { target: { value: "15" } });

    expect(notificationApi.updatePreferences).toHaveBeenCalledWith({
      batchThresholdMinutes: 15,
    });
  });
});
