import type { DailyGoalRecord } from "./daily-goal.ts";
import type { TrackerEntity } from "./tracker-core.ts";

export type AchievementId =
  | "first-step"
  | "three-day-rhythm"
  | "seven-sunrises"
  | "fortnight-rhythm"
  | "perfect-day"
  | "perfect-week"
  | "habit-thirty"
  | "century"
  | "iron-rhythm"
  | "fifty-sunrises"
  | "hundred-day-path"
  | "half-year-circle"
  | "full-revolution"
  | "five-hundred-sunrises"
  | "thousand-day-path"
  | "comeback"
  | "consistency";

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  hidden: boolean;
  motif: "spark" | "steps" | "sun" | "circle" | "crown" | "leaf" | "column" | "shield" | "return" | "constellation";
};

export type AchievementUnlock = TrackerEntity & {
  userId: "self";
  achievementId: AchievementId;
  unlockedAt: string;
};

type AchievementMetrics = {
  totalCompletions: number;
  longestStreak: number;
  longestPerfectRun: number;
  bestHabitCompletions: number;
  hasPerfectDay: boolean;
  hasComeback: boolean;
};

type AchievementSource = {
  habitCompletions: readonly { habitId: string; completed: boolean }[];
  dailyGoalRecords: readonly Pick<DailyGoalRecord, "date" | "status">[];
  longestStreak: number;
  rewardTransactions: readonly { reason: string }[];
};

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: "first-step", title: "Первый шаг", titleEn: "First Step", description: "Выполнить первую привычку.", descriptionEn: "Complete your first habit.", hidden: false, motif: "spark" },
  { id: "three-day-rhythm", title: "Нить ритма", titleEn: "Thread of Rhythm", description: "Сохранить серию три дня.", descriptionEn: "Keep a three-day streak.", hidden: false, motif: "steps" },
  { id: "seven-sunrises", title: "Семь восходов", titleEn: "Seven Sunrises", description: "Сохранить серию семь дней.", descriptionEn: "Keep a seven-day streak.", hidden: false, motif: "sun" },
  { id: "fortnight-rhythm", title: "Укреплённый ритм", titleEn: "Anchored Rhythm", description: "Сохранить серию 14 дней.", descriptionEn: "Keep a 14-day streak.", hidden: false, motif: "steps" },
  { id: "perfect-day", title: "Завершённый круг", titleEn: "The Complete Circle", description: "Прожить первый идеальный день.", descriptionEn: "Reach your first Perfect Day.", hidden: false, motif: "circle" },
  { id: "perfect-week", title: "Идеальная неделя", titleEn: "Perfect Week", description: "Семь идеальных дней подряд.", descriptionEn: "Reach seven Perfect Days in a row.", hidden: true, motif: "crown" },
  { id: "habit-thirty", title: "Укоренение", titleEn: "Taking Root", description: "Выполнить одну привычку 30 раз.", descriptionEn: "Complete one habit 30 times.", hidden: false, motif: "leaf" },
  { id: "century", title: "Сотня", titleEn: "Century", description: "Выполнить одну привычку 100 раз.", descriptionEn: "Complete one habit 100 times.", hidden: false, motif: "column" },
  { id: "iron-rhythm", title: "Железный ритм", titleEn: "Iron Rhythm", description: "Сохранить серию 30 дней.", descriptionEn: "Keep a 30-day streak.", hidden: false, motif: "shield" },
  { id: "fifty-sunrises", title: "Пятьдесят восходов", titleEn: "Fifty Sunrises", description: "Сохранить серию 50 дней.", descriptionEn: "Keep a 50-day streak.", hidden: false, motif: "sun" },
  { id: "hundred-day-path", title: "Стодневный путь", titleEn: "Hundred-Day Path", description: "Сохранить серию 100 дней.", descriptionEn: "Keep a 100-day streak.", hidden: false, motif: "column" },
  { id: "half-year-circle", title: "Полугодовой круг", titleEn: "Half-Year Circle", description: "Сохранить серию 180 дней.", descriptionEn: "Keep a 180-day streak.", hidden: true, motif: "circle" },
  { id: "full-revolution", title: "Полный оборот", titleEn: "Full Revolution", description: "Сохранить серию 365 дней.", descriptionEn: "Keep a 365-day streak.", hidden: true, motif: "crown" },
  { id: "five-hundred-sunrises", title: "Пятьсот восходов", titleEn: "Five Hundred Sunrises", description: "Сохранить серию 500 дней.", descriptionEn: "Keep a 500-day streak.", hidden: true, motif: "constellation" },
  { id: "thousand-day-path", title: "Тысяча дней пути", titleEn: "A Thousand Days", description: "Сохранить серию 1000 дней.", descriptionEn: "Keep a 1,000-day streak.", hidden: true, motif: "constellation" },
  { id: "comeback", title: "Возвращение", titleEn: "The Return", description: "Завершить путь возвращения после разрыва серии.", descriptionEn: "Complete a comeback after a broken streak.", hidden: true, motif: "return" },
  { id: "consistency", title: "Созвездие постоянства", titleEn: "Constellation of Consistency", description: "Достичь 1000 суммарных выполнений привычек.", descriptionEn: "Reach 1,000 total habit completions.", hidden: true, motif: "constellation" },
] as const;

