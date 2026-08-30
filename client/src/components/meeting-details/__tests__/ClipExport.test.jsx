import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import meetingClipApi from "../../../services/meetingClipApi";
import ClipManager from "../ClipManager.jsx";

vi.mock("../../../services/meetingClipApi", () => ({
  default: {
    getMeetingClips: vi.fn(),
    createClip: vi.fn(),
    updateClip: vi.fn(),
    deleteClip: vi.fn(),
    addClipAnnotation: vi.fn(),
    trimClip: vi.fn(),
    mergeClips: vi.fn(),
  },
}));

// Mock socket.io-client
vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

const MEETING_ID = "meeting-123";

const SAMPLE_CLIPS = [
  {
    _id: "clip-1",
    title: "Intro Discussion",
    description: "First part of the meeting",
    startTime: 10,
    endTime: 30,
    transcriptSegments: [],
    annotations: [],
  },
  {
    _id: "clip-2",
    title: "Action Decisions",
    description: "Second part of the meeting",
    startTime: 50,
    endTime: 75,
    transcriptSegments: [],
    annotations: [],
  },
];

const renderManager = () =>
  render(
    <ClipManager
      meetingId={MEETING_ID}
      meeting={{ _id: MEETING_ID, audioFilePath: "recordings/meet.mp3" }}
      canManage
    />,
  );

describe("ClipManager Trimming & Merging Pipeline (#2588)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingClipApi.getMeetingClips.mockResolvedValue(SAMPLE_CLIPS);
  });

  it("should show trim form and trigger trim API call when trim is submitted", async () => {
    meetingClipApi.trimClip.mockResolvedValue({
      ...SAMPLE_CLIPS[0],
      startTime: 15,
      endTime: 25,
    });

    renderManager();

    // Find and click trim button for clip-1
    const trimBtn = await screen.findByTestId("clip-trim-btn-clip-1");
    fireEvent.click(trimBtn);

    // Verify trim form is rendered
    expect(screen.getByTestId("trim-form-clip-1")).toBeInTheDocument();

    const startInput = screen.getByTestId("trim-start-input-clip-1");
    const endInput = screen.getByTestId("trim-end-input-clip-1");

    fireEvent.change(startInput, { target: { value: "15" } });
    fireEvent.change(endInput, { target: { value: "25" } });

    // Submit trim
    const submitBtn = screen.getByTestId("trim-submit-btn-clip-1");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(meetingClipApi.trimClip).toHaveBeenCalledWith("clip-1", {
        startTime: 15,
        endTime: 25,
      });
    });
  });

  it("should show merge panel when clips are checked and trigger merge API call on export", async () => {
    meetingClipApi.mergeClips.mockResolvedValue({
      _id: "merged-compilation-id",
      title: "Board Highlights",
      isCompilation: true,
      mergedClips: ["clip-1", "clip-2"],
    });

    renderManager();

    // Select both clips
    const checkbox1 = await screen.findByTestId("clip-checkbox-clip-1");
    const checkbox2 = await screen.findByTestId("clip-checkbox-clip-2");

    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);

    // Verify merge panel shows
    expect(screen.getByTestId("merge-title-input")).toBeInTheDocument();

    // Input compilation title
    const titleInput = screen.getByTestId("merge-title-input");
    fireEvent.change(titleInput, { target: { value: "Board Highlights" } });

    // Export Compilation
    const mergeSubmitBtn = screen.getByTestId("merge-submit-btn");
    fireEvent.click(mergeSubmitBtn);

    await waitFor(() => {
      expect(meetingClipApi.mergeClips).toHaveBeenCalledWith({
        clipIds: ["clip-1", "clip-2"],
        title: "Board Highlights",
      });
    });
  });
});
