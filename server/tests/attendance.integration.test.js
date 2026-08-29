import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";

const mockCheckIn = jest.fn();
const mockCheckOut = jest.fn();
const mockMarkExcused = jest.fn();
const mockFinalizeAttendance = jest.fn();
const mockFind = jest.fn();

jest.unstable_mockModule("../services/meetingAttendanceService.js", () => ({
  checkIn: (...args) => mockCheckIn(...args),
  checkOut: (...args) => mockCheckOut(...args),
  markExcused: (...args) => mockMarkExcused(...args),
  finalizeAttendance: (...args) => mockFinalizeAttendance(...args),
}));

jest.unstable_mockModule("../models/meetingAttendanceModel.js", () => ({
  default: {
    find: (...args) => mockFind(...args),
  },
}));

const { default: meetingAttendanceRoutes } = await import(
  "../routes/meetingAttendanceRoutes.js"
);

describe("Meeting Attendance Server Integration Tests (#2666)", () => {
  let app;
  let unauthApp;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { _id: "user-100", email: "host@example.com" };
      next();
    });
    app.use("/api/meetings/:meetingId/attendance", meetingAttendanceRoutes);

    unauthApp = express();
    unauthApp.use(express.json());
    // userAuth middleware rejects unauthenticated request with 401
    unauthApp.use(
      "/api/meetings/:meetingId/attendance",
      meetingAttendanceRoutes,
    );
  });

  describe("GET /api/meetings/:meetingId/attendance", () => {
    it("returns attendance records for meeting", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const mockRecords = [
        {
          email: "attendee@example.com",
          status: "checked_in",
          joinTime: new Date().toISOString(),
        },
      ];

      mockFind.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(mockRecords),
      });

      const res = await request(app).get(
        `/api/meetings/${meetingId}/attendance`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRecords);
    });

    it("returns 401 unauthenticated when credentials missing", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const res = await request(unauthApp).get(
        `/api/meetings/${meetingId}/attendance`,
      );

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/meetings/:meetingId/attendance/checkin", () => {
    it("checks in participant successfully (happy path)", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const joinTime = new Date().toISOString();
      const mockAttendance = {
        meetingId,
        email: "attendee@example.com",
        status: "checked_in",
        joinTime,
      };

      mockCheckIn.mockResolvedValueOnce(mockAttendance);

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/attendance/checkin`)
        .send({
          email: "attendee@example.com",
          joinTime,
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAttendance);
      expect(mockCheckIn).toHaveBeenCalledWith(
        meetingId,
        "attendee@example.com",
        expect.any(Date),
      );
    });

    it("returns 400 validation error when email is missing", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/attendance/checkin`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email is required for check-in");
    });
  });

  describe("POST /api/meetings/:meetingId/attendance/checkout", () => {
    it("checks out participant successfully (happy path)", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const leaveTime = new Date().toISOString();
      const mockAttendance = {
        meetingId,
        email: "attendee@example.com",
        status: "checked_out",
        leaveTime,
      };

      mockCheckOut.mockResolvedValueOnce(mockAttendance);

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/attendance/checkout`)
        .send({
          email: "attendee@example.com",
          leaveTime,
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAttendance);
      expect(mockCheckOut).toHaveBeenCalledWith(
        meetingId,
        "attendee@example.com",
        expect.any(Date),
      );
    });

    it("returns 400 validation error when email is missing on checkout", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/meetings/${meetingId}/attendance/checkout`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email is required for check-out");
    });
  });
});
