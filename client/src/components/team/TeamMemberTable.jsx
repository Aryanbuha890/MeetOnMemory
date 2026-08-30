import React, { useState } from "react";
import {
  Users,
  Calendar,
  Shield,
  Copy,
  CheckCircle,
  XCircle,
  X,
  Mail,
  Clock,
  Briefcase,
  History,
  Ban,
  UserCheck,
  Edit3,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";

const ROLE_STYLES = {
  owner:
    "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  admin:
    "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
  member:
    "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
  viewer:
    "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const STATUS_STYLES = {
  active:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  inactive:
    "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700",
  suspended:
    "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  deactivated:
    "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700",
};

const TeamMemberTable = ({
  members,
  searchQuery,
  roleFilter,
  isAdmin = false,
  onDeactivate,
  onReactivate,
  onUpdateRole,
  onUpdateCapacity,
}) => {
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState("details"); // 'details' | 'capacity' | 'history'
  const [actionLoading, setActionLoading] = useState(false);

  // Capacity form
  const [capacityForm, setCapacityForm] = useState({
    weeklyHours: 40,
    maxConcurrentMeetings: 5,
  });

  // Role change form
  const [roleForm, setRoleForm] = useState({
    role: "member",
    reason: "",
  });
  const [isEditingRole, setIsEditingRole] = useState(false);

  // Deactivate modal confirmation
  const [deactivateReason, setDeactivateReason] = useState("");
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openMemberModal = (member) => {
    setSelectedMember(member);
    setActiveModalTab("details");
    setIsEditingRole(false);
    setShowDeactivateConfirm(false);
    setDeactivateReason("");
    setRoleForm({
      role: member.role || "member",
      reason: "",
    });
    setCapacityForm({
      weeklyHours: member.capacity?.weeklyHours ?? 40,
      maxConcurrentMeetings: member.capacity?.maxConcurrentMeetings ?? 5,
    });
  };

  const handleSaveCapacity = async (e) => {
    e.preventDefault();
    if (!selectedMember || !onUpdateCapacity) return;
    try {
      setActionLoading(true);
      await onUpdateCapacity(selectedMember._id, capacityForm);
      setSelectedMember((prev) => ({
        ...prev,
        capacity: { ...capacityForm },
      }));
    } catch {
      // Toast already shown in hook
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!selectedMember || !onUpdateRole) return;
    try {
      setActionLoading(true);
      await onUpdateRole(selectedMember._id, roleForm.role, roleForm.reason);
      setSelectedMember((prev) => ({
        ...prev,
        role: roleForm.role,
        roleHistory: [
          ...(prev.roleHistory || []),
          {
            previousRole: prev.role,
            newRole: roleForm.role,
            reason: roleForm.reason,
            changedAt: new Date(),
          },
        ],
      }));
      setIsEditingRole(false);
    } catch {
      // Toast already shown in hook
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedMember || !onDeactivate) return;
    try {
      setActionLoading(true);
      await onDeactivate(selectedMember._id, deactivateReason);
      setSelectedMember((prev) => ({
        ...prev,
        status: "inactive",
      }));
      setShowDeactivateConfirm(false);
    } catch {
      // Toast handled
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedMember || !onReactivate) return;
    try {
      setActionLoading(true);
      await onReactivate(selectedMember._id);
      setSelectedMember((prev) => ({
        ...prev,
        status: "active",
      }));
    } catch {
      // Toast handled
    } finally {
      setActionLoading(false);
    }
  };

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          No members found
        </h3>
        <p className="text-slate-500 dark:text-slate-400">
          {searchQuery || roleFilter !== "all"
            ? "Try adjusting your search or filters"
            : "Your organization has no members yet"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {members.map((member) => {
          const isDeactivated =
            member.status === "inactive" ||
            member.status === "suspended" ||
            member.status === "deactivated";

          return (
            <div
              key={member._id}
              onClick={() => openMemberModal(member)}
              className={`group relative flex flex-wrap sm:flex-nowrap items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                isDeactivated
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 opacity-75"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md"
              }`}
            >
              {/* Avatar */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-lg">
                {getInitials(member.name)}
              </div>

              {/* Member Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {member.name || "Unknown"}
                  </h3>
                  {member.isAccountVerified && (
                    <CheckCircle
                      className="h-4 w-4 text-green-500 shrink-0"
                      title="Verified"
                    />
                  )}
                  {isDeactivated && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Deactivated
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {member.email}
                </p>
              </div>

              {/* Capacity info */}
              <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span>{member.capacity?.weeklyHours ?? 40}h/wk</span>
              </div>

              {/* Role Badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${ROLE_STYLES[member.role?.toLowerCase()] || ROLE_STYLES.member}`}
              >
                <Shield className="h-3 w-3" />
                {ROLE_LABELS[member.role?.toLowerCase()] ||
                  member.role ||
                  "Member"}
              </span>

              {/* Join Date */}
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(member.createdAt || member.joinedAt)}</span>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyEmail(member.email);
                  }}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Copy email"
                >
                  <Copy className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Member Details / Management Modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
            >
              <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </button>

            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xl">
                {getInitials(selectedMember.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  {selectedMember.name || "Unknown"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {selectedMember.email}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6">
              <button
                type="button"
                onClick={() => setActiveModalTab("details")}
                className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeModalTab === "details"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                Details & Role
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("capacity")}
                className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeModalTab === "capacity"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                Capacity
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("history")}
                className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeModalTab === "history"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                Role History ({selectedMember.roleHistory?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {activeModalTab === "details" && (
                <div className="space-y-4">
                  {/* Status & Deactivate/Reactivate */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Status
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${STATUS_STYLES[selectedMember.status] || STATUS_STYLES.active}`}
                    >
                      {selectedMember.status || "active"}
                    </span>
                  </div>

                  {/* Role Section */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Role
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${ROLE_STYLES[selectedMember.role?.toLowerCase()] || ROLE_STYLES.member}`}
                        >
                          {ROLE_LABELS[selectedMember.role?.toLowerCase()] ||
                            selectedMember.role}
                        </span>
                        {isAdmin && !isEditingRole && (
                          <button
                            type="button"
                            onClick={() => setIsEditingRole(true)}
                            className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            title="Edit Role"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditingRole && (
                      <form
                        onSubmit={handleSaveRole}
                        className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3"
                      >
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Select New Role
                          </label>
                          <select
                            value={roleForm.role}
                            onChange={(e) =>
                              setRoleForm((prev) => ({
                                ...prev,
                                role: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Reason for Change (Audit)
                          </label>
                          <input
                            type="text"
                            value={roleForm.reason}
                            onChange={(e) =>
                              setRoleForm((prev) => ({
                                ...prev,
                                reason: e.target.value,
                              }))
                            }
                            placeholder="e.g. Promoted to Team Lead"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingRole(false)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={actionLoading}
                            className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            {actionLoading ? "Saving..." : "Update Role"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Joined Date */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Joined Date
                      </span>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(
                        selectedMember.createdAt || selectedMember.joinedAt,
                      )}
                    </span>
                  </div>

                  {/* Admin Deactivate/Reactivate Controls */}
                  {isAdmin && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                      {selectedMember.status === "inactive" ||
                      selectedMember.status === "suspended" ||
                      selectedMember.status === "deactivated" ? (
                        <button
                          type="button"
                          onClick={handleReactivate}
                          disabled={actionLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <UserCheck className="h-4 w-4" />
                          <span>Reactivate Member</span>
                        </button>
                      ) : showDeactivateConfirm ? (
                        <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 space-y-3">
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-semibold">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>Confirm Deactivation</span>
                          </div>
                          <input
                            type="text"
                            value={deactivateReason}
                            onChange={(e) =>
                              setDeactivateReason(e.target.value)
                            }
                            placeholder="Reason for deactivation (optional)..."
                            className="w-full px-3 py-2 text-xs rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowDeactivateConfirm(false)}
                              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleDeactivate}
                              disabled={actionLoading}
                              className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              {actionLoading
                                ? "Deactivating..."
                                : "Confirm Deactivate"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowDeactivateConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold text-sm transition-colors cursor-pointer"
                        >
                          <Ban className="h-4 w-4" />
                          <span>Deactivate Member</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Capacity Tab */}
              {activeModalTab === "capacity" && (
                <form onSubmit={handleSaveCapacity} className="space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure weekly working hours and maximum concurrent
                    meeting limits.
                  </p>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Weekly Capacity (Hours)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="168"
                      value={capacityForm.weeklyHours}
                      onChange={(e) =>
                        setCapacityForm((prev) => ({
                          ...prev,
                          weeklyHours: Number(e.target.value),
                        }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Max Concurrent Meetings / Load Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={capacityForm.maxConcurrentMeetings}
                      onChange={(e) =>
                        setCapacityForm((prev) => ({
                          ...prev,
                          maxConcurrentMeetings: Number(e.target.value),
                        }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? "Saving Capacity..." : "Save Capacity"}
                  </button>
                </form>
              )}

              {/* Role History Tab */}
              {activeModalTab === "history" && (
                <div className="space-y-3">
                  {selectedMember.roleHistory &&
                  selectedMember.roleHistory.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {selectedMember.roleHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-slate-900 dark:text-slate-100">
                              {item.previousRole
                                ? `${item.previousRole} → `
                                : ""}
                              <span className="text-blue-600 dark:text-blue-400">
                                {item.newRole}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              {formatDateTime(item.changedAt)}
                            </span>
                          </div>
                          {item.changedBy && (
                            <p className="text-slate-500">
                              Changed by: {item.changedBy.name || "Admin"}
                            </p>
                          )}
                          {item.reason && (
                            <p className="text-slate-600 dark:text-slate-300 italic">
                              "{item.reason}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No role changes recorded yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="w-full py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeamMemberTable;
