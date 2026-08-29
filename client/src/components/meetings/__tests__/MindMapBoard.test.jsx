import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MindMapBoard from "../MindMapBoard.jsx";
import { useMindMap } from "../../../hooks/useMindMap";

vi.mock("../../../hooks/useMindMap", () => ({
  useMindMap: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockParticipants = [
  { user: { _id: "user-1" }, name: "Ada Lovelace", email: "ada@example.com" },
  { user: { _id: "user-2" }, name: "Grace Hopper", email: "grace@example.com" },
];

describe("MindMapBoard (#2592)", () => {
  let mockHooks;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHooks = {
      nodes: [
        {
          id: "node-1",
          text: "Database Setup",
          x: 100,
          y: 120,
          color: "#4f46e5",
          isActionItem: false,
        },
        {
          id: "node-2",
          text: "Frontend Design",
          x: 300,
          y: 200,
          color: "#10b981",
          isActionItem: true,
        },
      ],
      connections: [{ id: "conn-1", source: "node-1", target: "node-2" }],
      loading: false,
      addNode: vi.fn(),
      updateNodeText: vi.fn(),
      updateNodeColor: vi.fn(),
      updateNodePosition: vi.fn(),
      persistNodePosition: vi.fn(),
      connectNodes: vi.fn(),
      deleteNode: vi.fn(),
      convertNodeToActionItem: vi.fn(),
    };
    useMindMap.mockReturnValue(mockHooks);
  });

  it("should render nodes and connection labels correctly", () => {
    render(
      <MindMapBoard meetingId="meeting-123" participants={mockParticipants} />,
    );

    expect(screen.getByText("Database Setup")).toBeInTheDocument();
    expect(screen.getByText("Frontend Design")).toBeInTheDocument();
    expect(screen.getByText("Action Item")).toBeInTheDocument();
  });

  it("should call addNode when clicking the Add Idea button", () => {
    render(
      <MindMapBoard meetingId="meeting-123" participants={mockParticipants} />,
    );

    const addButton = screen.getByRole("button", { name: /add idea/i });
    fireEvent.click(addButton);

    expect(mockHooks.addNode).toHaveBeenCalled();
  });

  it("should select a node and show the action controls", async () => {
    render(
      <MindMapBoard meetingId="meeting-123" participants={mockParticipants} />,
    );

    // Click the node
    const nodeElement = screen.getByText("Database Setup");
    fireEvent.mouseDown(nodeElement);

    // Controls should now be visible
    expect(
      screen.getByRole("button", { name: /connect/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /make task/i }),
    ).toBeInTheDocument();
  });

  it("should open and submit the convert to action item modal", async () => {
    render(
      <MindMapBoard meetingId="meeting-123" participants={mockParticipants} />,
    );

    // Select the node
    fireEvent.mouseDown(screen.getByText("Database Setup"));

    // Click Make Task
    fireEvent.click(screen.getByRole("button", { name: /make task/i }));

    // Modal elements should be visible
    expect(screen.getByText("Convert Idea to Action Item")).toBeInTheDocument();

    // Select assignee
    const select = screen.getByLabelText(/assignee/i);
    fireEvent.change(select, { target: { value: "user-1" } });

    // Click Convert
    fireEvent.click(screen.getByRole("button", { name: /convert/i }));

    await waitFor(() => {
      expect(mockHooks.convertNodeToActionItem).toHaveBeenCalledWith("node-1", {
        assignee: "user-1",
        dueDate: undefined,
        priority: "medium",
      });
    });
  });
});
