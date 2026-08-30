import { describe, expect, it, beforeEach, vi } from "vitest";
import apiClient from "../services/apiClient.js";
import {
  getActionItemGraph,
  getActionItemNeighborhood,
  createActionItemDependency,
  deleteActionItemDependency,
  resolveActionItemBlockers,
} from "./actionItemGraphApi.js";

vi.mock("../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("actionItemGraphApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests topology from the correct protected API path", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { graph: { nodes: [{ id: "a" }], edges: [] } },
    });

    await expect(
      getActionItemGraph({
        meetingId: "meeting-1",
        status: "ACTIVE",
        empty: "",
      }),
    ).resolves.toEqual({
      nodes: [{ id: "a" }],
      edges: [],
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/action-item-graph/topology",
      {
        params: { meetingId: "meeting-1", status: "ACTIVE" },
      },
    );
  });

  it("normalizes an empty backend graph", async () => {
    apiClient.get.mockResolvedValueOnce({ data: {} });
    await expect(getActionItemGraph()).resolves.toEqual({
      nodes: [],
      edges: [],
    });
  });

  it("builds a connected upstream/downstream neighborhood from topology", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        graph: {
          nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
          edges: [
            { id: "ab", source: "a", target: "b" },
            { id: "bc", source: "b", target: "c" },
            { id: "cd", source: "c", target: "d" },
          ],
        },
      },
    });

    await expect(getActionItemNeighborhood("b")).resolves.toEqual({
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      edges: [
        { id: "ab", source: "a", target: "b" },
        { id: "bc", source: "b", target: "c" },
        { id: "cd", source: "c", target: "d" },
      ],
    });
  });

  it("returns an empty neighborhood for a missing action item id", async () => {
    await expect(getActionItemNeighborhood("")).resolves.toEqual({
      nodes: [],
      edges: [],
    });
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("creates a dependency through the graph API", async () => {
    const dependency = {
      _id: "dep-1",
      sourceActionItemId: "a",
      targetActionItemId: "b",
    };
    apiClient.post.mockResolvedValueOnce({ data: { dependency } });

    await expect(
      createActionItemDependency({
        sourceMeetingId: "m1",
        targetMeetingId: "m2",
        sourceActionItemId: "a",
        targetActionItemId: "b",
        dependencyType: "BLOCKS",
      }),
    ).resolves.toEqual(dependency);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/action-item-graph/dependencies",
      expect.objectContaining({
        sourceActionItemId: "a",
        targetActionItemId: "b",
      }),
    );
  });

  it("deletes a dependency through the graph API", async () => {
    apiClient.delete.mockResolvedValueOnce({
      data: { message: "Dependency removed successfully" },
    });
    await expect(deleteActionItemDependency("dep-1")).resolves.toEqual({
      message: "Dependency removed successfully",
    });
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/api/action-item-graph/dependencies/dep-1",
    );
  });

  it("resolves blockers through the graph API", async () => {
    apiClient.patch.mockResolvedValueOnce({ data: { message: "resolved" } });
    await expect(resolveActionItemBlockers("task-1")).resolves.toEqual({
      message: "resolved",
    });
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/action-item-graph/resolve/task-1",
    );
  });
});
