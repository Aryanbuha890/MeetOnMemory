import React, { useState, useEffect } from "react";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import {
  Plus,
  Clock,
  Zap,
  CalendarDays,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { focusTimeApi } from "../api/focusTimeApi";
import { toast } from "react-toastify";

const FocusTime = () => {
  const [blocks, setBlocks] = useState([]);
  const [analytics, setAnalytics] = useState({ hoursProtected: 0, streak: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState("Focus Time");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState([]);
  const [policy, setPolicy] = useState("warn");
  const [allowOverride, setAllowOverride] = useState(true);

  const DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const fetchedBlocks = await focusTimeApi.getBlocks();
      setBlocks(fetchedBlocks);

      const start = startOfWeek(new Date()).toISOString();
      const end = endOfWeek(new Date()).toISOString();
      const fetchedAnalytics = await focusTimeApi.getAnalytics(start, end);
      setAnalytics(fetchedAnalytics);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load focus time data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        title,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        isRecurring,
        daysOfWeek: isRecurring ? daysOfWeek : [],
        policy,
        allowOverride: policy === "block" ? false : allowOverride,
      };

      await focusTimeApi.createBlock(data);
      toast.success("Focus block created!");
      setIsModalOpen(false);
      fetchData();

      // Reset form
      setTitle("Focus Time");
      setStartTime("");
      setEndTime("");
      setIsRecurring(false);
      setDaysOfWeek([]);
      setPolicy("warn");
      setAllowOverride(true);
    } catch {
      toast.error("Error creating focus block.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this focus block?")) {
      try {
        await focusTimeApi.deleteBlock(id);
        toast.success("Deleted successfully.");
        fetchData();
      } catch {
        toast.error("Failed to delete.");
      }
    }
  };

  const toggleDay = (dayIndex) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex],
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Focus Time Blocks
            </h1>
            <p className="text-gray-500 mt-1">
              Protect your deep work and avoid scheduling conflicts.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-md shadow-indigo-200"
          >
            <Plus size={18} /> Add Focus Block
          </button>
        </div>

        {/* Analytics Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-6">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
              <Clock size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Hours Protected (This Week)
              </p>
              <h2 className="text-3xl font-bold text-gray-800 mt-1">
                {analytics.hoursProtected}{" "}
                <span className="text-lg font-normal text-gray-400">hrs</span>
              </h2>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-6">
            <div className="p-4 bg-amber-50 text-amber-500 rounded-full">
              <Zap size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Focus Streak
              </p>
              <h2 className="text-3xl font-bold text-gray-800 mt-1">
                {analytics.streak}{" "}
                <span className="text-lg font-normal text-gray-400">days</span>
              </h2>
            </div>
          </div>
        </div>

        {/* Blocks List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <CalendarDays className="text-gray-400" /> Scheduled Blocks
            </h2>
          </div>

          <div className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-400">
                Loading blocks...
              </div>
            ) : blocks.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                  <CalendarDays size={32} />
                </div>
                <h3 className="text-lg font-medium text-gray-800">
                  No focus blocks yet
                </h3>
                <p className="text-gray-500 mt-1 mb-6 max-w-sm">
                  Block out time in your calendar to prevent meetings from being
                  scheduled during your deep work hours.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="text-indigo-600 font-medium hover:text-indigo-700"
                >
                  + Create your first block
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {blocks.map((block) => (
                  <li
                    key={block._id}
                    className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {block.title}
                        </h3>
                        {block.isRecurring && (
                          <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                            <RefreshCw size={12} /> Recurring
                          </span>
                        )}
                        {block.policy === "block" ||
                        block.allowOverride === false ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 px-2.5 py-1 rounded-full">
                            Strict Block
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                            Warn with Override
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <span>
                          {format(
                            parseISO(block.startTime),
                            "MMM d, yyyy h:mm a",
                          )}
                        </span>
                        <span>&mdash;</span>
                        <span>{format(parseISO(block.endTime), "h:mm a")}</span>
                      </div>
                      {block.isRecurring && block.daysOfWeek?.length > 0 && (
                        <div className="flex gap-1 mt-3">
                          {DAYS.map((day, i) => (
                            <span
                              key={day}
                              className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium ${block.daysOfWeek.includes(i) ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400"}`}
                            >
                              {day.charAt(0)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(block._id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors self-start sm:self-center"
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                Add Focus Block
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Make this a recurring block
                  </span>
                </label>
              </div>

              {isRecurring && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repeat on
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day, i) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          daysOfWeek.includes(i)
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Conflict Policy
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="policy"
                      value="warn"
                      checked={policy === "warn"}
                      onChange={() => setPolicy("warn")}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800">
                        Warn & Allow Override
                      </span>
                      <p className="text-xs text-gray-500">
                        Warns scheduling users and requires an override reason.
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="policy"
                      value="block"
                      checked={policy === "block"}
                      onChange={() => setPolicy("block")}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800">
                        Strict Block (No Overrides)
                      </span>
                      <p className="text-xs text-gray-500">
                        Completely prevents any meeting from being scheduled
                        during this focus time.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md transition-colors"
                >
                  Save Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FocusTime;
