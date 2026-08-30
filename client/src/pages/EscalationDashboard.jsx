import React, { useState, useEffect, useContext, useCallback } from "react";
import AppContent from "../context/AppContent";
import {
  getEscalationDashboardMetrics,
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getEscalationHistory,
  triggerManualEscalation,
} from "../services/escalationApi";
import { toast } from "react-toastify";

const EscalationDashboard = () => {
  const { userData } = useContext(AppContent);
  const organizationId =
    userData?.organization?._id || userData?.organization || null;

  const userRole =
    userData?.role ||
    userData?.organizationRole ||
    (typeof userData?.organization === "object"
      ? userData?.organization?.role
      : null);
  const isAdmin =
    userRole === "admin" || userRole === "owner" || userData?.isAdmin === true;

  const [metrics, setMetrics] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Manual Trigger Modal State
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  // Policy Form State
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    description: "",
    steps: [],
  });
  const [newStep, setNewStep] = useState({
    delayHours: 24,
    actionType: "notify",
    targetRole: "manager",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, policyData, historyData] = await Promise.all([
        getEscalationDashboardMetrics(organizationId),
        getPolicies(organizationId),
        getEscalationHistory(organizationId),
      ]);
      setMetrics(dashData);
      setPolicies(policyData || []);
      setHistoryEvents(historyData || []);
    } catch {
      toast.error("Failed to load escalation data");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [organizationId, loadData]);

  const handleAddStep = () => {
    setNewPolicy({ ...newPolicy, steps: [...newPolicy.steps, newStep] });
    setNewStep({ delayHours: 24, actionType: "notify", targetRole: "manager" });
  };

  const handleRemoveStep = (index) => {
    const updatedSteps = newPolicy.steps.filter((_, i) => i !== index);
    setNewPolicy({ ...newPolicy, steps: updatedSteps });
  };

  const handleSavePolicy = async () => {
    if (!newPolicy.name) {
      toast.error("Policy name is required");
      return;
    }

    try {
      await createPolicy({
        ...newPolicy,
        organization: organizationId,
      });
      toast.success("Policy created successfully");
      setShowPolicyForm(false);
      setNewPolicy({ name: "", description: "", steps: [] });
      loadData();
    } catch {
      toast.error("Failed to create policy");
    }
  };

  const handleDeletePolicy = async (id) => {
    if (window.confirm("Are you sure you want to delete this policy?")) {
      try {
        await deletePolicy(id);
        toast.success("Policy deleted");
        loadData();
      } catch {
        toast.error("Failed to delete policy");
      }
    }
  };

  const handleTogglePolicy = async (policy) => {
    try {
      await updatePolicy(policy._id, { isActive: !policy.isActive });
      toast.success(`Policy ${!policy.isActive ? "activated" : "deactivated"}`);
      loadData();
    } catch {
      toast.error("Failed to update policy status");
    }
  };

  const handleTriggerManualRun = async () => {
    if (!isAdmin) {
      toast.error(
        "Unauthorized: Admin privileges required for manual escalation trigger.",
      );
      return;
    }

    setIsTriggering(true);
    try {
      const res = await triggerManualEscalation({ organizationId });
      const createdCount = res.result?.eventsCreated || 0;
      toast.success(
        res.message ||
          `Escalation run completed! ${createdCount} event(s) processed.`,
      );
      setShowTriggerModal(false);
      loadData();
    } catch (err) {
      const errMessage =
        err.response?.data?.message || "Failed to trigger manual escalation";
      toast.error(errMessage);
    } finally {
      setIsTriggering(false);
    }
  };

  const filteredHistory = historyEvents.filter((event) => {
    if (historyFilter === "success")
      return event.status === "success" || !event.status;
    if (historyFilter === "failed") return event.status === "failed";
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen text-gray-800 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
            Escalation Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage policies, inspect run audit history, and trigger manual
            escalation evaluations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="manual-trigger-btn"
            onClick={() => setShowTriggerModal(true)}
            disabled={!isAdmin}
            title={
              isAdmin
                ? "Trigger manual escalation evaluation run"
                : "Admin privileges required"
            }
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all ${
              isAdmin
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 active:scale-95"
                : "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
            }`}
          >
            <span>⚡</span> Trigger Manual Run
            {!isAdmin && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                Admin Only
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Escalated"
          value={metrics?.metrics?.totalEscalated || 0}
          icon="FaExclamationCircle"
          color="from-red-400 to-red-600"
        />
        <MetricCard
          title="Active Escalated"
          value={metrics?.metrics?.activeEscalated || 0}
          icon="FaExclamationCircle"
          color="from-orange-400 to-orange-600"
        />
        <MetricCard
          title="Resolved After Esc."
          value={metrics?.metrics?.resolvedEscalated || 0}
          icon="FaCheckCircle"
          color="from-green-400 to-green-600"
        />
        <MetricCard
          title="Resolution Rate"
          value={`${metrics?.metrics?.resolutionRate || 0}%`}
          icon="FaChartLine"
          color="from-blue-400 to-blue-600"
        />
      </div>

      {/* Main Grid: Active Items & Policies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Escalated Items */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Active Escalated Items</h2>
          {metrics?.activeEscalatedItems?.length === 0 ? (
            <p className="text-gray-500 italic py-4 text-center">
              No active escalated items currently.
            </p>
          ) : (
            <div className="space-y-4">
              {metrics?.activeEscalatedItems?.map((item) => (
                <div
                  key={item._id}
                  className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg flex justify-between items-center"
                >
                  <div>
                    <h3 className="font-medium text-red-800 dark:text-red-200">
                      {item.text}
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                      Due: {new Date(item.dueDate).toLocaleDateString()} •
                      Assignee: {item.assignee?.name || "Unassigned"}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 rounded-full text-xs font-bold uppercase tracking-wide">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Policies */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 h-fit">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Active Policies</h2>
            <button
              onClick={() => setShowPolicyForm(!showPolicyForm)}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-md text-sm font-medium transition-colors"
            >
              + New Policy
            </button>
          </div>

          {showPolicyForm && (
            <div className="mb-8 p-4 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg space-y-4">
              <input
                type="text"
                placeholder="Policy Name"
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newPolicy.name}
                onChange={(e) =>
                  setNewPolicy({ ...newPolicy, name: e.target.value })
                }
              />

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  Escalation Steps
                </h4>
                {newPolicy.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm bg-white dark:bg-gray-800 p-2 rounded shadow-sm border border-gray-200 dark:border-gray-700"
                  >
                    <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 rounded">
                      {step.delayHours}h
                    </span>
                    <span>→ {step.actionType}</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {step.targetRole}
                    </span>
                    <button
                      onClick={() => handleRemoveStep(idx)}
                      className="ml-auto text-red-500 hover:text-red-700"
                    >
                      x
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 items-center pt-2">
                  <input
                    type="number"
                    className="w-16 px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                    value={newStep.delayHours}
                    onChange={(e) =>
                      setNewStep({
                        ...newStep,
                        delayHours: Number(e.target.value),
                      })
                    }
                    placeholder="Hrs"
                  />
                  <select
                    className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                    value={newStep.actionType}
                    onChange={(e) =>
                      setNewStep({ ...newStep, actionType: e.target.value })
                    }
                  >
                    <option value="notify">Notify</option>
                    <option value="reassign">Reassign</option>
                  </select>
                  <select
                    className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                    value={newStep.targetRole}
                    onChange={(e) =>
                      setNewStep({ ...newStep, targetRole: e.target.value })
                    }
                  >
                    <option value="owner">Owner</option>
                    <option value="manager">Manager</option>
                    <option value="org_admin">Org Admin</option>
                  </select>
                  <button
                    onClick={handleAddStep}
                    className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 rounded text-sm font-medium"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSavePolicy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm font-medium transition-colors"
                >
                  Save Policy
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {policies.length === 0 ? (
              <p className="text-gray-500 italic text-center py-4">
                No escalation policies configured.
              </p>
            ) : (
              policies.map((policy) => (
                <div
                  key={policy._id}
                  className={`p-4 border rounded-xl transition-all ${policy.isActive ? "border-indigo-200 bg-white shadow-sm dark:border-indigo-800 dark:bg-gray-800" : "border-gray-200 bg-gray-50 opacity-75 dark:border-gray-700 dark:bg-gray-900"}`}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold">{policy.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTogglePolicy(policy)}
                        className={`text-xs px-2 py-1 rounded font-medium ${policy.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}
                      >
                        {policy.isActive ? "Active" : "Inactive"}
                      </button>
                      <button
                        onClick={() => handleDeletePolicy(policy._id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    {policy.steps?.map((step, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        After {step.delayHours}h:{" "}
                        <span className="font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                          {step.actionType}
                        </span>{" "}
                        {step.targetRole}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Operational Run History & Audit Trail Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Escalation Run History & Audit Trail
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Audit log of automated and manually triggered policy executions.
            </p>
          </div>

          <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {["all", "success", "failed"].map((filter) => (
              <button
                key={filter}
                onClick={() => setHistoryFilter(filter)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                  historyFilter === filter
                    ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            <p className="italic text-base">
              No escalation run history records found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">Triggered At</th>
                  <th className="py-3 px-4">Policy</th>
                  <th className="py-3 px-4">Action Item / Target</th>
                  <th className="py-3 px-4">Step</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 rounded-r-lg">Details & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredHistory.map((event) => {
                  const isFailed = event.status === "failed";
                  return (
                    <tr
                      key={event._id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(
                          event.triggeredAt || event.createdAt,
                        ).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-gray-100">
                        {event.policy?.name || "Escalation Policy"}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-gray-800 dark:text-gray-200">
                          {event.actionItem?.text || "Overdue Task"}
                        </div>
                        {event.actionItem?.assignee && (
                          <div className="text-xs text-gray-500">
                            Assignee: {event.actionItem.assignee.name || "User"}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                        Step #{event.stepIndex + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isFailed
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isFailed ? "bg-red-500" : "bg-emerald-500"}`}
                          ></span>
                          {isFailed ? "Failed" : "Success"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <p className="text-gray-700 dark:text-gray-300 text-xs">
                          {event.actionTaken}
                        </p>
                        {isFailed && event.errorDetails && (
                          <div className="mt-1 p-2 rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-mono">
                            ⚠️ {event.errorDetails}
                          </div>
                        )}
                        {event.actionItem?.sourceMeetingId && (
                          <a
                            href={`/meetings/${event.actionItem.sourceMeetingId}`}
                            className="inline-block mt-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-medium underline"
                          >
                            Remediate Meeting Action →
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Trigger Confirmation Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-xl">
                ⚡
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Confirm Manual Run
              </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to trigger an immediate escalation
              evaluation run for active policies? This will evaluate all overdue
              action items and dispatch notifications or reassignments.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowTriggerModal(false)}
                disabled={isTriggering}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-trigger-btn"
                onClick={handleTriggerManualRun}
                disabled={isTriggering}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-md flex items-center gap-2"
              >
                {isTriggering ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span> Running...
                  </>
                ) : (
                  "Confirm & Trigger"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ title, value, color }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-shadow">
    <div
      className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${color} rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500 ease-in-out`}
    ></div>
    <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide uppercase">
      {title}
    </h3>
    <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">
      {value}
    </p>
  </div>
);

export default EscalationDashboard;
