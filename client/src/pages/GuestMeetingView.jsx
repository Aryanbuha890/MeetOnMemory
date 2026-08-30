import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getGuestMeetingData,
  addGuestComment,
  submitGuestFeedback,
} from "../services/guestAccessApi";
import { Star } from "lucide-react";

const GuestMeetingView = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("");
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Guest Feedback form state
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await getGuestMeetingData(token);
        setData(result);

        if (result.guestEmail) {
          setGuestName(result.guestEmail);
        }

        // Determine default tab based on permissions
        if (result.permissions.includes("view_summary") && result.aiSummary)
          setActiveTab("summary");
        else if (
          result.permissions.includes("view_transcript") &&
          result.transcript
        )
          setActiveTab("transcript");
        else if (
          result.permissions.includes("view_action_items") &&
          result.actionItems
        )
          setActiveTab("actionItems");
      } catch (err) {
        setError(err.response?.data?.error || "Invalid or expired token.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      setSubmittingComment(true);
      await addGuestComment(token, { body: comment });
      toast.success("Comment added successfully!");
      setComment("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmittingFeedback(true);
      await submitGuestFeedback(token, {
        rating,
        comments: feedbackComment,
        guestName: guestName || data?.guestEmail || "Anonymous Guest",
      });
      toast.success("Thank you for your feedback!");
      setFeedbackSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading meeting data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-red-200 text-center max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    meeting,
    permissions,
    guestEmail,
    aiSummary,
    transcript,
    actionItems,
  } = data;
  const canComment = permissions.includes("add_comments");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
          <p className="text-sm text-gray-500">
            {new Date(meeting.date).toLocaleString()} • Guest Access:{" "}
            {guestEmail}
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <div className="flex space-x-4 border-b border-gray-200 pb-2">
            {permissions.includes("view_summary") && aiSummary && (
              <button
                onClick={() => setActiveTab("summary")}
                className={`pb-2 px-2 text-sm font-medium ${activeTab === "summary" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                Summary
              </button>
            )}
            {permissions.includes("view_transcript") && transcript && (
              <button
                onClick={() => setActiveTab("transcript")}
                className={`pb-2 px-2 text-sm font-medium ${activeTab === "transcript" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                Transcript
              </button>
            )}
            {permissions.includes("view_action_items") && actionItems && (
              <button
                onClick={() => setActiveTab("actionItems")}
                className={`pb-2 px-2 text-sm font-medium ${activeTab === "actionItems" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                Action Items
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {activeTab === "summary" && (
              <div>
                <h3 className="text-lg font-bold mb-4">AI Summary</h3>
                <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                  {aiSummary}
                </div>
              </div>
            )}

            {activeTab === "transcript" && (
              <div>
                <h3 className="text-lg font-bold mb-4">Transcript</h3>
                {transcript.map((t, idx) => (
                  <div key={idx} className="mb-4">
                    <span className="font-semibold text-gray-900">
                      {t.speaker || "Unknown"}:{" "}
                    </span>
                    <span className="text-gray-700">{t.text}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "actionItems" && (
              <div>
                <h3 className="text-lg font-bold mb-4">Action Items</h3>
                <ul className="space-y-3">
                  {actionItems.map((item) => (
                    <li
                      key={item._id}
                      className="p-4 border border-gray-200 rounded-md bg-gray-50 flex items-start gap-3"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        readOnly
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{item.task}</p>
                        <p className="text-sm text-gray-500">
                          Assignee: {item.assignee || "Unassigned"}
                        </p>
                      </div>
                    </li>
                  ))}
                  {actionItems.length === 0 && (
                    <p className="text-gray-500">No action items found.</p>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="w-full md:w-80 space-y-6">
          {/* Guest Feedback Widget */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 mb-1">Session Feedback</h3>
            <p className="text-xs text-gray-500 mb-3">
              Rate your experience for the meeting host.
            </p>
            {feedbackSubmitted ? (
              <p className="text-xs font-semibold text-green-700 bg-green-50 p-3 rounded-md">
                ✓ Feedback submitted. Thank you!
              </p>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Rating (1-5 Stars)
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 focus:outline-none"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= rating
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Comments / Feedback
                  </label>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs resize-none outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Share your thoughts on the meeting..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md transition disabled:opacity-50"
                >
                  {submittingFeedback ? "Submitting..." : "Submit Feedback"}
                </button>
              </form>
            )}
          </div>

          {canComment && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-24">
              <h3 className="font-bold text-gray-900 mb-2">Leave a Comment</h3>
              <p className="text-xs text-gray-500 mb-4">
                Your comment will be visible to meeting organizers.
              </p>
              <form onSubmit={handleAddComment}>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                  placeholder="Type your note here..."
                  required
                />
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
                >
                  {submittingComment ? "Posting..." : "Post Comment"}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GuestMeetingView;
