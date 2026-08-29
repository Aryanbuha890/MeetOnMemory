import React, { useState } from "react";
import { useKeyMoments } from "../../hooks/useKeyMoments";
import { useUser } from "@clerk/clerk-react";
import {
  Download,
  Clock,
  Edit2,
  Trash2,
  Check,
  X,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";

// Format time in seconds to mm:ss
const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const CATEGORIES = [
  "decision",
  "action_item",
  "insight",
  "question",
  "disagreement",
];

const CATEGORY_COLORS = {
  decision:
    "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  action_item:
    "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
  insight:
    "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800",
  question:
    "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
  disagreement:
    "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
};

export const KeyMomentsPanel = ({
  meetingId,
  onJumpToTime,
  onSeekToTimestamp,
  moments: propMoments,
  isAuthorized: propIsAuthorized,
  onRefresh,
}) => {
  const { user } = useUser() || {};
  const hookResult = useKeyMoments(meetingId);

  // Support both hook-driven and prop-driven usage
  const moments = propMoments || hookResult.moments || [];
  const isLoading = propMoments ? false : hookResult.isLoading;
  const error = propMoments ? null : hookResult.error;
  const isExporting = hookResult.isExporting;

  const [filterCategory, setFilterCategory] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editSnippet, setEditSnippet] = useState("");
  const [editCategory, setEditCategory] = useState("insight");
  const [editStartTime, setEditStartTime] = useState(0);
  const [editNote, setEditNote] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newMoment, setNewMoment] = useState({
    snippet: "",
    category: "insight",
    startTime: 0,
    endTime: 10,
    note: "",
  });

  const handleSeek = (timeInSeconds) => {
    const target = Number(timeInSeconds) || 0;
    if (onSeekToTimestamp) {
      onSeekToTimestamp(target);
    } else if (onJumpToTime) {
      onJumpToTime(target);
    }

    // Global custom event for video/audio player or transcript synchronizers
    window.dispatchEvent(
      new CustomEvent("meetonmemory:seek-transcript", {
        detail: { timestamp: target },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("seekToTimestamp", {
        detail: { timestamp: target },
      }),
    );
  };

  const handleStartEdit = (moment) => {
    const id = moment._id || moment.id;
    setEditingId(id);
    setEditSnippet(moment.snippet || moment.title || "");
    setEditCategory(moment.category || "insight");
    setEditStartTime(
      moment.startTime !== undefined
        ? moment.startTime
        : moment.timestamp !== undefined
          ? moment.timestamp
          : 0,
    );
    setEditNote(moment.note || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditSnippet("");
    setEditNote("");
  };

  const handleSaveEdit = async (id) => {
    if (!editSnippet.trim()) {
      toast.error("Snippet or title cannot be empty");
      return;
    }

    try {
      setIsSubmittingEdit(true);
      if (hookResult.updateMoment) {
        await hookResult.updateMoment(id, {
          snippet: editSnippet.trim(),
          title: editSnippet.trim(),
          category: editCategory,
          startTime: Number(editStartTime) || 0,
          endTime: (Number(editStartTime) || 0) + 10,
          note: editNote.trim(),
        });
      } else {
        await fetch(`/api/key-moments/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editSnippet.trim(),
            snippet: editSnippet.trim(),
            category: editCategory,
            startTime: Number(editStartTime) || 0,
            note: editNote.trim(),
          }),
        });
      }

      setEditingId(null);
      if (onRefresh) onRefresh();
      toast.success("Key moment updated");
    } catch (err) {
      console.error("Failed to update moment:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to update moment",
      );
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this key moment?")) {
      return;
    }

    try {
      if (hookResult.removeMoment) {
        await hookResult.removeMoment(id);
      } else {
        await fetch(`/api/key-moments/${id}`, { method: "DELETE" });
      }
      if (onRefresh) onRefresh();
      toast.success("Key moment deleted");
    } catch (err) {
      console.error("Failed to delete moment:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to delete moment",
      );
    }
  };

  const handleExportCsv = async () => {
    const targetSessionId =
      meetingId || moments[0]?.meetingId || moments[0]?.sessionId;
    if (!targetSessionId) {
      toast.info("No moments to export");
      return;
    }

    try {
      if (hookResult.exportMoments) {
        await hookResult.exportMoments();
        toast.success("Key moments exported to CSV");
      } else {
        window.open(
          `/api/key-moments/export?meetingId=${targetSessionId}&sessionId=${targetSessionId}`,
          "_blank",
        );
      }
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export key moments");
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newMoment.snippet.trim()) return;

    try {
      if (hookResult.addMoment) {
        await hookResult.addMoment(newMoment);
      } else {
        await fetch("/api/key-moments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...newMoment,
            meetingId,
          }),
        });
      }

      setIsAdding(false);
      setNewMoment({
        snippet: "",
        category: "insight",
        startTime: 0,
        endTime: 10,
        note: "",
      });
      if (onRefresh) onRefresh();
      toast.success("Key moment created");
    } catch (err) {
      console.error("Failed to add moment:", err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to add moment",
      );
    }
  };

  const filteredMoments =
    filterCategory === "all"
      ? moments
      : moments.filter((m) => m.category === filterCategory);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Loading key moments...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg text-sm">
        Error loading moments: {error}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs"
      data-testid="key-moments-panel"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-2 bg-gray-50/50 dark:bg-gray-850">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            Key Moments
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
            {moments.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"
            aria-label="Filter moments by category"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace("_", " ")}
              </option>
            ))}
          </select>

          {moments.length > 0 && (
            <button
              onClick={handleExportCsv}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-xs"
              title="Export Key Moments CSV"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Moments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {filteredMoments.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            {filterCategory !== "all"
              ? `No key moments in category "${filterCategory.replace("_", " ")}".`
              : "No key moments recorded yet."}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filteredMoments.map((moment) => {
              const id = moment._id || moment.id;
              const isEditing = editingId === id;
              const rawTime =
                moment.startTime !== undefined
                  ? moment.startTime
                  : moment.timestamp !== undefined
                    ? moment.timestamp
                    : 0;
              const displayTitle = moment.snippet || moment.title || "";
              const categoryColor =
                CATEGORY_COLORS[moment.category] ||
                "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200";

              const isAuthor =
                moment.userId?._id === user?._id ||
                moment.userId?.id === user?.id ||
                moment.userId === user?._id ||
                moment.userId === user?.id;
              const canEdit =
                propIsAuthorized !== undefined
                  ? propIsAuthorized
                  : isAuthor || user?.publicMetadata?.role === "admin";

              return (
                <li
                  key={id}
                  className={`p-3 rounded-xl border transition-all ${
                    isEditing
                      ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs"
                      : "border-gray-100 dark:border-gray-700/60 bg-gray-50/70 dark:bg-gray-750/50 hover:bg-gray-100/70 dark:hover:bg-gray-700/60"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <div className="w-24">
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase">
                            Time (s)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editStartTime}
                            onChange={(e) =>
                              setEditStartTime(Number(e.target.value))
                            }
                            className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase">
                            Category
                          </label>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase">
                          Snippet / Title
                        </label>
                        <textarea
                          rows={2}
                          value={editSnippet}
                          onChange={(e) => setEditSnippet(e.target.value)}
                          className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded p-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Key moment title or transcript quote..."
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase">
                          Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Context or action..."
                        />
                      </div>

                      <div className="flex justify-end items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="text-xs px-2.5 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingEdit}
                          onClick={() => handleSaveEdit(id)}
                          className="flex items-center gap-1 text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition-colors"
                        >
                          {isSubmittingEdit ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          {/* Jump-to-transcript timestamp button */}
                          <button
                            onClick={() => handleSeek(rawTime)}
                            className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/80 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Jump to transcript timestamp"
                          >
                            <Clock className="w-3 h-3" />
                            {formatTime(rawTime)}
                          </button>

                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${categoryColor}`}
                          >
                            {(moment.category || "insight").replace("_", " ")}
                          </span>

                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">
                            {displayTitle}
                          </span>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <button
                              onClick={() => handleStartEdit(moment)}
                              className="text-xs text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 p-1 hover:bg-white dark:hover:bg-gray-700 rounded transition-colors"
                              title="Edit key moment"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="sr-only">Edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(id)}
                              className="text-xs text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 hover:bg-white dark:hover:bg-gray-700 rounded transition-colors"
                              title="Delete key moment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="sr-only">Delete</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {moment.note && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-2 border-l-2 border-indigo-200 dark:border-indigo-800">
                          {moment.note}
                        </p>
                      )}

                      {moment.userId && typeof moment.userId === "object" && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                          {moment.userId.profilePicture ? (
                            <img
                              src={moment.userId.profilePicture}
                              alt=""
                              className="w-4 h-4 rounded-full"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-gray-300">
                              {moment.userId.name?.charAt(0) || "U"}
                            </div>
                          )}
                          <span>
                            {moment.userId.name || moment.userId.email}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add New Moment Section */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-850 rounded-b-xl">
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-2 flex items-center justify-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Key Moment</span>
          </button>
        ) : (
          <form onSubmit={handleAddSubmit} className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
                Snippet / Highlight Text
              </label>
              <textarea
                required
                maxLength={500}
                rows={2}
                value={newMoment.snippet}
                onChange={(e) =>
                  setNewMoment({ ...newMoment, snippet: e.target.value })
                }
                placeholder="Highlight text from transcript..."
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
                  Category
                </label>
                <select
                  value={newMoment.category}
                  onChange={(e) =>
                    setNewMoment({ ...newMoment, category: e.target.value })
                  }
                  className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-24">
                <label className="block text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
                  Time (s)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={newMoment.startTime}
                  onChange={(e) =>
                    setNewMoment({
                      ...newMoment,
                      startTime: Number(e.target.value),
                      endTime: Number(e.target.value) + 10,
                    })
                  }
                  className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
                Note (Optional)
              </label>
              <input
                type="text"
                value={newMoment.note}
                onChange={(e) =>
                  setNewMoment({ ...newMoment, note: e.target.value })
                }
                placeholder="Add context or notes..."
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors shadow-xs"
              >
                Save Moment
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default KeyMomentsPanel;
