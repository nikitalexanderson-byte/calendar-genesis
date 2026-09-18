export type HeroicRankId =
  | "lion-heart"
  | "venom-vanquisher"
  | "golden-horn-pathfinder"
  | "mountain-tamer"
  | "lord-of-the-current"
  | "bronze-wing"
  | "tamer-of-might"
  | "iron-charioteer"
  | "royal-honor-bearer"
  | "western-verge-guardian"
  | "golden-garden-keeper"
  | "risen-from-the-abyss";

export type HeroicRank = {
  id: HeroicRankId;
  title: string;
  titleEn: string;
  threshold: number;
  symbol: string;
  color: string;
};

export type UserProgress = {
  lifetimeXp: number;
  currentRankId: HeroicRankId | null;
  currentStreak: number;
  longestStreak: number;
  lastQualifiedDate: string | null;
  streakGoalMode: "easy" | "rhythm" | "perfect";
  streakFreezeCount: number;
  updatedAt: string;
};

export const HEROIC_RANKS: readonly HeroicRank[] = [
  { id: "lion-heart", title: "Львиное Сердце", titleEn: "Lionheart", threshold: 10, symbol: "✦", color: "#aa6f3f" },
  { id: "venom-vanquisher", title: "Победитель Яда", titleEn: "Vanquisher of Venom", threshold: 100, symbol: "⌁", color: "#71855c" },
  { id: "golden-horn-pathfinder", title: "Златорогий Следопыт", titleEn: "Golden-Horned Pathfinder", threshold: 250, symbol: "◇", color: "#b88a43" },
  { id: "mountain-tamer", title: "Горный Укротитель", titleEn: "Mountain Tamer", threshold: 450, symbol: "△", color: "#777b78" },
  { id: "lord-of-the-current", title: "Владыка Потока", titleEn: "Lord of the Current", threshold: 700, symbol: "≈", color: "#397a79" },
  { id: "bronze-wing", title: "Бронзовое Крыло", titleEn: "Bronze Wing", threshold: 1_000, symbol: "❧", color: "#a96f4f" },
  { id: "tamer-of-might", title: "Укротитель Мощи", titleEn: "Tamer of Might", threshold: 1_400, symbol: "ϟ", color: "#986946" },
  { id: "iron-charioteer", title: "Железный Возничий", titleEn: "Iron Charioteer", threshold: 1_900, symbol: "♜", color: "#737b7c" },
  { id: "royal-honor-bearer", title: "Носитель Царской Чести", titleEn: "Bearer of Royal Honor", threshold: 2_500, symbol: "♛", color: "#b38a4f" },
  { id: "western-verge-guardian", title: "Страж Западного Предела", titleEn: "Guardian of the Western Verge", threshold: 3_300, symbol: "◈", color: "#5d718c" },
  { id: "golden-garden-keeper", title: "Хранитель Золотого Сада", titleEn: "Keeper of the Golden Garden", threshold: 4_300, symbol: "❦", color: "#a9873e" },
  { id: "risen-from-the-abyss", title: "Восставший из Бездны", titleEn: "Risen from the Abyss", threshold: 5_600, symbol: "☼", color: "#d0ad5a" },
] as const;

export const UNRANKED_HEROIC_STATE = {
  id: "unranked",
  title: "Путь ещё не начат",
  titleEn: "The path has not begun",
  threshold: 0,
  symbol: "·",
  color: "#70736d",
} as const;

function safeXp(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function highestRankForXp(lifetimeXp: number) {
  const xp = safeXp(lifetimeXp);
  return [...HEROIC_RANKS].reverse().find((rank) => xp >= rank.threshold) ?? null;
}

export function heroicRank(lifetimeXp: number) {
  return highestRankForXp(lifetimeXp) ?? UNRANKED_HEROIC_STATE;
}

export function nextHeroicRank(lifetimeXp: number) {
  const xp = safeXp(lifetimeXp);
  return HEROIC_RANKS.find((rank) => xp < rank.threshold) ?? null;
}

export function completionXpAward(previousAward: unknown, completionScore: unknown) {
  return Math.max(safeXp(previousAward), safeXp(completionScore));
}

export function reconcileUserProgress(
  value: Partial<UserProgress> | null | undefined,
  sources: ReadonlyArray<{ xpAwarded?: number }>,
  timestamp = new Date().toISOString(),
  streak?: { currentStreak: number; longestStreak: number; lastQualifiedDate: string | null },
): UserProgress {
  const awardedXp = sources.reduce((total, source) => total + safeXp(source.xpAwarded), 0);
  const lifetimeXp = Math.max(safeXp(value?.lifetimeXp), awardedXp);
  const currentRankId = highestRankForXp(lifetimeXp)?.id ?? null;
  const currentStreak = streak?.currentStreak ?? safeXp(value?.currentStreak);
  const longestStreak = Math.max(streak?.longestStreak ?? safeXp(value?.longestStreak), currentStreak);
  const lastQualifiedDate = streak?.lastQualifiedDate ?? (typeof value?.lastQualifiedDate === "string" ? value.lastQualifiedDate : null);
  const streakGoalMode = ["easy", "rhythm", "perfect"].includes(value?.streakGoalMode ?? "") ? value!.streakGoalMode! : "rhythm";
  const streakFreezeCount = safeXp(value?.streakFreezeCount);
  const changed = lifetimeXp !== safeXp(value?.lifetimeXp)
    || currentRankId !== (value?.currentRankId ?? null)
    || currentStreak !== safeXp(value?.currentStreak)
    || longestStreak !== safeXp(value?.longestStreak)
    || lastQualifiedDate !== (value?.lastQualifiedDate ?? null)
    || (value?.streakGoalMode !== undefined && streakGoalMode !== value.streakGoalMode)
    || streakFreezeCount !== safeXp(value?.streakFreezeCount);
  return {
    lifetimeXp,
    currentRankId,
    currentStreak,
    longestStreak,
    lastQualifiedDate,
    streakGoalMode,
    streakFreezeCount,
    updatedAt: !changed && typeof value?.updatedAt === "string" && value.updatedAt ? value.updatedAt : timestamp,
  };
}
