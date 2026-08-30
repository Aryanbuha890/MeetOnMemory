import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import IssueTrackerConfig from "../IssueTrackerConfig";
import apiClient from "../../../services/apiClient";

vi.mock("../../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("IssueTrackerConfig Component (#2238, #2648)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders disconnected form initially when config is empty", async () => {
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/config")) {
        return Promise.resolve({ data: { data: null } });
      }
      if (url.includes("/sync-status")) {
        return Promise.resolve({
          data: {
            data: {
              connected: false,
              lastSyncAt: null,
              lastSyncStatus: "idle",
              syncCount: 0,
              syncLogs: [],
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <IssueTrackerConfig
        provider="jira"
        title="Jira Integration"
        description="Sync action items to Jira"
        icon={<span>JiraIcon</span>}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          /Enter your Jira Integration access token/i,
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText(/https:\/\/your-domain.atlassian.net/i),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. PROJ/i)).toBeInTheDocument();
  });

  it("renders connected status and sync history when integration exists", async () => {
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/config")) {
        return Promise.resolve({
          data: {
            data: {
              provider: "jira",
              config: {
                siteUrl: "https://myorg.atlassian.net",
                projectKey: "PROJ",
              },
            },
          },
        });
      }
      if (url.includes("/sync-status")) {
        return Promise.resolve({
          data: {
            data: {
              connected: true,
              lastSyncAt: "2026-08-25T12:00:00Z",
              lastSyncStatus: "success",
              syncCount: 12,
              syncLogs: [
                {
                  timestamp: "2026-08-25T12:00:00Z",
                  action: "outbound_push",
                  status: "success",
                  details: "Created Jira issue PROJ-101",
                },
              ],
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <IssueTrackerConfig
        provider="jira"
        title="Jira Integration"
        description="Sync action items to Jira"
        icon={<span>JiraIcon</span>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    expect(screen.getByText("PROJ")).toBeInTheDocument();
    expect(screen.getByText("12 tasks")).toBeInTheDocument();
  });

  it("triggers manual sync when Sync Now is clicked (#2648)", async () => {
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/config")) {
        return Promise.resolve({
          data: {
            data: {
              provider: "jira",
              config: { projectKey: "PROJ" },
            },
          },
        });
      }
      if (url.includes("/sync-status")) {
        return Promise.resolve({
          data: {
            data: {
              connected: true,
              lastSyncStatus: "idle",
              syncCount: 5,
              syncLogs: [],
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    apiClient.post.mockResolvedValue({
      data: {
        success: true,
        message: "Sync completed successfully",
        data: {
          lastSyncAt: "2026-08-29T12:00:00Z",
          lastSyncStatus: "success",
          syncCount: 6,
          syncLogs: [],
        },
      },
    });

    render(
      <IssueTrackerConfig
        provider="jira"
        title="Jira Integration"
        description="Sync action items to Jira"
        icon={<span>JiraIcon</span>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sync-now-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("sync-now-button"));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/issue-tracker/jira/sync",
      );
    });
  });

  it("renders lastSyncError banner when sync error is present (#2648)", async () => {
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/config")) {
        return Promise.resolve({
          data: {
            data: { provider: "linear", config: { teamId: "ENG" } },
          },
        });
      }
      if (url.includes("/sync-status")) {
        return Promise.resolve({
          data: {
            data: {
              connected: true,
              lastSyncStatus: "error",
              lastSyncError: "Webhook timeout while reconciling issues",
              syncCount: 2,
              syncLogs: [],
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <IssueTrackerConfig
        provider="linear"
        title="Linear Integration"
        description="Sync action items to Linear"
        icon={<span>LinearIcon</span>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sync-error-banner")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Webhook timeout while reconciling issues"),
    ).toBeInTheDocument();
  });
});
