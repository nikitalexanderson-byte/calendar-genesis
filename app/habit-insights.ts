import type { CalendarMode } from "./calendar-data";
import type { DailyGoalRecord } from "./daily-goal";
import type { Habit, HabitCompletion, HabitWorkspace } from "./habits";

export const HABIT_MASTERY_MILESTONES = [7, 30, 50, 100, 365, 500, 1_000] as const;

export type HabitWeeklySummary = {
  startDate: string;
  endDate: string;
  completed: number;
  dailyGoals: number;
  perfectDays: number;
  xp: number;
  laurels: number;
  bestHabitTitle: string | null;
  bestHabitCompleted: number;
  previousCompleted: number;
  changePercent: number;
};

export type HabitPersonalRecord = {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  scheduledCount: number;
  completionRate: number;
  bestMonth: string | null;
  bestMonthCompletions: number;
  startedAt: string;
  reachedMilestone: number;
  nextMilestone: number | null;
  milestoneProgress: number;
};

export type HabitYearMosaicCell = {
  date: string;
  status: "future" | "none" | "partial" | "qualified" | "perfect" | "rest";
  completed: number;
  scheduled: number;
  week: number;
  weekday: number;
};

function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, amount: number) {
  const date = localDate(value);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function datesBetween(start: string, end: string, maximum = 20_000) {
  const values: string[] = [];
  for (let date = start; date <= end && values.length < maximum; date = addDays(date, 1)) values.push(date);
  return values;
}

function startOfWeek(value: string) {
  const date = localDate(value);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKey(date);
}

function rewardDate(transaction: HabitWorkspace["rewardTransactions"][number]) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(transaction.sourceId)) return transaction.sourceId;
  return transaction.createdAt.slice(0, 10);
}

