import React, { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "react-toastify";
import meetingRsvpApi from "../../services/meetingRsvpApi";
import { useUser } from "@clerk/clerk-react";
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  Clock,
  Send,
  Users,
} from "lucide-react";

const STATUS_COLORS = {
  accepted: "#10B981", // Emerald 500
  declined: "#EF4444", // Red 500
  tentative: "#F59E0B", // Amber 500
  waitlisted: "#8B5CF6", // Purple 500
  pending: "#9CA3AF", // Gray 400
};

const RsvpPanel = ({ meetingId, isOrganizer, participants }) => {
  const { user: currentUser } = useUser();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingRsvps, setSendingRsvps] = useState(false);
  const [responding, setResponding] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await meetingRsvpApi.getMeetingSummary(meetingId);
      if (data.success) {
        setSummary(data.data);
      }
    } catch (err) {
      console.error("Error fetching RSVP summary:", err);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchSummary();
  }, [meetingId, fetchSummary]);

  const handleSendRsvps = async () => {
    if (!participants || participants.length === 0) {
      toast.warning("No participants to send RSVPs to");
      return;
    }

    try {
      setSendingRsvps(true);
      const userIds = participants
        .map((p) => p.user?._id || p.user)
        .filter(Boolean);
      const { data } = await meetingRsvpApi.sendRsvpRequests(
        meetingId,
        userIds,
      );
      if (data.success) {
        toast.success("RSVP requests sent to participants");
        fetchSummary();
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to send RSVP requests",
      );
    } finally {
      setSendingRsvps(false);
    }
  };

  const handleRespond = async (status) => {
    if (status === "declined" && !showDeclineInput) {
      setShowDeclineInput(true);
      return;
    }

    try {
      setResponding(true);
      const payload = { status };
      if (status === "declined") {
        payload.declineReason = declineReason;
      }
      const { data } = await meetingRsvpApi.respondToRsvp(meetingId, payload);
      if (data.success) {
        toast.success(`RSVP updated to ${status}`);
        setShowDeclineInput(false);
        setDeclineReason("");
        fetchSummary();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update RSVP");
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-48 bg-gray-100 rounded-lg"></div>;
  }

  // Check if current user has a pending RSVP
  const currentUserRsvp = summary?.participants?.find(
    (p) => p.userId?._id === currentUser?.publicMetadata?.dbUserId,
  );

  const showRsvpActions =
    currentUserRsvp && currentUserRsvp.status === "pending";

  const chartData = [
    {
      name: "Accepted",
      value: summary?.accepted || 0,
      color: STATUS_COLORS.accepted,
    },
    {
      name: "Declined",
      value: summary?.declined || 0,
      color: STATUS_COLORS.declined,
    },
    {
      name: "Tentative",
      value: summary?.tentative || 0,
      color: STATUS_COLORS.tentative,
    },
    {
      name: "Pending",
      value: summary?.pending || 0,
      color: STATUS_COLORS.pending,
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
          RSVP & Availability
        </h2>

        {isOrganizer && (
          <button
            onClick={handleSendRsvps}
            disabled={sendingRsvps}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sendingRsvps ? "Sending..." : "Send RSVPs"}
          </button>
        )}
      </div>

      {showRsvpActions && (
        <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-3">
            Your Response is Requested
          </h3>

          {showDeclineInput ? (
            <div className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Reason for declining (optional)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
              <button
                onClick={() => handleRespond("declined")}
                disabled={responding}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Decline
              </button>
              <button
                onClick={() => setShowDeclineInput(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => handleRespond("accepted")}
                disabled={responding}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Accept
              </button>
              <button
                onClick={() => handleRespond("tentative")}
                disabled={responding}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-md hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                Tentative
              </button>
              <button
                onClick={() => handleRespond("declined")}
                disabled={responding}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </button>
            </div>
          )}
        </div>
      )}

      {summary?.total > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Chart Section */}
          <div className="flex flex-col items-center justify-center">
            <div className="h-48 w-full max-w-[200px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  No data
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div
                  key={status}
                  className="flex items-center gap-1.5 text-xs text-gray-600 capitalize"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  ></div>
                  {status} ({summary[status] || 0})
                </div>
              ))}
            </div>
          </div>

          {/* Participant List Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
              Participant Status
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {summary.participants.map((rsvp) => (
                <div
                  key={rsvp._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {rsvp.userId?.name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {rsvp.userId?.name || "Unknown User"}
                      </div>
                      {rsvp.declineReason && rsvp.status === "declined" && (
                        <div className="text-xs text-red-600 mt-0.5">
                          Note: {rsvp.declineReason}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rsvp.status === "accepted" && (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    )}
                    {rsvp.status === "declined" && (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    {rsvp.status === "tentative" && (
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                    )}
                    {rsvp.status === "pending" && (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                    {rsvp.status === "waitlisted" && (
                      <Clock className="w-4 h-4 text-purple-500" />
                    )}
                    <span className="text-xs font-medium text-gray-600 capitalize">
                      {rsvp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No RSVP data available for this meeting.</p>
          {isOrganizer && (
            <p className="text-sm mt-2">
              Click "Send RSVPs" to notify participants.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RsvpPanel;
