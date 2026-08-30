import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import mongoose from "mongoose";

const mockFindOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();

jest.unstable_mockModule("../models/minutesApprovalModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
    findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args),
  },
}));

const minutesApprovalController =
  await import("../controllers/minutesApprovalController.js");

describe("Minutes Approval Controller (#2649)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should guard against legacy mock exports reintroduction", () => {
    expect(minutesApprovalController.handleApprovalAction).toBeUndefined();
    expect(minutesApprovalController.exportAuditTrail).toBeUndefined();
    expect(minutesApprovalController.minutesStore).toBeUndefined();
  });

  it("returns 400 on invalid meetingId in getApprovalStatus", async () => {
    const req = { params: { meetingId: "invalid-id" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await minutesApprovalController.getApprovalStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid meeting id" });
  });

  it("returns not_submitted status when no minutes approval record exists", async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    mockFindOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
    });

    const req = { params: { meetingId: validId } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await minutesApprovalController.getApprovalStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: null,
      status: "not_submitted",
    });
  });

  it("submits minutes for approval successfully", async () => {
    const validMeetingId = new mongoose.Types.ObjectId().toString();
    const approverId1 = new mongoose.Types.ObjectId().toString();
    const approverId2 = new mongoose.Types.ObjectId().toString();
    const submitterId = new mongoose.Types.ObjectId().toString();

    mockFindOne.mockResolvedValue(null);
    mockFindOneAndUpdate.mockResolvedValue({
      meetingId: validMeetingId,
      status: "pending",
      snapshotSummary: "Executive summary notes",
    });

    const req = {
      params: { meetingId: validMeetingId },
      user: { _id: submitterId },
      body: {
        snapshotSummary: "Executive summary notes",
        approvers: [approverId1, approverId2],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await minutesApprovalController.submitApproval(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ status: "pending" }),
      }),
    );
  });
});
