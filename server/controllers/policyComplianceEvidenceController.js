import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { ZipArchive } from "archiver";
import PolicyCompliance from "../models/policyComplianceModel.js";
import Policy from "../models/policyModel.js";
import Decision from "../models/decisionModel.js";
import Meeting from "../models/meetingModel.js";
import { sendError } from "../utils/responseHandler.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// archiver v8 is ESM-only and exports classes rather than a callable factory
// (Issue #2575). Reaching it through `createRequire` threw
// `ERR_REQUIRE_CYCLE_MODULE` once this controller was loaded as part of the
// full router graph, and `archiver("zip", ...)` would not have worked against
// v8 in any case — `^8.0.0` has been the declared dependency since the
// upgrade, so this call site was left on the v6 API.

const toPlain = (value) =>
  value && typeof value.toObject === "function" ? value.toObject() : value;

const safeName = (value, fallback = "evidence") =>
  String(value || fallback)
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || fallback;

const findEvidence = async (flagId, organization) => {
  const flag = await PolicyCompliance.findOne({
    _id: flagId,
    organization,
  })
    .populate("decisionId", "text status createdAt")
    .populate(
      "policyId",
      "name version summary keywords createdAt previousVersions",
    )
    .populate("sourceMeetingId", "title date")
    .lean();

  if (!flag) return null;

  const policy = await Policy.findOne({
    _id: flag.policyId?._id || flag.policyId,
    organization,
  }).lean();

  const decision = await Decision.findOne({
    _id: flag.decisionId?._id || flag.decisionId,
    organization,
  })
    .select("_id text status createdAt")
    .lean();

  let meeting = null;
  if (flag.sourceMeetingId?._id || flag.sourceMeetingId) {
    meeting = await Meeting.findOne({
      _id: flag.sourceMeetingId?._id || flag.sourceMeetingId,
      organization,
    })
      .select("_id title date")
      .lean();
  }

  if (!policy || !decision) return null;

  const policyVersion = String(flag.policyVersion || policy.version || "1.0");
  const previous = Array.isArray(policy.previousVersions)
    ? policy.previousVersions.find(
        (item) => String(item.version) === policyVersion,
      )
    : null;

  return {
    flag: toPlain(flag),
    decision,
    meeting,
    policy: {
      _id: policy._id,
      name: policy.name,
      version: policy.version,
      summary: policy.summary,
      keywords: policy.keywords || [],
      createdAt: policy.createdAt,
      matchedVersion: previous || {
        name: policy.name,
        version: policy.version,
        summary: policy.summary,
        keywords: policy.keywords || [],
        fileUrl: policy.fileUrl,
        createdAt: policy.createdAt,
      },
    },
    exportedAt: new Date().toISOString(),
  };
};

const renderPdf = (evidence) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Policy Compliance Evidence", { underline: true });
    doc.moveDown();
    doc.fontSize(10).text(`Exported: ${evidence.exportedAt}`);
    doc.moveDown();

    doc.fontSize(13).text("Compliance item");
    doc.fontSize(10);
    doc.text(`Classification: ${evidence.flag.classification}`);
    doc.text(`Status: ${evidence.flag.status}`);
    doc.text(
      `Similarity: ${Math.round((evidence.flag.similarityScore || 0) * 100)}%`,
    );
    doc.text(
      `Policy version matched: ${evidence.policy.matchedVersion.version}`,
    );
    doc.moveDown();

    doc.fontSize(13).text("Decision");
    doc
      .fontSize(10)
      .text(evidence.decision.text || "Decision text unavailable");
    if (evidence.meeting) {
      doc.text(`Meeting: ${evidence.meeting.title || "Untitled meeting"}`);
      if (evidence.meeting.date)
        doc.text(
          `Meeting date: ${new Date(evidence.meeting.date).toISOString()}`,
        );
    }
    doc.moveDown();

    doc.fontSize(13).text("Policy");
    doc
      .fontSize(10)
      .text(
        `${evidence.policy.name} · v${evidence.policy.matchedVersion.version}`,
      );
    if (evidence.policy.matchedVersion.summary) {
      doc.moveDown(0.5).text(evidence.policy.matchedVersion.summary);
    }
    if (evidence.policy.matchedVersion.keywords?.length) {
      doc
        .moveDown(0.5)
        .text(
          `Keywords: ${evidence.policy.matchedVersion.keywords.join(", ")}`,
        );
    }
    doc.moveDown();

    doc.fontSize(13).text("Assessment");
    doc
      .fontSize(10)
      .text(evidence.flag.reasoning || "No reasoning was recorded.");
    doc.end();
  });

const renderZip = async (evidence, pdf) => {
  const chunks = [];
  const archive = new ZipArchive({ zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    archive.append(JSON.stringify(evidence, null, 2), {
      name: "evidence.json",
    });
    archive.append(pdf, { name: "evidence.pdf" });
    archive.append(
      [
        `Policy Compliance Evidence — ${evidence.policy.name}`,
        `Matched version: ${evidence.policy.matchedVersion.version}`,
        `Classification: ${evidence.flag.classification}`,
        `Status: ${evidence.flag.status}`,
        "",
        evidence.flag.reasoning || "No reasoning was recorded.",
      ].join("\n"),
      { name: "README.txt" },
    );
    archive.finalize();
  });
};

export const exportComplianceEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const format = req.query.format === "pdf" ? "pdf" : "zip";
    const organization = req.user.organization;

    if (!organization)
      return sendError(res, 403, "Organization membership required");
    if (!isValidId(id))
      return sendError(res, 400, "Invalid compliance flag id");

    const evidence = await findEvidence(id, organization);
    if (!evidence) return sendError(res, 404, "Compliance evidence not found");

    const pdf = await renderPdf(evidence);
    const body = format === "pdf" ? pdf : await renderZip(evidence, pdf);
    const extension = format === "pdf" ? "pdf" : "zip";
    const filename = `${safeName(evidence.policy.name)}-v${safeName(evidence.policy.matchedVersion.version)}-evidence.${extension}`;

    res.status(200);
    res.setHeader(
      "Content-Type",
      format === "pdf" ? "application/pdf" : "application/zip",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(body);
  } catch (error) {
    console.error("exportComplianceEvidence error:", error);
    return sendError(res, 500, "Failed to export compliance evidence");
  }
};

export const getPolicyVersionDeepLink = async (req, res) => {
  try {
    const { policyId, version } = req.params;
    const organization = req.user.organization;

    if (!organization)
      return sendError(res, 403, "Organization membership required");
    if (!isValidId(policyId)) return sendError(res, 400, "Invalid policy id");

    const policy = await Policy.findOne({ _id: policyId, organization })
      .select(
        "name version summary keywords fileUrl createdAt previousVersions",
      )
      .lean();

    if (!policy) return sendError(res, 404, "Policy not found");

    const wantedVersion = String(version);
    const matched =
      String(policy.version) === wantedVersion
        ? {
            name: policy.name,
            version: policy.version,
            summary: policy.summary,
            keywords: policy.keywords || [],
            fileUrl: policy.fileUrl,
            createdAt: policy.createdAt,
            current: true,
          }
        : (policy.previousVersions || [])
            .filter((item) => String(item.version) === wantedVersion)
            .map((item) => ({ ...item, current: false }))[0];

    if (!matched) return sendError(res, 404, "Policy version not found");

    return res.json({
      success: true,
      data: {
        policyId: policy._id,
        policyName: policy.name,
        version: matched,
      },
    });
  } catch (error) {
    console.error("getPolicyVersionDeepLink error:", error);
    return sendError(res, 500, "Failed to load policy version");
  }
};
