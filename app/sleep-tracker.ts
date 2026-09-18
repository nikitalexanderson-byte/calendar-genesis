import type { CalendarMode } from "./calendar-data";
import {
  defaultTrackerSchedule,
  normalizeTrackerEntity,
  normalizeTrackerSchedule,
  type TrackerEntity,
  type TrackerSchedule,
} from "./tracker-core";
import { calculateSleepDuration, scoreSleepRules, trackerTimeMinutes } from "./tracker-math";

export type SleepRule = {
  id: string;
  field: "bedtime" | "wake";
  operator: "on-or-before" | "after";
  threshold: string;
  points: number;
};

export type SleepPlan = TrackerEntity & {
  title: string;
  active: boolean;
  schedule: TrackerSchedule;
  targetBedtime: string;
  targetWakeTime: string;
  qualityEnabled: boolean;
  scoringEnabled: boolean;
  rules: SleepRule[];
};

export type SleepEntry = TrackerEntity & {
  planId: string;
  date: string;
  fellAsleepAt: string;
  wokeAt: string;
  durationMinutes: number;
  quality: number | null;
  deviationMinutes: number;
  note: string;
  score: number;
};

export function sleepDurationMinutes(
  date: string,
  fellAsleepAt: string,
  wokeAt: string,
  timeZone: string,
) {
  return calculateSleepDuration(date, fellAsleepAt, wokeAt, timeZone);
}

export function sleepDeviationMinutes(plan: SleepPlan, entry: Pick<SleepEntry, "fellAsleepAt" | "wokeAt">) {
  if (!entry.fellAsleepAt || !entry.wokeAt) return 0;
  const bedtimeDeviation = Math.abs(trackerTimeMinutes(entry.fellAsleepAt) - trackerTimeMinutes(plan.targetBedtime));
  const wakeDeviation = Math.abs(trackerTimeMinutes(entry.wokeAt) - trackerTimeMinutes(plan.targetWakeTime));
  return Math.round((bedtimeDeviation + wakeDeviation) / 2);
}

export function scoreSleepEntry(plan: SleepPlan, entry: Pick<SleepEntry, "fellAsleepAt" | "wokeAt">) {
  return scoreSleepRules(plan.scoringEnabled, plan.rules, entry.fellAsleepAt, entry.wokeAt);
}

export function defaultSleepPlan(date: string, calendarMode: CalendarMode): SleepPlan {
  const now = new Date().toISOString();
  return {
    ...normalizeTrackerEntity({ createdAt: now, updatedAt: now }, "sleep-plan"),
    title: "Сон и пробуждение",
    active: true,
    schedule: defaultTrackerSchedule(date, calendarMode),
    targetBedtime: "23:00",
    targetWakeTime: "07:00",
    qualityEnabled: true,
    scoringEnabled: false,
    rules: [],
  };
}

export function normalizeSleepPlan(value: Record<string, unknown>, fallbackDate: string, calendarMode: CalendarMode): SleepPlan | null {
  if (typeof value.id !== "string" || !value.id) return null;
  return {
    ...normalizeTrackerEntity(value as Partial<TrackerEntity>, "sleep-plan"),
    title: typeof value.title === "string" && value.title ? value.title : "Сон и пробуждение",
    active: value.active !== false,
    schedule: normalizeTrackerSchedule(value.schedule as Partial<TrackerSchedule>, fallbackDate, calendarMode),
    targetBedtime: typeof value.targetBedtime === "string" ? value.targetBedtime : "23:00",
    targetWakeTime: typeof value.targetWakeTime === "string" ? value.targetWakeTime : "07:00",
    qualityEnabled: value.qualityEnabled !== false,
    scoringEnabled: value.scoringEnabled === true,
    rules: Array.isArray(value.rules)
      ? value.rules.filter((rule): rule is SleepRule => Boolean(rule && typeof rule === "object" && typeof (rule as SleepRule).id === "string"))
      : [],
  };
}

export function normalizeSleepEntry(value: Record<string, unknown>, plans: Map<string, SleepPlan>): SleepEntry | null {
  const planId = typeof value.planId === "string" ? value.planId : "";
  const date = typeof value.date === "string" ? value.date : "";
  const plan = plans.get(planId);
  if (!plan || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const fellAsleepAt = typeof value.fellAsleepAt === "string" ? value.fellAsleepAt : "";
  const wokeAt = typeof value.wokeAt === "string" ? value.wokeAt : "";
  const durationMinutes = sleepDurationMinutes(date, fellAsleepAt, wokeAt, plan.schedule.timezone);
  const draft = { fellAsleepAt, wokeAt };
  return {
    ...normalizeTrackerEntity(value as Partial<TrackerEntity>, "sleep-entry"),
    planId,
    date,
    fellAsleepAt,
    wokeAt,
    durationMinutes,
    quality: typeof value.quality === "number" ? Math.max(1, Math.min(10, Math.round(value.quality))) : null,
    deviationMinutes: sleepDeviationMinutes(plan, draft),
    note: typeof value.note === "string" ? value.note : "",
    score: scoreSleepEntry(plan, draft),
  };
}
