import apiClient from "./apiClient";

/**
 * Clones a meeting by ID
 * @param {string} meetingId
 * @param {Object} options - { includeAgenda, includeParticipants, includeCustomFields }
 */
export const cloneMeetingApi = async (meetingId, options = {}) => {
  const response = await apiClient.post(
    `/api/meetings/${meetingId}/clone`,
    options,
  );
  return response.data;
};

/**
 * Instantiates a meeting template by ID
 * @param {string} templateId
 * @param {Object} options - { newDate }
 */
export const instantiateTemplateApi = async (templateId, options = {}) => {
  const response = await apiClient.post(
    `/api/meeting-templates/${templateId}/instantiate`,
    options,
  );
  return response.data;
};
