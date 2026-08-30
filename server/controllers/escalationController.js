// server/controllers/escalationController.js
/**
 * Escalation Policy Controller
 *
 * Provides endpoints for managing organization escalation policies with security protections:
 * 1. Cross-tenant IDOR protection via strict req.user.organization verification.
 * 2. Mass assignment prevention via explicit request body attribute whitelisting.
 * 3. Information disclosure prevention by masking internal server exception details.
 */

import EscalationPolicy from "../models/escalationPolicyModel.js";
import EscalationEvent from "../models/escalationEventModel.js";
import { evaluateEscalations } from "../services/escalationService.js";

/**
 * Whitelisted policy attributes permitted during create and update operations.
 * Protects against Mass Assignment vulnerability.
 */
export const ALLOWED_POLICY_FIELDS = [
  "name",
  "description",
  "priority",
  "rules",
  "isActive",
  "targets",
  "channels",
  "timeoutMinutes",
];

/**
 * Extracts and returns only whitelisted fields from client payload.
 *
 * @param {Object} body
 * @returns {Object} Sanitized object containing only allowed fields
 */
export const sanitizePolicyInput = (body = {}) => {
  if (!body || typeof body !== "object") return {};
  const sanitized = {};
  for (const field of ALLOWED_POLICY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      sanitized[field] = body[field];
    }
  }
  return sanitized;
};

/**
 * Helper to safely extract organization ID from authenticated user object.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const getUserOrganizationId = (req) => {
  return (
    req.user?.organization?.toString() ||
    req.user?.organizationId?.toString() ||
    req.user?.orgId?.toString() ||
    null
  );
};

/**
 * Helper to validate Mongo ObjectId format.
 *
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * GET /api/escalation-policies
 * List escalation policies for the authenticated user's organization.
 * Defends against Cross-Tenant IDOR by enforcing organization match.
 */
