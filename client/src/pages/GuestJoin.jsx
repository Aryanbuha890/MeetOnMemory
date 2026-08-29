import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getGuestMeetingData,
  recordGuestJoin,
} from "../services/guestAccessApi";

const GuestJoin = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        const data = await getGuestMeetingData(token);
        setMeetingTitle(data.meeting.title);
        setMeetingDate(data.meeting.date);
      } catch (err) {
        setError(
          err.response?.data?.error || "Invalid or expired guest token.",
        );
      } finally {
        setLoading(false);
      }
    };
    if (token) {
      fetchPreview();
    }
  }, [token]);

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      await recordGuestJoin(token);
    } catch (err) {
      console.warn("Could not record guest join metric", err);
    }
    // Redirect to the actual guest meeting view page
    navigate(`/guest/${token}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-indigo-950 to-purple-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-indigo-950 to-purple-950 flex items-center justify-center p-6">
        <div className="bg-slate-900/80 backdrop-blur-md p-8 rounded-2xl border border-red-500/20 text-center max-w-md w-full shadow-2xl">
          <h2 className="text-2xl font-bold text-red-500 mb-4">
            Access Denied
          </h2>
          <p className="text-gray-300 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-indigo-950 to-purple-950 flex items-center justify-center p-6">
      <div className="bg-slate-900/80 backdrop-blur-md p-8 rounded-2xl border border-indigo-500/20 max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Join Meeting as Guest
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Enter meeting room using your secure access invite.
          </p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-indigo-500/10 text-center">
          <h3 className="font-semibold text-white text-base">{meetingTitle}</h3>
          <p className="text-indigo-400 text-xs mt-1">
            {new Date(meetingDate).toLocaleString()}
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Confirm Guest Email Address
            </label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-white text-sm outline-none transition-colors"
              placeholder="your.email@example.com"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-medium transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-600/30"
          >
            Enter Meeting Room
          </button>
        </form>
      </div>
    </div>
  );
};

export default GuestJoin;
