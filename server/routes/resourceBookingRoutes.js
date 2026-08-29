import express from "express";
import {
  getPhysicalResources,
  createPhysicalResource,
  deletePhysicalResource,
  getAvailableResources,
  createBooking,
  cancelBooking,
  getResourceBookings,
  getOrganizationBookings,
  getMeetingBookings,
} from "../controllers/resourceBookingController.js";
import protect from "../middleware/userAuth.js";

const router = express.Router();

router.use(protect);

// Physical Resource management
router.get("/organization/:organizationId", getPhysicalResources);
router.get("/organization/:organizationId/resources", getPhysicalResources);
router.post("/organization/:organizationId", createPhysicalResource);
router.post("/organization/:organizationId/resources", createPhysicalResource);
router.delete(
  "/organization/:organizationId/resource/:resourceId",
  deletePhysicalResource,
);
router.delete("/:resourceId", deletePhysicalResource);

// Resource availability & calendar timeline
router.get("/organization/:organizationId/available", getAvailableResources);
router.get("/organization/:organizationId/bookings", getOrganizationBookings);
router.get("/resource/:resourceId/bookings", getResourceBookings);
router.get("/:resourceId/bookings", getResourceBookings);

// Bookings creation and cancellation
router.post("/organization/:organizationId/bookings", createBooking);
router.post("/bookings/create", createBooking);
router.post("/bookings", createBooking);
router.delete("/bookings/:bookingId", cancelBooking);
router.post("/bookings/:bookingId/cancel", cancelBooking);
router.delete("/:bookingId/cancel", cancelBooking);

// Meeting specific bookings
router.get("/meetings/:meetingId/bookings", getMeetingBookings);

export default router;
