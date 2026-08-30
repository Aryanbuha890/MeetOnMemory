import React from "react";

const SearchFilters = ({
  filters,
  setFilters,
  resultCount,
  advanced = false,
}) => {
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 w-full text-left">
      <div className="flex flex-wrap gap-4 items-center">
        {!advanced && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Type:
            </label>
            <select
              value={filters.resultType || "all"}
              onChange={(e) => handleFilterChange("resultType", e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="meeting">Meetings</option>
              <option value="policy">Policies</option>
              <option value="summary">AI Summaries</option>
            </select>
          </div>
        )}

        {advanced && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Meeting type:
            </label>
            <select
              value={filters.meetingType || ""}
              onChange={(e) =>
                handleFilterChange("meetingType", e.target.value)
              }
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Any</option>
              <option value="conference">Conference</option>
              <option value="policy">Policy</option>
              <option value="event">Event</option>
              <option value="internal">Internal</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            From:
          </label>
          <input
            type="date"
            value={filters.dateFrom || ""}
            onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            To:
          </label>
          <input
            type="date"
            value={filters.dateTo || ""}
            onChange={(e) => handleFilterChange("dateTo", e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {advanced && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Speaker:
              </label>
              <input
                type="text"
                value={filters.speaker || ""}
                onChange={(e) => handleFilterChange("speaker", e.target.value)}
                placeholder="Name or email"
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tag:
              </label>
              <input
                type="text"
                value={filters.tag || ""}
                onChange={(e) => handleFilterChange("tag", e.target.value)}
                placeholder="e.g. finance"
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Organizer:
              </label>
              <input
                type="text"
                value={filters.organizer || ""}
                onChange={(e) =>
                  handleFilterChange("organizer", e.target.value)
                }
                placeholder="Name or email"
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Department:
              </label>
              <input
                type="text"
                value={filters.department || ""}
                onChange={(e) =>
                  handleFilterChange("department", e.target.value)
                }
                placeholder="e.g. Sales"
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none w-36"
              />
            </div>
          </>
        )}

        {!advanced && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sort:
            </label>
            <select
              value={filters.sortBy || "relevance"}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="relevance">Relevance</option>
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
            </select>
          </div>
        )}

        {typeof resultCount === "number" && resultCount > 0 && (
          <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchFilters;
