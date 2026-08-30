// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import WorkloadDashboard from "../WorkloadDashboard.jsx";
import api from "../../services/apiClient.js";

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock recharts ResponsiveContainer to render children with explicit dimensions
vi.mock("recharts", async () => {
  const original = await vi.importActual("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }) => (
      <div
        data-testid="responsive-container"
        style={{ width: 800, height: 400 }}
      >
        {children}
      </div>
    ),
  };
});

describe("WorkloadDashboard Page (#2464)", () => {
  const mockWorkloads = [
    {
      user: {
        _id: "user-1",
        name: "Alice Smith",
        avatarUrl: "",
      },
      actionItems: [
        {
          _id: "item-1",
          text: "Design System Refactor",
          priority: "high",
        },
      ],
      loadScore: 8,
      capacity: 10,
      status: "optimal",
      role: "admin",
      team: "ADMIN Team",
    },
    {
      user: {
        _id: "user-2",
        name: "Bob Jones",
        avatarUrl: "",
      },
      actionItems: [],
      loadScore: 1,
      capacity: 10,
      status: "underloaded",
      role: "member",
      team: "MEMBER Team",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header, capacity KPI metrics, and team member cards", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        data: mockWorkloads,
      },
    });

    render(<WorkloadDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("Workload & Capacity Dashboard"),
      ).toBeInTheDocument();
      expect(screen.getByText("Total Action Items")).toBeInTheDocument();
      expect(screen.getByText("Capacity Utilization")).toBeInTheDocument();
      expect(screen.getAllByText("Alice Smith")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Bob Jones")[0]).toBeInTheDocument();
    });
  });

  it("handles AI rebalance suggestions and stages reassignments into preview queue", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        data: mockWorkloads,
      },
    });

    render(<WorkloadDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText("Alice Smith")[0]).toBeInTheDocument();
    });

    api.get.mockResolvedValueOnce({
      data: {
        data: {
          suggestions: [
            {
              actionItemId: "item-1",
              fromUserId: "user-1",
              toUserId: "user-2",
              reason: "Balance load between Alice and Bob",
              item: {
                _id: "item-1",
                text: "Design System Refactor",
                priority: "high",
              },
              fromUser: { _id: "user-1", name: "Alice Smith" },
              toUser: { _id: "user-2", name: "Bob Jones" },
            },
          ],
          message: "Rebalance suggestions generated successfully.",
        },
      },
    });

    const aiButton = screen.getByRole("button", {
      name: /AI Rebalance Suggestions/i,
    });
    fireEvent.click(aiButton);

    await waitFor(() => {
      expect(screen.getByText('"Design System Refactor"')).toBeInTheDocument();
      expect(screen.getByText("Preview & Stage Change")).toBeInTheDocument();
    });

    const stageButton = screen.getByText("Preview & Stage Change");
    fireEvent.click(stageButton);

    await waitFor(() => {
      expect(screen.getByText("Rebalance Preview Active")).toBeInTheDocument();
      expect(screen.getByText("Staged Reassignments")).toBeInTheDocument();
    });
  });

  it("executes rebalance preview batch post to /workload/rebalance", async () => {
    api.get.mockResolvedValue({
      data: {
        data: mockWorkloads,
      },
    });

    render(<WorkloadDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Design System Refactor")).toBeInTheDocument();
    });

    // Select target user from dropdown
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "user-2" } });

    await waitFor(() => {
      expect(screen.getByText("Rebalance Preview Active")).toBeInTheDocument();
    });

    api.post.mockResolvedValueOnce({
      data: {
        data: {
          results: [{ actionItemId: "item-1", status: "success" }],
        },
      },
    });

    const applyButton = screen.getByText("Apply Rebalance");
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/workload/rebalance", {
        reassignments: [
          {
            actionItemId: "item-1",
            toUserId: "user-2",
          },
        ],
      });
    });
  });
});
