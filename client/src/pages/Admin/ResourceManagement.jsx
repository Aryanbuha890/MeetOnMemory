import React, { useState, useEffect, useContext, useCallback } from "react";
import AppContent from "../../context/AppContent";
import useResourceBookings from "../../hooks/useResourceBookings";
import {
  Plus,
  Building2,
  Monitor,
  Utensils,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  Clock,
  Trash2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export const ResourceManagement = ({
  resourceId: propResourceId,
  isAdmin: propIsAdmin,
  onBookingSuccess,
}) => {
  const { userData } = useContext(AppContent);
  const currentOrganization = userData?.organization;
  const isAdmin =
    propIsAdmin !== undefined
      ? propIsAdmin
      : userData?.role === "admin" ||
        userData?.role === "owner" ||
        userData?.isAdmin;

  const {
    fetchPhysicalResources,
    createResource,
    deleteResource,
    fetchResourceBookings,
    bookResource,
    cancelResourceBooking,
    loading,
    error: apiError,
  } = useResourceBookings();

  const [resources, setResources] = useState([]);
  const [selectedResourceId, setSelectedResourceId] = useState(
    propResourceId || null,
  );
  const [activeTab, setActiveTab] = useState("all"); // "all", "room", "equipment", "catering"
  const [showResourceForm, setShowResourceForm] = useState(false);

  // Booking form state
  const [bookingTitle, setBookingTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(null);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState("");

  // New resource form state
  const [formData, setFormData] = useState({
    name: "",
    type: "room",
    capacity: 0,
    location: "",
  });

  const getOrgId = useCallback(() => {
    if (!currentOrganization) return null;
    return typeof currentOrganization === "string"
      ? currentOrganization
      : currentOrganization._id;
  }, [currentOrganization]);

  const loadResources = useCallback(async () => {
    const orgId = getOrgId();
    if (!orgId) return;
    try {
      const data = await fetchPhysicalResources(orgId);
      const resList = data || [];
      setResources(resList);
      if (!selectedResourceId && resList.length > 0) {
        setSelectedResourceId(resList[0]._id);
      }
    } catch (err) {
      console.error("Failed to load resources", err);
    }
  }, [getOrgId, fetchPhysicalResources, selectedResourceId]);

  const loadBookings = useCallback(
    async (rId) => {
      const targetId = rId || selectedResourceId;
      if (!targetId) {
        setBookings([]);
        return;
      }
      setLoadingBookings(true);
      try {
        const data = await fetchResourceBookings(targetId);
        setBookings(data || []);
      } catch (err) {
        console.error("Failed to load bookings", err);
      } finally {
        setLoadingBookings(false);
      }
    },
    [selectedResourceId, fetchResourceBookings],
  );

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  useEffect(() => {
    if (selectedResourceId) {
      loadBookings(selectedResourceId);
      setConflictWarning(null);
    }
  }, [selectedResourceId, loadBookings]);

  // Handle new resource submission
  const handleResourceChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleResourceSubmit = async (e) => {
    e.preventDefault();
    const orgId = getOrgId();
    if (!orgId) return;
    try {
      const newRes = await createResource(orgId, {
        ...formData,
        capacity: Number(formData.capacity),
      });
      setShowResourceForm(false);
      setFormData({ name: "", type: "room", capacity: 0, location: "" });
      await loadResources();
      if (newRes?._id) {
        setSelectedResourceId(newRes._id);
      }
    } catch (err) {
      console.error("Failed to create resource", err);
    }
  };

  const handleDeleteResource = async (rId, e) => {
    if (e) e.stopPropagation();
    if (
      !window.confirm(
        "Are you sure you want to delete this resource and all its bookings?",
      )
    ) {
      return;
    }
    try {
      await deleteResource(rId);
      if (selectedResourceId === rId) {
        setSelectedResourceId(null);
      }
      loadResources();
    } catch (err) {
      console.error("Failed to delete resource", err);
    }
  };

  // Format date helper for input default
  const setQuickTime = (hoursFromNow = 1, durationMinutes = 60) => {
    const now = new Date();
    const start = new Date(now.getTime() + hoursFromNow * 3600000);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60000);

    const toLocalISO = (d) => {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setStartTime(toLocalISO(start));
    setEndTime(toLocalISO(end));
    setConflictWarning(null);
  };

  // Handle booking slot submission
  const handleBookSlot = async (
    e,
    customStart = null,
    customEnd = null,
    customResourceId = null,
  ) => {
    if (e) e.preventDefault();
    setConflictWarning(null);
    setBookingSuccessMsg("");

    const targetResourceId = customResourceId || selectedResourceId;
    if (!targetResourceId) {
      setConflictWarning({
        message: "Please select a physical resource to reserve.",
      });
      return;
    }

    const startVal = customStart || startTime;
    const endVal = customEnd || endTime;

    if (!startVal || !endVal) {
      setConflictWarning({
        message: "Start time and end time are required.",
      });
      return;
    }

    const orgId = getOrgId();
    const payload = {
      resourceId: targetResourceId,
      title: bookingTitle.trim() || "Facility Reservation Event",
      startTime: new Date(startVal).toISOString(),
      endTime: new Date(endVal).toISOString(),
      organizationId: orgId,
    };

    try {
      await bookResource(orgId, payload);
      setBookingTitle("");
      setStartTime("");
      setEndTime("");
      setConflictWarning(null);
      setBookingSuccessMsg("Slot successfully reserved!");
      setTimeout(() => setBookingSuccessMsg(""), 4000);
      loadBookings(targetResourceId);
      if (onBookingSuccess) onBookingSuccess();
    } catch (err) {
      const errorData = err.response?.data;
      if (err.response?.status === 409 || errorData?.error === "CONFLICT") {
        setConflictWarning(
          errorData || {
            error: "CONFLICT",
            message:
              "The requested resource is already reserved during this specific interval.",
            suggestions: [],
          },
        );
      } else {
        setConflictWarning({
          message:
            errorData?.message ||
            err.message ||
            "Failed to schedule resource reservation.",
        });
      }
    }
  };

  const handleCancelBooking = async (bId) => {
    try {
      await cancelResourceBooking(bId);
      loadBookings(selectedResourceId);
    } catch (err) {
      console.error("Failed to cancel booking", err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "room":
        return <Building2 className="w-5 h-5 text-blue-500" />;
      case "equipment":
        return <Monitor className="w-5 h-5 text-purple-500" />;
      case "catering":
        return <Utensils className="w-5 h-5 text-orange-500" />;
      default:
        return <Building2 className="w-5 h-5 text-gray-500" />;
    }
  };

  const filteredResources = resources.filter((r) =>
    activeTab === "all" ? true : r.type === activeTab,
  );

  const selectedResource = resources.find((r) => r._id === selectedResourceId);

  return (
    <div
      data-testid="resource-management-container"
      className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-6 text-slate-800 dark:text-slate-200"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Facility Resource Timeline & Calendar
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Schedule facility slots or resolve room allocation bottlenecks
            real-time.
          </p>
        </div>
        <button
          onClick={() => setShowResourceForm(!showResourceForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {showResourceForm ? "Close Form" : "Add Resource"}
        </button>
      </div>

      {apiError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
          <AlertCircle
            className="text-red-600 dark:text-red-500 shrink-0"
            size={20}
          />
          <p className="text-sm text-red-800 dark:text-red-200">{apiError}</p>
        </div>
      )}

      {/* Add New Resource Modal / Card */}
      {showResourceForm && (
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h4 className="text-base font-semibold text-slate-900 dark:text-white">
            Create Physical Facility Resource
          </h4>
          <form
            data-testid="create-resource-form"
            onSubmit={handleResourceSubmit}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Resource Name
                </label>
                <input
                  type="text"
                  name="name"
                  data-testid="new-resource-name-input"
                  value={formData.name}
                  onChange={handleResourceChange}
                  required
                  placeholder="e.g. Executive Boardroom Alpha"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Resource Type
                </label>
                <select
                  name="type"
                  data-testid="new-resource-type-select"
                  value={formData.type}
                  onChange={handleResourceChange}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="room">Room / Conference Space</option>
                  <option value="equipment">Equipment (AV, Screen, Mic)</option>
                  <option value="catering">Catering Service</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Capacity (optional)
                </label>
                <input
                  type="number"
                  name="capacity"
                  data-testid="new-resource-capacity-input"
                  value={formData.capacity}
                  onChange={handleResourceChange}
                  min="0"
                  placeholder="e.g. 14"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Location / Floor (optional)
                </label>
                <input
                  type="text"
                  name="location"
                  data-testid="new-resource-location-input"
                  value={formData.location}
                  onChange={handleResourceChange}
                  placeholder="e.g. Floor 3, North Wing"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResourceForm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="new-resource-submit-btn"
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Resource Creation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resource Filter Tabs & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {["all", "room", "equipment", "catering"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition ${
                activeTab === tab
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab === "all" ? "All Resources" : `${tab}s`}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400">
          {filteredResources.length}{" "}
          {filteredResources.length === 1 ? "Resource" : "Resources"} Available
        </span>
      </div>

      {/* Resource Selection Cards Carousel / Grid */}
      {filteredResources.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            No physical resources found in this category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredResources.map((res) => {
            const isSelected = res._id === selectedResourceId;
            return (
              <div
                key={res._id}
                onClick={() => setSelectedResourceId(res._id)}
                data-testid={`resource-card-${res._id}`}
                className={`group relative p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-900/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {getIcon(res.type)}
                    <div>
                      <h5 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {res.name}
                      </h5>
                      <span className="text-[11px] capitalize text-slate-500 dark:text-slate-400">
                        {res.type}
                        {res.capacity > 0 && ` • Cap: ${res.capacity}`}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => handleDeleteResource(res._id, e)}
                      title="Delete Resource"
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {res.location && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 truncate">
                    📍 {res.location}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Resource Title & Action Section */}
      {selectedResource && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Timeline: {selectedResource.name}
              </h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                {selectedResource.type}
              </span>
            </div>

            {/* Preset quick book times */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Quick Presets:
              </span>
              <button
                type="button"
                onClick={() => setQuickTime(0.5, 30)}
                className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 rounded-md transition"
              >
                +30m
              </button>
              <button
                type="button"
                onClick={() => setQuickTime(1, 60)}
                className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 rounded-md transition"
              >
                +1h
              </button>
              <button
                type="button"
                onClick={() => setQuickTime(2, 120)}
                className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 rounded-md transition"
              >
                +2h
              </button>
            </div>
          </div>

          {/* Overlap Interception Warning Framework */}
          {conflictWarning && (
            <div
              data-testid="conflict-warning-banner"
              className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-3 shadow-xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    ⚠️ Allocation Collision Triggered
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {conflictWarning.message ||
                      "The requested resource is already reserved during this specific interval."}
                  </p>
                </div>
              </div>

              {conflictWarning.suggestions &&
                conflictWarning.suggestions.length > 0 && (
                  <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60 space-y-2">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Suggested Alternative Free Slots:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {conflictWarning.suggestions.map((slot, idx) => {
                        const startObj = new Date(slot.startTime);
                        const endObj = new Date(slot.endTime);
                        const formattedTime = `${startObj.toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )} - ${endObj.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              handleBookSlot(null, slot.startTime, slot.endTime)
                            }
                            className="inline-flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium px-3 py-1.5 rounded-lg transition shadow-xs"
                          >
                            Accept Alternative Slot: {formattedTime}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          )}

          {bookingSuccessMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {bookingSuccessMsg}
            </div>
          )}

          {/* Reservation Submission Terminal */}
          <form
            data-testid="booking-form"
            onSubmit={(e) => handleBookSlot(e)}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Booking Title
              </label>
              <input
                type="text"
                data-testid="booking-title-input"
                value={bookingTitle}
                onChange={(e) => setBookingTitle(e.target.value)}
                placeholder="e.g. Executive Boardroom Sync"
                className="w-full text-sm border border-slate-300 dark:border-slate-700 p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                data-testid="booking-start-input"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setConflictWarning(null);
                }}
                required
                className="w-full text-sm border border-slate-300 dark:border-slate-700 p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                data-testid="booking-end-input"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setConflictWarning(null);
                }}
                required
                className="w-full text-sm border border-slate-300 dark:border-slate-700 p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              data-testid="booking-submit-btn"
              disabled={loading}
              className="md:col-span-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              Confirm Schedule Reservation
            </button>
          </form>

          {/* Timeline Grid Summary Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Active Resource Leases & Bookings
              </h4>
              <span className="text-xs text-slate-400">
                {bookings.length} active reservation
                {bookings.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
              {loadingBookings ? (
                <div className="p-6 flex justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : bookings.length === 0 ? (
                <p className="p-6 text-xs text-slate-400 text-center">
                  No active reservation locks registered on timeline.
                </p>
              ) : (
                bookings.map((b) => {
                  const currentUserId = userData?._id || userData?.id;
                  const bookingUserId =
                    typeof b.userId === "object" ? b.userId?._id : b.userId;
                  const canRevoke =
                    isAdmin ||
                    (currentUserId &&
                      bookingUserId &&
                      bookingUserId.toString() === currentUserId.toString()) ||
                    bookingUserId === "current_user_id";

                  const startObj = new Date(b.startTime);
                  const endObj = new Date(b.endTime);

                  return (
                    <div
                      key={b._id}
                      data-testid={`booking-item-${b._id}`}
                      className="p-3.5 flex justify-between items-center text-sm bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {b.title || "Facility Reservation Event"}
                          </p>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            {b.status || "CONFIRMED"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          📅 {startObj.toLocaleDateString()}{" "}
                          {startObj.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {endObj.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {canRevoke && (
                        <button
                          onClick={() => handleCancelBooking(b._id)}
                          data-testid={`revoke-btn-${b._id}`}
                          className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-3 py-1.5 rounded-lg transition"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceManagement;
