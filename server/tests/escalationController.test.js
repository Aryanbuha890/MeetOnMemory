// server/tests/escalationController.test.js
import { jest } from "@jest/globals";
import EscalationPolicy from "../models/escalationPolicyModel.js";
import {
  sanitizePolicyInput,
  ALLOWED_POLICY_FIELDS,
  getEscalationPolicies,
  getEscalationPolicyDashboard,
  getEscalationPolicyById,
  createEscalationPolicy,
  updateEscalationPolicy,
  deleteEscalationPolicy,
  getEscalationHistory,
  triggerManualEscalation,
} from "../controllers/escalationController.js";

describe("Escalation Controller Security Tests", () => {
  const orgA = "507f1f77bcf86cd799439011";
  const orgB = "507f1f77bcf86cd799439022";
  const validPolicyId = "507f1f77bcf86cd799439033";

  describe("Mass Assignment Sanitization", () => {
    it("should extract only whitelisted fields and drop unauthorized fields", () => {
      const maliciousPayload = {
        name: "Critical Escalation",
        description: "Escalate critical incidents",
        priority: "high",
        isActive: true,
        organization: orgB, // Attempted mass assignment override
        createdBy: "attacker_user_id",
        isAdmin: true,
        role: "superadmin",
        _id: "fake_id",
      };

      const sanitized = sanitizePolicyInput(maliciousPayload);

      expect(sanitized.name).toBe("Critical Escalation");
      expect(sanitized.description).toBe("Escalate critical incidents");
      expect(sanitized.priority).toBe("high");
      expect(sanitized.isActive).toBe(true);

      // Verify dangerous fields are excluded
      expect(sanitized.organization).toBeUndefined();
      expect(sanitized.createdBy).toBeUndefined();
      expect(sanitized.isAdmin).toBeUndefined();
      expect(sanitized.role).toBeUndefined();
      expect(sanitized._id).toBeUndefined();
    });

    it("ALLOWED_POLICY_FIELDS must not contain security sensitive attributes", () => {
      expect(ALLOWED_POLICY_FIELDS).not.toContain("organization");
      expect(ALLOWED_POLICY_FIELDS).not.toContain("createdBy");
      expect(ALLOWED_POLICY_FIELDS).not.toContain("_id");
      expect(ALLOWED_POLICY_FIELDS).not.toContain("owner");
    });
  });

  describe("Cross-Tenant IDOR Protection", () => {
    let originalFind;
    let originalCount;
    let originalFindOne;
    let originalCreate;
    let originalFindOneAndDelete;

    beforeEach(() => {
      originalFind = EscalationPolicy.find;
      originalCount = EscalationPolicy.countDocuments;
      originalFindOne = EscalationPolicy.findOne;
      originalCreate = EscalationPolicy.create;
      originalFindOneAndDelete = EscalationPolicy.findOneAndDelete;
    });

    afterEach(() => {
      EscalationPolicy.find = originalFind;
      EscalationPolicy.countDocuments = originalCount;
      EscalationPolicy.findOne = originalFindOne;
      EscalationPolicy.create = originalCreate;
      EscalationPolicy.findOneAndDelete = originalFindOneAndDelete;
    });

    it("getEscalationPolicies should reject cross-tenant organization query with 403", async () => {
      const req = {
        user: { organization: orgA },
        query: { organizationId: orgB }, // Attacker trying to query orgB policies
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getEscalationPolicies(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Unauthorized cross-tenant/i),
        }),
      );
    });

    it("getEscalationPolicyDashboard should reject cross-tenant query with 403", async () => {
      const req = {
        user: { organization: orgA },
        query: { organizationId: orgB },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getEscalationPolicyDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Unauthorized cross-tenant/i),
        }),
      );
    });

    it("getEscalationPolicyById should restrict lookup to user's organization", async () => {
      // Mock findOne to inspect query scoping
      EscalationPolicy.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const req = {
        user: { organization: orgA },
        params: { id: validPolicyId },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getEscalationPolicyById(req, res);

      expect(EscalationPolicy.findOne).toHaveBeenCalledWith({
        _id: validPolicyId,
        organization: orgA,
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("createEscalationPolicy should force user organization and ignore body organization", async () => {
      let createdData = null;
      EscalationPolicy.create = jest.fn().mockImplementation(async (data) => {
        createdData = data;
        return { _id: validPolicyId, ...data };
      });

      const req = {
        user: { organization: orgA, _id: "user_123" },
        body: {
          name: "Security Escalation",
          organization: orgB, // Attempted cross-tenant spoofing
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createEscalationPolicy(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(createdData.organization).toBe(orgA);
      expect(createdData.organization).not.toBe(orgB);
    });

    it("updateEscalationPolicy should scope search to user organization", async () => {
      EscalationPolicy.findOne = jest.fn().mockResolvedValue(null);

      const req = {
        user: { organization: orgA },
        params: { id: validPolicyId },
        body: { name: "Updated Policy Name" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await updateEscalationPolicy(req, res);

      expect(EscalationPolicy.findOne).toHaveBeenCalledWith({
        _id: validPolicyId,
        organization: orgA,
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("deleteEscalationPolicy should scope deletion to user organization", async () => {
      EscalationPolicy.findOneAndDelete = jest.fn().mockResolvedValue(null);

      const req = {
        user: { organization: orgA },
        params: { id: validPolicyId },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await deleteEscalationPolicy(req, res);

      expect(EscalationPolicy.findOneAndDelete).toHaveBeenCalledWith({
        _id: validPolicyId,
        organization: orgA,
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("Run History & Manual Trigger Authorization (#2456)", () => {
    it("getEscalationHistory should restrict lookup to user organization", async () => {
      const req = {
        user: { organization: orgA },
        query: { organizationId: orgB },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getEscalationHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Unauthorized cross-tenant/i),
        }),
      );
    });

    it("triggerManualEscalation should reject non-admin users with 403", async () => {
      const req = {
        user: { organization: orgA, role: "member" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await triggerManualEscalation(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/Admin privileges required/i),
        }),
      );
    });
  });

  describe("Information Disclosure (Error Leakage) Prevention", () => {
    let originalFind;

    beforeEach(() => {
      originalFind = EscalationPolicy.find;
    });

    afterEach(() => {
      EscalationPolicy.find = originalFind;
    });

    it("should return generic 500 error message on internal exceptions", async () => {
      // Force internal DB exception
      EscalationPolicy.find = jest.fn().mockImplementation(() => {
        throw new Error(
          "Sensitive DB Connection Secret: mongodb://admin:pass@db:27017",
        );
      });

      const req = {
        user: { organization: orgA },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getEscalationPolicies(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      const jsonOutput = res.json.mock.calls[0][0];

      // Must return generic message and NOT leak error string
      expect(jsonOutput.success).toBe(false);
      expect(jsonOutput.message).toBe("Internal server error.");
      expect(jsonOutput.message).not.toContain(
        "Sensitive DB Connection Secret",
      );
    });
  });
});
