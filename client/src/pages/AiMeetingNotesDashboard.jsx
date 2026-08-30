import React, { useState, useEffect, useContext, useCallback } from "react";
import AppContent from "../context/AppContent";
import { aiMeetingNoteApi } from "../services/aiMeetingNoteApi";
import OrganizationEmptyState from "../components/organization/OrganizationEmptyState";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  Search,
  Download,
  Copy,
  History,
  RotateCcw,
  CheckSquare,
  Square,
  Layers,
  ChevronRight,
  TrendingUp,
  BarChart2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-toastify";

const MEETING_TYPES = [
  { value: "all", label: "All Types" },
  { value: "general", label: "General" },
  { value: "executive", label: "Executive" },
  { value: "product", label: "Product" },
  { value: "engineering", label: "Engineering" },
  { value: "1-on-1", label: "1-on-1" },
  { value: "retrospective", label: "Retrospective" },
  { value: "sales", label: "Sales" },
  { value: "workshop", label: "Workshop" },
];

const REVIEW_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In Review" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
];

const AiMeetingNotesDashboard = () => {
  const { userData, loading: authLoading } = useContext(AppContent) || {};
  const organizationId =
    userData?.organization?._id || userData?.organization || null;

  // Active Tab
  const [activeTab, setActiveTab] = useState("workspace"); // 'workspace' | 'generator' | 'actions' | 'templates' | 'analytics'

  // Summary Analytics State
  const [analytics, setAnalytics] = useState(null);

  // Notes List State
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [page] = useState(1);

  // Templates State
  const [templates, setTemplates] = useState([]);

  // Cross-Meeting Action Items
  const [crossActions, setCrossActions] = useState([]);
  const [actionFilter, setActionFilter] = useState("all"); // 'all' | 'pending' | 'completed'
  const [actionPriority, setActionPriority] = useState("all");

  // Generator State
  const [genTitle, setGenTitle] = useState("");
  const [genMeetingType, setGenMeetingType] = useState("general");
  const [genTemplate, setGenTemplate] = useState("general");
  const [genRawContent, setGenRawContent] = useState("");
  const [generating, setGenerating] = useState(false);

  // Review Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    status: "approved",
    feedback: "",
  });

  // Version History Drawer
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await aiMeetingNoteApi.getAnalytics(organizationId);
      if (res?.success) setAnalytics(res.data);
    } catch (err) {
      console.error("Failed to load notes analytics:", err);
    }
  }, [organizationId]);

  // Fetch Notes
  const fetchNotes = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await aiMeetingNoteApi.getNotes({
        organizationId,
        search: searchTerm,
        meetingType: selectedType,
        reviewStatus: selectedStatus,
        page,
        limit: 20,
      });
      if (res?.success) {
        setNotes(res.data?.notes || []);
        if (
          !selectedNote &&
          res.data?.notes?.length > 0 &&
          activeTab === "workspace"
        ) {
          setSelectedNote(res.data.notes[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
    }
  }, [
    organizationId,
    searchTerm,
    selectedType,
    selectedStatus,
    page,
    selectedNote,
    activeTab,
  ]);

  // Fetch Templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await aiMeetingNoteApi.getTemplates();
      if (res?.success) setTemplates(res.data || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }, []);

  // Fetch Cross-Meeting Actions
  const fetchCrossActions = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await aiMeetingNoteApi.getCrossMeetingActionItems({
        organizationId,
        status: actionFilter,
        priority: actionPriority,
      });
      if (res?.success) {
        setCrossActions(res.data?.actionItems || []);
      }
    } catch (err) {
      console.error("Failed to load cross-meeting action items:", err);
    }
  }, [organizationId, actionFilter, actionPriority]);

  useEffect(() => {
    if (organizationId) {
      fetchAnalytics();
      fetchNotes();
      fetchTemplates();
      fetchCrossActions();
    }
  }, [
    organizationId,
    fetchAnalytics,
    fetchNotes,
    fetchTemplates,
    fetchCrossActions,
  ]);

  // Handle Note Generation
  const handleGenerateNote = async (e) => {
    e.preventDefault();
    if (!genTitle.trim()) {
      toast.warning("Please provide a note title");
      return;
    }

    try {
      setGenerating(true);
      const res = await aiMeetingNoteApi.generateAiNote({
        organization: organizationId,
        title: genTitle.trim(),
        meetingType: genMeetingType,
        templateUsed: genTemplate,
        rawContent: genRawContent,
      });

      if (res?.success) {
        toast.success("AI Meeting Note generated successfully!");
        setGenTitle("");
        setGenRawContent("");
        fetchNotes();
        fetchAnalytics();
        fetchCrossActions();
        setSelectedNote(res.data);
        setActiveTab("workspace");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate AI note");
    } finally {
      setGenerating(false);
    }
  };

  // Toggle Action Item Status
  const handleToggleAction = async (noteId, actionId, currentStatus) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      const res = await aiMeetingNoteApi.toggleActionItemStatus(
        noteId,
        actionId,
        nextStatus,
      );
      if (res?.success) {
        toast.success(
          `Action marked ${nextStatus === "completed" ? "complete" : "pending"}`,
        );

        // Update local selected note state
        if (selectedNote && selectedNote._id === noteId) {
          const updatedActions = (selectedNote.actionItems || []).map((a) =>
            a.id === actionId || a._id === actionId
              ? {
                  ...a,
                  status: nextStatus,
                  completedAt: nextStatus === "completed" ? new Date() : null,
                }
              : a,
          );
          setSelectedNote({ ...selectedNote, actionItems: updatedActions });
        }

        // Update cross-meeting list
        setCrossActions((prev) =>
          prev.map((a) =>
            (a.id === actionId || a._id === actionId) && a.noteId === noteId
              ? {
                  ...a,
                  status: nextStatus,
                  completedAt: nextStatus === "completed" ? new Date() : null,
                }
              : a,
          ),
        );

        fetchAnalytics();
      }
    } catch (err) {
      console.error("Action status error:", err);
      toast.error("Failed to update action item status");
    }
  };

  // Handle Review Submission
  const handleReviewSubmit = async () => {
    if (!selectedNote) return;
    try {
      const res = await aiMeetingNoteApi.reviewNote(selectedNote._id, {
        reviewStatus: reviewForm.status,
        reviewFeedback: reviewForm.feedback,
      });
      if (res?.success) {
        toast.success(`Note marked as ${reviewForm.status}`);
        setSelectedNote(res.data);
        setReviewModalOpen(false);
        fetchNotes();
        fetchAnalytics();
      }
    } catch (err) {
      console.error("Review note error:", err);
      toast.error("Failed to update review status");
    }
  };

  // Restore Note Version
  const handleRestoreVersion = async (version) => {
    if (!selectedNote) return;
    try {
      const res = await aiMeetingNoteApi.restoreVersion(
        selectedNote._id,
        version,
      );
      if (res?.success) {
        toast.success(`Restored to version ${version}`);
        setSelectedNote(res.data);
        setVersionDrawerOpen(false);
        fetchNotes();
      }
    } catch (err) {
      console.error("Restore version error:", err);
      toast.error("Failed to restore version");
    }
  };

  // Export as Markdown
  const handleExportMarkdown = () => {
    if (!selectedNote) return;
    const mdContent = `# ${selectedNote.title}
Date: ${new Date(selectedNote.date).toLocaleDateString()}
Type: ${selectedNote.meetingType.toUpperCase()}
Status: ${selectedNote.reviewStatus.toUpperCase()}

${selectedNote.content || selectedNote.summary || "No content"}
`;
    const blob = new Blob([mdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedNote.title.toLowerCase().replace(/\s+/g, "_")}_notes.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.info("Downloaded Markdown note");
  };

  // Export as JSON
  const handleExportJson = () => {
    if (!selectedNote) return;
    const blob = new Blob([JSON.stringify(selectedNote, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedNote.title.toLowerCase().replace(/\s+/g, "_")}_notes.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.info("Downloaded JSON note");
  };

  // Copy Markdown to Clipboard
  const handleCopyMarkdown = () => {
    if (!selectedNote) return;
    navigator.clipboard.writeText(selectedNote.content || selectedNote.summary);
    toast.success("Markdown copied to clipboard!");
  };

  // Open Create Modal with template
  const handleUseTemplate = (template) => {
    setGenTemplate(template.id);
    setGenMeetingType(
      template.id === "executive"
        ? "executive"
        : template.id === "product"
          ? "product"
          : template.id === "one_on_one"
            ? "1-on-1"
            : template.id === "retrospective"
              ? "retrospective"
              : template.id === "sales"
                ? "sales"
                : "general",
    );
    setGenRawContent(
      template.structure.map((s) => `### ${s}\n- `).join("\n\n"),
    );
    setActiveTab("generator");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <OrganizationEmptyState
          title="AI Meeting Notes Dashboard"
          description="Join or create an organization to access AI-powered meeting notes, action tracking, quality scores, and reusable templates."
        />
      </div>
    );
  }

  const reviewStatusColors = {
    draft:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300",
    in_review:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300",
    reviewed:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300",
    approved:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300",
  };

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8"
      data-testid="ai-meeting-notes-dashboard"
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              AI Meeting Notes Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AI synthesis, action extraction, quality metrics, version history,
              and reusable templates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("generator")}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate with AI</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Total Notes
            </span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold">
            {analytics?.totalNotes ?? notes.length}
          </p>
          <span className="text-xs text-gray-500">Documented Sessions</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Quality Score
            </span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {`${analytics?.averageQualityScore || 88}%`}
          </p>
          <span className="text-xs text-gray-500">Clarity & Completeness</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Action Items
            </span>
            <CheckSquare className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">
            {analytics?.totalActionItems ?? crossActions.length}
          </p>
          <span className="text-xs text-gray-500">Extracted Commitments</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Completion
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {`${analytics?.actionCompletionRate || 0}%`}
          </p>
          <span className="text-xs text-gray-500">Done across meetings</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Reviewed
            </span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">
            {(analytics?.reviewStatusDistribution?.approved || 0) +
              (analytics?.reviewStatusDistribution?.reviewed || 0)}
          </p>
          <span className="text-xs text-gray-500">Verified by Leads</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Templates
            </span>
            <Layers className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold">{templates.length || 7}</p>
          <span className="text-xs text-gray-500">Standard Frameworks</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("workspace")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === "workspace"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <FileText className="w-4 h-4" />
          Notes Workspace
        </button>
        <button
          onClick={() => setActiveTab("generator")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === "generator"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI Generator
        </button>
        <button
          onClick={() => setActiveTab("actions")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === "actions"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Cross-Meeting Actions ({crossActions.length})
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === "templates"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Layers className="w-4 h-4" />
          Note Templates
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === "analytics"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Quality & Trends
        </button>
      </div>

      {/* TAB 1: Notes Workspace (Directory & Viewer/Editor) */}
      {activeTab === "workspace" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Notes Sidebar List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
              {/* Search & Filter */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notes, topics, tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  aria-label="Filter by meeting type"
                  className="w-full text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 focus:outline-none"
                >
                  {MEETING_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Filter by review status"
                  className="w-full text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 focus:outline-none"
                >
                  {REVIEW_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note Cards */}
            <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                  <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-medium">No meeting notes found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Try adjusting filters or synthesize a note with AI.
                  </p>
                </div>
              ) : (
                notes.map((note) => {
                  const isSelected = selectedNote?._id === note._id;
                  return (
                    <div
                      key={note._id}
                      onClick={() => setSelectedNote(note)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500/60 shadow-sm"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="text-sm font-semibold truncate">
                          {note.title}
                        </h4>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            reviewStatusColors[note.reviewStatus] ||
                            reviewStatusColors.draft
                          }`}
                        >
                          {note.reviewStatus}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                        {note.summary || note.content || "No summary available"}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>{new Date(note.date).toLocaleDateString()}</span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-amber-500 font-medium">
                            <Sparkles className="w-3 h-3" />
                            {`${note.qualityScore?.overallScore || 85}%`}
                          </span>
                          <span>·</span>
                          <span>{`${(note.actionItems || []).length} actions`}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Note Viewer / Editor Panel */}
          <div className="lg:col-span-8">
            {selectedNote ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-full">
                {/* Note Action Toolbar */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-900/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">
                        {selectedNote.title}
                      </h2>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                          reviewStatusColors[selectedNote.reviewStatus] ||
                          reviewStatusColors.draft
                        }`}
                      >
                        {selectedNote.reviewStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>
                        {new Date(selectedNote.date).toLocaleDateString()}
                      </span>
                      <span>·</span>
                      <span className="capitalize">
                        {selectedNote.meetingType}
                      </span>
                      <span>·</span>
                      <span>{`v${selectedNote.version || 1}`}</span>
                    </div>
                  </div>

                  {/* Toolbar Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReviewModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Review Note
                    </button>
                    <button
                      onClick={() => setVersionDrawerOpen(true)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Version History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopyMarkdown}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Copy Markdown"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleExportMarkdown}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Download Markdown"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleExportJson}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-semibold"
                      title="Download JSON"
                    >
                      JSON
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[700px]">
                  {/* Quality Breakdown Badges */}
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Overall Score</div>
                      <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                        {`${selectedNote.qualityScore?.overallScore || 88}/100`}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Clarity</div>
                      <div className="text-base font-bold text-emerald-600">
                        {`${selectedNote.qualityScore?.clarity || 85}%`}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Completeness</div>
                      <div className="text-base font-bold text-blue-600">
                        {`${selectedNote.qualityScore?.completeness || 90}%`}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Actionability</div>
                      <div className="text-base font-bold text-amber-600">
                        {`${selectedNote.qualityScore?.actionability || 80}%`}
                      </div>
                    </div>
                  </div>

                  {/* Executive Summary Section */}
                  {selectedNote.summary && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        Executive Summary
                      </h3>
                      <p className="text-sm leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                        {selectedNote.summary}
                      </p>
                    </div>
                  )}

                  {/* Extracted Action Items with Live Checkboxes */}
                  {(selectedNote.actionItems || []).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                        Action Items & Commitments (
                        {selectedNote.actionItems.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedNote.actionItems.map((action, idx) => {
                          const isDone = action.status === "completed";
                          return (
                            <div
                              key={action.id || action._id || idx}
                              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                                isDone
                                  ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                              }`}
                            >
                              <button
                                onClick={() =>
                                  handleToggleAction(
                                    selectedNote._id,
                                    action.id || action._id,
                                    action.status,
                                  )
                                }
                                className="mt-0.5 text-gray-400 hover:text-emerald-600 transition-colors"
                              >
                                {isDone ? (
                                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  <Square className="w-5 h-5" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-medium ${
                                    isDone
                                      ? "line-through text-gray-400"
                                      : "text-gray-800 dark:text-gray-200"
                                  }`}
                                >
                                  {action.task}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                                  <span>{`Owner: ${action.owner || "Unassigned"}`}</span>
                                  <span>·</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                      action.priority === "high"
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                    }`}
                                  >
                                    {action.priority || "Medium"}
                                  </span>
                                  {action.dueDate && (
                                    <>
                                      <span>·</span>
                                      <span>{`Due: ${new Date(action.dueDate).toLocaleDateString()}`}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Key Decisions Reached */}
                  {(selectedNote.decisions || []).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                        Decisions Reached ({selectedNote.decisions.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedNote.decisions.map((dec, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
                          >
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {dec.decision}
                            </p>
                            {dec.impact && (
                              <p className="text-xs text-gray-500 mt-1">
                                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                  Impact:
                                </span>{" "}
                                {dec.impact}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Structured Markdown Content */}
                  <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                      Formatted Note Content
                    </h3>
                    <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 whitespace-pre-wrap font-mono">
                      {selectedNote.content}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700 h-full flex flex-col items-center justify-center">
                <FileText className="w-12 h-12 text-gray-400 mb-3 opacity-60" />
                <h3 className="text-base font-semibold">
                  Select a Note to Inspect
                </h3>
                <p className="text-sm text-gray-500 max-w-sm mt-1">
                  Choose a meeting note from the left sidebar or create one
                  using the AI generator.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AI Note Generator */}
      {activeTab === "generator" && (
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              AI Meeting Note Synthesis
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Provide raw discussion notes, meeting minutes, or bullet points to
              instantly generate structured executive notes, decision lists, and
              action item trackers.
            </p>
          </div>

          <form onSubmit={handleGenerateNote} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Meeting Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Q3 Product Roadmap Alignment"
                value={genTitle}
                onChange={(e) => setGenTitle(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Meeting Type
                </label>
                <select
                  value={genMeetingType}
                  onChange={(e) => setGenMeetingType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {MEETING_TYPES.filter((t) => t.value !== "all").map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  Template Framework
                </label>
                <select
                  value={genTemplate}
                  onChange={(e) => setGenTemplate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Raw Meeting Discussion / Transcript Excerpt
              </label>
              <textarea
                rows={8}
                placeholder="Paste unformatted meeting notes, discussion points, or transcript snippets here..."
                value={genRawContent}
                onChange={(e) => setGenRawContent(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-xs"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={generating}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Notes...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Structured Notes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: Cross-Meeting Action Items Tracker */}
      {activeTab === "actions" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-600" />
                Cross-Meeting Action Items Directory
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Centralized management for tasks extracted across all meeting
                notes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label="Filter actions by status"
                className="text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Only</option>
                <option value="completed">Completed Only</option>
              </select>

              <select
                value={actionPriority}
                onChange={(e) => setActionPriority(e.target.value)}
                aria-label="Filter actions by priority"
                className="text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            {crossActions.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No action items found</p>
              </div>
            ) : (
              crossActions.map((action, idx) => {
                const isDone = action.status === "completed";
                return (
                  <div
                    key={action.id || action._id || idx}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                      isDone
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <button
                      onClick={() =>
                        handleToggleAction(
                          action.noteId,
                          action.id || action._id,
                          action.status,
                        )
                      }
                      className="mt-0.5 text-gray-400 hover:text-emerald-600 transition-colors"
                    >
                      {isDone ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          isDone
                            ? "line-through text-gray-400"
                            : "text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {action.task}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1.5">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {action.noteTitle}
                        </span>
                        <span>·</span>
                        <span>{`Owner: ${action.owner || "Unassigned"}`}</span>
                        <span>·</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                            action.priority === "high"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          }`}
                        >
                          {action.priority || "Medium"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Reusable Note Templates */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Reusable Note Templates</h2>
              <p className="text-xs text-gray-500">
                Standardized frameworks to structure discussion notes and action
                extraction.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                      {tpl.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold mb-1">{tpl.name}</h3>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    {tpl.description}
                  </p>

                  <div className="space-y-1 mb-4">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">
                      Included Sections:
                    </span>
                    <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
                      {tpl.structure.map((s, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3 text-indigo-500" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => handleUseTemplate(tpl)}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Use This Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Analytics & Trends */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Trend Bars */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Monthly Notes Volume
              </h3>
              {(analytics?.monthlyTrends || []).length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">
                  No monthly trend data recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {analytics.monthlyTrends.map((m) => (
                    <div key={m.monthKey} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>{m.label}</span>
                        <span>{`${m.count} notes (${m.actionCount} actions)`}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, m.count * 20)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Score Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Quality Dimension Breakdown
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Clarity</span>
                    <span className="font-bold">
                      {`${analytics?.qualityBreakdown?.clarity || 88}%`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{
                        width: `${analytics?.qualityBreakdown?.clarity || 88}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Completeness</span>
                    <span className="font-bold">
                      {`${analytics?.qualityBreakdown?.completeness || 90}%`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${analytics?.qualityBreakdown?.completeness || 90}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Actionability</span>
                    <span className="font-bold">
                      {`${analytics?.qualityBreakdown?.actionability || 82}%`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{
                        width: `${analytics?.qualityBreakdown?.actionability || 82}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Decision Clarity</span>
                    <span className="font-bold">
                      {`${analytics?.qualityBreakdown?.decisionClarity || 86}%`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{
                        width: `${analytics?.qualityBreakdown?.decisionClarity || 86}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">Review Note Status</h3>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                New Review Status
              </label>
              <select
                value={reviewForm.status}
                onChange={(e) =>
                  setReviewForm({ ...reviewForm, status: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              >
                <option value="in_review">In Review</option>
                <option value="reviewed">Reviewed</option>
                <option value="approved">Approved</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Feedback & Notes (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Add feedback for attendees and contributors..."
                value={reviewForm.feedback}
                onChange={(e) =>
                  setReviewForm({ ...reviewForm, feedback: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReviewSubmit}
                className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Save Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Drawer */}
      {versionDrawerOpen && selectedNote && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md h-full p-6 border-l border-gray-200 dark:border-gray-700 shadow-2xl overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                Version History
              </h3>
              <button
                onClick={() => setVersionDrawerOpen(false)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {(selectedNote.versionHistory || []).map((ver) => (
                <div
                  key={ver.version}
                  className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 text-xs space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{`Version ${ver.version}`}</span>
                    <span className="text-gray-400">
                      {new Date(ver.editedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-500">{ver.changeSummary}</p>
                  <button
                    onClick={() => handleRestoreVersion(ver.version)}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-semibold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore this version
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiMeetingNotesDashboard;
