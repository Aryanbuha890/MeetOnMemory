// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import HighlightReel from "../HighlightReel.jsx";
import highlightReelApi from "../../../services/highlightReelApi.js";
import { sharedLinkApi } from "../../../services/sharedLinkApi.js";

vi.mock("../../../services/highlightReelApi.js", () => ({
  default: {
    getHighlightReel: vi.fn(),
    generateHighlightReel: vi.fn(),
    updateHighlightReel: vi.fn(),
    exportHighlightReelHtml: vi.fn(),
  },
}));

vi.mock("../../../services/sharedLinkApi.js", () => ({
  sharedLinkApi: {
    createLink: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("HighlightReel Component", () => {
  const mockMeetingId = "meeting-123";

  const mockCompletedReel = {
    status: "completed",
    narrative: "Key insights and decisions made during Q3 planning.",
    highlights: [
      {
        _id: "clip-1",
        type: "decision",
        timestamp: 60,
        endTime: 90,
        speaker: "Alice",
        excerpt: "We decided to launch feature X in September.",
        sentiment: "positive",
        aiRationale: "Critical roadmap decision.",
      },
      {
        _id: "clip-2",
        type: "insight",
        timestamp: 180,
        endTime: 210,
        speaker: "Bob",
        excerpt: "Customer retention increased by 15%.",
        sentiment: "positive",
        aiRationale: "Positive metric trend.",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state while fetching reel", () => {
    highlightReelApi.getHighlightReel.mockImplementation(
      () => new Promise(() => {}),
    );

    render(<HighlightReel meetingId={mockMeetingId} />);

    expect(screen.getByTestId("highlight-reel-loading")).toBeInTheDocument();
  });

  it("renders error state with retry button when fetch fails", async () => {
    highlightReelApi.getHighlightReel.mockRejectedValue(
      new Error("Network Error"),
    );

    render(<HighlightReel meetingId={mockMeetingId} />);

    await waitFor(() => {
      expect(screen.getByTestId("highlight-reel-error")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Failed to fetch highlight reel."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retry fetching reel/i }),
    ).toBeInTheDocument();
  });

  it("renders empty state and allows generation when reel is null", async () => {
    highlightReelApi.getHighlightReel.mockResolvedValue({
      data: { success: true, data: null },
    });
    highlightReelApi.generateHighlightReel.mockResolvedValue({
      data: { success: true },
    });

    render(<HighlightReel meetingId={mockMeetingId} canManage={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("highlight-reel-empty")).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole("button", {
      name: /generate highlight reel/i,
    });
    fireEvent.click(generateBtn);

    expect(highlightReelApi.generateHighlightReel).toHaveBeenCalledWith(
      mockMeetingId,
    );
  });

  it("renders completed reel narrative and highlight cards", async () => {
    highlightReelApi.getHighlightReel.mockResolvedValue({
      data: { success: true, data: mockCompletedReel },
    });

    render(<HighlightReel meetingId={mockMeetingId} />);

    await waitFor(() => {
      expect(
        screen.getByTestId("highlight-reel-container"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/key insights and decisions made during q3 planning/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/"We decided to launch feature X in September."/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/"Customer retention increased by 15%."/i),
    ).toBeInTheDocument();
  });

  it("opens share modal with share URL when Share Reel is clicked", async () => {
    highlightReelApi.getHighlightReel.mockResolvedValue({
      data: { success: true, data: mockCompletedReel },
    });
    sharedLinkApi.createLink.mockResolvedValue({
      data: { success: true, link: { hash: "sharehash123" } },
    });

    render(<HighlightReel meetingId={mockMeetingId} />);

    await waitFor(() => {
      expect(screen.getByTestId("share-reel-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("share-reel-button"));

    await waitFor(() => {
      expect(sharedLinkApi.createLink).toHaveBeenCalledWith({
        resourceId: mockMeetingId,
        resourceType: "Meeting",
      });
      expect(screen.getByTestId("share-modal")).toBeInTheDocument();
    });

    expect(screen.getByTestId("share-url-input")).toHaveValue(
      `${window.location.origin}/shared/sharehash123`,
    );
  });

  it("triggers HTML export download on Export HTML button click", async () => {
    highlightReelApi.getHighlightReel.mockResolvedValue({
      data: { success: true, data: mockCompletedReel },
    });
    highlightReelApi.exportHighlightReelHtml.mockResolvedValue({
      data: "<html>Reel</html>",
    });

    render(<HighlightReel meetingId={mockMeetingId} />);

    await waitFor(() => {
      expect(screen.getByTestId("export-html-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("export-html-button"));

    await waitFor(() => {
      expect(highlightReelApi.exportHighlightReelHtml).toHaveBeenCalledWith(
        mockMeetingId,
        expect.any(Object),
      );
    });
  });

  it("allows trimming clip timestamps and saving update to API", async () => {
    highlightReelApi.getHighlightReel.mockResolvedValue({
      data: { success: true, data: mockCompletedReel },
    });
    highlightReelApi.updateHighlightReel.mockResolvedValue({
      data: {
        success: true,
        data: {
          ...mockCompletedReel,
          highlights: [
            { ...mockCompletedReel.highlights[0], timestamp: 70, endTime: 100 },
            mockCompletedReel.highlights[1],
          ],
        },
      },
    });

    render(<HighlightReel meetingId={mockMeetingId} canManage={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("trim-button-0")).toBeInTheDocument();
    });

    // Click Trim / Edit on first clip
    fireEvent.click(screen.getByTestId("trim-button-0"));

    expect(screen.getByTestId("edit-form-0")).toBeInTheDocument();

    // Change start and end times
    const startTimeInput = screen.getByLabelText(/start time \(sec\)/i);
    const endTimeInput = screen.getByLabelText(/end time \(sec\)/i);

    fireEvent.change(startTimeInput, { target: { value: "70" } });
    fireEvent.change(endTimeInput, { target: { value: "100" } });

    // Submit edit form
    const saveTrimBtn = screen.getByRole("button", { name: /save trim/i });
    fireEvent.click(saveTrimBtn);

    await waitFor(() => {
      expect(highlightReelApi.updateHighlightReel).toHaveBeenCalledWith(
        mockMeetingId,
        expect.objectContaining({
          highlights: expect.arrayContaining([
            expect.objectContaining({ timestamp: 70, endTime: 100 }),
          ]),
        }),
      );
    });
  });

  it("allows reordering clips down and up", async () => {
    highlightReelApi.getHighlightReel.mockResolvedValue({
      data: { success: true, data: mockCompletedReel },
    });
    highlightReelApi.updateHighlightReel.mockResolvedValue({
      data: { success: true, data: mockCompletedReel },
    });

    render(<HighlightReel meetingId={mockMeetingId} canManage={true} />);

    await waitFor(() => {
      expect(screen.getByTestId("move-down-0")).toBeInTheDocument();
    });

    // Move first clip down
    fireEvent.click(screen.getByTestId("move-down-0"));

    await waitFor(() => {
      expect(highlightReelApi.updateHighlightReel).toHaveBeenCalled();
    });
  });

  it("hides management/editing controls when canManage is false (permission gate)", async () => {
    highlightReelApi.getHighlightReel.mockResolvedValue({
      data: { success: true, data: mockCompletedReel },
    });

    render(<HighlightReel meetingId={mockMeetingId} canManage={false} />);

    await waitFor(() => {
      expect(
        screen.getByTestId("highlight-reel-container"),
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId("regenerate-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trim-button-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("move-down-0")).not.toBeInTheDocument();

    // Viewers can still see share & export actions
    expect(screen.getByTestId("share-reel-button")).toBeInTheDocument();
    expect(screen.getByTestId("export-html-button")).toBeInTheDocument();
  });
});
