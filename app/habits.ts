import type { CalendarMode } from "./calendar-data";
import {
  normalizeAddictionEntry,
  normalizeAddictionTracker,
  scoreAddictionEntry,
  type AddictionEntry,
  type AddictionTracker,
} from "./addiction-tracker";
import { normalizeMoodEntries, type MoodEntry } from "./mood-tracker";
import {
  normalizeSleepEntry,
  normalizeSleepPlan,
  scoreSleepEntry,
  sleepDeviationMinutes,
  sleepDurationMinutes,
  type SleepEntry,
  type SleepPlan,
} from "./sleep-tracker";
import {
  defaultTrackerSchedule,
  isTrackerScheduledForDate,
  markTrackerEntityChanged,
  newTrackerEntity,
  normalizeTrackerEntity,
  normalizeTrackerSchedule,
  trackerTimeZone,
  type TrackerEntity,
  type TrackerSchedule,
} from "./tracker-core";
import { recurrenceModeForCalendar, type RecurrenceConfig } from "./task-recurrence";
import type { TrackerAnalyticsSnapshot } from "./tracker-analytics";
import { scoreHabitFormula } from "./tracker-math";
import {
  buildDailyGoalRecord,
  calculateGlobalStreak,
  calculateRhythmScore,
  dailyGoalModeForDate,
  normalizeDailyGoalModeChanges,
  normalizeDailyGoalRecords,
  scheduleDailyGoalMode,
  upsertDailyGoalRecord,
  type DailyGoalMode,
  type DailyGoalModeChange,
  type DailyGoalRecord,
} from "./daily-goal";
import {
  completionXpAward,
  HEROIC_RANKS,
  HERO_PATH_CHECKPOINTS,
  hiddenHeroicPathUnlocked,
  MAX_HABIT_XP_PER_COMPLETION,
  reconcileUserProgress,
  type UserProgress,
} from "./habit-progress";
import {
  canRecordHabitOnDate,
  DEFAULT_HABIT_EMOJI,
  DEFAULT_HABIT_PRIORITY,
  normalizeHabitColor,
  normalizeHabitEmoji,
  normalizeHabitPriority,
} from "./habit-integrity";
import {
  calculateLaurelsBalance,
  createRewardTransaction,
  normalizeRewardTransactions,
  reconcileDailyGoalRewards,
  resetLaurelsBalance,
  type RewardTransaction,
} from "./rewards";
import {
  applyAutomaticStreakProtection,
  calculateStreakFreezeCount,
  normalizeStreakFreezeTransactions,
  purchaseHestiaSpark,
  reconcileComebackRewards,
  type StreakFreezeTransaction,
} from "./streak-protection";
import {
  HABIT_COLORS,
  STARTER_HABIT_TEMPLATES,
  isHabitTemplateId,
  starterTemplateRecurrencePreset,
  type HabitTemplate,
  type HabitTemplateId,
} from "./habit-templates";
import {
  SACRED_PRACTICES,
  isSacredPracticeId,
  type SacredPractice,
  type SacredPracticeSectorId,
} from "./sacred-practices";
import {
  normalizeHabitQuests,
  reconcileHabitQuestRewards,
  reconcileHabitQuests,
  type HabitQuest,
} from "./habit-quests";
import {
  normalizeAchievementUnlocks,
  reconcileAchievementUnlocks,
  type AchievementUnlock,
} from "./achievements";
import {
  DEFAULT_HABIT_NOTIFICATION_SETTINGS,
  normalizeHabitNotificationSettings,
  type HabitNotificationSettings,
} from "./habit-notifications";
import {
  applyHabitDeletionLaurelPolicy,
  reconcileOrphanedHabitLaurels,
} from "./habit-laurel-retention";
import {
  normalizeHabitRitualId,
  normalizeHabitRitualName,
  normalizeKeyHabitSelection,
  suggestedHabitRitual,
  type HabitRitualId,
} from "./habit-guidance";
import { reconcileStreakMilestoneRewards } from "./streak-rewards";
import {
  DEFAULT_HABIT_FEEDBACK_SETTINGS,
  normalizeHabitFeedbackSettings,
  type HabitFeedbackSettings,
} from "./habit-feedback";

export { HABIT_COLORS, STARTER_HABIT_TEMPLATES } from "./habit-templates";
export type { HabitTemplate, HabitTemplateId } from "./habit-templates";
export { FOUNDATIONAL_HEROIC_RANKS, HEROIC_RANKS, HERO_PATH_CHECKPOINTS, HIDDEN_HEROIC_RANKS, MAX_HABIT_XP_PER_COMPLETION, completionXpAward, heroicRank, heroicRankForProgress, hiddenHeroicPathRevealed, hiddenHeroicPathUnlocked, nextHeroicRank, nextHeroicRankForProgress, visibleHeroicRanksForXp } from "./habit-progress";
export type { HeroicRank, HeroicRankId, HeroPathCheckpoint, UserProgress } from "./habit-progress";
export { DEFAULT_HABIT_EMOJI, DEFAULT_HABIT_PRIORITY, HABIT_EMOJI_CATEGORIES, HABIT_EMOJI_PRESETS, canRecordHabitOnDate, normalizeHabitColor, normalizeHabitEmoji, normalizeHabitPriority } from "./habit-integrity";
export type { RewardCurrency, RewardReason, RewardTransaction } from "./rewards";
export { DAILY_GOAL_LAURELS, PERFECT_DAY_LAURELS, laurelsForDailyGoal, resetLaurelsBalance } from "./rewards";
export { COMEBACK_REWARD_LAURELS, COMEBACK_TARGET_DAYS, HESTIA_SPARK_COST, HESTIA_SPARK_MAX, calculateComebackSummary, calculateStreakFreezeCount } from "./streak-protection";
export type { ComebackSummary, StreakFreezeReason, StreakFreezeTransaction } from "./streak-protection";
export { DAILY_QUEST_LAURELS, EPIC_QUEST_LAURELS, WEEKLY_QUEST_LAURELS, currentHabitQuests, habitQuestMonth, habitQuestWeek } from "./habit-quests";
export type { HabitQuest, HabitQuestCadence, HabitQuestKind } from "./habit-quests";
export { ACHIEVEMENTS, achievementMetrics } from "./achievements";
export type { AchievementDefinition, AchievementId, AchievementUnlock } from "./achievements";
export { HABIT_RITUAL_OPTIONS, buildAdaptiveHabitSuggestions, groupHabitsByRitual, habitRitualLabel, normalizeKeyHabitSelection } from "./habit-guidance";
export type { AdaptiveHabitSuggestion, HabitRitualGroup, HabitRitualId } from "./habit-guidance";
export { STREAK_REWARD_MILESTONES, claimedStreakMilestones } from "./streak-rewards";
export type { StreakRewardMilestone } from "./streak-rewards";
export { HABIT_LAUREL_RETENTION_COMPLETIONS, habitCompletionCount, habitRetainsLaurelsOnDeletion } from "./habit-laurel-retention";
export { dailyGoalTarget } from "./daily-goal";
export type { DailyGoalMode, DailyGoalModeChange, DailyGoalRecord, DailyGoalStatus } from "./daily-goal";
export { DEFAULT_HABIT_FEEDBACK_SETTINGS } from "./habit-feedback";
export type { HabitFeedbackSettings } from "./habit-feedback";

