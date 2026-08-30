import React, { useState, useMemo } from "react";
import { toast } from "react-toastify";
import {
  Calculator,
  DollarSign,
  Clock,
  Users,
  Repeat,
  Sparkles,
  TrendingDown,
  Copy,
  Download,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

const FREQUENCY_MULTIPLIERS = {
  once: { label: "One-Time", perMonth: 1 / 12, perYear: 1 },
  daily: { label: "Daily (Workdays)", perMonth: 21.6, perYear: 260 },
  weekly: { label: "Weekly", perMonth: 4.33, perYear: 52 },
  biweekly: { label: "Bi-Weekly", perMonth: 2.16, perYear: 26 },
  monthly: { label: "Monthly", perMonth: 1, perYear: 12 },
  annual: { label: "Annual", perMonth: 1 / 12, perYear: 1 },
};

const PRESETS = {
  oneOnOne: {
    name: "1-on-1 Sync",
    participants: 2,
    durationMinutes: 30,
    hourlyRate: 75,
    frequency: "weekly",
  },
  dailyStandup: {
    name: "Daily Standup",
    participants: 8,
    durationMinutes: 15,
    hourlyRate: 70,
    frequency: "daily",
  },
  sprintPlanning: {
    name: "Sprint Planning",
    participants: 12,
    durationMinutes: 60,
    hourlyRate: 80,
    frequency: "biweekly",
  },
  allHands: {
    name: "Company All-Hands",
    participants: 50,
    durationMinutes: 60,
    hourlyRate: 75,
    frequency: "monthly",
  },
  execSync: {
    name: "Executive Board Sync",
    participants: 5,
    durationMinutes: 60,
    hourlyRate: 160,
    frequency: "weekly",
  },
};

const DEFAULT_TIERS = [
  { id: "exec", name: "Executive / VP", count: 1, rate: 160 },
  { id: "lead", name: "Lead / Manager", count: 2, rate: 110 },
  { id: "senior", name: "Senior Specialist", count: 4, rate: 80 },
  { id: "assoc", name: "Associate", count: 3, rate: 50 },
];

const MeetingCostCalculator = ({ onApplyToMeeting, initialData = {} }) => {
  const [mode, setMode] = useState("quick"); // "quick" | "tiered"
  const [participants, setParticipants] = useState(
    initialData.participants || 6,
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialData.duration || 45,
  );
  const [hourlyRate, setHourlyRate] = useState(initialData.hourlyRate || 75);
  const [currency, setCurrency] = useState(initialData.currency || "USD");
  const [frequency, setFrequency] = useState(initialData.frequency || "weekly");
  const [includePrepTime, setIncludePrepTime] = useState(false);
  const prepMultiplier = includePrepTime ? 1.2 : 1.0;

  // Tiered breakdown state
  const [roleTiers, setRoleTiers] = useState(DEFAULT_TIERS);

  const currencySymbol = useMemo(() => {
    switch (currency) {
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      case "INR":
        return "₹";
      default:
        return "$";
    }
  }, [currency]);

  // Combined calculations
  const calculationResults = useMemo(() => {
    let effectiveTotalHeadcount = 0;
    let effectiveHourlyRateSum = 0;

    if (mode === "quick") {
      effectiveTotalHeadcount = Math.max(1, Number(participants) || 1);
      effectiveHourlyRateSum =
        effectiveTotalHeadcount * (Number(hourlyRate) || 0);
    } else {
      roleTiers.forEach((tier) => {
        const count = Math.max(0, Number(tier.count) || 0);
        const rate = Math.max(0, Number(tier.rate) || 0);
        effectiveTotalHeadcount += count;
        effectiveHourlyRateSum += count * rate;
      });
      if (effectiveTotalHeadcount === 0) effectiveTotalHeadcount = 1;
    }

    const durationHours =
      (Math.max(1, Number(durationMinutes) || 0) / 60) * prepMultiplier;
    const meetingCost = Math.round(effectiveHourlyRateSum * durationHours);
    const avgRatePerPerson = effectiveHourlyRateSum / effectiveTotalHeadcount;
    const costPerAttendee = Math.round(meetingCost / effectiveTotalHeadcount);

    const freqMeta =
      FREQUENCY_MULTIPLIERS[frequency] || FREQUENCY_MULTIPLIERS.weekly;
    const monthlyCost = Math.round(meetingCost * freqMeta.perMonth);
    const annualCost = Math.round(meetingCost * freqMeta.perYear);
    const annualHoursSpent = Math.round(
      durationHours * effectiveTotalHeadcount * freqMeta.perYear,
    );

    // Savings scenarios
    // 1. Shorten duration by 15 mins (min 15 mins)
    const shortenedMins = Math.max(15, Number(durationMinutes) - 15);
    const shortenedHours = (shortenedMins / 60) * prepMultiplier;
    const shortenedMeetingCost = Math.round(
      effectiveHourlyRateSum * shortenedHours,
    );
    const shortenedSavingsPerMeeting = Math.max(
      0,
      meetingCost - shortenedMeetingCost,
    );
    const shortenedAnnualSavings = Math.round(
      shortenedSavingsPerMeeting * freqMeta.perYear,
    );

    // 2. Reduce headcount by 25% (async readers)
    const asyncMeetingCost = Math.round(meetingCost * 0.75);
    const asyncAnnualSavings = Math.round(
      (meetingCost - asyncMeetingCost) * freqMeta.perYear,
    );

    // Risk level
    let riskLevel = {
      label: "Low Impact",
      color:
        "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900",
    };
    if (meetingCost > 2000) {
      riskLevel = {
        label: "Severe Expense",
        color:
          "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
      };
    } else if (meetingCost > 500) {
      riskLevel = {
        label: "High Cost",
        color:
          "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
      };
    } else if (meetingCost > 150) {
      riskLevel = {
        label: "Moderate Expense",
        color:
          "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900",
      };
    }

    return {
      effectiveTotalHeadcount,
      avgRatePerPerson,
      meetingCost,
      costPerAttendee,
      monthlyCost,
      annualCost,
      annualHoursSpent,
      shortenedSavingsPerMeeting,
      shortenedAnnualSavings,
      asyncAnnualSavings,
      riskLevel,
    };
  }, [
    mode,
    participants,
    durationMinutes,
    hourlyRate,
    frequency,
    prepMultiplier,
    roleTiers,
  ]);

  const handleApplyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    setMode("quick");
    setParticipants(preset.participants);
    setDurationMinutes(preset.durationMinutes);
    setHourlyRate(preset.hourlyRate);
    setFrequency(preset.frequency);
    toast.info(`Applied preset: ${preset.name}`);
  };

  const handleAddTier = () => {
    const newId = `tier_${Date.now()}`;
    setRoleTiers([
      ...roleTiers,
      { id: newId, name: "New Role Tier", count: 1, rate: 65 },
    ]);
  };

  const handleUpdateTier = (id, field, value) => {
    setRoleTiers(
      roleTiers.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );
  };

  const handleRemoveTier = (id) => {
    if (roleTiers.length <= 1) {
      toast.warning("Keep at least one role tier.");
      return;
    }
    setRoleTiers(roleTiers.filter((t) => t.id !== id));
  };

  const formatAmount = (num) => {
    return `${currencySymbol}${num.toLocaleString()}`;
  };

  const handleCopySummary = () => {
    const summaryText = `📊 MeetOnMemory Cost Calculation Report
• Meeting Cost: ${formatAmount(calculationResults.meetingCost)} (${calculationResults.effectiveTotalHeadcount} participants, ${durationMinutes} mins)
• Monthly Cost (${FREQUENCY_MULTIPLIERS[frequency].label}): ${formatAmount(calculationResults.monthlyCost)}
• Annual Financial Impact: ${formatAmount(calculationResults.annualCost)}
• Total Annual Time Invested: ${calculationResults.annualHoursSpent} hrs
💡 Potential Savings by shortening by 15 mins: ${formatAmount(calculationResults.shortenedAnnualSavings)}/year`;

    navigator.clipboard.writeText(summaryText);
    toast.success("Summary copied to clipboard!");
  };

  const handleExportCsv = () => {
    const csvContent = `Metric,Value
Participant Count,${calculationResults.effectiveTotalHeadcount}
Duration (mins),${durationMinutes}
Frequency,${FREQUENCY_MULTIPLIERS[frequency].label}
Cost per Meeting,${calculationResults.meetingCost}
Cost per Attendee,${calculationResults.costPerAttendee}
Monthly Cost,${calculationResults.monthlyCost}
Annual Cost,${calculationResults.annualCost}
Annual Hours Invested,${calculationResults.annualHoursSpent}
Shortened 15m Annual Savings,${calculationResults.shortenedAnnualSavings}
Currency,${currency}
`;
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting_cost_calculation_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success("CSV report downloaded!");
  };

  return (
    <div
      data-testid="meeting-cost-calculator"
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-6 lg:p-8"
    >
      {/* Title & Modes Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Calculator className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Meeting Cost Calculator
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Calculate the exact financial spend and time investment of meetings.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMode("quick")}
            data-testid="mode-quick-btn"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "quick"
                ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Quick Estimate
          </button>
          <button
            type="button"
            onClick={() => setMode("tiered")}
            data-testid="mode-tiered-btn"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "tiered"
                ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Role Tier Breakdown
          </button>
        </div>
      </div>

      {/* Scenario Presets Bar */}
      <div className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-2">
          Scenario Presets:
        </span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleApplyPreset(key)}
              data-testid={`preset-${key}`}
              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/60 dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Inputs vs Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Calculator Inputs */}
        <div className="lg:col-span-6 space-y-6">
          {mode === "quick" ? (
            /* Quick Mode Controls */
            <div className="space-y-5">
              {/* Participant Count */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label
                    htmlFor="input-participants"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                  >
                    <Users className="w-4 h-4 text-blue-500" />
                    Participant Count:
                  </label>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-md">
                    {participants} attendees
                  </span>
                </div>
                <input
                  id="input-participants"
                  type="range"
                  min="1"
                  max="100"
                  value={participants}
                  onChange={(e) => setParticipants(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  data-testid="slider-participants"
                />
              </div>

              {/* Duration Minutes */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label
                    htmlFor="input-duration"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                  >
                    <Clock className="w-4 h-4 text-blue-500" />
                    Meeting Duration (Minutes):
                  </label>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-md">
                    {durationMinutes} mins
                  </span>
                </div>
                <input
                  id="input-duration"
                  type="range"
                  min="5"
                  max="180"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  data-testid="slider-duration"
                />
              </div>

              {/* Hourly Rate & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="input-hourly-rate"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Average Hourly Rate ({currencySymbol}/hr):
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                      {currencySymbol}
                    </span>
                    <input
                      id="input-hourly-rate"
                      type="number"
                      min="1"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      data-testid="input-hourly-rate"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="select-currency"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Currency:
                  </label>
                  <select
                    id="select-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    data-testid="select-currency"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* Tiered Mode Breakdown */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Attendee Roles & Salary Tiers:
                </span>
                <button
                  type="button"
                  onClick={handleAddTier}
                  data-testid="add-tier-btn"
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Role Tier
                </button>
              </div>

              <div className="space-y-3">
                {roleTiers.map((tier) => (
                  <div
                    key={tier.id}
                    data-testid={`tier-row-${tier.id}`}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/40 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) =>
                        handleUpdateTier(tier.id, "name", e.target.value)
                      }
                      placeholder="Role Title"
                      className="flex-1 p-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={tier.count}
                          onChange={(e) =>
                            handleUpdateTier(
                              tier.id,
                              "count",
                              Number(e.target.value),
                            )
                          }
                          className="w-16 p-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">
                          {currencySymbol}/hr:
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={tier.rate}
                          onChange={(e) =>
                            handleUpdateTier(
                              tier.id,
                              "rate",
                              Number(e.target.value),
                            )
                          }
                          className="w-20 p-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTier(tier.id)}
                        className="p-1 text-red-500 hover:text-red-700 text-xs"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shared Options: Frequency & Prep Time */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <label
                htmlFor="select-frequency"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5"
              >
                <Repeat className="w-4 h-4 text-blue-500" />
                Meeting Schedule Frequency:
              </label>
              <select
                id="select-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                data-testid="select-frequency"
              >
                {Object.entries(FREQUENCY_MULTIPLIERS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includePrepTime}
                onChange={(e) => setIncludePrepTime(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                data-testid="checkbox-prep-time"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                Include Prep & Follow-up Time (+20% overhead)
              </span>
            </label>
          </div>
        </div>

        {/* Right Column: Financial Results Dashboard */}
        <div className="lg:col-span-6 bg-gray-50/70 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between space-y-6">
          <div>
            {/* Top Financial Stat */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Cost per Meeting
                </span>
                <div
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mt-1"
                  data-testid="result-meeting-cost"
                >
                  {formatAmount(calculationResults.meetingCost)}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${calculationResults.riskLevel.color}`}
                data-testid="risk-badge"
              >
                {calculationResults.riskLevel.label}
              </span>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Cost / Attendee
                </span>
                <p
                  className="text-lg font-bold text-gray-900 dark:text-white mt-0.5"
                  data-testid="result-cost-per-attendee"
                >
                  {formatAmount(calculationResults.costPerAttendee)}
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Monthly Impact
                </span>
                <p
                  className="text-lg font-bold text-gray-900 dark:text-white mt-0.5"
                  data-testid="result-monthly-cost"
                >
                  {formatAmount(calculationResults.monthlyCost)}
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Annualized Spend
                </span>
                <p
                  className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5"
                  data-testid="result-annual-cost"
                >
                  {formatAmount(calculationResults.annualCost)}
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Annual Hours Spent
                </span>
                <p
                  className="text-lg font-bold text-gray-900 dark:text-white mt-0.5"
                  data-testid="result-annual-hours"
                >
                  {calculationResults.annualHoursSpent} hrs
                </p>
              </div>
            </div>

            {/* Savings & Optimization Insights */}
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Optimization Opportunities</span>
              </div>
              <ul className="space-y-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                <li className="flex items-center justify-between">
                  <span>Shorten by 15 mins:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    Save{" "}
                    {formatAmount(calculationResults.shortenedAnnualSavings)}/yr
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Convert 25% attendees to Async Summary:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    Save {formatAmount(calculationResults.asyncAnnualSavings)}
                    /yr
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Buttons: Copy / Export / Apply */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleCopySummary}
              data-testid="copy-summary-btn"
              className="flex-1 py-2 px-3 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Report
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              data-testid="export-csv-btn"
              className="flex-1 py-2 px-3 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            {onApplyToMeeting && (
              <button
                type="button"
                onClick={() => onApplyToMeeting(calculationResults)}
                data-testid="apply-to-meeting-btn"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Apply Calculation to Meeting
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingCostCalculator;
