import apiClient from "./apiClient.js";

export const meetingROIApi = {
  /**
   * Fetch paginated and filtered ROI records
   */
  getROIRecords: async (params = {}) => {
    const response = await apiClient.get("/api/meeting-roi/records", {
      params,
    });
    return response.data;
  },

  /**
   * Get single ROI record by ID
   */
  getROIRecordById: async (id) => {
    const response = await apiClient.get(`/api/meeting-roi/records/${id}`);
    return response.data;
  },

  /**
   * Get ROI record linked to a meeting ID
   */
  getROIRecordByMeeting: async (meetingId) => {
    const response = await apiClient.get(
      `/api/meeting-roi/meeting/${meetingId}`,
    );
    return response.data;
  },

  /**
   * Create new ROI record
   */
  createROIRecord: async (payload) => {
    const response = await apiClient.post("/api/meeting-roi/records", payload);
    return response.data;
  },

  /**
   * Update an existing ROI record
   */
  updateROIRecord: async (id, payload) => {
    const response = await apiClient.put(
      `/api/meeting-roi/records/${id}`,
      payload,
    );
    return response.data;
  },

  /**
   * Delete an ROI record
   */
  deleteROIRecord: async (id) => {
    const response = await apiClient.delete(`/api/meeting-roi/records/${id}`);
    return response.data;
  },

  /**
   * Fetch aggregated analytics summary for the ROI dashboard
   */
  getROIDashboardSummary: async (params = {}) => {
    const response = await apiClient.get("/api/meeting-roi/analytics/summary", {
      params,
    });
    return response.data;
  },

  /**
   * Calculate What-If scenario simulation
   */
  simulateWhatIf: async (payload) => {
    const response = await apiClient.post("/api/meeting-roi/simulate", payload);
    return response.data;
  },
};

export default meetingROIApi;
