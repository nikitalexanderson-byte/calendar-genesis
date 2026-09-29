export type WeekStart = "sunday" | "monday";

export function gregorianWeekdayOffset(date: Date, weekStart: WeekStart) {
  return weekStart === "monday" ? (date.getDay() + 6) % 7 : date.getDay();
}
