import React from "react";
import { CheckCircle, XCircle, Clock, Plus, Minus, Edit2 } from "lucide-react";

const DiffSection = ({ title, diffData, renderItem }) => {
  if (!diffData) return null;

  const hasChanges =
    diffData.added?.length > 0 ||
    diffData.removed?.length > 0 ||
    diffData.modified?.length > 0 ||
    diffData.completed?.length > 0 ||
    diffData.carriedOver?.length > 0 ||
    diffData.dropped?.length > 0 ||
    diffData.recurring?.length > 0;

  if (!hasChanges) {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b pb-2">
          {title}
        </h3>
        <p className="text-gray-500 italic">No significant changes.</p>
      </div>
    );
  }

  return (
    <div className="mb-8 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-4 space-y-4">
        {/* Added */}
        {diffData.added?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-green-700 flex items-center mb-2">
              <Plus className="w-4 h-4 mr-1" /> Added
            </h4>
            <div className="space-y-2">
              {diffData.added.map((item, idx) =>
                renderItem(item, idx, "added"),
              )}
            </div>
          </div>
        )}

        {/* Removed / Dropped */}
        {(diffData.removed?.length > 0 || diffData.dropped?.length > 0) && (
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-red-700 flex items-center mb-2">
              <Minus className="w-4 h-4 mr-1" /> Removed / Dropped
            </h4>
            <div className="space-y-2 opacity-75">
              {(diffData.removed || diffData.dropped).map((item, idx) =>
                renderItem(item, idx, "removed"),
              )}
            </div>
          </div>
        )}

        {/* Modified / Carried Over / Recurring */}
        {(diffData.modified?.length > 0 ||
          diffData.carriedOver?.length > 0 ||
          diffData.recurring?.length > 0) && (
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-yellow-700 flex items-center mb-2">
              <Clock className="w-4 h-4 mr-1" /> Carried Over / Modified /
              Recurring
            </h4>
            <div className="space-y-2">
              {(
                diffData.modified ||
                diffData.carriedOver ||
                diffData.recurring
              ).map((itemPair, idx) =>
                renderItem(itemPair.new, idx, "modified", itemPair.old),
              )}
            </div>
          </div>
        )}

        {/* Completed (Action Items specifically) */}
        {diffData.completed?.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-blue-700 flex items-center mb-2">
              <CheckCircle className="w-4 h-4 mr-1" /> Completed
            </h4>
            <div className="space-y-2">
              {diffData.completed.map((item, idx) =>
                renderItem(item, idx, "completed"),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function MeetingDiffView({ diffData }) {
  if (!diffData)
    return (
      <div className="p-4 text-center text-gray-500">
        No diff data available.
      </div>
    );

  const getStyleClass = (type) => {
    switch (type) {
      case "added":
        return "bg-green-50 border-green-200 text-green-900";
      case "removed":
        return "bg-red-50 border-red-200 text-red-900 line-through";
      case "modified":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "completed":
        return "bg-blue-50 border-blue-200 text-blue-900";
      default:
        return "bg-gray-50 border-gray-200 text-gray-900";
    }
  };

  const renderAgendaItem = (item, idx, type, oldItem) => (
    <div
      key={idx}
      className={`p-3 rounded border ${getStyleClass(type)} flex justify-between items-center`}
    >
      <span>{item.text}</span>
      {type === "modified" && oldItem && oldItem.duration !== item.duration && (
        <span className="text-xs px-2 py-1 bg-yellow-100 rounded text-yellow-800">
          Time changed: {oldItem.duration}m &rarr; {item.duration}m
        </span>
      )}
    </div>
  );

  const renderActionItem = (item, idx, type) => (
    <div
      key={idx}
      className={`p-3 rounded border ${getStyleClass(type)} flex justify-between items-center`}
    >
      <span>{item.text}</span>
      <span className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded font-mono">
        {item.owner || "Unassigned"}
      </span>
    </div>
  );

  const renderDecision = (item, idx, type, oldItem) => (
    <div
      key={idx}
      className={`p-3 rounded border ${getStyleClass(type)} flex justify-between items-center`}
    >
      <span>{item.text}</span>
      {type === "modified" && oldItem && oldItem.status !== item.status && (
        <span className="text-xs px-2 py-1 bg-yellow-100 rounded text-yellow-800">
          Status: {oldItem.status} &rarr; {item.status}
        </span>
      )}
    </div>
  );

  const renderTopic = (item, idx, type) => (
    <div
      key={idx}
      className={`inline-flex px-3 py-1 mr-2 rounded-full border ${getStyleClass(type)}`}
    >
      {item.name}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="text-center flex-1">
          <p className="text-sm text-gray-500 uppercase font-semibold">
            Previous Meeting
          </p>
          <h2 className="text-xl font-bold text-gray-800 mt-1">
            {diffData.meeting1?.title || "Unknown"}
          </h2>
          <p className="text-sm text-gray-600">
            {diffData.meeting1?.date
              ? new Date(diffData.meeting1.date).toLocaleDateString()
              : "N/A"}
          </p>
        </div>
        <div className="px-6 text-gray-400">
          <Edit2 className="w-6 h-6" />
        </div>
        <div className="text-center flex-1">
          <p className="text-sm text-gray-500 uppercase font-semibold">
            Current Meeting
          </p>
          <h2 className="text-xl font-bold text-gray-800 mt-1">
            {diffData.meeting2?.title || "Unknown"}
          </h2>
          <p className="text-sm text-gray-600">
            {diffData.meeting2?.date
              ? new Date(diffData.meeting2.date).toLocaleDateString()
              : "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <DiffSection
          title="Agenda"
          diffData={diffData.agenda}
          renderItem={renderAgendaItem}
        />
        <DiffSection
          title="Action Items"
          diffData={diffData.actionItems}
          renderItem={renderActionItem}
        />
        <DiffSection
          title="Decisions"
          diffData={diffData.decisions}
          renderItem={renderDecision}
        />
        <DiffSection
          title="Topics"
          diffData={diffData.topics}
          renderItem={renderTopic}
        />
      </div>
    </div>
  );
}
