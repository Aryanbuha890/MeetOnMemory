import resourceBookingService from "../services/resourceBookingService.js";
import PhysicalResource from "../models/physicalResourceModel.js";

// Fetch physical resources for an organization
export const getPhysicalResources = async (req, res) => {
  try {
    const organizationId =
      req.params.organizationId ||
      req.user?.organization?._id ||
      req.user?.organization;

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization ID is required",
      });
    }

    const resources =
      await resourceBookingService.getPhysicalResources(organizationId);
    return res.status(200).json(resources);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch physical resources",
      error: error.message,
    });
  }
};

// Create a physical resource
export const createPhysicalResource = async (req, res) => {
  try {
    const organizationId =
      req.params.organizationId ||
      req.user?.organization?._id ||
      req.user?.organization;

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization ID is required",
      });
    }

    const data = { ...req.body, organization: organizationId };
    const resource = await resourceBookingService.createPhysicalResource(data);
    return res.status(201).json(resource);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create physical resource",
      error: error.message,
    });
  }
};

// Delete a physical resource
export const deletePhysicalResource = async (req, res) => {
  try {
    const resourceId = req.params.resourceId || req.params.id;
    if (!resourceId) {
      return res.status(400).json({ message: "Resource ID is required" });
    }

    await resourceBookingService.deletePhysicalResource(resourceId);
    return res
      .status(200)
      .json({ message: "Physical resource deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete physical resource",
      error: error.message,
    });
  }
};

// Get available resources for a specific time window
export const getAvailableResources = async (req, res) => {
  try {
    const organizationId =
      req.params.organizationId ||
      req.user?.organization?._id ||
      req.user?.organization;
    const { startTime, endTime, type } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        message: "startTime and endTime are required query parameters",
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization ID is required",
      });
    }

    const availableResources =
      await resourceBookingService.getAvailableResources(
        organizationId,
        new Date(startTime),
        new Date(endTime),
        type,
      );
    return res.status(200).json(availableResources);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch available resources",
      error: error.message,
    });
  }
};

// Create a resource booking with strict overlapping interval protection & conflict suggestions
export const createBooking = async (req, res) => {
  try {
    const { resourceId, meetingId, startTime, endTime, title } = req.body;
    let organizationId =
      req.params.organizationId ||
      req.body.organizationId ||
      req.user?.organization?._id ||
      req.user?.organization;

    if (!resourceId || !startTime || !endTime) {
      return res.status(400).json({
        message: "resourceId, startTime, and endTime are required",
      });
    }

    if (!organizationId) {
      const resource = await PhysicalResource.findById(resourceId);
      if (resource) {
        organizationId = resource.organization;
      }
    }

    const userId = req.user?._id || req.user?.id;

    const booking = await resourceBookingService.createBooking(
      resourceId,
      meetingId,
      startTime,
      endTime,
      organizationId,
      {
        userId,
        title: title || "Facility Reservation Event",
      },
    );

    return res.status(201).json(booking);
  } catch (error) {
    if (
      error.isConflict ||
      error.message ===
        "Resource is not available during the requested time." ||
      error.message ===
        "The requested resource is already reserved during this specific interval."
    ) {
      return res.status(409).json({
        error: "CONFLICT",
        message:
          error.message ||
          "The requested resource is already reserved during this specific interval.",
        conflictingBooking: error.conflictingBooking || null,
        suggestions: error.suggestions || [],
      });
    }
    return res.status(500).json({
      error: "Internal scheduling pipeline exception.",
      message: error.message,
    });
  }
};

// Get bookings for a specific resource
export const getResourceBookings = async (req, res) => {
  try {
    const resourceId = req.params.resourceId || req.params.id;
    const { startTime, endTime } = req.query;

    if (!resourceId) {
      return res.status(400).json({ message: "Resource ID is required" });
    }

    const bookings = await resourceBookingService.getBookingsForResource(
      resourceId,
      startTime,
      endTime,
    );
    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch resource bookings",
      error: error.message,
    });
  }
};

// Get all bookings for an organization
export const getOrganizationBookings = async (req, res) => {
  try {
    const organizationId =
      req.params.organizationId ||
      req.user?.organization?._id ||
      req.user?.organization;

    if (!organizationId) {
      return res.status(400).json({ message: "Organization ID is required" });
    }

    const bookings =
      await resourceBookingService.getOrganizationBookings(organizationId);
    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch organization bookings",
      error: error.message,
    });
  }
};

// Cancel a resource booking
export const cancelBooking = async (req, res) => {
  try {
    const bookingId = req.params.bookingId || req.params.id;
    if (!bookingId) {
      return res.status(400).json({ message: "Booking ID is required" });
    }

    await resourceBookingService.cancelBooking(bookingId);
    return res.status(200).json({ message: "Booking cancelled successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to cancel booking", error: error.message });
  }
};

// Get bookings for a specific meeting
export const getMeetingBookings = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const bookings =
      await resourceBookingService.getBookingsForMeeting(meetingId);
    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch meeting bookings",
      error: error.message,
    });
  }
};