export type HabitQualityScale = "none" | "ten" | "bipolar";
export type HabitScoringMode = "none" | "binary" | "quality-ten" | "quality-bipolar";
export type HabitReportRange = "week" | "days-30" | "month" | "quarter" | "year" | "custom";

export type HabitReminder = {
  enabled: boolean;
  time: string;
  syncToGoogleTasks: boolean;
  showInGoogleCalendar: boolean;
  googleTaskId: string | null;
  googleEventId: string | null;
};

export type Habit = TrackerEntity & {
  title: string;
  description: string;
  createdDate: string;
  emoji: string;
  priority: number;
  isKeyHabit: boolean;
  ritualId: HabitRitualId;
  ritualName: string;
  color: string;
  active: boolean;
  sourceTemplateId: HabitTemplateId | null;
  sacredPracticeId: string | null;
  sacredSectorId: SacredPracticeSectorId | null;
  preferredTime: string;
  schedule: TrackerSchedule;
  scoringMode: HabitScoringMode;
  qualityScale: HabitQualityScale;
  reminder: HabitReminder;
};

export type HabitCompletion = TrackerEntity & {
  habitId: string;
  date: string;
  completed: boolean;
  qualityValue: number | null;
  score: number;
  xpAwarded: number;
  note: string;
};

export type HabitSettings = {
  enabled: boolean;
  reportRange: HabitReportRange;
  customRangeStart: string;
  customRangeEnd: string;
  dailyGoalModeChanges: DailyGoalModeChange[];
  plannedRestDays: string[];
  notifications: HabitNotificationSettings;
  feedback: HabitFeedbackSettings;
};

export type HabitWorkspace = {
  trackerSchemaVersion: 16;
  userProgress: UserProgress;
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  sleepPlans: SleepPlan[];
  sleepEntries: SleepEntry[];
  moodEntries: MoodEntry[];
  addictionTrackers: AddictionTracker[];
  addictionEntries: AddictionEntry[];
  analyticsSnapshots: TrackerAnalyticsSnapshot[];
  dailyGoalRecords: DailyGoalRecord[];
  quests: HabitQuest[];
  achievementUnlocks: AchievementUnlock[];
  rewardTransactions: RewardTransaction[];
  streakFreezeTransactions: StreakFreezeTransaction[];
  habitSettings: HabitSettings;
  hiddenDefaultTemplates: HabitTemplateId[];
};

type LegacyHabitSchedule = {
  calendarMode?: CalendarMode;
  cadence?: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  days?: number[];
  startDate?: string;
  endDate?: string | null;
};

type LegacyHabit = Partial<TrackerEntity> & {
  id?: string;
  title?: string;
  description?: string;
  createdDate?: string;
  emoji?: string;
  priority?: number;
  isKeyHabit?: boolean;
  ritualId?: HabitRitualId;
  ritualName?: string;
  kind?: "positive" | "negative" | "monitor" | "sleep" | "wake";
  color?: string;
  active?: boolean;
  sourceTemplateId?: HabitTemplateId | null;
  sacredPracticeId?: string | null;
  sacredSectorId?: SacredPracticeSectorId | null;
  preferredTime?: string;
  scoringEnabled?: boolean;
  completionPoints?: number;
  failurePoints?: number;
  negativePoints?: number;
  qualityScale?: HabitQualityScale;
  schedule?: LegacyHabitSchedule | TrackerSchedule;
  reminder?: Partial<HabitReminder> & { syncToGoogle?: boolean };
  timeRules?: Array<{ id?: string; operator?: "before" | "after"; threshold?: string; points?: number }>;
};

type LegacyHabitEntry = Partial<TrackerEntity> & {
  id?: string;
  habitId?: string;
  date?: string;
  completed?: boolean;
  quality?: number | null;
  qualityValue?: number | null;
  time?: string;
  note?: string;
  score?: number;
  xpAwarded?: number;
};

type HabitWorkspaceInput = Partial<HabitWorkspace> & {
  habitEntries?: LegacyHabitEntry[];
  habits?: LegacyHabit[] | Habit[];
  moodEntries?: unknown[];
};

export const DEFAULT_HABIT_SETTINGS: HabitSettings = {
  enabled: true,
  reportRange: "month",
  customRangeStart: "",
  customRangeEnd: "",
  dailyGoalModeChanges: [],
  plannedRestDays: [],
  notifications: DEFAULT_HABIT_NOTIFICATION_SETTINGS,
  feedback: DEFAULT_HABIT_FEEDBACK_SETTINGS,
};