const ACHIEVEMENT_IDS = new Set<AchievementId>(ACHIEVEMENTS.map((achievement) => achievement.id));

function isAchievementId(value: unknown): value is AchievementId {
  return typeof value === "string" && ACHIEVEMENT_IDS.has(value as AchievementId);
}

function longestPerfectRun(records: readonly Pick<DailyGoalRecord, "date" | "status">[]) {
  const perfectDates = new Set(records.filter((record) => record.status === "perfect").map((record) => record.date));
  const dates = Array.from(perfectDates).sort();
  let best = 0;
  let current = 0;
  let previous = "";
  dates.forEach((date) => {
    const parsed = new Date(`${date}T12:00:00`);
    parsed.setDate(parsed.getDate() - 1);
    const preceding = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    current = previous === preceding ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
  });
  return best;
}

export function achievementMetrics(source: AchievementSource): AchievementMetrics {
  const completed = source.habitCompletions.filter((entry) => entry.completed);
  const perHabit = new Map<string, number>();
  completed.forEach((entry) => perHabit.set(entry.habitId, (perHabit.get(entry.habitId) ?? 0) + 1));
  return {
    totalCompletions: completed.length,
    longestStreak: Math.max(0, Math.round(Number(source.longestStreak) || 0)),
    longestPerfectRun: longestPerfectRun(source.dailyGoalRecords),
    bestHabitCompletions: Math.max(0, ...perHabit.values()),
    hasPerfectDay: source.dailyGoalRecords.some((record) => record.status === "perfect"),
    hasComeback: source.rewardTransactions.some((transaction) => transaction.reason === "comeback"),
  };
}

function qualifies(id: AchievementId, metrics: AchievementMetrics) {
  if (id === "first-step") return metrics.totalCompletions >= 1;
  if (id === "three-day-rhythm") return metrics.longestStreak >= 3;
  if (id === "seven-sunrises") return metrics.longestStreak >= 7;
  if (id === "fortnight-rhythm") return metrics.longestStreak >= 14;
  if (id === "perfect-day") return metrics.hasPerfectDay;
  if (id === "perfect-week") return metrics.longestPerfectRun >= 7;
  if (id === "habit-thirty") return metrics.bestHabitCompletions >= 30;
  if (id === "century") return metrics.bestHabitCompletions >= 100;
  if (id === "iron-rhythm") return metrics.longestStreak >= 30;
  if (id === "fifty-sunrises") return metrics.longestStreak >= 50;
  if (id === "hundred-day-path") return metrics.longestStreak >= 100;
  if (id === "half-year-circle") return metrics.longestStreak >= 180;
  if (id === "full-revolution") return metrics.longestStreak >= 365;
  if (id === "five-hundred-sunrises") return metrics.longestStreak >= 500;
  if (id === "thousand-day-path") return metrics.longestStreak >= 1_000;
  if (id === "comeback") return metrics.hasComeback;
  return metrics.totalCompletions >= 1_000;
}

export function normalizeAchievementUnlocks(value: unknown): AchievementUnlock[] {
  if (!Array.isArray(value)) return [];
  const unlocks = new Map<AchievementId, AchievementUnlock>();
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const source = item as Partial<AchievementUnlock>;
    if (!isAchievementId(source.achievementId)) return;
    const unlockedAt = typeof source.unlockedAt === "string" && !Number.isNaN(Date.parse(source.unlockedAt)) ? source.unlockedAt : "";
    if (!unlockedAt) return;
    const unlock: AchievementUnlock = {
      id: `achievement:${source.achievementId}`,
      userId: "self",
      achievementId: source.achievementId,
      unlockedAt,
      createdAt: typeof source.createdAt === "string" && source.createdAt ? source.createdAt : unlockedAt,
      updatedAt: typeof source.updatedAt === "string" && source.updatedAt ? source.updatedAt : unlockedAt,
      version: Math.max(1, Math.round(Number(source.version) || 1)),
      syncState: ["local", "pending", "synced"].includes(source.syncState ?? "") ? source.syncState! : "local",
    };
    const previous = unlocks.get(unlock.achievementId);
    if (!previous || unlock.version > previous.version || (unlock.version === previous.version && unlock.updatedAt > previous.updatedAt)) unlocks.set(unlock.achievementId, unlock);
  });
  return ACHIEVEMENTS.flatMap((achievement) => {
    const unlock = unlocks.get(achievement.id);
    return unlock ? [unlock] : [];
  });
}

export function reconcileAchievementUnlocks(input: AchievementSource & { unlocks: unknown; timestamp?: string }) {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const existing = normalizeAchievementUnlocks(input.unlocks);
  const unlockedIds = new Set(existing.map((unlock) => unlock.achievementId));
  const metrics = achievementMetrics(input);
  const created = ACHIEVEMENTS.filter((achievement) => !unlockedIds.has(achievement.id) && qualifies(achievement.id, metrics)).map((achievement): AchievementUnlock => ({
    id: `achievement:${achievement.id}`,
    userId: "self",
    achievementId: achievement.id,
    unlockedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    syncState: "local",
  }));
  return normalizeAchievementUnlocks([...existing, ...created]);
}
