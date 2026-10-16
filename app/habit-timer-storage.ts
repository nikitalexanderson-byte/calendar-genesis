import { habitTimerEpoch, mergeHabitTimerOperations } from "./habit-timer.ts";
import { mergeHabitMeasurementEvents } from "./habit-measurement.ts";
import { normalizeRewardTransactions } from "./rewards.ts";
import type { HabitCompletion } from "./habits";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Ordinary stale form writes cannot erase an immutable timer or its already credited result. */
export function preserveHabitTimerRecords<T>(incoming: T, saved: unknown): T {
  if (!record(incoming) || !Array.isArray(incoming.habitTimers) || !record(saved)) return incoming;
  const epoch = habitTimerEpoch(incoming.habitTimerEpoch), previousEpoch = habitTimerEpoch(saved.habitTimerEpoch);
  if (epoch < previousEpoch) throw new RangeError("HABIT_TIMER_RESET");
  if (epoch > previousEpoch) return incoming;
  const habitTimers = mergeHabitTimerOperations(incoming.habitTimers, saved.habitTimers ?? []).filter(op => op.epoch === epoch);
  if (!habitTimers.length) return incoming;
  const currentEvents = mergeHabitMeasurementEvents(incoming.habitMeasurements ?? []);
  const savedEvents = mergeHabitMeasurementEvents(saved.habitMeasurements ?? []);
  const habitIds = new Set((Array.isArray(incoming.habits) ? incoming.habits : []).flatMap(habit => record(habit) && typeof habit.id === "string" ? [habit.id] : []));
  const timerEntries = new Set([...currentEvents, ...savedEvents].filter(event => event.source === "timer" && event.entryId.startsWith("timer-value:")).map(event => event.entryId));
  const retained = savedEvents.filter(event => habitIds.has(event.habitId) && timerEntries.has(event.entryId));
  const habitMeasurements = mergeHabitMeasurementEvents(currentEvents, retained);
  const timedDays = new Set(habitMeasurements.filter(event => timerEntries.has(event.entryId)).map(event => `${event.habitId}:${event.date}`));
  const completions = new Map<string, HabitCompletion>();
  for (const row of (Array.isArray(incoming.habitCompletions) ? incoming.habitCompletions : []) as HabitCompletion[])
    completions.set(`${row.habitId}:${row.date}`, row);
  for (const row of (Array.isArray(saved.habitCompletions) ? saved.habitCompletions : []) as HabitCompletion[]) {
    const id = `${row.habitId}:${row.date}`;
    if (!habitIds.has(row.habitId) || !timedDays.has(id)) continue;
    const current = completions.get(id);
    completions.set(id, current ? { ...current, xpAwarded: Math.max(current.xpAwarded, row.xpAwarded) } : row);
  }
  return { ...incoming, habitTimers, habitMeasurements, habitCompletions: [...completions.values()],
    rewardTransactions: normalizeRewardTransactions([...(Array.isArray(incoming.rewardTransactions) ? incoming.rewardTransactions : []),
      ...(Array.isArray(saved.rewardTransactions) ? saved.rewardTransactions : [])]) } as T;
}

export function habitTimerDeviceOwner(storage: Pick<Storage, "getItem" | "setItem">) {
  const key = "genesis-habit-timer-device-v1";
  const saved = storage.getItem(key);
  if (saved) return saved;
  const owner = `web-${crypto.randomUUID()}`;
  storage.setItem(key, owner); return owner;
}

const lockDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  let blocked = false;
  const request = indexedDB.open("genesis-habit-timer-locks-v1", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("leases");
  request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
  request.onerror = () => reject(request.error);
  request.onblocked = () => { blocked = true; reject(new Error("HABIT_TIMER_BUSY")); };
});

async function fallbackLock<T>(scope: string, task: () => Promise<T>) {
  const db = await lockDatabase(), token = crypto.randomUUID();
  const changeLease = (release = false) => new Promise<boolean>((resolve, reject) => {
    const transaction = db.transaction("leases", "readwrite"); const store = transaction.objectStore("leases");
    let acquired = false;
    const get = store.get(scope);
    get.onsuccess = () => {
      const lease = get.result as { token: string; expiresAt: number } | undefined;
      if (release) { if (lease?.token === token) store.delete(scope); }
      else if (!lease || lease.expiresAt <= Date.now()) { store.put({ token, expiresAt: Date.now() + 120_000 }, scope); acquired = true; }
    };
    transaction.oncomplete = () => resolve(acquired);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("HABIT_TIMER_BUSY"));
  });
  try {
    if (!await changeLease()) throw new Error("HABIT_TIMER_BUSY");
    try { return await task(); } finally { await changeLease(true); }
  } finally { db.close(); }
}

/** HTTPS browsers use Web Locks; the fallback stores only a short-lived mutex, never habit content. */
export function withHabitTimerLock<T>(scope: string, task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(`genesis-habit-timers:${scope}`, task);
  return fallbackLock(scope, task);
}