export const EMPTY_HABIT_WORKSPACE: HabitWorkspace = {
  trackerSchemaVersion: 16,
  userProgress: {
    lifetimeXp: 0,
    laurelsBalance: 0,
    currentRankId: null,
    hiddenHeroicPathRevealedAt: null,
    currentStreak: 0,
    longestStreak: 0,
    lastQualifiedDate: null,
    streakGoalMode: "rhythm",
    streakFreezeCount: 0,
    rhythmScore: 0,
    updatedAt: "",
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
  achievementUnlocks: [],
  rewardTransactions: [],
  streakFreezeTransactions: [],
  habitSettings: DEFAULT_HABIT_SETTINGS,
  hiddenDefaultTemplates: [],
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function habitDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function habitDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addHabitDays(value: string, days: number) {
  const date = habitDate(value);
  date.setDate(date.getDate() + days);
  return habitDateKey(date);
}

function legacyDays(days: number[], calendarMode: CalendarMode) {
  if (calendarMode === "profane") return days.map((day) => day === 0 ? 7 : day).filter((day) => day >= 1 && day <= 7);
  return days.map((day) => day + 1);
}

function legacySchedule(value: LegacyHabitSchedule | TrackerSchedule | undefined, fallbackDate: string, accountCalendarMode: CalendarMode): TrackerSchedule {
  if (value && "recurrence" in value) return normalizeTrackerSchedule(value, fallbackDate, accountCalendarMode);
  const schedule = value as LegacyHabitSchedule | undefined;
  const startDate = DATE_PATTERN.test(schedule?.startDate ?? "") ? schedule!.startDate! : fallbackDate;
  const calendarMode = ["profane", "sacred", "lunar"].includes(schedule?.calendarMode ?? "")
    ? schedule!.calendarMode!
    : accountCalendarMode;
  const mode = recurrenceModeForCalendar(calendarMode);
  const cadence = schedule?.cadence ?? "daily";
  const pattern: RecurrenceConfig["pattern"] = mode === "classic"
    ? cadence === "weekly" ? "weekdays" : cadence
    : mode === "lunar" ? "lunar-days" : cadence === "monthly" ? "month-days" : "pyata-days";
  const days = Array.isArray(schedule?.days) && schedule!.days!.length
    ? legacyDays(schedule!.days!, calendarMode)
    : mode === "classic" && pattern === "weekdays"
      ? [((habitDate(startDate).getDay() + 6) % 7) + 1]
      : [1];
  return {
    startDate,
    endDate: DATE_PATTERN.test(schedule?.endDate ?? "") ? schedule!.endDate! : null,
    timezone: trackerTimeZone(),
    recurrence: {
      enabled: true,
      mode,
      pattern,
      days,
      interval: Math.max(1, Math.round(Number(schedule?.interval) || 1)),
      rangeStart: startDate,
      rangeEnd: DATE_PATTERN.test(schedule?.endDate ?? "") ? schedule!.endDate! : "",
      months: [],
      pyatas: [],
    },
  };
}

function normalizeReminder(value: LegacyHabit["reminder"]): HabitReminder {
  return {
    enabled: value?.enabled === true,
    time: typeof value?.time === "string" ? value.time : "09:00",
    syncToGoogleTasks: value?.syncToGoogleTasks === true || value?.syncToGoogle === true,
    showInGoogleCalendar: value?.showInGoogleCalendar === true,
    googleTaskId: typeof value?.googleTaskId === "string" && value.googleTaskId ? value.googleTaskId : null,
    googleEventId: typeof value?.googleEventId === "string" && value.googleEventId ? value.googleEventId : null,
  };
}

function normalizeHiddenDefaultTemplates(value: unknown): HabitTemplateId[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isHabitTemplateId)));
}

function legacyScoringMode(value: LegacyHabit): HabitScoringMode {
  if (value.scoringEnabled === false || value.kind === "monitor") return "none";
  if (value.qualityScale === "ten") return "quality-ten";
  if (value.qualityScale === "bipolar") return "quality-bipolar";
  return "binary";
}

function normalizeHabit(value: LegacyHabit, fallbackDate: string, calendarMode: CalendarMode): Habit | null {
  if (typeof value.id !== "string" || !value.id || typeof value.title !== "string" || !value.title) return null;
  const scoringMode = ["none", "binary", "quality-ten", "quality-bipolar"].includes(String((value as Habit).scoringMode))
    ? (value as Habit).scoringMode
    : legacyScoringMode(value);
  const qualityScale: HabitQualityScale = scoringMode === "quality-ten" ? "ten" : scoringMode === "quality-bipolar" ? "bipolar" : "none";
  const normalizedSchedule = legacySchedule(value.schedule, fallbackDate, calendarMode);
  const createdDate = DATE_PATTERN.test(value.createdDate ?? "") ? value.createdDate! : normalizedSchedule.startDate;
  const sourceTemplateId = isHabitTemplateId(value.sourceTemplateId) ? value.sourceTemplateId : null;
  const sacredPracticeId = isSacredPracticeId(value.sacredPracticeId) ? value.sacredPracticeId : null;
  const sacredSectorId = sacredPracticeId ? SACRED_PRACTICES.find((practice) => practice.id === sacredPracticeId)?.sectorId ?? null : null;
  const templateEmoji = STARTER_HABIT_TEMPLATES.find((template) => template.id === sourceTemplateId)?.icon;
  const schedule: TrackerSchedule = {
    ...normalizedSchedule,
    startDate: createdDate,
    recurrence: { ...normalizedSchedule.recurrence, rangeStart: createdDate },
  };
  return {
    ...normalizeTrackerEntity(value, "habit"),
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    createdDate,
    emoji: normalizeHabitEmoji(value.emoji ?? templateEmoji),
    priority: normalizeHabitPriority(value.priority),
    isKeyHabit: value.isKeyHabit === true,
    ritualId: normalizeHabitRitualId(value.ritualId),
    ritualName: normalizeHabitRitualName(value.ritualName),
    color: normalizeHabitColor(value.color, HABIT_COLORS[0]),
    active: value.active !== false,
    sourceTemplateId,
    sacredPracticeId,
    sacredSectorId,
    preferredTime: TIME_PATTERN.test(value.preferredTime ?? "") ? value.preferredTime! : "",
    schedule,
    scoringMode,
    qualityScale,
    reminder: normalizeReminder(value.reminder),
  };
}

export function scoreHabitCompletion(habit: Habit, completion: Pick<HabitCompletion, "completed" | "qualityValue">) {
  return scoreHabitFormula(habit.scoringMode, completion.completed, completion.qualityValue);
}

export function updateHabitCompletion(
  workspace: HabitWorkspace,
  habit: Habit,
  date: string,
  patch: Partial<HabitCompletion>,
  today = habitDateKey(new Date()),
) {
  if (!canRecordHabitOnDate(habit.createdDate, date, today)) return workspace;
  const current = workspace.habitCompletions.find((entry) => entry.habitId === habit.id && entry.date === date);
  const base: HabitCompletion = current ?? {
    ...newTrackerEntity("habit-completion"),
    habitId: habit.id,
    date,
    completed: false,
    qualityValue: null,
    score: 0,
    xpAwarded: 0,
    note: "",
  };
  const patched = markTrackerEntityChanged({ ...base, ...patch });
  const score = scoreHabitCompletion(habit, patched);
  const entry = { ...patched, score, xpAwarded: completionXpAward(base.xpAwarded, score, MAX_HABIT_XP_PER_COMPLETION) };
  return {
    ...workspace,
    habitCompletions: [
      ...workspace.habitCompletions.filter((item) => !(item.habitId === habit.id && item.date === date)),
      entry,
    ],
  };
}

function normalizeHabitCompletion(value: LegacyHabitEntry, habits: Map<string, Habit>): HabitCompletion | null {
  const habitId = typeof value.habitId === "string" ? value.habitId : "";
  const date = typeof value.date === "string" ? value.date : "";
  const habit = habits.get(habitId);
  if (!habit || !DATE_PATTERN.test(date) || date < habit.createdDate) return null;
  const qualityValue = typeof value.qualityValue === "number"
    ? value.qualityValue
    : typeof value.quality === "number" ? value.quality : null;
  const completion = {
    completed: value.completed === true,
    qualityValue,
  };
  const score = scoreHabitCompletion(habit, completion);
  return {
    ...normalizeTrackerEntity(value, "habit-completion"),
    habitId,
    date,
    ...completion,
    score,
    xpAwarded: typeof value.xpAwarded === "number"
      ? completionXpAward(value.xpAwarded, 0, MAX_HABIT_XP_PER_COMPLETION)
      : completionXpAward(0, score, MAX_HABIT_XP_PER_COMPLETION),
    note: typeof value.note === "string" ? value.note : "",
  };
}

