import React, { useState, useEffect } from "react";
import apiClient from "../../services/apiClient";
import { toast } from "react-toastify";

const MeetingWorkloadHeatmap = ({ organizationId }) => {
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!organizationId) return;

    const fetchHeatmap = async () => {
      try {
        setLoading(true);
        const { data } = await apiClient.get(
          `/api/meeting-workload/heatmap?organizationId=${organizationId}`,
        );
        setHeatmapData(data.data);
      } catch (err) {
        console.error("Error fetching heatmap:", err);
        setError("Failed to load heatmap data");
        toast.error("Failed to load meeting heatmap");
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
  }, [organizationId]);

  if (loading)
    return (
      <div className="p-4 text-center text-slate-500">Loading Heatmap...</div>
    );
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Helper to determine color based on density (green to red)
  const getCellColor = (density) => {
    if (density === 0) return "bg-slate-100 dark:bg-slate-800";
    if (density <= 1) return "bg-green-200 dark:bg-green-900";
    if (density <= 2) return "bg-yellow-200 dark:bg-yellow-900";
    if (density <= 3) return "bg-orange-300 dark:bg-orange-800";
    return "bg-red-400 dark:bg-red-700";
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 overflow-x-auto">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
        Your Meeting Heatmap (Past 7 Days)
      </h2>
      <div className="min-w-[800px]">
        <div className="flex border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
          <div className="w-12 shrink-0"></div>
          {hours.map((hour) => (
            <div
              key={hour}
              className="flex-1 text-center text-xs text-slate-500 font-medium"
            >
              {hour.toString().padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((dayName, dayIndex) => {
          // Find data for this day
          const dayData = heatmapData.find((d) => d.day === dayIndex) || {
            hours: Array(24).fill(0),
          };

          return (
            <div key={dayIndex} className="flex items-center mb-1">
              <div className="w-12 shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {dayName}
              </div>
              {hours.map((hour) => {
                const density = dayData.hours[hour] || 0;
                return (
                  <div
                    key={hour}
                    className="flex-1 px-0.5"
                    title={`${dayName} ${hour}:00 - ${density} meeting(s)`}
                  >
                    <div
                      className={`h-8 rounded ${getCellColor(density)} transition-colors hover:opacity-80`}
                    ></div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-6 text-xs text-slate-500">
        <span>Less meetings</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800"></div>
          <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-900"></div>
          <div className="w-4 h-4 rounded bg-yellow-200 dark:bg-yellow-900"></div>
          <div className="w-4 h-4 rounded bg-orange-300 dark:bg-orange-800"></div>
          <div className="w-4 h-4 rounded bg-red-400 dark:bg-red-700"></div>
        </div>
        <span>More meetings</span>
      </div>
    </div>
  );
};

export default MeetingWorkloadHeatmap;
