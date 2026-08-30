import React, { useEffect, useState, useCallback, useRef } from "react";
import highlightReelApi from "../../services/highlightReelApi.js";
import { sharedLinkApi } from "../../services/sharedLinkApi.js";
import { toast } from "react-toastify";

const HighlightReel = ({ meetingId, canManage = true }) => {
  const [reel, setReel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Export / Download states
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [exportError, setExportError] = useState(null);

  // Share modal states
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  // Edit / Trim clip states
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({
    timestamp: 0,
    endTime: 0,
    speaker: "",
    excerpt: "",
    aiRationale: "",
    type: "insight",
    sentiment: "neutral",
  });

  const pollIntervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const fetchReel = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await highlightReelApi.getHighlightReel(meetingId);
      if (data.success && data.data) {
        setReel(data.data);
      } else {
        setReel(null);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setReel(null);
      } else {
        setError("Failed to fetch highlight reel.");
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  // Polling mechanism when reel is pending
  const startPolling = useCallback(() => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await highlightReelApi.getHighlightReel(meetingId);
        if (res.data?.success && res.data.data) {
          const currentReel = res.data.data;
          if (currentReel.status !== "pending") {
            setReel(currentReel);
            stopPolling();
            if (currentReel.status === "failed") {
              toast.error("Highlight reel generation failed.");
            } else {
              toast.success("Highlight reel generated successfully!");
            }
          }
        }
      } catch (pollErr) {
        console.error("Error polling highlight reel status:", pollErr);
      }
    }, 3000);
  }, [meetingId, stopPolling]);

  useEffect(() => {
    if (meetingId) {
      fetchReel();
    }
    return () => stopPolling();
  }, [meetingId, fetchReel, stopPolling]);

  useEffect(() => {
    if (reel?.status === "pending" && !pollIntervalRef.current) {
      startPolling();
    } else if (reel?.status !== "pending") {
      stopPolling();
    }
  }, [reel, startPolling, stopPolling]);

  const handleGenerate = async () => {
    if (!canManage) return;
    try {
      setGenerating(true);
      setError(null);
      const { data } = await highlightReelApi.generateHighlightReel(meetingId);
      if (data.success) {
        toast.info("Highlight Reel generation started. Check back shortly.");
        setReel({ status: "pending" });
        startPolling();
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to generate reel";
      toast.error(msg);
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const saveHighlightsToApi = async (updatedHighlights, updatedNarrative) => {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        highlights: updatedHighlights,
        ...(updatedNarrative !== undefined
          ? { narrative: updatedNarrative }
          : {}),
      };
      const res = await highlightReelApi.updateHighlightReel(
        meetingId,
        payload,
      );
      if (res.data?.success && res.data.data) {
        setReel(res.data.data);
        toast.success("Highlight Reel updated successfully!");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save changes";
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Reordering clips
  const handleMoveHighlight = (index, direction) => {
    if (!canManage || !reel?.highlights) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= reel.highlights.length) return;

    const updated = [...reel.highlights];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    saveHighlightsToApi(updated);
  };

  // Trimming / Editing clip
  const handleStartEdit = (index) => {
    if (!canManage || !reel?.highlights?.[index]) return;
    const item = reel.highlights[index];
    setEditingIndex(index);
    setEditForm({
      timestamp: item.timestamp ?? 0,
      endTime: item.endTime ?? (item.timestamp ? item.timestamp + 30 : 30),
      speaker: item.speaker || "Unknown",
      excerpt: item.excerpt || "",
      aiRationale: item.aiRationale || "",
      type: item.type || "insight",
      sentiment: item.sentiment || "neutral",
    });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!canManage || editingIndex === null || !reel?.highlights) return;

    if (Number(editForm.endTime) <= Number(editForm.timestamp)) {
      toast.error("End time must be greater than start timestamp.");
      return;
    }

    const updated = [...reel.highlights];
    updated[editingIndex] = {
      ...updated[editingIndex],
      timestamp: Number(editForm.timestamp),
      endTime: Number(editForm.endTime),
      speaker: editForm.speaker,
      excerpt: editForm.excerpt,
      aiRationale: editForm.aiRationale,
      type: editForm.type,
      sentiment: editForm.sentiment,
    };

    setEditingIndex(null);
    saveHighlightsToApi(updated);
  };

  const handleRemoveHighlight = (index) => {
    if (!canManage || !reel?.highlights) return;
    if (
      !window.confirm(
        "Are you sure you want to remove this clip from the reel?",
      )
    )
      return;

    const updated = reel.highlights.filter((_, i) => i !== index);
    saveHighlightsToApi(updated);
  };

  // Export / Download actions with progress
  const handleExportHtml = async () => {
    try {
      setDownloading(true);
      setDownloadProgress(10);
      setExportError(null);

      const response = await highlightReelApi.exportHighlightReelHtml(
        meetingId,
        {
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total,
              );
              setDownloadProgress(percent);
            } else {
              setDownloadProgress(70);
            }
          },
        },
      );

      setDownloadProgress(100);
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "text/html" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `highlight_reel_${meetingId}.html`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("HTML Export completed!");
    } catch (err) {
      console.error(err);
      setExportError("Failed to export HTML reel.");
      toast.error("Failed to export HTML");
    } finally {
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(0);
      }, 500);
    }
  };

  const handleExportJson = () => {
    if (!reel) return;
    try {
      const jsonStr = JSON.stringify(reel, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `highlight_reel_${meetingId}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("JSON Export completed!");
    } catch {
      toast.error("Failed to export JSON");
    }
  };

  // Share Link Action
  const handleShareReel = async () => {
    try {
      setSharing(true);
      const res = await sharedLinkApi.createLink({
        resourceId: meetingId,
        resourceType: "Meeting",
      });

      if (res.data?.success && res.data.link) {
        const generatedHash = res.data.link.hash;
        const fullShareUrl = `${window.location.origin}/shared/${generatedHash}`;
        setShareUrl(fullShareUrl);
        setShowShareModal(true);
      } else {
        toast.error("Failed to generate share link.");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Error generating share link";
      toast.error(msg);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyShareUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  const sentimentColors = {
    positive:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    neutral: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    negative: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const formatTime = (seconds) => {
    if (typeof seconds !== "number" || isNaN(seconds)) return "00:00:00";
    return new Date(seconds * 1000).toISOString().substring(11, 19);
  };

  if (loading) {
    return (
      <div
        data-testid="highlight-reel-loading"
        className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-lg"
      ></div>
    );
  }

  if (error && !reel) {
    return (
      <div
        data-testid="highlight-reel-error"
        className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-6 text-center"
      >
        <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>
        <button
          onClick={fetchReel}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
        >
          Retry Fetching Reel
        </button>
      </div>
    );
  }

  if (!reel || reel.status === "failed") {
    return (
      <div
        data-testid="highlight-reel-empty"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center"
      >
        <h3 className="text-lg font-bold mb-2">AI-Curated Highlight Reel</h3>
        <p className="text-gray-500 mb-4 max-w-md">
          Generate a narrative-driven reel of the most important moments,
          decisions, and breakthroughs from this meeting.
        </p>
        {canManage ? (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {generating ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Starting Generation...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  ></path>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                Generate Highlight Reel
              </>
            )}
          </button>
        ) : (
          <p className="text-sm text-gray-500 italic">
            Highlight reel has not been generated for this meeting.
          </p>
        )}
        {reel?.status === "failed" && (
          <p className="text-red-500 mt-2 text-sm">
            Previous generation failed. You can try again.
          </p>
        )}
      </div>
    );
  }

  if (reel.status === "pending") {
    return (
      <div
        data-testid="highlight-reel-pending"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center h-48"
      >
        <svg
          className="animate-spin h-8 w-8 text-blue-500 mb-4"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          AI is curating your highlight reel...
        </h3>
        <p className="text-gray-500 text-sm mt-2">
          This usually takes about a minute. The reel will appear here
          automatically.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="highlight-reel-container"
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
    >
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Highlight Reel
          </h2>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line max-w-3xl">
            {reel.narrative}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Share Button */}
          <button
            type="button"
            onClick={handleShareReel}
            disabled={sharing}
            data-testid="share-reel-button"
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {sharing ? "Sharing..." : "Share Reel"}
          </button>

          {/* Export HTML */}
          <button
            type="button"
            onClick={handleExportHtml}
            disabled={downloading}
            data-testid="export-html-button"
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {downloading ? (
              <span>Downloading ({downloadProgress}%)</span>
            ) : (
              <span>Export HTML</span>
            )}
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            data-testid="export-json-button"
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Export JSON
          </button>

          {/* Regenerate (Permission Gated) */}
          {canManage && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || saving}
              data-testid="regenerate-button"
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Export / Download Progress Bar */}
      {downloading && (
        <div className="mb-4 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-2 transition-all duration-200"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
      )}

      {/* Export Error Alert */}
      {exportError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-center justify-between text-sm text-red-600 dark:text-red-400">
          <span>{exportError}</span>
          <button
            type="button"
            onClick={handleExportHtml}
            className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 font-semibold"
          >
            Retry Download
          </button>
        </div>
      )}

      {/* General Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-center justify-between text-sm text-red-600 dark:text-red-400">
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchReel}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Highlights List & Timeline */}
      <div className="space-y-6 mt-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 dark:before:via-gray-600 before:to-transparent">
        {(reel.highlights || []).map((h, i) => (
          <div
            key={h._id || i}
            data-testid={`highlight-card-${i}`}
            className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
          >
            {/* Timeline dot */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-gray-800 bg-blue-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
              <span className="text-xs font-bold">{i + 1}</span>
            </div>

            {/* Card Content or Trim Form */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/80 backdrop-blur-sm">
              {editingIndex === i ? (
                /* Trim / Edit Form */
                <form
                  onSubmit={handleSaveEdit}
                  className="space-y-3"
                  data-testid={`edit-form-${i}`}
                >
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Trim & Edit Clip #{i + 1}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor={`edit-start-${i}`}
                        className="block text-xs text-gray-500 dark:text-gray-400"
                      >
                        Start Time (sec)
                      </label>
                      <input
                        id={`edit-start-${i}`}
                        type="number"
                        min="0"
                        value={editForm.timestamp}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            timestamp: e.target.value,
                          })
                        }
                        className="w-full p-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-end-${i}`}
                        className="block text-xs text-gray-500 dark:text-gray-400"
                      >
                        End Time (sec)
                      </label>
                      <input
                        id={`edit-end-${i}`}
                        type="number"
                        min="0"
                        value={editForm.endTime}
                        onChange={(e) =>
                          setEditForm({ ...editForm, endTime: e.target.value })
                        }
                        className="w-full p-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`edit-speaker-${i}`}
                      className="block text-xs text-gray-500 dark:text-gray-400"
                    >
                      Speaker
                    </label>
                    <input
                      id={`edit-speaker-${i}`}
                      type="text"
                      value={editForm.speaker}
                      onChange={(e) =>
                        setEditForm({ ...editForm, speaker: e.target.value })
                      }
                      className="w-full p-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`edit-excerpt-${i}`}
                      className="block text-xs text-gray-500 dark:text-gray-400"
                    >
                      Excerpt
                    </label>
                    <textarea
                      id={`edit-excerpt-${i}`}
                      rows={2}
                      value={editForm.excerpt}
                      onChange={(e) =>
                        setEditForm({ ...editForm, excerpt: e.target.value })
                      }
                      className="w-full p-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingIndex(null)}
                      className="px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:underline"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 font-medium"
                    >
                      {saving ? "Saving..." : "Save Trim"}
                    </button>
                  </div>
                </form>
              ) : (
                /* View Card */
                <>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                        {h.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(h.timestamp)}
                        {h.endTime ? ` - ${formatTime(h.endTime)}` : ""}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        sentimentColors[h.sentiment] || sentimentColors.neutral
                      }`}
                    >
                      {h.sentiment}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {h.speaker}
                  </div>

                  <blockquote className="text-lg font-medium italic text-gray-900 dark:text-white border-l-4 border-indigo-500 pl-3 my-3">
                    "{h.excerpt}"
                  </blockquote>

                  <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-2 rounded mb-3">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Why it matters:{" "}
                    </span>
                    {h.aiRationale}
                  </div>

                  {/* Clip Edit / Reorder Controls (Permission Gated) */}
                  {canManage && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveHighlight(i, -1)}
                          disabled={i === 0 || saving}
                          title="Move Up"
                          data-testid={`move-up-${i}`}
                          className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 cursor-pointer"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveHighlight(i, 1)}
                          disabled={i === reel.highlights.length - 1 || saving}
                          title="Move Down"
                          data-testid={`move-down-${i}`}
                          className="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 cursor-pointer"
                        >
                          ▼
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(i)}
                          data-testid={`trim-button-${i}`}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                        >
                          Trim / Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveHighlight(i)}
                          data-testid={`remove-button-${i}`}
                          className="text-xs text-red-500 hover:underline font-medium cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Share Link Modal */}
      {showShareModal && (
        <div
          data-testid="share-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Share Highlight Reel
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Anyone with this link can view the public summary of this
              highlight reel.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={shareUrl}
                data-testid="share-url-input"
                className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={handleCopyShareUrl}
                data-testid="copy-share-url-button"
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium"
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HighlightReel;
