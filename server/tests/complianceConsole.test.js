import { jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";

let currentUser = null;

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = currentUser;
    next();
  },
}));

const { default: complianceRoutes } =
  await import("../routes/complianceRoutes.js");
const { default: RedactionAudit } =
  await import("../models/redactionAuditModel.js");
const { default: express } = await import("express");

const app = express();
app.use(express.json());
app.use("/api/compliance", complianceRoutes);

describe("DLP Compliance Console API Tests (#2486)", () => {
  const ORG_ID = new mongoose.Types.ObjectId();
  const MEETING_ID = new mongoose.Types.ObjectId();
  const ADMIN_USER = {
    _id: new mongoose.Types.ObjectId(),
    organization: ORG_ID,
    role: "admin",
    email: "admin@company.com",
  };

  beforeEach(async () => {
    await RedactionAudit.deleteMany({});
    currentUser = ADMIN_USER;
  });

  describe("POST /api/compliance/scan", () => {
    it("scans text and returns redacted entities", async () => {
      const sampleText =
        "Please contact me at test.user@example.com or use key api_key = 'abcdefghijklmnopqrstuv12345'";
      const res = await request(app)
        .post("/api/compliance/scan")
        .send({ text: sampleText, meetingId: MEETING_ID });

      expect(res.status).toBe(200);
      expect(res.body.findingsCount).toBeGreaterThan(0);
      expect(res.body.redactedText).toContain("[REDACTED_");
    });

    it("returns 400 when text payload is missing", async () => {
      const res = await request(app)
        .post("/api/compliance/scan")
        .send({ text: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Text payload is required/i);
    });
  });

  describe("GET /api/compliance/audit-logs", () => {
    it("retrieves compliance audit logs for organization", async () => {
      await RedactionAudit.create({
        organizationId: ORG_ID,
        meetingId: MEETING_ID,
        entityType: "EMAIL",
        maskedToken: "[REDACTED_EMAIL_1]",
        contextSnippet: "contact me at [REDACTED_EMAIL_1]",
      });

      const res = await request(app).get("/api/compliance/audit-logs");

      expect(res.status).toBe(200);
      expect(res.body.logs).toHaveLength(1);
      expect(res.body.logs[0].entityType).toBe("EMAIL");
    });
  });

  describe("POST /api/compliance/unmask-request/:auditId", () => {
    it("submits unmask request with justification reason", async () => {
      const audit = await RedactionAudit.create({
        organizationId: ORG_ID,
        meetingId: MEETING_ID,
        entityType: "API_KEY",
        maskedToken: "[REDACTED_API_KEY_1]",
      });

      const res = await request(app)
        .post(`/api/compliance/unmask-request/${audit._id}`)
        .send({ reason: "Incident investigation for security review" });

      expect(res.status).toBe(200);
      expect(res.body.audit.unmaskRequests).toHaveLength(1);
      expect(res.body.audit.unmaskRequests[0].status).toBe("PENDING");
      expect(res.body.audit.unmaskRequests[0].reason).toBe(
        "Incident investigation for security review",
      );
    });

    it("returns 400 when justification reason is missing", async () => {
      const audit = await RedactionAudit.create({
        organizationId: ORG_ID,
        meetingId: MEETING_ID,
        entityType: "API_KEY",
        maskedToken: "[REDACTED_API_KEY_1]",
      });

      const res = await request(app)
        .post(`/api/compliance/unmask-request/${audit._id}`)
        .send({ reason: "" });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/compliance/unmask-request/:auditId/:requestId", () => {
    it("approves an unmask request", async () => {
      const audit = await RedactionAudit.create({
        organizationId: ORG_ID,
        meetingId: MEETING_ID,
        entityType: "API_KEY",
        maskedToken: "[REDACTED_API_KEY_1]",
        unmaskRequests: [
          {
            requestedBy: ADMIN_USER._id,
            reason: "Audit check",
            status: "PENDING",
          },
        ],
      });

      const reqId = audit.unmaskRequests[0]._id;

      const res = await request(app)
        .patch(`/api/compliance/unmask-request/${audit._id}/${reqId}`)
        .send({ status: "APPROVED" });

      expect(res.status).toBe(200);
      expect(res.body.audit.unmaskRequests[0].status).toBe("APPROVED");
    });
  });
});