export const getEscalationPolicies = async (req, res) => {
  try {
    const userOrgId = getUserOrganizationId(req);
    if (!userOrgId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User organization context missing.",
      });
    }

    const requestedOrgId = req.query?.organizationId;
    if (requestedOrgId && requestedOrgId.toString() !== userOrgId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized cross-tenant organization access.",
      });
    }

    const policies = await EscalationPolicy.find({ organization: userOrgId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      policies,
    });
  } catch (err) {
    console.error("Error in getEscalationPolicies:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * GET /api/escalation-policies/dashboard
 * Retrieve escalation policy metrics and summary dashboard for organization.
 * Defends against Cross-Tenant IDOR by matching query organizationId with req.user.organization.
 */
export const getEscalationPolicyDashboard = async (req, res) => {
  try {
    const userOrgId = getUserOrganizationId(req);
    if (!userOrgId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User organization context missing.",
      });
    }

    const requestedOrgId = req.query?.organizationId;
    if (requestedOrgId && requestedOrgId.toString() !== userOrgId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized cross-tenant organization access.",
      });
    }

    const totalPolicies = await EscalationPolicy.countDocuments({
      organization: userOrgId,
    });
    const activePolicies = await EscalationPolicy.countDocuments({
      organization: userOrgId,
      isActive: true,
    });

    const recentEvents = await EscalationEvent.find({ organization: userOrgId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("actionItem")
      .populate("policy")
      .lean();

    const totalEscalated = await EscalationEvent.countDocuments({
      organization: userOrgId,
    });
    const failedEscalated = await EscalationEvent.countDocuments({
      organization: userOrgId,
      status: "failed",
    });

    return res.status(200).json({
      success: true,
      dashboard: {
        totalPolicies,
        activePolicies,
        inactivePolicies: totalPolicies - activePolicies,
        organizationId: userOrgId,
        metrics: {
          totalEscalated,
          activeEscalated: activePolicies,
          resolvedEscalated: totalEscalated - failedEscalated,
          resolutionRate:
            totalEscalated > 0
              ? Math.round(
                  ((totalEscalated - failedEscalated) / totalEscalated) * 100,
                )
              : 100,
        },
        recentEvents,
      },
    });
  } catch (err) {
    console.error("Error in getEscalationPolicyDashboard:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * GET /api/escalation-policies/history
 * Retrieve full escalation run history with tenant isolation.
 */
export const getEscalationHistory = async (req, res) => {
  try {
    const userOrgId = getUserOrganizationId(req);
    if (!userOrgId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User organization context missing.",
      });
    }

    const requestedOrgId = req.query?.organizationId;
    if (requestedOrgId && requestedOrgId.toString() !== userOrgId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized cross-tenant organization access.",
      });
    }

    const events = await EscalationEvent.find({ organization: userOrgId })
      .sort({ createdAt: -1 })
      .populate("actionItem")
      .populate("policy")
      .lean();

    return res.status(200).json({
      success: true,
      events,
    });
  } catch (err) {
    console.error("Error in getEscalationHistory:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * POST /api/escalation-policies/trigger
 * Manually trigger an escalation evaluation run for active policies.
 * Defends against Unauthorized Execution via Strict Admin-Only Authorization.
 */
export const triggerManualEscalation = async (req, res) => {
  try {
    const userOrgId = getUserOrganizationId(req);
    if (!userOrgId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User organization context missing.",
      });
    }

    const userRole = req.user?.role || req.user?.organizationRole;
    const isAdmin =
      userRole === "admin" ||
      userRole === "owner" ||
      req.user?.isAdmin === true;

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized: Admin privileges required for manual escalation trigger.",
      });
    }

    const { policyId } = req.body || {};

    const result = await evaluateEscalations({
      organizationId: userOrgId,
      policyId,
    });

    return res.status(200).json({
      success: true,
      message: "Manual escalation evaluation completed successfully.",
      result,
    });
  } catch (err) {
    console.error("Error in triggerManualEscalation:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * GET /api/escalation-policies/:id
 * Retrieve single escalation policy by ID with organization isolation.
 */
export const getEscalationPolicyById = async (req, res) => {
  try {
    const userOrgId = getUserOrganizationId(req);
    if (!userOrgId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User organization context missing.",
      });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid policy ID format.",
      });
    }

    // Tenant-scoped query instead of bare findById
    const policy = await EscalationPolicy.findOne({
      _id: id,
      organization: userOrgId,
    }).lean();

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: "Escalation policy not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      policy,
    });
  } catch (err) {
    console.error("Error in getEscalationPolicyById:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * POST /api/escalation-policies
 * Create new escalation policy.
 * Defends against Mass Assignment by explicitly whitelisting attributes.
 */
export const createEscalationPolicy = async (req, res) => {
  try {
    const userOrgId = getUserOrganizationId(req);
    if (!userOrgId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User organization context missing.",
      });
    }

    const sanitizedInput = sanitizePolicyInput(req.body);

    if (
      !sanitizedInput.name ||
      typeof sanitizedInput.name !== "string" ||
      !sanitizedInput.name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Policy name is required.",
      });
    }

    // Enforce server-side organization and owner scoping
    const policyData = {
      ...sanitizedInput,
      organization: userOrgId,
      createdBy: req.user?._id || req.user?.id,
    };

    const policy = await EscalationPolicy.create(policyData);

    return res.status(201).json({
      success: true,
      policy,
    });
  } catch (err) {
    console.error("Error in createEscalationPolicy:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid policy input attributes.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * PUT /api/escalation-policies/:id
 * Update an existing escalation policy with tenant validation and field whitelisting.
 */
export const updateEscalationPolicy = async (req, res) => {
  try {
    const userOrgId = getUserOrganizationId(req);
    if (!userOrgId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User organization context missing.",
      });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid policy ID format.",
      });
    }

    // Verify policy existence and tenant ownership
    const policy = await EscalationPolicy.findOne({
      _id: id,
      organization: userOrgId,
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: "Escalation policy not found or access denied.",
      });
    }

    // Whitelist input fields to prevent mass assignment
    const sanitizedUpdates = sanitizePolicyInput(req.body);

    Object.assign(policy, sanitizedUpdates);
    await policy.save();

    return res.status(200).json({
      success: true,
      policy,
    });
  } catch (err) {
    console.error("Error in updateEscalationPolicy:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid policy update attributes.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

/**
 * DELETE /api/escalation-policies/:id
 * Delete escalation policy with organization ownership verification.
 */
export const deleteEscalationPolicy = async (req, res) => {
  try {
    const userOrgId = getUserOrganizationId(req);
    if (!userOrgId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User organization context missing.",
      });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid policy ID format.",
      });
    }

    // Tenant-scoped deletion
    const policy = await EscalationPolicy.findOneAndDelete({
      _id: id,
      organization: userOrgId,
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: "Escalation policy not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Escalation policy deleted successfully.",
    });
  } catch (err) {
    console.error("Error in deleteEscalationPolicy:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
