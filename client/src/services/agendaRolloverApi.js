import apiClient from "./apiClient";

export const agendaRolloverApi = {
  rolloverAgenda: async (meetingId, sourceMeetingId) => {
    const response = await apiClient.post(
      `/api/meetings/${meetingId}/rollover`,
      {
        sourceMeetingId,
      },
    );
    return response.data;
  },

  previewRollover: async (sourceMeetingId) => {
    const response = await apiClient.get(`/api/meetings/rollover/preview`, {
      params: { sourceMeetingId },
    });
    return response.data;
  },
};

export default agendaRolloverApi;
