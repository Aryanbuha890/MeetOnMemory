// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import KeyMomentsPanel from "../KeyMomentsPanel.jsx";
import { keyMomentApi } from "../../../services/keyMomentApi.js";

vi.mock("../../../services/keyMomentApi.js", () => ({
  keyMomentApi: {
    createMoment: vi.fn(),
    fetchMoments: vi.fn(),
    updateMoment: vi.fn(),
    deleteMoment: vi.fn(),
    exportMoments: vi.fn(),
  },
  default: {
    createMoment: vi.fn(),
    fetchMoments: vi.fn(),
    updateMoment: vi.fn(),
    deleteMoment: vi.fn(),
    exportMoments: vi.fn(),
  },
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    user: {
      _id: "user_1",
      id: "user_1",
      name: "Alice Smith",
      publicMetadata: { role: "member" },
    },
  }),
}));

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock("../../../services/apiClient.js", () => ({
  createClerkSocketOptions: vi.fn().mockResolvedValue({}),
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("KeyMomentsPanel (#2465)", () => {
  const mockMeetingId = "meeting-123";
  const mockMoments = [
    {
      _id: "km-1",
      meetingId: mockMeetingId,
      snippet: "Agreed to adopt new design system in sprint 4",
      category: "decision",
      startTime: 65,
      endTime: 75,
      note: "Team wide alignment",
      userId: {
        _id: "user_1",
        name: "Alice Smith",
      },
    },
    {
      _id: "km-2",
      meetingId: mockMeetingId,
      snippet: "Evaluate database performance bottleneck",
      category: "action_item",
      startTime: 130,
      endTime: 140,
      note: "Assigned to Bob",
      userId: {
        _id: "user_2",
        name: "Bob Jones",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("renders loading state initially when using meetingId hook", () => {
    keyMomentApi.fetchMoments.mockImplementation(() => new Promise(() => {}));

    render(<KeyMomentsPanel meetingId={mockMeetingId} />);

    expect(screen.getByText("Loading key moments...")).toBeInTheDocument();
  });

  it("renders fetched key moments with formatted time and categories", async () => {
    keyMomentApi.fetchMoments.mockResolvedValueOnce({
      keyMoments: mockMoments,
    });

    render(<KeyMomentsPanel meetingId={mockMeetingId} />);

    await waitFor(() => {
      expect(
        screen.getByText("Agreed to adopt new design system in sprint 4"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(screen.getByText("2:10")).toBeInTheDocument();
    expect(screen.getAllByText("decision").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("action item").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Team wide alignment")).toBeInTheDocument();
  });

  it("jumps to transcript timestamp when timestamp button is clicked", async () => {
    const onSeek = vi.fn();
    const eventListener = vi.fn();
    window.addEventListener("meetonmemory:seek-transcript", eventListener);

    render(
      <KeyMomentsPanel
        moments={mockMoments}
        meetingId={mockMeetingId}
        onSeekToTimestamp={onSeek}
      />,
    );

    const jumpBtn = screen.getByRole("button", { name: /1:05/i });
    fireEvent.click(jumpBtn);

    expect(onSeek).toHaveBeenCalledWith(65);
    expect(eventListener).toHaveBeenCalled();

    window.removeEventListener("meetonmemory:seek-transcript", eventListener);
  });

  it("supports onJumpToTime callback prop as fallback for timestamp seek", async () => {
    const onJump = vi.fn();

    render(
      <KeyMomentsPanel
        moments={mockMoments}
        meetingId={mockMeetingId}
        onJumpToTime={onJump}
      />,
    );

    const jumpBtn = screen.getByRole("button", { name: /2:10/i });
    fireEvent.click(jumpBtn);

    expect(onJump).toHaveBeenCalledWith(130);
  });

  it("filters moments by selected category", async () => {
    render(<KeyMomentsPanel moments={mockMoments} isAuthorized={true} />);

    expect(
      screen.getByText("Agreed to adopt new design system in sprint 4"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Evaluate database performance bottleneck"),
    ).toBeInTheDocument();

    const categorySelect = screen.getByLabelText("Filter moments by category");
    fireEvent.change(categorySelect, { target: { value: "decision" } });

    expect(
      screen.getByText("Agreed to adopt new design system in sprint 4"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Evaluate database performance bottleneck"),
    ).not.toBeInTheDocument();
  });

  it("allows authorized users to edit and save a key moment inline", async () => {
    keyMomentApi.fetchMoments.mockResolvedValueOnce({
      keyMoments: mockMoments,
    });
    keyMomentApi.updateMoment.mockResolvedValueOnce({
      keyMoment: {
        ...mockMoments[0],
        snippet: "Updated decision details",
        note: "Updated note",
      },
    });

    render(<KeyMomentsPanel meetingId={mockMeetingId} isAuthorized={true} />);

    await waitFor(() => {
      expect(
        screen.getByText("Agreed to adopt new design system in sprint 4"),
      ).toBeInTheDocument();
    });

    const editBtns = screen.getAllByTitle("Edit key moment");
    fireEvent.click(editBtns[0]);

    const textarea = screen.getByDisplayValue(
      "Agreed to adopt new design system in sprint 4",
    );
    fireEvent.change(textarea, {
      target: { value: "Updated decision details" },
    });

    const saveBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(keyMomentApi.updateMoment).toHaveBeenCalledWith("km-1", {
        snippet: "Updated decision details",
        title: "Updated decision details",
        category: "decision",
        startTime: 65,
        endTime: 75,
        note: "Team wide alignment",
      });
    });
  });

  it("cancels inline editing without saving changes", async () => {
    render(<KeyMomentsPanel moments={mockMoments} isAuthorized={true} />);

    const editBtns = screen.getAllByTitle("Edit key moment");
    fireEvent.click(editBtns[0]);

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(
      screen.getByText("Agreed to adopt new design system in sprint 4"),
    ).toBeInTheDocument();
    expect(keyMomentApi.updateMoment).not.toHaveBeenCalled();
  });

  it("deletes a key moment after confirmation", async () => {
    keyMomentApi.fetchMoments.mockResolvedValueOnce({
      keyMoments: mockMoments,
    });
    keyMomentApi.deleteMoment.mockResolvedValueOnce({ success: true });

    render(<KeyMomentsPanel meetingId={mockMeetingId} isAuthorized={true} />);

    await waitFor(() => {
      expect(
        screen.getByText("Agreed to adopt new design system in sprint 4"),
      ).toBeInTheDocument();
    });

    const deleteBtns = screen.getAllByTitle("Delete key moment");
    fireEvent.click(deleteBtns[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(keyMomentApi.deleteMoment).toHaveBeenCalledWith("km-1");
    });
  });

  it("triggers CSV export download on export button click", async () => {
    const fakeBlob = new Blob(["Timestamp,Key Moment Title\n0:65,Design"], {
      type: "text/csv",
    });
    keyMomentApi.fetchMoments.mockResolvedValueOnce({
      keyMoments: mockMoments,
    });
    keyMomentApi.exportMoments.mockResolvedValueOnce(fakeBlob);

    render(<KeyMomentsPanel meetingId={mockMeetingId} />);

    await waitFor(() => {
      expect(
        screen.getByText("Agreed to adopt new design system in sprint 4"),
      ).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", { name: /export csv/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(keyMomentApi.exportMoments).toHaveBeenCalledWith(mockMeetingId);
    });
  });

  it("allows adding a new key moment", async () => {
    keyMomentApi.fetchMoments.mockResolvedValueOnce({
      keyMoments: mockMoments,
    });
    keyMomentApi.createMoment.mockResolvedValueOnce({
      keyMoment: {
        _id: "km-3",
        snippet: "New insight discovered",
        category: "insight",
        startTime: 200,
        endTime: 210,
      },
    });

    render(<KeyMomentsPanel meetingId={mockMeetingId} />);

    await waitFor(() => {
      expect(
        screen.getByText("Agreed to adopt new design system in sprint 4"),
      ).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: /add key moment/i });
    fireEvent.click(addBtn);

    const textarea = screen.getByPlaceholderText(
      "Highlight text from transcript...",
    );
    fireEvent.change(textarea, { target: { value: "New insight discovered" } });

    const submitBtn = screen.getByRole("button", { name: /save moment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(keyMomentApi.createMoment).toHaveBeenCalledWith({
        snippet: "New insight discovered",
        category: "insight",
        startTime: 0,
        endTime: 10,
        note: "",
        meetingId: mockMeetingId,
      });
    });
  });
});