function migrateSleepPlan(value: LegacyHabit, fallbackDate: string, calendarMode: CalendarMode): SleepPlan | null {
  if (typeof value.id !== "string" || !value.id || (value.kind !== "sleep" && value.kind !== "wake")) return null;
  const relevantRule = value.timeRules?.find((rule) => typeof rule.threshold === "string");
  return normalizeSleepPlan({
    ...value,
    id: `sleep-plan-${value.id}`,
    title: value.title || (value.kind === "sleep" ? "Отход ко сну" : "Пробуждение"),
    schedule: legacySchedule(value.schedule, fallbackDate, calendarMode),
    targetBedtime: value.kind === "sleep" ? relevantRule?.threshold ?? "23:00" : "23:00",
    targetWakeTime: value.kind === "wake" ? relevantRule?.threshold ?? "07:00" : "07:00",
    qualityEnabled: value.qualityScale !== "none",
    scoringEnabled: value.scoringEnabled === true,
    rules: (value.timeRules ?? []).map((rule, index) => ({
      id: rule.id || `sleep-rule-${index}`,
      field: value.kind === "sleep" ? "bedtime" : "wake",
      operator: rule.operator === "after" ? "after" : "on-or-before",
      threshold: rule.threshold || (value.kind === "sleep" ? "23:00" : "07:00"),
      points: Math.round(Number(rule.points) || 0),
    })),
  }, fallbackDate, calendarMode);
}

function migrateAddictionTracker(value: LegacyHabit, fallbackDate: string, calendarMode: CalendarMode): AddictionTracker | null {
  if (typeof value.id !== "string" || !value.id || value.kind !== "negative") return null;
  return normalizeAddictionTracker({
    ...value,
    id: `addiction-${value.id}`,
    trackedBehavior: value.title || "Наблюдаемое поведение",
    status: value.active === false ? "paused" : "active",
    schedule: legacySchedule(value.schedule, fallbackDate, calendarMode),
    cleanDayPoints: 10,
    relapsePenalty: Math.abs(Math.round(Number(value.negativePoints ?? value.failurePoints) || 0)),
  }, fallbackDate, calendarMode);
}

function migrateSleepEntry(value: LegacyHabitEntry, legacyHabit: LegacyHabit, plan: SleepPlan): SleepEntry | null {
  const date = typeof value.date === "string" ? value.date : "";
  if (!DATE_PATTERN.test(date)) return null;
  const fellAsleepAt = legacyHabit.kind === "sleep" && typeof value.time === "string" ? value.time : "";
  const wokeAt = legacyHabit.kind === "wake" && typeof value.time === "string" ? value.time : "";
  const draft = { fellAsleepAt, wokeAt };
  return {
    ...normalizeTrackerEntity(value, "sleep-entry"),
    id: `sleep-entry-${value.id ?? `${plan.id}-${date}`}`,
    planId: plan.id,
    date,
    ...draft,
    durationMinutes: sleepDurationMinutes(date, fellAsleepAt, wokeAt, plan.schedule.timezone),
    quality: typeof value.quality === "number" ? Math.max(1, Math.min(10, Math.round(value.quality))) : null,
    deviationMinutes: sleepDeviationMinutes(plan, draft),
    note: typeof value.note === "string" ? value.note : "",
    score: scoreSleepEntry(plan, draft),
  };
}

function migrateAddictionEntry(value: LegacyHabitEntry, tracker: AddictionTracker): AddictionEntry | null {
  const date = typeof value.date === "string" ? value.date : "";
  if (!DATE_PATTERN.test(date)) return null;
  const relapse = value.completed === true;
  const draft = { cleanDay: !relapse, relapse };
  return {
    ...normalizeTrackerEntity(value, "addiction-entry"),
    id: `addiction-entry-${value.id ?? `${tracker.id}-${date}`}`,
    trackerId: tracker.id,
    date,
    ...draft,
    cravingIntensity: 0,
    trigger: "",
    note: typeof value.note === "string" ? value.note : "",
    timestamp: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    score: scoreAddictionEntry(tracker, draft),
  };
}

function normalizeSettings(value: Partial<HabitSettings> | undefined): HabitSettings {
  const legacyRange = String(value?.reportRange ?? "month");
  const reportRange: HabitReportRange = legacyRange === "half-year"
    ? "year"
    : ["week", "days-30", "month", "quarter", "year", "custom"].includes(legacyRange)
      ? legacyRange as HabitReportRange
      : "month";
  return {
    ...DEFAULT_HABIT_SETTINGS,
    ...value,
    reportRange,
    dailyGoalModeChanges: normalizeDailyGoalModeChanges(value?.dailyGoalModeChanges),
    plannedRestDays: Array.isArray(value?.plannedRestDays)
      ? Array.from(new Set(value.plannedRestDays.filter((date) => DATE_PATTERN.test(date)))).sort()
      : [],
    notifications: normalizeHabitNotificationSettings(value?.notifications),
    feedback: normalizeHabitFeedbackSettings(value?.feedback),
  };
}

function normalizeSnapshots(value: unknown): TrackerAnalyticsSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof (item as TrackerAnalyticsSnapshot).id !== "string" || typeof (item as TrackerAnalyticsSnapshot).periodStart !== "string") return [];
    const snapshot = item as TrackerAnalyticsSnapshot;
    const metrics = snapshot.metrics ?? {} as TrackerAnalyticsSnapshot["metrics"];
    return [{
      ...snapshot,
      metrics: {
        scheduled: Number(metrics.scheduled) || 0,
        completed: Number(metrics.completed) || 0,
        score: Number(metrics.score) || 0,
        qualityTotal: Number(metrics.qualityTotal) || 0,
        qualityCount: Number(metrics.qualityCount) || 0,
        sleepTotalMinutes: Number(metrics.sleepTotalMinutes) || 0,
        sleepCount: Number(metrics.sleepCount) || 0,
        sleepQualityTotal: Number(metrics.sleepQualityTotal) || 0,
        sleepQualityCount: Number(metrics.sleepQualityCount) || 0,
        sleepDeviationTotal: Number(metrics.sleepDeviationTotal) || 0,
        sleepBedtimeMinutesTotal: Number(metrics.sleepBedtimeMinutesTotal) || 0,
        sleepWakeMinutesTotal: Number(metrics.sleepWakeMinutesTotal) || 0,
        moodTotal: Number(metrics.moodTotal) || 0,
        moodCount: Number(metrics.moodCount) || 0,
        moodDistribution: Array.isArray(metrics.moodDistribution) && metrics.moodDistribution.length === 11 ? metrics.moodDistribution.map((count) => Math.max(0, Number(count) || 0)) : Array.from({ length: 11 }, () => 0),
        cleanDays: Number(metrics.cleanDays) || 0,
        relapses: Number(metrics.relapses) || 0,
        cravingTotal: Number(metrics.cravingTotal) || 0,
        cravingCount: Number(metrics.cravingCount) || 0,
      },
    }];
  });
}

