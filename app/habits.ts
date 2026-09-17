import { getLunarDate, getSacredDate, type CalendarMode } from "./calendar-data";

export type HabitKind = "positive" | "negative" | "monitor" | "sleep" | "wake";
export type HabitQualityScale = "none" | "ten" | "bipolar";
export type HabitCadence = "daily" | "weekly" | "monthly" | "yearly";
export type HabitRangePreset = "week" | "month" | "half-year" | "year" | "custom" | "forever";

export type HabitSchedule = {
  calendarMode: CalendarMode;
  cadence: HabitCadence;
  interval: number;
  days: number[];
  startDate: string;
  endDate: string | null;
  rangePreset: HabitRangePreset;
};

export type HabitTimeRule = {
  id: string;
  operator: "before" | "after";
  threshold: string;
  points: number;
};

export type HabitReminder = {
  enabled: boolean;
  time: string;
  syncToGoogle: boolean;
  googleTaskId: string | null;
};

export type Habit = {
  id: string;
  title: string;
  description: string;
  kind: HabitKind;
  color: string;
  active: boolean;
  scoringEnabled: boolean;
  completionPoints: number;
  failurePoints: number;
  negativePoints: number;
  qualityScale: HabitQualityScale;
  schedule: HabitSchedule;
  reminder: HabitReminder;
  timeRules: HabitTimeRule[];
  createdAt: string;
  updatedAt: string;
};

export type HabitEntry = {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
  quality: number | null;
  time: string;
  note: string;
  updatedAt: string;
};

export type MoodEntry = {
  date: string;
  moodId: string;
  label: string;
  color: string;
  custom: string;
  updatedAt: string;
};

export type HabitSettings = {
  enabled: boolean;
  reportRange: "week" | "month" | "half-year" | "year" | "custom";
  customRangeStart: string;
  customRangeEnd: string;
};

export type HabitWorkspace = {
  habits: Habit[];
  habitEntries: HabitEntry[];
  moodEntries: MoodEntry[];
  habitSettings: HabitSettings;
};

export const DEFAULT_HABIT_SETTINGS: HabitSettings = {
  enabled: true,
  reportRange: "month",
  customRangeStart: "",
  customRangeEnd: "",
};

export const EMPTY_HABIT_WORKSPACE: HabitWorkspace = {
  habits: [],
  habitEntries: [],
  moodEntries: [],
  habitSettings: DEFAULT_HABIT_SETTINGS,
};

export const HABIT_COLORS = ["#bb8f4a", "#2d7771", "#5271a8", "#8b5f83", "#9b5d4a", "#668b55", "#b06779"];

export const MOOD_OPTIONS = [
  { id: "radiant", label: "Воодушевление", labelEn: "Inspired", symbol: "☀", color: "#e6b84f" },
  { id: "joy", label: "Радость", labelEn: "Joyful", symbol: "✦", color: "#d9985f" },
  { id: "calm", label: "Спокойствие", labelEn: "Calm", symbol: "≈", color: "#6fa7a1" },
  { id: "focused", label: "Сосредоточенность", labelEn: "Focused", symbol: "◉", color: "#557ca8" },
  { id: "confident", label: "Уверенность", labelEn: "Confident", symbol: "▲", color: "#8e9b55" },
  { id: "grateful", label: "Благодарность", labelEn: "Grateful", symbol: "❋", color: "#be8b78" },
  { id: "curious", label: "Любопытство", labelEn: "Curious", symbol: "◇", color: "#7b70a8" },
  { id: "tender", label: "Нежность", labelEn: "Tender", symbol: "♡", color: "#c17e93" },
  { id: "neutral", label: "Ровное", labelEn: "Neutral", symbol: "—", color: "#8a918d" },
  { id: "tired", label: "Усталость", labelEn: "Tired", symbol: "☾", color: "#697584" },
  { id: "sad", label: "Грусть", labelEn: "Sad", symbol: "▽", color: "#58718f" },
  { id: "anxious", label: "Тревога", labelEn: "Anxious", symbol: "≋", color: "#a87555" },
  { id: "irritated", label: "Раздражение", labelEn: "Irritated", symbol: "ϟ", color: "#a95548" },
  { id: "angry", label: "Злость", labelEn: "Angry", symbol: "◆", color: "#923e3e" },
  { id: "empty", label: "Опустошённость", labelEn: "Empty", symbol: "○", color: "#666b70" },
  { id: "overwhelmed", label: "Перегрузка", labelEn: "Overwhelmed", symbol: "✕", color: "#76546f" },
] as const;

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
const DAY_MS = 86_400_000;

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

