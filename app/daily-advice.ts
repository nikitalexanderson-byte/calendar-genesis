import type { Habit } from "./habits";
import { habitLifecycleState } from "./habit-lifecycle.ts";
import affinity from "./daily-advice-affinity.json" with { type: "json" };

export const ADVICE_CATEGORIES = ["aretology", "hermetica", "kourotrophy", "hestiology", "aphrodisia", "psychopompia"] as const;
export type AdviceCategory = typeof ADVICE_CATEGORIES[number];
export type AdvicePreferences = { enabled: boolean; smart: boolean; categories: AdviceCategory[] };
export type AdviceScores = Record<AdviceCategory, number>;
export type DailyAdvice = {
  id: string; dayKey: string; categories: AdviceCategory[]; body: string; language: string; dismissed: boolean;
  sources: { author?: string; work: string; reference?: string; kind: "inspired" | "quote" }[];
};
export type DailyAdviceResponse = { dayKey: string; advice: DailyAdvice | null; state: "disabled" | "empty" | "no-match" | "ready" };

export function advicePreferences(value?: Partial<AdvicePreferences> | null): AdvicePreferences {
  const categories = ADVICE_CATEGORIES.filter(id => !value?.categories || value.categories.includes(id));
  return { enabled: value?.enabled !== false, smart: value?.smart !== false, categories: categories.length ? categories : [...ADVICE_CATEGORIES] };
}

/** Only six numeric affinities leave the device. Never send habit text or infer mental-health diagnoses. */
export function adviceHabitScores(habits: readonly Habit[], day: string): AdviceScores {
  const scores = Object.fromEntries(ADVICE_CATEGORIES.map(id => [id, 0])) as AdviceScores;
  for (const habit of habits) {
    const state = habitLifecycleState(habit, day);
    if (state.status !== "active" || state.conflict || habit.createdDate > day
      || habit.schedule.startDate > day || (habit.schedule.endDate && habit.schedule.endDate < day)) continue;
    const text = `${habit.title} ${habit.description} ${habit.ritualName}`.normalize("NFKC").toLocaleLowerCase();
    const tokens = text.split(/[^\p{L}\p{N}]+/u);
    const weight = 1 + (habit.isKeyHabit ? 1 : 0) + Math.min(3, Math.max(0, habit.priority || 0)) / 3;
    for (const id of ADVICE_CATEGORIES) {
      const rule = affinity[id];
      const templateMatch = (rule.templates as string[]).includes(habit.sourceTemplateId || "");
      const practiceMatch = (rule.sectors as string[]).includes(habit.sacredSectorId || "");
      const words = rule.words.reduce((count, word) => count + (tokens.some(token => word.length <= 4 && /^[a-z]+$/.test(word) ? token === word : token.startsWith(word)) ? 1 : 0), 0);
      scores[id] = Math.min(1000, scores[id] + weight * (Number(templateMatch) * 3 + Number(practiceMatch) * 2 + Math.min(3, words)));
    }
  }
  return scores;
}
