export type DailyGoalMode = "easy" | "rhythm" | "perfect";
export type DailyGoalStatus = "open" | "qualified" | "perfect" | "missed" | "neutral" | "rest" | "timezone-shift";

export type DailyGoalModeChange = {
  effectiveFrom: string;
  mode: DailyGoalMode;
  updatedAt: string;
};

export type DailyGoalRecord = {
  date: string;
  mode: DailyGoalMode;
  timezone: string;
  scheduledCount: number;
  completedCount: number;
  targetCount: number;
  status: DailyGoalStatus;
  updatedAt: string;
};

export type DailyGoalStreakSummary = {
  currentStreak: number;
  longestStreak: number;
  lastQualifiedDate: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MODES: readonly DailyGoalMode[] = ["easy", "rhythm", "perfect"];
const STATUSES: readonly DailyGoalStatus[] = ["open", "qualified", "perfect", "missed", "neutral", "rest", "timezone-shift"];

function safeCount(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function isDailyGoalMode(value: unknown): value is DailyGoalMode {
  return MODES.includes(value as DailyGoalMode);
}

export function dailyGoalTarget(mode: DailyGoalMode, scheduledCount: number) {
  const scheduled = safeCount(scheduledCount);
  if (!scheduled) return 0;
  if (mode === "easy") return 1;
  if (mode === "perfect") return scheduled;
  return Math.max(1, Math.ceil(scheduled * 0.6));
}

export function normalizeDailyGoalModeChanges(value: unknown): DailyGoalModeChange[] {
  if (!Array.isArray(value)) return [];
  const changes = new Map<string, DailyGoalModeChange>();
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const source = item as Partial<DailyGoalModeChange>;
    if (!DATE_PATTERN.test(source.effectiveFrom ?? "") || !isDailyGoalMode(source.mode)) return;
    const updatedAt = typeof source.updatedAt === "string" ? source.updatedAt : "";
    const previous = changes.get(source.effectiveFrom!);
    if (!previous || updatedAt >= previous.updatedAt) {
      changes.set(source.effectiveFrom!, { effectiveFrom: source.effectiveFrom!, mode: source.mode, updatedAt });
    }
  });
  return Array.from(changes.values()).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

export function dailyGoalModeForDate(changes: readonly DailyGoalModeChange[], date: string) {
  return changes.reduce<DailyGoalMode>(
    (mode, change) => change.effectiveFrom <= date ? change.mode : mode,
    "rhythm",
  );
}

export function scheduleDailyGoalMode(
  changes: readonly DailyGoalModeChange[],
  mode: DailyGoalMode,
  effectiveFrom: string,
  updatedAt = new Date().toISOString(),
) {
  return normalizeDailyGoalModeChanges([
    ...changes.filter((change) => change.effectiveFrom !== effectiveFrom),
    { effectiveFrom, mode, updatedAt },
  ]);
}

export function buildDailyGoalRecord(input: {
  date: string;
  mode: DailyGoalMode;
  timezone: string;
  scheduledCount: number;
  completedCount: number;
  today: string;
  isRestDay?: boolean;
  isTimezoneShift?: boolean;
  updatedAt?: string;
}): DailyGoalRecord {
  const scheduledCount = safeCount(input.scheduledCount);
  const completedCount = Math.min(scheduledCount, safeCount(input.completedCount));
  const targetCount = dailyGoalTarget(input.mode, scheduledCount);
  const status: DailyGoalStatus = input.isRestDay
    ? "rest"
    : input.isTimezoneShift
      ? "timezone-shift"
      : scheduledCount === 0
        ? "neutral"
        : completedCount === scheduledCount
          ? "perfect"
          : completedCount >= targetCount
            ? "qualified"
            : input.date < input.today ? "missed" : "open";
  return {
    date: input.date,
    mode: input.mode,
    timezone: input.timezone || "UTC",
    scheduledCount,
    completedCount,
    targetCount,
    status,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export function normalizeDailyGoalRecords(value: unknown): DailyGoalRecord[] {
  if (!Array.isArray(value)) return [];
  const records = new Map<string, DailyGoalRecord>();
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const source = item as Partial<DailyGoalRecord>;
    if (!DATE_PATTERN.test(source.date ?? "") || !isDailyGoalMode(source.mode) || !STATUSES.includes(source.status as DailyGoalStatus)) return;
    const scheduledCount = safeCount(source.scheduledCount);
    const completedCount = Math.min(scheduledCount, safeCount(source.completedCount));
    const targetCount = Math.min(scheduledCount, safeCount(source.targetCount));
    const record: DailyGoalRecord = {
      date: source.date!,
      mode: source.mode,
      timezone: typeof source.timezone === "string" && source.timezone ? source.timezone : "UTC",
      scheduledCount,
      completedCount,
      targetCount,
      status: source.status as DailyGoalStatus,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    };
    const previous = records.get(record.date);
    if (!previous || record.updatedAt >= previous.updatedAt) records.set(record.date, record);
  });
  return Array.from(records.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function upsertDailyGoalRecord(records: readonly DailyGoalRecord[], record: DailyGoalRecord) {
  return normalizeDailyGoalRecords([...records.filter((item) => item.date !== record.date), record]);
}

export function calculateGlobalStreak(records: readonly DailyGoalRecord[], today: string): DailyGoalStreakSummary {
  let currentStreak = 0;
  let longestStreak = 0;
  let lastQualifiedDate: string | null = null;
  normalizeDailyGoalRecords(records).forEach((record) => {
    if (record.date > today) return;
    if (record.status === "perfect" || record.status === "qualified") {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      lastQualifiedDate = record.date;
    } else if (record.status === "missed") {
      currentStreak = 0;
    }
  });
  return { currentStreak, longestStreak, lastQualifiedDate };
}
