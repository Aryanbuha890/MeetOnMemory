import piiRedactionService from "../services/piiRedactionService.js";
import RedactionAudit from "../models/redactionAuditModel.js";

/**
 * Helper to resolve organizationId from req
 */
const getOrganizationId = (req) => {
  return (
    req.user?.organizationId ||
    req.user?.organization?._id ||
    req.user?.organization ||
    req.headers["x-organization-id"]
  );
};

/**
 * Controller handling PII redaction and DLP compliance audit operations
 */
export const scanTranscriptDlp = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const { meetingId, text } = req.body;

    if (!text) {
      return res
        .status(400)
        .json({ error: "Text payload is required for DLP scanning" });
    }

    const result = await piiRedactionService.scanAndRedact({
      organizationId,
      meetingId,
      text,
      persistAudit: true,
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getComplianceAuditLogs = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res
        .status(400)
        .json({ error: "Organization context is required" });
    }

    const { meetingId } = req.query;
    const logs = await piiRedactionService.getAuditLogs(
      organizationId,
      meetingId,
    );

    return res.status(200).json({ logs });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const requestEntityUnmask = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id || req.user?.id;
    const { auditId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ error: "Justification reason is required" });
    }

    const audit = await RedactionAudit.findOne({
      _id: auditId,
      ...(organizationId ? { organizationId } : {}),
    });
    if (!audit) {
      return res.status(404).json({ error: "Audit record not found" });
    }

    audit.unmaskRequests.push({
      requestedBy: userId,
      reason,
      status: "PENDING",
    });

    await audit.save();

    return res.status(200).json({
      message: "Unmask request submitted for compliance officer review",
      audit,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const reviewUnmaskRequest = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const reviewerId = req.user?._id || req.user?.id;
    const { auditId, requestId } = req.params;
    const { status } = req.body; // "APPROVED" | "REJECTED"

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Valid status (APPROVED or REJECTED) is required" });
    }

    const audit = await RedactionAudit.findOne({
      _id: auditId,
      ...(organizationId ? { organizationId } : {}),
    });
    if (!audit) {
      return res.status(404).json({ error: "Audit record not found" });
    }

    const requestItem = audit.unmaskRequests.id(requestId);
    if (!requestItem) {
      return res.status(404).json({ error: "Unmask request not found" });
    }

    requestItem.status = status;
    requestItem.reviewedBy = reviewerId;
    requestItem.reviewedAt = new Date();

    await audit.save();

    return res.status(200).json({
      message: `Unmask request ${status.toLowerCase()} successfully`,
      audit,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
