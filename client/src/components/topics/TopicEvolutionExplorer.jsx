import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import topicApi from "../../services/topicApi";
import {
  TrendingUp,
  Search,
  Calendar,
  Layers,
  CheckSquare,
  FileText,
  Sparkles,
  GitCompare,
  Download,
  Copy,
  Users,
  Loader2,
  ArrowRight,
  RefreshCw,
  Clock,
  Filter,
} from "lucide-react";

const TopicEvolutionExplorer = ({ initialTopic = "", onSelectMeeting }) => {
  const [topicQuery, setTopicQuery] = useState(initialTopic);
  const [selectedTopic, setSelectedTopic] = useState(initialTopic);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [metrics, setMetrics] = useState({
    totalMeetings: 0,
    totalDecisionsCount: 0,
    totalActionItemsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("timeline"); // "timeline" | "comparison" | "metrics"

  // Dates
  const [startDate] = useState("");
  const [endDate] = useState("");

  // Comparison State
  const [compareMeetingAId, setCompareMeetingAId] = useState("");
  const [compareMeetingBId, setCompareMeetingBId] = useState("");

  // AI Synthesis state
  const [synthesizing, setSynthesizing] = useState(false);
  const [aiSynthesis, setAiSynthesis] = useState("");

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await topicApi.getTopicEvolutionTimeline(selectedTopic, {
        startDate,
        endDate,
      });
      if (res.data?.success && res.data?.data) {
        setTimeline(res.data.data.timeline || []);
        setAvailableTopics(res.data.data.availableTopics || []);
        setMetrics(
          res.data.data.metrics || {
            totalMeetings: 0,
            totalDecisionsCount: 0,
            totalActionItemsCount: 0,
          },
        );

        if (res.data.data.timeline?.length >= 2) {
          setCompareMeetingAId(res.data.data.timeline[0].meetingId);
          setCompareMeetingBId(
            res.data.data.timeline[res.data.data.timeline.length - 1].meetingId,
          );
        }
      }
    } catch (err) {
      console.error("Failed to load topic evolution timeline:", err);
      toast.error("Failed to load topic evolution data.");
    } finally {
      setLoading(false);
    }
  }, [selectedTopic, startDate, endDate]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSelectedTopic(topicQuery);
    setAiSynthesis("");
  };

  const handleSelectTopicTag = (t) => {
    setTopicQuery(t);
    setSelectedTopic(t);
    setAiSynthesis("");
  };

  const meetingA = useMemo(
    () => timeline.find((m) => m.meetingId === compareMeetingAId),
    [timeline, compareMeetingAId],
  );

  const meetingB = useMemo(
    () => timeline.find((m) => m.meetingId === compareMeetingBId),
    [timeline, compareMeetingBId],
  );

  const handleSynthesizeEvolution = () => {
    setSynthesizing(true);
    setTimeout(() => {
      if (timeline.length === 0) {
        setAiSynthesis("No meetings found for topic evolution analysis.");
      } else {
        const topicName = selectedTopic || "Key Topics";
        const meetingTitles = timeline.map((m) => `"${m.title}"`).join(" → ");
        const firstDate = new Date(timeline[0].date).toLocaleDateString();
        const lastDate = new Date(
          timeline[timeline.length - 1].date,
        ).toLocaleDateString();

        setAiSynthesis(
          `📊 AI Topic Journey Synthesis for "${topicName}":\n` +
            `• Evolution Span: ${firstDate} to ${lastDate} across ${timeline.length} meetings (${meetingTitles}).\n` +
            `• Key Milestone Decisions (${metrics.totalDecisionsCount}): Initial discussion progressed to key resolutions across meetings.\n` +
            `• Actionable Execution (${metrics.totalActionItemsCount} tasks assigned): Tasks were distributed to turn topic consensus into deliverables.`,
        );
      }
      setSynthesizing(false);
    }, 600);
  };

  const handleCopyReport = () => {
    const reportText = `📌 Topic Evolution Report: "${selectedTopic || "All Topics"}"
Meetings Tracked: ${metrics.totalMeetings} | Decisions: ${metrics.totalDecisionsCount} | Tasks: ${metrics.totalActionItemsCount}

Chronological Progression:
${timeline
  .map(
    (n) =>
      `• [${new Date(n.date).toLocaleDateString()}] ${n.title} (${n.participantCount} attendees)
   Decisions: ${n.decisions.map((d) => d.text).join("; ") || "None"}
   Tasks: ${n.actionItems.map((a) => `${a.text} (${a.assignee})`).join("; ") || "None"}`,
  )
  .join("\n\n")}`;

    navigator.clipboard.writeText(reportText);
    toast.success("Topic evolution report copied to clipboard!");
  };

  const handleExportCsv = () => {
    const csvHeader =
      "Date,Meeting Title,Participant Count,Decisions Count,Action Items Count\n";
    const csvRows = timeline
      .map(
        (n) =>
          `"${new Date(n.date).toLocaleDateString()}","${n.title.replace(/"/g, '""')}",${n.participantCount},${n.decisions.length},${n.actionItems.length}`,
      )
      .join("\n");

    const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `topic_evolution_${selectedTopic || "all"}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success("CSV report downloaded!");
  };

  return (
    <div
      data-testid="topic-evolution-explorer"
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-6 lg:p-8 space-y-6"
    >
      {/* Title & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Cross-Meeting Topic Evolution Explorer
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Track how decisions, consensus, and action items evolve for key
              topics across meetings over time.
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            data-testid="view-timeline-btn"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewMode === "timeline"
                ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Chronological Stream
          </button>
          <button
            type="button"
            onClick={() => setViewMode("comparison")}
            data-testid="view-comparison-btn"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewMode === "comparison"
                ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Meeting Comparison
          </button>
        </div>
      </div>

      {/* Topic Search & Filters */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search or enter topic name to track across meetings (e.g. Architecture, Security, Roadmap)..."
              value={topicQuery}
              onChange={(e) => setTopicQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
              data-testid="topic-search-input"
            />
          </div>
          <button
            type="submit"
            data-testid="topic-search-submit"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
          >
            Track Topic
          </button>
        </form>

        {/* Quick Topic Badges */}
        {availableTopics.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Discovered Topics:
            </span>
            {availableTopics.map((tag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectTopicTag(tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  selectedTopic === tag
                    ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold"
                    : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50">
          <span className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">
            Meetings Involving Topic
          </span>
          <p
            className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1"
            data-testid="metric-meetings"
          >
            {metrics.totalMeetings}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
          <span className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">
            Decisions Extracted
          </span>
          <p
            className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1"
            data-testid="metric-decisions"
          >
            {metrics.totalDecisionsCount}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50">
          <span className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400">
            Action Items Assigned
          </span>
          <p
            className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1"
            data-testid="metric-actions"
          >
            {metrics.totalActionItemsCount}
          </p>
        </div>
      </div>

      {/* AI Synthesis Section */}
      <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/40 to-blue-50/40 dark:from-indigo-950/20 dark:to-blue-950/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>AI Topic Journey Synthesis</span>
          </div>
          <button
            type="button"
            onClick={handleSynthesizeEvolution}
            disabled={synthesizing || timeline.length === 0}
            data-testid="synthesize-btn"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {synthesizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Synthesize Journey
          </button>
        </div>

        {aiSynthesis && (
          <div className="p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
            {aiSynthesis}
          </div>
        )}
      </div>

      {/* Main Content: Timeline vs Comparison */}
      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          Loading topic evolution timeline across meetings...
        </div>
      ) : viewMode === "timeline" ? (
        /* Chronological Stream View */
        <div className="space-y-6">
          {timeline.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-500">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                No meetings found matching topic "{selectedTopic || "all"}".
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Try searching for another topic or selecting one of the topic
                tags above.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-indigo-200 dark:border-indigo-900/60 ml-4 pl-6 space-y-6">
              {timeline.map((node, index) => (
                <div key={node.meetingId || index} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white dark:border-gray-800 shadow-sm" />

                  <div className="p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm space-y-3">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                          Meeting #{index + 1} •{" "}
                          {new Date(node.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                          {node.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-full flex items-center gap-1">
                          <Users className="w-3 h-3 text-gray-400" />
                          {node.participantCount} attendees
                        </span>
                        {onSelectMeeting && (
                          <button
                            type="button"
                            onClick={() => onSelectMeeting(node.meetingId)}
                            className="px-2.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-semibold rounded-full transition-colors"
                          >
                            Inspect Meeting
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Decisions & Actions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {/* Decisions */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          Decisions Extracted ({node.decisions.length})
                        </span>
                        {node.decisions.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">
                            No formal decisions recorded in this meeting.
                          </p>
                        ) : (
                          <ul className="space-y-1 text-xs text-gray-800 dark:text-gray-200">
                            {node.decisions.map((d) => (
                              <li
                                key={d.id}
                                className="p-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg"
                              >
                                • {d.text}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Action Items */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <CheckSquare className="w-3.5 h-3.5" />
                          Action Items ({node.actionItems.length})
                        </span>
                        {node.actionItems.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">
                            No action items assigned in this meeting.
                          </p>
                        ) : (
                          <ul className="space-y-1 text-xs text-gray-800 dark:text-gray-200">
                            {node.actionItems.map((a) => (
                              <li
                                key={a.id}
                                className="p-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg flex justify-between items-center"
                              >
                                <span>• {a.text}</span>
                                <span className="font-semibold text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">
                                  {a.assignee}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Meeting-to-Meeting Side-by-Side Comparison View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Select Baseline Meeting A:
              </label>
              <select
                value={compareMeetingAId}
                onChange={(e) => setCompareMeetingAId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 outline-none"
                data-testid="select-meeting-a"
              >
                {timeline.map((m) => (
                  <option key={m.meetingId} value={m.meetingId}>
                    {m.title} ({new Date(m.date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Select Subsequent Meeting B:
              </label>
              <select
                value={compareMeetingBId}
                onChange={(e) => setCompareMeetingBId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 outline-none"
                data-testid="select-meeting-b"
              >
                {timeline.map((m) => (
                  <option key={m.meetingId} value={m.meetingId}>
                    {m.title} ({new Date(m.date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Meeting A Card */}
            {meetingA ? (
              <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-3">
                <span className="text-xs font-bold text-indigo-600 uppercase">
                  Baseline: {meetingA.title}
                </span>
                <p className="text-xs text-gray-500">
                  Date: {new Date(meetingA.date).toLocaleDateString()}
                </p>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-emerald-600">
                    Decisions ({meetingA.decisions.length})
                  </h4>
                  <ul className="space-y-1 text-xs text-gray-800 dark:text-gray-200">
                    {meetingA.decisions.map((d) => (
                      <li
                        key={d.id}
                        className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg"
                      >
                        • {d.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-5 text-xs text-gray-400 italic">
                Select Meeting A above
              </div>
            )}

            {/* Meeting B Card */}
            {meetingB ? (
              <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 space-y-3">
                <span className="text-xs font-bold text-indigo-600 uppercase">
                  Subsequent: {meetingB.title}
                </span>
                <p className="text-xs text-gray-500">
                  Date: {new Date(meetingB.date).toLocaleDateString()}
                </p>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-emerald-600">
                    Decisions ({meetingB.decisions.length})
                  </h4>
                  <ul className="space-y-1 text-xs text-gray-800 dark:text-gray-200">
                    {meetingB.decisions.map((d) => (
                      <li
                        key={d.id}
                        className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg"
                      >
                        • {d.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-5 text-xs text-gray-400 italic">
                Select Meeting B above
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Toolbar */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleCopyReport}
          data-testid="copy-report-btn"
          className="flex-1 py-2 px-3 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors flex items-center justify-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy Timeline Report
        </button>

        <button
          type="button"
          onClick={handleExportCsv}
          data-testid="export-csv-btn"
          className="flex-1 py-2 px-3 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors flex items-center justify-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV Report
        </button>
      </div>
    </div>
  );
};

export default TopicEvolutionExplorer;
