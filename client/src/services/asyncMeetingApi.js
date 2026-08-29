import apiClient from "./apiClient";

export const getAsyncMeetings = (params) => {
  return apiClient.get("/async-meetings", { params });
};

export const submitAsyncUpdate = (id, answers) => {
  return apiClient.post(`/async-meetings/${id}/submit`, { answers });
};

export const createAsyncMeeting = (data) => {
  return apiClient.post("/async-meetings", data);
};

export const getAsyncMeetingById = (id) => {
  return apiClient.get(`/async-meetings/${id}`);
};
