import api from "./apiClient.js";

const complianceApi = {
  /**
   * Run DLP PII scan on transcript/raw text
   * @param {Object} data - { meetingId, text }
   * @returns {Promise<Object>}
   */
  scanDlp: (data) => api.post("/api/compliance/scan", data),

  /**
   * Get compliance audit logs
   * @param {Object} params - { meetingId }
   * @returns {Promise<Object>}
   */
  getAuditLogs: (params) => api.get("/api/compliance/audit-logs", { params }),

  /**
   * Request entity unmask with justification reason
   * @param {string} auditId
   * @param {Object} data - { reason }
   * @returns {Promise<Object>}
   */
  requestUnmask: (auditId, data) =>
    api.post(`/api/compliance/unmask-request/${auditId}`, data),

  /**
   * Review (approve / reject) entity unmask request
   * @param {string} auditId
   * @param {string} requestId
   * @param {Object} data - { status: "APPROVED" | "REJECTED" }
   * @returns {Promise<Object>}
   */
  reviewUnmask: (auditId, requestId, data) =>
    api.patch(`/api/compliance/unmask-request/${auditId}/${requestId}`, data),
};

export default complianceApi;
