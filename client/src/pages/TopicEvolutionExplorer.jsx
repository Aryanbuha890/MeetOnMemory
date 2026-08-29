import React from "react";
import Navbar from "../components/Navbar.jsx";
import TopicEvolutionExplorer from "../components/topics/TopicEvolutionExplorer.jsx";
import { TrendingUp, Layers, Activity } from "lucide-react";
import { Link } from "react-router-dom";

const TopicEvolutionExplorerPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Cross-Meeting Topic Evolution Explorer
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Track how important organizational topics, consensus, and action
                items evolve across meetings over time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/topics"
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-4 h-4 text-blue-500" />
              Topic Clusters
            </Link>
            <Link
              to="/topic-intelligence"
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
            >
              <Activity className="w-4 h-4 text-emerald-500" />
              Topic Intelligence
            </Link>
          </div>
        </div>

        {/* Explorer Component */}
        <TopicEvolutionExplorer />
      </main>
    </div>
  );
};

export default TopicEvolutionExplorerPage;