export function normalizeHabitWorkspace(
  input: HabitWorkspaceInput | null | undefined,
  calendarMode: CalendarMode = "sacred",
): HabitWorkspace {
  const value = input ?? {};
  const fallbackDate = habitDateKey(new Date());
  const rawHabits = Array.isArray(value.habits) ? value.habits as LegacyHabit[] : [];
  const regularRaw = rawHabits.filter((habit) => !["negative", "sleep", "wake"].includes(habit.kind ?? "positive"));
  const habits = normalizeKeyHabitSelection(regularRaw
    .map((habit) => normalizeHabit(habit, fallbackDate, calendarMode))
    .filter((habit): habit is Habit => habit !== null));
  const habitMap = new Map(habits.map((habit) => [habit.id, habit]));
  const rawEntries = Array.isArray(value.habitCompletions)
    ? value.habitCompletions as LegacyHabitEntry[]
    : Array.isArray(value.habitEntries) ? value.habitEntries : [];
  const habitCompletions = rawEntries
    .map((entry) => normalizeHabitCompletion(entry, habitMap))
    .filter((entry): entry is HabitCompletion => entry !== null);
  const rewardTransactions = reconcileOrphanedHabitLaurels(
    habits.length,
    normalizeRewardTransactions(value.rewardTransactions),
    new Date().toISOString(),
  );
  const streakFreezeTransactions = normalizeStreakFreezeTransactions(value.streakFreezeTransactions);
  const quests = normalizeHabitQuests(value.quests);
  const achievementUnlocks = normalizeAchievementUnlocks(value.achievementUnlocks);
  const userProgress = reconcileUserProgress(
    value.userProgress,
    habitCompletions,
    new Date().toISOString(),
    undefined,
    calculateLaurelsBalance(rewardTransactions),
    calculateStreakFreezeCount(streakFreezeTransactions),
  );

  const explicitSleepPlans = Array.isArray(value.sleepPlans)
    ? value.sleepPlans.map((plan) => normalizeSleepPlan(plan as unknown as Record<string, unknown>, fallbackDate, calendarMode)).filter((plan): plan is SleepPlan => plan !== null)
    : [];
  const migratedSleepPlans = explicitSleepPlans.length ? [] : rawHabits.map((habit) => migrateSleepPlan(habit, fallbackDate, calendarMode)).filter((plan): plan is SleepPlan => plan !== null);
  const sleepPlans = [...explicitSleepPlans, ...migratedSleepPlans];
  const sleepPlanMap = new Map(sleepPlans.map((plan) => [plan.id, plan]));
  const explicitSleepEntries = Array.isArray(value.sleepEntries)
    ? value.sleepEntries.map((entry) => normalizeSleepEntry(entry as unknown as Record<string, unknown>, sleepPlanMap)).filter((entry): entry is SleepEntry => entry !== null)
    : [];
  const migratedSleepEntries = explicitSleepEntries.length ? [] : rawEntries.flatMap((entry) => {
    const habit = rawHabits.find((item) => item.id === entry.habitId);
    const plan = habit ? sleepPlanMap.get(`sleep-plan-${habit.id}`) : undefined;
    const migrated = habit && plan ? migrateSleepEntry(entry, habit, plan) : null;
    return migrated ? [migrated] : [];
  });

  const explicitAddictionTrackers = Array.isArray(value.addictionTrackers)
    ? value.addictionTrackers.map((tracker) => normalizeAddictionTracker(tracker as unknown as Record<string, unknown>, fallbackDate, calendarMode)).filter((tracker): tracker is AddictionTracker => tracker !== null)
    : [];
  const migratedAddictionTrackers = explicitAddictionTrackers.length ? [] : rawHabits.map((habit) => migrateAddictionTracker(habit, fallbackDate, calendarMode)).filter((tracker): tracker is AddictionTracker => tracker !== null);
  const addictionTrackers = [...explicitAddictionTrackers, ...migratedAddictionTrackers];
  const addictionMap = new Map(addictionTrackers.map((tracker) => [tracker.id, tracker]));
  const explicitAddictionEntries = Array.isArray(value.addictionEntries)
    ? value.addictionEntries.map((entry) => normalizeAddictionEntry(entry as unknown as Record<string, unknown>, addictionMap)).filter((entry): entry is AddictionEntry => entry !== null)
    : [];
  const migratedAddictionEntries = explicitAddictionEntries.length ? [] : rawEntries.flatMap((entry) => {
    const habit = rawHabits.find((item) => item.id === entry.habitId);
    const tracker = habit ? addictionMap.get(`addiction-${habit.id}`) : undefined;
    const migrated = tracker ? migrateAddictionEntry(entry, tracker) : null;
    return migrated ? [migrated] : [];
  });

  const workspace: HabitWorkspace = {
    trackerSchemaVersion: 16,
    userProgress,
    habits,
    habitCompletions,
    sleepPlans,
    sleepEntries: [...explicitSleepEntries, ...migratedSleepEntries],
    moodEntries: normalizeMoodEntries(value.moodEntries),
    addictionTrackers,
    addictionEntries: [...explicitAddictionEntries, ...migratedAddictionEntries],
    analyticsSnapshots: normalizeSnapshots(value.analyticsSnapshots),
    dailyGoalRecords: normalizeDailyGoalRecords(value.dailyGoalRecords),
    quests,
    achievementUnlocks,
    rewardTransactions,
    streakFreezeTransactions,
    habitSettings: normalizeSettings(value.habitSettings),
    hiddenDefaultTemplates: normalizeHiddenDefaultTemplates(value.hiddenDefaultTemplates),
  };
  return ensureDailyGoalProgress(workspace, calendarMode);
}

export function isHabitScheduledForDate(habit: Habit, value: string, calendarMode: CalendarMode = "sacred") {
  return habit.active && isTrackerScheduledForDate(habit.schedule, value, calendarMode);
}

export function habitScore(habit: Habit, entry: HabitCompletion | undefined, value: string, _today?: string, calendarMode: CalendarMode = "sacred") {
  if (!entry || !isHabitScheduledForDate(habit, value, calendarMode)) return 0;
  return scoreHabitCompletion(habit, entry);
}

