import apiClient from "./apiClient";

export const keyMomentApi = {
  createMoment: async (data) => {
    const response = await apiClient.post("/api/key-moments", data);
    return response.data;
  },

  fetchMoments: async (meetingId) => {
    const response = await apiClient.get(
      `/api/key-moments/meeting/${meetingId}`,
    );
    return response.data;
  },

  updateMoment: async (id, data) => {
    const response = await apiClient.patch(`/api/key-moments/${id}`, data);
    return response.data;
  },

  deleteMoment: async (id) => {
    const response = await apiClient.delete(`/api/key-moments/${id}`);
    return response.data;
  },

  exportMoments: async (meetingId) => {
    const response = await apiClient.get(
      `/api/key-moments/export?meetingId=${meetingId}`,
      { responseType: "blob" },
    );
    return response.data;
  },
};

export default keyMomentApi;
