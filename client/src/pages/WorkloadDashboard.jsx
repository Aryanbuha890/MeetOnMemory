import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import api from "../services/apiClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  Zap,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Users,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  GripVertical,
  Check,
} from "lucide-react";

const DEFAULT_CAPACITY = 10;

const WorkloadDashboard = () => {
  const [workloads, setWorkloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [viewMode, setViewMode] = useState("person"); // "person" | "team"
  const [pendingReassignments, setPendingReassignments] = useState([]); // [{ actionItemId, fromUserId, toUserId, item, fromUser, toUser }]

  useEffect(() => {
    fetchWorkload();
  }, []);

  const fetchWorkload = async () => {
    setLoading(true);
    try {
      const response = await api.get("/workload");
      setWorkloads(response.data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load workload data");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const response = await api.get("/workload/suggest");
      const fetchedSuggestions = response.data.data.suggestions || [];
      setSuggestions(fetchedSuggestions);
      toast.success(response.data.data.message || "AI Suggestions updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to get suggestions");
    } finally {
      setSuggesting(false);
    }
  };

  // Stage reassignment into preview queue
  const stageReassignment = (
    actionItemId,
    fromUserId,
    toUserId,
    item,
    fromUser,
    toUser,
  ) => {
    if (fromUserId === toUserId) return;

    setPendingReassignments((prev) => {
      // Remove any existing pending change for this actionItemId
      const filtered = prev.filter((p) => p.actionItemId !== actionItemId);
      return [
        ...filtered,
        { actionItemId, fromUserId, toUserId, item, fromUser, toUser },
      ];
    });

    toast.info("Reassignment added to preview");
  };

  const removePendingReassignment = (actionItemId) => {
    setPendingReassignments((prev) =>
      prev.filter((p) => p.actionItemId !== actionItemId),
    );
  };

  const resetPreview = () => {
    setPendingReassignments([]);
  };

  const handleApplyRebalance = async () => {
    if (pendingReassignments.length === 0) return;

    setRebalancing(true);
    try {
      const payload = {
        reassignments: pendingReassignments.map((p) => ({
          actionItemId: p.actionItemId,
          toUserId: p.toUserId,
        })),
      };

      await api.post("/workload/rebalance", payload);
      toast.success("Workload rebalanced successfully!");
      setPendingReassignments([]);
      setSuggestions([]);
      await fetchWorkload();
    } catch (error) {
      console.error(error);
      toast.error("Failed to reassign workload");
    } finally {
      setRebalancing(false);
    }
  };

  const handleStageAiSuggestion = (suggestion) => {
    stageReassignment(
      suggestion.actionItemId,
      suggestion.fromUserId,
      suggestion.toUserId,
      suggestion.item,
      suggestion.fromUser,
      suggestion.toUser,
    );
  };

  const handleStageAllAiSuggestions = () => {
    if (suggestions.length === 0) return;
    suggestions.forEach((s) => {
      stageReassignment(
        s.actionItemId,
        s.fromUserId,
        s.toUserId,
        s.item,
        s.fromUser,
        s.toUser,
      );
    });
  };

  // Compute previewed workloads based on pendingReassignments
  const previewedWorkloads = useMemo(() => {
    const baseWorkloads = Array.isArray(workloads) ? workloads : [];
    if (pendingReassignments.length === 0) return baseWorkloads;

    // Deep copy workloads to calculate previewed state
    const map = new Map();
    baseWorkloads.forEach((w) => {
      map.set(w.user._id.toString(), {
        ...w,
        actionItems: Array.isArray(w.actionItems) ? [...w.actionItems] : [],
        previewLoadScore: w.loadScore || 0,
      });
    });

    pendingReassignments.forEach((p) => {
      const fromMember = map.get(p.fromUserId);
      const toMember = map.get(p.toUserId);

      if (fromMember) {
        let itemScore = 1;
        if (p.item?.priority === "high") itemScore = 2;
        if (p.item?.priority === "urgent") itemScore = 3;

        fromMember.previewLoadScore = Math.max(
          0,
          fromMember.previewLoadScore - itemScore,
        );
        fromMember.actionItems = fromMember.actionItems.filter(
          (i) => i._id.toString() !== p.actionItemId,
        );
      }

      if (toMember) {
        let itemScore = 1;
        if (p.item?.priority === "high") itemScore = 2;
        if (p.item?.priority === "urgent") itemScore = 3;

        toMember.previewLoadScore += itemScore;
        if (
          p.item &&
          !toMember.actionItems.some((i) => i._id.toString() === p.actionItemId)
        ) {
          toMember.actionItems.push(p.item);
        }
      }
    });

    return Array.from(map.values());
  }, [workloads, pendingReassignments]);

  // Chart dataset for Person View
  const personChartData = useMemo(() => {
    return previewedWorkloads.map((w) => {
      const original = workloads.find(
        (o) => o.user._id.toString() === w.user._id.toString(),
      );
      const capacity = w.capacity || DEFAULT_CAPACITY;
      const currentLoad = original ? original.loadScore : w.loadScore;
      const previewLoad = w.previewLoadScore ?? currentLoad;

      return {
        id: w.user._id,
        name: w.user.name,
        currentLoad,
        previewLoad,
        capacity,
        itemCount: w.actionItems.length,
        status:
          previewLoad > capacity
            ? "Overloaded"
            : previewLoad <= 2
              ? "Underloaded"
              : "Optimal",
      };
    });
  }, [workloads, previewedWorkloads]);

  // Chart dataset for Team View
  const teamChartData = useMemo(() => {
    const teamGroups = {};
    previewedWorkloads.forEach((w) => {
      const teamName =
        w.team || (w.role ? `${w.role.toUpperCase()} Team` : "General Team");
      if (!teamGroups[teamName]) {
        teamGroups[teamName] = {
          team: teamName,
          totalCurrentLoad: 0,
          totalPreviewLoad: 0,
          totalCapacity: 0,
          memberCount: 0,
        };
      }

      const original = workloads.find(
        (o) => o.user._id.toString() === w.user._id.toString(),
      );
      const currentLoad = original ? original.loadScore : w.loadScore;
      const previewLoad = w.previewLoadScore ?? currentLoad;

      teamGroups[teamName].totalCurrentLoad += currentLoad;
      teamGroups[teamName].totalPreviewLoad += previewLoad;
      teamGroups[teamName].totalCapacity += w.capacity || DEFAULT_CAPACITY;
      teamGroups[teamName].memberCount += 1;
    });

    return Object.values(teamGroups);
  }, [workloads, previewedWorkloads]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalItems = previewedWorkloads.reduce(
      (sum, w) => sum + w.actionItems.length,
      0,
    );
    const totalLoad = previewedWorkloads.reduce(
      (sum, w) => sum + (w.previewLoadScore ?? w.loadScore),
      0,
    );
    const totalCapacity = previewedWorkloads.reduce(
      (sum, w) => sum + (w.capacity || DEFAULT_CAPACITY),
      0,
    );
    const overloadedCount = previewedWorkloads.filter(
      (w) =>
        (w.previewLoadScore ?? w.loadScore) > (w.capacity || DEFAULT_CAPACITY),
    ).length;
    const underloadedCount = previewedWorkloads.filter(
      (w) => (w.previewLoadScore ?? w.loadScore) <= 2,
    ).length;

    const utilization = totalCapacity
      ? Math.min(100, Math.round((totalLoad / totalCapacity) * 100))
      : 0;

    return {
      totalItems,
      totalLoad,
      totalCapacity,
      overloadedCount,
      underloadedCount,
      utilization,
    };
  }, [previewedWorkloads]);

  // Drag & Drop Handlers
  const handleDragStart = (e, item, fromUserId) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ actionItemId: item._id, fromUserId }),
    );
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetUserId) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const { actionItemId, fromUserId } = JSON.parse(dataStr);
      if (fromUserId === targetUserId) return;

      const fromMember = workloads.find(
        (w) => w.user._id.toString() === fromUserId,
      );
      const toMember = workloads.find(
        (w) => w.user._id.toString() === targetUserId,
      );
      const item = fromMember?.actionItems.find(
        (i) => i._id.toString() === actionItemId,
      );

      if (item && fromMember && toMember) {
        stageReassignment(
          actionItemId,
          fromUserId,
          targetUserId,
          item,
          fromMember.user,
          toMember.user,
        );
      }
    } catch (err) {
      console.error("Drop failed", err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-500" />
            Workload & Capacity Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Real-time load distribution, capacity analytics, and interactive
            rebalance preview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchWorkload}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleSuggest}
            disabled={suggesting}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
          >
            <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
            {suggesting ? "Analyzing Load..." : "AI Rebalance Suggestions"}
          </button>
        </div>
      </header>

      {/* Rebalance Preview Notification Banner */}
      {pendingReassignments.length > 0 && (
        <div className="bg-gradient-to-r from-blue-900/90 to-indigo-900/90 text-white p-4 rounded-2xl shadow-lg border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-4 animate-bounce-short">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
              <Zap className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                Rebalance Preview Active
                <span className="px-2 py-0.5 text-xs bg-blue-400/20 text-blue-200 rounded-full border border-blue-300/30">
                  {pendingReassignments.length} pending change(s)
                </span>
              </h3>
              <p className="text-xs text-blue-200">
                Charts and team capacities are showing proposed load
                distribution. Apply changes to execute reassignments.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={resetPreview}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Preview
            </button>
            <button
              onClick={handleApplyRebalance}
              disabled={rebalancing}
              className="flex items-center gap-2 px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {rebalancing ? "Applying..." : "Apply Rebalance"}
            </button>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Total Action Items</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {summaryMetrics.totalItems}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Across {previewedWorkloads.length} team members
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Capacity Utilization</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {summaryMetrics.utilization}%
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-1.5 rounded-full ${
                summaryMetrics.utilization > 90
                  ? "bg-red-500"
                  : summaryMetrics.utilization > 75
                    ? "bg-amber-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(100, summaryMetrics.utilization)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Overloaded Members</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {summaryMetrics.overloadedCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Exceeding recommended capacity
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Available Capacity</span>
            <UserCheck className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {summaryMetrics.underloadedCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Members ready for more tasks
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Capacity Charts Section */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    Capacity Analytics Chart
                    {pendingReassignments.length > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-full">
                        Preview Mode
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Compare member & team workload scores against baseline
                    capacity thresholds (10 pts).
                  </p>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                  <button
                    onClick={() => setViewMode("person")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      viewMode === "person"
                        ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    By Person
                  </button>
                  <button
                    onClick={() => setViewMode("team")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      viewMode === "team"
                        ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    By Team / Role
                  </button>
                </div>
              </div>

              {/* Chart Renderer */}
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {viewMode === "person" ? (
                    <BarChart
                      data={personChartData}
                      layout="vertical"
                      margin={{ left: 60, right: 30, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="#374151"
                        opacity={0.15}
                      />
                      <XAxis type="number" domain={[0, "auto"]} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: "#6B7280", fontSize: 12 }}
                        width={110}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 text-xs space-y-1">
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {data.name}
                                </p>
                                <p className="text-gray-500">
                                  Current Load:{" "}
                                  <span className="font-bold text-gray-800 dark:text-gray-200">
                                    {data.currentLoad}
                                  </span>
                                </p>
                                {pendingReassignments.length > 0 && (
                                  <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                                    Preview Load:{" "}
                                    <span className="font-bold">
                                      {data.previewLoad}
                                    </span>
                                  </p>
                                )}
                                <p className="text-gray-500">
                                  Capacity Limit:{" "}
                                  <span className="font-bold">
                                    {data.capacity}
                                  </span>
                                </p>
                                <div className="pt-1">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      data.status === "Overloaded"
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                        : data.status === "Underloaded"
                                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                          : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                    }`}
                                  >
                                    {data.status}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <ReferenceLine
                        x={DEFAULT_CAPACITY}
                        stroke="#EF4444"
                        strokeDasharray="4 4"
                        label={{
                          value: "Max Capacity (10)",
                          fill: "#EF4444",
                          fontSize: 10,
                          position: "top",
                        }}
                      />
                      <Bar
                        dataKey="currentLoad"
                        name="Current Load"
                        fill="#3B82F6"
                        radius={[0, 4, 4, 0]}
                        barSize={pendingReassignments.length > 0 ? 12 : 20}
                      />
                      {pendingReassignments.length > 0 && (
                        <Bar
                          dataKey="previewLoad"
                          name="Previewed Load"
                          fill="#8B5CF6"
                          radius={[0, 4, 4, 0]}
                          barSize={12}
                        />
                      )}
                    </BarChart>
                  ) : (
                    <BarChart
                      data={teamChartData}
                      margin={{ left: 20, right: 30, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#374151"
                        opacity={0.15}
                      />
                      <XAxis
                        dataKey="team"
                        tick={{ fill: "#6B7280", fontSize: 12 }}
                      />
                      <YAxis type="number" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="totalCurrentLoad"
                        name="Total Team Load"
                        fill="#3B82F6"
                        radius={[4, 4, 0, 0]}
                        barSize={28}
                      />
                      <Bar
                        dataKey="totalCapacity"
                        name="Team Capacity Limit"
                        fill="#10B981"
                        radius={[4, 4, 0, 0]}
                        barSize={28}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Drag & Reassign Workload Matrix */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                    Drag & Drop Task Reassignment
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Drag any task card into another member's column to stage a
                    load rebalance.
                  </p>
                </div>
              </div>

              {/* Members Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {previewedWorkloads.map((w) => {
                  const currentScore = w.previewLoadScore ?? w.loadScore;
                  const isOverloaded =
                    currentScore > (w.capacity || DEFAULT_CAPACITY);
                  const isUnderloaded = currentScore <= 2;

                  return (
                    <div
                      key={w.user._id}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, w.user._id.toString())}
                      className={`p-4 rounded-xl border transition-all ${
                        isOverloaded
                          ? "border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10"
                          : isUnderloaded
                            ? "border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10"
                            : "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
                      }`}
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={
                              w.user.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                w.user.name,
                              )}`
                            }
                            alt=""
                            className="w-8 h-8 rounded-full border border-white dark:border-gray-700 shadow-xs"
                          />
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                              {w.user.name}
                            </h3>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                              {w.role || "Member"}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            isOverloaded
                              ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                              : isUnderloaded
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                          }`}
                        >
                          Score: {currentScore}/10
                        </span>
                      </div>

                      {/* Task Cards Drop Target */}
                      <div className="space-y-2 min-h-[120px]">
                        {w.actionItems.length === 0 ? (
                          <div className="h-full flex items-center justify-center p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-400 italic">
                            Drop tasks here
                          </div>
                        ) : (
                          w.actionItems.map((item) => (
                            <div
                              key={item._id}
                              draggable
                              onDragStart={(e) =>
                                handleDragStart(e, item, w.user._id.toString())
                              }
                              className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-gray-800 dark:text-gray-200 font-medium line-clamp-2">
                                  {item.text}
                                </p>
                                <span
                                  className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                                    item.priority === "urgent"
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                                      : item.priority === "high"
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                  }`}
                                >
                                  {item.priority || "normal"}
                                </span>
                              </div>

                              {/* Task Reassign Selector */}
                              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-[11px] text-gray-400">
                                <span>Reassign to:</span>
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      const targetUser = workloads.find(
                                        (m) =>
                                          m.user._id.toString() ===
                                          e.target.value,
                                      )?.user;
                                      if (targetUser) {
                                        stageReassignment(
                                          item._id,
                                          w.user._id.toString(),
                                          targetUser._id.toString(),
                                          item,
                                          w.user,
                                          targetUser,
                                        );
                                      }
                                    }
                                  }}
                                  defaultValue=""
                                  className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 text-[11px] text-gray-700 dark:text-gray-200"
                                >
                                  <option value="" disabled>
                                    Select member...
                                  </option>
                                  {workloads
                                    .filter(
                                      (m) =>
                                        m.user._id.toString() !==
                                        w.user._id.toString(),
                                    )
                                    .map((m) => (
                                      <option
                                        key={m.user._id}
                                        value={m.user._id}
                                      >
                                        {m.user.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar: AI Suggestions & Pending Preview Panel */}
          <div className="space-y-6">
            {/* Pending Preview Staging Queue */}
            {pendingReassignments.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-500" />
                    Staged Reassignments
                  </h2>
                  <button
                    onClick={resetPreview}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {pendingReassignments.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                          "{p.item?.text || "Task"}"
                        </span>
                        <button
                          onClick={() =>
                            removePendingReassignment(p.actionItemId)
                          }
                          className="text-gray-400 hover:text-red-500 font-bold ml-2"
                        >
                          ×
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-gray-500">
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {p.fromUser?.name || "Assignee"}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {p.toUser?.name || "Target"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleApplyRebalance}
                  disabled={rebalancing}
                  className="w-full mt-4 flex justify-center items-center gap-2 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {rebalancing ? "Applying..." : "Confirm & Execute Rebalance"}
                </button>
              </div>
            )}

            {/* AI Rebalance Recommendations */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-y-auto max-h-[600px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                  AI Rebalance Suggestions
                </h2>
                {suggestions.length > 0 && (
                  <button
                    onClick={handleStageAllAiSuggestions}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    Stage All
                  </button>
                )}
              </div>

              {suggestions.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center mx-auto mb-3">
                    <Zap className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                    No active suggestions yet. Click "AI Rebalance Suggestions"
                    to analyze team workloads and generate optimal
                    reassignments.
                  </p>
                  <button
                    onClick={handleSuggest}
                    disabled={suggesting}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-medium transition-colors"
                  >
                    {suggesting ? "Analyzing..." : "Analyze Workload Now"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600 space-y-3 transition-all hover:shadow-md"
                    >
                      <p className="text-xs text-gray-900 dark:text-gray-100 font-semibold line-clamp-2">
                        "{s.item?.text || "Task"}"
                      </p>

                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1.5">
                          <img
                            src={
                              s.fromUser?.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                s.fromUser?.name || "From",
                              )}`
                            }
                            alt=""
                            className="w-5 h-5 rounded-full"
                          />
                          {s.fromUser?.name}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                        <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold">
                          <img
                            src={
                              s.toUser?.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                s.toUser?.name || "To",
                              )}`
                            }
                            alt=""
                            className="w-5 h-5 rounded-full"
                          />
                          {s.toUser?.name}
                        </span>
                      </div>

                      {s.reason && (
                        <p className="text-[11px] text-gray-500 italic bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                          "{s.reason}"
                        </p>
                      )}

                      <button
                        onClick={() => handleStageAiSuggestion(s)}
                        className="w-full flex justify-center items-center gap-1.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Preview & Stage Change
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkloadDashboard;
