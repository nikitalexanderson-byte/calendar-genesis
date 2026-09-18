export const HABIT_PRIORITY_MIN = 1;
export const HABIT_PRIORITY_MAX = 10;
export const DEFAULT_HABIT_PRIORITY = 5;
export const DEFAULT_HABIT_EMOJI = "✨";

export const HABIT_EMOJI_PRESETS = ["✨", "🎯", "💪", "🧠", "📚", "🧘", "🏃", "🌿", "💧", "🌙", "☀️", "🔥"] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

export function normalizeHabitPriority(value: unknown) {
  return Math.max(HABIT_PRIORITY_MIN, Math.min(HABIT_PRIORITY_MAX, Math.round(Number(value) || DEFAULT_HABIT_PRIORITY)));
}

export function normalizeHabitEmoji(value: unknown) {
  if (typeof value !== "string") return DEFAULT_HABIT_EMOJI;
  const normalized = Array.from(value.trim()).slice(0, 8).join("");
  return normalized && EMOJI_PATTERN.test(normalized) ? normalized : DEFAULT_HABIT_EMOJI;
}

export function canRecordHabitOnDate(createdDate: string, date: string, today: string) {
  return DATE_PATTERN.test(createdDate) && DATE_PATTERN.test(date) && DATE_PATTERN.test(today)
    && date === today
    && date >= createdDate;
}
