import api from "./apiClient";

export const resourceBookingApi = {
  // Fetch all physical resources for an organization
  getPhysicalResources: async (organizationId) => {
    const response = await api.get(
      `/api/physical-resources/organization/${organizationId}`,
    );
    return response.data;
  },

  // Create a new physical resource
  createPhysicalResource: async (organizationId, resourceData) => {
    const response = await api.post(
      `/api/physical-resources/organization/${organizationId}`,
      resourceData,
    );
    return response.data;
  },

  // Delete a physical resource
  deletePhysicalResource: async (resourceId) => {
    const response = await api.delete(`/api/physical-resources/${resourceId}`);
    return response.data;
  },

  // Get available resources for a time window
  getAvailableResources: async (
    organizationId,
    startTime,
    endTime,
    type = null,
  ) => {
    const startIso =
      startTime instanceof Date ? startTime.toISOString() : startTime;
    const endIso = endTime instanceof Date ? endTime.toISOString() : endTime;

    const params = new URLSearchParams({
      startTime: startIso,
      endTime: endIso,
    });
    if (type) params.append("type", type);

    const response = await api.get(
      `/api/physical-resources/organization/${organizationId}/available?${params.toString()}`,
    );
    return response.data;
  },

  // Get all active bookings for a specific resource
  getResourceBookings: async (resourceId) => {
    const response = await api.get(
      `/api/physical-resources/resource/${resourceId}/bookings`,
    );
    return response.data;
  },

  // Get all bookings for an organization
  getOrganizationBookings: async (organizationId) => {
    const response = await api.get(
      `/api/physical-resources/organization/${organizationId}/bookings`,
    );
    return response.data;
  },

  // Book a resource (handles 409 conflict responses in caller)
  createBooking: async (organizationId, bookingData) => {
    const targetUrl = organizationId
      ? `/api/physical-resources/organization/${organizationId}/bookings`
      : `/api/physical-resources/bookings/create`;
    const response = await api.post(targetUrl, bookingData);
    return response.data;
  },

  // Cancel / revoke a booking
  cancelBooking: async (bookingId) => {
    const response = await api.delete(
      `/api/physical-resources/bookings/${bookingId}`,
    );
    return response.data;
  },

  // Get bookings for a specific meeting
  getMeetingBookings: async (meetingId) => {
    const response = await api.get(
      `/api/physical-resources/meetings/${meetingId}/bookings`,
    );
    return response.data;
  },
};

export default resourceBookingApi;
