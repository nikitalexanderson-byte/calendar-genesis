import type { Habit, HabitWorkspace } from "./habits";
import type { TrackerSyncState } from "./tracker-core";

/**
 * Applies user-editable habit settings while preserving the fields that define
 * scoring, ownership of the original template/practice and the first tracking
 * day. This guard belongs in the domain layer so a stale or modified client
 * cannot silently change the XP formula after a habit has been created.
 */
export function applyEditableHabitUpdate(previous: Habit, candidate: Habit): Habit {
  return {
    ...candidate,
    id: previous.id,
    createdAt: previous.createdAt,
    createdDate: previous.createdDate,
    sourceTemplateId: previous.sourceTemplateId,
    sacredPracticeId: previous.sacredPracticeId,
    sacredSectorId: previous.sacredSectorId,
    scoringMode: previous.scoringMode,
    qualityScale: previous.qualityScale,
    schedule: {
      ...candidate.schedule,
      startDate: previous.schedule.startDate,
      recurrence: {
        ...candidate.schedule.recurrence,
        rangeStart: previous.schedule.recurrence.rangeStart,
      },
    },
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
