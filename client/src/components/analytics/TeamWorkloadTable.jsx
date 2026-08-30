import React, { useState, useEffect } from "react";
import apiClient from "../../services/apiClient";
import { toast } from "react-toastify";
import { AlertCircle, CheckCircle } from "lucide-react";

const TeamWorkloadTable = ({ organizationId }) => {
  const [workloads, setWorkloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!organizationId) return;

    const fetchWorkloads = async () => {
      try {
        setLoading(true);
        const { data } = await apiClient.get(
          `/api/meeting-workload/team?organizationId=${organizationId}`,
        );
        setWorkloads(data.data);
      } catch (err) {
        console.error("Error fetching team workload:", err);
        setError(
          "Failed to load team workload data. You may not have permission to view this.",
        );
        toast.error("Failed to load team workload");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkloads();
  }, [organizationId]);

  if (loading)
    return (
      <div className="p-4 text-center text-slate-500">
        Loading Team Workload...
      </div>
    );
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;
  if (workloads.length === 0)
    return (
      <div className="p-4 text-center text-slate-500">
        No workload data available.
      </div>
    );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
        Team Meeting Workload (Past 7 Days)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                Member
              </th>
              <th className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                Meeting Count
              </th>
              <th className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                Total Hours
              </th>
              <th className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {workloads.map((w) => (
              <tr
                key={w.user._id}
                className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <img
                      src={
                        w.user.avatarUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(w.user.name)}`
                      }
                      alt={w.user.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="font-medium text-slate-900 dark:text-white">
                      {w.user.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                  {w.totalMeetings}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                  {w.totalHours.toFixed(1)}h
                </td>
                <td className="py-3 px-4">
                  {w.riskStatus === "overloaded" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Overloaded
                    </span>
                  ) : w.riskStatus === "at_risk" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      At Risk
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Healthy
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamWorkloadTable;
