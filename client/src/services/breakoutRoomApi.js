import apiClient from "./apiClient.js";

/**
 * Breakout Room Client API Service
 * Uses central apiClient instance with port 4000 resolution and automatic Clerk auth.
 */
export const breakoutRoomApi = {
  createRoom: async (meetingId, name) => {
    const response = await apiClient.post(
      `/api/meetings/${meetingId}/breakout-rooms`,
      { name },
    );
    return response.data;
  },

  getRooms: async (meetingId) => {
    const response = await apiClient.get(
      `/api/meetings/${meetingId}/breakout-rooms`,
    );
    return response.data;
  },

  assignParticipants: async (meetingId, roomId, participantIds) => {
    const response = await apiClient.put(
      `/api/meetings/${meetingId}/breakout-rooms/${roomId}/participants`,
      { participantIds },
    );
    return response.data;
  },

  randomAssign: async (meetingId, roomIds, participantIds) => {
    const response = await apiClient.post(
      `/api/meetings/${meetingId}/breakout-rooms/random-assign`,
      { meetingId, roomIds, participantIds },
    );
    return response.data;
  },

  broadcastMessage: async (meetingId, message) => {
    const response = await apiClient.post(
      `/api/meetings/${meetingId}/breakout-rooms/broadcast`,
      { meetingId, message },
    );
    return response.data;
  },

  closeAllRooms: async (meetingId) => {
    const response = await apiClient.post(
      `/api/meetings/${meetingId}/breakout-rooms/close-all`,
      { meetingId },
    );
    return response.data;
  },

  startRoom: async (meetingId, roomId) => {
    const response = await apiClient.post(
      `/api/meetings/${meetingId}/breakout-rooms/${roomId}/start`,
    );
    return response.data;
  },

  closeRoom: async (meetingId, roomId) => {
    const response = await apiClient.post(
      `/api/meetings/${meetingId}/breakout-rooms/${roomId}/close`,
    );
    return response.data;
  },
};

export default breakoutRoomApi;
