import apiClient from "./apiClient";

const transferApi = {
  // Initiate a transfer request
  initiateTransfer: (meetingId, targetUserId) =>
    apiClient.post(`/meetings/${meetingId}/transfers`, { targetUserId }),

  // Get pending transfers for the current user
  getTransferInbox: () => apiClient.get("/ownership-transfers/inbox"),

  // Accept a transfer request
  acceptTransfer: (transferId) =>
    apiClient.post(`/ownership-transfers/${transferId}/accept`),

  // Reject a transfer request
  rejectTransfer: (transferId) =>
    apiClient.post(`/ownership-transfers/${transferId}/reject`),
};

export default transferApi;
