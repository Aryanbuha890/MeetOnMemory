import crypto from "crypto";
import GuestAccessToken from "../models/guestAccessTokenModel.js";
import GuestFeedback from "../models/guestFeedbackModel.js";
import AuditService from "./AuditService.js";

class GuestAccessService {
  /**
   * Generates a new guest access token for a meeting.
   * @param {Object} params
   */
  static async generateToken({
    meetingId,
    guestEmail,
    label = "",
    permissions = [],
    expiresAt,
    maxViews = 0,
    createdBy,
    organizationId,
  }) {
    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString("hex");

    // Hash it for storage
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const guestToken = await GuestAccessToken.create({
      meetingId,
      guestEmail,
      tokenHash,
      token: rawToken,
      label: label || `Access for ${guestEmail}`,
      permissions,
      expiresAt,
      maxViews,
      currentViews: 0,
      viewCount: 0,
      joinCount: 0,
      lastUsedAt: null,
      createdBy,
    });

    if (organizationId) {
      await AuditService.logAction({
        actorId: createdBy,
        action: "GUEST_TOKEN_CREATED",
        entity: "GuestAccessToken",
        entityId: guestToken._id,
        organizationId,
        details: {
          meetingId,
          guestEmail,
          permissions,
        },
      });
    }

    return {
      rawToken, // Only returned once!
      guestToken,
    };
  }

  /**
   * Validates a guest access token and records a view.
   * @param {String} rawToken
   */
  static async validateAndRecordView(rawToken) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const token = await GuestAccessToken.findOne({
      $or: [{ tokenHash }, { token: rawToken }],
    }).populate("meetingId");

    if (!token) {
      throw new Error("Invalid guest access token.");
    }

    if (token.revoked) {
      throw new Error("This guest access token has been revoked.");
    }

    if (new Date() > new Date(token.expiresAt)) {
      throw new Error("This guest access token has expired.");
    }

    if (token.maxViews > 0 && token.currentViews >= token.maxViews) {
      throw new Error(
        "This guest access token has exceeded its maximum allowed views.",
      );
    }

    // Record the view
    token.currentViews = (token.currentViews || 0) + 1;
    token.viewCount = token.currentViews;
    token.lastUsedAt = new Date();
    await token.save();

    return token;
  }

  /**
   * Records a guest joining via token.
   * @param {String} rawToken
   */
  static async recordJoin(rawToken) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const token = await GuestAccessToken.findOne({
      $or: [{ tokenHash }, { token: rawToken }],
    });

    if (token && !token.revoked && new Date() <= new Date(token.expiresAt)) {
      token.joinCount = (token.joinCount || 0) + 1;
      token.lastUsedAt = new Date();
      await token.save();
      return token;
    }
    return null;
  }

  /**
   * Submits guest feedback.
   */
  static async submitFeedback({
    meetingId,
    token,
    guestName,
    guestEmail,
    rating,
    comments,
  }) {
    if (!meetingId || !rating) {
      throw new Error("Meeting ID and rating are required.");
    }

    const feedback = await GuestFeedback.create({
      meetingId,
      token: token || "",
      guestName: guestName || "Anonymous Guest",
      guestEmail: guestEmail || "",
      rating: Number(rating),
      comments: comments || "",
    });

    return feedback;
  }

  /**
   * Retrieves analytics, tokens audit history, and feedback list for a meeting.
   */
  static async getHostAnalytics(meetingId) {
    const tokens = await GuestAccessToken.find({ meetingId }).sort({
      createdAt: -1,
    });
    const feedback = await GuestFeedback.find({ meetingId }).sort({
      createdAt: -1,
    });

    const totalJoins = tokens.reduce(
      (acc, token) => acc + (token.joinCount || 0),
      0,
    );
    const totalViews = tokens.reduce(
      (acc, token) => acc + (token.viewCount || token.currentViews || 0),
      0,
    );

    return {
      metrics: {
        totalJoins,
        totalViews,
        feedbackCount: feedback.length,
      },
      tokens: tokens.map((t) => {
        const isExpired = new Date(t.expiresAt) < new Date();
        const isActive = !t.revoked && !isExpired;
        return {
          id: t._id,
          _id: t._id,
          token: t.token || t.tokenHash?.substring(0, 16) + "...",
          guestEmail: t.guestEmail,
          label: t.label || `Access for ${t.guestEmail}`,
          createdAt: t.createdAt,
          expiresAt: t.expiresAt,
          lastUsedAt: t.lastUsedAt || null,
          isActive,
          revoked: t.revoked,
          currentViews: t.currentViews || 0,
          viewCount: t.viewCount || t.currentViews || 0,
          maxViews: t.maxViews || 0,
          joinCount: t.joinCount || 0,
        };
      }),
      feedback: feedback.map((f) => ({
        id: f._id,
        _id: f._id,
        guestName: f.guestName || "Anonymous Guest",
        guestEmail: f.guestEmail || "",
        rating: f.rating,
        comments: f.comments || "",
        createdAt: f.createdAt,
      })),
    };
  }

  /**
   * Exports room feedback as CSV.
   */
  static async exportFeedbackCSV(meetingId) {
    const feedback = await GuestFeedback.find({ meetingId }).sort({
      createdAt: -1,
    });

    let csvContent = "Date,Guest Name,Rating,Comments\n";
    feedback.forEach((f) => {
      const dateStr = f.createdAt
        ? new Date(f.createdAt).toISOString().split("T")[0]
        : "";
      const name = (f.guestName || "Anonymous Guest").replace(/"/g, '""');
      const rating = f.rating || "";
      const cleanComments = (f.comments || "").replace(/"/g, '""');
      csvContent += `"${dateStr}","${name}","${rating}","${cleanComments}"\n`;
    });

    return csvContent;
  }

  /**
   * Revokes a guest access token.
   */
  static async revokeToken(tokenId, revokedBy, organizationId) {
    const token = await GuestAccessToken.findById(tokenId);

    if (!token) {
      throw new Error("Token not found.");
    }

    token.revoked = true;
    await token.save();

    if (organizationId) {
      await AuditService.logAction({
        actorId: revokedBy,
        action: "GUEST_TOKEN_REVOKED",
        entity: "GuestAccessToken",
        entityId: token._id,
        organizationId,
      });
    }

    return token;
  }

  /**
   * Gets all tokens (active and revoked) for a specific meeting.
   */
  static async getMeetingTokens(meetingId) {
    return await GuestAccessToken.find({ meetingId }).sort({ createdAt: -1 });
  }
}

export default GuestAccessService;
