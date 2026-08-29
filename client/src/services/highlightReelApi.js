import apiClient from "./apiClient.js";

/**
 * Highlight Reel API Service
 * Uses the application's central apiClient instance (ensuring port 4000 resolution
 * and automatic Clerk Bearer token injection).
 */
const highlightReelApi = {
  /**
   * Triggers the generation of the highlight reel
   * @param {string} meetingId - Meeting ID
   */
  generateHighlightReel: (meetingId) => {
    return apiClient.post(`/api/meetings/${meetingId}/highlight-reel/generate`);
  },

  /**
   * Fetches the current highlight reel
   * @param {string} meetingId - Meeting ID
   */
  getHighlightReel: (meetingId) => {
    return apiClient.get(`/api/meetings/${meetingId}/highlight-reel`);
  },

  /**
   * Updates the highlight reel (narrative or highlights)
   * @param {string} meetingId - Meeting ID
   * @param {Object} updateData - Data containing narrative and/or highlights
   */
  updateHighlightReel: (meetingId, updateData) => {
    return apiClient.put(
      `/api/meetings/${meetingId}/highlight-reel`,
      updateData,
    );
  },

  /**
   * Exports the highlight reel to HTML
   * @param {string} meetingId - Meeting ID
   * @param {Object} config - Optional config like onDownloadProgress
   */
  exportHighlightReelHtml: (meetingId, config = {}) => {
    return apiClient.get(`/api/meetings/${meetingId}/highlight-reel/export`, {
      responseType: "blob",
      ...config,
    });
  },
};

export default highlightReelApi;
