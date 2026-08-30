import { jest } from "@jest/globals";

jest.unstable_mockModule("../models/absenteeCatchUpModel.js", () => ({
  default: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/meetingRsvpModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule("../services/GenerativeAIService.js", () => ({
  generateAbsenteeCatchUpAI: jest.fn(),
}));

jest.unstable_mockModule("../services/EmailService.js", () => ({
  default: {
    sendMail: jest.fn(),
    sendAbsenteeCatchUpEmail: jest.fn(),
  },
}));

jest.unstable_mockModule("../services/notificationService.js", () => ({
  createNotification: jest.fn(),
  createNotifications: jest.fn(),
}));

const AbsenteeCatchUp = (await import("../models/absenteeCatchUpModel.js"))
  .default;
const Meeting = (await import("../models/meetingModel.js")).default;
const userModel = (await import("../models/userModel.js")).default;
const { generateAbsenteeCatchUpAI } =
  await import("../services/GenerativeAIService.js");
const EmailService = (await import("../services/EmailService.js")).default;
const { createNotification } =
  await import("../services/notificationService.js");
const {
  getMeetingCatchUp,
  generateMeetingCatchUp,
  generateAndDeliverCatchUp,
  markCatchUpAsRead,
  getMyCatchUps,
} = await import("../controllers/absenteeCatchUpController.js");
const AbsenteeCatchUpService = (
  await import("../services/absenteeCatchUpService.js")
).default;

describe("Absentee Catch-Up & Organizer Delivery (#2457)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Controller Endpoints", () => {
    it("fetches meeting catch-up for authenticated user", async () => {
      const mockCatchUp = {
        _id: "catchup_1",
        meetingId: "m_1",
        userId: "u_1",
        content: { overview: "Summary overview" },
      };

      AbsenteeCatchUp.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCatchUp),
      });

      const req = {
        user: { _id: "u_1" },
        params: { meetingId: "m_1" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getMeetingCatchUp(req, res);

      expect(AbsenteeCatchUp.findOne).toHaveBeenCalledWith({
        meetingId: "m_1",
        userId: "u_1",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        catchUp: mockCatchUp,
      });
    });

    it("generates personalized meeting catch-up briefing", async () => {
      const mockMeeting = {
        _id: "m_1",
        title: "Sprint Planning",
        date: new Date(),
        summary: "Planned sprint backlog",
        structuredMoM: {
          decisions: ["Adopt Next.js"],
          action_items: [{ task: "Setup repository" }],
        },
      };

      Meeting.findById.mockResolvedValue(mockMeeting);
      generateAbsenteeCatchUpAI.mockResolvedValue({
        overview: "Sprint planning overview",
        actionItems: ["Setup repository"],
        decisions: ["Adopt Next.js"],
        mentions: [],
      });

      const mockSavedCatchUp = {
        _id: "catchup_new",
        meetingId: "m_1",
        userId: "u_1",
        content: { overview: "Sprint planning overview" },
        status: "pending",
      };

      AbsenteeCatchUp.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSavedCatchUp),
      });

      const req = {
        user: { _id: "u_1", firstName: "Alice", lastName: "Smith" },
        params: { meetingId: "m_1" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await generateMeetingCatchUp(req, res);

      expect(Meeting.findById).toHaveBeenCalledWith("m_1");
      expect(generateAbsenteeCatchUpAI).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        catchUp: mockSavedCatchUp,
      });
    });

    it("organizer generates and delivers catch-up packs to absentees", async () => {
      const mockMeeting = {
        _id: "m_100",
        title: "Architecture Review",
        date: new Date(),
        summary: "Reviewed microservices schema",
        uploadedBy: "organizer_1",
        participants: [
          { user: { _id: "organizer_1", name: "Organizer" } },
          { user: { _id: "absentee_1", name: "Bob", email: "bob@test.com" } },
        ],
      };

      const mockAbsenteeUser = {
        _id: "absentee_1",
        firstName: "Bob",
        email: "bob@test.com",
      };

      Meeting.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockMeeting),
      });

      userModel.find.mockResolvedValue([mockAbsenteeUser]);

      generateAbsenteeCatchUpAI.mockResolvedValue({
        overview: "Architecture decisions summary",
        actionItems: ["Refactor schema"],
        decisions: ["Approved Postgres migration"],
      });

      const mockDeliveredRecord = {
        _id: "catchup_del_1",
        meetingId: "m_100",
        userId: "absentee_1",
        status: "delivered",
      };

      AbsenteeCatchUp.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDeliveredRecord),
      });

      const req = {
        user: { id: "organizer_1" },
        params: { meetingId: "m_100" },
        body: { absenteeIds: ["absentee_1"] },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await generateAndDeliverCatchUp(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          deliveredCount: 1,
          status: "DISPATCHED",
        }),
      );
      expect(EmailService.sendAbsenteeCatchUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "bob@test.com",
          meetingTitle: "Architecture Review",
        }),
      );
      expect(createNotification).toHaveBeenCalledWith(
        "absentee_1",
        "Meeting Catch-Up Pack",
        expect.stringContaining("Architecture Review"),
        "meetings",
        "/catch-up",
        "View Catch-Up",
        { meetingId: "m_100" },
      );
    });

    it("marks catch-up as read", async () => {
      const mockUpdated = { _id: "c_1", status: "read", readAt: new Date() };
      AbsenteeCatchUp.findByIdAndUpdate.mockResolvedValue(mockUpdated);

      const req = { params: { id: "c_1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await markCatchUpAsRead(req, res);

      expect(AbsenteeCatchUp.findByIdAndUpdate).toHaveBeenCalledWith(
        "c_1",
        expect.objectContaining({ status: "read" }),
        { new: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdated,
      });
    });

    it("fetches catch-ups for current user", async () => {
      const mockList = [{ _id: "c_1", status: "delivered" }];
      AbsenteeCatchUp.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockList),
        }),
      });

      const req = { user: { id: "u_1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await getMyCatchUps(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        catchUps: mockList,
      });
    });
  });

  describe("Service Layer", () => {
    it("fetches pending, delivered, and read catch-ups for inbox", async () => {
      const mockList = [
        { _id: "c_1", status: "delivered" },
        { _id: "c_2", status: "read" },
      ];

      AbsenteeCatchUp.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockList),
        }),
      });

      const results = await AbsenteeCatchUpService.getPendingCatchUps("user_1");

      expect(results).toEqual(mockList);
      expect(AbsenteeCatchUp.find).toHaveBeenCalledWith({
        userId: "user_1",
        status: { $in: ["pending", "delivered", "read"] },
      });
    });
  });
});
