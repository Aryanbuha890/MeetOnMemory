import React, { useState, useEffect } from "react";
import {
  getRecapPreferences,
  updateRecapPreferences,
  previewRecapEmail,
} from "../services/recapApi";
import { Dialog } from "@headlessui/react";
import { toast } from "react-toastify";
import SandboxedHtmlPreview from "./SandboxedHtmlPreview";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import SharedQuietHours from "./SharedQuietHours.jsx";

const RecapPreferences = () => {
  const [preferences, setPreferences] = useState({
    deliveryTiming: "immediate",
    includeSummary: true,
    includeActionItems: true,
    includeTranscript: true,
    quietHoursStart: "",
    quietHoursEnd: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const quietHoursError = (() => {
    const { quietHoursStart: start, quietHoursEnd: end } = preferences;
    if ((start === "" && end !== "") || (start !== "" && end === "")) {
      return "Both start and end times must be selected to enable quiet hours.";
    }
    if (start !== "" && end !== "" && Number(start) === Number(end)) {
      return "Start and end times cannot be the same.";
    }
    return null;
  })();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const data = await getRecapPreferences();
      setPreferences({
        ...data,
        quietHoursStart: data.quietHoursStart ?? "",
        quietHoursEnd: data.quietHoursEnd ?? "",
      });
    } catch {
      toast.error("Failed to load recap preferences");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async () => {
    if (quietHoursError) {
      toast.error(quietHoursError);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...preferences,
        quietHoursStart:
          preferences.quietHoursStart !== ""
            ? Number(preferences.quietHoursStart)
            : null,
        quietHoursEnd:
          preferences.quietHoursEnd !== ""
            ? Number(preferences.quietHoursEnd)
            : null,
      };
      await updateRecapPreferences(payload);
      toast.success("Preferences saved successfully!");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (quietHoursError) {
      toast.error("Please fix quiet hours configuration to preview.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    setIsPreviewOpen(true);
    try {
      const payload = {
        ...preferences,
        quietHoursStart:
          preferences.quietHoursStart !== ""
            ? Number(preferences.quietHoursStart)
            : null,
        quietHoursEnd:
          preferences.quietHoursEnd !== ""
            ? Number(preferences.quietHoursEnd)
            : null,
      };
      const html = await previewRecapEmail(payload);
      setPreviewHtml(sanitizeHtml(html));
    } catch {
      setPreviewError("Failed to generate preview");
      setPreviewHtml("");
      toast.error("Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) return <div>Loading preferences...</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-3xl">
      <h2 className="text-xl font-semibold mb-4">Meeting Recap Settings</h2>
      <p className="text-gray-600 mb-6">
        Configure how and when you want to receive meeting summaries via email.
      </p>

      {/* Delivery Timing */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Delivery Timing</h3>
        <div className="space-y-2">
          {["immediate", "daily", "weekly"].map((timing) => (
            <label key={timing} className="flex items-center space-x-3">
              <input
                type="radio"
                name="deliveryTiming"
                value={timing}
                checked={preferences.deliveryTiming === timing}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 border-gray-300"
              />
              <span className="capitalize">{timing}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Content Preferences */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Content to Include</h3>
        <div className="space-y-2">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              name="includeSummary"
              checked={preferences.includeSummary}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 rounded border-gray-300"
            />
            <span>Meeting Summary</span>
          </label>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              name="includeActionItems"
              checked={preferences.includeActionItems}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 rounded border-gray-300"
            />
            <span>Action Items</span>
          </label>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              name="includeTranscript"
              checked={preferences.includeTranscript}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 rounded border-gray-300"
            />
            <span>Transcript Snippet</span>
          </label>
        </div>
      </div>

      <SharedQuietHours
        onQuietHoursChange={(qh) => {
          setPreferences((prev) => ({
            ...prev,
            quietHoursStart:
              qh.quietHoursStart !== "" && qh.quietHoursStart !== null
                ? Number(qh.quietHoursStart)
                : "",
            quietHoursEnd:
              qh.quietHoursEnd !== "" && qh.quietHoursEnd !== null
                ? Number(qh.quietHoursEnd)
                : "",
            timezone: qh.timezone,
          }));
        }}
      />

      <div className="flex space-x-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        <button
          onClick={handlePreview}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded border border-gray-300"
        >
          Preview Email
        </button>
      </div>

      {/* Preview Modal */}
      <Dialog
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        className="fixed z-50 inset-0 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div
            className="fixed inset-0 bg-black opacity-30"
            aria-hidden="true"
          />
          <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true"
          >
            &#8203;
          </span>
          <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-gray-900 mb-4"
                >
                  Email Preview
                </Dialog.Title>
                <div className="mt-2 w-full border rounded p-4 max-h-[60vh] overflow-y-auto bg-gray-50">
                  <SandboxedHtmlPreview
                    htmlContent={previewHtml}
                    title="Email Preview"
                    size="sm"
                    theme="light"
                    loading={previewLoading}
                    error={previewError}
                    onRetry={handlePreview}
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                onClick={() => setIsPreviewOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default RecapPreferences;
