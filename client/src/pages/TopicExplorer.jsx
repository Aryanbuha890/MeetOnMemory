import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  GitMerge,
  Trash2,
  Edit2,
  RefreshCw,
  X,
  Layers,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent.js";
import apiClient from "../services/apiClient.js";
import Navbar from "../components/Navbar.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
  "#6366F1",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

const TopicExplorer = () => {
  const { userData } = useContext(AppContent);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);

  // Action states
  const [extracting, setExtracting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Modals state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMergeConfirmOpen, setIsMergeConfirmOpen] = useState(false);
  const [targetClusterId, setTargetClusterId] = useState("");

  const orgId = userData?.organization?._id || userData?.organization;

  const fetchClusters = useCallback(async () => {
    try {
      if (!orgId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const res = await apiClient.get(`/api/topics/clusters/org/${orgId}`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setClusters(res.data.data);
      } else if (Array.isArray(res.data?.data)) {
        setClusters(res.data.data);
      } else {
        setClusters([]);
      }
    } catch (err) {
      console.error("Error fetching clusters", err);
      setError("Failed to load topic clusters. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // Keep selectedCluster updated if clusters change
  useEffect(() => {
    setSelectedCluster((curr) => {
      if (!curr) return null;
      const match = clusters.find((c) => c._id === curr._id);
      return match || null;
    });
  }, [clusters]);

  // Extract Topics for Organization CTA
  const handleExtractTopics = async () => {
    if (!orgId) return;
    try {
      setExtracting(true);
      const res = await apiClient.post(`/api/topics/extract/org/${orgId}`);
      if (res.data?.success) {
        toast.success(
          res.data.data?.newlyExtracted > 0
            ? `Extracted topics from ${res.data.data.newlyExtracted} new meetings!`
            : "Topic clusters updated and synchronized successfully!",
        );
        await fetchClusters();
      } else {
        toast.info("Topic extraction complete.");
        await fetchClusters();
      }
    } catch (err) {
      console.error("Error extracting topics", err);
      toast.error(
        err.response?.data?.error ||
          "Failed to extract topics. Please try again.",
      );
    } finally {
      setExtracting(false);
    }
  };

  // Rename Cluster
  const handleRenameCluster = async (clusterId, currentLabel) => {
    const newLabel = window.prompt("Enter new cluster label:", currentLabel);
    if (
      !newLabel ||
      newLabel.trim() === "" ||
      newLabel.trim() === currentLabel
    ) {
      return;
    }

    try {
      const res = await apiClient.put(`/api/topics/clusters/${clusterId}`, {
        label: newLabel.trim(),
      });
      if (res.data?.success && res.data?.data) {
        toast.success("Cluster renamed successfully");
        const updated = res.data.data;
        setClusters((prev) =>
          prev.map((c) => (c._id === clusterId ? updated : c)),
        );
        setSelectedCluster((prev) =>
          prev?._id === clusterId ? updated : prev,
        );
      }
    } catch (err) {
      console.error("Error renaming cluster", err);
      toast.error(err.response?.data?.error || "Failed to rename cluster");
    }
  };

  // Delete Cluster
  const handleDeleteCluster = async () => {
    if (!selectedCluster) return;

    try {
      setIsDeleting(true);
      await apiClient.delete(`/api/topics/clusters/${selectedCluster._id}`);
      toast.success(`Cluster "${selectedCluster.label}" deleted successfully`);
      const deletedId = selectedCluster._id;
      setIsDeleteModalOpen(false);
      setSelectedCluster(null);
      setClusters((prev) => prev.filter((c) => c._id !== deletedId));
    } catch (err) {
      console.error("Error deleting cluster", err);
      toast.error(err.response?.data?.error || "Failed to delete cluster");
    } finally {
      setIsDeleting(false);
    }
  };

  // Merge Cluster
  const handleStartMerge = () => {
    const availableTargets = clusters.filter(
      (c) => c._id !== selectedCluster?._id,
    );
    if (availableTargets.length === 0) {
      toast.info("No other clusters available to merge into.");
      return;
    }
    setTargetClusterId(availableTargets[0]._id);
    setIsMergeModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!selectedCluster || !targetClusterId) return;

    try {
      setIsMerging(true);
      const res = await apiClient.post(
        `/api/topics/clusters/${selectedCluster._id}/merge`,
        { targetClusterId },
      );
      if (res.data?.success && res.data?.data) {
        toast.success("Clusters merged successfully");
        setIsMergeConfirmOpen(false);
        setIsMergeModalOpen(false);
        const updatedTarget = res.data.data;
        setSelectedCluster(updatedTarget);
        await fetchClusters();
      }
    } catch (err) {
      console.error("Error merging clusters", err);
      toast.error(err.response?.data?.error || "Failed to merge clusters");
    } finally {
      setIsMerging(false);
    }
  };

  // Target cluster entity helper
  const targetClusterObj = useMemo(() => {
    return clusters.find((c) => c._id === targetClusterId);
  }, [clusters, targetClusterId]);

  // Prepare deterministic coordinates for bubble chart
  const chartData = useMemo(() => {
    return clusters.map((c, index) => {
      // Deterministic layout angle & radius to keep clusters stable
      const angle = (index * 137.5 * Math.PI) / 180;
      const radius = 20 + ((index * 15) % 30);
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);

      return {
        name: c.label,
        count: c.meetingCount,
        x: Math.max(10, Math.min(90, x)),
        y: Math.max(10, Math.min(90, y)),
        fill: COLORS[index % COLORS.length],
        ...c,
      };
    });
  }, [clusters]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Navbar />
      <div className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Layers className="h-8 w-8 text-blue-600" />
              Topic Explorer
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Extract, cluster, merge, and curate topics across organization
              meetings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/topic-evolution"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-all shadow-sm"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Topic Evolution</span>
            </Link>
            <button
              type="button"
              data-testid="extract-topics-btn"
              disabled={extracting || loading}
              onClick={handleExtractTopics}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl text-sm transition-all shadow-sm cursor-pointer"
            >
              {extracting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>
                {extracting ? "Extracting Topics..." : "Extract Topics"}
              </span>
            </button>
          </div>
        </div>

        {loading && (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="text-sm font-medium">
              Loading Topic Clusters...
            </span>
          </div>
        )}

        {error && !loading && (
          <div
            data-testid="topic-error-state"
            className="p-8 max-w-md mx-auto text-center bg-white dark:bg-gray-800 rounded-xl shadow border border-red-200 dark:border-red-800"
          >
            <h2 className="text-xl font-bold mb-2">Failed to Load Topics</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {error}
            </p>
            <button
              data-testid="retry-button"
              onClick={fetchClusters}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Scatter Overview Chart */}
              <div
                role="region"
                aria-label="Topic Clusters Overview Chart"
                className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow border border-gray-100 dark:border-gray-700/60 h-96 flex flex-col"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Topic Clusters Overview
                  </h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Click a cluster bubble to inspect and manage
                  </span>
                </div>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="x"
                        domain={[0, 100]}
                        hide
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="y"
                        domain={[0, 100]}
                        hide
                      />
                      <ZAxis
                        type="number"
                        dataKey="count"
                        range={[120, 1200]}
                        name="Meetings"
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ payload }) => {
                          if (payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 p-2.5 border border-gray-200 dark:border-gray-700 shadow-lg rounded-xl text-xs text-gray-800 dark:text-gray-200">
                                <p className="font-bold text-sm text-blue-600 dark:text-blue-400 mb-1">
                                  {data.name}
                                </p>
                                <p className="text-gray-600 dark:text-gray-400">
                                  Meetings:{" "}
                                  <strong className="text-gray-900 dark:text-white">
                                    {data.count}
                                  </strong>
                                </p>
                                {data.canonicalTopicNames &&
                                  data.canonicalTopicNames.length > 0 && (
                                    <p className="text-[11px] text-gray-500 mt-1 truncate max-w-xs">
                                      {data.canonicalTopicNames
                                        .slice(0, 3)
                                        .join(", ")}
                                    </p>
                                  )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter
                        name="Topics"
                        data={chartData}
                        onClick={(e) =>
                          e?.payload && setSelectedCluster(e.payload)
                        }
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grid of Clusters */}
              <div
                role="region"
                aria-label="Topic Clusters Grid"
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {clusters.map((cluster) => (
                  <div
                    key={cluster._id}
                    data-testid={`cluster-card-${cluster._id}`}
                    className={`bg-white dark:bg-gray-800 p-5 rounded-2xl border transition-all cursor-pointer ${
                      selectedCluster?._id === cluster._id
                        ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                        : "border-gray-200/80 dark:border-gray-700/60 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm"
                    }`}
                    onClick={() => setSelectedCluster(cluster)}
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white truncate">
                        {cluster.label}
                      </h3>
                      <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-1 rounded-full font-semibold shrink-0">
                        {cluster.meetingCount}{" "}
                        {cluster.meetingCount === 1 ? "meeting" : "meetings"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {cluster.canonicalTopicNames?.slice(0, 3).join(", ") ||
                        "No canonical subtopics recorded"}
                    </div>
                  </div>
                ))}
                {clusters.length === 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 col-span-2 text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      No topic clusters found.
                    </p>
                    <p className="text-xs">
                      Click <strong>"Extract Topics"</strong> above to discover
                      topics across your meetings.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Cluster Details & Actions Panel */}
            <div className="lg:col-span-1">
              {selectedCluster ? (
                <div
                  role="region"
                  aria-label="Selected Cluster Details"
                  className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-700/60 sticky top-28 space-y-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Selected Cluster
                      </span>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white break-words mt-0.5">
                        {selectedCluster.label}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCluster(null)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
                      aria-label="Deselect cluster"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100 dark:border-gray-700/60">
                    <button
                      type="button"
                      data-testid="rename-cluster-btn"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-650 rounded-xl transition-colors cursor-pointer"
                      onClick={() =>
                        handleRenameCluster(
                          selectedCluster._id,
                          selectedCluster.label,
                        )
                      }
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Rename
                    </button>
                    <button
                      type="button"
                      data-testid="merge-cluster-btn"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200/70 dark:border-amber-800/60 rounded-xl transition-colors cursor-pointer"
                      onClick={handleStartMerge}
                    >
                      <GitMerge className="h-3.5 w-3.5" />
                      Merge
                    </button>
                    <button
                      type="button"
                      data-testid="delete-cluster-btn"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200/70 dark:border-red-800/60 rounded-xl transition-colors cursor-pointer"
                      onClick={() => setIsDeleteModalOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>

                  {/* Metrics */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Associated Meetings
                    </h4>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {selectedCluster.meetingCount}
                    </p>
                  </div>

                  {/* Canonical Names */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                      Canonical Topics (
                      {selectedCluster.canonicalTopicNames?.length || 0})
                    </h4>
                    {selectedCluster.canonicalTopicNames &&
                    selectedCluster.canonicalTopicNames.length > 0 ? (
                      <ul className="space-y-1.5 text-xs">
                        {selectedCluster.canonicalTopicNames.map((name, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-750 text-gray-800 dark:text-gray-200"
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="truncate">{name}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        No canonical names recorded.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white/60 dark:bg-gray-800/60 p-8 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 min-h-[300px] flex flex-col items-center justify-center text-gray-400 text-center gap-2">
                  <Layers className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    No cluster selected
                  </p>
                  <p className="text-xs max-w-xs text-gray-400">
                    Click any bubble in the overview chart or a card in the grid
                    to view canonical subtopics, rename, merge, or delete.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteCluster}
        title="Delete Topic Cluster"
        message={`Are you sure you want to delete "${selectedCluster?.label}"? All associated meetings and transcripts will remain intact, but will no longer be linked to this cluster.`}
        confirmText="Delete Cluster"
        cancelText="Cancel"
        isLoading={isDeleting}
        loadingText="Deleting Cluster..."
        variant="danger"
      />

      {/* Merge Selection Modal */}
      {isMergeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsMergeModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="merge-modal-title"
        >
          <div
            className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <GitMerge className="h-5 w-5 text-amber-600" />
                <h3
                  id="merge-modal-title"
                  className="text-base font-bold text-gray-900 dark:text-white"
                >
                  Merge Topic Cluster
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Close merge dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-3">
              <p>
                Merge <strong>"{selectedCluster?.label}"</strong> into another
                destination cluster. All meetings referencing this cluster will
                be reassigned.
              </p>

              <div>
                <label
                  htmlFor="target-cluster-select"
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5"
                >
                  Destination Cluster *
                </label>
                <select
                  id="target-cluster-select"
                  value={targetClusterId}
                  onChange={(e) => setTargetClusterId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {clusters
                    .filter((c) => c._id !== selectedCluster?._id)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.label} ({c.meetingCount} meetings)
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-merge-proceed-btn"
                disabled={!targetClusterId}
                onClick={() => {
                  setIsMergeModalOpen(false);
                  setIsMergeConfirmOpen(true);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Continue to Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Final Confirmation Modal */}
      <ConfirmModal
        isOpen={isMergeConfirmOpen}
        onClose={() => setIsMergeConfirmOpen(false)}
        onConfirm={handleConfirmMerge}
        title="Confirm Topic Cluster Merge"
        message={`Are you sure you want to merge "${selectedCluster?.label}" into "${targetClusterObj?.label}"? This will reassign all associated meeting topics and delete "${selectedCluster?.label}". This action cannot be undone.`}
        confirmText="Merge Clusters"
        cancelText="Cancel"
        isLoading={isMerging}
        loadingText="Merging Clusters..."
        variant="warning"
      />
    </div>
  );
};

export default TopicExplorer;
