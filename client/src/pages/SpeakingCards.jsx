import React from "react";
import {
  Mic,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Eye,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
  Zap,
  BarChart3,
  Timer,
} from "lucide-react";
import { BALANCE_CONFIG, ROLE_CONFIG, BalanceRating } from "./speakingTypes";

const ICON_MAP = {
  Mic,
  Users,
  Clock,
  Crown,
  Eye,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
  Zap,
  BarChart3,
  Timer,
};

/* ─── Metric Card ──────────────────────────────────────────────────── */
export function SpeakingMetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  delta,
  color = "#22c55e",
}) {
  const isPositive =
    delta && (typeof delta === "string" ? delta.startsWith("+") : delta > 0);
  const deltaColor = isPositive
    ? "text-emerald-600"
    : delta
      ? "text-red-500"
      : "";

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white leading-tight">
            {value}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
          {delta !== undefined && delta !== null && (
            <p className={`mt-1 text-xs font-semibold ${deltaColor}`}>
              {delta}
            </p>
          )}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Speaker Card ─────────────────────────────────────────────────── */
export function SpeakerCard({ member, maxPercent }) {
  const barWidth = (member.speakingPercent / maxPercent) * 100;
  const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.participant;

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-violet-500 text-white text-sm font-bold">
          {member.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">
            {member.name}
          </p>
          <p className="text-[10px] text-slate-400">{member.department}</p>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[9px] font-semibold"
          style={{
            backgroundColor: `${roleConfig.color}20`,
            color: roleConfig.color,
          }}
        >
          {roleConfig.label}
        </span>
      </div>

      {/* Speaking Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-slate-500">Speaking Time</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {member.speakingPercent}% · {member.speakingMinutes.toFixed(1)}min
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${barWidth}%`, backgroundColor: roleConfig.color }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-1.5 bg-slate-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {member.avgTurnLength.toFixed(1)}
          </p>
          <p className="text-[8px] text-slate-400 uppercase">Avg Turn</p>
        </div>
        <div className="text-center p-1.5 bg-slate-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {member.interruptions}
          </p>
          <p className="text-[8px] text-slate-400 uppercase">Interrupts</p>
        </div>
        <div className="text-center p-1.5 bg-slate-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {member.questionsAsked}
          </p>
          <p className="text-[8px] text-slate-400 uppercase">Questions</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Balance Score Card ───────────────────────────────────────────── */
export function BalanceScoreCard({ score, rating }) {
  const config = BALANCE_CONFIG[rating] || {};
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm text-center">
      <div
        className="relative mx-auto mb-3"
        style={{ width: 120, height: 120 }}
      >
        <svg width={120} height={120} className="-rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
            className="dark:stroke-gray-700"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={config.color || "#6b7280"}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {score}
          </span>
          <span className={`text-[10px] font-semibold ${config.textColor}`}>
            {config.emoji} {config.label}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-gray-400">
        {config.description}
      </p>
    </div>
  );
}

/* ─── Pattern Card ─────────────────────────────────────────────────── */
export function PatternCard({ pattern }) {
  const growthColor =
    pattern.speakingGrowth > 0
      ? "text-emerald-500"
      : pattern.speakingGrowth < 0
        ? "text-red-500"
        : "text-gray-400";

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-violet-500 text-white text-xs font-bold">
          {pattern.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">
            {pattern.name}
          </p>
          <p className="text-[10px] text-slate-400">{pattern.department}</p>
        </div>
        <span className={`text-xs font-bold ${growthColor}`}>
          {pattern.speakingGrowth > 0 ? "+" : ""}
          {pattern.speakingGrowth.toFixed(0)}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-slate-50 dark:bg-gray-700/50 rounded-lg text-center">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {pattern.avgWordsPerTurn.toFixed(0)}
          </p>
          <p className="text-[8px] text-slate-400 uppercase">Words/Turn</p>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-gray-700/50 rounded-lg text-center">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {pattern.avgTurnsPerMeeting.toFixed(0)}
          </p>
          <p className="text-[8px] text-slate-400 uppercase">Turns/Meeting</p>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-gray-700/50 rounded-lg text-center">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {pattern.listeningScore}
          </p>
          <p className="text-[8px] text-slate-400 uppercase">Listening</p>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-gray-700/50 rounded-lg text-center">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {pattern.collaborationScore}
          </p>
          <p className="text-[8px] text-slate-400 uppercase">Collaboration</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Recommendation Card ──────────────────────────────────────────── */
export function SpeakingRecommendationCard({ recommendation }) {
  const impactColors = {
    high: {
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    medium: {
      bg: "bg-amber-50 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
    },
    low: {
      bg: "bg-sky-50 dark:bg-sky-900/30",
      text: "text-sky-700 dark:text-sky-300",
      border: "border-sky-200 dark:border-sky-800",
    },
  };
  const colors = impactColors[recommendation.impact] || impactColors.low;

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30">
            <Lightbulb className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">
            {recommendation.title}
          </h3>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${colors.bg} ${colors.text} border ${colors.border}`}
        >
          {recommendation.impact}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-3">
        {recommendation.description}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-violet-600">
            +{recommendation.estimatedImprovement}%
          </span>
          <span className="text-[10px] text-slate-400">
            balance improvement
          </span>
        </div>
        <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-gray-700 rounded text-slate-500">
          {recommendation.category}
        </span>
      </div>
    </div>
  );
}
