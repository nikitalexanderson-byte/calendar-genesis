import copy from "./stoicheion-timeline.json";
import type { StoicheionDrawRecord } from "./cloud-sync";

export function stoicheionTimelineCopy(language: string) {
  return Object.hasOwn(copy, language) ? copy[language as keyof typeof copy] : copy.en;
}
export type StoicheionTimePosition = (typeof copy.ru.positions)[number];

// Separate from draws-v2: older daily/nine-card clients must not erase this draw.
export const LOCAL_TIMELINE_STORAGE_PREFIX = "genesis-stoicheion-draws-v2:timeline:";
type TimelineStorage = Pick<Storage, "getItem" | "setItem">;

export function readLocalTimelineDraw(storage: Pick<Storage, "getItem">, dayKey: string, now = Date.now()): StoicheionDrawRecord | null {
  try {
    const draw = JSON.parse(storage.getItem(`${LOCAL_TIMELINE_STORAGE_PREFIX}${dayKey}`) || "null") as StoicheionDrawRecord | null;
    if (!draw || draw.kind !== "timeline" || draw.dayKey !== dayKey || ![1, 2].includes(draw.attempts)
      || !Number.isInteger(draw.seed) || draw.seed < 0 || draw.seed > 0xffffffff
      || !Number.isFinite(Date.parse(draw.firstDrawAt)) || !Number.isFinite(Date.parse(draw.rerollDeadline))) return null;
    const remainingSeconds = draw.attempts === 1
      ? Math.max(0, Math.ceil((Date.parse(draw.rerollDeadline) - now) / 1000)) : 0;
    return { ...draw, remainingSeconds, canReroll: draw.attempts === 1 && remainingSeconds > 0 };
  } catch {
    return null;
  }
}

export function saveLocalTimelineDraw(storage: TimelineStorage, seed: number, dayKey: string, now = Date.now()): StoicheionDrawRecord {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Зерно расклада указано неверно.");
  const existing = readLocalTimelineDraw(storage, dayKey, now);
  if (existing && !existing.canReroll) {
    throw new Error(existing.attempts >= 2 ? "Переброс на сегодня уже использован." : "Трёхминутное окно для переброса завершилось.");
  }
  const record: StoicheionDrawRecord = {
    kind: "timeline", dayKey, seed: seed >>> 0, attempts: existing ? 2 : 1,
    firstDrawAt: existing?.firstDrawAt ?? new Date(now).toISOString(),
    rerollDeadline: existing?.rerollDeadline ?? new Date(now + 180_000).toISOString(),
    remainingSeconds: existing ? 0 : 180, canReroll: !existing,
  };
  storage.setItem(`${LOCAL_TIMELINE_STORAGE_PREFIX}${dayKey}`, JSON.stringify(record));
  return record;
}
