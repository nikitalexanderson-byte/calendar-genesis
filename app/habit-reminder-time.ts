import type { Habit } from "./habits";

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function habitReminderTime(habit: Pick<Habit, "preferredTime" | "reminder">): string {
  return habit.reminder.timing !== "custom" && timePattern.test(habit.preferredTime)
    ? habit.preferredTime : habit.reminder.time;
}

export function habitReminderDateTime(date: string, time: string, minutesBefore = 0): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes - Math.min(1440, Math.max(0, Math.trunc(minutesBefore))), 0, 0);
}