export function calculateHabitTotal(workspace: HabitWorkspace) {
  return workspace.userProgress.lifetimeXp;
}

function dailyGoalCounts(workspace: HabitWorkspace, date: string, calendarMode: CalendarMode) {
  const scheduledHabits = workspace.habits.filter((habit) => isHabitScheduledForDate(habit, date, calendarMode));
  const scheduledIds = new Set(scheduledHabits.map((habit) => habit.id));
  const completedCount = new Set(workspace.habitCompletions
    .filter((entry) => entry.date === date && entry.completed && scheduledIds.has(entry.habitId))
    .map((entry) => entry.habitId)).size;
  return { scheduledCount: scheduledHabits.length, completedCount };
}

export function dailyGoalForDate(
  workspace: HabitWorkspace,
  date: string,
  calendarMode: CalendarMode,
  today = habitDateKey(new Date()),
) {
  const existing = workspace.dailyGoalRecords.find((record) => record.date === date);
  const mode = existing && date < today
    ? existing.mode
    : dailyGoalModeForDate(workspace.habitSettings.dailyGoalModeChanges, date);
  const counts = dailyGoalCounts(workspace, date, calendarMode);
  const next = buildDailyGoalRecord({
    date,
    mode,
    timezone: existing?.timezone ?? trackerTimeZone(),
    ...counts,
    today,
    isRestDay: workspace.habitSettings.plannedRestDays.includes(date),
    isStreakProtected: existing?.status === "protected",
  });
  return existing
    && existing.mode === next.mode
    && existing.timezone === next.timezone
    && existing.scheduledCount === next.scheduledCount
    && existing.completedCount === next.completedCount
    && existing.targetCount === next.targetCount
    && existing.status === next.status
    ? existing
    : next;
}

function scheduledBeforePause(habit: Habit, date: string, calendarMode: CalendarMode) {
  if (date < habit.createdDate || !isTrackerScheduledForDate(habit.schedule, date, calendarMode)) return false;
  if (habit.active) return true;
  const pausedDate = DATE_PATTERN.test(habit.updatedAt.slice(0, 10)) ? habit.updatedAt.slice(0, 10) : habit.createdDate;
  return date < pausedDate;
}

export function reconcileMissedHabitLaurels(
  workspace: HabitWorkspace,
  value: readonly RewardTransaction[],
  today: string,
  timestamp: string,
  calendarMode: CalendarMode,
) {
  let transactions = normalizeRewardTransactions(value);
  const completed = new Set(workspace.habitCompletions
    .filter((entry) => entry.completed)
    .map((entry) => `${entry.habitId}:${entry.date}`));
  const restDays = new Set(workspace.habitSettings.plannedRestDays);
  const closedDates = workspace.dailyGoalRecords
    .filter((record) => ["qualified", "perfect", "missed", "protected"].includes(record.status))
    .map((record) => record.date)
    .filter((date, index, dates) => date < today && !restDays.has(date) && dates.indexOf(date) === index)
    .sort();

  closedDates.forEach((date) => {
    workspace.habits.forEach((habit) => {
      if (!scheduledBeforePause(habit, date, calendarMode) || completed.has(`${habit.id}:${date}`)) return;
      transactions = resetLaurelsBalance(
        transactions,
        "habit-missed-reset",
        `${habit.id}:${date}`,
        `habit-missed:self:${habit.id}:${date}`,
        timestamp,
      );
    });
  });
  return transactions;
}

function withDailyGoalStreak(
  workspace: HabitWorkspace,
  today: string,
  calendarMode: CalendarMode,
  protectableDates: ReadonlySet<string> = new Set(),
) {
  const timestamp = new Date().toISOString();
  const protection = applyAutomaticStreakProtection({
    records: workspace.dailyGoalRecords,
    transactions: workspace.streakFreezeTransactions,
    protectableDates,
    today,
    timestamp,
  });
  const protectedWorkspace = {
    ...workspace,
    dailyGoalRecords: protection.records,
    streakFreezeTransactions: protection.transactions,
  };
  const streak = calculateGlobalStreak(protectedWorkspace.dailyGoalRecords, today);
  const earnedTransactions = reconcileDailyGoalRewards(protectedWorkspace.dailyGoalRecords, protectedWorkspace.rewardTransactions, today);
  const milestoneTransactions = reconcileStreakMilestoneRewards(protectedWorkspace.dailyGoalRecords, earnedTransactions);
  const resetTransactions = reconcileMissedHabitLaurels(protectedWorkspace, milestoneTransactions, today, timestamp, calendarMode);
  const comebackTransactions = reconcileComebackRewards(protectedWorkspace.dailyGoalRecords, resetTransactions, today, timestamp);
  const quests = protectedWorkspace.habitSettings.feedback.questsEnabled
    ? reconcileHabitQuests({
      quests: protectedWorkspace.quests,
      habits: protectedWorkspace.habits,
      completions: protectedWorkspace.habitCompletions,
      dailyGoalRecords: protectedWorkspace.dailyGoalRecords,
      today,
      calendarMode,
      isScheduledForDate: isTrackerScheduledForDate,
      timestamp,
    })
    : protectedWorkspace.quests;
  const rewardTransactions = protectedWorkspace.habitSettings.feedback.questsEnabled
    ? reconcileHabitQuestRewards(quests, comebackTransactions, timestamp)
    : comebackTransactions;
  const achievementUnlocks = reconcileAchievementUnlocks({
    unlocks: protectedWorkspace.achievementUnlocks,
    habitCompletions: protectedWorkspace.habitCompletions,
    dailyGoalRecords: protectedWorkspace.dailyGoalRecords,
    longestStreak: Math.max(streak.longestStreak, workspace.userProgress.longestStreak),
    rewardTransactions,
    timestamp,
  });
  return {
    ...protectedWorkspace,
    quests,
    achievementUnlocks,
    rewardTransactions,
    userProgress: reconcileUserProgress(
      workspace.userProgress,
      workspace.habitCompletions,
      timestamp,
      streak,
      calculateLaurelsBalance(rewardTransactions),
      calculateStreakFreezeCount(protection.transactions),
      calculateRhythmScore(protectedWorkspace.dailyGoalRecords, today),
    ),
  };
}

export function refreshDailyGoalProgress(
  workspace: HabitWorkspace,
  dates: Iterable<string>,
  calendarMode: CalendarMode,
  today = habitDateKey(new Date()),
): HabitWorkspace {
  let records = normalizeDailyGoalRecords(workspace.dailyGoalRecords);
  const protectableDates = new Set<string>();
  for (const date of dates) {
    if (!DATE_PATTERN.test(date)) continue;
    const previous = records.find((record) => record.date === date);
    const record = dailyGoalForDate({ ...workspace, dailyGoalRecords: records }, date, calendarMode, today);
    if (previous?.status === "open" && record.status === "missed") protectableDates.add(date);
    records = upsertDailyGoalRecord(records, record);
  }
  return withDailyGoalStreak({ ...workspace, dailyGoalRecords: records }, today, calendarMode, protectableDates);
}

