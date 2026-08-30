import { useState, useCallback } from "react";
import resourceBookingApi from "../services/resourceBookingApi";

export const useResourceBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPhysicalResources = useCallback(async (organizationId) => {
    setLoading(true);
    setError(null);
    try {
      const data =
        await resourceBookingApi.getPhysicalResources(organizationId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createResource = useCallback(async (organizationId, resourceData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await resourceBookingApi.createPhysicalResource(
        organizationId,
        resourceData,
      );
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteResource = useCallback(async (resourceId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await resourceBookingApi.deletePhysicalResource(resourceId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableResources = useCallback(
    async (organizationId, startTime, endTime, type = null) => {
      setLoading(true);
      setError(null);
      try {
        const data = await resourceBookingApi.getAvailableResources(
          organizationId,
          startTime,
          endTime,
          type,
        );
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchResourceBookings = useCallback(async (resourceId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await resourceBookingApi.getResourceBookings(resourceId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrganizationBookings = useCallback(async (organizationId) => {
    setLoading(true);
    setError(null);
    try {
      const data =
        await resourceBookingApi.getOrganizationBookings(organizationId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const bookResource = useCallback(async (organizationId, bookingData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await resourceBookingApi.createBooking(
        organizationId,
        bookingData,
      );
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelResourceBooking = useCallback(async (bookingId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await resourceBookingApi.cancelBooking(bookingId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMeetingBookings = useCallback(async (meetingId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await resourceBookingApi.getMeetingBookings(meetingId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchPhysicalResources,
    createResource,
    deleteResource,
    fetchAvailableResources,
    fetchResourceBookings,
    fetchOrganizationBookings,
    bookResource,
    cancelResourceBooking,
    fetchMeetingBookings,
  };
};

export default useResourceBookings;
