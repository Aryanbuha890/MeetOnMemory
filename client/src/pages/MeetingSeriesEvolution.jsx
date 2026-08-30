import React from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Navbar from "../components/Navbar";
import SeriesEvolutionTimeline from "../components/meetings/SeriesEvolutionTimeline";

const MeetingSeriesEvolution = () => {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6">
        <div className="mb-6">
          <Link
            to="/meeting-series"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Series
          </Link>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Series Evolution
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
            Track how meetings in this series have changed over time.
          </p>
        </div>

        <SeriesEvolutionTimeline seriesId={id} />
      </div>
    </div>
  );
};

export default MeetingSeriesEvolution;
