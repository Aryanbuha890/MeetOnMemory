import apiClient from "./apiClient";

export const getMeetingAttendance = (meetingId) => {
  return apiClient.get(`/meetings/${meetingId}/attendance`);
};

export const checkIn = (meetingId, email, joinTime) => {
  return apiClient.post(`/meetings/${meetingId}/attendance/checkin`, {
    email,
    joinTime,
  });
};

export const checkOut = (meetingId, email, leaveTime) => {
  return apiClient.post(`/meetings/${meetingId}/attendance/checkout`, {
    email,
    leaveTime,
  });
};

export const markExcused = (meetingId, email) => {
  return apiClient.put(`/meetings/${meetingId}/attendance/excuse`, { email });
};

export const finalizeAttendance = (meetingId) => {
  return apiClient.post(`/meetings/${meetingId}/attendance/finalize`);
};
