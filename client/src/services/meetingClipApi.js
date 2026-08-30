import apiClient from "./apiClient";

const meetingClipApi = {
  createClip: async (clipData) => {
    const response = await apiClient.post("/api/clips", clipData);
    return response.data;
  },

  getMeetingClips: async (meetingId) => {
    const response = await apiClient.get(`/api/clips/meeting/${meetingId}`);
    return response.data;
  },

  updateClip: async (clipId, updateData) => {
    const response = await apiClient.put(`/api/clips/${clipId}`, updateData);
    return response.data;
  },

  deleteClip: async (clipId) => {
    const response = await apiClient.delete(`/api/clips/${clipId}`);
    return response.data;
  },

  addClipAnnotation: async (clipId, annotationData) => {
    const response = await apiClient.post(
      `/api/clips/${clipId}/annotations`,
      annotationData,
    );
    return response.data;
  },
  trimClip: async (clipId, trimData) => {
    const response = await apiClient.post(
      `/api/clips/${clipId}/trim`,
      trimData,
    );
    return response.data;
  },
  mergeClips: async (mergeData) => {
    const response = await apiClient.post("/api/clips/merge", mergeData);
    return response.data;
  },
};

export default meetingClipApi;
