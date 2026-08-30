import React from "react";
import Navbar from "../components/Navbar.jsx";
import TranscriptSearchPanel from "../components/transcripts/TranscriptSearchPanel.jsx";

const TranscriptSearchPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex-1 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-4rem)]">
          <TranscriptSearchPanel />
        </div>
      </div>
    </div>
  );
};

export default TranscriptSearchPage;
