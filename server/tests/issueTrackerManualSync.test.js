import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockFindOne = jest.fn();
const mockFindOneAndDelete = jest.fn();
const mockCreate = jest.fn();

jest.unstable_mockModule("../models/issueTrackerIntegrationModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
    findOneAndDelete: (...args) => mockFindOneAndDelete(...args),
    create: (...args) => mockCreate(...args),
  },
}));

const { triggerSync } =
  await import("../controllers/issueTrackerController.js");

describe("Issue Tracker Manual Sync Controller (#2648)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("successfully triggers manual sync and updates sync metadata", async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    const mockIntegration = {
      provider: "jira",
      organization: "org_1",
      syncCount: 3,
      syncLogs: [],
      save: mockSave,
    };

    mockFindOne.mockResolvedValue(mockIntegration);

    const req = {
      params: { provider: "jira" },
      user: { organization: "org_1" },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await triggerSync(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSave).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          lastSyncStatus: "success",
          syncCount: 4,
          syncLogs: expect.arrayContaining([
            expect.objectContaining({
              action: "manual_sync",
              status: "success",
            }),
          ]),
        }),
      }),
    );
  });

  it("returns 404 when integration is not connected", async () => {
    mockFindOne.mockResolvedValue(null);

    const req = {
      params: { provider: "linear" },
      user: { organization: "org_1" },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await triggerSync(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Integration not connected",
    });
  });

  it("rejects invalid providers", async () => {
    const req = {
      params: { provider: "unknown_provider" },
      user: { organization: "org_1" },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await triggerSync(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid provider",
    });
  });
});
