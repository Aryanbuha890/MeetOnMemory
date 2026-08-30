import apiClient from "./apiClient";

/**
 * Creates a new guest access token for a meeting.
 * @param {String} meetingId
 * @param {Object} data { guestEmail, label, permissions, expiresAt, maxViews }
 */
export const createGuestToken = async (meetingId, data) => {
  const response = await apiClient.post(
    `/api/meetings/${meetingId}/guest-tokens`,
    data,
  );
  return response.data;
};

/**
 * Fetches all guest tokens for a meeting.
 * @param {String} meetingId
 */
export const getMeetingGuestTokens = async (meetingId) => {
  const response = await apiClient.get(
    `/api/meetings/${meetingId}/guest-tokens`,
  );
  return response.data;
};

/**
 * Revokes a specific guest token.
 * @param {String} tokenId
 */
export const revokeGuestToken = async (tokenId) => {
  const response = await apiClient.post(`/api/guest-tokens/${tokenId}/revoke`);
  return response.data;
};

/**
 * Fetches host telemetry metrics, token audit trail, and guest feedback records.
 * @param {String} meetingId
 */
export const getHostAnalytics = async (meetingId) => {
  const response = await apiClient.get(
    `/api/guest-access/analytics/${meetingId}`,
  );
  return response.data;
};

/**
 * Downloads guest feedback records as a CSV attachment.
 * @param {String} meetingId
 */
export const exportFeedbackCSV = async (meetingId) => {
  const response = await apiClient.get(
    `/api/guest-access/feedback/export?meetingId=${meetingId}`,
    {
      responseType: "blob",
    },
  );

  // Trigger browser file download
  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `meeting-${meetingId}-feedback.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  return response.data;
};

/**
 * Unauthenticated: fetches meeting data for a guest token.
 * @param {String} token
 */
export const getGuestMeetingData = async (token) => {
  const response = await apiClient.get(`/api/guest/meeting/${token}`);
  return response.data;
};

/**
 * Unauthenticated: records guest join action.
 * @param {String} token
 */
export const recordGuestJoin = async (token) => {
  const response = await apiClient.post(`/api/guest/meeting/${token}/join`);
  return response.data;
};

/**
 * Unauthenticated: posts a comment as a guest.
 * @param {String} token
 * @param {Object} commentData { body }
 */
export const addGuestComment = async (token, commentData) => {
  const response = await apiClient.post(
    `/api/guest/meeting/${token}/comments`,
    commentData,
  );
  return response.data;
};

/**
 * Unauthenticated: submits guest rating & feedback.
 * @param {String} token
 * @param {Object} feedbackData { rating, comments, guestName }
 */
export const submitGuestFeedback = async (token, feedbackData) => {
  const response = await apiClient.post(
    `/api/guest/meeting/${token}/feedback`,
    feedbackData,
  );
  return response.data;
};

export default {
  createGuestToken,
  getMeetingGuestTokens,
  revokeGuestToken,
  getHostAnalytics,
  exportFeedbackCSV,
  getGuestMeetingData,
  recordGuestJoin,
  addGuestComment,
  submitGuestFeedback,
};
