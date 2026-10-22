import type { Habit } from "./habits";
import { habitLifecycleState } from "./habit-lifecycle.ts";
import affinity from "./daily-advice-affinity.json" with { type: "json" };
import topicAffinity from "./daily-advice-topics.json" with { type: "json" };

export const ADVICE_CATEGORIES = ["aretology", "hermetica", "kourotrophy", "hestiology", "aphrodisia", "psychopompia"] as const;
export type AdviceCategory = typeof ADVICE_CATEGORIES[number];
export type AdvicePreferences = { enabled: boolean; smart: boolean; categories: AdviceCategory[] };
export type AdviceScores = Record<AdviceCategory, number>;
export const ADVICE_TOPICS = ["nutrition", "training", "recovery", "discipline"] as const;
export type AdviceTopicScores = Record<typeof ADVICE_TOPICS[number], number>;
export type DailyAdvice = {
  id: string; dayKey: string; categories: AdviceCategory[]; title?: string; image?: string; body: string; language: string; dismissed: boolean;
  sources: { author?: string; work: string; reference?: string; kind: "inspired" | "quote" }[];
};
export type DailyAdviceResponse = { dayKey: string; advice: DailyAdvice | null; state: "disabled" | "empty" | "no-match" | "ready" };

export function advicePreferences(value?: Partial<AdvicePreferences> | null): AdvicePreferences {
  const categories = ADVICE_CATEGORIES.filter(id => !value?.categories || value.categories.includes(id));
  return { enabled: value?.enabled !== false, smart: value?.smart !== false, categories: categories.length ? categories : [...ADVICE_CATEGORIES] };
}

function adviceHabitSignals(habits: readonly Habit[], day: string) {
  const signals = [];
  for (const habit of habits) {
    const state = habitLifecycleState(habit, day);
    if (state.status !== "active" || state.conflict || habit.createdDate > day
      || habit.schedule.startDate > day || (habit.schedule.endDate && habit.schedule.endDate < day)) continue;
    const text = `${habit.title} ${habit.description} ${habit.ritualName}`.normalize("NFKC").toLocaleLowerCase();
    const tokens = text.split(/[^\p{L}\p{N}]+/u);
    const weight = 1 + (habit.isKeyHabit ? 1 : 0) + Math.min(3, Math.max(0, habit.priority || 0)) / 3;
    signals.push({ habit, tokens, weight });
  }
  return signals;
}

function adviceWordMatches(tokens: string[], words: readonly string[]) {
  return words.reduce((count, word) => count + (tokens.some(token => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(word)
    ? token.includes(word) : word.length <= 4 && /^[a-z]+$/.test(word) ? token === word : token.startsWith(word)) ? 1 : 0), 0);
}

/** Only bounded numeric affinities leave the device. Habit text stays local. */
export function adviceHabitScores(habits: readonly Habit[], day: string): AdviceScores {
  const scores = Object.fromEntries(ADVICE_CATEGORIES.map(id => [id, 0])) as AdviceScores;
  for (const { habit, tokens, weight } of adviceHabitSignals(habits, day)) {
    for (const id of ADVICE_CATEGORIES) {
      const rule = affinity[id];
      const templateMatch = (rule.templates as string[]).includes(habit.sourceTemplateId || "");
      const practiceMatch = (rule.sectors as string[]).includes(habit.sacredSectorId || "");
      const words = adviceWordMatches(tokens, rule.words);
      scores[id] = Math.min(1000, scores[id] + weight * (Number(templateMatch) * 3 + Number(practiceMatch) * 2 + Math.min(3, words)));
    }
  }
  return scores;
}

/** Food habits favour nutrition posts without sending their names or inferring health conditions. */
export function adviceHabitTopicScores(habits: readonly Habit[], day: string): AdviceTopicScores {
  const scores = Object.fromEntries(ADVICE_TOPICS.map(id => [id, 0])) as AdviceTopicScores;
  for (const { habit, tokens, weight } of adviceHabitSignals(habits, day)) {
    for (const id of ADVICE_TOPICS) {
      const rule = topicAffinity[id];
      const templateMatch = (rule.templates as string[]).includes(habit.sourceTemplateId || "");
      const words = adviceWordMatches(tokens, rule.words);
      scores[id] = Math.min(1000, scores[id] + weight * (Number(templateMatch) * 3 + Math.min(3, words)));
    }
  }
  return scores;
}

export function adviceAvailableCategories(value?: readonly AdviceCategory[]): AdviceCategory[] {
  // A cached account from before this release has no availability metadata yet.
  return ADVICE_CATEGORIES.filter(id => (value ?? ["aretology"]).includes(id));
}
