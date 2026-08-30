import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConflictResolution from "../ConflictResolution.jsx";
import { knowledgeApi } from "../../services";

vi.mock("../../services", () => ({
  knowledgeApi: {
    getConflicts: vi.fn(),
    scanForConflicts: vi.fn(),
    resolveConflict: vi.fn(),
    getConflictAuditHistory: vi.fn(),
    bulkResolveConflicts: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar" />,
}));

describe("ConflictResolution Bulk and History", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles active tabs and history fetching", async () => {
    knowledgeApi.getConflicts.mockResolvedValue({
      data: { success: true, conflicts: [] },
    });
    knowledgeApi.getConflictAuditHistory.mockResolvedValue({
      data: {
        success: true,
        history: [
          {
            _id: "1",
            action: "conflict_bulk_resolved",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });

    render(<ConflictResolution />);

    // Switch to history tab
    const historyTab = screen.getByText(/Audit History/i);
    fireEvent.click(historyTab);

    await waitFor(() => {
      expect(knowledgeApi.getConflictAuditHistory).toHaveBeenCalled();
      expect(screen.getByText(/Bulk Dismissed/i)).toBeInTheDocument();
    });
  });

  it("handles bulk dismiss", async () => {
    knowledgeApi.getConflicts.mockResolvedValue({
      data: {
        success: true,
        conflicts: [
          { _id: "c1", confidence: 90, explanation: "test 1" },
          { _id: "c2", confidence: 80, explanation: "test 2" },
        ],
      },
    });
    knowledgeApi.bulkResolveConflicts.mockResolvedValue({
      data: { success: true },
    });

    render(<ConflictResolution />);

    await waitFor(() => {
      expect(screen.getByText("Select All")).toBeInTheDocument();
    });

    const selectAll = screen.getByLabelText("Select All");
    fireEvent.click(selectAll);

    const bulkBtn = screen.getByText(/Bulk Dismiss/i);
    expect(bulkBtn).not.toBeDisabled();

    fireEvent.click(bulkBtn);

    await waitFor(() => {
      expect(knowledgeApi.bulkResolveConflicts).toHaveBeenCalledWith({
        conflictIds: ["c1", "c2"],
        resolutionType: "dismissed",
      });
    });
  });
});
