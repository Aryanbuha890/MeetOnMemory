import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  LogIn,
  Users,
  Video,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent.js";
import { meetingApi } from "../services";
import meetingRsvpApi from "../services/meetingRsvpApi.js";
import Navbar from "../components/Navbar.jsx";
import { validateRedirect } from "../utils/validateRedirect.js";

const MeetingInviteJoin = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isLoggedin, loading: authLoading } = useContext(AppContent);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // RSVP response state
  const [responding, setResponding] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [waitlistNote, setWaitlistNote] = useState("");
  const [showWaitlistInput, setShowWaitlistInput] = useState(false);

  const invitePath = `/meeting-invite/${code || ""}`;

  const resolve = useCallback(async () => {
    if (!code) {
      setError("Missing invite code.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await meetingApi.resolveInvite(code);
      const data = res.data || {};
      setResult(data);

      if (data.meeting?.userRsvp) {
        setRsvpStatus(data.meeting.userRsvp.status);
      } else if (data.meeting?.isWaitlisted) {
        setRsvpStatus("waitlisted");
      }

      if (data.action === "blocked") {
        setError(data.reason || "This invite cannot be used right now.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Invalid, expired, or unauthorized meeting invite.",
      );
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedin) {
      setLoading(false);
      return;
    }

    resolve();
  }, [authLoading, isLoggedin, resolve]);

  const handleRsvpAction = async (status) => {
    if (!result?.meeting?.id) return;

    if (status === "declined" && !showDeclineInput) {
      setShowDeclineInput(true);
      setShowWaitlistInput(false);
      return;
    }

    if (status === "waitlisted" && !showWaitlistInput) {
      setShowWaitlistInput(true);
      setShowDeclineInput(false);
      return;
    }

    try {
      setResponding(true);
      const payload = { status };
      if (status === "declined") {
        payload.declineReason = declineReason;
      }
      if (status === "waitlisted") {
        payload.availabilityNote = waitlistNote;
      }

      const res = await meetingRsvpApi.respondToRsvp(
        result.meeting.id,
        payload,
      );
      if (res.data?.success) {
        setRsvpStatus(status);
        setShowDeclineInput(false);
        setShowWaitlistInput(false);
        toast.success(
          status === "accepted"
            ? "RSVP Accepted! Proceeding to meeting..."
            : status === "waitlisted"
              ? "Added to waitlist"
              : "RSVP updated",
        );

        if (status === "accepted" && result.path) {
          const safePath = validateRedirect(result.path, "/meetings");
          setTimeout(() => {
            navigate(safePath, { replace: true });
          }, 800);
        }
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.response?.status === 409
          ? "Meeting is at capacity. Please join the waitlist."
          : "Failed to update RSVP response");
      toast.error(msg);
      if (err.response?.data?.isFull) {
        setResult((prev) =>
          prev
            ? {
                ...prev,
                meeting: {
                  ...prev.meeting,
                  isFull: true,
                },
              }
            : prev,
        );
      }
    } finally {
      setResponding(false);
    }
  };

  const handleProceedToMeeting = () => {
    if (!result?.path) {
      navigate("/meetings");
      return;
    }
    const safePath = validateRedirect(result.path, "/meetings");
    navigate(safePath, { replace: true });
  };

  const goLogin = () => {
    navigate("/login", {
      state: {
        from: { pathname: invitePath },
        redirect: invitePath,
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-20 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Navbar />

      <div className="mx-auto mt-8 max-w-lg p-6">
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {authLoading || loading ? (
            <div className="py-12">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm text-slate-500">
                Validating meeting invite...
              </p>
            </div>
          ) : !isLoggedin ? (
            <div className="space-y-4 py-4">
              <Video className="mx-auto h-12 w-12 text-indigo-600" />
              <h1 className="text-xl font-bold">Join meeting</h1>
              <p className="text-sm text-slate-500">
                Sign in to continue with this invite link. We will bring you
                back here after authentication.
              </p>
              <button
                type="button"
                onClick={goLogin}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                Continue to login
              </button>
            </div>
          ) : error ? (
            <div className="space-y-4 py-4">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h1 className="text-xl font-bold">Invite unavailable</h1>
              <p className="text-sm text-slate-500">{error}</p>
              <button
                type="button"
                onClick={() => navigate("/meetings")}
                className="w-full rounded-xl bg-slate-200 py-2.5 text-sm font-medium dark:bg-slate-800 cursor-pointer hover:bg-slate-300"
              >
                Go to meetings
              </button>
            </div>
          ) : (
            <div className="space-y-5 text-left">
              {/* Meeting Header */}
              <div className="text-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Video className="h-7 w-7" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {result?.meeting?.title || "Meeting Invitation"}
                </h1>
                {result?.meeting?.description && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {result.meeting.description}
                  </p>
                )}
                {result?.meeting?.date && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(result.meeting.date).toLocaleDateString(
                        undefined,
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                      {result.meeting.time ? ` at ${result.meeting.time}` : ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Capacity Banner if applicable */}
              {result?.meeting?.maxParticipants && (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>
                      Capacity: {result.meeting.acceptedCount || 0} /{" "}
                      {result.meeting.maxParticipants} accepted
                    </span>
                  </div>
                  {result.meeting.isFull && (
                    <span className="rounded bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
                      Full
                    </span>
                  )}
                </div>
              )}

              {/* Current RSVP Status badge */}
              {rsvpStatus && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 p-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Your Current RSVP:</span>
                  <span className="font-semibold capitalize text-indigo-600 dark:text-indigo-400">
                    {rsvpStatus}
                  </span>
                </div>
              )}

              {/* Decline Reason form */}
              {showDeclineInput ? (
                <div className="space-y-3 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 text-xs">
                  <label className="block font-semibold text-red-900 dark:text-red-200">
                    Reason for declining (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Schedule conflict, out of office..."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className="w-full rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-red-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeclineInput(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={responding}
                      onClick={() => handleRsvpAction("declined")}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {responding ? "Declining..." : "Confirm Decline"}
                    </button>
                  </div>
                </div>
              ) : showWaitlistInput ? (
                /* Waitlist Note form */
                <div className="space-y-3 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 text-xs">
                  <label className="block font-semibold text-amber-900 dark:text-amber-200">
                    Join Waitlist Note (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Available if a spot opens up..."
                    value={waitlistNote}
                    onChange={(e) => setWaitlistNote(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowWaitlistInput(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={responding}
                      onClick={() => handleRsvpAction("waitlisted")}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50"
                    >
                      {responding ? "Joining..." : "Confirm Waitlist"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Action buttons */
                <div className="space-y-2 pt-2">
                  {result?.meeting?.isFull ? (
                    <button
                      type="button"
                      disabled={responding || rsvpStatus === "waitlisted"}
                      onClick={() => handleRsvpAction("waitlisted")}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <Clock className="h-4 w-4" />
                      <span>
                        {rsvpStatus === "waitlisted"
                          ? "You are on the Waitlist"
                          : "Meeting Full - Join Waitlist"}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={responding}
                      onClick={() => handleRsvpAction("accepted")}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {rsvpStatus === "accepted"
                          ? "RSVP Accepted (Join Now)"
                          : "Accept & Join Meeting"}
                      </span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={responding}
                      onClick={() => handleRsvpAction("tentative")}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer disabled:opacity-50"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span>Tentative</span>
                    </button>

                    <button
                      type="button"
                      disabled={responding}
                      onClick={() => handleRsvpAction("declined")}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>

                  {rsvpStatus === "accepted" && (
                    <button
                      type="button"
                      onClick={handleProceedToMeeting}
                      className="w-full mt-2 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer transition-colors"
                    >
                      Proceed to Meeting Workspace →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingInviteJoin;
