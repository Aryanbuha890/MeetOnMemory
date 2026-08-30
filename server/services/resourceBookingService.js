import PhysicalResource from "../models/physicalResourceModel.js";
import ResourceBooking from "../models/resourceBookingModel.js";

class ResourceBookingService {
  /**
   * Check if a resource is available for a given time window.
   */
  async checkAvailability(
    resourceId,
    startTime,
    endTime,
    excludeBookingId = null,
  ) {
    const query = {
      resourceId,
      status: { $ne: "CANCELLED" },
      $or: [
        { startTime: { $lt: endTime, $gte: startTime } },
        { endTime: { $gt: startTime, $lte: endTime } },
        { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
      ],
    };

    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    const conflictingBooking = await ResourceBooking.findOne(query);
    return !conflictingBooking;
  }

  /**
   * Find any overlapping booking for a resource during a time window.
   */
  async findConflictingBooking(
    resourceId,
    startTime,
    endTime,
    excludeBookingId = null,
  ) {
    const query = {
      resourceId,
      status: { $ne: "CANCELLED" },
      $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
    };

    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    return await ResourceBooking.findOne(query).sort({ startTime: 1 });
  }

  /**
   * Generate alternate non-conflicting time slots following a collision.
   */
  async generateAlternateSlotSuggestions(
    resourceId,
    start,
    end,
    conflictingBooking,
  ) {
    const durationMs = end.getTime() - start.getTime();
    const suggestions = [];

    // Suggestion 1: 15 mins after conflicting booking end
    const confEnd = conflictingBooking.endTime
      ? new Date(conflictingBooking.endTime)
      : new Date(start.getTime() + 3600000);
    const suggestion1Start = new Date(confEnd.getTime() + 15 * 60000);
    const suggestion1End = new Date(suggestion1Start.getTime() + durationMs);

    // Suggestion 2: 1 hour after conflicting booking end or next day same time
    const suggestion2Start = new Date(confEnd.getTime() + 60 * 60000);
    const suggestion2End = new Date(suggestion2Start.getTime() + durationMs);

    suggestions.push({
      startTime: suggestion1Start.toISOString(),
      endTime: suggestion1End.toISOString(),
    });
    suggestions.push({
      startTime: suggestion2Start.toISOString(),
      endTime: suggestion2End.toISOString(),
    });

    return suggestions;
  }

  /**
   * Get all available resources of a specific type in an organization during a time window.
   */
  async getAvailableResources(organizationId, startTime, endTime, type = null) {
    const resourceQuery = { organization: organizationId };
    if (type) {
      resourceQuery.type = type;
    }

    const resources = await PhysicalResource.find(resourceQuery);
    const availableResources = [];

    for (const resource of resources) {
      const isAvailable = await this.checkAvailability(
        resource._id,
        startTime,
        endTime,
      );
      if (isAvailable) {
        availableResources.push(resource);
      }
    }

    return availableResources;
  }

  /**
   * Create a new resource booking with conflict detection and suggestions.
   */
  async createBooking(
    resourceId,
    meetingId,
    startTime,
    endTime,
    organizationId,
    extra = {},
  ) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid startTime or endTime provided.");
    }
    if (end <= start) {
      throw new Error("End time must be after start time.");
    }

    const conflictingBooking = await this.findConflictingBooking(
      resourceId,
      start,
      end,
    );

    if (conflictingBooking) {
      const suggestions = await this.generateAlternateSlotSuggestions(
        resourceId,
        start,
        end,
        conflictingBooking,
      );
      const conflictError = new Error(
        "The requested resource is already reserved during this specific interval.",
      );
      conflictError.isConflict = true;
      conflictError.conflictingBooking = conflictingBooking;
      conflictError.suggestions = suggestions;
      throw conflictError;
    }

    const booking = new ResourceBooking({
      resourceId,
      meetingId: meetingId || undefined,
      userId: extra.userId || undefined,
      title: extra.title || "Facility Reservation Event",
      status: "CONFIRMED",
      startTime: start,
      endTime: end,
      organization: organizationId,
    });

    return await booking.save();
  }

  /**
   * Cancel (delete or set status to CANCELLED) a booking.
   */
  async cancelBooking(bookingId) {
    const booking = await ResourceBooking.findById(bookingId);
    if (!booking) return null;
    return await ResourceBooking.findByIdAndDelete(bookingId);
  }

  /**
   * Get bookings for a specific resource.
   */
  async getBookingsForResource(resourceId, startTime = null, endTime = null) {
    const query = {
      resourceId,
      status: { $ne: "CANCELLED" },
    };

    if (startTime || endTime) {
      query.$and = [];
      if (startTime) {
        query.$and.push({ endTime: { $gte: new Date(startTime) } });
      }
      if (endTime) {
        query.$and.push({ startTime: { $lte: new Date(endTime) } });
      }
    }

    return await ResourceBooking.find(query)
      .populate("userId", "name email profilePicture")
      .populate("resourceId", "name type capacity location")
      .sort({ startTime: 1 });
  }

  /**
   * Get all bookings for an organization.
   */
  async getOrganizationBookings(organizationId) {
    return await ResourceBooking.find({
      organization: organizationId,
      status: { $ne: "CANCELLED" },
    })
      .populate("userId", "name email profilePicture")
      .populate("resourceId", "name type capacity location")
      .sort({ startTime: 1 });
  }

  /**
   * Get bookings for a specific meeting.
   */
  async getBookingsForMeeting(meetingId) {
    return await ResourceBooking.find({
      meetingId,
      status: { $ne: "CANCELLED" },
    }).populate("resourceId");
  }

  /**
   * Get all physical resources for an organization.
   */
  async getPhysicalResources(organizationId) {
    return await PhysicalResource.find({ organization: organizationId });
  }

  /**
   * Create a physical resource.
   */
  async createPhysicalResource(data) {
    const resource = new PhysicalResource(data);
    return await resource.save();
  }

  /**
   * Delete a physical resource and any associated bookings.
   */
  async deletePhysicalResource(resourceId) {
    await ResourceBooking.deleteMany({ resourceId });
    return await PhysicalResource.findByIdAndDelete(resourceId);
  }
}

export default new ResourceBookingService();
