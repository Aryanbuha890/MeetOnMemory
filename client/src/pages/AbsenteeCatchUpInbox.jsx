import React, { useState } from "react";
import { useAbsenteeCatchUp } from "../hooks/useAbsenteeCatchUp";
import {
  Inbox,
  CheckCircle2,
  Mail,
  Clock,
  Sparkles,
  ListTodo,
  Scale,
  MessageSquare,
  FileText,
} from "lucide-react";

const AbsenteeCatchUpInbox = () => {
  const { catchUps, isLoading, isError, markAsRead } = useAbsenteeCatchUp();
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState("all");

  if (isLoading) {
    return (
      <div className="p-12 text-center text-gray-500 max-w-4xl mx-auto">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-sm font-medium">Loading your catch-up packs...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-12 text-center text-red-500 max-w-4xl mx-auto">
        <p className="font-semibold text-lg mb-1">Failed to load catch-ups</p>
        <p className="text-sm text-gray-500">
          Please refresh or try again later.
        </p>
      </div>
    );
  }

  const filteredCatchUps = (catchUps || []).filter((item) => {
    if (filter === "unread") return item.status !== "read";
    if (filter === "read") return item.status === "read";
    return true;
  });

  const handleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleMarkAsRead = (e, id) => {
    e.stopPropagation();
    markAsRead(id);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Inbox className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Absentee Catch-Up Inbox
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Personalized AI briefing packs delivered for meetings you missed
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold self-start md:self-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-all ${filter === "all" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-xs font-bold" : "text-gray-600 dark:text-gray-400"}`}
          >
            All ({catchUps.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 rounded-lg transition-all ${filter === "unread" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-xs font-bold" : "text-gray-600 dark:text-gray-400"}`}
          >
            Unread ({catchUps.filter((c) => c.status !== "read").length})
          </button>
          <button
            onClick={() => setFilter("read")}
            className={`px-3 py-1.5 rounded-lg transition-all ${filter === "read" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-xs font-bold" : "text-gray-600 dark:text-gray-400"}`}
          >
            Read ({catchUps.filter((c) => c.status === "read").length})
          </button>
        </div>
      </div>

      {filteredCatchUps.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
          <Sparkles className="w-10 h-10 text-indigo-500 mx-auto" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            You're all caught up!
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            No {filter !== "all" ? filter : ""} catch-up packs currently in your
            inbox. When organizers generate digests for missed meetings, they
            will arrive here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCatchUps.map((catchUp) => {
            const isExpanded = expandedId === catchUp._id;
            const meeting = catchUp.meetingId;
            const content = catchUp.content || {};
            const isRead = catchUp.status === "read";

            const summaryText =
              content.overview ||
              content.catchUpReport ||
              content.summary ||
              meeting?.summary ||
              "No detailed report generated.";

            const actionItemsList =
              content.actionItems || content.actionItemsAssigned || [];
            const keyTakeawaysList =
              content.keyTakeaways || content.decisions || [];
            const mentionsList = content.mentions || [];

            return (
              <div
                key={catchUp._id}
                data-testid={`catchup-card-${catchUp._id}`}
                className={`border rounded-2xl transition-all duration-200 bg-white dark:bg-gray-800 shadow-xs ${isExpanded ? "ring-2 ring-indigo-500 border-indigo-200 dark:border-indigo-800" : "hover:border-indigo-300 cursor-pointer border-gray-200 dark:border-gray-700"}`}
                onClick={() => handleExpand(catchUp._id)}
              >
                {/* Header Row */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700/60">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white">
                        {meeting?.title || "Meeting Catch-Up"}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-full ${
                          isRead
                            ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                        }`}
                      >
                        {catchUp.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {meeting?.date
                          ? new Date(meeting.date).toLocaleDateString(
                              undefined,
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              },
                            )
                          : "Unknown Date"}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Mail className="w-3.5 h-3.5" />
                        Email & In-App Delivered
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {!isRead && (
                      <button
                        type="button"
                        data-testid={`mark-read-btn-${catchUp._id}`}
                        onClick={(e) => handleMarkAsRead(e, catchUp._id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-6 bg-slate-50/70 dark:bg-gray-800/60 space-y-5 rounded-b-2xl border-t border-gray-100 dark:border-gray-700/50">
                    {/* Personalized Executive Report */}
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-indigo-100 dark:border-gray-700 shadow-2xs space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        Personalized AI Catch-Up Digest
                      </h4>
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                        {summaryText}
                      </p>
                    </div>

                    {/* Breakdown Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Action Items */}
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-purple-100 dark:border-gray-700 space-y-2">
                        <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                          <ListTodo className="w-4 h-4 text-purple-600" />
                          Action Items ({actionItemsList.length})
                        </h4>
                        {actionItemsList.length > 0 ? (
                          <ul className="list-disc pl-5 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                            {actionItemsList.map((item, idx) => (
                              <li key={idx}>
                                {typeof item === "string"
                                  ? item
                                  : item.task || item.description}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-400 italic">
                            No action items assigned to you.
                          </p>
                        )}
                      </div>

                      {/* Key Takeaways / Decisions */}
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-emerald-100 dark:border-gray-700 space-y-2">
                        <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-emerald-600" />
                          Key Takeaways & Decisions ({keyTakeawaysList.length})
                        </h4>
                        {keyTakeawaysList.length > 0 ? (
                          <ul className="list-disc pl-5 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                            {keyTakeawaysList.map((takeaway, idx) => (
                              <li key={idx}>
                                {typeof takeaway === "string"
                                  ? takeaway
                                  : takeaway.decision || takeaway.title}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-400 italic">
                            No major decisions recorded.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Mentions if present */}
                    {mentionsList.length > 0 && (
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-blue-100 dark:border-gray-700 space-y-2">
                        <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                          Direct Mentions & Context
                        </h4>
                        <ul className="list-disc pl-5 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                          {mentionsList.map((m, idx) => (
                            <li key={idx}>
                              {typeof m === "string" ? m : m.context || m.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Footer Details */}
                    {catchUp.sentAt && (
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                        <Clock className="w-3 h-3" />
                        Dispatched on{" "}
                        {new Date(catchUp.sentAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AbsenteeCatchUpInbox;
