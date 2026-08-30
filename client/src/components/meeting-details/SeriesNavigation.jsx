import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { meetingSeriesApi, apiClient as api } from "../../services";
import MeetingDiffView from "../meetings/MeetingDiffView";
import { Loader, X } from "lucide-react";

const SeriesNavigation = ({ meeting }) => {
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffData, setDiffData] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const seriesId =
    meeting?.series?._id || meeting?.series || meeting?.seriesId || null;

  useEffect(() => {
    if (!seriesId) return;

    const fetchSeriesData = async () => {
      try {
        setLoading(true);
        const [seriesRes, meetingsRes] = await Promise.all([
          meetingSeriesApi.getSeriesById(seriesId),
          // Fetch complete series meetings without artificial 100 limit restriction (issue #915)
          meetingSeriesApi.getSeriesMeetings(seriesId, 1, 0),
        ]);

        if (seriesRes.data?.success) {
          setSeries(seriesRes.data.series);
        }
        if (meetingsRes.data?.success) {
          const list = meetingsRes.data.meetings || [];
          setMeetings(list);
          setTotalCount(meetingsRes.data.pagination?.total || list.length);
        }
      } catch (error) {
        console.error("Failed to fetch series data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSeriesData();
  }, [seriesId]);

  if (!seriesId) return null;
  if (loading) {
    return (
      <div className="mb-6 h-16 animate-pulse rounded-xl bg-gray-100 p-4 dark:bg-gray-800"></div>
    );
  }
  if (!series || meetings.length === 0) return null;

  const currentIndex = meetings.findIndex((m) => m._id === meeting._id);
  const prevMeeting = currentIndex > 0 ? meetings[currentIndex - 1] : null;
  const nextMeeting =
    currentIndex !== -1 && currentIndex < meetings.length - 1
      ? meetings[currentIndex + 1]
      : null;

  const displayOccurrence =
    meeting.seriesOccurrence || (currentIndex !== -1 ? currentIndex + 1 : 1);
  const displayTotal = totalCount || meetings.length;

  const handleCompare = async () => {
    if (!prevMeeting) return;
    setShowDiffModal(true);
    if (!diffData) {
      setLoadingDiff(true);
      try {
        const response = await api.get(
          `/api/series-diff/compare?m1Id=${prevMeeting._id}&m2Id=${meeting._id}`,
        );
        setDiffData(response.data);
      } catch (error) {
        console.error("Failed to load diff:", error);
      } finally {
        setLoadingDiff(false);
      }
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-center gap-3 text-blue-900 dark:text-blue-100">
          <svg
            className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <div>
            <h4 className="font-semibold">{series.title} (Recurring Series)</h4>
            <p className="text-sm opacity-80">
              Meeting {displayOccurrence} of {displayTotal}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="series-occurrence-select">
            Jump to series occurrence
          </label>
          <select
            id="series-occurrence-select"
            value={meeting._id}
            onChange={(e) => {
              if (e.target.value && e.target.value !== meeting._id) {
                navigate(`/meeting/${e.target.value}`);
              }
            }}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300"
          >
            {meetings.map((m, index) => (
              <option key={m._id} value={m._id}>
                Occurrence {m.seriesOccurrence || index + 1}
              </option>
            ))}
          </select>
          <Link
            to={`/meeting-series/${seriesId}/retrospective`}
            className="rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:border-indigo-700"
          >
            Series Retrospective
          </Link>
          {prevMeeting && (
            <button
              type="button"
              onClick={handleCompare}
              className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50"
            >
              Compare to Previous
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              prevMeeting && navigate(`/meeting/${prevMeeting._id}`)
            }
            disabled={!prevMeeting}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-gray-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Previous
          </button>
          <button
            type="button"
            onClick={() =>
              nextMeeting && navigate(`/meeting/${nextMeeting._id}`)
            }
            disabled={!nextMeeting}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-gray-700"
          >
            Next
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {showDiffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Compare to Previous Meeting
              </h2>
              <button
                onClick={() => setShowDiffModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {loadingDiff ? (
                <div className="flex justify-center p-12">
                  <Loader className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <MeetingDiffView diffData={diffData} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SeriesNavigation;
