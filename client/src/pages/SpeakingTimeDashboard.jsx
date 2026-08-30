import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Lightbulb,
  MessageSquare,
  Mic,
  RefreshCw,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  SpeakingMetricCard,
  SpeakerCard,
  BalanceScoreCard,
  PatternCard,
  SpeakingRecommendationCard,
} from "./SpeakingCards";
import {
  SpeakingDistributionPie,
  BalanceTrendChart,
  PatternRadarChart,
} from "./SpeakingCharts";
import { speakingTimeApi } from "../services";
import { BalanceRating } from "./speakingTypes";
import { toast } from "react-toastify";

const TABS = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "speakers", label: "Speakers", icon: Users },
  { key: "patterns", label: "Patterns", icon: MessageSquare },
  { key: "improvements", label: "Improvements", icon: Lightbulb },
];

const EMPTY_BREAKDOWN = {
  meetingSpan: 0,
  totalDuration: 0,
  participants: [],
};

const EMPTY_TRENDS = [];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatHours = (seconds) => {
  const hours = Math.max(0, toNumber(seconds)) / 3600;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
};

const getBalanceRating = (score) => {
  if (score >= 85) return BalanceRating.EXCELLENT;
  if (score >= 70) return BalanceRating.GOOD;
  if (score >= 45) return BalanceRating.BIASED;
  return BalanceRating.DOMINATED;
};

const getAvatar = (name = "Unknown") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

/**
 * The API currently exposes per-speaker talk ratios rather than a separate
 * dashboard balance endpoint. A fair balance score can therefore be derived
 * from the distance between the observed distribution and an even split.
 */
const calculateBalanceScore = (participants) => {
  if (!participants.length) return 0;
  const active = participants.filter(
    (participant) => participant.totalDuration > 0,
  );
  if (active.length <= 1) return active.length ? 35 : 0;

  const expected = 100 / active.length;
  const deviation =
    active.reduce(
      (sum, participant) =>
        sum + Math.abs(toNumber(participant.talkRatio) - expected),
      0,
    ) / active.length;

  return Math.round(clamp(100 - deviation * 1.8, 0, 100));
};

const normalizeParticipant = (participant, totalDuration) => {
  const duration = Math.max(0, toNumber(participant.totalDuration));
  const utteranceCount = Math.max(0, toNumber(participant.utteranceCount));
  const talkRatio = toNumber(
    participant.talkRatio,
    totalDuration > 0 ? (duration / totalDuration) * 100 : 0,
  );
  const averageTurnSeconds = utteranceCount > 0 ? duration / utteranceCount : 0;
  const speakerName = participant.speakerName || "Unknown speaker";

  return {
    ...participant,
    id: participant.identifier || speakerName,
    name: speakerName,
    avatar: getAvatar(speakerName),
    role: "participant",
    department: "Meeting participant",
    speakingMinutes: duration / 60,
    speakingPercent: Number(Math.max(0, talkRatio).toFixed(1)),
    interruptions: Math.max(0, toNumber(participant.overlapCount)),
    avgTurnLength: averageTurnSeconds / 60,
    longestTurn: 0,
    questionsAsked: 0,
    questionsAnswered: 0,
    interruptionsReceived: 0,
  };
};

const normalizeTrend = (item, index) => {
  const talkRatio = clamp(toNumber(item.talkRatio), 0, 100);
  const balanceScore = Math.round(
    clamp(100 - Math.abs(50 - talkRatio) * 1.5, 0, 100),
  );
  const date = item.date ? new Date(item.date) : null;
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null;

  return {
    ...item,
    week: validDate
      ? validDate.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : `Meeting ${index + 1}`,
    balanceScore,
    interruptionRate: toNumber(item.overlapCount),
    avgTurnLength:
      toNumber(item.utteranceCount) > 0
        ? toNumber(item.totalDuration) / toNumber(item.utteranceCount) / 60
        : 0,
    totalSpeakingMinutes: toNumber(item.totalDuration) / 60,
  };
};

const buildPatterns = (participants) =>
  participants.map((participant) => {
    const turnCount = Math.max(1, toNumber(participant.utteranceCount));
    const averageTurnSeconds = toNumber(participant.totalDuration) / turnCount;
    const interruptionRate = toNumber(participant.overlapCount) / turnCount;
    const listeningScore = clamp(
      Math.round(
        100 - toNumber(participant.talkRatio) * 0.65 - interruptionRate * 10,
      ),
      0,
      100,
    );
    const collaborationScore = clamp(
      Math.round(
        100 -
          Math.abs(toNumber(participant.talkRatio) - 25) * 1.2 -
          interruptionRate * 8,
      ),
      0,
      100,
    );

    return {
      ...participant,
      avgWordsPerTurn: 0,
      avgTurnsPerMeeting: turnCount,
      longestMonologue:
        Math.max(0, toNumber(participant.longestUtterance)) / 60,
      questionToStatementRatio: 0,
      interruptionTendency: interruptionRate,
      listeningScore,
      collaborationScore,
      speakingGrowth: 0,
      avgTurnLength: averageTurnSeconds / 60,
    };
  });

