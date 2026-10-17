import { calendarContext, momentCivilDate } from "./calendar-context.ts";
import { habitRuleForDate } from "./habit-measurement.ts";
import { habitRuleState } from "./habit-rule-history.ts";
import { calendarModeForRecurrence } from "./task-recurrence.ts";
import { normalizeHabitWorkspace, isHabitScheduledForDate, recordHabitMeasurement,
  type HabitWorkspace } from "./habits.ts";
import { appendHabitTimerOperation, habitTimerDayAllocations, habitTimerSessions, startHabitTimer,
  type HabitTimerOperation, type HabitTimerPlan } from "./habit-timer.ts";

export type HabitTimerCommand = {
  action: HabitTimerOperation["action"];
  owner: string;
  at: string;
  id: string;
  sessionId?: string;
  habitId?: string;
  mode?: HabitTimerPlan["mode"];
  workMinutes?: number;
  breakMinutes?: number;
  branchId?: string;
  timeOnly?: boolean;
};

/** One pure mutation is queued durably by the existing workspace adapter before the UI closes. */
export function applyHabitTimerCommand(workspace: HabitWorkspace, command: HabitTimerCommand, now = new Date()): HabitWorkspace {
  const operations = workspace.habitTimers ?? [];
  if (command.action === "start") {
    const habit = workspace.habits.find(item => item.id === command.habitId);
    if (!habit) throw new RangeError("HABIT_TIMER_GOAL_CHANGED");
    const date = momentCivilDate(new Date(command.at), habit.periodGoal?.context.timeZone ?? habit.schedule.timezone);
    if (!isHabitScheduledForDate(habit, date)) throw new RangeError("HABIT_TIMER_DATE_UNAVAILABLE");
    const rule = habitRuleForDate(habit, date);
    const context = calendarContext({ ...(rule.periodGoal?.context ?? rule.schedule.recurrence.calendarContext),
      timeZone: rule.periodGoal?.context.timeZone ?? rule.schedule.timezone });
    const plan: HabitTimerPlan = { mode: command.mode ?? "stopwatch", workMinutes: command.workMinutes ?? 25,
      breakMinutes: command.breakMinutes ?? 5, timeZone: context.timeZone, context,
      calendarMode: rule.periodGoal?.calendar ?? calendarModeForRecurrence(rule.schedule.recurrence.mode),
      habitTitle: habit.title, ruleId: rule.id };
    return { ...workspace, habitTimers: startHabitTimer(operations, habit.id, command.owner, plan, command.at, command.id, workspace.habitTimerEpoch) };
  }
  const session = habitTimerSessions(operations).find(item => item.id === command.sessionId);
  if (!session || session.root.owner !== command.owner) throw new RangeError("HABIT_TIMER_OTHER_DEVICE");
  if (!session.state && command.action !== "resolve") throw new RangeError("HABIT_TIMER_CONFLICT");
  const state = session.state;
  if (command.action === "resume" && !workspace.habits.find(habit => habit.id === session.root.habitId)?.active)
    throw new RangeError("HABIT_TIMER_DATE_UNAVAILABLE");
  if (command.action === "finish") {
    if (state?.status === "finished" || state?.status === "saved") return workspace;
    const habit = workspace.habits.find(item => item.id === session.root.habitId);
    const allocations = habitTimerDayAllocations(state!, Date.parse(command.at)).map(row => {
      const rule = habit ? habitRuleForDate(habit, row.date) : null;
      const reason = !habit || !habit.active || rule?.id !== session.root.plan!.ruleId
        || habitRuleState(habit, row.date).conflicts.length ? "rule-conflict"
        : !isHabitScheduledForDate(habit, row.date) ? "not-scheduled"
          : rule?.measurement?.kind === "duration" ? "duration" : "not-duration";
      return { ...row, ruleId: rule?.id ?? session.root.plan!.ruleId, reason } as const;
    });
    return { ...workspace, habitTimers: appendHabitTimerOperation(operations, session.id, command.owner,
      "finish", { at: command.at, id: command.id, allocations }) };
  }
  if (command.action === "save") {
    if (state?.status === "saved") return workspace;
    if (state?.status !== "finished") throw new RangeError("HABIT_TIMER_NOT_FINISHED");
    let next = workspace;
    if (!command.timeOnly) {
      if (state.allocations?.some(row => row.reason === "rule-conflict")) throw new RangeError("HABIT_TIMER_GOAL_CHANGED");
      const habit = workspace.habits.find(item => item.id === session.root.habitId);
      const today = momentCivilDate(now, session.root.plan!.timeZone);
      for (const row of state.allocations ?? []) {
        if (row.reason !== "duration" || row.value === 0) continue;
        if (!habit || !isHabitScheduledForDate(habit, row.date)
          || habitRuleForDate(habit, row.date).id !== row.ruleId
          || habitRuleForDate(habit, row.date).measurement?.kind !== "duration")
          throw new RangeError("HABIT_TIMER_GOAL_CHANGED");
        next = recordHabitMeasurement(next, habit, row.date, row.value,
          { id: `timer-value:${session.id}:${row.date}`, source: "timer",
            recordedAt: state.finishedAt, historical: row.date < today }, today);
      }
    }
    return normalizeHabitWorkspace({ ...next, habitTimers: appendHabitTimerOperation(operations, session.id,
      command.owner, "save", { timeOnly: command.timeOnly }) });
  }
  return { ...workspace, habitTimers: appendHabitTimerOperation(operations, session.id, command.owner,
    command.action, { at: command.at, id: command.id, branchId: command.branchId }) };
}