export function ensureDailyGoalProgress(
  workspace: HabitWorkspace,
  calendarMode: CalendarMode,
  today = habitDateKey(new Date()),
): HabitWorkspace {
  const currentTimezone = trackerTimeZone();
  const normalizedRecords = normalizeDailyGoalRecords(workspace.dailyGoalRecords);
  const previousCurrentRecord = normalizedRecords.filter((record) => record.date <= today).at(-1);
  const timezoneChanged = Boolean(previousCurrentRecord && previousCurrentRecord.timezone !== currentTimezone);
  const timezoneBoundaryDate = timezoneChanged ? addHabitDays(today, -1) : "";
  const protectableDates = new Set<string>();
  let records = normalizedRecords.map((record) => {
    if (record.status !== "open" || record.date >= today) return record;
    const closed = buildDailyGoalRecord({
      date: record.date,
      mode: record.mode,
      timezone: record.timezone,
      scheduledCount: record.scheduledCount,
      completedCount: record.completedCount,
      today,
      isTimezoneShift: record.date === timezoneBoundaryDate,
      updatedAt: record.updatedAt,
    });
    if (closed.status === "missed") protectableDates.add(record.date);
    return closed;
  });
  const latestDate = records.filter((record) => record.date <= today).at(-1)?.date;
  const earliestSource = [
    ...workspace.habits.filter((habit) => habit.active).map((habit) => habit.schedule.startDate),
    ...workspace.habitCompletions.map((entry) => entry.date),
  ].filter((date) => DATE_PATTERN.test(date)).sort()[0];
  const historyFloor = addHabitDays(today, -3_699);
  const start = latestDate
    ? addHabitDays(latestDate, 1)
    : earliestSource && earliestSource <= today ? (earliestSource < historyFloor ? historyFloor : earliestSource) : "";
  if (start && start <= today) {
    const draft = { ...workspace, dailyGoalRecords: records };
    dateValuesBetween(start, today).forEach((date) => {
      const calculated = dailyGoalForDate({ ...draft, dailyGoalRecords: records }, date, calendarMode, today);
      const record = date === timezoneBoundaryDate
        ? { ...calculated, timezone: currentTimezone, status: "timezone-shift" as const }
        : calculated;
      if (record.status === "missed") protectableDates.add(date);
      records = upsertDailyGoalRecord(records, record);
    });
  }
  if (records.some((record) => record.date === today)) {
    const current = dailyGoalForDate({ ...workspace, dailyGoalRecords: records }, today, calendarMode, today);
    records = upsertDailyGoalRecord(records, current);
  }
  return withDailyGoalStreak({ ...workspace, dailyGoalRecords: records }, today, calendarMode, protectableDates);
}

