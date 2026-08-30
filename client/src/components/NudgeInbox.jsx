import React, { useEffect, useState, useCallback } from "react";
import { getMyNudges, updateNudgeStatus } from "../api/meetingNudgeApi";
import { Link } from "react-router-dom";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Bell,
  XCircle,
} from "lucide-react";

const NudgeInbox = ({ organizationId }) => {
  const [nudges, setNudges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNudges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyNudges(organizationId);
      setNudges(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error("Failed to fetch nudges", err);
      setError("Failed to load preparation nudges.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchNudges();
  }, [fetchNudges]);

  const handleDismiss = async (id) => {
    try {
      await updateNudgeStatus(id, "DISMISSED");
      setNudges((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.error("Failed to dismiss nudge", err);
    }
  };

  const handleActedOn = async (id) => {
    try {
      await updateNudgeStatus(id, "ACTED_ON");
      setNudges((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.error("Failed to act on nudge", err);
    }
  };

  // Loading Skeleton State
  if (loading) {
    return (
      <div
        data-testid="nudge-inbox-loading"
        className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-indigo-100 dark:border-indigo-900/50 shadow-sm animate-pulse mb-6 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 bg-indigo-100 dark:bg-indigo-950/60 rounded-md"></div>
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-700/50 rounded"></div>
          <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-700/40 rounded"></div>
        </div>
      </div>
    );
  }

  // Error State with Retry
  if (error) {
    return (
      <div
        data-testid="nudge-inbox-error"
        className="bg-rose-50 dark:bg-rose-950/30 rounded-xl p-4 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 mb-6 flex items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={fetchNudges}
          data-testid="nudge-inbox-retry-btn"
          className="px-3 py-1 bg-white dark:bg-gray-800 hover:bg-rose-100 dark:hover:bg-gray-700 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  // Empty State
  if (!nudges.length) {
    return (
      <div
        data-testid="nudge-inbox-empty"
        className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm mb-6 text-center space-y-2"
      >
        <div className="w-9 h-9 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h4 className="text-xs font-bold text-gray-900 dark:text-white">
          All Caught Up!
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No pending preparation nudges right now. You are ready for your
          upcoming meetings.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="nudge-inbox"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-indigo-100 dark:border-indigo-900/50 overflow-hidden mb-6"
    >
      <div className="bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 border-b border-indigo-100 dark:border-indigo-900/50 flex justify-between items-center">
        <h3 className="font-bold text-sm text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Preparation Nudges
        </h3>
        <span className="bg-indigo-600 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
          {nudges.length} pending
        </span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
        {nudges.map((nudge) => {
          const targetMeetingId =
            nudge.meetingId?._id || nudge.meetingId || nudge.meeting;
          const meetingTitle =
            nudge.meetingId?.title || nudge.meetingTitle || "Upcoming Meeting";

          return (
            <div
              key={nudge._id}
              className="p-4 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {targetMeetingId ? (
                    <Link
                      to={`/meeting/${targetMeetingId}`}
                      className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      {meetingTitle}
                    </Link>
                  ) : (
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {meetingTitle}
                    </span>
                  )}
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    {nudge.nudgeType === "UNRESOLVED_ACTION_ITEMS" &&
                      `You have ${nudge.context?.count || nudge.context?.unresolvedCount || "pending"} unresolved action items to complete.`}
                    {nudge.nudgeType === "AGENDA_REVIEW" &&
                      "Review the agenda to prepare for this meeting."}
                    {nudge.nudgeType === "GENERAL_PREP" &&
                      "Your readiness score is low. Check meeting details to catch up."}
                    {![
                      "UNRESOLVED_ACTION_ITEMS",
                      "AGENDA_REVIEW",
                      "GENERAL_PREP",
                    ].includes(nudge.nudgeType) &&
                      (nudge.message ||
                        "Action recommended for upcoming meeting.")}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => handleActedOn(nudge._id)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Mark as Done
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(nudge._id)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NudgeInbox;
