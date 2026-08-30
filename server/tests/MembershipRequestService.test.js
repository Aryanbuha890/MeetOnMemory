import mongoose from "mongoose";
import { describe, it, expect, vi, afterEach } from "vitest";
import MembershipRequestService from "../services/MembershipRequestService.js";
import MembershipRequest from "../models/membershipRequestModel.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import AuditService from "../services/AuditService.js"; // eslint-disable-line no-unused-vars
import {
  AppError,
  NotFoundError,
  ForbiddenError, // eslint-disable-line no-unused-vars
  ValidationError,
} from "../utils/errors.js";

describe("MembershipRequestService", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const organizationId = new mongoose.Types.ObjectId().toString();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createRequest", () => {
    it("should throw ValidationError if organization ID is missing", async () => {
      await expect(
        MembershipRequestService.createRequest(userId, null, "Hello"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError if organization ID is invalid", async () => {
      await expect(
        MembershipRequestService.createRequest(userId, "invalid-id", "Hello"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError if organization does not exist", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue(null);

      await expect(
        MembershipRequestService.createRequest(userId, organizationId, "Hello"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ValidationError if user is already a member", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: organizationId,
      });
      vi.spyOn(Membership, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: "membership-id" }),
      });

      await expect(
        MembershipRequestService.createRequest(userId, organizationId, "Hello"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw AppError if a pending request already exists", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: organizationId,
      });
      vi.spyOn(Membership, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });
      vi.spyOn(MembershipRequest, "findOne").mockReturnValue({
        lean: vi
          .fn()
          .mockResolvedValue({ _id: "request-id", status: "pending" }),
      });

      await expect(
        MembershipRequestService.createRequest(userId, organizationId, "Hello"),
      ).rejects.toThrow(AppError);
    });

    it("should successfully create a membership request", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: organizationId,
      });
      vi.spyOn(Membership, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });
      vi.spyOn(MembershipRequest, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const mockRequest = {
        _id: "new-request-id",
        user: userId,
        organization: organizationId,
        status: "pending",
      };
      vi.spyOn(MembershipRequest, "create").mockResolvedValue(mockRequest);

      const result = await MembershipRequestService.createRequest(
        userId,
        organizationId,
        "Hello",
      );

      expect(result).toEqual(mockRequest);
      expect(MembershipRequest.create).toHaveBeenCalledWith({
        user: userId,
        organization: expect.any(mongoose.Types.ObjectId),
        message: "Hello",
        status: "pending",
      });
    });
  });

  describe("approveRequest & rejectRequest with notifications", () => {
    const requestId = new mongoose.Types.ObjectId().toString();

    it("should throw ValidationError if request ID is invalid", async () => {
      await expect(
        MembershipRequestService.approveRequest(userId, "invalid-id", "Ok"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError if request does not exist", async () => {
      vi.spyOn(MembershipRequest, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      });

      await expect(
        MembershipRequestService.approveRequest(userId, requestId, "Ok"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should approve request, update user role, and trigger decision notification", async () => {
      const mockOrg = { _id: organizationId, name: "Acme Corp", owner: userId };
      const mockReqDoc = {
        _id: requestId,
        user: userId,
        organization: mockOrg,
        status: "pending",
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(MembershipRequest, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockReqDoc),
      });
      vi.spyOn(Membership, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue({ role: "admin" }),
      });

      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      };
      vi.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);
      vi.spyOn(Membership, "create").mockResolvedValue([{ _id: "m1" }]);
      vi.spyOn(
        mongoose.models.user || userModel,
        "findByIdAndUpdate",
      ).mockResolvedValue({});
      vi.spyOn(MembershipRequestService, "_notifyDecision").mockImplementation(
        () => {},
      );

      const res = await MembershipRequestService.approveRequest(
        userId,
        requestId,
        "Welcome!",
      );

      expect(mockReqDoc.status).toBe("approved");
      expect(mockReqDoc.reviewNotes).toBe("Welcome!");
      expect(MembershipRequestService._notifyDecision).toHaveBeenCalledWith(
        mockReqDoc,
        "approved",
        "Welcome!",
      );
      expect(res.membership).toBeDefined();
    });

    it("should reject request and trigger decision notification", async () => {
      const mockOrg = { _id: organizationId, name: "Acme Corp", owner: userId };
      const mockReqDoc = {
        _id: requestId,
        user: userId,
        organization: mockOrg,
        status: "pending",
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(MembershipRequest, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockReqDoc),
      });
      vi.spyOn(Membership, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue({ role: "admin" }),
      });
      vi.spyOn(MembershipRequestService, "_notifyDecision").mockImplementation(
        () => {},
      );

      const res = await MembershipRequestService.rejectRequest(
        userId,
        requestId,
        "Not eligible",
      );

      expect(mockReqDoc.status).toBe("rejected");
      expect(mockReqDoc.reviewNotes).toBe("Not eligible");
      expect(MembershipRequestService._notifyDecision).toHaveBeenCalledWith(
        mockReqDoc,
        "rejected",
        "Not eligible",
      );
      expect(res.request).toBe(mockReqDoc);
    });
  });

  describe("addComment", () => {
    const requestId = new mongoose.Types.ObjectId().toString();

    it("should add a comment to the membership request", async () => {
      const mockReqDoc = {
        _id: requestId,
        user: userId,
        organization: { _id: organizationId, owner: userId },
        comments: [],
        save: vi.fn().mockResolvedValue(true),
        populate: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(MembershipRequest, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockReqDoc),
      });
      vi.spyOn(Membership, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const res = await MembershipRequestService.addComment(
        userId,
        requestId,
        "When will this be reviewed?",
      );

      expect(mockReqDoc.comments.length).toBe(1);
      expect(mockReqDoc.comments[0].text).toBe("When will this be reviewed?");
      expect(res).toBe(mockReqDoc);
    });
  });
});
