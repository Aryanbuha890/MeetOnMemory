import React, { useState, useEffect, useCallback, useRef } from "react";
import meetingClipApi from "../../services/meetingClipApi";
import { io } from "socket.io-client";
import { createClerkSocketOptions } from "../../services/apiClient";

const CARD_CLASS =
  "bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6";

const INPUT_CLASS =
  "mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm p-2";

const getAudioUrl = (meeting) => {
  if (!meeting?.audioFilePath) return null;
  return meeting.audioFilePath.startsWith("http")
    ? meeting.audioFilePath
    : `/api/media/${meeting.audioFilePath}`;
};

const getErrorMessage = (err, fallback) =>
  err.response?.data?.message || err.response?.data?.error || fallback;

const normalizeClips = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.clips)) return data.clips;
  return [];
};

const ClipManager = ({ meetingId, meeting, canManage = true }) => {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(Boolean(meetingId));
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [annotationText, setAnnotationText] = useState("");
  const [annotationTimestamp, setAnnotationTimestamp] = useState("");
  const [activeClipId, setActiveClipId] = useState(null);

  const [editingClipId, setEditingClipId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [playingClipId, setPlayingClipId] = useState(null);
  const audioRef = useRef(null);
  const playingRangeRef = useRef(null);
  const audioUrl = getAudioUrl(meeting);

  const [selectedClipIds, setSelectedClipIds] = useState([]);
  const [compilationTitle, setCompilationTitle] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgressId, setMergeProgressId] = useState(null);

  const [trimmingClipId, setTrimmingClipId] = useState(null);
  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");

  const [exportProgress, setExportProgress] = useState({});

  const fetchClips = useCallback(async () => {
    if (!meetingId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setForbidden(false);
      const data = await meetingClipApi.getMeetingClips(meetingId);
      setClips(normalizeClips(data));
    } catch (err) {
      const status = err.response?.status;
      const message = getErrorMessage(err, "Failed to load clips");
      if (status === 401 || status === 403) {
        setForbidden(true);
        setError(
          message || "You are not authorized to view clips for this meeting.",
        );
      } else {
        setError(message);
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    let socket;
    const initSocket = async () => {
      try {
        const options = await createClerkSocketOptions();
        socket = io(window.location.origin, options);
        socket.on("clip.progress", (data) => {
          if (data.clipId) {
            setExportProgress((prev) => ({
              ...prev,
              [data.clipId]: data.error
                ? `Error: ${data.error}`
                : data.progress,
            }));
            if (data.progress === 100) {
              fetchClips();
            }
          }
        });
      } catch (err) {
        console.error("Clips socket connection error:", err);
      }
    };

    initSocket();

    return () => {
      if (socket) socket.disconnect();
    };
  }, [fetchClips]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const handleCreateClip = async (e) => {
    e.preventDefault();
    if (!canManage || !title || startTime === "" || endTime === "") return;

    try {
      setError("");
      const newClip = await meetingClipApi.createClip({
        meetingId,
        title,
        description,
        startTime: Number(startTime),
        endTime: Number(endTime),
      });
      setClips([newClip, ...clips]);
      setTitle("");
      setDescription("");
      setStartTime("");
      setEndTime("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create clip"));
      console.error(err);
    }
  };

  const handleUpdateClip = async (e, clipId) => {
    e.preventDefault();
    if (!canManage || !editTitle) return;

    try {
      setError("");
      const updated = await meetingClipApi.updateClip(clipId, {
        title: editTitle,
        description: editDescription,
      });
      setClips(clips.map((c) => (c._id === clipId ? { ...c, ...updated } : c)));
      setEditingClipId(null);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setError(
          getErrorMessage(err, "You are not authorized to update this clip."),
        );
      } else {
        setError(getErrorMessage(err, "Failed to update clip"));
      }
      console.error(err);
    }
  };

  const handleDeleteClip = async (clipId) => {
    if (!canManage) return;
    if (!window.confirm("Are you sure you want to delete this clip?")) return;
    try {
      setError("");
      await meetingClipApi.deleteClip(clipId);
      setClips(clips.filter((c) => c._id !== clipId));
      if (playingClipId === clipId) {
        audioRef.current?.pause();
        setPlayingClipId(null);
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setError(
          getErrorMessage(err, "You are not authorized to delete this clip."),
        );
      } else {
        setError(getErrorMessage(err, "Failed to delete clip"));
      }
      console.error(err);
    }
  };

  const handleTrimClip = async (e, clipId) => {
    e.preventDefault();
    try {
      setError("");
      setExportProgress((prev) => ({ ...prev, [clipId]: 0 }));
      await meetingClipApi.trimClip(clipId, {
        startTime: Number(trimStart),
        endTime: Number(trimEnd),
      });
      setTrimmingClipId(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to trim clip"));
      console.error(err);
    }
  };

  const handleMergeClips = async (e) => {
    e.preventDefault();
    if (selectedClipIds.length === 0) return;
    try {
      setError("");
      setIsMerging(true);
      const res = await meetingClipApi.mergeClips({
        clipIds: selectedClipIds,
        title: compilationTitle || "Merged Compilation",
      });
      const newCompilation = res.data || res;
      setMergeProgressId(newCompilation._id);
      setExportProgress((prev) => ({ ...prev, [newCompilation._id]: 0 }));
      setCompilationTitle("");
      setSelectedClipIds([]);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to merge clips"));
      console.error(err);
    } finally {
      setIsMerging(false);
    }
  };

  const handleToggleSelectClip = (clipId) => {
    setSelectedClipIds((prev) =>
      prev.includes(clipId)
        ? prev.filter((id) => id !== clipId)
        : [...prev, clipId],
    );
  };

  const handleAddAnnotation = async (e, clipId) => {
    e.preventDefault();
    if (!canManage || !annotationText || annotationTimestamp === "") return;

    try {
      setError("");
      const newAnnotation = await meetingClipApi.addClipAnnotation(clipId, {
        text: annotationText,
        timestamp: Number(annotationTimestamp),
      });

      setClips(
        clips.map((c) => {
          if (c._id === clipId) {
            return {
              ...c,
              annotations: [...(c.annotations || []), newAnnotation],
            };
          }
          return c;
        }),
      );
      setAnnotationText("");
      setAnnotationTimestamp("");
      setActiveClipId(null);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setError(
          getErrorMessage(err, "You are not authorized to annotate this clip."),
        );
      } else {
        setError(getErrorMessage(err, "Failed to add annotation"));
      }
      console.error(err);
    }
  };

  const handlePlayClip = async (clip) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (playingClipId === clip._id && !audio.paused) {
      audio.pause();
      setPlayingClipId(null);
      playingRangeRef.current = null;
      return;
    }

    playingRangeRef.current = {
      id: clip._id,
      start: Number(clip.startTime) || 0,
      end: Number(clip.endTime) || 0,
    };
    audio.currentTime = playingRangeRef.current.start;
    try {
      await audio.play();
      setPlayingClipId(clip._id);
    } catch (err) {
      console.error(err);
      setError("Unable to play this clip.");
    }
  };

  const handleAudioTimeUpdate = () => {
    const audio = audioRef.current;
    const range = playingRangeRef.current;
    if (!audio || !range) return;
    if (range.end > range.start && audio.currentTime >= range.end) {
      audio.pause();
      setPlayingClipId(null);
      playingRangeRef.current = null;
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (loading) {
    return (
      <div
        data-testid="clip-manager"
        data-meeting-id={meetingId}
        aria-busy="true"
        className={`${CARD_CLASS} animate-pulse`}
      >
        <div
          role="status"
          aria-label="Loading meeting clips"
          className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded mb-4"
        />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div
        data-testid="clip-manager-forbidden"
        data-meeting-id={meetingId}
        className={CARD_CLASS}
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Meeting Clips
        </h2>
        <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
          {error || "You are not authorized to view clips for this meeting."}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="clip-manager"
      data-meeting-id={meetingId}
      className={CARD_CLASS}
    >
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Meeting Clips
      </h2>
      {error && (
        <div
          role="alert"
          className="text-red-600 dark:text-red-400 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchClips}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline self-start"
          >
            Retry
          </button>
        </div>
      )}

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={() => {
            setPlayingClipId(null);
            playingRangeRef.current = null;
          }}
          className="hidden"
          data-testid="clip-manager-audio"
        />
      )}

      {canManage && (
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
            Create New Clip
          </h3>
          <form onSubmit={handleCreateClip} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="clip-title"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Title
                </label>
                <input
                  id="clip-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={INPUT_CLASS}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="clip-description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Description
                </label>
                <input
                  id="clip-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="clip-start-time"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Start Time (seconds)
                </label>
                <input
                  id="clip-start-time"
                  type="number"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={INPUT_CLASS}
                  min="0"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="clip-end-time"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  End Time (seconds)
                </label>
                <input
                  id="clip-end-time"
                  type="number"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={INPUT_CLASS}
                  min="0"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Create Clip
            </button>
          </form>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          Saved Clips ({clips.length})
        </h3>
        {selectedClipIds.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-2">
              Merge Compilation ({selectedClipIds.length} clips selected)
            </h4>
            <form
              onSubmit={handleMergeClips}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="text"
                value={compilationTitle}
                onChange={(e) => setCompilationTitle(e.target.value)}
                placeholder="Compilation Title (e.g. Highlights)"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none"
                required
                data-testid="merge-title-input"
              />
              <button
                type="submit"
                disabled={isMerging}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded text-sm font-semibold transition"
                data-testid="merge-submit-btn"
              >
                {isMerging ? "Merging..." : "Export Compilation"}
              </button>
            </form>
            {mergeProgressId &&
              exportProgress[mergeProgressId] !== undefined && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300 mb-1">
                    <span>Export Progress</span>
                    <span>{exportProgress[mergeProgressId]}%</span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${typeof exportProgress[mergeProgressId] === "number" ? exportProgress[mergeProgressId] : 0}%`,
                      }}
                      data-testid="merge-progress-bar"
                    />
                  </div>
                </div>
              )}
          </div>
        )}
        {clips.length === 0 ? (
          <p
            data-testid="clip-manager-empty"
            className="text-gray-500 dark:text-gray-400 italic"
          >
            No clips have been created for this meeting.
          </p>
        ) : (
          <div className="space-y-6">
            {clips.map((clip) => (
              <div
                key={clip._id}
                data-testid={`clip-card-${clip._id}`}
                className="border border-gray-200 dark:border-gray-700 rounded p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-2">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedClipIds.includes(clip._id)}
                      onChange={() => handleToggleSelectClip(clip._id)}
                      className="mt-1.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      data-testid={`clip-checkbox-${clip._id}`}
                    />
                    <div>
                      {editingClipId === clip._id ? (
                        <form
                          onSubmit={(e) => handleUpdateClip(e, clip._id)}
                          className="space-y-2"
                        >
                          <label
                            className="sr-only"
                            htmlFor={`edit-title-${clip._id}`}
                          >
                            Title
                          </label>
                          <input
                            id={`edit-title-${clip._id}`}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className={INPUT_CLASS}
                            required
                          />
                          <label
                            className="sr-only"
                            htmlFor={`edit-description-${clip._id}`}
                          >
                            Description
                          </label>
                          <input
                            id={`edit-description-${clip._id}`}
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className={INPUT_CLASS}
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClipId(null)}
                              className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {clip.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {clip.description}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">
                            {formatTime(clip.startTime)} -{" "}
                            {formatTime(clip.endTime)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {audioUrl ? (
                      <button
                        type="button"
                        onClick={() => handlePlayClip(clip)}
                        aria-label={
                          playingClipId === clip._id
                            ? `Pause clip ${clip.title}`
                            : `Play clip ${clip.title}`
                        }
                        className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                      >
                        {playingClipId === clip._id ? "Pause" : "Play"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        No recording available to play this clip.
                      </span>
                    )}
                    {canManage && editingClipId !== clip._id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClipId(clip._id);
                          setEditTitle(clip.title || "");
                          setEditDescription(clip.description || "");
                        }}
                        className="text-gray-600 dark:text-gray-300 text-sm hover:underline"
                      >
                        Edit
                      </button>
                    )}
                    {canManage && trimmingClipId !== clip._id && (
                      <button
                        type="button"
                        onClick={() => {
                          setTrimmingClipId(clip._id);
                          setTrimStart(clip.startTime.toString());
                          setTrimEnd(clip.endTime.toString());
                        }}
                        className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline"
                        data-testid={`clip-trim-btn-${clip._id}`}
                      >
                        Trim
                      </button>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClip(clip._id)}
                        className="text-red-500 text-sm hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 bg-gray-50 dark:bg-gray-900 p-3 rounded">
                  <h5 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Transcript Segments
                  </h5>
                  {clip.transcriptSegments?.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {clip.transcriptSegments.map((seg, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {seg.speaker}:{" "}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {seg.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                      No transcript segments in this range.
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Annotations
                  </h5>
                  {clip.annotations?.length > 0 && (
                    <ul className="mb-3 space-y-1">
                      {clip.annotations.map((ann, idx) => (
                        <li
                          key={ann._id || idx}
                          className="text-sm bg-blue-50 dark:bg-blue-950/40 p-2 rounded flex flex-col sm:flex-row sm:justify-between gap-1"
                        >
                          <span className="text-gray-800 dark:text-gray-100">
                            {ann.text}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                            @ {formatTime(ann.timestamp)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {canManage &&
                    (activeClipId === clip._id ? (
                      <form
                        onSubmit={(e) => handleAddAnnotation(e, clip._id)}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2"
                      >
                        <label
                          className="sr-only"
                          htmlFor={`ann-time-${clip._id}`}
                        >
                          Annotation time in seconds
                        </label>
                        <input
                          id={`ann-time-${clip._id}`}
                          type="number"
                          placeholder="Time (sec)"
                          value={annotationTimestamp}
                          onChange={(e) =>
                            setAnnotationTimestamp(e.target.value)
                          }
                          className="w-full sm:w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-1 text-sm"
                          required
                          min={clip.startTime}
                          max={clip.endTime}
                        />
                        <label
                          className="sr-only"
                          htmlFor={`ann-text-${clip._id}`}
                        >
                          Annotation note
                        </label>
                        <input
                          id={`ann-text-${clip._id}`}
                          type="text"
                          placeholder="Annotation note..."
                          value={annotationText}
                          onChange={(e) => setAnnotationText(e.target.value)}
                          className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-1 text-sm"
                          required
                        />
                        <button
                          type="submit"
                          className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded text-sm hover:bg-blue-200 dark:hover:bg-blue-900/60"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveClipId(null)}
                          className="text-gray-500 dark:text-gray-400 text-sm hover:underline"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveClipId(clip._id);
                          setAnnotationText("");
                          setAnnotationTimestamp(clip.startTime.toString());
                        }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        + Add Annotation
                      </button>
                    ))}
                  {trimmingClipId === clip._id && (
                    <form
                      onSubmit={(e) => handleTrimClip(e, clip._id)}
                      className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg space-y-4"
                      data-testid={`trim-form-${clip._id}`}
                    >
                      <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        Trim Clip Boundaries
                      </h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                            Start Time (seconds)
                          </label>
                          <input
                            type="number"
                            value={trimStart}
                            onChange={(e) => setTrimStart(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                            min="0"
                            required
                            data-testid={`trim-start-input-${clip._id}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                            End Time (seconds)
                          </label>
                          <input
                            type="number"
                            value={trimEnd}
                            onChange={(e) => setTrimEnd(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                            min="0"
                            required
                            data-testid={`trim-end-input-${clip._id}`}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setTrimmingClipId(null)}
                          className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-xs font-bold transition"
                          data-testid={`trim-submit-btn-${clip._id}`}
                        >
                          Submit Trim
                        </button>
                      </div>
                    </form>
                  )}
                  {exportProgress[clip._id] !== undefined && (
                    <div className="mt-3.5 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                      <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">
                        <span>Rendering Clip Boundaries...</span>
                        <span>{exportProgress[clip._id]}%</span>
                      </div>
                      <div className="w-full bg-gray-250 dark:bg-gray-950 rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                          style={{
                            width: `${typeof exportProgress[clip._id] === "number" ? exportProgress[clip._id] : 0}%`,
                          }}
                          data-testid={`clip-progress-bar-${clip._id}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClipManager;
