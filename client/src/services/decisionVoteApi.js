import apiClient from "./apiClient";

export const decisionVoteApi = {
  castVote: async (decisionId, vote) => {
    const response = await apiClient.post(`/api/decisions/${decisionId}/vote`, {
      vote,
    });
    return response.data;
  },

  getConsensus: async (decisionId) => {
    const response = await apiClient.get(
      `/api/decisions/${decisionId}/consensus`,
    );
    return response.data;
  },

  getMeetingDecisionsConsensus: async (meetingId) => {
    const response = await apiClient.get(`/api/decisions/meeting/${meetingId}`);
    return response.data;
  },
};

export default decisionVoteApi;
