import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BreakoutRoomPanel from "../BreakoutRoomPanel.jsx";
import { breakoutRoomApi } from "../../../services/breakoutRoomApi.js";

vi.mock("../../../services/breakoutRoomApi.js", () => ({
  breakoutRoomApi: {
    getRooms: vi.fn(),
    createRoom: vi.fn(),
    startRoom: vi.fn(),
    closeRoom: vi.fn(),
    randomAssign: vi.fn(),
    broadcastMessage: vi.fn(),
    closeAllRooms: vi.fn(),
  },
}));

const mockRooms = [
  {
    _id: "room-1",
    name: "Engineering Room",
    status: "pending",
    participants: ["user-1", "user-2"],
  },
  {
    _id: "room-2",
    name: "Design Room",
    status: "active",
    participants: ["user-3"],
  },
];

describe("BreakoutRoomPanel Component (#2453)", () => {
  const mockMeetingId = "meeting-xyz";
  let mockSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };
    breakoutRoomApi.getRooms.mockResolvedValue({
      success: true,
      data: mockRooms,
    });
    breakoutRoomApi.createRoom.mockResolvedValue({
      success: true,
      data: { _id: "room-3", name: "Product Room", status: "pending" },
    });
    breakoutRoomApi.randomAssign.mockResolvedValue({
      success: true,
      allocations: [],
    });
    breakoutRoomApi.broadcastMessage.mockResolvedValue({
      success: true,
    });
    breakoutRoomApi.closeAllRooms.mockResolvedValue({
      success: true,
    });
    breakoutRoomApi.startRoom.mockResolvedValue({ success: true });
    breakoutRoomApi.closeRoom.mockResolvedValue({ success: true });
  });

  it("renders orchestration panel header and active room matrix", async () => {
    render(
      <BreakoutRoomPanel
        meetingId={mockMeetingId}
        isHost={true}
        socket={mockSocket}
      />,
    );

    expect(screen.getByText(/Breakout Orchestration/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Engineering Room")).toBeInTheDocument();
      expect(screen.getByText("Design Room")).toBeInTheDocument();
      expect(screen.getByText(/👥 2 joined/i)).toBeInTheDocument();
      expect(screen.getByText(/👥 1 joined/i)).toBeInTheDocument();
    });
  });

  it("triggers random assignment when clicking Distribute Randomly button", async () => {
    render(
      <BreakoutRoomPanel
        meetingId={mockMeetingId}
        isHost={true}
        socket={mockSocket}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("random-assign-btn")).toBeInTheDocument();
    });

    const randomBtn = screen.getByTestId("random-assign-btn");
    fireEvent.click(randomBtn);

    await waitFor(() => {
      expect(breakoutRoomApi.randomAssign).toHaveBeenCalledWith(mockMeetingId, [
        "room-1",
        "room-2",
      ]);
      expect(mockSocket.emit).toHaveBeenCalledWith("breakout:shuffled", {
        roomId: mockMeetingId,
        roomIds: ["room-1", "room-2"],
      });
    });
  });

  it("dispatches global broadcast message to all sub-rooms", async () => {
    render(
      <BreakoutRoomPanel
        meetingId={mockMeetingId}
        isHost={true}
        socket={mockSocket}
      />,
    );

    const input = screen.getByTestId("broadcast-input");
    const submitBtn = screen.getByTestId("broadcast-submit-btn");

    fireEvent.change(input, {
      target: { value: "3 minutes left until group recall" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(breakoutRoomApi.broadcastMessage).toHaveBeenCalledWith(
        mockMeetingId,
        "3 minutes left until group recall",
      );
      expect(mockSocket.emit).toHaveBeenCalledWith("breakout:broadcast", {
        roomId: mockMeetingId,
        message: "3 minutes left until group recall",
      });
    });
  });

  it("recalls all participants and closes all breakout rooms upon confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <BreakoutRoomPanel
        meetingId={mockMeetingId}
        isHost={true}
        socket={mockSocket}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("close-all-btn")).toBeInTheDocument();
    });

    const closeAllBtn = screen.getByTestId("close-all-btn");
    fireEvent.click(closeAllBtn);

    await waitFor(() => {
      expect(breakoutRoomApi.closeAllRooms).toHaveBeenCalledWith(mockMeetingId);
      expect(mockSocket.emit).toHaveBeenCalledWith("breakout:close-all", {
        roomId: mockMeetingId,
      });
    });
  });

  it("allows starting and closing individual breakout rooms", async () => {
    render(
      <BreakoutRoomPanel
        meetingId={mockMeetingId}
        isHost={true}
        socket={mockSocket}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("start-room-room-1")).toBeInTheDocument();
      expect(screen.getByTestId("close-room-room-2")).toBeInTheDocument();
    });

    const startBtn = screen.getByTestId("start-room-room-1");
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(breakoutRoomApi.startRoom).toHaveBeenCalledWith(
        mockMeetingId,
        "room-1",
      );
    });

    const closeBtn = screen.getByTestId("close-room-room-2");
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(breakoutRoomApi.closeRoom).toHaveBeenCalledWith(
        mockMeetingId,
        "room-2",
      );
    });
  });

  it("displays broadcast ticker alert banner when received via socket", async () => {
    let broadcastHandler;
    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "breakout:broadcast") {
        broadcastHandler = handler;
      }
    });

    render(
      <BreakoutRoomPanel
        meetingId={mockMeetingId}
        isHost={false}
        currentUserId="user-3"
        socket={mockSocket}
      />,
    );

    await waitFor(() => {
      expect(broadcastHandler).toBeDefined();
    });

    // Simulate socket broadcast received
    await waitFor(() => {
      broadcastHandler({
        sender: "Host Facilitator",
        message: "Please conclude your discussion!",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("broadcast-banner")).toBeInTheDocument();
      expect(
        screen.getByText(/Please conclude your discussion!/i),
      ).toBeInTheDocument();
    });
  });
});
