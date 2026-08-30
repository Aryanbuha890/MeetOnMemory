import { useState, useCallback, useEffect, useContext } from "react";
import { organizationApi, invitationApi } from "../services";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent";

export const useTeamManagement = (activeTab) => {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [error, setError] = useState(null);

  const { userData } = useContext(AppContent);
  const isAdmin = userData?.role === "admin" || userData?.role === "owner";

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await organizationApi.getMembers();

      if (data.success) {
        setMembers(data.members);
      } else {
        setError(data.message || "Failed to fetch members");
      }
    } catch (err) {
      console.error("Error fetching members:", err);
      setError("Failed to fetch members. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    if (!userData?.organization) return;
    const orgId = userData.organization._id || userData.organization;
    try {
      setInvitesLoading(true);
      const { data } = await invitationApi.getOrganizationInvitations(orgId);
      if (data.success) {
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error("Error fetching invitations:", err);
    } finally {
      setInvitesLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (activeTab === "invitations" && isAdmin) {
      fetchInvitations();
    }
  }, [activeTab, fetchInvitations, isAdmin]);

  const handleSendInvite = async (inviteData, onSuccess) => {
    const orgId = userData?.organization?._id || userData?.organization;
    if (!orgId) {
      toast.error("No active organization selected");
      return;
    }

    try {
      const { data } = await invitationApi.createInvitation({
        organizationId: orgId,
        ...inviteData,
      });

      if (data.success) {
        toast.success("Invitation sent successfully!");
        if (activeTab === "invitations") {
          fetchInvitations();
        }
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error("Error sending invitation:", err);
      toast.error(err.response?.data?.message || "Failed to send invitation");
      throw err;
    }
  };

  const handleResendInvite = async (id) => {
    try {
      const { data } = await invitationApi.resendInvitation(id);
      if (data.success) {
        toast.success("Invitation resent successfully!");
        fetchInvitations();
      }
    } catch (err) {
      console.error("Error resending invitation:", err);
      toast.error(err.response?.data?.message || "Failed to resend invitation");
    }
  };

  const handleCancelInvite = async (id) => {
    try {
      const { data } = await invitationApi.revokeInvitation(id);
      if (data.success) {
        toast.success("Invitation cancelled successfully!");
        fetchInvitations();
      }
    } catch (err) {
      console.error("Error cancelling invitation:", err);
      toast.error(err.response?.data?.message || "Failed to cancel invitation");
    }
  };

  const handleExpireInvite = async (id) => {
    try {
      const { data } = await invitationApi.expireInvitation(id);
      if (data.success) {
        toast.success("Invitation expired successfully!");
        fetchInvitations();
      }
    } catch (err) {
      console.error("Error expiring invitation:", err);
      toast.error(err.response?.data?.message || "Failed to expire invitation");
    }
  };

  const handleBulkInvite = async (formData, onSuccess) => {
    const orgId = userData?.organization?._id || userData?.organization;
    if (!orgId) {
      toast.error("No active organization selected");
      throw new Error("No active organization selected");
    }

    let payload = formData;
    if (formData instanceof FormData) {
      if (!formData.has("organizationId")) {
        formData.append("organizationId", orgId);
      }
    } else if (formData && !(formData instanceof FormData)) {
      payload = new FormData();
      if (formData.file) {
        payload.append("file", formData.file);
      }
      payload.append("organizationId", orgId);
    }

    try {
      const { data } = await invitationApi.bulkImportInvitations(payload);
      if (data.success) {
        if (activeTab === "invitations") {
          fetchInvitations();
        }
        fetchMembers();
        if (onSuccess) onSuccess(data);
        return data;
      }
      return data;
    } catch (err) {
      console.error("Error importing bulk invitations:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to import bulk invitations",
      );
      throw err;
    }
  };

  const handleUpdateRole = async (targetUserId, newRole, reason = "") => {
    const orgId = userData?.organization?._id || userData?.organization;
    if (!orgId) {
      toast.error("No active organization selected");
      return;
    }
    try {
      const { data } = await organizationApi.updateMemberRole(
        orgId,
        targetUserId,
        newRole,
        reason,
      );
      if (data.success) {
        toast.success(`Role updated to ${newRole}`);
        fetchMembers();
      } else {
        toast.error(data.message || "Failed to update role");
      }
    } catch (err) {
      console.error("Error updating role:", err);
      toast.error(err.response?.data?.message || "Failed to update role");
      throw err;
    }
  };

  const handleDeactivateMember = async (targetUserId, reason = "") => {
    const orgId = userData?.organization?._id || userData?.organization;
    if (!orgId) {
      toast.error("No active organization selected");
      return;
    }
    try {
      const { data } = await organizationApi.deactivateMember(
        orgId,
        targetUserId,
        reason,
      );
      if (data.success) {
        toast.success("Member deactivated successfully");
        fetchMembers();
      } else {
        toast.error(data.message || "Failed to deactivate member");
      }
    } catch (err) {
      console.error("Error deactivating member:", err);
      toast.error(err.response?.data?.message || "Failed to deactivate member");
      throw err;
    }
  };

  const handleReactivateMember = async (targetUserId) => {
    const orgId = userData?.organization?._id || userData?.organization;
    if (!orgId) {
      toast.error("No active organization selected");
      return;
    }
    try {
      const { data } = await organizationApi.reactivateMember(
        orgId,
        targetUserId,
      );
      if (data.success) {
        toast.success("Member reactivated successfully");
        fetchMembers();
      } else {
        toast.error(data.message || "Failed to reactivate member");
      }
    } catch (err) {
      console.error("Error reactivating member:", err);
      toast.error(err.response?.data?.message || "Failed to reactivate member");
      throw err;
    }
  };

  const handleUpdateCapacity = async (targetUserId, capacityData) => {
    const orgId = userData?.organization?._id || userData?.organization;
    if (!orgId) {
      toast.error("No active organization selected");
      return;
    }
    try {
      const { data } = await organizationApi.updateMemberCapacity(
        orgId,
        targetUserId,
        capacityData,
      );
      if (data.success) {
        toast.success("Capacity updated successfully");
        fetchMembers();
      } else {
        toast.error(data.message || "Failed to update capacity");
      }
    } catch (err) {
      console.error("Error updating capacity:", err);
      toast.error(err.response?.data?.message || "Failed to update capacity");
      throw err;
    }
  };

  return {
    members,
    invitations,
    loading,
    invitesLoading,
    error,
    isAdmin,
    fetchMembers,
    fetchInvitations,
    handleSendInvite,
    handleBulkInvite,
    handleResendInvite,
    handleCancelInvite,
    handleExpireInvite,
    handleUpdateRole,
    handleDeactivateMember,
    handleReactivateMember,
    handleUpdateCapacity,
  };
};

export default useTeamManagement;
