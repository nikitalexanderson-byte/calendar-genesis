import type { Habit, HabitWorkspace } from "./habits";
import type { TrackerSyncState } from "./tracker-core";
import { addCivilDays, momentCivilDate } from "./calendar-context.ts";
import { normalizeHabitMeasurement, habitRuleForDate, normalizeHabitRuleHistory } from "./habit-measurement.ts";
import { habitGoalPeriod, normalizeHabitPeriodGoal } from "./habit-period-goal.ts";

/** Selects the first tracking day before the habit is saved for the first time. */
export function setNewHabitStartDate(habit: Habit, startDate: string, earliestDate: string): Habit {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate < earliestDate) return habit;
  const rangeEnd = habit.schedule.recurrence.rangeEnd;
  const endDate = habit.schedule.endDate;
  return {
    ...habit,
    createdDate: startDate,
    schedule: {
      ...habit.schedule,
      startDate,
      endDate: endDate && endDate < startDate ? startDate : endDate,
      recurrence: {
        ...habit.schedule.recurrence,
        rangeStart: startDate,
        rangeEnd: rangeEnd && rangeEnd < startDate ? startDate : rangeEnd,
      },
    },
  };
}

/**
 * Applies user-editable habit settings while preserving the fields that define
 * scoring, ownership of the original template/practice and the first tracking
 * day. This guard belongs in the domain layer so a stale or modified client
 * cannot silently change the XP formula after a habit has been created.
 */
export function applyEditableHabitUpdate(previous: Habit, candidate: Habit): Habit {
  const measurement = normalizeHabitMeasurement(candidate.measurement);
  const periodGoal = normalizeHabitPeriodGoal(candidate.periodGoal);
  if (periodGoal?.metric === "sum" && !measurement) throw new RangeError("HABIT_PERIOD_MEASUREMENT_REQUIRED");
  const ruleChanged = JSON.stringify(previous.measurement ?? null) !== JSON.stringify(measurement)
    || JSON.stringify(previous.schedule) !== JSON.stringify(candidate.schedule)
    || JSON.stringify(previous.periodGoal ?? null) !== JSON.stringify(periodGoal);
  const previousRules = previous.ruleHistory ?? [];
  const baseline = habitRuleForDate(previous, previous.createdDate);
  const schedule = { ...candidate.schedule, startDate: previous.schedule.startDate,
    recurrence: { ...candidate.schedule.recurrence, rangeStart: previous.schedule.recurrence.rangeStart } };
  const transitionGoal = habitRuleForDate(previous, momentCivilDate(new Date(), previous.schedule.timezone)).periodGoal ?? periodGoal;
  const effectiveDate = transitionGoal
    ? habitGoalPeriod(transitionGoal, momentCivilDate(new Date(), transitionGoal.context.timeZone)).end
    : addCivilDays(momentCivilDate(new Date(), previous.schedule.timezone), 1);
  const ruleHistory = ruleChanged ? normalizeHabitRuleHistory([
    ...(previousRules.length ? previousRules : [baseline]),
    { id: `rule:${crypto.randomUUID()}`,
      effectiveDate, recordedAt: candidate.updatedAt, schedule, measurement, ...(periodGoal ? { periodGoal } : {}) },
  ]) : previousRules;
  return {
    ...candidate,
    measurement,
    periodGoal,
    ruleHistory,
    id: previous.id,
    createdAt: previous.createdAt,
    createdDate: previous.createdDate,
    sourceTemplateId: previous.sourceTemplateId,
    sacredPracticeId: previous.sacredPracticeId,
    sacredSectorId: previous.sacredSectorId,
    scoringMode: previous.scoringMode,
    qualityScale: previous.qualityScale,
    schedule,
  };
}

export function applyHabitReminderSyncResult(
  workspace: HabitWorkspace,
  habitId: string,
  external: Pick<Habit["reminder"], "googleTaskId" | "googleEventId">,
  updatedAt: string,
): HabitWorkspace {
  return {
    ...workspace,
    habits: workspace.habits.map((habit) => habit.id === habitId ? {
      ...habit,
      reminder: { ...habit.reminder, ...external },
      updatedAt,
      version: habit.version + 1,
      syncState: "pending" as TrackerSyncState,
    } : habit),
  };
}
