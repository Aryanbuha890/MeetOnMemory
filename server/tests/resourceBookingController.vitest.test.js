import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/physicalResourceModel.js", () => {
  function MockPhysicalResource(data) {
    Object.assign(this, data);
    this._id = "res-123";
    this.save = vi.fn().mockResolvedValue(this);
  }
  MockPhysicalResource.find = vi.fn();
  MockPhysicalResource.findById = vi.fn();
  MockPhysicalResource.findByIdAndDelete = vi.fn();
  return { default: MockPhysicalResource };
});

vi.mock("../models/resourceBookingModel.js", () => {
  function MockResourceBooking(data) {
    Object.assign(this, data);
    this._id = "book-123";
    this.save = vi.fn().mockResolvedValue(this);
  }
  MockResourceBooking.find = vi.fn();
  MockResourceBooking.findOne = vi.fn();
  MockResourceBooking.findById = vi.fn();
  MockResourceBooking.findByIdAndDelete = vi.fn();
  MockResourceBooking.deleteMany = vi.fn();
  return { default: MockResourceBooking };
});

const {
  createBooking,
  getPhysicalResources,
  createPhysicalResource,
  deletePhysicalResource,
  getAvailableResources,
  getResourceBookings,
  cancelBooking,
} = await import("../controllers/resourceBookingController.js");

const PhysicalResource = (await import("../models/physicalResourceModel.js"))
  .default;
const ResourceBooking = (await import("../models/resourceBookingModel.js"))
  .default;

describe("resourceBookingController (#2462)", () => {
  let req, res;
  const mockUserId = "507f1f77bcf86cd799439011";
  const mockOrgId = "507f1f77bcf86cd799439022";
  const mockResourceId = "507f1f77bcf86cd799439033";

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: {
        _id: mockUserId,
        id: mockUserId,
        organization: mockOrgId,
        role: "admin",
      },
      params: {},
      query: {},
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe("createBooking", () => {
    it("creates a resource booking successfully when no conflict exists", async () => {
      req.body = {
        resourceId: mockResourceId,
        title: "Team Sync",
        startTime: "2026-10-01T10:00:00.000Z",
        endTime: "2026-10-01T11:00:00.000Z",
      };

      ResourceBooking.findOne.mockReturnValue({
        sort: vi.fn().mockResolvedValue(null),
      });

      await createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: mockResourceId,
          title: "Team Sync",
          status: "CONFIRMED",
        }),
      );
    });

    it("returns 409 conflict and suggestions when an overlapping interval is detected", async () => {
      const existingConfEnd = new Date("2026-10-01T11:30:00.000Z");
      req.body = {
        resourceId: mockResourceId,
        title: "Conflicting Session",
        startTime: "2026-10-01T10:00:00.000Z",
        endTime: "2026-10-01T11:00:00.000Z",
      };

      ResourceBooking.findOne.mockReturnValue({
        sort: vi.fn().mockResolvedValue({
          _id: "existing-book-1",
          resourceId: mockResourceId,
          startTime: new Date("2026-10-01T09:30:00.000Z"),
          endTime: existingConfEnd,
          title: "Executive Review",
          status: "CONFIRMED",
        }),
      });

      await createBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "CONFLICT",
          message: expect.stringContaining("already reserved"),
          suggestions: expect.arrayContaining([
            expect.objectContaining({
              startTime: expect.any(String),
              endTime: expect.any(String),
            }),
          ]),
        }),
      );
    });
  });

  describe("getResourceBookings", () => {
    it("returns all active bookings for a resource", async () => {
      req.params = { resourceId: mockResourceId };

      const mockBookings = [
        {
          _id: "b1",
          resourceId: mockResourceId,
          title: "Planning",
          startTime: new Date("2026-10-01T14:00:00.000Z"),
          endTime: new Date("2026-10-01T15:00:00.000Z"),
        },
      ];

      const sortMock = vi.fn().mockResolvedValue(mockBookings);
      const populate2 = vi.fn().mockReturnValue({ sort: sortMock });
      const populate1 = vi.fn().mockReturnValue({ populate: populate2 });
      ResourceBooking.find.mockReturnValue({ populate: populate1 });

      await getResourceBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockBookings);
    });
  });

  describe("getAvailableResources", () => {
    it("returns available resources during requested time slot", async () => {
      req.params = { organizationId: mockOrgId };
      req.query = {
        startTime: "2026-10-01T10:00:00.000Z",
        endTime: "2026-10-01T11:00:00.000Z",
      };

      PhysicalResource.find.mockResolvedValue([
        { _id: "res-1", name: "Boardroom", type: "room" },
      ]);
      ResourceBooking.findOne.mockResolvedValue(null);

      await getAvailableResources(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { _id: "res-1", name: "Boardroom", type: "room" },
      ]);
    });
  });

  describe("cancelBooking", () => {
    it("cancels / deletes booking by ID", async () => {
      req.params = { bookingId: "book-123" };
      ResourceBooking.findById.mockResolvedValue({ _id: "book-123" });
      ResourceBooking.findByIdAndDelete.mockResolvedValue({ _id: "book-123" });

      await cancelBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Booking cancelled successfully",
      });
    });
  });

  describe("getPhysicalResources & createPhysicalResource", () => {
    it("fetches physical resources for organization", async () => {
      req.params = { organizationId: mockOrgId };
      PhysicalResource.find.mockResolvedValue([
        { _id: "res-1", name: "Boardroom", type: "room" },
      ]);

      await getPhysicalResources(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { _id: "res-1", name: "Boardroom", type: "room" },
      ]);
    });

    it("creates a physical resource", async () => {
      req.params = { organizationId: mockOrgId };
      req.body = {
        name: "Video Studio",
        type: "equipment",
        capacity: 4,
      };

      await createPhysicalResource(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Video Studio",
          type: "equipment",
        }),
      );
    });

    it("deletes a physical resource and cascading bookings", async () => {
      req.params = { resourceId: "res-1" };
      PhysicalResource.findByIdAndDelete.mockResolvedValue({ _id: "res-1" });
      ResourceBooking.deleteMany.mockResolvedValue({ deletedCount: 2 });

      await deletePhysicalResource(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Physical resource deleted successfully",
      });
    });
  });
});