function weekMetrics(workspace: HabitWorkspace, startDate: string, endDate: string) {
  const completions = workspace.habitCompletions.filter((entry) => entry.completed && entry.date >= startDate && entry.date <= endDate);
  const perHabit = new Map<string, number>();
  completions.forEach((entry) => perHabit.set(entry.habitId, (perHabit.get(entry.habitId) ?? 0) + 1));
  const best = Array.from(perHabit.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
  const records = workspace.dailyGoalRecords.filter((record) => record.date >= startDate && record.date <= endDate);
  return {
    completed: completions.length,
    dailyGoals: records.filter((record) => record.status === "qualified" || record.status === "perfect").length,
    perfectDays: records.filter((record) => record.status === "perfect").length,
    xp: completions.reduce((total, entry) => total + Math.max(0, entry.xpAwarded), 0),
    laurels: workspace.rewardTransactions
      .filter((transaction) => transaction.amount > 0 && rewardDate(transaction) >= startDate && rewardDate(transaction) <= endDate)
      .reduce((total, transaction) => total + transaction.amount, 0),
    bestHabitTitle: best ? workspace.habits.find((habit) => habit.id === best[0])?.title ?? null : null,
    bestHabitCompleted: best?.[1] ?? 0,
  };
}

export function buildWeeklyHabitSummary(workspace: HabitWorkspace, today: string): HabitWeeklySummary {
  const startDate = startOfWeek(today);
  const endDate = today;
  const previousStart = addDays(startDate, -7);
  const previousEnd = addDays(startDate, -1);
  const current = weekMetrics(workspace, startDate, endDate);
  const previous = weekMetrics(workspace, previousStart, previousEnd);
  const changePercent = previous.completed
    ? Math.round((current.completed - previous.completed) / previous.completed * 100)
    : current.completed ? 100 : 0;
  return { ...current, startDate, endDate, previousCompleted: previous.completed, changePercent };
}

function completionSet(completions: readonly HabitCompletion[], habitId: string) {
  return new Set(completions.filter((entry) => entry.habitId === habitId && entry.completed).map((entry) => entry.date));
}

export function buildHabitPersonalRecord(
  habit: Habit,
  completions: readonly HabitCompletion[],
  today: string,
  calendarMode: CalendarMode,
  isScheduledForDate: (habit: Habit, date: string, calendarMode: CalendarMode) => boolean,
  monthPresentation: (date: string) => { key: string; label: string } = (date) => ({ key: date.slice(0, 7), label: date.slice(0, 7) }),
): HabitPersonalRecord {
  const endDate = habit.schedule.endDate && habit.schedule.endDate < today ? habit.schedule.endDate : today;
  const dates = endDate >= habit.createdDate ? datesBetween(habit.createdDate, endDate) : [];
  const completedDates = completionSet(completions, habit.id);
  const scheduledDates = dates.filter((date) => isScheduledForDate(habit, date, calendarMode));
  let currentStreak = 0;
  let longestStreak = 0;
  let run = 0;
  scheduledDates.forEach((date) => {
    if (completedDates.has(date)) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
      currentStreak = run;
    } else if (date !== today) {
      run = 0;
      currentStreak = 0;
    }
  });
  const completed = completions.filter((entry) => entry.habitId === habit.id && entry.completed && entry.date <= today);
  const byMonth = new Map<string, { count: number; label: string }>();
  completed.forEach((entry) => {
    const presentation = monthPresentation(entry.date);
    const key = presentation.key;
    const current = byMonth.get(key);
    byMonth.set(key, {
      count: (current?.count ?? 0) + 1,
      label: current?.label ?? presentation.label,
    });
  });
  const bestMonth = Array.from(byMonth.entries()).sort((left, right) => right[1].count - left[1].count || right[0].localeCompare(left[0]))[0];
  const totalCompletions = completed.length;
  const reachedMilestone = [...HABIT_MASTERY_MILESTONES].reverse().find((milestone) => totalCompletions >= milestone) ?? 0;
  const nextMilestone = HABIT_MASTERY_MILESTONES.find((milestone) => totalCompletions < milestone) ?? null;
  const milestoneSpan = nextMilestone ? nextMilestone - reachedMilestone : 1;
  const milestoneProgress = nextMilestone
    ? Math.max(0, Math.min(100, Math.round((totalCompletions - reachedMilestone) / milestoneSpan * 100)))
    : 100;
  return {
    habitId: habit.id,
    currentStreak,
    longestStreak,
    totalCompletions,
    scheduledCount: scheduledDates.length,
    completionRate: scheduledDates.length ? Math.min(100, Math.round(totalCompletions / scheduledDates.length * 100)) : 0,
    bestMonth: bestMonth?.[1].label ?? null,
    bestMonthCompletions: bestMonth?.[1].count ?? 0,
    startedAt: habit.createdDate,
    reachedMilestone,
    nextMilestone,
    milestoneProgress,
  };
}

function mosaicStatus(record: DailyGoalRecord | undefined, future: boolean): HabitYearMosaicCell["status"] {
  if (future) return "future";
  if (!record || record.status === "missed" || record.status === "protected") return "none";
  if (record.status === "rest" || record.status === "neutral" || record.status === "timezone-shift") return "rest";
  if (record.status === "perfect") return "perfect";
  if (record.status === "qualified") return "qualified";
  return record.completedCount > 0 ? "partial" : "none";
}

export function buildHabitYearMosaic(records: readonly DailyGoalRecord[], today: string, range?: { start: string; end: string }): HabitYearMosaicCell[] {
  const year = today.slice(0, 4);
  const start = range?.start ?? `${year}-01-01`;
  const end = range?.end ?? `${year}-12-31`;
  const firstWeekday = (localDate(start).getDay() + 6) % 7;
  const byDate = new Map(records.map((record) => [record.date, record]));
  return datesBetween(start, end).map((date, dayIndex) => {
    const record = byDate.get(date);
    return {
      date,
      status: mosaicStatus(record, date > today),
      completed: record?.completedCount ?? 0,
      scheduled: record?.scheduledCount ?? 0,
      week: Math.floor((firstWeekday + dayIndex) / 7) + 1,
      weekday: (firstWeekday + dayIndex) % 7 + 1,
    };
  });
}