function utcDay(value: string) {
  const date = habitDate(value);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDistance(from: string, to: string) {
  return Math.round((utcDay(to) - utcDay(from)) / DAY_MS);
}

function calendarCoordinates(date: Date, mode: CalendarMode) {
  if (mode === "sacred") {
    const value = getSacredDate(date);
    return { year: value.sacredYear, month: value.monthIndex + 1, monthSerial: value.sacredYear * 13 + value.monthIndex, day: value.day, cycleDay: (value.day - 1) % 5, cycleLength: 5 };
  }
  if (mode === "lunar") {
    const value = getLunarDate(date);
    return { year: value.year.sacredYear, month: value.monthOrdinal, monthSerial: value.monthIndex, day: value.day, cycleDay: (value.day - 1) % 10, cycleLength: 10 };
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1, monthSerial: date.getFullYear() * 12 + date.getMonth(), day: date.getDate(), cycleDay: date.getDay(), cycleLength: 7 };
}

export function scheduleCycleLabels(mode: CalendarMode) {
  if (mode === "sacred") return ["Земля", "Вода", "Воздух", "Огонь", "Эфир"];
  if (mode === "lunar") return Array.from({ length: 10 }, (_, index) => `${index + 1} день декады`);
  return ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
}

export function isHabitScheduledForDate(habit: Habit, value: string) {
  if (!habit.active || value < habit.schedule.startDate || (habit.schedule.endDate && value > habit.schedule.endDate)) return false;
  const interval = Math.max(1, Math.round(habit.schedule.interval || 1));
  const distance = dayDistance(habit.schedule.startDate, value);
  if (distance < 0) return false;
  const date = habitDate(value);
  const start = habitDate(habit.schedule.startDate);
  const currentCoordinate = calendarCoordinates(date, habit.schedule.calendarMode);
  const startCoordinate = calendarCoordinates(start, habit.schedule.calendarMode);

  if (habit.schedule.cadence === "daily") return distance % interval === 0;
  if (habit.schedule.cadence === "weekly") {
    const selectedDays = habit.schedule.days.length ? habit.schedule.days : [startCoordinate.cycleDay];
    return selectedDays.includes(currentCoordinate.cycleDay)
      && Math.floor(distance / currentCoordinate.cycleLength) % interval === 0;
  }
  if (habit.schedule.cadence === "monthly") {
    const selectedDays = habit.schedule.days.length ? habit.schedule.days : [startCoordinate.day];
    const monthDistance = currentCoordinate.monthSerial - startCoordinate.monthSerial;
    return monthDistance >= 0 && monthDistance % interval === 0 && selectedDays.includes(currentCoordinate.day);
  }
  const yearDistance = currentCoordinate.year - startCoordinate.year;
  return yearDistance >= 0
    && yearDistance % interval === 0
    && currentCoordinate.month === startCoordinate.month
    && currentCoordinate.day === startCoordinate.day;
}

export function habitScore(habit: Habit, entry: HabitEntry | undefined, value: string, today = habitDateKey(new Date())) {
  if (!habit.scoringEnabled || !isHabitScheduledForDate(habit, value)) return 0;
  if (!entry?.completed) {
    if (habit.kind === "negative" || habit.kind === "monitor" || value >= today) return 0;
    return habit.failurePoints;
  }
  if (habit.kind === "negative") return habit.negativePoints;
  if (habit.kind === "sleep" || habit.kind === "wake") {
    if (!entry.time) return habit.completionPoints;
    const minute = timeToMinutes(entry.time);
    const matched = habit.timeRules.filter((rule) => {
      const threshold = timeToMinutes(rule.threshold);
      return rule.operator === "before" ? minute <= threshold : minute > threshold;
    });
    return matched.length ? matched.reduce((sum, rule) => sum + rule.points, 0) : habit.completionPoints;
  }
  if (habit.qualityScale === "ten" && entry.quality !== null) return Math.max(1, Math.min(10, entry.quality));
  if (habit.qualityScale === "bipolar" && entry.quality !== null) return Math.max(-5, Math.min(5, entry.quality));
  return habit.completionPoints;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

export function calculateHabitTotal(workspace: HabitWorkspace, today = habitDateKey(new Date())) {
  if (!workspace.habits.length) return 0;
  const firstDate = workspace.habits.map((habit) => habit.schedule.startDate).sort()[0] ?? today;
  const entriesByHabitAndDate = new Map(
    workspace.habitEntries.map((entry) => [`${entry.habitId}:${entry.date}`, entry]),
  );
  let total = 0;
  let scannedDays = 0;
  for (let value = firstDate; value <= today && scannedDays < 20_000; value = addHabitDays(value, 1)) {
    workspace.habits.forEach((habit) => {
      const entry = entriesByHabitAndDate.get(`${habit.id}:${value}`);
      total += habitScore(habit, entry, value, today);
    });
    scannedDays += 1;
  }
  return total;
}

export function heroicRank(points: number) {
  return [...HEROIC_RANKS].reverse().find((rank) => points >= rank.threshold) ?? HEROIC_RANKS[0];
}

export function nextHeroicRank(points: number) {
  return HEROIC_RANKS.find((rank) => points < rank.threshold) ?? null;
}

export function reportDateRange(settings: HabitSettings, today = habitDateKey(new Date())) {
  if (settings.reportRange === "custom" && DATE_PATTERN.test(settings.customRangeStart) && DATE_PATTERN.test(settings.customRangeEnd)) {
    const end = settings.customRangeEnd > today ? today : settings.customRangeEnd;
    const start = settings.customRangeStart > end ? end : settings.customRangeStart;
    return { start, end };
  }
  const days = settings.reportRange === "week" ? 7 : settings.reportRange === "month" ? 30 : settings.reportRange === "half-year" ? 183 : 365;
  return { start: addHabitDays(today, -(days - 1)), end: today };
}

export function dateValuesBetween(start: string, end: string) {
  const result: string[] = [];
  for (let value = start; value <= end && result.length < 740; value = addHabitDays(value, 1)) result.push(value);
  return result;
}

export function normalizeHabitWorkspace(value: Partial<HabitWorkspace> | null | undefined): HabitWorkspace {
  const habits = Array.isArray(value?.habits) ? value.habits.filter((habit): habit is Habit => Boolean(habit?.id && habit?.title && habit?.schedule?.startDate)) : [];
  const habitIds = new Set(habits.map((habit) => habit.id));
  const habitEntries = Array.isArray(value?.habitEntries)
    ? value.habitEntries.filter((entry): entry is HabitEntry => Boolean(entry?.id && habitIds.has(entry.habitId) && DATE_PATTERN.test(entry.date)))
    : [];
  const moodEntries = Array.isArray(value?.moodEntries)
    ? value.moodEntries.filter((entry): entry is MoodEntry => Boolean(DATE_PATTERN.test(entry?.date ?? "")))
    : [];
  return {
    habits,
    habitEntries,
    moodEntries,
    habitSettings: { ...DEFAULT_HABIT_SETTINGS, ...(value?.habitSettings ?? {}) },
  };
}

export function habitRangeEnd(startDate: string, preset: HabitRangePreset, customEnd = "") {
  if (preset === "forever") return null;
  if (preset === "custom") return DATE_PATTERN.test(customEnd) ? customEnd : null;
  const start = habitDate(startDate);
  if (preset === "week") start.setDate(start.getDate() + 6);
  if (preset === "month") start.setMonth(start.getMonth() + 1);
  if (preset === "half-year") start.setMonth(start.getMonth() + 6);
  if (preset === "year") start.setFullYear(start.getFullYear() + 1);
  return habitDateKey(start);
}
