import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AppContent from "../../../../context/AppContent";
import { useScheduleMeeting } from "../useScheduleMeeting";
import { focusTimeApi } from "../../../../api/focusTimeApi";
import { meetingApi } from "../../../../services";

vi.mock("../../../../api/focusTimeApi", () => ({
  focusTimeApi: {
    getBlocks: vi.fn(),
  },
}));

vi.mock("../../../../api/calendarAvailabilityApi", () => ({
  calendarAvailabilityApi: {
    getFreeBusy: vi.fn().mockResolvedValue({ calendars: {} }),
  },
}));

vi.mock("../../../../api/customFieldApi", () => ({
  customFieldApi: {
    setMeetingFields: vi.fn(),
  },
}));

vi.mock("../../../../services", () => ({
  meetingApi: {
    scheduleMeeting: vi.fn(),
  },
  meetingSeriesApi: {
    createSeries: vi.fn(),
  },
  meetingTemplateApi: {
    getTemplates: vi
      .fn()
      .mockResolvedValue({ data: { success: true, templates: [] } }),
  },
  aiSummaryTemplateApi: {
    getTemplates: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useScheduleMeeting Focus Conflict & Audit Note (#2067)", () => {
  const mockUserData = {
    _id: "user-123",
    organization: { _id: "org-456" },
  };

  const wrapper = ({ children }) => (
    <AppContent.Provider value={{ userData: mockUserData }}>
      {children}
    </AppContent.Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("warns user and includes auditNote on conflict scheduling", async () => {
    // Build focus block in local timezone so it overlaps meeting slot on any CI host
    const focusStart = new Date(2026, 7, 23, 10, 0, 0, 0);
    const focusEnd = new Date(2026, 7, 23, 12, 0, 0, 0);
    const focusBlock = {
      _id: "fb1",
      title: "Deep Work",
      startTime: focusStart.toISOString(),
      endTime: focusEnd.toISOString(),
      isRecurring: false,
    };
    focusTimeApi.getBlocks.mockResolvedValue([focusBlock]);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockReturnValue("Important override reason");

    const { result } = renderHook(() => useScheduleMeeting(), { wrapper });

    await waitFor(() => {
      expect(focusTimeApi.getBlocks).toHaveBeenCalled();
    });

    act(() => {
      result.current.setScheduleData((prev) => ({
        ...prev,
        title: "Team Sync",
        description: "Weekly sync",
        meetingType: "conference",
        date: "2026-08-23",
        time: "10:30",
        duration: 60,
      }));
    });

    await waitFor(() => {
      expect(result.current.focusConflicts.length).toBeGreaterThan(0);
    });

    meetingApi.scheduleMeeting.mockResolvedValue({
      data: { success: true },
    });

    await act(async () => {
      await result.current.handleScheduleSubmit({ preventDefault: () => {} });
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(promptSpy).toHaveBeenCalled();
    expect(meetingApi.scheduleMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Team Sync",
        auditNote: "Important override reason",
      }),
    );
  });

  it("blocks scheduling when a focus block has strict block policy", async () => {
    const focusStart = new Date(2026, 7, 23, 10, 0, 0, 0);
    const focusEnd = new Date(2026, 7, 23, 12, 0, 0, 0);
    const focusBlock = {
      _id: "fb_strict",
      title: "Strict Deep Work",
      startTime: focusStart.toISOString(),
      endTime: focusEnd.toISOString(),
      isRecurring: false,
      policy: "block",
      allowOverride: false,
    };
    focusTimeApi.getBlocks.mockResolvedValue([focusBlock]);

    const { result } = renderHook(() => useScheduleMeeting(), { wrapper });

    await waitFor(() => {
      expect(focusTimeApi.getBlocks).toHaveBeenCalled();
    });

    act(() => {
      result.current.setScheduleData((prev) => ({
        ...prev,
        title: "Forbidden Sync",
        date: "2026-08-23",
        time: "10:30",
        duration: 60,
      }));
    });

    await waitFor(() => {
      expect(result.current.focusConflicts.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.handleScheduleSubmit({ preventDefault: () => {} });
    });

    expect(meetingApi.scheduleMeeting).not.toHaveBeenCalled();
  });
});
