import React, { useState } from "react";
import { X, Clock, Bell, AlertTriangle } from "lucide-react";

export default function SnoozeAlertModal({ task, onClose, onSave }) {
  const [snoozeOption, setSnoozeOption] = useState("none");
  const [customSnoozeDate, setCustomSnoozeDate] = useState("");
  const [customWarningOffsets, setCustomWarningOffsets] = useState(
    task.customWarningOffsets?.join(", ") || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const snoozePresets = [
    { label: "Don't Snooze / Clear Snooze", value: "none" },
    { label: "30 Minutes", value: "30m", minutes: 30 },
    { label: "2 Hours", value: "2h", minutes: 120 },
    { label: "12 Hours", value: "12h", minutes: 720 },
    { label: "1 Day", value: "1d", minutes: 1440 },
    { label: "3 Days", value: "3d", minutes: 4320 },
    { label: "Custom Date & Time", value: "custom" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    let snoozedUntil = null;
    if (snoozeOption !== "none") {
      if (snoozeOption === "custom") {
        if (customSnoozeDate) {
          snoozedUntil = new Date(customSnoozeDate).toISOString();
        }
      } else {
        const preset = snoozePresets.find((p) => p.value === snoozeOption);
        if (preset && preset.minutes) {
          snoozedUntil = new Date(
            Date.now() + preset.minutes * 60 * 1000,
          ).toISOString();
        }
      }
    }

    // Parse offsets: comma separated numbers
    const offsets = customWarningOffsets
      .split(",")
      .map((val) => parseInt(val.trim(), 10))
      .filter((num) => !isNaN(num) && num > 0);

    const success = await onSave(task.id, {
      snoozedUntil,
      customWarningOffsets: offsets,
    });

    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  const isCurrentSnoozed =
    task.snoozedUntil && new Date(task.snoozedUntil) > new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900/50 dark:to-slate-900/50">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-slate-900 dark:text-white">
              Snooze & Alert Settings
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          {/* Task Info */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Task Text
            </p>
            <p className="text-sm font-medium text-slate-855 dark:text-slate-205 line-clamp-2">
              {task.title}
            </p>
            {isCurrentSnoozed && (
              <div className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs font-black rounded-full border border-amber-100 dark:border-amber-900/50">
                Snoozed until {new Date(task.snoozedUntil).toLocaleString()}
              </div>
            )}
          </div>

          {/* Snooze Options */}
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" /> Snooze Duration
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <select
                value={snoozeOption}
                onChange={(e) => setSnoozeOption(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-850 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/50 transition"
              >
                {snoozePresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {snoozeOption === "custom" && (
              <div className="pt-2">
                <input
                  type="datetime-local"
                  required
                  value={customSnoozeDate}
                  onChange={(e) => setCustomSnoozeDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-850 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                />
              </div>
            )}
          </div>

          {/* Custom Warnings */}
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-slate-400" /> Custom SLA Warning
              Offsets
            </label>
            <input
              type="text"
              value={customWarningOffsets}
              onChange={(e) => setCustomWarningOffsets(e.target.value)}
              placeholder="e.g. 180, 60 (for 3h and 1h warning offsets)"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-850 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-400 dark:placeholder-slate-500 transition"
            />
            <p className="text-[11px] text-slate-450 dark:text-slate-500 flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>
                Enter comma-separated minutes before SLA breach to trigger
                alerts. E.g. 180 is 3 hours before.
              </span>
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl shadow-xs transition"
            >
              {isSubmitting ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
