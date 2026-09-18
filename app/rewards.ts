import type { DailyGoalRecord } from "./daily-goal";

export type RewardCurrency = "laurels";
export type RewardReason =
  | "daily-goal"
  | "perfect-day"
  | "weekly-quest"
  | "streak-milestone"
  | "rank-up"
  | "achievement"
  | "hestia-spark";

export type RewardTransaction = {
  readonly id: string;
  readonly userId: "self";
  readonly currency: RewardCurrency;
  readonly amount: number;
  readonly reason: RewardReason;
  readonly sourceId: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
};

export const DAILY_GOAL_LAURELS = 5;
export const PERFECT_DAY_LAURELS = 3;

const REWARD_REASONS: readonly RewardReason[] = [
  "daily-goal",
  "perfect-day",
  "weekly-quest",
  "streak-milestone",
  "rank-up",
  "achievement",
  "hestia-spark",
];

function rewardAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function isRewardReason(value: unknown): value is RewardReason {
  return REWARD_REASONS.includes(value as RewardReason);
}

function rewardId(idempotencyKey: string) {
  return `reward:${idempotencyKey}`;
}

export function createRewardTransaction(input: {
  amount: number;
  reason: RewardReason;
  sourceId: string;
  idempotencyKey: string;
  createdAt?: string;
}): RewardTransaction {
  return {
    id: rewardId(input.idempotencyKey),
    userId: "self",
    currency: "laurels",
    amount: rewardAmount(input.amount),
    reason: input.reason,
    sourceId: input.sourceId,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function normalizeRewardTransactions(value: unknown): RewardTransaction[] {
  if (!Array.isArray(value)) return [];
  const transactions = new Map<string, RewardTransaction>();
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const source = item as Partial<RewardTransaction>;
    const idempotencyKey = typeof source.idempotencyKey === "string" ? source.idempotencyKey.trim() : "";
    const sourceId = typeof source.sourceId === "string" ? source.sourceId.trim() : "";
    const amount = rewardAmount(source.amount);
    if (!idempotencyKey || !sourceId || !amount || source.currency !== "laurels" || !isRewardReason(source.reason)) return;
    const transaction: RewardTransaction = {
      id: typeof source.id === "string" && source.id ? source.id : rewardId(idempotencyKey),
      userId: "self",
      currency: "laurels",
      amount,
      reason: source.reason,
      sourceId,
      idempotencyKey,
      createdAt: typeof source.createdAt === "string" ? source.createdAt : "",
    };
    const previous = transactions.get(idempotencyKey);
    if (!previous || transaction.createdAt < previous.createdAt) transactions.set(idempotencyKey, transaction);
  });
  return Array.from(transactions.values()).sort((a, b) => (
    a.createdAt.localeCompare(b.createdAt) || a.idempotencyKey.localeCompare(b.idempotencyKey)
  ));
}

export function calculateLaurelsBalance(transactions: readonly RewardTransaction[]) {
  return normalizeRewardTransactions(transactions).reduce((total, transaction) => total + transaction.amount, 0);
}

export function laurelsForDailyGoal(record: Pick<DailyGoalRecord, "status">) {
  if (record.status === "perfect") return DAILY_GOAL_LAURELS + PERFECT_DAY_LAURELS;
  if (record.status === "qualified") return DAILY_GOAL_LAURELS;
  return 0;
}

export function reconcileDailyGoalRewards(
  records: readonly DailyGoalRecord[],
  value: unknown,
  today: string,
  timestamp = new Date().toISOString(),
) {
  const transactions = normalizeRewardTransactions(value);
  const knownKeys = new Set(transactions.map((transaction) => transaction.idempotencyKey));
  [...records].sort((a, b) => a.date.localeCompare(b.date)).forEach((record) => {
    if (record.date > today || !["qualified", "perfect"].includes(record.status)) return;
    const dailyKey = `daily-goal:self:${record.date}`;
    if (!knownKeys.has(dailyKey)) {
      transactions.push(createRewardTransaction({
        amount: DAILY_GOAL_LAURELS,
        reason: "daily-goal",
        sourceId: record.date,
        idempotencyKey: dailyKey,
        createdAt: record.updatedAt || timestamp,
      }));
      knownKeys.add(dailyKey);
    }
    const perfectKey = `perfect-day:self:${record.date}`;
    if (record.status === "perfect" && !knownKeys.has(perfectKey)) {
      transactions.push(createRewardTransaction({
        amount: PERFECT_DAY_LAURELS,
        reason: "perfect-day",
        sourceId: record.date,
        idempotencyKey: perfectKey,
        createdAt: record.updatedAt || timestamp,
      }));
      knownKeys.add(perfectKey);
    }
  });
  return normalizeRewardTransactions(transactions);
}