export function buyHestiaSpark(
  workspace: HabitWorkspace,
  purchaseId = `spark-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  timestamp = new Date().toISOString(),
): HabitWorkspace {
  const purchase = purchaseHestiaSpark({
    rewardTransactions: workspace.rewardTransactions,
    streakFreezeTransactions: workspace.streakFreezeTransactions,
    laurelsBalance: workspace.userProgress.laurelsBalance,
    purchaseId,
    createdAt: timestamp,
  });
  if (!purchase.ok) return workspace;
  return {
    ...workspace,
    rewardTransactions: purchase.rewardTransactions,
    streakFreezeTransactions: purchase.streakFreezeTransactions,
    userProgress: reconcileUserProgress(
      workspace.userProgress,
      workspace.habitCompletions,
      timestamp,
      undefined,
      calculateLaurelsBalance(purchase.rewardTransactions),
      calculateStreakFreezeCount(purchase.streakFreezeTransactions),
    ),
  };
}

export function claimHeroPathAmphora(
  workspace: HabitWorkspace,
  rankId: string,
  timestamp = new Date().toISOString(),
): HabitWorkspace {
  const checkpoint = HERO_PATH_CHECKPOINTS.find((item) => item.rankId === rankId);
  if (!checkpoint) return workspace;
  const rank = HEROIC_RANKS.find((item) => item.id === checkpoint.rankId);
  if (!rank || workspace.userProgress.lifetimeXp < rank.threshold) return workspace;
  const idempotencyKey = `hero-path-amphora:self:${checkpoint.rankId}`;
  if (workspace.rewardTransactions.some((transaction) => transaction.idempotencyKey === idempotencyKey)) return workspace;
  const rewardTransactions = normalizeRewardTransactions([
    ...workspace.rewardTransactions,
    createRewardTransaction({
      amount: checkpoint.rewardLaurels,
      reason: "hero-path-amphora",
      sourceId: checkpoint.rankId,
      idempotencyKey,
      createdAt: timestamp,
    }),
  ]);
  return {
    ...workspace,
    rewardTransactions,
    userProgress: reconcileUserProgress(
      workspace.userProgress,
      workspace.habitCompletions,
      timestamp,
      undefined,
      calculateLaurelsBalance(rewardTransactions),
      calculateStreakFreezeCount(workspace.streakFreezeTransactions),
    ),
  };
}

export function revealHiddenHeroicPath(
  workspace: HabitWorkspace,
  timestamp = new Date().toISOString(),
): HabitWorkspace {
  if (!hiddenHeroicPathUnlocked(workspace.userProgress.lifetimeXp) || workspace.userProgress.hiddenHeroicPathRevealedAt) return workspace;
  return {
    ...workspace,
    userProgress: {
      ...workspace.userProgress,
      hiddenHeroicPathRevealedAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function removeHabitFromWorkspace(
  workspace: HabitWorkspace,
  habitId: string,
  timestamp = new Date().toISOString(),
): HabitWorkspace {
  const habit = workspace.habits.find((item) => item.id === habitId);
  if (!habit) return workspace;
  const habitCompletions = workspace.habitCompletions.filter((entry) => entry.habitId !== habitId);
  const rewardTransactions = applyHabitDeletionLaurelPolicy(
    workspace.rewardTransactions,
    workspace.habitCompletions,
    habitId,
    timestamp,
  ).transactions;
  return {
    ...workspace,
    habits: workspace.habits.filter((item) => item.id !== habitId),
    habitCompletions,
    rewardTransactions,
    userProgress: reconcileUserProgress(
      workspace.userProgress,
      habitCompletions,
      timestamp,
      undefined,
      calculateLaurelsBalance(rewardTransactions),
      calculateStreakFreezeCount(workspace.streakFreezeTransactions),
    ),
  };
}

export function setDailyGoalMode(
  workspace: HabitWorkspace,
  mode: DailyGoalMode,
  today = habitDateKey(new Date()),
): HabitWorkspace {
  const effectiveFrom = addHabitDays(today, 1);
  const timestamp = new Date().toISOString();
  return {
    ...workspace,
    userProgress: { ...workspace.userProgress, streakGoalMode: mode, updatedAt: timestamp },
    habitSettings: {
      ...workspace.habitSettings,
      dailyGoalModeChanges: scheduleDailyGoalMode(workspace.habitSettings.dailyGoalModeChanges, mode, effectiveFrom, timestamp),
    },
  };
}

export function setPlannedRestDay(
  workspace: HabitWorkspace,
  date: string,
  planned: boolean,
  calendarMode: CalendarMode,
  today = habitDateKey(new Date()),
): HabitWorkspace {
  if (!DATE_PATTERN.test(date) || date < today) return workspace;
  const restDays = new Set(workspace.habitSettings.plannedRestDays);
  if (planned) restDays.add(date);
  else restDays.delete(date);
  return refreshDailyGoalProgress({
    ...workspace,
    habitSettings: { ...workspace.habitSettings, plannedRestDays: Array.from(restDays).sort() },
  }, [date], calendarMode, today);
}

function startOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function startOfQuarter(value: string) {
  const [year, month] = value.split("-").map(Number);
  const quarterMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return `${year}-${String(quarterMonth).padStart(2, "0")}-01`;
}

export function reportDateRange(settings: HabitSettings, today = habitDateKey(new Date())) {
  if (settings.reportRange === "custom" && DATE_PATTERN.test(settings.customRangeStart) && DATE_PATTERN.test(settings.customRangeEnd)) {
    const end = settings.customRangeEnd > today ? today : settings.customRangeEnd;
    const start = settings.customRangeStart > end ? end : settings.customRangeStart;
    return { start, end };
  }
  if (settings.reportRange === "month") return { start: startOfMonth(today), end: today };
  if (settings.reportRange === "quarter") return { start: startOfQuarter(today), end: today };
  if (settings.reportRange === "year") return { start: `${today.slice(0, 4)}-01-01`, end: today };
  const days = settings.reportRange === "week" ? 7 : 30;
  return { start: addHabitDays(today, -(days - 1)), end: today };
}

export function dateValuesBetween(start: string, end: string, limit = 3_700) {
  const result: string[] = [];
  for (let value = start; value <= end && result.length < limit; value = addHabitDays(value, 1)) result.push(value);
  return result;
}

export function habitRangeEnd(startDate: string, preset: "week" | "month" | "half-year" | "year" | "custom" | "forever", customEnd = "") {
  if (preset === "forever") return null;
  if (preset === "custom") return DATE_PATTERN.test(customEnd) ? customEnd : null;
  const start = habitDate(startDate);
  if (preset === "week") start.setDate(start.getDate() + 6);
  if (preset === "month") start.setMonth(start.getMonth() + 1);
  if (preset === "half-year") start.setMonth(start.getMonth() + 6);
  if (preset === "year") start.setFullYear(start.getFullYear() + 1);
  return habitDateKey(start);
}

export function defaultHabit(date: string, calendarMode: CalendarMode): Habit {
  return {
    ...normalizeTrackerEntity(null, "habit"),
    title: "",
    description: "",
    createdDate: date,
    emoji: DEFAULT_HABIT_EMOJI,
    priority: DEFAULT_HABIT_PRIORITY,
    isKeyHabit: false,
    ritualId: "none",
    ritualName: "",
    color: HABIT_COLORS[0],
    active: true,
    sourceTemplateId: null,
    sacredPracticeId: null,
    sacredSectorId: null,
    preferredTime: "",
    schedule: defaultTrackerSchedule(date, calendarMode),
    scoringMode: "binary",
    qualityScale: "none",
    reminder: {
      enabled: false,
      time: "09:00",
      syncToGoogleTasks: false,
      showInGoogleCalendar: false,
      googleTaskId: null,
      googleEventId: null,
    },
  };
}

function templateSchedule(template: HabitTemplate, date: string, calendarMode: CalendarMode): TrackerSchedule {
  const schedule = defaultTrackerSchedule(date, calendarMode);
  const preset = starterTemplateRecurrencePreset(template, calendarMode);
  return { ...schedule, recurrence: { ...schedule.recurrence, ...preset } };
}

export function createHabitFromTemplate(
  template: HabitTemplate,
  startDate: string,
  calendarMode: CalendarMode,
  language: "ru" | "en" = "ru",
): Habit {
  const schedule = templateSchedule(template, startDate, calendarMode);
  return {
    ...defaultHabit(startDate, calendarMode),
    sourceTemplateId: template.id,
    emoji: normalizeHabitEmoji(template.icon),
    title: language === "en" ? template.titleEn : template.title,
    description: language === "en" ? template.descriptionEn : template.description,
    color: template.color,
    preferredTime: template.suggestedTime,
    ritualId: suggestedHabitRitual(template.suggestedTime),
    schedule,
    reminder: {
      enabled: false,
      time: template.suggestedTime,
      syncToGoogleTasks: false,
      showInGoogleCalendar: false,
      googleTaskId: null,
      googleEventId: null,
    },
  };
}

export function createHabitFromSacredPractice(
  practice: SacredPractice,
  startDate: string,
  calendarMode: CalendarMode,
  language: "ru" | "en" = "ru",
): Habit {
  return {
    ...defaultHabit(startDate, calendarMode),
    sacredPracticeId: practice.id,
    sacredSectorId: practice.sectorId,
    emoji: normalizeHabitEmoji(practice.emoji),
    title: practice.title[language],
    description: practice.description[language],
    color: practice.color,
    priority: normalizeHabitPriority(practice.priority),
    preferredTime: practice.suggestedTime,
    ritualId: suggestedHabitRitual(practice.suggestedTime),
    reminder: {
      enabled: false,
      time: practice.suggestedTime,
      syncToGoogleTasks: false,
      showInGoogleCalendar: false,
      googleTaskId: null,
      googleEventId: null,
    },
  };
}

export function setKeyHabit(
  workspace: HabitWorkspace,
  habitId: string | null,
  timestamp = new Date().toISOString(),
): HabitWorkspace {
  if (habitId && !workspace.habits.some((habit) => habit.id === habitId)) return workspace;
  let changed = false;
  const habits = workspace.habits.map((habit) => {
    const isKeyHabit = habit.id === habitId;
    if (habit.isKeyHabit === isKeyHabit) return habit;
    changed = true;
    return { ...habit, isKeyHabit, updatedAt: timestamp, version: habit.version + 1, syncState: "pending" as const };
  });
  return changed ? { ...workspace, habits } : workspace;
}
