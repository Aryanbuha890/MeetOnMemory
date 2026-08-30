import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../../services";
import MeetingCard from "./MeetingCard.jsx";
import MeetingSearch from "./MeetingSearch.jsx";
import MeetingFilters from "./MeetingFilters.jsx";
import Pagination from "./Pagination.jsx";
import EmptyState from "./EmptyState.jsx";
import { useNavigate } from "react-router-dom";
import useApiRequest from "../../hooks/useApiRequest.js";
import { savedFilterApi } from "../../services";
import SavedFilterBar from "./SavedFilterBar.jsx";
import SaveFilterModal from "./SaveFilterModal.jsx";
import { BookmarkPlus, ListChecks } from "lucide-react";
import useBulkMeetingActions from "../../hooks/useBulkMeetingActions.js";
import BulkActionBar from "./BulkActionBar.jsx";
import { customFieldApi } from "../../api/customFieldApi.js";
import AppContent from "../../context/AppContent";

const MeetingRepository = () => {
  const navigate = useNavigate();
  const { userData } = React.useContext(AppContent);
  const organizationId =
    userData?.organization?._id || userData?.organization || null;

  const [filteredMeetings, setFilteredMeetings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    meetingType: "all",
    dateRange: "all",
    sortBy: "createdAt-desc",
  });

  const [customFieldDefinitions, setCustomFieldDefinitions] = useState([]);
  const [customFieldFilters, setCustomFieldFilters] = useState({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Saved Filters
  const [savedFilters, setSavedFilters] = useState([]);
  const [savedFiltersError, setSavedFiltersError] = useState(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const fetchSavedFilters = useCallback(async () => {
    try {
      setSavedFiltersError(null);
      const response = await savedFilterApi.getFilters();
      if (response.data?.success) {
        setSavedFilters(response.data.filters || []);
      }
    } catch (err) {
      console.error("Failed to fetch saved filters", err);
      setSavedFiltersError(
        err.response?.data?.message || "Failed to load saved views",
      );
    }
  }, []);

  useEffect(() => {
    fetchSavedFilters();
  }, [fetchSavedFilters]);

  const handleApplySavedFilter = (savedFilter) => {
    if (savedFilter.filters) {
      setFilters(savedFilter.filters);
      if (savedFilter.filters.searchQuery !== undefined) {
        setSearchQuery(savedFilter.filters.searchQuery);
      }
    }
  };

  const handleSaveFilter = async (filterData) => {
    try {
      const response = await savedFilterApi.createFilter(filterData);
      if (response.data?.success) {
        toast.success("Filter saved successfully");
        fetchSavedFilters();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save filter");
    }
  };

  // Abort in-flight loads when a newer refresh starts (#1131 / #978).
  const loadMeetings = useCallback(async (signal) => {
    const response = await meetingApi.getAllMeetings({}, { signal });

    if (!response.data?.success) {
      const failure = new Error(
        response.data?.message || "Failed to fetch meetings",
      );
      throw failure;
    }

    return response.data.meetings || [];
  }, []);

  const {
    data: meetings,
    error: requestError,
    loading,
    execute: fetchMeetings,
  } = useApiRequest(loadMeetings, { initialData: [] });

  const error = requestError
    ? requestError.response?.data?.message ||
      requestError.message ||
      "Failed to load meetings"
    : null;

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const {
    isBulkMode,
    toggleBulkMode,
    selectedMeetings,
    toggleSelection,
    isProcessing,
    errorMessage,
    clearError,
    handleBulkArchive,
    handleBulkTag,
    handleBulkSoftDelete,
    handleBulkExport,
  } = useBulkMeetingActions(fetchMeetings);

  useEffect(() => {
    if (!organizationId) return;
    customFieldApi
      .getDefinitions(organizationId)
      .then((res) => {
        setCustomFieldDefinitions(res.data || []);
      })
      .catch((err) =>
        console.error("Failed to load org custom field definitions", err),
      );
  }, [organizationId]);

  const handleCustomFieldFilterChange = (fieldName, value) => {
    setCustomFieldFilters((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleClearAllFilters = () => {
    setFilters({
      status: "all",
      meetingType: "all",
      dateRange: "all",
      sortBy: "createdAt-desc",
    });
    setCustomFieldFilters({});
    setSearchQuery("");
  };

  // Apply filters and search
  useEffect(() => {
    let filtered = [...(meetings || [])];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (meeting) =>
          meeting.title?.toLowerCase().includes(query) ||
          meeting.summary?.toLowerCase().includes(query) ||
          meeting.transcript?.toLowerCase().includes(query) ||
          meeting.tags?.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    // Apply status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(
        (meeting) => meeting.status === filters.status,
      );
    }

    // Apply meeting type filter
    if (filters.meetingType !== "all") {
      filtered = filtered.filter(
        (meeting) => meeting.meetingType === filters.meetingType,
      );
    }

    // Apply custom field facet filters
    Object.keys(customFieldFilters).forEach((fieldName) => {
      const filterVal = customFieldFilters[fieldName];
      if (filterVal && filterVal !== "all" && filterVal !== "") {
        filtered = filtered.filter((m) => {
          if (!m.customFields || !Array.isArray(m.customFields)) return false;
          return m.customFields.some(
            (cf) =>
              (cf.key === fieldName || cf.name === fieldName) &&
              String(cf.value)
                .toLowerCase()
                .includes(String(filterVal).toLowerCase()),
          );
        });
      }
    });

    // Apply date range filter
    if (filters.dateRange !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((meeting) => {
        const meetingDate = new Date(meeting.date || meeting.createdAt);

        switch (filters.dateRange) {
          case "today":
            return meetingDate >= today;
          case "week": {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return meetingDate >= weekAgo;
          }
          case "month": {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return meetingDate >= monthAgo;
          }
          case "year": {
            const yearAgo = new Date(today);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            return meetingDate >= yearAgo;
          }
          default:
            return true;
        }
      });
    }

    // Apply sorting
    const [sortBy, sortOrder] = filters.sortBy.split("-");
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "createdAt":
          comparison = new Date(a.createdAt) - new Date(b.createdAt);
          break;
        case "date":
          comparison =
            new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt);
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredMeetings(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [meetings, searchQuery, filters, customFieldFilters]);

  // Pagination logic
  const totalPages = Math.ceil(filteredMeetings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMeetings = filteredMeetings.slice(startIndex, endIndex);

  // Meeting actions
  const handleDelete = async (meetingId) => {
    if (
      !window.confirm(
        "Move this meeting to the Recycle Bin? You can restore it from there later.",
      )
    ) {
      return;
    }

    try {
      const response = await meetingApi.deleteMeeting(meetingId);

      if (response.data?.success) {
        toast.success(
          <span>
            Meeting moved to Recycle Bin.{" "}
            <button
              onClick={() => navigate("/meetings/recycle-bin")}
              className="underline font-medium"
            >
              View Recycle Bin
            </button>
          </span>,
          <div className="flex items-center justify-between gap-3">
            <span>Meeting moved to recycle bin</span>
            <button
              type="button"
              onClick={() => navigate("/meetings/recycle-bin")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline shrink-0"
            >
              View Recycle Bin
            </button>
          </div>,
        );
        fetchMeetings();
      } else {
        toast.error(response.data?.message || "Failed to delete meeting");
      }
    } catch (err) {
      console.error("Error deleting meeting:", err);
      toast.error(err.response?.data?.message || "Failed to delete meeting");
    }
  };

  const handleRename = async (meetingId, newTitle) => {
    try {
      const response = await meetingApi.updateMeeting(meetingId, {
        title: newTitle,
      });

      if (response.data?.success) {
        toast.success("Meeting renamed successfully");
        fetchMeetings();
      } else {
        toast.error(response.data?.message || "Failed to rename meeting");
      }
    } catch (err) {
      console.error("Error renaming meeting:", err);
      toast.error(err.response?.data?.message || "Failed to rename meeting");
    }
  };

  const handleView = (meeting) => {
    navigate(`/meeting/${meeting._id}`);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: "all",
      meetingType: "all",
      dateRange: "all",
      sortBy: "createdAt-desc",
    });
    setSearchQuery("");
  };

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.meetingType !== "all" ||
    filters.dateRange !== "all" ||
    searchQuery.trim() !== "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading meetings...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-gray-700 dark:text-gray-200 text-lg">{error}</p>
          <button
            onClick={() => fetchMeetings()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SavedFilterBar
        savedFilters={savedFilters}
        error={savedFiltersError}
        onApplyFilter={handleApplySavedFilter}
        fetchFilters={fetchSavedFilters}
        onRetry={fetchSavedFilters}
      />

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <MeetingSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="flex gap-3 items-center w-full lg:w-auto">
          <MeetingFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearAllFilters}
            customFieldDefinitions={customFieldDefinitions}
            customFieldFilters={customFieldFilters}
            onCustomFieldChange={handleCustomFieldFilterChange}
          />
          <button
            onClick={() => setIsSaveModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Save current filters as a smart view"
          >
            <BookmarkPlus className="w-4 h-4" />
            Save View
          </button>
          <button
            onClick={toggleBulkMode}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              isBulkMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
            }`}
            title="Toggle bulk selection mode"
          >
            <ListChecks className="w-4 h-4" />
            Bulk Mode
          </button>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Active filters:
          </span>
          {searchQuery && (
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 rounded-full">
              Search: "{searchQuery}"
            </span>
          )}
          {filters.status !== "all" && (
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 rounded-full">
              Status: {filters.status}
            </span>
          )}
          {filters.meetingType !== "all" && (
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 rounded-full">
              Type: {filters.meetingType}
            </span>
          )}
          {filters.dateRange !== "all" && (
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 rounded-full">
              Date: {filters.dateRange}
            </span>
          )}
          <button
            onClick={handleClearFilters}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Meeting Grid */}
      {currentMeetings.length === 0 ? (
        <EmptyState
          type={
            hasActiveFilters
              ? "noResults"
              : meetings.length === 0
                ? "noMeetings"
                : "noMeetings"
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentMeetings.map((meeting) => (
              <MeetingCard
                key={meeting._id}
                meeting={meeting}
                onDelete={handleDelete}
                onRename={handleRename}
                onView={handleView}
                isBulkMode={isBulkMode}
                isSelected={selectedMeetings.has(meeting._id)}
                onToggleSelect={toggleSelection}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      <SaveFilterModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveFilter}
        initialFilters={{ ...filters, searchQuery }}
      />

      {isBulkMode && (
        <BulkActionBar
          selectedCount={selectedMeetings.size}
          isProcessing={isProcessing}
          errorMessage={errorMessage}
          onArchive={handleBulkArchive}
          onDelete={handleBulkSoftDelete}
          onExport={handleBulkExport}
          onTag={handleBulkTag}
          onCancel={toggleBulkMode}
          onClearError={clearError}
        />
      )}
    </div>
  );
};

export default MeetingRepository;
