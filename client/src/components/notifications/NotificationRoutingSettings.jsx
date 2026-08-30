import React, { useState, useEffect } from "react";
import { notificationApi } from "../../services/notificationApi";
import { toast } from "react-toastify";
import {
  BellRing,
  ShieldAlert,
  MessageSquare,
  FileText,
  Settings,
  Loader2,
} from "lucide-react";

const NotificationRoutingSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    routingPreferences: {
      slaAlerts: { slack: true, email: true, inApp: true },
      comments: { slack: true, email: true, inApp: true },
      recaps: { slack: true, email: true, inApp: true },
    },
    batchThresholdMinutes: 5,
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await notificationApi.getPreferences();
      if (response.data?.preferences) {
        setPreferences({
          routingPreferences: response.data.preferences.routingPreferences || {
            slaAlerts: { slack: true, email: true, inApp: true },
            comments: { slack: true, email: true, inApp: true },
            recaps: { slack: true, email: true, inApp: true },
          },
          batchThresholdMinutes:
            response.data.preferences.batchThresholdMinutes ?? 5,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load routing preferences");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (category, channel) => {
    const updated = {
      ...preferences.routingPreferences,
      [category]: {
        ...preferences.routingPreferences[category],
        [channel]: !preferences.routingPreferences[category][channel],
      },
    };

    setPreferences((prev) => ({
      ...prev,
      routingPreferences: updated,
    }));

    try {
      setSaving(true);
      await notificationApi.updatePreferences({
        routingPreferences: updated,
      });
      toast.success("Preference updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save preference");
      // Rollback
      fetchPreferences();
    } finally {
      setSaving(false);
    }
  };

  const handleBatchLimitChange = async (val) => {
    const limit = Math.max(0, parseInt(val, 10) || 0);
    setPreferences((prev) => ({
      ...prev,
      batchThresholdMinutes: limit,
    }));

    try {
      setSaving(true);
      await notificationApi.updatePreferences({
        batchThresholdMinutes: limit,
      });
      toast.success("Deduplication batch threshold updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save threshold limit");
      fetchPreferences();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin w-5 h-5 mr-2" />
        <span>Loading settings...</span>
      </div>
    );
  }

  const categories = [
    {
      key: "slaAlerts",
      label: "SLAs & Mitigations",
      icon: ShieldAlert,
      desc: "Action items breaching SLA and escalations",
    },
    {
      key: "comments",
      label: "Comments & Replies",
      icon: MessageSquare,
      desc: "Replies and threads on your meetings",
    },
    {
      key: "recaps",
      label: "Meeting Recaps",
      icon: FileText,
      desc: "Gemini post-meeting summarization alerts",
    },
  ];

  const channels = [
    { key: "inApp", label: "In-App" },
    { key: "email", label: "Email" },
    { key: "slack", label: "Slack" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6 justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
            <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Notification Channel Routing Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Customize delivery channels and batching rules per alert category
            </p>
          </div>
        </div>
        {saving && (
          <span className="text-xs text-blue-500 flex items-center gap-1.5 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Saving...
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Channel matrix */}
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-850">
                <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Alert Category
                </th>
                {channels.map((chan) => (
                  <th
                    key={chan.key}
                    className="p-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center"
                  >
                    {chan.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {categories.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <tr
                    key={cat.key}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20"
                  >
                    <td className="p-4">
                      <div className="flex items-start gap-3">
                        <IconComponent className="w-4 h-4 text-slate-500 mt-0.5" />
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                            {cat.label}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {cat.desc}
                          </div>
                        </div>
                      </div>
                    </td>
                    {channels.map((chan) => {
                      const isChecked =
                        preferences.routingPreferences[cat.key]?.[chan.key] !==
                        false;
                      return (
                        <td key={chan.key} className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(cat.key, chan.key)}
                            className={`mx-auto relative w-11 h-6 rounded-full transition-colors cursor-pointer flex items-center ${
                              isChecked
                                ? "bg-blue-600"
                                : "bg-slate-200 dark:bg-slate-700"
                            }`}
                            data-testid={`toggle-${cat.key}-${chan.key}`}
                          >
                            <span
                              className={`absolute w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                                isChecked ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Batch Threshold Limit */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              Smart Deduplication Threshold (Minutes)
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 max-w-lg">
              Queue outbound alerts within this time window to group multiple
              items into a single digest summary instead of bombarding you. Set
              to 0 to disable batching.
            </p>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <input
              type="number"
              min="0"
              max="60"
              value={preferences.batchThresholdMinutes}
              onChange={(e) => handleBatchLimitChange(e.target.value)}
              className="w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              data-testid="batch-threshold-input"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              Minutes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationRoutingSettings;
