export const HABIT_SECTION_IDS = [
  "streak-resilience",
  "daily-trackers",
  "quests",
  "streak-rewards",
  "adaptive-suggestions",
  "starter-habits",
  "regular-habits",
  "sleep-abstinence",
  "achievements",
  "statistics",
] as const;

export type HabitSectionId = typeof HABIT_SECTION_IDS[number];

export function normalizeHabitCollapsedSections(value: unknown): HabitSectionId[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((section): section is HabitSectionId => (
    typeof section === "string" && HABIT_SECTION_IDS.includes(section as HabitSectionId)
  ))));
}
