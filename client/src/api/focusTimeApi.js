import apiClient from "../services/apiClient";

const FOCUS_TIME_URL = "/api/focus-time";

export const focusTimeApi = {
  getBlocks: async () => {
    const response = await apiClient.get(FOCUS_TIME_URL);
    return response.data;
  },

  createBlock: async (data) => {
    const response = await apiClient.post(FOCUS_TIME_URL, data);
    return response.data;
  },

  updateBlock: async (id, data) => {
    const response = await apiClient.put(`${FOCUS_TIME_URL}/${id}`, data);
    return response.data;
  },

  deleteBlock: async (id) => {
    const response = await apiClient.delete(`${FOCUS_TIME_URL}/${id}`);
    return response.data;
  },

  getAnalytics: async (startDate, endDate) => {
    const response = await apiClient.get(`${FOCUS_TIME_URL}/analytics`, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  checkConflicts: async (startTime, endTime, userId) => {
    const response = await apiClient.get(`${FOCUS_TIME_URL}/conflicts`, {
      params: { startTime, endTime, userId },
    });
    return response.data;
  },
};
