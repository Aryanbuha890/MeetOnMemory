import apiClient from "../services/apiClient";

export const customFieldApi = {
  getDefinitions: async (orgId, { includeInactive = false } = {}) => {
    const res = await apiClient.get(`/api/custom-fields/org/${orgId}`, {
      params: includeInactive ? { includeInactive: true } : undefined,
    });
    return res.data;
  },

  createDefinition: async (orgId, data) => {
    const res = await apiClient.post(`/api/custom-fields/org/${orgId}`, data);
    return res.data;
  },

  updateDefinition: async (orgId, definitionId, data) => {
    const res = await apiClient.patch(
      `/api/custom-fields/org/${orgId}/${definitionId}`,
      data,
    );
    return res.data;
  },

  deleteDefinition: async (orgId, definitionId) => {
    const res = await apiClient.delete(
      `/api/custom-fields/org/${orgId}/${definitionId}`,
    );
    return res.data;
  },

  getMeetingFields: async (meetingId) => {
    const res = await apiClient.get(`/api/custom-fields/meeting/${meetingId}`);
    return res.data;
  },

  setMeetingFields: async (meetingId, _orgId, fields) => {
    const res = await apiClient.post(
      `/api/custom-fields/meeting/${meetingId}`,
      {
        fields,
        customFields: fields,
      },
    );
    return res.data;
  },

  getMeetingsWithFacets: async (filters = []) => {
    const res = await apiClient.post(`/api/custom-fields/query`, { filters });
    return res.data;
  },

  updateMeetingCustomFields: async (meetingId, customFields) => {
    const res = await apiClient.post(
      `/api/custom-fields/meeting/${meetingId}`,
      {
        customFields,
        fields: customFields,
      },
    );
    return res.data;
  },
};
