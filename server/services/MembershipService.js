// server/services/MembershipService.js
//
// Membership mutations that must stay consistent with the denormalized
// User.role / User.organization fields (backward-compatibility copies).

import mongoose from "mongoose";
import userModel from "../models/userModel.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";

/**
 * True when the connected MongoDB topology can run multi-document transactions.
 * Standalone servers (including default MongoMemoryServer) cannot.
 */
const topologySupportsTransactions = () => {
  const type = mongoose.connection?.client?.topology?.description?.type;
  console.log("TOPOLOGY TYPE:", type);
  return (
    type === "ReplicaSetWithPrimary" ||
    type === "ReplicaSetNoPrimary" ||
    type === "Sharded"
  );
};

/**
 * Run `work(session)` inside a transaction when the topology supports it.
 * Falls back to `work(null)` on standalone MongoDB so local/test environments
 * still execute the same business logic without multi-doc transactions.
 *
 * @param {(session: import("mongoose").ClientSession|null) => Promise<T>} work
 * @returns {Promise<T>}
 * @template T
 */
export const runMembershipTransaction = async (work) => {
  if (!topologySupportsTransactions()) {
    return work(null);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Persist a membership role change and, when the membership org is the user's
 * primary organization, sync User.role in the same transaction (Issue #1361).
 *
 * @param {import("mongoose").Document} membership populated with organization
 * @param {string} role
 * @param {string|null} [changedById=null]
 * @param {string} [reason=""]
 * @returns {Promise<{ membership: import("mongoose").Document, userSynced: boolean, unchanged: boolean }>}
 */
export const syncMembershipAndUserRole = async (
  membership,
  role,
  changedById = null,
  reason = "",
) => {
  if (!membership) {
    throw new NotFoundError("Membership not found.");
  }

  if (!role || !["owner", "admin", "member", "viewer"].includes(role)) {
    throw new ValidationError(
      "Invalid role. Must be 'owner', 'admin', 'member', or 'viewer'.",
    );
  }

  // Avoid duplicate writes when nothing would change.
  if (membership.role === role) {
    return { membership, userSynced: false, unchanged: true };
  }

  const previousRole = membership.role;
  const orgId = membership.organization?._id || membership.organization;

  return runMembershipTransaction(async (session) => {
    membership.role = role;
    if (!Array.isArray(membership.roleHistory)) {
      membership.roleHistory = [];
    }
    membership.roleHistory.push({
      previousRole,
      newRole: role,
      changedBy: changedById,
      changedAt: new Date(),
      reason: reason || "",
    });
    await membership.save(session ? { session } : undefined);

    const targetUser = await userModel
      .findById(membership.user)
      .session(session || null);

    let userSynced = false;

    if (
      targetUser &&
      targetUser.organization &&
      orgId &&
      targetUser.organization.toString() === orgId.toString()
    ) {
      // Skip the User write when the denormalized role already matches.
      if (targetUser.role !== role) {
        targetUser.role = role;
        await targetUser.save(session ? { session } : undefined);
        userSynced = true;
      }
    }

    return { membership, userSynced, unchanged: false };
  });
};