const buildRecommendations = (participants, balanceScore) => {
  const sorted = [...participants].sort(
    (left, right) => toNumber(right.talkRatio) - toNumber(left.talkRatio),
  );
  const dominant = sorted[0];
  const quiet = [...participants]
    .filter((participant) => toNumber(participant.totalDuration) > 0)
    .sort(
      (left, right) => toNumber(left.talkRatio) - toNumber(right.talkRatio),
    )[0];
  const recommendations = [];

  if (dominant && toNumber(dominant.talkRatio) >= 40) {
    recommendations.push({
      id: "dominance",
      title: "Introduce structured turn-taking",
      description: `${dominant.name} accounts for ${dominant.talkRatio.toFixed(1)}% of recorded speaking time. Use round-robin prompts or explicit handoffs to widen participation.`,
      impact: "high",
      category: "Facilitation",
      estimatedImprovement: Math.round(clamp(dominant.talkRatio - 30, 5, 25)),
    });
  }

  if (quiet && toNumber(quiet.talkRatio) < 10) {
    recommendations.push({
      id: "quiet-participants",
      title: "Create space for quieter participants",
      description: `${quiet.name} contributes only ${quiet.talkRatio.toFixed(1)}% of recorded speaking time. Add direct invitations to contribute and short reflection pauses.`,
      impact: "high",
      category: "Inclusion",
      estimatedImprovement: Math.round(clamp(15 - quiet.talkRatio, 5, 15)),
    });
  }

  const interrupted = participants.reduce(
    (sum, participant) => sum + toNumber(participant.overlapCount),
    0,
  );
  if (interrupted > 0) {
    recommendations.push({
      id: "interruptions",
      title: "Reduce overlapping speech",
      description: `${interrupted} overlapping speaking events were recorded in the latest meeting. Encourage hand-raising, pauses between turns, or a facilitator queue.`,
      impact: interrupted >= 5 ? "high" : "medium",
      category: "Turn-taking",
      estimatedImprovement: Math.round(clamp(interrupted * 2, 5, 18)),
    });
  }

  if (balanceScore < 70) {
    recommendations.push({
      id: "balance",
      title: "Review the next meeting agenda",
      description:
        "The latest distribution is below the dashboard's good-balance threshold. Break long agenda sections into smaller discussion rounds and assign clear owners.",
      impact: "medium",
      category: "Structure",
      estimatedImprovement: Math.round(clamp(70 - balanceScore, 5, 20)),
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: "maintain",
      title: "Maintain the current balance",
      description:
        "The latest speaking distribution is healthy and does not show a clear dominance or interruption pattern. Continue using the meeting practices already in place.",
      impact: "low",
      category: "Facilitation",
      estimatedImprovement: 0,
    });
  }

  return recommendations;
};

const ErrorState = ({ message, onRetry }) => (
  <div
    role="alert"
    className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-6"
  >
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="flex-1">
        <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">
          Unable to load speaking time analytics
        </h2>
        <p className="mt-1 text-sm text-red-700 dark:text-red-300">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    </div>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center shadow-sm">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/30">
      <Mic className="h-6 w-6 text-violet-600 dark:text-violet-400" />
    </div>
    <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
      {title}
    </h2>
    <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500 dark:text-gray-400">
      {description}
    </p>
  </div>
);

const LoadingState = () => (
  <div
    role="status"
    aria-live="polite"
    className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center shadow-sm"
  >
    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-violet-600" />
    <p className="mt-3 text-sm font-medium text-slate-700 dark:text-gray-300">
      Loading speaking time analytics…
    </p>
  </div>
);

const SpeakingTimeDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [breakdown, setBreakdown] = useState(EMPTY_BREAKDOWN);
  const [trends, setTrends] = useState(EMPTY_TRENDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const trendsResponse = await speakingTimeApi.getTrends(12);
      const trendData = trendsResponse?.data?.data;

      if (!trendsResponse?.data?.success || !Array.isArray(trendData)) {
        throw new Error(
          trendsResponse?.data?.message ||
            "The speaking trends response was invalid.",
        );
      }

      const normalizedTrends = trendData.map(normalizeTrend);
      setTrends(normalizedTrends);

      const latestMeeting = trendData[trendData.length - 1];
      if (!latestMeeting?.meetingId) {
        setBreakdown(EMPTY_BREAKDOWN);
        setLastUpdated(new Date());
        return;
      }

      const breakdownResponse = await speakingTimeApi.getBreakdown(
        latestMeeting.meetingId,
      );
      const breakdownData = breakdownResponse?.data?.data;

      if (!breakdownResponse?.data?.success || !breakdownData) {
        throw new Error(
          breakdownResponse?.data?.message ||
            "The speaking breakdown response was invalid.",
        );
      }

      setBreakdown({
        meetingSpan: Math.max(0, toNumber(breakdownData.meetingSpan)),
        totalDuration: Math.max(0, toNumber(breakdownData.totalDuration)),
        participants: Array.isArray(breakdownData.participants)
          ? breakdownData.participants
          : [],
      });
      setLastUpdated(new Date());
    } catch (requestError) {
      console.error("Error loading speaking time dashboard:", requestError);
      const message =
        requestError?.response?.data?.message ||
        requestError?.message ||
        "An unexpected error occurred while loading speaking time analytics.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const participants = useMemo(
    () =>
      breakdown.participants.map((participant) =>
        normalizeParticipant(participant, breakdown.totalDuration),
      ),
    [breakdown],
  );

  const activeParticipants = useMemo(
    () => participants.filter((participant) => participant.speakingMinutes > 0),
    [participants],
  );

  const balanceScore = useMemo(
    () => calculateBalanceScore(participants),
    [participants],
  );

  const balanceRating = getBalanceRating(balanceScore);

  const patterns = useMemo(() => buildPatterns(participants), [participants]);
  const recommendations = useMemo(
    () => buildRecommendations(participants, balanceScore),
    [participants, balanceScore],
  );

  const maxPercent = useMemo(
    () =>
      Math.max(
        1,
        ...participants.map((participant) => participant.speakingPercent),
      ),
    [participants],
  );

  const totalImprovement = recommendations.reduce(
    (sum, recommendation) => sum + recommendation.estimatedImprovement,
    0,
  );

  const latestMeeting = trends[trends.length - 1];
  const previousMeeting = trends.length > 1 ? trends[trends.length - 2] : null;
  const trendDelta = previousMeeting
    ? latestMeeting.talkRatio - previousMeeting.talkRatio
    : null;

  const summaryStats = useMemo(() => {
    const totalTurns = participants.reduce(
      (sum, participant) => sum + toNumber(participant.utteranceCount),
      0,
    );
    const averageTurnSeconds =
      totalTurns > 0 ? breakdown.totalDuration / totalTurns : 0;
    return {
      totalTurns,
      averageTurnSeconds,
      meetingCount: trends.length,
      totalSpeakingHours: breakdown.totalDuration / 3600,
    };
  }, [participants, breakdown.totalDuration, trends.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-28 sm:px-6 lg:px-8">
          <LoadingState />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <section className="mb-6 sm:mb-8">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="h-1 bg-linear-to-r from-violet-600 via-pink-600 to-rose-600" />
            <div className="px-5 py-7 sm:px-8 sm:py-9">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
                    <Mic className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                      Speaking Time Analytics
                    </h1>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">
                      Live speaking patterns, participation balance, and recent
                      meeting trends
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lastUpdated && (
                    <span className="text-[11px] text-slate-400 dark:text-gray-500">
                      Updated{" "}
                      {lastUpdated.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={loadDashboard}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </button>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    API Connected
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6">
            <ErrorState message={error} onRetry={loadDashboard} />
          </div>
        )}

        {!error && trends.length === 0 && participants.length === 0 ? (
          <EmptyState
            title="No speaking-time data yet"
            description="Speaking analytics will appear here after a meeting with an available transcript has been processed."
          />
        ) : (
          <>
            <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 sm:mb-8">
              <SpeakingMetricCard
                icon={Mic}
                label="Balance Score"
                value={`${balanceScore}/100`}
                subtitle={balanceRating}
                color="#8b5cf6"
              />
              <SpeakingMetricCard
                icon={Timer}
                label="Avg Turn Length"
                value={`${(summaryStats.averageTurnSeconds / 60).toFixed(1)}m`}
                subtitle={`${summaryStats.totalTurns} recorded turns`}
                color="#0ea5e9"
              />
              <SpeakingMetricCard
                icon={Clock}
                label="Latest Speaking"
                value={formatHours(breakdown.totalDuration)}
                subtitle="latest meeting transcript"
                color="#22c55e"
              />
              <SpeakingMetricCard
                icon={Users}
                label="Speakers"
                value={activeParticipants.length}
                subtitle={`${summaryStats.meetingCount} recent meetings`}
                color="#f59e0b"
              />
            </section>

            <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-gray-800">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    aria-selected={activeTab === tab.key}
                    role="tab"
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      activeTab === tab.key
                        ? "bg-white text-slate-900 shadow-sm dark:bg-gray-700 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-1">
                    <BalanceScoreCard
                      score={balanceScore}
                      rating={balanceRating}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    {participants.length ? (
                      <SpeakingDistributionPie data={participants} />
                    ) : (
                      <EmptyState
                        title="No speaker breakdown for the latest meeting"
                        description="The trends endpoint returned meetings, but the latest meeting does not have transcript speaker data yet."
                      />
                    )}
                  </div>
                </div>

                {trends.length ? (
                  <BalanceTrendChart data={trends} />
                ) : (
                  <EmptyState
                    title="No trend history"
                    description="Trend data will appear once the speaking-time API has processed recent meetings."
                  />
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-900/30">
                        <TrendingUp className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Recent participation
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          Your latest API trend point
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-gray-700/50">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          Talk ratio
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                          {(latestMeeting?.talkRatio || 0).toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-gray-700/50">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          Change
                        </p>
                        <p
                          className={`mt-1 text-xl font-bold ${trendDelta > 0 ? "text-emerald-600" : trendDelta < 0 ? "text-rose-600" : "text-slate-900 dark:text-white"}`}
                        >
                          {trendDelta === null
                            ? "—"
                            : `${trendDelta > 0 ? "+" : ""}${trendDelta.toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                    {latestMeeting?.meetingTitle && (
                      <p
                        className="mt-4 truncate text-xs text-slate-500 dark:text-gray-400"
                        title={latestMeeting.meetingTitle}
                      >
                        Latest meeting: {latestMeeting.meetingTitle}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/30">
                        <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                          What is measured
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          Directly from speaking-time APIs
                        </p>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-gray-300">
                      <li>
                        • Speaking duration and talk ratio per participant
                      </li>
                      <li>• Utterance counts and average turn length</li>
                      <li>
                        • Overlapping speech events used as interruption signals
                      </li>
                      <li>
                        • Recent meeting trends for the authenticated user
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "speakers" && (
              <div className="space-y-6">
                {activeParticipants.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {activeParticipants.map((member) => (
                      <SpeakerCard
                        key={member.id}
                        member={member}
                        maxPercent={maxPercent}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No speaking participants"
                    description="The latest transcript contains no attributed speaking segments."
                  />
                )}
                <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-violet-600" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Data provenance
                    </h2>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-gray-400">
                    Speaker cards are populated from the latest{" "}
                    <code className="rounded bg-slate-100 px-1 dark:bg-gray-700">
                      /api/speaking-time/:meetingId/breakdown
                    </code>{" "}
                    response. No placeholder member records are used in the
                    production rendering path.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "patterns" && (
              <div className="space-y-6">
                {patterns.length ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {patterns.map((pattern) => (
                        <PatternCard key={pattern.id} pattern={pattern} />
                      ))}
                    </div>
                    <PatternRadarChart patterns={patterns} />
                    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Pattern methodology
                      </h2>
                      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-gray-400">
                        Listening and collaboration indicators are derived from
                        API-provided talk ratio, utterance count, duration, and
                        overlap data. They are intentionally presented as
                        heuristics rather than AI-generated claims because the
                        current backend does not expose word-level sentiment or
                        question classification.
                      </p>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No patterns to analyze"
                    description="Patterns require attributed speaker segments from the latest transcript."
                  />
                )}
              </div>
            )}

            {activeTab === "improvements" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-900/20">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Data-driven facilitation opportunities
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
                        {totalImprovement > 0
                          ? `Up to +${totalImprovement}% is estimated across the identified interventions.`
                          : "No material intervention is currently indicated by the latest meeting data."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {recommendations.map((recommendation) => (
                    <SpeakingRecommendationCard
                      key={recommendation.id}
                      recommendation={recommendation}
                    />
                  ))}
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Need the full trend view?
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                        Open the existing trend and organization comparison
                        dashboards backed by the same APIs.
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        to="/speaking-time-trends"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        Trends
                      </Link>
                      <Link
                        to="/speaking-time-compare"
                        className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                      >
                        Compare
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <footer className="mt-8 border-t border-slate-200 pt-6 text-center dark:border-gray-700">
          <p className="text-xs text-slate-400 dark:text-gray-500">
            Speaking Time Analytics · Live speaking-time APIs · Inclusive
            facilitation insights
          </p>
        </footer>
      </div>
    </div>
  );
};

export default SpeakingTimeDashboard;
