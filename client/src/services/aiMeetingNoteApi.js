import apiClient from "./apiClient";

export const aiMeetingNoteApi = {
  /**
   * List reusable templates
   */
  getTemplates: async () => {
    const res = await apiClient.get("/api/ai-notes/templates");
    return res.data;
  },

  /**
   * Get aggregated notes analytics
   */
  getAnalytics: async (organizationId) => {
    const res = await apiClient.get("/api/ai-notes/analytics/summary", {
      params: { organizationId },
    });
    return res.data;
  },

  /**
   * Get cross-meeting action items
   */
  getCrossMeetingActionItems: async (params = {}) => {
    const res = await apiClient.get("/api/ai-notes/actions/cross-meeting", {
      params,
    });
    return res.data;
  },

  /**
   * List notes with search, pagination, and filters
   */
  getNotes: async (params = {}) => {
    const res = await apiClient.get("/api/ai-notes/records", {
      params,
    });
    return res.data;
  },

  /**
   * Get single note by ID
   */
  getNoteById: async (id) => {
    const res = await apiClient.get(`/api/ai-notes/records/${id}`);
    return res.data;
  },

  /**
   * Generate AI Note from raw content or meeting transcript
   */
  generateAiNote: async (data) => {
    const res = await apiClient.post("/api/ai-notes/generate", data);
    return res.data;
  },

  /**
   * Create Note manually
   */
  createNote: async (data) => {
    const res = await apiClient.post("/api/ai-notes/records", data);
    return res.data;
  },

  /**
   * Update Note
   */
  updateNote: async (id, data) => {
    const res = await apiClient.put(`/api/ai-notes/records/${id}`, data);
    return res.data;
  },

  /**
   * Delete Note
   */
  deleteNote: async (id) => {
    const res = await apiClient.delete(`/api/ai-notes/records/${id}`);
    return res.data;
  },

  /**
   * Review Note status (draft -> in_review -> reviewed -> approved)
   */
  reviewNote: async (id, data) => {
    const res = await apiClient.patch(`/api/ai-notes/${id}/review`, data);
    return res.data;
  },

  /**
   * Toggle Action Item Completion
   */
  toggleActionItemStatus: async (noteId, actionId, status) => {
    const res = await apiClient.patch(
      `/api/ai-notes/${noteId}/actions/${actionId}`,
      { status },
    );
    return res.data;
  },

  /**
   * Restore Note Version
   */
  restoreVersion: async (id, version) => {
    const res = await apiClient.post(`/api/ai-notes/${id}/restore/${version}`);
    return res.data;
  },
};

export default aiMeetingNoteApi;
