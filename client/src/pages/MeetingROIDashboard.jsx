import React, { useState, useEffect, useContext, useCallback } from "react";
import AppContent from "../context/AppContent";
import { meetingROIApi } from "../services/meetingROIApi";
import OrganizationEmptyState from "../components/organization/OrganizationEmptyState";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  BarChart3,
  Sliders,
  Sparkles,
  ListFilter,
  Plus,
  Edit2,
  Trash2,
  Target,
  Award,
  CheckCircle2,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";

const MEETING_TYPES = [
  { value: "all", label: "All Types" },
  { value: "strategy", label: "Strategy" },
  { value: "planning", label: "Planning" },
  { value: "1-on-1", label: "1-on-1" },
  { value: "retrospective", label: "Retrospective" },
  { value: "sales_client", label: "Sales & Client" },
  { value: "standup", label: "Standup" },
  { value: "review", label: "Review" },
  { value: "workshop", label: "Workshop" },
  { value: "other", label: "Other" },
];

const MeetingROIDashboard = () => {
  const { userData, loading: authLoading } = useContext(AppContent) || {};
  const organizationId =
    userData?.organization?._id || userData?.organization || null;

  // Active Tab
  const [activeTab, setActiveTab] = useState("overview");

  // Summary and Analytics State
  const [summaryData, setSummaryData] = useState(null);
  const [timeframe, setTimeframe] = useState("all");

  // Records Table State
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [page, setPage] = useState(1);

  // Modal State for Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    meetingType: "strategy",
    date: new Date().toISOString().split("T")[0],
    durationMinutes: 60,
    attendeeCount: 4,
    avgHourlyRate: 65,
    directCosts: {
      venue: 0,
      softwareLicenses: 0,
      refreshments: 0,
      materialsAndEquipment: 0,
      externalConsultants: 0,
      other: 0,
    },
    decisionValue: 1000,
    decisionDetails: [
      {
        title: "Key Architectural Decision",
        category: "revenue",
        estimatedValue: 1000,
        realizedStatus: "projected",
      },
    ],
    qualityMetrics: {
      efficiencyRating: 4,
      goalAchievementRate: 85,
      attendeeEngagementScore: 80,
      decisionSpeedMinutes: 20,
    },
    notes: "",
  });

  // What-If Simulator State
  const [simParams, setSimParams] = useState({
    attendeeCount: 4,
    durationMinutes: 45,
    avgHourlyRate: 65,
    directCost: 0,
    estimatedDecisionValue: 1200,
    frequencyPerMonth: 4,
  });
  const [simResult, setSimResult] = useState(null);

  // Load Dashboard Summary
  const fetchSummary = useCallback(async () => {
    if (!organizationId) {
      setSummaryData(null);
      return;
    }

    try {
      const res = await meetingROIApi.getROIDashboardSummary({
        timeframe,
        organizationId,
      });
      if (res?.success) {
        setSummaryData(res.data);
      } else {
        setSummaryData(null);
      }
    } catch (err) {
      console.error("Failed to fetch ROI dashboard summary:", err);
      toast.error(err.response?.data?.message || "Failed to load ROI summary");
    }
  }, [organizationId, timeframe]);

  // Load Records
  const fetchRecords = useCallback(async () => {
    if (!organizationId) {
      setRecords([]);
      return;
    }

    try {
      const res = await meetingROIApi.getROIRecords({
        organizationId,
        search: searchTerm,
        meetingType: selectedType,
        page,
        limit: 10,
        sortBy: "date",
        sortOrder: "desc",
      });
      if (res?.success) {
        setRecords(res.data?.records || []);
      }
    } catch (err) {
      console.error("Failed to fetch ROI records:", err);
    }
  }, [organizationId, searchTerm, selectedType, page]);

  // Run What-If Simulation
  const runSimulation = useCallback(async () => {
    try {
      const res = await meetingROIApi.simulateWhatIf(simParams);
      if (res?.success) {
        setSimResult(res.data);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    }
  }, [simParams]);

  useEffect(() => {
    if (!authLoading) {
      fetchSummary();
    }
  }, [authLoading, fetchSummary]);

  useEffect(() => {
    if (!authLoading) {
      fetchRecords();
    }
  }, [authLoading, fetchRecords]);

  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

  // Open Modal for Create or Edit
  const handleOpenModal = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        title: record.title || "",
        meetingType: record.meetingType || "strategy",
        date: record.date
          ? new Date(record.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        durationMinutes: record.durationMinutes || 60,
        attendeeCount: record.attendeeCount || 4,
        avgHourlyRate: record.avgHourlyRate || 65,
        directCosts: {
          venue: record.directCosts?.venue || 0,
          softwareLicenses: record.directCosts?.softwareLicenses || 0,
          refreshments: record.directCosts?.refreshments || 0,
          materialsAndEquipment: record.directCosts?.materialsAndEquipment || 0,
          externalConsultants: record.directCosts?.externalConsultants || 0,
          other: record.directCosts?.other || 0,
        },
        decisionValue: record.decisionValue || 0,
        decisionDetails:
          record.decisionDetails && record.decisionDetails.length > 0
            ? record.decisionDetails
            : [
                {
                  title: "Decision Item",
                  category: "revenue",
                  estimatedValue: record.decisionValue || 0,
                  realizedStatus: "projected",
                },
              ],
        qualityMetrics: {
          efficiencyRating: record.qualityMetrics?.efficiencyRating || 4,
          goalAchievementRate: record.qualityMetrics?.goalAchievementRate || 85,
          attendeeEngagementScore:
            record.qualityMetrics?.attendeeEngagementScore || 80,
          decisionSpeedMinutes:
            record.qualityMetrics?.decisionSpeedMinutes || 20,
        },
        notes: record.notes || "",
      });
    } else {
      setEditingRecord(null);
      setFormData({
        title: "",
        meetingType: "strategy",
        date: new Date().toISOString().split("T")[0],
        durationMinutes: 60,
        attendeeCount: 4,
        avgHourlyRate: 65,
        directCosts: {
          venue: 0,
          softwareLicenses: 0,
          refreshments: 0,
          materialsAndEquipment: 0,
          externalConsultants: 0,
          other: 0,
        },
        decisionValue: 1000,
        decisionDetails: [
          {
            title: "Decision Item",
            category: "revenue",
            estimatedValue: 1000,
            realizedStatus: "projected",
          },
        ],
        qualityMetrics: {
          efficiencyRating: 4,
          goalAchievementRate: 85,
          attendeeEngagementScore: 80,
          decisionSpeedMinutes: 20,
        },
        notes: "",
      });
    }
    setModalOpen(true);
  };

  // Submit Record Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Please provide a meeting title");
      return;
    }

    try {
      setModalSubmitting(true);
      if (editingRecord) {
        await meetingROIApi.updateROIRecord(editingRecord._id, formData);
        toast.success("Meeting ROI record updated");
      } else {
        await meetingROIApi.createROIRecord({
          ...formData,
          organization: organizationId,
        });
        toast.success("Meeting ROI record created");
      }
      setModalOpen(false);
      fetchSummary();
      fetchRecords();
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err.response?.data?.message || "Failed to save record");
    } finally {
      setModalSubmitting(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Are you sure you want to delete this ROI record?")) {
      return;
    }

    try {
      await meetingROIApi.deleteROIRecord(id);
      toast.success("ROI record deleted");
      fetchSummary();
      fetchRecords();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete record");
    }
  };

  // Form helpers for decision items
  const addDecisionItem = () => {
    setFormData((prev) => ({
      ...prev,
      decisionDetails: [
        ...prev.decisionDetails,
        {
          title: "",
          category: "revenue",
          estimatedValue: 0,
          realizedStatus: "projected",
        },
      ],
    }));
  };

  const removeDecisionItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      decisionDetails: prev.decisionDetails.filter((_, i) => i !== index),
    }));
  };

  const updateDecisionItem = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.decisionDetails];
      updated[index] = { ...updated[index], [field]: value };
      const sum = updated.reduce(
        (acc, it) => acc + (Number(it.estimatedValue) || 0),
        0,
      );
      return {
        ...prev,
        decisionDetails: updated,
        decisionValue: sum,
      };
    });
  };

  if (!organizationId && !authLoading) {
    return <OrganizationEmptyState />;
  }

  const summary = summaryData?.summary || {};
  const costBreakdown = summaryData?.costBreakdown || {};
  const quality = summaryData?.qualityMetrics || {};
  const benchmarks = summaryData?.benchmarks || {};
  const recommendations = summaryData?.recommendations || [];
  const roiByType = summaryData?.roiByType || [];
  const monthlyTrends = summaryData?.monthlyTrends || [];
  const topPerformers = summaryData?.topPerformers || [];
  const lowestPerformers = summaryData?.lowestPerformers || [];

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8"
      data-testid="meeting-roi-dashboard"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Meeting ROI Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Measure financial expenditure vs. quantifiable decision value
                generated across meetings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Filter timeframe"
          >
            <option value="all">All Time</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last 1 Year</option>
          </select>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add ROI Record</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Cost
            </span>
            <DollarSign className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {`$${(summary.totalCost || 0).toLocaleString()}`}
          </p>
          <span className="text-xs text-gray-500">Labor + Direct Expenses</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Decision Value
            </span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {`$${(summary.totalDecisionValue || 0).toLocaleString()}`}
          </p>
          <span className="text-xs text-gray-500">
            Outcomes & Revenue Impact
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Net Value
            </span>
            {(summary.netValue || 0) >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-500" />
            )}
          </div>
          <p
            className={`text-2xl font-bold ${
              (summary.netValue || 0) >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {`${(summary.netValue || 0) >= 0 ? "+" : ""}$${(summary.netValue || 0).toLocaleString()}`}
          </p>
          <span className="text-xs text-gray-500">Value minus Total Cost</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Average ROI
            </span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {summary.averageROI || 0}%
          </p>
          <span className="text-xs text-gray-500">
            Industry Benchmark: {benchmarks.industryAverageROI || 145}%
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Positive ROI
            </span>
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.positiveROIPercentage || 0}%
          </p>
          <span className="text-xs text-gray-500">
            {summary.positiveROICount || 0} of {summary.totalMeetings || 0}{" "}
            Meetings
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quality Score
            </span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {summary.averageQualityScore || 0} / 5.0
          </p>
          <span className="text-xs text-gray-500">Adherence & Engagement</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-6 overflow-x-auto" aria-label="Tabs">
          {[
            { id: "overview", label: "Overview & Analytics", icon: BarChart3 },
            { id: "performers", label: "Top & Lowest ROI", icon: Target },
            { id: "benchmarks", label: "Industry Benchmarks", icon: Award },
            { id: "simulator", label: "What-If Simulator", icon: Sliders },
            {
              id: "recommendations",
              label: "Smart Recommendations",
              icon: Sparkles,
            },
            { id: "records", label: "ROI Records Directory", icon: ListFilter },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 whitespace-nowrap transition-colors ${
                  active
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: Overview & Analytics */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Monthly Trends & Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Trend Visualizer */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                Monthly Financial ROI Trends
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Comparison of aggregated monthly meeting costs vs. value
                yielded.
              </p>

              {monthlyTrends.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                  No monthly trend data available yet. Create meeting ROI
                  records to generate trends.
                </div>
              ) : (
                <div className="space-y-4">
                  {monthlyTrends.map((m) => {
                    const maxVal = Math.max(
                      ...monthlyTrends.map((t) =>
                        Math.max(t.totalCost, t.decisionValue),
                      ),
                      1,
                    );
                    const costWidth = Math.min(
                      100,
                      Math.max(4, (m.totalCost / maxVal) * 100),
                    );
                    const valWidth = Math.min(
                      100,
                      Math.max(4, (m.decisionValue / maxVal) * 100),
                    );

                    return (
                      <div
                        key={m.monthKey}
                        className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                      >
                        <div className="flex justify-between items-center text-sm font-medium mb-1">
                          <span>{m.label}</span>
                          <span
                            className={
                              m.avgROI >= 0
                                ? "text-emerald-600 font-bold"
                                : "text-red-500 font-bold"
                            }
                          >
                            ROI: {m.avgROI}%
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-16 text-gray-500">Cost:</span>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                              <div
                                className="bg-red-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${costWidth}%` }}
                              />
                            </div>
                            <span className="w-20 text-right font-medium">
                              ${m.totalCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-16 text-gray-500">Value:</span>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${valWidth}%` }}
                              />
                            </div>
                            <span className="w-20 text-right font-medium text-emerald-600 dark:text-emerald-400">
                              ${m.decisionValue.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cost Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-500" />
                Cost Structure Breakdown
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Allocation between labor and direct expenditure.
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between items-center text-sm font-medium mb-1">
                    <span>Labor (Salaries & Time)</span>
                    <span className="font-bold">
                      {costBreakdown.laborPercentage || 100}%
                    </span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    ${(costBreakdown.laborCost || 0).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Direct Cost Items
                  </span>
                  {[
                    {
                      label: "Venue / Room",
                      val: costBreakdown.directCosts?.venue || 0,
                    },
                    {
                      label: "Software & Licenses",
                      val: costBreakdown.directCosts?.softwareLicenses || 0,
                    },
                    {
                      label: "Refreshments & Catering",
                      val: costBreakdown.directCosts?.refreshments || 0,
                    },
                    {
                      label: "External Consultants",
                      val: costBreakdown.directCosts?.externalConsultants || 0,
                    },
                    {
                      label: "Materials & Tech",
                      val:
                        costBreakdown.directCosts?.materialsAndEquipment || 0,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <span className="text-gray-600 dark:text-gray-300">
                        {item.label}
                      </span>
                      <span className="font-medium">
                        ${item.val.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ROI by Meeting Type & Quality Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ROI by Meeting Type */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h2 className="text-lg font-semibold mb-1">
                ROI Performance by Meeting Type
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Analyze which session categories deliver the highest outcome
                density.
              </p>

              {roiByType.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  No meeting type breakdown available.
                </p>
              ) : (
                <div className="space-y-3">
                  {roiByType.map((item) => (
                    <div
                      key={item.type}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-100 dark:border-gray-800"
                    >
                      <div>
                        <div className="font-semibold text-sm capitalize">
                          {item.type.replace("_", " ")}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.meetingCount} meeting(s) · Cost: $
                          {item.totalCost.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-sm font-bold ${
                            item.avgROI >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-500"
                          }`}
                        >
                          {item.avgROI >= 0 ? "+" : ""}
                          {item.avgROI}%
                        </div>
                        <div className="text-xs text-gray-500">
                          Quality: {item.avgQuality}/5
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meeting Quality Metrics */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h2 className="text-lg font-semibold mb-1">
                Meeting Quality & Health Metrics
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Operational metrics correlating with high ROI returns.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    Goal Achievement
                  </span>
                  <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                    {quality.avgGoalAchievementRate || 85}%
                  </div>
                  <span className="text-xs text-gray-500">
                    Target agenda outcomes met
                  </span>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/40">
                  <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                    Engagement Score
                  </span>
                  <div className="text-2xl font-bold text-indigo-800 dark:text-indigo-200 mt-1">
                    {quality.avgEngagementScore || 80}%
                  </div>
                  <span className="text-xs text-gray-500">
                    Active participation rate
                  </span>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/40">
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Decision Speed
                  </span>
                  <div className="text-2xl font-bold text-amber-800 dark:text-amber-200 mt-1">
                    {quality.avgDecisionSpeedMinutes || 20}m
                  </div>
                  <span className="text-xs text-gray-500">
                    Avg minutes to consensus
                  </span>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/40">
                  <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                    Action Completion
                  </span>
                  <div className="text-2xl font-bold text-purple-800 dark:text-purple-200 mt-1">
                    {quality.completionRate || 0}%
                  </div>
                  <span className="text-xs text-gray-500">
                    {quality.completedActionItems || 0} /{" "}
                    {quality.totalActionItems || 0} action items
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Top & Lowest Performers */}
      {activeTab === "performers" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-semibold">
                Top Performing Meetings (High ROI)
              </h2>
            </div>

            {topPerformers.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No high ROI records available.
              </p>
            ) : (
              <div className="space-y-3">
                {topPerformers.map((item, idx) => (
                  <div
                    key={item._id}
                    className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-sm">
                          #{idx + 1} {item.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(item.date).toLocaleDateString()} ·{" "}
                          {item.attendeeCount} attendees ·{" "}
                          {item.durationMinutes}m
                        </div>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 rounded-full">
                        +{item.roiPercentage}% ROI
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900/30 text-xs">
                      <div>
                        <span className="text-gray-500">Cost:</span>{" "}
                        <span className="font-medium">
                          ${(item.totalMeetingCost || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Value:</span>{" "}
                        <span className="font-medium text-emerald-600">
                          ${(item.decisionValue || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Net:</span>{" "}
                        <span className="font-medium text-emerald-600">
                          +${(item.netValue || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lowest / Negative ROI Meetings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold">
                Lowest & Negative ROI Meetings (Optimization Targets)
              </h2>
            </div>

            {lowestPerformers.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No underperforming meetings detected.
              </p>
            ) : (
              <div className="space-y-3">
                {lowestPerformers.map((item) => (
                  <div
                    key={item._id}
                    className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-sm">
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(item.date).toLocaleDateString()} ·{" "}
                          {item.attendeeCount} attendees ·{" "}
                          {item.durationMinutes}m
                        </div>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300 rounded-full">
                        {item.roiPercentage}% ROI
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-red-100 dark:border-red-900/30 text-xs">
                      <div>
                        <span className="text-gray-500">Cost:</span>{" "}
                        <span className="font-medium">
                          ${(item.totalMeetingCost || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Value:</span>{" "}
                        <span className="font-medium">
                          ${(item.decisionValue || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Net:</span>{" "}
                        <span className="font-medium text-red-600">
                          ${(item.netValue || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Industry Benchmarks */}
      {activeTab === "benchmarks" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">
              Industry Benchmark Comparisons
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Compare your organization's meeting ROI metrics against tech and
              knowledge-worker industry averages.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="text-xs font-medium text-gray-500 uppercase">
                  Meeting ROI %
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-emerald-600">
                    {summary.averageROI || 0}%
                  </span>
                  <span className="text-xs text-gray-500">
                    Ind. Avg: {benchmarks.industryAverageROI || 145}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((summary.averageROI || 0) /
                          (benchmarks.industryAverageROI || 145)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="text-xs font-medium text-gray-500 uppercase">
                  Cost / Attendee-Hour
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    $
                    {summary.totalMeetings > 0
                      ? Math.round(
                          (summary.totalCost / summary.totalMeetings / 4) * 10,
                        ) / 10
                      : 65}
                  </span>
                  <span className="text-xs text-gray-500">
                    Ind. Avg: ${benchmarks.industryAvgCostPerAttendeeHour || 68}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{ width: "85%" }}
                  />
                </div>
              </div>

              <div className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="text-xs font-medium text-gray-500 uppercase">
                  Decision Realization
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-emerald-600">
                    {quality.avgGoalAchievementRate || 85}%
                  </span>
                  <span className="text-xs text-gray-500">
                    Ind. Avg: {benchmarks.industryDecisionRealizationRate || 74}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-teal-500 h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((quality.avgGoalAchievementRate || 85) / 100) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="text-xs font-medium text-gray-500 uppercase">
                  Meeting Quality Index
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-amber-500">
                    {summary.averageQualityScore || 4.0} / 5.0
                  </span>
                  <span className="text-xs text-gray-500">
                    Ind. Avg: {benchmarks.industryQualityScore || 4.1}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{
                      width: `${((summary.averageQualityScore || 4.0) / 5) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: What-If Simulator */}
      {activeTab === "simulator" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sliders className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-semibold">
              What-If Meeting ROI Simulator
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Test and model schedule adjustments to visualize projected cost
            reductions and net ROI multipliers.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Controls */}
            <div className="space-y-5 bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border border-gray-100 dark:border-gray-800">
              <div>
                <label className="flex justify-between text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  <span>Attendee Count</span>
                  <span className="text-emerald-600 font-bold">
                    {simParams.attendeeCount} people
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={simParams.attendeeCount}
                  onChange={(e) =>
                    setSimParams((p) => ({
                      ...p,
                      attendeeCount: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  <span>Duration (Minutes)</span>
                  <span className="text-emerald-600 font-bold">
                    {simParams.durationMinutes} mins
                  </span>
                </label>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="15"
                  value={simParams.durationMinutes}
                  onChange={(e) =>
                    setSimParams((p) => ({
                      ...p,
                      durationMinutes: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  <span>Avg Hourly Rate ($/hr)</span>
                  <span className="text-emerald-600 font-bold">
                    ${simParams.avgHourlyRate}
                  </span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="5"
                  value={simParams.avgHourlyRate}
                  onChange={(e) =>
                    setSimParams((p) => ({
                      ...p,
                      avgHourlyRate: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  <span>Estimated Decision / Output Value ($)</span>
                  <span className="text-emerald-600 font-bold">
                    ${simParams.estimatedDecisionValue}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={simParams.estimatedDecisionValue}
                  onChange={(e) =>
                    setSimParams((p) => ({
                      ...p,
                      estimatedDecisionValue: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  <span>Frequency Per Month</span>
                  <span className="text-emerald-600 font-bold">
                    {simParams.frequencyPerMonth}x / mo
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={simParams.frequencyPerMonth}
                  onChange={(e) =>
                    setSimParams((p) => ({
                      ...p,
                      frequencyPerMonth: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            {/* Projection Results */}
            {simResult && (
              <div className="flex flex-col justify-between p-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                <div>
                  <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200 mb-4">
                    Projected Financial Impact
                  </h3>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xs">
                      <span className="text-xs text-gray-500 font-medium">
                        Cost / Session
                      </span>
                      <div className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
                        $
                        {(
                          simResult.singleMeeting?.totalCost || 0
                        ).toLocaleString()}
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xs">
                      <span className="text-xs text-gray-500 font-medium">
                        Projected Monthly Cost
                      </span>
                      <div className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
                        $
                        {(
                          simResult.monthlyProjection?.projectedCost || 0
                        ).toLocaleString()}
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xs">
                      <span className="text-xs text-gray-500 font-medium">
                        Monthly Decision Value
                      </span>
                      <div className="text-xl font-bold mt-1 text-emerald-600">
                        $
                        {(
                          simResult.monthlyProjection?.projectedDecisionValue ||
                          0
                        ).toLocaleString()}
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xs">
                      <span className="text-xs text-gray-500 font-medium">
                        Projected Monthly ROI
                      </span>
                      <div className="text-xl font-bold mt-1 text-emerald-600">
                        {simResult.monthlyProjection?.projectedROI || 0}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-emerald-100/80 dark:bg-emerald-900/40 rounded-lg text-emerald-950 dark:text-emerald-200 text-xs">
                  <strong>Optimization Impact:</strong> Compared to standard
                  60-min / 6-attendee sessions, this configuration saves an
                  estimated{" "}
                  <strong>
                    $
                    {(
                      simResult.monthlyProjection?.costSavingsVsBaseline || 0
                    ).toLocaleString()}
                    /month
                  </strong>{" "}
                  while maintaining decision throughput.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Smart ROI Recommendations */}
      {activeTab === "recommendations" && (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row justify-between items-start gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-gray-900 dark:text-white">
                    {rec.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                    {rec.description}
                  </p>
                </div>
              </div>

              {rec.potentialSavings && rec.potentialSavings !== "$0" && (
                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 text-right whitespace-nowrap">
                  <span className="text-xs uppercase font-medium block">
                    Potential Savings
                  </span>
                  <span className="text-lg font-bold">
                    {rec.potentialSavings}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 6: ROI Records Directory (CRUD & Filters) */}
      {activeTab === "records" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {/* Controls Bar */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search meeting titles..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 pr-4 py-2 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setPage(1);
                }}
                className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchRecords}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="py-3.5 px-4">Title & Type</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Duration & Size</th>
                  <th className="py-3.5 px-4">Total Cost</th>
                  <th className="py-3.5 px-4">Decision Value</th>
                  <th className="py-3.5 px-4">ROI %</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {records.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="text-center py-10 text-gray-500 text-sm"
                    >
                      No ROI records found. Click "Add ROI Record" to log one.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr
                      key={r._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {r.title}
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md capitalize">
                          {r.meetingType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {r.durationMinutes}m · {r.attendeeCount} attendees
                      </td>
                      <td className="py-3.5 px-4 font-medium text-xs whitespace-nowrap">
                        ${(r.totalMeetingCost || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${(r.decisionValue || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            (r.roiPercentage || 0) >= 0
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300"
                          }`}
                        >
                          {(r.roiPercentage || 0) >= 0 ? "+" : ""}
                          {r.roiPercentage || 0}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenModal(r)}
                            className="p-1 text-gray-500 hover:text-emerald-600 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(r._id)}
                            className="p-1 text-gray-500 hover:text-red-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Create / Edit Record */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4">
              {editingRecord
                ? "Edit Meeting ROI Record"
                : "Add Meeting ROI Record"}
            </h2>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g., Executive Strategy Alignment"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                    Meeting Type
                  </label>
                  <select
                    value={formData.meetingType}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        meetingType: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm"
                  >
                    {MEETING_TYPES.filter((t) => t.value !== "all").map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, date: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm"
                  />
                </div>
              </div>

              {/* Labor Calculation Inputs */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.durationMinutes}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        durationMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-1.5 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Attendees
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.attendeeCount}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        attendeeCount: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-1.5 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Avg Hourly Rate ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.avgHourlyRate}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        avgHourlyRate: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-1.5 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm"
                  />
                </div>
              </div>

              {/* Direct Expenses */}
              <div>
                <span className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-300 mb-2">
                  Direct Expenses ($)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="number"
                    placeholder="Venue ($)"
                    value={formData.directCosts?.venue || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        directCosts: {
                          ...p.directCosts,
                          venue: Number(e.target.value),
                        },
                      }))
                    }
                    className="px-3 py-1.5 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Refreshments ($)"
                    value={formData.directCosts?.refreshments || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        directCosts: {
                          ...p.directCosts,
                          refreshments: Number(e.target.value),
                        },
                      }))
                    }
                    className="px-3 py-1.5 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Software / Tools ($)"
                    value={formData.directCosts?.softwareLicenses || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        directCosts: {
                          ...p.directCosts,
                          softwareLicenses: Number(e.target.value),
                        },
                      }))
                    }
                    className="px-3 py-1.5 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-xs"
                  />
                </div>
              </div>

              {/* Decision & Outcome Value */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">
                    Decision Value & Outcomes ($)
                  </span>
                  <button
                    type="button"
                    onClick={addDecisionItem}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.decisionDetails.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Outcome / Decision Title"
                        value={item.title}
                        onChange={(e) =>
                          updateDecisionItem(idx, "title", e.target.value)
                        }
                        className="flex-1 px-3 py-1.5 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-xs"
                      />
                      <select
                        value={item.category}
                        onChange={(e) =>
                          updateDecisionItem(idx, "category", e.target.value)
                        }
                        className="px-2 py-1.5 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-xs"
                      >
                        <option value="revenue">Revenue</option>
                        <option value="cost_savings">Cost Savings</option>
                        <option value="efficiency">Efficiency</option>
                        <option value="risk_mitigation">Risk Mitigation</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Est. Value ($)"
                        value={item.estimatedValue || ""}
                        onChange={(e) =>
                          updateDecisionItem(
                            idx,
                            "estimatedValue",
                            Number(e.target.value),
                          )
                        }
                        className="w-24 px-2 py-1.5 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-xs"
                      />
                      {formData.decisionDetails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDecisionItem(idx)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {modalSubmitting ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingROIDashboard;
