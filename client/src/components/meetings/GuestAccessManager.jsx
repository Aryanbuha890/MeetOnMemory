import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  createGuestToken,
  revokeGuestToken,
  getHostAnalytics,
  exportFeedbackCSV,
} from "../../services/guestAccessApi";
import {
  Eye,
  Users,
  MessageSquare,
  Download,
  Copy,
  Plus,
  Shield,
  Clock,
  CheckCircle2,
  ChevronDown,
  Loader2,
} from "lucide-react";

export const GuestAccessManager = ({ meetingId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    guestEmail: "",
    label: "",
    permissions: ["view_summary", "view_transcript"],
    expiresAt: "",
    maxViews: 0,
  });
  const [isExpanded, setIsExpanded] = useState(true);
  const [generatedLink, setGeneratedLink] = useState("");

  const fetchAnalytics = useCallback(async () => {
    if (!meetingId) return;
    try {
      setLoading(true);
      const data = await getHostAnalytics(meetingId);
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to load guest analytics:", error);
      toast.error("Failed to load guest access analytics");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handlePermissionChange = (perm) => {
    setFormData((prev) => {
      const perms = new Set(prev.permissions);
      if (perms.has(perm)) {
        perms.delete(perm);
      } else {
        perms.add(perm);
      }
      return { ...prev, permissions: Array.from(perms) };
    });
  };

  const handleCreateToken = async (e) => {
    e.preventDefault();
    if (!formData.guestEmail || !formData.expiresAt) {
      toast.error("Guest Email and Expiry Date are required");
      return;
    }

    try {
      setCreating(true);
      const data = await createGuestToken(meetingId, formData);
      toast.success("Guest token created successfully");
      const hostUrl = window.location.origin;
      setGeneratedLink(`${hostUrl}/guest/${data.token}`);
      setFormData({
        guestEmail: "",
        label: "",
        permissions: ["view_summary", "view_transcript"],
        expiresAt: "",
        maxViews: 0,
      });
      setShowCreateForm(false);
      fetchAnalytics();
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to create guest token",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId) => {
    try {
      await revokeGuestToken(tokenId);
      toast.success("Token revoked successfully");
      fetchAnalytics();
    } catch (error) {
      console.error(error);
      toast.error("Failed to revoke token");
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportFeedbackCSV(meetingId);
      toast.success("Feedback CSV exported successfully");
    } catch (error) {
      console.error("Failed to export feedback CSV:", error);
      toast.error("Failed to export feedback CSV");
    } finally {
      setExporting(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    toast.info("Guest access link copied to clipboard!");
  };

  return (
    <div
      data-testid="guest-access-manager"
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-6 my-6 text-slate-800 dark:text-slate-200 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              External Token Analytics & Guest Access
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transform transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Track secure validation instances, token lifecycle audits, and
              reviewer feedback notes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            data-testid="export-feedback-csv-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export Feedback CSV
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            data-testid="toggle-create-token-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            {showCreateForm ? "Close" : "Generate Link"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-6">
          {/* Numerical Telemetry Metrics Banner */}
          {loading && !analytics ? (
            <div className="p-8 flex justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : !analytics ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-400">
              Failed to load operational telemetry metrics.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                data-testid="metric-views"
                className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Room Views
                  </div>
                  <div
                    data-testid="total-views-value"
                    className="text-2xl font-bold text-slate-900 dark:text-white mt-1"
                  >
                    {analytics.metrics?.totalViews ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
                  <Eye className="w-5 h-5" />
                </div>
              </div>

              <div
                data-testid="metric-joins"
                className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Unique Joins
                  </div>
                  <div
                    data-testid="total-joins-value"
                    className="text-2xl font-bold text-slate-900 dark:text-white mt-1"
                  >
                    {analytics.metrics?.totalJoins ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div
                data-testid="metric-feedback"
                className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Feedback Form Submissions
                  </div>
                  <div
                    data-testid="total-feedback-value"
                    className="text-2xl font-bold text-slate-900 dark:text-white mt-1"
                  >
                    {analytics.metrics?.feedbackCount ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>
            </div>
          )}

          {/* Create New Guest Link Form Modal/Card */}
          {showCreateForm && (
            <form
              data-testid="create-guest-token-form"
              onSubmit={handleCreateToken}
              className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Generate Secure Guest Access Key
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Guest Email
                  </label>
                  <input
                    type="email"
                    data-testid="guest-email-input"
                    value={formData.guestEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, guestEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="guest@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Label / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    data-testid="guest-label-input"
                    value={formData.label}
                    onChange={(e) =>
                      setFormData({ ...formData, label: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. External Audit Reviewer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Expiry Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    data-testid="guest-expiry-input"
                    value={formData.expiresAt}
                    onChange={(e) =>
                      setFormData({ ...formData, expiresAt: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Max Allowed Views (0 for unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    data-testid="guest-maxviews-input"
                    value={formData.maxViews}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxViews: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  Permissions Scope
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    "view_transcript",
                    "view_summary",
                    "view_action_items",
                    "add_comments",
                  ].map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg cursor-pointer hover:border-indigo-400 transition"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm)}
                        onChange={() => handlePermissionChange(perm)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
                        {perm
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  data-testid="submit-create-token-btn"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Generate Guest Link
                </button>
              </div>
            </form>
          )}

          {/* Generated Link Alert Banner */}
          {generatedLink && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-emerald-900 dark:text-emerald-200 font-mono text-xs truncate">
                  {generatedLink}
                </span>
              </div>
              <button
                onClick={copyToClipboard}
                data-testid="copy-link-btn"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium whitespace-nowrap transition"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Link
              </button>
            </div>
          )}

          {/* Cryptographic Key Expiry & Distribution Audit Log */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Token Distribution History & Audit Trail
              </h3>
              <span className="text-xs text-slate-400">
                {analytics?.tokens?.length || 0} Key
                {analytics?.tokens?.length === 1 ? "" : "s"} Issued
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
              {!analytics || analytics.tokens.length === 0 ? (
                <p className="p-5 text-xs text-slate-400 text-center">
                  No guest tokens created yet. Click "Generate Link" above to
                  issue one.
                </p>
              ) : (
                analytics.tokens.map((token) => (
                  <div
                    key={token.id || token._id}
                    data-testid={`token-row-${token.id || token._id}`}
                    className="p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                          {token.label || token.guestEmail || "Access Key"}
                        </p>
                        <span className="text-xs text-slate-400">
                          ({token.guestEmail})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <code className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded font-mono">
                          {token.token}
                        </code>
                        <span>
                          • Views: {token.currentViews || token.viewCount || 0}{" "}
                          / {token.maxViews || "∞"}
                        </span>
                        <span>• Joins: {token.joinCount || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:text-right text-xs self-end sm:self-auto">
                      <div className="space-y-0.5">
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-bold uppercase tracking-wide text-[10px] ${
                              token.isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                            }`}
                          >
                            {token.isActive ? "Active" : "Revoked"}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last Used:{" "}
                          {token.lastUsedAt
                            ? new Date(token.lastUsedAt).toLocaleString()
                            : "Never"}
                        </p>
                      </div>

                      {token.isActive && (
                        <button
                          onClick={() => handleRevoke(token.id || token._id)}
                          data-testid={`revoke-token-${token.id || token._id}`}
                          className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-2.5 py-1 rounded-lg transition"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Guest Reviews & Peer Feedback Loop Sub-Canvas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Peer Feedback Feedback Loop
              </h3>
              <span className="text-xs text-slate-400">
                {analytics?.feedback?.length || 0} Review
                {analytics?.feedback?.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="space-y-3">
              {!analytics || analytics.feedback.length === 0 ? (
                <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                  <p className="text-xs text-slate-400 italic">
                    No reviews recorded for this channel context yet.
                  </p>
                </div>
              ) : (
                analytics.feedback.map((f) => (
                  <div
                    key={f.id || f._id}
                    data-testid={`feedback-item-${f.id || f._id}`}
                    className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-2 shadow-xs"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {f.guestName || "Anonymous Guest"}
                        </span>
                        {f.guestEmail && (
                          <span className="text-slate-400">
                            ({f.guestEmail})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          ⭐️ {f.rating}/5
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {f.createdAt
                            ? new Date(f.createdAt).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                      "{f.comments || "No comment provided."}"
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestAccessManager;
