import apiClient from "./apiClient";

export const mindMapApi = {
  getMindMap: async (meetingId) => {
    const response = await apiClient.get(`/api/mindmap/${meetingId}`);
    return response.data;
  },

  saveMindMap: async (meetingId, nodes, connections) => {
    const response = await apiClient.post(`/api/mindmap/${meetingId}`, {
      nodes,
      connections,
    });
    return response.data;
  },

  convertNodeToActionItem: async (
    meetingId,
    { nodeId, assignee, dueDate, priority },
  ) => {
    const response = await apiClient.post(
      `/api/mindmap/${meetingId}/convert-node`,
      {
        nodeId,
        assignee,
        dueDate,
        priority,
      },
    );
    return response.data;
  },
};

export default mindMapApi;
