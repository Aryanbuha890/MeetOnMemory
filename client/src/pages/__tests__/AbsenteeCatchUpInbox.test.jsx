// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AbsenteeCatchUpInbox from "../AbsenteeCatchUpInbox.jsx";
import AbsenteeBriefingCard from "../../components/meeting-details/AbsenteeBriefingCard.jsx";

vi.mock("../../hooks/useAbsenteeCatchUp", () => ({
  useAbsenteeCatchUp: vi.fn(),
}));

vi.mock("../../api/absenteeCatchUpApi", () => ({
  absenteeCatchUpApi: {
    getMeetingCatchUp: vi.fn(),
    generateMeetingCatchUp: vi.fn(),
    generateAndDeliverCatchUp: vi.fn(),
    markAsRead: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAbsenteeCatchUp } from "../../hooks/useAbsenteeCatchUp";
import { absenteeCatchUpApi } from "../../api/absenteeCatchUpApi";
import { toast } from "react-toastify";

describe("AbsenteeCatchUp UI Components (#2457)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AbsenteeCatchUpInbox Component", () => {
    it("renders empty state when there are no catch-up packs", () => {
      useAbsenteeCatchUp.mockReturnValue({
        catchUps: [],
        isLoading: false,
        isError: false,
        markAsRead: vi.fn(),
      });

      render(<AbsenteeCatchUpInbox />);

      expect(screen.getByText("You're all caught up!")).toBeDefined();
    });

    it("renders catch-up items and handles expand and mark as read", async () => {
      const mockMarkAsRead = vi.fn();
      const mockCatchUps = [
        {
          _id: "c_1",
          status: "delivered",
          meetingId: {
            title: "Q3 Roadmap Sync",
            date: "2026-08-28T10:00:00Z",
            summary: "Discussed Q3 milestones and deliverables",
          },
          content: {
            overview: "Overview of roadmap changes",
            actionItemsAssigned: ["Complete API specs"],
            keyTakeaways: ["Approved Q3 timeline"],
          },
        },
      ];

      useAbsenteeCatchUp.mockReturnValue({
        catchUps: mockCatchUps,
        isLoading: false,
        isError: false,
        markAsRead: mockMarkAsRead,
      });

      render(<AbsenteeCatchUpInbox />);

      expect(screen.getByText("Q3 Roadmap Sync")).toBeDefined();
      expect(screen.getByText("delivered")).toBeDefined();

      // Click card to expand
      fireEvent.click(screen.getByText("Q3 Roadmap Sync"));

      expect(screen.getByText("Overview of roadmap changes")).toBeDefined();
      expect(screen.getByText("Complete API specs")).toBeDefined();

      // Click Mark Read button
      const markReadBtn = screen.getByTestId("mark-read-btn-c_1");
      fireEvent.click(markReadBtn);

      expect(mockMarkAsRead).toHaveBeenCalledWith("c_1");
    });
  });

  describe("AbsenteeBriefingCard Organizer Delivery CTA", () => {
    it("renders Deliver to Absentees button for organizers and triggers API", async () => {
      absenteeCatchUpApi.getMeetingCatchUp.mockResolvedValue({
        success: true,
        catchUp: null,
      });
      absenteeCatchUpApi.generateAndDeliverCatchUp.mockResolvedValue({
        success: true,
        deliveredCount: 2,
        status: "DISPATCHED",
      });

      render(<AbsenteeBriefingCard meetingId="m_100" isOrganizer={true} />);

      await waitFor(() => {
        expect(
          screen.getByTestId("organizer-deliver-catchup-btn"),
        ).toBeDefined();
      });

      const deliverBtn = screen.getByTestId("organizer-deliver-catchup-btn");
      fireEvent.click(deliverBtn);

      await waitFor(() => {
        expect(
          absenteeCatchUpApi.generateAndDeliverCatchUp,
        ).toHaveBeenCalledWith("m_100");
        expect(toast.success).toHaveBeenCalledWith(
          "Generated & delivered 2 catch-up pack(s) to absentees!",
        );
      });
    });
  });
});
