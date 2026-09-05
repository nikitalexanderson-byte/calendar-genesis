import { getGregorianDate, getMoon, getSacredDate } from "./calendar-data";

export type RecurrenceMode = "none" | "genesis" | "classic" | "lunar";
export type RecurrencePattern = "none" | "pyata-days" | "month-days" | "weekdays" | "lunar-days";

export type RecurrenceConfig = {
  enabled: boolean;
  mode: Exclude<RecurrenceMode, "none">;
  pattern: Exclude<RecurrencePattern, "none">;
  days: number[];
  interval: number;
};

export const DEFAULT_RECURRENCE_CONFIG: RecurrenceConfig = {
  enabled: false,
  mode: "genesis",
  pattern: "pyata-days",
  days: [1],
  interval: 1,
};

export const RECURRENCE_MODE_COPY = {
  genesis: {
    title: "Календарь GENESIS",
    shortTitle: "GENESIS",
    description: "Пяты и сакральные дни внутри 30-дневных месяцев.",
  },
  classic: {
    title: "Классическая неделя",
    shortTitle: "Неделя",
    description: "Дни недели по григорианскому календарю с синхронизацией в Google Calendar.",
  },
  lunar: {
    title: "Лунный календарь",
    shortTitle: "Луна",
    description: "Выбранные лунные дни каждого лунного месяца.",
  },
} as const;

function inputDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseInputDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function apeironLength(sacredYear: number) {
  return (
    Math.round(
      (Date.UTC(sacredYear + 1, 2, 20) - Date.UTC(sacredYear, 2, 20)) /
        86_400_000,
    ) - 360
  );
}

function calendarDayNumber(date: Date) {
  return (date.getDay() + 6) % 7 + 1;
}

function utcDayNumber(date: Date) {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

function mondayOf(date: Date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - (calendarDayNumber(monday) - 1));
  return monday;
}

function recurrenceDayLimit(config: RecurrenceConfig) {
  if (config.mode === "classic") return 7;
  if (config.mode === "genesis" && config.pattern === "pyata-days") return 5;
  return 30;
}

export function normalizeRecurrenceConfig(config: RecurrenceConfig): RecurrenceConfig {
  const expectedPattern = config.mode === "classic"
    ? "weekdays"
    : config.mode === "lunar"
      ? "lunar-days"
      : config.pattern === "month-days" ? "month-days" : "pyata-days";
  const limit = recurrenceDayLimit({ ...config, pattern: expectedPattern });
  const days = Array.from(new Set(config.days
    .map((day) => Math.round(Number(day)))
    .filter((day) => day >= 1 && day <= limit)))
    .sort((left, right) => left - right);
  return {
    enabled: Boolean(config.enabled),
    mode: config.mode,
    pattern: expectedPattern,
    days: days.length ? days : [1],
    interval: Math.min(12, Math.max(1, Math.round(Number(config.interval)) || 1)),
  };
}

export function suggestedRecurrenceDays(
  mode: RecurrenceConfig["mode"],
  pattern: RecurrenceConfig["pattern"],
  startDate: string,
) {
  const date = parseInputDate(startDate) ?? new Date();
  if (mode === "classic") return [calendarDayNumber(date)];
  if (mode === "lunar") return [getMoon(date).day];
  const sacred = getSacredDate(date);
  return [pattern === "month-days" ? Math.min(30, sacred.day) : ((sacred.day - 1) % 5) + 1];
}

export function buildRecurrenceDates(startDate: string, rawConfig: RecurrenceConfig) {
  const start = parseInputDate(startDate);
  if (!start) return [];
  const config = normalizeRecurrenceConfig(rawConfig);
  if (!config.enabled) return [startDate];

  const startSacred = getSacredDate(start);
  const end = getGregorianDate(startSacred.sacredYear, 12, apeironLength(startSacred.sacredYear));
  const selectedDays = new Set(config.days);
  const dates: string[] = [];
  const firstWeekMonday = mondayOf(start);
  let lunarCycle = 0;
  let previousLunarDay = getMoon(start).day;

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    let matches = false;

    if (config.mode === "classic") {
      const weekIndex = Math.floor((utcDayNumber(mondayOf(cursor)) - utcDayNumber(firstWeekMonday)) / 7);
      matches = weekIndex % config.interval === 0 && selectedDays.has(calendarDayNumber(cursor));
    } else if (config.mode === "lunar") {
      const lunarDay = getMoon(cursor).day;
      if (lunarDay < previousLunarDay) lunarCycle += 1;
      previousLunarDay = lunarDay;
      matches = lunarCycle % config.interval === 0 && selectedDays.has(lunarDay);
    } else {
      const sacred = getSacredDate(cursor);
      if (sacred.monthIndex < 12) {
        if (config.pattern === "pyata-days") {
          const startCycle = startSacred.monthIndex * 6 + Math.floor((startSacred.day - 1) / 5);
          const cycle = sacred.monthIndex * 6 + Math.floor((sacred.day - 1) / 5);
          matches = (cycle - startCycle) % config.interval === 0
            && selectedDays.has(((sacred.day - 1) % 5) + 1);
        } else {
          matches = (sacred.monthIndex - startSacred.monthIndex) % config.interval === 0
            && selectedDays.has(sacred.day);
        }
      }
    }

    if (matches) dates.push(inputDate(cursor));
  }

  return dates.length ? dates : [startDate];
}

export function recurrenceConfigFromTask(task: {
  recurrenceMode?: RecurrenceMode;
  recurrencePattern?: RecurrencePattern;
  recurrenceDays?: number[];
  recurrenceInterval?: number;
}): RecurrenceConfig {
  const mode = ["genesis", "classic", "lunar"].includes(task.recurrenceMode ?? "")
    ? task.recurrenceMode as RecurrenceConfig["mode"]
    : "genesis";
  const defaultPattern = mode === "classic" ? "weekdays" : mode === "lunar" ? "lunar-days" : "pyata-days";
  return normalizeRecurrenceConfig({
    enabled: task.recurrenceMode !== undefined && task.recurrenceMode !== "none",
    mode,
    pattern: task.recurrencePattern && task.recurrencePattern !== "none" ? task.recurrencePattern : defaultPattern,
    days: Array.isArray(task.recurrenceDays) ? task.recurrenceDays : [1],
    interval: task.recurrenceInterval ?? 1,
  });
}
