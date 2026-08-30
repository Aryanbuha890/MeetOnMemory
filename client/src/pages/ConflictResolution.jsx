import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  ShieldAlert,
  Loader2,
  ScanSearch,
  RefreshCw,
  CheckCircle2,
  XCircle,
  PenLine,
  Sparkles,
  History,
} from "lucide-react";

/**
 * ConflictResolution.jsx (#1342)
 * Lets org admins/moderators scan for contradictory decisions/action
 * items, review the AI-generated explanation for each conflict, and
 * resolve it by keeping one member, entering a corrected value, or
 * dismissing the conflict as a false positive.
 */

const MODEL_OPTIONS = [
  { value: "decision", label: "Decisions" },
  { value: "actionItem", label: "Action Items" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open Conflicts" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All Conflicts" },
];

const ConflictResolution = () => {
  const [selectedModel, setSelectedModel] = useState("decision");
  const [selectedStatus, setSelectedStatus] = useState("open");
  const [scanning, setScanning] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [customValues, setCustomValues] = useState({});

  const [activeTab, setActiveTab] = useState("conflicts");
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedConflicts, setSelectedConflicts] = useState(new Set());
  const [bulkResolving, setBulkResolving] = useState(false);

  // Confirmation modal state (#1342)
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    conflictId: null,
    resolutionType: null,
    extra: {},
    title: "",
    message: "",
  });

  const loadConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await knowledgeApi.getConflicts({
        model: selectedModel,
        status: selectedStatus,
      });
      if (res.data?.success) {
        setConflicts(res.data.conflicts || []);
      }
    } catch (err) {
      console.error("Failed to load conflicts", err);
      toast.error("Failed to load conflicts.");
    } finally {
      setLoading(false);
    }
  }, [selectedModel, selectedStatus]);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await knowledgeApi.getConflictAuditHistory({
        page: 1,
        limit: 50,
      });
      if (res.data?.success) {
        setHistoryItems(res.data.history || []);
      }
    } catch (err) {
      console.error("Failed to load history", err);
      toast.error("Failed to load audit history.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const toggleSelection = (id) => {
    const next = new Set(selectedConflicts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedConflicts(next);
  };

  const toggleAll = () => {
    if (selectedConflicts.size === conflicts.length && conflicts.length > 0) {
      setSelectedConflicts(new Set());
    } else {
      setSelectedConflicts(new Set(conflicts.map((c) => c._id)));
    }
  };

  const handleBulkDismiss = async () => {
    if (selectedConflicts.size === 0) return;
    setBulkResolving(true);
    try {
      const res = await knowledgeApi.bulkResolveConflicts({
        conflictIds: Array.from(selectedConflicts),
        resolutionType: "dismissed",
      });
      if (res.data?.success) {
        toast.success(res.data.message || "Conflicts bulk dismissed");
        setSelectedConflicts(new Set());
        loadConflicts();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Bulk resolve failed");
    } finally {
      setBulkResolving(false);
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await knowledgeApi.scanForConflicts({
        dryRun: false,
        models: [selectedModel],
      });
      if (res.data?.success) {
        const found =
          res.data.report?.results?.[selectedModel]?.conflictsFound ?? 0;
        toast.success(
          found > 0
            ? `Scan complete — ${found} conflict${found === 1 ? "" : "s"} found.`
            : "Scan complete — no conflicts found.",
        );
        await loadConflicts();
      } else {
        toast.error(res.data?.message || "Scan failed.");
      }
    } catch (err) {
      console.error("Conflict scan error", err);
      toast.error(
        err.response?.data?.message || "Failed to run conflict scan.",
      );
    } finally {
      setScanning(false);
    }
  };

  const resolve = async (conflictId, resolutionType, extra = {}) => {
    setResolvingId(conflictId);
    try {
      const res = await knowledgeApi.resolveConflict(conflictId, {
        resolutionType,
        ...extra,
      });
      if (res.data?.success) {
        toast.success("Conflict resolved.");
        setConfirmConfig({
          isOpen: false,
          conflictId: null,
          resolutionType: null,
          extra: {},
          title: "",
          message: "",
        });
        setConflicts((prev) => prev.filter((c) => c._id !== conflictId));
      } else {
        toast.error(res.data?.message || "Failed to resolve conflict.");
      }
    } catch (err) {
      console.error("Resolve conflict error", err);
      toast.error(err.response?.data?.message || "Failed to resolve conflict.");
    } finally {
      setResolvingId(null);
    }
  };

  const promptResolve = (
    conflictId,
    resolutionType,
    extra = {},
    title = "Confirm Resolution",
    message = "Are you sure you want to apply this conflict resolution?",
  ) => {
    setConfirmConfig({
      isOpen: true,
      conflictId,
      resolutionType,
      extra,
      title,
      message,
    });
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              Conflict Resolution
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Find memories that contradict each other and resolve them without
              losing either version.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("conflicts")}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "conflicts"
                ? "border-amber-600 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <ShieldAlert className="w-4 h-4 inline-block mr-1.5 mb-0.5" />
            Active Conflicts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "history"
                ? "border-amber-600 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <History className="w-4 h-4 inline-block mr-1.5 mb-0.5" />
            Audit History
          </button>
        </div>

        {activeTab === "conflicts" && (
          <>
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={runScan}
                  disabled={scanning}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                >
                  {scanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ScanSearch className="w-4 h-4" />
                  )}
                  Scan for conflicts
                </button>
                <button
                  type="button"
                  onClick={loadConflicts}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              {conflicts.length > 0 && (
                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedConflicts.size === conflicts.length}
                      onChange={toggleAll}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    Select All
                  </label>
                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                  <button
                    type="button"
                    onClick={handleBulkDismiss}
                    disabled={selectedConflicts.size === 0 || bulkResolving}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 cursor-pointer"
                  >
                    {bulkResolving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    Bulk Dismiss ({selectedConflicts.size})
                  </button>
                </div>
              )}
            </div>

            <div>
              {loading && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Loading...
                </p>
              )}

              {!loading && conflicts.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No open conflicts — the knowledge graph is consistent. Try
                  running a scan if new memories were just added.
                </p>
              )}

              <div className="space-y-4">
                {conflicts.map((conflict) => (
                  <div
                    key={conflict._id}
                    className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedConflicts.has(conflict._id)}
                          onChange={() => toggleSelection(conflict._id)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 mt-0.5 cursor-pointer"
                        />
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                          <Sparkles className="w-4 h-4" />
                          Confidence: {conflict.confidence}%
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 pl-7">
                      {conflict.explanation}
                    </p>

                    <div className="grid gap-2 mt-3 pl-7">
                      {(conflict.memberSnapshots || []).map((member) => (
                        <div
                          key={member.memoryId}
                          className="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3"
                        >
                          <p className="text-sm text-slate-900 dark:text-white">
                            {member.text}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              promptResolve(
                                conflict._id,
                                "kept_member",
                                { keptMemoryId: member.memoryId },
                                "Keep Selected Memory Version",
                                `Are you sure you want to resolve this conflict by keeping "${member.text}"?`,
                              )
                            }
                            disabled={resolvingId === conflict._id}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            {resolvingId === conflict._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Keep this
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-3 flex-wrap pl-7">
                      <input
                        type="text"
                        placeholder="Neither is right — enter the correct value..."
                        value={customValues[conflict._id] || ""}
                        onChange={(e) =>
                          setCustomValues((prev) => ({
                            ...prev,
                            [conflict._id]: e.target.value,
                          }))
                        }
                        className="flex-1 min-w-[220px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          promptResolve(
                            conflict._id,
                            "custom_value",
                            { customValue: customValues[conflict._id] || "" },
                            "Apply Custom Correction",
                            `Are you sure you want to update this memory entry to "${customValues[conflict._id]}"?`,
                          )
                        }
                        disabled={
                          resolvingId === conflict._id ||
                          !customValues[conflict._id]
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                      >
                        {resolvingId === conflict._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PenLine className="w-3.5 h-3.5" />
                        )}
                        Save correction
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          promptResolve(
                            conflict._id,
                            "dismissed",
                            {},
                            "Dismiss Conflict",
                            "Are you sure you want to mark this conflict as a false positive and dismiss it?",
                          )
                        }
                        disabled={resolvingId === conflict._id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-500 dark:text-slate-400 text-xs font-medium hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 cursor-pointer"
                      >
                        {resolvingId === conflict._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        Not a conflict
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {loadingHistory && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading audit history...
              </p>
            )}
            {!loadingHistory && historyItems.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No conflict resolution history available.
              </p>
            )}
            <div className="space-y-3">
              {historyItems.map((log) => (
                <div
                  key={log._id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {log.action === "conflict_bulk_resolved"
                        ? "Bulk Dismissed"
                        : "Resolved"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-medium">
                      {log.actor?.name || log.actor?.email || "Unknown User"}
                    </span>{" "}
                    resolved{" "}
                    <span className="font-medium">
                      {log.action === "conflict_bulk_resolved"
                        ? `${log.details?.resolvedCount} conflicts`
                        : "1 conflict"}
                    </span>
                    {log.details?.resolutionType === "custom_value" && (
                      <span className="italic block mt-1 border-l-2 border-slate-300 dark:border-slate-600 pl-2">
                        "{log.details.customValue}"
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resolution Confirmation Modal (#1342) */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() =>
          setConfirmConfig({
            isOpen: false,
            conflictId: null,
            resolutionType: null,
            extra: {},
            title: "",
            message: "",
          })
        }
        onConfirm={() =>
          resolve(
            confirmConfig.conflictId,
            confirmConfig.resolutionType,
            confirmConfig.extra,
          )
        }
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Confirm Resolution"
        variant="warning"
        isLoading={resolvingId === confirmConfig.conflictId}
      />
    </div>
  );
};

export default ConflictResolution;
