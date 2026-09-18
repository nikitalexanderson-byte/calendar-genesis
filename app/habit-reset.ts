import type { HabitWorkspace } from "./habits";

export function resetHabitWorkspace(
  workspace: HabitWorkspace,
  timestamp = new Date().toISOString(),
): HabitWorkspace {
  return {
    trackerSchemaVersion: 11,
    userProgress: {
      lifetimeXp: 0,
      laurelsBalance: 0,
      currentRankId: null,
      hiddenHeroicPathRevealedAt: null,
      currentStreak: 0,
      longestStreak: 0,
      lastQualifiedDate: null,
      streakGoalMode: workspace.userProgress.streakGoalMode,
      streakFreezeCount: 0,
      updatedAt: timestamp,
    },
    habits: [],
    habitCompletions: [],
    sleepPlans: [],
    sleepEntries: [],
    moodEntries: [],
    addictionTrackers: [],
    addictionEntries: [],
    analyticsSnapshots: [],
    dailyGoalRecords: [],
    quests: [],
    rewardTransactions: [],
    streakFreezeTransactions: [],
    habitSettings: {
      enabled: workspace.habitSettings.enabled,
      reportRange: workspace.habitSettings.reportRange,
      customRangeStart: workspace.habitSettings.customRangeStart,
      customRangeEnd: workspace.habitSettings.customRangeEnd,
      dailyGoalModeChanges: [],
      plannedRestDays: [],
    },
    hiddenDefaultTemplates: [],
  };
}
