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
  normalizeTrackerEntity,
  normalizeTrackerSchedule,
  trackerTimeZone,
  type TrackerEntity,
  type TrackerSchedule,
} from "./tracker-core";
import { recurrenceModeForCalendar, type RecurrenceConfig } from "./task-recurrence";
import type { TrackerAnalyticsSnapshot } from "./tracker-analytics";
import { nonNegativeTrackerTotal, scoreHabitFormula } from "./tracker-math";
import {
  HABIT_COLORS,
  isHabitTemplateId,
  starterTemplateRecurrencePreset,
  type HabitTemplate,
  type HabitTemplateId,
} from "./habit-templates";

export { HABIT_COLORS, STARTER_HABIT_TEMPLATES } from "./habit-templates";
export type { HabitTemplate, HabitTemplateId } from "./habit-templates";

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
  color: string;
  active: boolean;
  sourceTemplateId: HabitTemplateId | null;
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
  note: string;
};

export type HabitSettings = {
  enabled: boolean;
  reportRange: HabitReportRange;
  customRangeStart: string;
  customRangeEnd: string;
};

export type HabitWorkspace = {
  trackerSchemaVersion: 3;
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  sleepPlans: SleepPlan[];
  sleepEntries: SleepEntry[];
  moodEntries: MoodEntry[];
  addictionTrackers: AddictionTracker[];
  addictionEntries: AddictionEntry[];
  analyticsSnapshots: TrackerAnalyticsSnapshot[];
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
  kind?: "positive" | "negative" | "monitor" | "sleep" | "wake";
  color?: string;
  active?: boolean;
  sourceTemplateId?: HabitTemplateId | null;
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
};

export const EMPTY_HABIT_WORKSPACE: HabitWorkspace = {
  trackerSchemaVersion: 3,
  habits: [],
  habitCompletions: [],
  sleepPlans: [],
  sleepEntries: [],
  moodEntries: [],
  addictionTrackers: [],
  addictionEntries: [],
  analyticsSnapshots: [],
  habitSettings: DEFAULT_HABIT_SETTINGS,
  hiddenDefaultTemplates: [],
};

export const HEROIC_RANKS = [
  { id: "spark", title: "Искра намерения", titleEn: "Spark of Intention", threshold: 0, symbol: "✦", color: "#70736d" },
  { id: "seeker", title: "Искатель ритма", titleEn: "Seeker of Rhythm", threshold: 100, symbol: "❧", color: "#9a6a43" },
  { id: "hoplite", title: "Гоплит дисциплины", titleEn: "Hoplite of Discipline", threshold: 300, symbol: "♜", color: "#9ba1a0" },
  { id: "strategist", title: "Стратег привычек", titleEn: "Strategist of Habits", threshold: 750, symbol: "☉", color: "#c69b50" },
  { id: "archon", title: "Архонт воли", titleEn: "Archon of Will", threshold: 1_500, symbol: "❖", color: "#34836e" },
  { id: "hero", title: "Герой постоянства", titleEn: "Hero of Consistency", threshold: 3_000, symbol: "✧", color: "#3e66a0" },
  { id: "lightbearer", title: "Светоносец GENESIS", titleEn: "Lightbearer of GENESIS", threshold: 6_000, symbol: "☼", color: "#e2c778" },
] as const;

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
  return {
    ...normalizeTrackerEntity(value, "habit"),
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    color: typeof value.color === "string" ? value.color : HABIT_COLORS[0],
    active: value.active !== false,
    sourceTemplateId: isHabitTemplateId(value.sourceTemplateId) ? value.sourceTemplateId : null,
    preferredTime: TIME_PATTERN.test(value.preferredTime ?? "") ? value.preferredTime! : "",
    schedule: legacySchedule(value.schedule, fallbackDate, calendarMode),
    scoringMode,
    qualityScale,
    reminder: normalizeReminder(value.reminder),
  };
}

export function scoreHabitCompletion(habit: Habit, completion: Pick<HabitCompletion, "completed" | "qualityValue">) {
  return scoreHabitFormula(habit.scoringMode, completion.completed, completion.qualityValue);
}

function normalizeHabitCompletion(value: LegacyHabitEntry, habits: Map<string, Habit>): HabitCompletion | null {
  const habitId = typeof value.habitId === "string" ? value.habitId : "";
  const date = typeof value.date === "string" ? value.date : "";
  const habit = habits.get(habitId);
  if (!habit || !DATE_PATTERN.test(date)) return null;
  const qualityValue = typeof value.qualityValue === "number"
    ? value.qualityValue
    : typeof value.quality === "number" ? value.quality : null;
  const completion = {
    completed: value.completed === true,
    qualityValue,
  };
  return {
    ...normalizeTrackerEntity(value, "habit-completion"),
    habitId,
    date,
    ...completion,
    score: scoreHabitCompletion(habit, completion),
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
  const habits = regularRaw
    .map((habit) => normalizeHabit(habit, fallbackDate, calendarMode))
    .filter((habit): habit is Habit => habit !== null);
  const habitMap = new Map(habits.map((habit) => [habit.id, habit]));
  const rawEntries = Array.isArray(value.habitCompletions)
    ? value.habitCompletions as LegacyHabitEntry[]
    : Array.isArray(value.habitEntries) ? value.habitEntries : [];
  const habitCompletions = rawEntries
    .map((entry) => normalizeHabitCompletion(entry, habitMap))
    .filter((entry): entry is HabitCompletion => entry !== null);

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

  return {
    trackerSchemaVersion: 3,
    habits,
    habitCompletions,
    sleepPlans,
    sleepEntries: [...explicitSleepEntries, ...migratedSleepEntries],
    moodEntries: normalizeMoodEntries(value.moodEntries),
    addictionTrackers,
    addictionEntries: [...explicitAddictionEntries, ...migratedAddictionEntries],
    analyticsSnapshots: normalizeSnapshots(value.analyticsSnapshots),
    habitSettings: normalizeSettings(value.habitSettings),
    hiddenDefaultTemplates: normalizeHiddenDefaultTemplates(value.hiddenDefaultTemplates),
  };
}

export function isHabitScheduledForDate(habit: Habit, value: string, calendarMode: CalendarMode = "sacred") {
  return habit.active && isTrackerScheduledForDate(habit.schedule, value, calendarMode);
}

export function habitScore(habit: Habit, entry: HabitCompletion | undefined, value: string, _today?: string, calendarMode: CalendarMode = "sacred") {
  if (!entry || !isHabitScheduledForDate(habit, value, calendarMode)) return 0;
  return scoreHabitCompletion(habit, entry);
}

export function calculateHabitTotal(workspace: HabitWorkspace) {
  return nonNegativeTrackerTotal([workspace.habitCompletions, workspace.sleepEntries, workspace.addictionEntries]);
}

export function heroicRank(points: number) {
  const safePoints = Math.max(0, points);
  return [...HEROIC_RANKS].reverse().find((rank) => safePoints >= rank.threshold) ?? HEROIC_RANKS[0];
}

export function nextHeroicRank(points: number) {
  return HEROIC_RANKS.find((rank) => Math.max(0, points) < rank.threshold) ?? null;
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
    color: HABIT_COLORS[0],
    active: true,
    sourceTemplateId: null,
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
    title: language === "en" ? template.titleEn : template.title,
    description: language === "en" ? template.descriptionEn : template.description,
    color: template.color,
    preferredTime: template.suggestedTime,
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
