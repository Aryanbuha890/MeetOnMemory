import React from "react";
import Navbar from "../components/Navbar.jsx";
import MeetingCostCalculator from "../components/meetings/MeetingCostCalculator.jsx";
import { DollarSign, PieChart, ShieldAlert, Sparkles } from "lucide-react";

const MeetingCostCalculatorPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Hero */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <DollarSign className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Interactive Meeting Cost Calculator
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Evaluate financial spend, uncover hidden meeting costs, and
                explore async alternatives.
              </p>
            </div>
          </div>
        </div>

        {/* Embedded Calculator */}
        <MeetingCostCalculator />

        {/* Guide & Best Practices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm">
              <PieChart className="w-4 h-4" />
              <span>Full Salary Cost Accounting</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Factor in direct compensation, prep overhead, and headcount to
              understand the true financial investment of every agenda item.
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Async Minutes & Summaries</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Use MeetOnMemory automated AI minutes to keep non-essential
              stakeholders informed asynchronously without requiring live
              attendance.
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
              <ShieldAlert className="w-4 h-4" />
              <span>Meeting Waste Prevention</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Set agenda goals and budget thresholds to ensure every meeting
              produces measurable action items and decisions.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MeetingCostCalculatorPage;
