/**
 * Shared presentation types and configuration for Speaking Time Analytics.
 *
 * Runtime speaking data is supplied by speakingTimeApi. This module contains
 * only stable UI metadata; it intentionally does not contain sample members
 * or generated meeting statistics.
 */

export const SpeakingRole = {
  FACILITATOR: "facilitator",
  PRESENTER: "presenter",
  PARTICIPANT: "participant",
  OBSERVER: "observer",
};

export const BalanceRating = {
  EXCELLENT: "excellent",
  GOOD: "good",
  BIASED: "biased",
  DOMINATED: "dominated",
};

export const BALANCE_CONFIG = {
  [BalanceRating.EXCELLENT]: {
    label: "Excellent Balance",
    color: "#22c55e",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
    description: "Speaking time is well distributed among all participants",
    minScore: 85,
  },
  [BalanceRating.GOOD]: {
    label: "Good Balance",
    color: "#0ea5e9",
    bgColor: "bg-sky-50 dark:bg-sky-900/30",
    textColor: "text-sky-600 dark:text-sky-400",
    description: "Most participants contribute meaningfully",
    minScore: 70,
  },
  [BalanceRating.BIASED]: {
    label: "Biased",
    color: "#f59e0b",
    bgColor: "bg-amber-50 dark:bg-amber-900/30",
    textColor: "text-amber-600 dark:text-amber-400",
    description: "A few speakers dominate the conversation",
    minScore: 45,
  },
  [BalanceRating.DOMINATED]: {
    label: "Dominated",
    color: "#ef4444",
    bgColor: "bg-red-50 dark:bg-red-900/30",
    textColor: "text-red-600 dark:text-red-400",
    description: "One or two speakers control most of the time",
    minScore: 0,
  },
};

export const ROLE_CONFIG = {
  [SpeakingRole.FACILITATOR]: {
    label: "Facilitator",
    color: "#8b5cf6",
    icon: "Crown",
  },
  [SpeakingRole.PRESENTER]: {
    label: "Presenter",
    color: "#0ea5e9",
    icon: "Mic",
  },
  [SpeakingRole.PARTICIPANT]: {
    label: "Participant",
    color: "#22c55e",
    icon: "User",
  },
  [SpeakingRole.OBSERVER]: {
    label: "Observer",
    color: "#6b7280",
    icon: "Eye",
  },
};
