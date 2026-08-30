import cron from "node-cron";
import MembershipRequest from "../models/membershipRequestModel.js";
import AuditService from "../services/AuditService.js";
import { createNotification } from "../services/notificationService.js";

/**
 * Auto-expires pending membership requests that have passed their expiresAt date.
 * @param {object} [io] - Optional socket.io instance
 * @param {number} [batchSize=100] - Batch size
 * @returns {Promise<number>} Number of expired requests processed
 */
export const processExpiredMembershipRequests = async (io, batchSize = 100) => {
  const now = new Date();
  let totalProcessed = 0;
  let hasMore = true;

  while (hasMore) {
    const expiredRequests = await MembershipRequest.find({
      status: "pending",
      expiresAt: { $lte: now },
    })
      .populate("organization", "name")
      .limit(batchSize);

    if (!expiredRequests || expiredRequests.length === 0) {
      hasMore = false;
      break;
    }

    for (const req of expiredRequests) {
      req.status = "expired";
      await req.save();

      // Notify requester that their request has expired
      createNotification(
        req.user.toString(),
        "Membership Request Expired",
        `Your request to join ${req.organization?.name || "the organization"} has expired without a decision.`,
        "organizations",
        "/membership-requests",
        "View Requests",
        {
          requestId: req._id,
          organizationId: req.organization?._id || req.organization,
        },
      ).catch((err) =>
        console.error("⚠️ Failed to send expiry notification:", err.message),
      );

      AuditService.logAction({
        actorId: null,
        action: "MEMBERSHIP_REQUEST_EXPIRED",
        entity: "MembershipRequest",
        entityId: req._id,
        organizationId: req.organization?._id || req.organization,
        details: { userId: req.user, autoExpired: true },
      });

      if (io && req.organization?._id) {
        io.to(req.organization._id.toString()).emit(
          "membershipRequest:expired",
          {
            requestId: req._id,
            status: "expired",
          },
        );
      }

      totalProcessed++;
    }

    if (expiredRequests.length < batchSize) {
      hasMore = false;
    }
  }

  return totalProcessed;
};

/**
 * Initializes and starts the membership request auto-expiration cron job.
 * Runs once every hour.
 */
export const initMembershipRequestExpirationJob = (io) => {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    try {
      const processed = await processExpiredMembershipRequests(io);
      if (processed > 0) {
        console.log(
          `[MembershipRequestExpirationJob]: Successfully auto-expired ${processed} request(s).`,
        );
      }
    } catch (error) {
      console.error(
        "[MembershipRequestExpirationJob]: Error during request expiration job:",
        error,
      );
    }
  });
  console.log(
    "✅ [Service Health]: Membership Request Expiration Job initialized.",
  );
};
