"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { CalendarMode } from "./calendar-data";
import type { Language } from "./i18n";
import { formatTimeValue, type TimeFormat } from "./time-format";
import { RecurrenceBuilder } from "./RecurrenceBuilder";
import { HeroicRankSigil } from "./HeroicRankSigil";
import { HeroPathPanel } from "./HeroPathPanel";
import { HabitMetricSigil } from "./HabitMetricSigil";
import { AchievementSigil } from "./AchievementSigil";
import { SACRED_SECTOR_SIGIL_MOTIFS, SacredSectorSigil } from "./SacredSectorSigil";
import {
  HABIT_EMOJI_PRESETS,
  ACHIEVEMENTS,
  HABIT_COLORS,
  HABIT_LAUREL_RETENTION_COMPLETIONS,
  MAX_HABIT_XP_PER_COMPLETION,
  STARTER_HABIT_TEMPLATES,
  COMEBACK_REWARD_LAURELS,
  HESTIA_SPARK_COST,
  HESTIA_SPARK_MAX,
  addHabitDays,
  buyHestiaSpark,
  claimHeroPathAmphora,
  calculateHabitTotal,
  calculateComebackSummary,
  canRecordHabitOnDate,
  createHabitFromSacredPractice,
  createHabitFromTemplate,
  currentHabitQuests,
  dailyGoalForDate,
  dateValuesBetween,
  defaultHabit,
  habitDateKey,
  habitCompletionCount,
  habitRetainsLaurelsOnDeletion,
  heroicRankForProgress,
  isHabitScheduledForDate,
  normalizeHabitEmoji,
  normalizeHabitPriority,
  nextHeroicRankForProgress,
  reportDateRange,
  removeHabitFromWorkspace,
  revealHiddenHeroicPath,
  scoreHabitCompletion,
  setDailyGoalMode,
  setPlannedRestDay,
  updateHabitCompletion,
  type Habit,
  type HabitQualityScale,
  type HabitScoringMode,
  type HabitTemplate,
  type HabitWorkspace,
  type HabitQuest,
  type DailyGoalMode,
  type DailyGoalRecord,
  type RewardReason,
} from "./habits";
import {
  SACRED_AXIS_SECTOR_IDS,
  SACRED_COMPASS_SECTOR_IDS,
  SACRED_SECTOR_NAMES,
  SACRED_THRESHOLD_SECTOR_IDS,
  sacredPracticesForSector,
  type SacredPractice,
  type SacredPracticeSectorId,
} from "./sacred-practices";
import { THEOKYKLOS_SEGMENTS } from "./theokyklos-data";
import { MOOD_SCALE, moodColor, moodOption, type MoodEntry, type MoodValue } from "./mood-tracker";
import {
  defaultSleepPlan,
  scoreSleepEntry,
  sleepDeviationMinutes,
  sleepDurationMinutes,
  type SleepEntry,
  type SleepPlan,
  type SleepRule,
} from "./sleep-tracker";
import {
  addictionStreak,
  defaultAddictionTracker,
  scoreAddictionEntry,
  type AddictionEntry,
  type AddictionTracker,
} from "./addiction-tracker";
import {
  isTrackerScheduledForDate,
  markTrackerEntityChanged,
  newTrackerEntity,
  trackerTimestamp,
} from "./tracker-core";
import { trackerSnapshot } from "./tracker-analytics";
import { applyEditableHabitUpdate } from "./habit-editing";

type DailyPanelProps = {
  workspace: HabitWorkspace;
  date: string;
  language: Language;
  timeFormat: TimeFormat;
  calendarMode: CalendarMode;
  onChange: (workspace: HabitWorkspace) => void;
  onOpenHabits?: () => void;
  compact?: boolean;
  showGoalSettings?: boolean;
};

type HabitTrackerPageProps = DailyPanelProps & {
  googleTasksReady: boolean;
  onReminderRequested?: (habit: Habit) => Promise<{ googleTaskId: string | null; googleEventId: string | null }>;
  onReminderRemoved?: (habit: Habit) => Promise<void>;
  onOpenTheokyklosSector?: (sectorId: SacredPracticeSectorId) => void;
};

function completionFor(workspace: HabitWorkspace, habitId: string, date: string) {
  return workspace.habitCompletions.find((entry) => entry.habitId === habitId && entry.date === date);
}

function replaceMood(workspace: HabitWorkspace, date: string, patch: Partial<MoodEntry>) {
  const current = workspace.moodEntries.find((entry) => entry.date === date);
  const base: MoodEntry = current ?? {
    ...newTrackerEntity("mood"),
    date,
    recordedAt: trackerTimestamp(),
    moodValue: 0,
    note: "",
    tags: [],
  };
  const entry = markTrackerEntityChanged({ ...base, ...patch, recordedAt: trackerTimestamp() });
  return { ...workspace, moodEntries: [...workspace.moodEntries.filter((item) => item.date !== date), entry] };
}

function replaceSleepEntry(workspace: HabitWorkspace, plan: SleepPlan, date: string, patch: Partial<SleepEntry>) {
  const current = workspace.sleepEntries.find((entry) => entry.planId === plan.id && entry.date === date);
  const base: SleepEntry = current ?? {
    ...newTrackerEntity("sleep-entry"),
    planId: plan.id,
    date,
    fellAsleepAt: "",
    wokeAt: "",
    durationMinutes: 0,
    quality: null,
    deviationMinutes: 0,
    note: "",
    score: 0,
  };
  const draft = markTrackerEntityChanged({ ...base, ...patch });
  const entry = {
    ...draft,
    durationMinutes: sleepDurationMinutes(date, draft.fellAsleepAt, draft.wokeAt, plan.schedule.timezone),
    deviationMinutes: sleepDeviationMinutes(plan, draft),
    score: scoreSleepEntry(plan, draft),
  };
  return {
    ...workspace,
    sleepEntries: [...workspace.sleepEntries.filter((item) => !(item.planId === plan.id && item.date === date)), entry],
  };
}

function replaceAddictionEntry(workspace: HabitWorkspace, tracker: AddictionTracker, date: string, patch: Partial<AddictionEntry>) {
  const current = workspace.addictionEntries.find((entry) => entry.trackerId === tracker.id && entry.date === date);
  const base: AddictionEntry = current ?? {
    ...newTrackerEntity("addiction-entry"),
    trackerId: tracker.id,
    date,
    cleanDay: false,
    relapse: false,
    cravingIntensity: 0,
    trigger: "",
    note: "",
    timestamp: trackerTimestamp(),
    score: 0,
  };
  const normalizedPatch = patch.relapse === true ? { ...patch, cleanDay: false } : patch.cleanDay === true ? { ...patch, relapse: false } : patch;
  const draft = markTrackerEntityChanged({ ...base, ...normalizedPatch, timestamp: trackerTimestamp() });
  const entry = { ...draft, score: scoreAddictionEntry(tracker, draft) };
  return {
    ...workspace,
    addictionEntries: [...workspace.addictionEntries.filter((item) => !(item.trackerId === tracker.id && item.date === date)), entry],
  };
}

function qualityLabel(scale: HabitQualityScale, quality: number | null, isEnglish: boolean) {
  if (quality === null) return "—";
  if (scale === "bipolar") return quality > 0 ? `+${quality}` : String(quality);
  if (quality <= 3) return isEnglish ? `${quality} · difficult` : `${quality} · тяжело`;
  if (quality <= 7) return isEnglish ? `${quality} · good` : `${quality} · хорошо`;
  return isEnglish ? `${quality} · excellent` : `${quality} · отлично`;
}

function scoringFormula(mode: HabitScoringMode, isEnglish: boolean) {
  if (mode === "none") return isEnglish ? "Observation only · 0 points" : "Только наблюдение · 0 баллов";
  if (mode === "quality-ten") return isEnglish ? "score = quality (1–10)" : "баллы = качество (1–10)";
  if (mode === "quality-bipolar") return isEnglish ? "score = clamp(10 + 2 × quality, 0, 20)" : "баллы = clamp(10 + 2 × качество, 0, 20)";
  return isEnglish ? "Completed = 10 · missed = 0" : "Выполнено = 10 · пропущено = 0";
}

const HABIT_PRIORITY_LEVELS = [
  { label: "Фоновый", labelEn: "Background", color: "#859491" },
  { label: "Низкий", labelEn: "Low", color: "#739b8c" },
  { label: "Спокойный", labelEn: "Gentle", color: "#5d9a82" },
  { label: "Умеренный", labelEn: "Moderate", color: "#539a6e" },
  { label: "Средний", labelEn: "Medium", color: "#9a9a52" },
  { label: "Заметный", labelEn: "Notable", color: "#c1a044" },
  { label: "Важный", labelEn: "Important", color: "#d49a3e" },
  { label: "Высокий", labelEn: "High", color: "#dc7f39" },
  { label: "Очень высокий", labelEn: "Very high", color: "#d86435" },
  { label: "Ключевой", labelEn: "Essential", color: "#c83d35" },
] as const;

function HabitPriorityControl({ value, language, onChange }: { value: number; language: Language; onChange: (value: number) => void }) {
  const isEnglish = language === "en";
  const normalizedValue = normalizeHabitPriority(value);
  const selectedLevel = HABIT_PRIORITY_LEVELS[normalizedValue - 1];
  return (
    <div className="task-priority-control habit-priority-control" style={{ "--task-priority-color": selectedLevel.color } as CSSProperties}>
      <div className="task-priority-current" aria-live="polite"><span>{isEnglish ? "Selected priority" : "Выбранный приоритет"}</span><strong>{isEnglish ? selectedLevel.labelEn : selectedLevel.label}</strong><em>{normalizedValue} / 10</em></div>
      <div className="task-priority-slider">
        <div className="task-priority-steps" aria-hidden="true">{HABIT_PRIORITY_LEVELS.map((level, index) => { const step = index + 1; return <i className={`${step <= normalizedValue ? "active" : ""}${step === normalizedValue ? " current" : ""}`} style={{ "--priority-step": step, "--priority-step-color": level.color } as CSSProperties} key={level.labelEn} />; })}</div>
        <input type="range" min="1" max="10" step="1" value={normalizedValue} aria-label={isEnglish ? "Habit priority" : "Приоритет привычки"} aria-valuetext={`${isEnglish ? selectedLevel.labelEn : selectedLevel.label}, ${normalizedValue} / 10`} onInput={(event) => onChange(Number(event.currentTarget.value))} />
      </div>
      <div className="task-priority-scale" aria-hidden="true"><span>{isEnglish ? "Less important" : "Менее важная"}</span><span>{isEnglish ? "Medium" : "Средняя"}</span><strong>{isEnglish ? "Essential" : "Ключевая"}</strong></div>
      <small className="habit-priority-note">{isEnglish ? "Priority changes ordering, not XP." : "Приоритет влияет на порядок, но не на XP."}</small>
    </div>
  );
}

function HabitEmojiField({ value, language, onChange }: { value: string; language: Language; onChange: (value: string) => void }) {
  const isEnglish = language === "en";
  return (
    <fieldset className="habit-emoji-field">
      <legend>{isEnglish ? "Habit emoji" : "Эмодзи привычки"}</legend>
      <div className="habit-emoji-presets">{HABIT_EMOJI_PRESETS.map((emoji) => <button type="button" className={value === emoji ? "selected" : ""} aria-label={emoji} aria-pressed={value === emoji} onClick={() => onChange(emoji)} key={emoji}>{emoji}</button>)}</div>
      <label><span>{isEnglish ? "Or enter your own emoji" : "Или введите свой эмодзи"}</span><input value={value} maxLength={16} inputMode="text" onChange={(event) => onChange(event.target.value)} onBlur={() => onChange(normalizeHabitEmoji(value))} /></label>
    </fieldset>
  );
}

function formatDuration(minutes: number, isEnglish: boolean) {
  if (!minutes) return isEnglish ? "Not recorded" : "Не записано";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return isEnglish ? `${hours}h ${rest}m` : `${hours} ч ${rest} мин`;
}

function formatClockMinutes(minutes: number) {
  const normalized = ((Math.round(minutes) % 1_440) + 1_440) % 1_440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function habitStreak(workspace: HabitWorkspace, habit: Habit, today: string, calendarMode: CalendarMode) {
  let cursor = today;
  let streak = 0;
  for (let scanned = 0; scanned < 20_000 && cursor >= habit.schedule.startDate; scanned += 1) {
    if (isHabitScheduledForDate(habit, cursor, calendarMode)) {
      if (!completionFor(workspace, habit.id, cursor)?.completed) break;
      streak += 1;
    }
    cursor = addHabitDays(cursor, -1);
  }
  return streak;
}

const DAILY_GOAL_MODES: readonly DailyGoalMode[] = ["easy", "rhythm", "perfect"];

function dailyGoalModeLabel(mode: DailyGoalMode, isEnglish: boolean) {
  if (mode === "easy") return isEnglish ? "Easy" : "Лёгкий";
  if (mode === "perfect") return isEnglish ? "Perfect" : "Идеальный";
  return isEnglish ? "Rhythm" : "Ритм";
}

function dailyGoalModeDescription(mode: DailyGoalMode, isEnglish: boolean) {
  if (mode === "easy") return isEnglish ? "Complete at least one scheduled habit." : "Выполнить хотя бы одну запланированную привычку.";
  if (mode === "perfect") return isEnglish ? "Complete every scheduled habit." : "Выполнить 100% запланированных привычек.";
  return isEnglish ? "Complete about 60% of scheduled habits." : "Выполнить около 60% запланированных привычек.";
}

function dailyGoalGuidance(record: DailyGoalRecord, isEnglish: boolean) {
  if (record.status === "protected") return isEnglish
    ? "Hestia's Spark protected the streak. The missed habits remain incomplete and grant no XP."
    : "Искра Гестии сохранила серию. Пропущенные привычки остались невыполненными и не дали XP.";
  if (record.status === "timezone-shift") return isEnglish
    ? "Timezone transition: this day is neutral and cannot break or duplicate the streak."
    : "Смена часового пояса: день нейтрален и не может ни сбросить, ни удвоить серию.";
  if (record.status === "rest") return isEnglish ? "Planned rest protects your streak." : "Запланированный отдых сохраняет серию.";
  if (record.status === "neutral") return isEnglish ? "A neutral day: nothing is scheduled, so the streak stays unchanged." : "Нейтральный день: ничего не запланировано, серия не изменится.";
  if (record.status === "perfect") return isEnglish ? "Perfect day — every scheduled habit is complete." : "Идеальный день — выполнены все запланированные привычки.";
  const remainingToPerfect = record.scheduledCount - record.completedCount;
  if (record.status === "qualified") {
    if (remainingToPerfect === 1) return isEnglish ? "One more step to a perfect day." : "Ещё один шаг до идеального дня.";
    return isEnglish ? `Daily goal reached. ${remainingToPerfect} to a perfect day.` : `Дневная цель выполнена. До идеального дня: ${remainingToPerfect}.`;
  }
  const remainingToGoal = Math.max(0, record.targetCount - record.completedCount);
  if (remainingToGoal === 1) return isEnglish ? "One more step and the daily goal is complete." : "Ещё один шаг — и дневная цель выполнена.";
  return isEnglish ? `${remainingToGoal} completions to the daily goal.` : `До дневной цели: ${remainingToGoal}.`;
}

function rewardReasonLabel(reason: RewardReason, isEnglish: boolean) {
  if (reason === "daily-goal") return isEnglish ? "Daily goal" : "Дневная цель";
  if (reason === "perfect-day") return isEnglish ? "Perfect Day" : "Идеальный день";
  if (reason === "daily-quest") return isEnglish ? "Daily trial" : "Ежедневное испытание";
  if (reason === "weekly-quest") return isEnglish ? "Weekly quest" : "Недельный квест";
  if (reason === "streak-milestone") return isEnglish ? "Streak milestone" : "Этап серии";
  if (reason === "rank-up") return isEnglish ? "New rank" : "Новый ранг";
  if (reason === "achievement") return isEnglish ? "Achievement" : "Достижение";
  if (reason === "comeback") return isEnglish ? "Comeback completed" : "Возвращение завершено";
  if (reason === "hero-path-amphora") return isEnglish ? "Path checkpoint amphora" : "Амфора Пути Героя";
  if (reason === "habit-mastery-retained") return isEnglish ? "Habit milestone · Laurels retained" : "Рубеж привычки · Лавры сохранены";
  if (reason === "habit-deleted-reset") return isEnglish ? "Habit deleted · Laurels reset" : "Привычка удалена · Лавры обнулены";
  if (reason === "habit-missed-reset") return isEnglish ? "Habit missed · Laurels reset" : "Привычка не выполнена · Лавры обнулены";
  return isEnglish ? "Hestia Spark" : "Искра Гестии";
}

function habitQuestCopy(quest: HabitQuest, isEnglish: boolean) {
  if (quest.kind === "daily-goal") return {
    eyebrow: isEnglish ? "Daily trial" : "Испытание дня",
    title: isEnglish ? "Complete today's goal" : "Завершить дневную цель",
    description: isEnglish
      ? "Keep the chosen rhythm without demanding a perfect day."
      : "Сохраните выбранный ритм — идеальный день для этого не обязателен.",
  };
  return {
    eyebrow: isEnglish ? "Weekly trial" : "Испытание недели",
    title: isEnglish ? `Complete ${quest.target} scheduled habits` : `Выполнить ${quest.target} запланированных привычек`,
    description: isEnglish
      ? "The target is calculated only from habits that can actually occur this week."
      : "Цель рассчитана только по привычкам, которые действительно могут выпасть на этой неделе.",
  };
}

function HabitQuestSigil({ cadence }: { cadence: HabitQuest["cadence"] }) {
  return cadence === "daily" ? (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="14" />
      <path d="M24 4v7M24 37v7M4 24h7M37 24h7M10 10l5 5M33 33l5 5M38 10l-5 5M15 33l-5 5" />
      <path className="habit-quest-sigil-core" d="m24 16 2.5 5.5L32 24l-5.5 2.5L24 32l-2.5-5.5L16 24l5.5-2.5Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 18h24v20H12zM17 10v12M31 10v12M12 24h24" />
      <path className="habit-quest-sigil-core" d="m19 31 3 3 7-7" />
    </svg>
  );
}

function HabitQuestPanel({ workspace, date, language }: Pick<DailyPanelProps, "workspace" | "date" | "language">) {
  const isEnglish = language === "en";
  const quests = currentHabitQuests(workspace.quests, date);
  return (
    <section className="habit-quest-panel" aria-labelledby="habit-quest-panel-title">
      <header>
        <div>
          <span className="eyebrow">{isEnglish ? "Built from your active rhythm" : "Составлены из вашего активного ритма"}</span>
          <h2 id="habit-quest-panel-title">{isEnglish ? "Trials" : "Испытания"}</h2>
        </div>
        <small>{isEnglish ? "Laurels, not Rank XP" : "Лавры, а не опыт ранга"}</small>
      </header>
      {quests.length ? (
        <div className="habit-quest-grid">
          {quests.map((quest) => {
            const copy = habitQuestCopy(quest, isEnglish);
            const progress = Math.min(100, Math.round((quest.progress / quest.target) * 100));
            return (
              <article className={quest.completedAt ? "completed" : ""} key={quest.id}>
                <span className={`habit-quest-sigil cadence-${quest.cadence}`}><HabitQuestSigil cadence={quest.cadence} /></span>
                <div className="habit-quest-copy">
                  <small>{copy.eyebrow}</small>
                  <h3>{copy.title}</h3>
                  <p>{copy.description}</p>
                  <div className="habit-quest-progress" role="progressbar" aria-label={copy.title} aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={quest.progress}>
                    <i><span style={{ width: `${progress}%` }} /></i>
                    <strong>{quest.progress} / {quest.target}</strong>
                  </div>
                </div>
                <div className="habit-quest-reward">
                  <span>{quest.completedAt ? "✓" : "♕"}</span>
                  <strong>{quest.completedAt ? (isEnglish ? "Complete" : "Завершено") : `+${quest.rewardLaurels}`}</strong>
                  <small>{quest.completedAt ? `+${quest.rewardLaurels} ${isEnglish ? "Laurels" : "Лавров"}` : (isEnglish ? "Laurels" : "Лавров")}</small>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="habit-quest-empty">{isEnglish
          ? "No achievable trial is available yet. It will appear when an active habit is scheduled."
          : "Пока нет доступного выполнимого испытания. Оно появится, когда будет запланирована активная привычка."}</p>
      )}
    </section>
  );
}

function AchievementPanel({ workspace, language }: Pick<DailyPanelProps, "workspace" | "language">) {
  const isEnglish = language === "en";
  const unlocked = new Map(workspace.achievementUnlocks.map((entry) => [entry.achievementId, entry]));
  const locale = isEnglish ? "en-US" : "ru-RU";
  return (
    <section className="achievement-panel" aria-labelledby="achievement-panel-title">
      <header>
        <div>
          <span className="eyebrow">{isEnglish ? "A history that cannot be bought" : "История, которую нельзя купить"}</span>
          <h2 id="achievement-panel-title">{isEnglish ? "Achievements" : "Достижения"}</h2>
          <p>{isEnglish ? "They preserve meaningful milestones but never alter Rank XP." : "Они сохраняют значимые рубежи, но никогда не изменяют опыт ранга."}</p>
        </div>
        <strong>{unlocked.size} / {ACHIEVEMENTS.length}</strong>
      </header>
      <div className="achievement-grid">
        {ACHIEVEMENTS.map((achievement) => {
          const unlock = unlocked.get(achievement.id);
          const concealed = achievement.hidden && !unlock;
          const title = concealed ? (isEnglish ? "Hidden achievement" : "Тайное достижение") : (isEnglish ? achievement.titleEn : achievement.title);
          const description = concealed
            ? (isEnglish ? "Its name and condition will be revealed when the moment arrives." : "Название и условие откроются, когда наступит нужный момент.")
            : (isEnglish ? achievement.descriptionEn : achievement.description);
          return (
            <article className={`${unlock ? "unlocked" : "locked"}${concealed ? " concealed" : ""}`} key={achievement.id}>
              <AchievementSigil motif={achievement.motif} unlocked={Boolean(unlock)} label={title} />
              <div>
                <small>{unlock ? (isEnglish ? "Unlocked" : "Открыто") : (concealed ? (isEnglish ? "Unknown path" : "Неизвестный путь") : (isEnglish ? "Ahead" : "Впереди"))}</small>
                <h3>{title}</h3>
                <p>{description}</p>
                {unlock ? <time dateTime={unlock.unlockedAt}>{new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(unlock.unlockedAt))}</time> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DailyGoalSettings({ workspace, today, language, calendarMode, onChange }: Pick<DailyPanelProps, "workspace" | "language" | "calendarMode" | "onChange"> & { today: string }) {
  const isEnglish = language === "en";
  const selectedMode = workspace.userProgress.streakGoalMode;
  const activeMode = dailyGoalForDate(workspace, today, calendarMode, today).mode;
  return (
    <details className="daily-goal-settings">
      <summary>
        <span><strong>{isEnglish ? "Daily goal mode" : "Режим дневной цели"}</strong><small>{dailyGoalModeLabel(selectedMode, isEnglish)}</small></span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </summary>
      <div role="radiogroup" aria-label={isEnglish ? "Daily goal mode" : "Режим дневной цели"}>
        {DAILY_GOAL_MODES.map((mode) => (
          <button type="button" role="radio" aria-checked={selectedMode === mode} className={selectedMode === mode ? "selected" : ""} onClick={() => onChange(setDailyGoalMode(workspace, mode, today))} key={mode}>
            <strong>{dailyGoalModeLabel(mode, isEnglish)}</strong>
            <small>{dailyGoalModeDescription(mode, isEnglish)}</small>
          </button>
        ))}
      </div>
      <p>{selectedMode === activeMode
        ? (isEnglish ? "A new choice applies from tomorrow and never recalculates past days." : "Новый выбор начнёт действовать завтра и не пересчитает прошлые дни.")
        : (isEnglish ? `Today: ${dailyGoalModeLabel(activeMode, true)}. From tomorrow: ${dailyGoalModeLabel(selectedMode, true)}.` : `Сегодня: «${dailyGoalModeLabel(activeMode, false)}». С завтра: «${dailyGoalModeLabel(selectedMode, false)}».`)}</p>
    </details>
  );
}

function MoodTracker({ workspace, date, language, onChange }: Pick<DailyPanelProps, "workspace" | "date" | "language" | "onChange">) {
  const isEnglish = language === "en";
  const [isOpen, setIsOpen] = useState(false);
  const mood = workspace.moodEntries.find((entry) => entry.date === date);
  const selected = mood ? moodOption(mood.moodValue) : null;
  return (
    <section className={`mood-tracker${isOpen ? " is-open" : ""}`}>
      <button type="button" className="mood-summary" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        <span>{isEnglish ? "Mood of the day" : "Настроение дня"}</span>
        <strong style={{ color: mood ? moodColor(mood.moodValue) : undefined }}>
          {selected ? (isEnglish ? selected.labelEn : selected.label) : (isEnglish ? "Not selected" : "Не выбрано")}
        </strong>
        <span className="mood-summary-action">
          {isEnglish ? "Choose" : "Выбрать"}
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </span>
      </button>
      {isOpen ? <>
      <div className="mood-options" role="listbox" aria-label={isEnglish ? "Choose mood" : "Выберите настроение"}>
        {MOOD_SCALE.map((option) => (
          <button
            type="button"
            role="option"
            aria-selected={mood?.moodValue === option.value}
            className={mood?.moodValue === option.value ? "selected" : ""}
            style={{ "--mood-color": moodColor(option.value) } as CSSProperties}
            onClick={() => onChange(replaceMood(workspace, date, { moodValue: option.value as MoodValue }))}
            title={isEnglish ? option.labelEn : option.label}
            key={option.value}
          >
            <span aria-hidden="true">{option.symbol}</span>
            <small>{isEnglish ? option.labelEn : option.label}</small>
            <em>{option.value > 0 ? `+${option.value}` : option.value}</em>
          </button>
        ))}
      </div>
      <label className="mood-custom">
        <span>{isEnglish ? "Note and context" : "Заметка и контекст"}</span>
        <input
          value={mood?.note ?? ""}
          maxLength={200}
          placeholder={isEnglish ? "How do you really feel?" : "Как вы себя чувствуете на самом деле?"}
          onChange={(event) => onChange(replaceMood(workspace, date, { note: event.target.value }))}
        />
      </label>
      <small className="mood-no-score">{isEnglish ? "Mood is used for analytics and never changes your score." : "Настроение используется только для аналитики и не влияет на баллы."}</small>
      </> : null}
    </section>
  );
}

export function HabitDailyPanel({ workspace, date, language, timeFormat, calendarMode, onChange, onOpenHabits, compact = false, showGoalSettings = false }: DailyPanelProps) {
  const isEnglish = language === "en";
  const today = habitDateKey(new Date());
  const dueHabits = workspace.habits
    .filter((habit) => isHabitScheduledForDate(habit, date, calendarMode))
    .sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title));
  const dueSleepPlans = workspace.sleepPlans.filter((plan) => plan.active && isTrackerScheduledForDate(plan.schedule, date, calendarMode));
  const dueAddictions = workspace.addictionTrackers.filter((tracker) => tracker.status === "active" && isTrackerScheduledForDate(tracker.schedule, date, calendarMode));
  const totalDue = dueHabits.length + dueSleepPlans.length + dueAddictions.length;
  const dayPoints = workspace.habitCompletions.filter((entry) => entry.date === date).reduce((sum, entry) => sum + Math.max(0, entry.score), 0)
    + workspace.sleepEntries.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.score, 0)
    + workspace.addictionEntries.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.score, 0);
  const hasTrackers = workspace.habits.length || workspace.sleepPlans.length || workspace.addictionTrackers.length;
  const goalRecord = dailyGoalForDate(workspace, date, calendarMode, today);
  const goalPercent = goalRecord.scheduledCount ? Math.round(goalRecord.completedCount / goalRecord.scheduledCount * 100) : 0;
  const awardedLaurels = workspace.rewardTransactions
    .filter((transaction) => transaction.sourceId === date && ["daily-goal", "perfect-day"].includes(transaction.reason))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const plannedRest = workspace.habitSettings.plannedRestDays.includes(date);

  return (
    <section className={`habit-daily-panel${compact ? " compact" : ""}`} aria-labelledby={`habit-daily-title-${date}`}>
      <header>
        <div>
          <span className="eyebrow">{isEnglish ? "Daily rhythm" : "Ежедневный ритм"}</span>
          <h2 id={`habit-daily-title-${date}`}>{isEnglish ? "Personal trackers" : "Личные трекеры"}</h2>
        </div>
        {workspace.habits.length ? (
          <div
            className={`daily-goal-ring state-${goalRecord.status}`}
            style={{ "--goal-progress": `${goalPercent}%` } as CSSProperties}
            aria-label={isEnglish ? `${goalRecord.completedCount} of ${goalRecord.scheduledCount} habits complete` : `Выполнено привычек: ${goalRecord.completedCount} из ${goalRecord.scheduledCount}`}
          >
            <span><strong>{goalRecord.scheduledCount ? `${goalRecord.completedCount}/${goalRecord.scheduledCount}` : "—"}</strong><small>{goalRecord.status === "perfect" ? (isEnglish ? "perfect" : "идеал") : (isEnglish ? "day" : "день")}</small></span>
          </div>
        ) : null}
      </header>

      {workspace.habits.length ? (
        <div className={`daily-goal-guidance state-${goalRecord.status}`}>
          <div><span>{isEnglish ? "Daily goal" : "Дневная цель"}</span><strong>{dailyGoalModeLabel(goalRecord.mode, isEnglish)} · {goalRecord.targetCount}/{goalRecord.scheduledCount}</strong></div>
          <p>{dailyGoalGuidance(goalRecord, isEnglish)}</p>
          <div className="daily-goal-actions">
            <div><small>+{Math.max(0, dayPoints)} {isEnglish ? "pts today" : "баллов сегодня"}</small>{awardedLaurels > 0 ? <strong>♕ +{awardedLaurels} {isEnglish ? "Laurels awarded" : "Лавров начислено"}</strong> : <strong className="pending">♕ {isEnglish ? "5 + 3 for Perfect Day" : "5 + 3 за идеальный день"}</strong>}</div>
            {(date > today || plannedRest) && goalRecord.scheduledCount ? <button type="button" onClick={() => onChange(setPlannedRestDay(workspace, date, !plannedRest, calendarMode, today))}>{plannedRest ? (isEnglish ? "Cancel rest" : "Отменить отдых") : (isEnglish ? "Plan rest" : "Запланировать отдых")}</button> : null}
          </div>
        </div>
      ) : null}
      {showGoalSettings ? <DailyGoalSettings workspace={workspace} today={today} language={language} calendarMode={calendarMode} onChange={onChange} /> : null}

      {dueHabits.length > 0 && date !== today ? <p className="habit-history-lock" role="note">🔒 {isEnglish ? "History is read-only. Habit marks can only be changed today." : "История доступна только для просмотра. Отметки привычек можно менять лишь сегодня."}</p> : null}

      {!hasTrackers ? (
        <div className="habit-empty-state">
          <span aria-hidden="true">✦</span>
          <div>
            <h3>{isEnglish ? "Create your first tracker" : "Создайте первый трекер"}</h3>
            <p>{isEnglish ? "Habits, sleep and abstinence are independent modules inside one encrypted workspace." : "Привычки, сон и воздержание работают как независимые модули внутри одного зашифрованного пространства."}</p>
          </div>
          {onOpenHabits ? <button type="button" className="primary-button" onClick={onOpenHabits}>{isEnglish ? "Open trackers" : "Открыть трекеры"}</button> : null}
        </div>
      ) : null}

      {dueHabits.length ? (
        <div className="habit-check-list">
          {dueHabits.map((habit) => {
            const entry = completionFor(workspace, habit.id, date);
            const score = entry ? scoreHabitCompletion(habit, entry) : 0;
            const canRecord = canRecordHabitOnDate(habit.createdDate, date, today);
            return (
              <article className={`${entry?.completed ? "done" : ""}${canRecord ? "" : " read-only"}`} style={{ "--habit-color": habit.color } as CSSProperties} key={habit.id}>
                <button
                  type="button"
                  className="habit-check"
                  disabled={!canRecord}
                  title={!canRecord ? (isEnglish ? "Only today's mark can be changed" : "Можно изменить только сегодняшнюю отметку") : undefined}
                  onClick={() => onChange(updateHabitCompletion(workspace, habit, date, {
                    completed: !entry?.completed,
                    qualityValue: !entry?.completed && habit.qualityScale !== "none" ? entry?.qualityValue ?? (habit.qualityScale === "ten" ? 5 : 0) : entry?.qualityValue ?? null,
                  }))}
                  aria-pressed={Boolean(entry?.completed)}
                  aria-label={entry?.completed ? (isEnglish ? `Unmark ${habit.title}` : `Снять отметку «${habit.title}»`) : (isEnglish ? `Mark ${habit.title}` : `Отметить «${habit.title}»`)}
                >
                  {entry?.completed ? "✓" : ""}
                </button>
                <div className="habit-check-copy">
                  <span><b className="habit-emoji" aria-hidden="true">{habit.emoji}</b><strong data-no-translate>{habit.title}</strong><em>{isEnglish ? `Priority ${habit.priority}` : `Приоритет ${habit.priority}`}</em></span>
                  {habit.description ? <small data-no-translate>{habit.description}</small> : null}
                  {habit.preferredTime ? <small className="habit-preferred-time">{isEnglish ? "Preferred" : "Желаемое время"}: {formatTimeValue(habit.preferredTime, timeFormat)}</small> : null}
                </div>
                {entry?.completed && habit.qualityScale !== "none" ? (
                  <label className={`habit-quality-slider scale-${habit.qualityScale}`}>
                    <span>{isEnglish ? "Quality" : "Качество"} <strong>{qualityLabel(habit.qualityScale, entry.qualityValue, isEnglish)}</strong></span>
                    <input
                      type="range"
                      min={habit.qualityScale === "ten" ? 1 : -5}
                      max={habit.qualityScale === "ten" ? 10 : 5}
                      step="1"
                      value={entry.qualityValue ?? (habit.qualityScale === "ten" ? 5 : 0)}
                      disabled={!canRecord}
                      onChange={(event) => onChange(updateHabitCompletion(workspace, habit, date, { completed: true, qualityValue: Number(event.target.value) }))}
                    />
                    <div><span>{habit.qualityScale === "ten" ? "1" : "−5"}</span>{habit.qualityScale === "bipolar" ? <i>0</i> : null}<span>{habit.qualityScale === "ten" ? "10" : "+5"}</span></div>
                  </label>
                ) : null}
                {habit.scoringMode !== "none" ? <output>{score > 0 ? "+" : ""}{score}</output> : <output className="monitor">{isEnglish ? "log" : "учёт"}</output>}
              </article>
            );
          })}
        </div>
      ) : null}

      {dueSleepPlans.map((plan) => {
        const entry = workspace.sleepEntries.find((item) => item.planId === plan.id && item.date === date);
        return (
          <article className="sleep-daily-card" key={plan.id}>
            <header><div><span className="eyebrow">{isEnglish ? "Sleep" : "Сон"}</span><strong data-no-translate>{plan.title}</strong></div><output>{formatDuration(entry?.durationMinutes ?? 0, isEnglish)}{entry?.score ? ` · ${entry.score > 0 ? "+" : ""}${entry.score}` : ""}</output></header>
            <div className="sleep-time-grid">
              <label><span>{isEnglish ? "Fell asleep" : "Заснул(а)"}</span><input type="time" value={entry?.fellAsleepAt ?? ""} onChange={(event) => onChange(replaceSleepEntry(workspace, plan, date, { fellAsleepAt: event.target.value }))} />{entry?.fellAsleepAt ? <small>{formatTimeValue(entry.fellAsleepAt, timeFormat)}</small> : null}</label>
              <label><span>{isEnglish ? "Woke up" : "Проснулся(ась)"}</span><input type="time" value={entry?.wokeAt ?? ""} onChange={(event) => onChange(replaceSleepEntry(workspace, plan, date, { wokeAt: event.target.value }))} />{entry?.wokeAt ? <small>{formatTimeValue(entry.wokeAt, timeFormat)}</small> : null}</label>
              {plan.qualityEnabled ? <label className="habit-quality-slider"><span>{isEnglish ? "Sleep quality" : "Качество сна"} <strong>{entry?.quality ?? 5}</strong></span><input type="range" min="1" max="10" value={entry?.quality ?? 5} onChange={(event) => onChange(replaceSleepEntry(workspace, plan, date, { quality: Number(event.target.value) }))} /></label> : null}
            </div>
          </article>
        );
      })}

      {dueAddictions.map((tracker) => {
        const entry = workspace.addictionEntries.find((item) => item.trackerId === tracker.id && item.date === date);
        return (
          <article className={`addiction-daily-card${entry?.relapse ? " relapse" : entry?.cleanDay ? " clean" : ""}`} key={tracker.id}>
            <header><div><span className="eyebrow">{isEnglish ? "Abstinence" : "Воздержание"}</span><strong data-no-translate>{tracker.trackedBehavior}</strong></div><output>{(entry?.score ?? 0) > 0 ? "+" : ""}{entry?.score ?? 0}</output></header>
            <div className="addiction-choice" role="group" aria-label={isEnglish ? "Day result" : "Итог дня"}>
              <button type="button" className={entry?.cleanDay ? "selected" : ""} onClick={() => onChange(replaceAddictionEntry(workspace, tracker, date, { cleanDay: true, relapse: false }))}>{isEnglish ? "Clean day" : "Чистый день"}</button>
              <button type="button" className={entry?.relapse ? "selected danger" : "danger"} onClick={() => onChange(replaceAddictionEntry(workspace, tracker, date, { cleanDay: false, relapse: true }))}>{isEnglish ? "Relapse" : "Срыв"}</button>
            </div>
            <label className="habit-quality-slider"><span>{isEnglish ? "Craving intensity" : "Сила тяги"} <strong>{entry?.cravingIntensity ?? 0}/10</strong></span><input type="range" min="0" max="10" value={entry?.cravingIntensity ?? 0} onChange={(event) => onChange(replaceAddictionEntry(workspace, tracker, date, { cravingIntensity: Number(event.target.value) }))} /></label>
          </article>
        );
      })}

      {hasTrackers && !totalDue ? <p className="habit-rest-day">{isEnglish ? "Nothing is scheduled for this day." : "На этот день ничего не запланировано."}</p> : null}
      <MoodTracker workspace={workspace} date={date} language={language} onChange={onChange} />
    </section>
  );
}

function HabitTemplateSetup({ template, date, language, calendarMode, googleTasksReady, onSave, onClose }: { template: HabitTemplate; date: string; language: Language; calendarMode: CalendarMode; googleTasksReady: boolean; onSave: (habit: Habit) => void; onClose: () => void }) {
  const isEnglish = language === "en";
  const [draft, setDraft] = useState(() => createHabitFromTemplate(template, date, calendarMode, language));
  const calendarLabel = calendarMode === "sacred"
    ? (isEnglish ? "GENESIS calendar" : "Сакральный календарь")
    : calendarMode === "lunar" ? (isEnglish ? "Lunar calendar" : "Лунный календарь") : (isEnglish ? "Gregorian calendar" : "Григорианский календарь");
  return (
    <div className="modal-backdrop habit-editor-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="habit-editor habit-template-setup" onSubmit={(event) => { event.preventDefault(); onSave(markTrackerEntityChanged({ ...draft, emoji: normalizeHabitEmoji(draft.emoji), priority: normalizeHabitPriority(draft.priority) })); }}>
        <header>
          <div className="habit-template-setup-title"><span aria-hidden="true">{template.icon}</span><div><small>{isEnglish ? "Starter suggestion" : "Стартовое предложение"}</small><h2>{isEnglish ? template.titleEn : template.title}</h2><p>{isEnglish ? template.descriptionEn : template.description}</p></div></div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={isEnglish ? "Close" : "Закрыть"}>×</button>
        </header>

        <fieldset className="habit-template-start">
          <legend>{isEnglish ? "Immutable start" : "Неизменяемое начало"}</legend>
          <div className="habit-creation-lock"><span aria-hidden="true">🔒</span><div><small>{isEnglish ? "Creation and tracking date" : "Дата создания и начала"}</small><strong>{draft.createdDate}</strong><p>{isEnglish ? "A habit begins today. You can edit its settings later, but its scoring formula will remain fixed." : "Привычка начинается сегодня. Позже настройки можно изменить, но формула начисления баллов останется зафиксированной."}</p></div></div>
        </fieldset>

        <div className="habit-template-quick-settings">
          <article><span>{isEnglish ? "Recommended rhythm" : "Рекомендуемый ритм"}</span><strong>{isEnglish ? template.frequencyEn : template.frequency}</strong><small>{calendarLabel}</small></article>
          <label><span>{isEnglish ? "Preferred time" : "Желаемое время"}</span><input type="time" value={draft.preferredTime} onChange={(event) => setDraft((current) => ({ ...current, preferredTime: event.target.value, reminder: { ...current.reminder, time: event.target.value } }))} /></label>
        </div>
        <HabitEmojiField value={draft.emoji} language={language} onChange={(emoji) => setDraft((current) => ({ ...current, emoji }))} />
        <HabitPriorityControl value={draft.priority} language={language} onChange={(priority) => setDraft((current) => ({ ...current, priority }))} />

        <label className="habit-switch"><span><strong>{isEnglish ? "Enable reminder" : "Добавить напоминание"}</strong><small>{isEnglish ? "The habit works without a notification" : "Привычка работает и без уведомления"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Enable reminder" : "Добавить напоминание"} checked={draft.reminder.enabled} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, enabled: event.target.checked } }))} /><i /></label>
        <fieldset className="habit-reminder-fields habit-template-reminder" disabled={!draft.reminder.enabled}>
          <label><span>{isEnglish ? "Reminder time" : "Время напоминания"}</span><input type="time" value={draft.reminder.time} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, time: event.target.value } }))} /></label>
          <label className="habit-google-check"><input type="checkbox" aria-label="Google Tasks" checked={draft.reminder.syncToGoogleTasks} disabled={!googleTasksReady} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, syncToGoogleTasks: event.target.checked } }))} /><span><strong>Google Tasks</strong><small>{googleTasksReady ? (isEnglish ? "Create a rolling task reminder" : "Создать переносимое напоминание-задачу") : (isEnglish ? "Connect Google Tasks first" : "Сначала подключите Google Tasks")}</small></span></label>
        </fieldset>

        <details className="habit-template-advanced">
          <summary>{isEnglish ? "Fine-tune recurrence and days" : "Точно настроить повторение и дни"}</summary>
          <RecurrenceBuilder value={draft.schedule.recurrence} startDate={draft.createdDate} calendarMode={calendarMode} destination="tracker" lockRangeStart onChange={(recurrence) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, recurrence: { ...recurrence, rangeStart: current.createdDate } } }))} />
        </details>

        <footer><button type="button" className="secondary-button" onClick={onClose}>{isEnglish ? "Cancel" : "Отмена"}</button><button type="submit" className="primary-button">{isEnglish ? "Add habit" : "Добавить привычку"}</button></footer>
      </form>
    </div>
  );
}

function HabitEditor({ habit, isExisting, language, calendarMode, googleTasksReady, onSave, onClose }: { habit: Habit; isExisting: boolean; language: Language; calendarMode: CalendarMode; googleTasksReady: boolean; onSave: (habit: Habit) => void; onClose: () => void }) {
  const isEnglish = language === "en";
  const [draft, setDraft] = useState(habit);
  const [forever, setForever] = useState(habit.schedule.endDate === null);
  const scoringDisabled = draft.scoringMode === "none";
  const setQualityScale = (qualityScale: HabitQualityScale) => {
    const scoringMode: HabitScoringMode = qualityScale === "ten" ? "quality-ten" : qualityScale === "bipolar" ? "quality-bipolar" : "binary";
    setDraft((current) => ({ ...current, qualityScale, scoringMode }));
  };
  return (
    <div className="modal-backdrop habit-editor-backdrop" role="presentation">
      <form className="habit-editor" onSubmit={(event) => { event.preventDefault(); const candidate = markTrackerEntityChanged({ ...draft, createdDate: habit.createdDate, emoji: normalizeHabitEmoji(draft.emoji), priority: normalizeHabitPriority(draft.priority), schedule: { ...draft.schedule, startDate: habit.createdDate, recurrence: { ...draft.schedule.recurrence, rangeStart: habit.createdDate } } }); onSave(isExisting ? applyEditableHabitUpdate(habit, candidate) : candidate); }}>
        <header><div><span className="eyebrow">{isEnglish ? "Habit core" : "Ядро привычек"}</span><h2>{isExisting ? (isEnglish ? "Edit habit" : "Редактирование привычки") : (isEnglish ? "New habit" : "Новая привычка")}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label={isEnglish ? "Close" : "Закрыть"}>×</button></header>
        <div className="habit-editor-grid">
          <label><span>{isEnglish ? "Name" : "Название"}</span><input required maxLength={100} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
          <label><span>{isEnglish ? "Preferred time" : "Желаемое время"}</span><input type="time" value={draft.preferredTime} onChange={(event) => setDraft((current) => ({ ...current, preferredTime: event.target.value }))} /></label>
          <label className="wide"><span>{isEnglish ? "Description" : "Описание"}</span><textarea maxLength={500} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
          <fieldset className="habit-color-field wide"><legend>{isEnglish ? "Color" : "Цвет"}</legend><div>{HABIT_COLORS.map((color) => <button type="button" className={draft.color === color ? "selected" : ""} style={{ background: color }} onClick={() => setDraft((current) => ({ ...current, color }))} aria-label={color} key={color} />)}</div></fieldset>
        </div>
        <HabitEmojiField value={draft.emoji} language={language} onChange={(emoji) => setDraft((current) => ({ ...current, emoji }))} />
        <HabitPriorityControl value={draft.priority} language={language} onChange={(priority) => setDraft((current) => ({ ...current, priority }))} />
        <fieldset className="habit-editor-section">
          <legend><span>01</span>{isEnglish ? "Rhythm and calendar" : "Ритм и календарь"}</legend>
          <div className="habit-editor-grid">
            <div className="habit-creation-lock"><span aria-hidden="true">🔒</span><div><small>{isEnglish ? "Creation and tracking date" : "Дата создания и начала"}</small><strong>{draft.createdDate}</strong><p>{isExisting ? (isEnglish ? "The first tracking day remains fixed; all current and future settings can be changed." : "Первый день трекинга остаётся неизменным; текущие и будущие настройки можно менять.") : (isEnglish ? "Tracking begins today; past dates are unavailable. Scoring becomes locked after the first save." : "Трекинг начинается сегодня, прошлые даты недоступны. После первого сохранения система баллов будет зафиксирована.")}</p></div></div>
            <label className="habit-switch"><span><strong>{isEnglish ? "Track indefinitely" : "Отслеживать всегда"}</strong><small>{isEnglish ? "No final date" : "Без даты окончания"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Track indefinitely" : "Отслеживать всегда"} checked={forever} onChange={(event) => { setForever(event.target.checked); setDraft((current) => ({ ...current, schedule: { ...current.schedule, endDate: event.target.checked ? null : current.schedule.recurrence.rangeEnd || current.schedule.startDate } })); }} /><i /></label>
          </div>
          <RecurrenceBuilder
            value={draft.schedule.recurrence}
            startDate={draft.createdDate}
            calendarMode={calendarMode}
            destination="tracker"
            lockRangeStart
            onChange={(recurrence) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, recurrence: { ...recurrence, rangeStart: current.createdDate }, endDate: forever ? null : recurrence.rangeEnd || current.schedule.endDate } }))}
          />
        </fieldset>
        <fieldset className="habit-editor-section">
          <legend><span>02</span>{isEnglish ? "Quality and points" : "Качество и баллы"}</legend>
          {isExisting ? <p className="habit-scoring-lock-note">🔒 {isEnglish ? "Points and the quality scale were fixed when this habit was created and cannot be changed." : "Баллы и шкала качества зафиксированы при создании этой привычки и не могут быть изменены."}</p> : null}
          <fieldset className="habit-scoring-locked-fields" disabled={isExisting}>
            <label className="habit-switch habit-disable-switch"><span><strong>{isEnglish ? "Disable scoring" : "Отключить начисление баллов"}</strong><small>{isEnglish ? "All scoring fields will be disabled" : "Все поля качества и баллов будут выключены"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Disable habit scoring" : "Отключить начисление баллов"} checked={scoringDisabled} onChange={(event) => setDraft((current) => ({ ...current, scoringMode: event.target.checked ? "none" : current.qualityScale === "ten" ? "quality-ten" : current.qualityScale === "bipolar" ? "quality-bipolar" : "binary" }))} /><i /></label>
          <fieldset className="habit-scoring-fields" disabled={scoringDisabled || isExisting}>
            <div className="habit-editor-grid">
              <label><span>{isEnglish ? "Quality scale" : "Шкала качества"}</span><select value={draft.qualityScale} onChange={(event) => setQualityScale(event.target.value as HabitQualityScale)}><option value="none">{isEnglish ? "No scale" : "Без оценки"}</option><option value="ten">{isEnglish ? "1 to 10" : "От 1 до 10"}</option><option value="bipolar">{isEnglish ? "−5 to +5" : "От −5 до +5"}</option></select></label>
              <div className="habit-formula-card"><span>{isEnglish ? "Exact formula" : "Точная формула"}</span><strong>{scoringFormula(scoringDisabled ? "none" : draft.scoringMode, isEnglish)}</strong><small>{isEnglish ? `Hard limit: ${MAX_HABIT_XP_PER_COMPLETION} XP per completion` : `Жёсткий лимит: ${MAX_HABIT_XP_PER_COMPLETION} XP за выполнение`}</small></div>
            </div>
          </fieldset>
          </fieldset>
        </fieldset>
        <fieldset className="habit-editor-section">
          <legend><span>03</span>{isEnglish ? "Reminder" : "Напоминание"}</legend>
          <label className="habit-switch"><span><strong>{isEnglish ? "Enable reminder" : "Добавить напоминание"}</strong><small>{isEnglish ? "GENESIS remains the source of truth" : "GENESIS остаётся источником истины"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Enable reminder" : "Добавить напоминание"} checked={draft.reminder.enabled} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, enabled: event.target.checked } }))} /><i /></label>
          <fieldset className="habit-reminder-fields" disabled={!draft.reminder.enabled}>
            <div className="habit-editor-grid">
              <label><span>{isEnglish ? "Time" : "Время"}</span><input type="time" value={draft.reminder.time} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, time: event.target.value } }))} /></label>
              <label className="habit-google-check"><input type="checkbox" aria-label="Google Tasks" checked={draft.reminder.syncToGoogleTasks} disabled={!googleTasksReady} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, syncToGoogleTasks: event.target.checked } }))} /><span><strong>Google Tasks</strong><small>{isEnglish ? "One task rolls to the next occurrence" : "Одна задача переносится на следующее повторение"}</small></span></label>
              <label className="habit-google-check"><input type="checkbox" aria-label={isEnglish ? "Show in Google Calendar" : "Показывать эту привычку в Google Calendar"} checked={draft.reminder.showInGoogleCalendar} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, showInGoogleCalendar: event.target.checked } }))} /><span><strong>{isEnglish ? "Show in Google Calendar" : "Показывать эту привычку в Google Calendar"}</strong><small>{isEnglish ? "Only when explicitly enabled" : "Только по вашему явному выбору"}</small></span></label>
            </div>
          </fieldset>
        </fieldset>
        <footer><button type="button" className="secondary-button" onClick={onClose}>{isEnglish ? "Cancel" : "Отмена"}</button><button type="submit" className="primary-button" disabled={!draft.title.trim()}>{isExisting ? (isEnglish ? "Save changes" : "Сохранить изменения") : (isEnglish ? "Save habit" : "Сохранить привычку")}</button></footer>
      </form>
    </div>
  );
}

function SleepEditor({ plan, language, calendarMode, onSave, onClose }: { plan: SleepPlan; language: Language; calendarMode: CalendarMode; onSave: (plan: SleepPlan) => void; onClose: () => void }) {
  const isEnglish = language === "en";
  const [draft, setDraft] = useState(plan);
  const addRule = () => {
    const rule: SleepRule = {
      id: `sleep-rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      field: "bedtime",
      operator: "on-or-before",
      threshold: draft.targetBedtime,
      points: 10,
    };
    setDraft((current) => ({ ...current, rules: [...current.rules, rule] }));
  };
  const updateRule = (id: string, patch: Partial<SleepRule>) => setDraft((current) => ({ ...current, rules: current.rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule) }));
  return (
    <div className="modal-backdrop habit-editor-backdrop" role="presentation">
      <form className="habit-editor specialist-editor" onSubmit={(event) => { event.preventDefault(); onSave(markTrackerEntityChanged(draft)); }}>
        <header><div><span className="eyebrow">{isEnglish ? "Sleep tracker" : "Трекер сна"}</span><h2>{isEnglish ? "Sleep plan" : "План сна"}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label={isEnglish ? "Close" : "Закрыть"}>×</button></header>
        <div className="habit-editor-grid"><label className="wide"><span>{isEnglish ? "Plan name" : "Название плана"}</span><input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label><span>{isEnglish ? "Target bedtime" : "Плановое время сна"}</span><input type="time" value={draft.targetBedtime} onChange={(event) => setDraft((current) => ({ ...current, targetBedtime: event.target.value }))} /></label><label><span>{isEnglish ? "Target wake time" : "Плановое пробуждение"}</span><input type="time" value={draft.targetWakeTime} onChange={(event) => setDraft((current) => ({ ...current, targetWakeTime: event.target.value }))} /></label></div>
        <RecurrenceBuilder value={draft.schedule.recurrence} startDate={draft.schedule.startDate} calendarMode={calendarMode} destination="tracker" onChange={(recurrence) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, recurrence } }))} />
        <label className="habit-switch"><span><strong>{isEnglish ? "Track sleep quality" : "Оценивать качество сна"}</strong><small>{isEnglish ? "Optional 1–10 scale" : "Необязательная шкала 1–10"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Track sleep quality" : "Оценивать качество сна"} checked={draft.qualityEnabled} onChange={(event) => setDraft((current) => ({ ...current, qualityEnabled: event.target.checked }))} /><i /></label>
        <label className="habit-switch habit-disable-switch"><span><strong>{isEnglish ? "Disable scoring" : "Отключить начисление баллов"}</strong><small>{isEnglish ? "Sleep analytics will remain available" : "Аналитика сна продолжит работать"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Disable sleep scoring" : "Отключить начисление баллов за сон"} checked={!draft.scoringEnabled} onChange={(event) => setDraft((current) => ({ ...current, scoringEnabled: !event.target.checked }))} /><i /></label>
        <fieldset className="habit-scoring-fields sleep-rule-editor" disabled={!draft.scoringEnabled}>
          <header><div><strong>{isEnglish ? "Scoring conditions" : "Условия начисления"}</strong><small>{isEnglish ? "Positive or negative points for meeting each condition" : "Положительные или отрицательные баллы за каждое условие"}</small></div><button type="button" onClick={addRule}>＋ {isEnglish ? "Condition" : "Условие"}</button></header>
          {draft.rules.length ? draft.rules.map((rule) => (
            <div className="sleep-rule-row" key={rule.id}>
              <label><span>{isEnglish ? "Value" : "Показатель"}</span><select value={rule.field} onChange={(event) => updateRule(rule.id, { field: event.target.value as SleepRule["field"] })}><option value="bedtime">{isEnglish ? "Bedtime" : "Время засыпания"}</option><option value="wake">{isEnglish ? "Wake time" : "Время пробуждения"}</option></select></label>
              <label><span>{isEnglish ? "Condition" : "Условие"}</span><select value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as SleepRule["operator"] })}><option value="on-or-before">{isEnglish ? "At or before" : "Не позже"}</option><option value="after">{isEnglish ? "After" : "Позже"}</option></select></label>
              <label><span>{isEnglish ? "Time" : "Время"}</span><input type="time" value={rule.threshold} onChange={(event) => updateRule(rule.id, { threshold: event.target.value })} /></label>
              <label><span>{isEnglish ? "Points" : "Баллы"}</span><input type="number" min="-100" max="100" value={rule.points} onChange={(event) => updateRule(rule.id, { points: Math.max(-100, Math.min(100, Math.round(Number(event.target.value) || 0))) })} /></label>
              <button type="button" className="danger" aria-label={isEnglish ? "Delete condition" : "Удалить условие"} onClick={() => setDraft((current) => ({ ...current, rules: current.rules.filter((item) => item.id !== rule.id) }))}>×</button>
            </div>
          )) : <p>{isEnglish ? "Add conditions to award or deduct points for bedtime and wake time." : "Добавьте условия, чтобы начислять или снимать баллы за время сна и пробуждения."}</p>}
        </fieldset>
        <footer><button type="button" className="secondary-button" onClick={onClose}>{isEnglish ? "Cancel" : "Отмена"}</button><button type="submit" className="primary-button">{isEnglish ? "Save plan" : "Сохранить план"}</button></footer>
      </form>
    </div>
  );
}

function AddictionEditor({ tracker, language, calendarMode, onSave, onClose }: { tracker: AddictionTracker; language: Language; calendarMode: CalendarMode; onSave: (tracker: AddictionTracker) => void; onClose: () => void }) {
  const isEnglish = language === "en";
  const [draft, setDraft] = useState(tracker);
  return (
    <div className="modal-backdrop habit-editor-backdrop" role="presentation">
      <form className="habit-editor specialist-editor" onSubmit={(event) => { event.preventDefault(); onSave(markTrackerEntityChanged(draft)); }}>
        <header><div><span className="eyebrow">{isEnglish ? "Abstinence tracker" : "Трекер воздержания"}</span><h2>{isEnglish ? "Tracked behavior" : "Наблюдаемое поведение"}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label={isEnglish ? "Close" : "Закрыть"}>×</button></header>
        <div className="habit-editor-grid"><label><span>{isEnglish ? "Behavior" : "Поведение"}</span><input required value={draft.trackedBehavior} onChange={(event) => setDraft((current) => ({ ...current, trackedBehavior: event.target.value }))} /></label><label><span>{isEnglish ? "Clean day points" : "Баллы за чистый день"}</span><input type="number" min="0" max="100" value={draft.cleanDayPoints} onChange={(event) => setDraft((current) => ({ ...current, cleanDayPoints: Math.max(0, Number(event.target.value) || 0) }))} /></label><label><span>{isEnglish ? "Optional relapse penalty" : "Штраф за срыв (необязательно)"}</span><input type="number" min="0" max="100" value={draft.relapsePenalty} onChange={(event) => setDraft((current) => ({ ...current, relapsePenalty: Math.max(0, Number(event.target.value) || 0) }))} /></label><label className="wide"><span>{isEnglish ? "Description" : "Описание"}</span><textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label></div>
        <RecurrenceBuilder value={draft.schedule.recurrence} startDate={draft.schedule.startDate} calendarMode={calendarMode} destination="tracker" onChange={(recurrence) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, recurrence } }))} />
        <div className="habit-formula-card"><span>{isEnglish ? "Exact formula" : "Точная формула"}</span><strong>{isEnglish ? `Clean day = +${draft.cleanDayPoints}; relapse = -${draft.relapsePenalty}; total ≥ 0` : `Чистый день = +${draft.cleanDayPoints}; срыв = -${draft.relapsePenalty}; общий баланс ≥ 0`}</strong></div>
        <footer><button type="button" className="secondary-button" onClick={onClose}>{isEnglish ? "Cancel" : "Отмена"}</button><button type="submit" className="primary-button" disabled={!draft.trackedBehavior.trim()}>{isEnglish ? "Save tracker" : "Сохранить трекер"}</button></footer>
      </form>
    </div>
  );
}

function HabitStatistics({ workspace, date, language, calendarMode }: { workspace: HabitWorkspace; date: string; language: Language; calendarMode: CalendarMode }) {
  const isEnglish = language === "en";
  const range = reportDateRange(workspace.habitSettings, date);
  const dates = useMemo(() => dateValuesBetween(range.start, range.end), [range.start, range.end]);
  const daily = useMemo(() => dates.map((value) => ({
    date: value,
    habit: trackerSnapshot(workspace, "habit", "day", value, calendarMode).metrics,
    sleep: trackerSnapshot(workspace, "sleep", "day", value, calendarMode).metrics,
    mood: trackerSnapshot(workspace, "mood", "day", value, calendarMode).metrics,
    addiction: trackerSnapshot(workspace, "addiction", "day", value, calendarMode).metrics,
  })), [calendarMode, dates, workspace]);
  const scheduled = daily.reduce((sum, item) => sum + item.habit.scheduled, 0);
  const done = daily.reduce((sum, item) => sum + item.habit.completed, 0);
  const periodScore = daily.reduce((sum, item) => sum + item.habit.score + item.sleep.score + item.addiction.score, 0);
  const sleepMinutes = daily.reduce((sum, item) => sum + item.sleep.sleepTotalMinutes, 0);
  const sleepCount = daily.reduce((sum, item) => sum + item.sleep.sleepCount, 0);
  const sleepQualityTotal = daily.reduce((sum, item) => sum + item.sleep.sleepQualityTotal, 0);
  const sleepQualityCount = daily.reduce((sum, item) => sum + item.sleep.sleepQualityCount, 0);
  const sleepDeviation = daily.reduce((sum, item) => sum + item.sleep.sleepDeviationTotal, 0);
  const sleepBedtimeMinutes = daily.reduce((sum, item) => sum + item.sleep.sleepBedtimeMinutesTotal, 0);
  const sleepWakeMinutes = daily.reduce((sum, item) => sum + item.sleep.sleepWakeMinutesTotal, 0);
  const habitQualityTotal = daily.reduce((sum, item) => sum + item.habit.qualityTotal, 0);
  const habitQualityCount = daily.reduce((sum, item) => sum + item.habit.qualityCount, 0);
  const moodTotal = daily.reduce((sum, item) => sum + item.mood.moodTotal, 0);
  const moodCount = daily.reduce((sum, item) => sum + item.mood.moodCount, 0);
  const moodDistribution = daily.reduce((distribution, item) => distribution.map((count, index) => count + (item.mood.moodDistribution[index] ?? 0)), Array.from({ length: 11 }, () => 0));
  const cleanDays = daily.reduce((sum, item) => sum + item.addiction.cleanDays, 0);
  const relapses = daily.reduce((sum, item) => sum + item.addiction.relapses, 0);
  const cravingTotal = daily.reduce((sum, item) => sum + item.addiction.cravingTotal, 0);
  const cravingCount = daily.reduce((sum, item) => sum + item.addiction.cravingCount, 0);
  const rate = scheduled ? Math.round(done / scheduled * 100) : 0;
  const perfectDays = workspace.dailyGoalRecords.filter((record) => record.date >= range.start && record.date <= range.end && record.status === "perfect").length;
  const recentRewards = [...workspace.rewardTransactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const total = calculateHabitTotal(workspace);
  const rank = heroicRankForProgress(workspace.userProgress);
  const nextRank = nextHeroicRankForProgress(workspace.userProgress);
  const progress = nextRank ? Math.max(0, Math.min(100, Math.round((total - rank.threshold) / (nextRank.threshold - rank.threshold) * 100))) : 100;
  const maxDaily = Math.max(20, ...daily.map((item) => item.habit.score + item.sleep.score + item.addiction.score));
  const points = daily.map((item, index) => `${daily.length > 1 ? index / (daily.length - 1) * 100 : 0},${55 - (item.habit.score + item.sleep.score + item.addiction.score) / maxDaily * 50}`).join(" ");
  return (
    <section className="habit-statistics" aria-labelledby="habit-statistics-title">
      <header className="habit-stats-heading"><div><span className="eyebrow">{isEnglish ? "My habit statistics" : "Статистика моих привычек"}</span><h2 id="habit-statistics-title">{isEnglish ? "Independent tracker metrics" : "Метрики отдельных трекеров"}</h2></div></header>
      <article className="heroic-rank-card" style={{ "--rank-color": rank.color } as CSSProperties}><div className="heroic-rank-art" /><div className="heroic-rank-copy"><span>{isEnglish ? "Heroic progression" : "Героический путь"}</span><h3>{isEnglish ? rank.titleEn : rank.title}</h3><p>{isEnglish ? `${total} lifetime XP · never spent or lost` : `${total} пожизненного XP · не тратится и не теряется`}</p><div><i style={{ width: `${progress}%` }} /></div><small>{nextRank ? (isEnglish ? `${nextRank.threshold - total} XP to ${nextRank.titleEn}` : `${nextRank.threshold - total} XP до «${nextRank.title}»`) : (isEnglish ? "Highest rank reached" : "Высший ранг достигнут")}</small></div><HeroicRankSigil className="heroic-rank-seal" rankId={rank.id} color={rank.color} /></article>
      <div className="habit-stat-cards"><article className="laurels-stat"><span>{isEnglish ? "Spendable currency" : "Расходуемая валюта"}</span><strong>♕ {workspace.userProgress.laurelsBalance}</strong><small>{isEnglish ? "Laurels balance" : "Баланс Лавров"}</small></article><article className="perfect-days-stat"><span>Perfect Day</span><strong>{perfectDays}</strong><small>{isEnglish ? "in selected period" : "за выбранный период"}</small></article><article><span>{isEnglish ? "Habit completion" : "Выполнение привычек"}</span><strong>{rate}%</strong><small>{done} / {scheduled}</small></article><article><span>{isEnglish ? "Average quality" : "Среднее качество"}</span><strong>{habitQualityCount ? (habitQualityTotal / habitQualityCount).toFixed(1) : "—"}</strong><small>{habitQualityCount} {isEnglish ? "ratings" : "оценок"}</small></article><article><span>{isEnglish ? "Period score" : "Баллы периода"}</span><strong>{Math.max(0, periodScore)}</strong><small>{range.start} — {range.end}</small></article><article><span>{isEnglish ? "Average sleep" : "Средняя длительность сна"}</span><strong>{formatDuration(sleepCount ? Math.round(sleepMinutes / sleepCount) : 0, isEnglish)}</strong><small>{sleepCount} {isEnglish ? "entries" : "записей"}</small></article><article><span>{isEnglish ? "Average mood" : "Среднее настроение"}</span><strong>{moodCount ? (moodTotal / moodCount).toFixed(1) : "—"}</strong><small>{moodCount} {isEnglish ? "entries" : "записей"}</small></article><article><span>{isEnglish ? "Abstinence" : "Воздержание"}</span><strong>{cleanDays}</strong><small>{isEnglish ? `${relapses} relapse(s)` : `${relapses} срывов`}</small></article></div>
      <article className="laurel-ledger"><header><div><span className="eyebrow">{isEnglish ? "Immutable reward history" : "Неизменяемая история наград"}</span><h3>{isEnglish ? "Laurels ledger" : "Журнал Лавров"}</h3></div><strong>♕ {workspace.userProgress.laurelsBalance}</strong></header>{recentRewards.length ? <div>{recentRewards.map((transaction) => <div key={transaction.idempotencyKey}><span className={transaction.amount > 0 ? "credit" : transaction.amount < 0 ? "debit" : "neutral"}>{transaction.amount > 0 ? "+" : ""}{transaction.amount}</span><div><strong>{rewardReasonLabel(transaction.reason, isEnglish)}</strong><small>{transaction.sourceId}</small></div><code>{transaction.currency}</code></div>)}</div> : <p>{isEnglish ? "Complete a daily goal to earn the first 5 Laurels." : "Выполните дневную цель, чтобы получить первые 5 Лавров."}</p>}</article>
      <div className="habit-charts-grid"><article className="habit-line-chart"><header><div><span className="eyebrow">{isEnglish ? "Score" : "Баллы"}</span><h3>{isEnglish ? "Earned over time" : "Динамика начисления"}</h3></div><strong>+{Math.max(0, periodScore)}</strong></header><svg viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label={isEnglish ? "Daily points chart" : "График баллов по дням"}><line x1="0" y1="55" x2="100" y2="55" /><line x1="0" y1="30" x2="100" y2="30" /><polygon points={`0,55 ${points} 100,55`} /><polyline points={points} /></svg><footer><span>{range.start}</span><span>{range.end}</span></footer></article><article className="habit-heatmap"><header><span className="eyebrow">{isEnglish ? "Regularity" : "Регулярность"}</span><h3>{isEnglish ? "Last 35 days" : "Последние 35 дней"}</h3></header><div>{dateValuesBetween(addHabitDays(date, -34), date).map((value) => { const snapshot = trackerSnapshot(workspace, "habit", "day", value, calendarMode).metrics; const intensity = snapshot.scheduled ? snapshot.completed / snapshot.scheduled : -1; return <span className={intensity < 0 ? "rest" : ""} style={intensity >= 0 ? { opacity: .22 + intensity * .78 } : undefined} title={`${value}: ${snapshot.completed}/${snapshot.scheduled}`} key={value} />; })}</div><footer><span>{isEnglish ? "Less" : "Меньше"}</span><i /><i /><i /><i /><span>{isEnglish ? "More" : "Больше"}</span></footer></article></div>
      <div className="tracker-insight-grid">
        <article><header><span className="eyebrow">{isEnglish ? "Sleep" : "Сон"}</span><h3>{isEnglish ? "Rhythm and quality" : "Ритм и качество"}</h3></header><dl><div><dt>{isEnglish ? "Bedtime" : "Засыпание"}</dt><dd>{sleepCount ? formatClockMinutes(sleepBedtimeMinutes / sleepCount) : "—"}</dd></div><div><dt>{isEnglish ? "Wake time" : "Пробуждение"}</dt><dd>{sleepCount ? formatClockMinutes(sleepWakeMinutes / sleepCount) : "—"}</dd></div><div><dt>{isEnglish ? "Plan deviation" : "Отклонение"}</dt><dd>{sleepCount ? `${Math.round(sleepDeviation / sleepCount)} ${isEnglish ? "min" : "мин"}` : "—"}</dd></div><div><dt>{isEnglish ? "Quality" : "Качество"}</dt><dd>{sleepQualityCount ? (sleepQualityTotal / sleepQualityCount).toFixed(1) : "—"}</dd></div></dl></article>
        <article className="mood-distribution"><header><span className="eyebrow">{isEnglish ? "Mood" : "Настроение"}</span><h3>{isEnglish ? "Distribution" : "Распределение"}</h3></header><div>{moodDistribution.map((count, index) => <i style={{ "--mood-color": moodColor(index - 5), height: `${Math.max(5, moodCount ? count / Math.max(...moodDistribution, 1) * 100 : 5)}%` } as CSSProperties} title={`${index - 5}: ${count}`} key={index}><span>{index - 5 > 0 ? `+${index - 5}` : index - 5}</span></i>)}</div></article>
        <article><header><span className="eyebrow">{isEnglish ? "Abstinence" : "Воздержание"}</span><h3>{isEnglish ? "Craving load" : "Динамика тяги"}</h3></header><strong className="tracker-insight-value">{cravingCount ? (cravingTotal / cravingCount).toFixed(1) : "—"}<small>/10</small></strong><p>{isEnglish ? `${cleanDays} clean days · ${relapses} relapses` : `${cleanDays} чистых дней · ${relapses} срывов`}</p></article>
      </div>
      {workspace.habits.length ? <div className="habit-ranking-list"><header><span className="eyebrow">{isEnglish ? "Habits" : "Привычки"}</span><h3>{isEnglish ? "Current streaks" : "Текущие серии"}</h3></header>{workspace.habits.map((habit) => { const completions = workspace.habitCompletions.filter((entry) => entry.habitId === habit.id && entry.date >= range.start && entry.date <= range.end && entry.completed); const qualities = completions.filter((entry) => entry.qualityValue !== null); return <article style={{ "--habit-color": habit.color } as CSSProperties} key={habit.id}><i /><div><strong data-no-translate>{habit.title}</strong><small>{completions.length} {isEnglish ? "completions" : "выполнений"}{qualities.length ? ` · ${isEnglish ? "quality" : "качество"} ${(qualities.reduce((sum, entry) => sum + (entry.qualityValue ?? 0), 0) / qualities.length).toFixed(1)}` : ""}</small></div><span>{habitStreak(workspace, habit, date, calendarMode)} {isEnglish ? "days" : "дней"}</span></article>; })}</div> : null}
      {workspace.addictionTrackers.length ? <div className="habit-ranking-list"><header><span className="eyebrow">{isEnglish ? "Abstinence" : "Воздержание"}</span><h3>{isEnglish ? "Current clean streaks" : "Текущие чистые серии"}</h3></header>{workspace.addictionTrackers.map((tracker) => <article style={{ "--habit-color": "#8f6951" } as CSSProperties} key={tracker.id}><i /><div><strong data-no-translate>{tracker.trackedBehavior}</strong><small>{isEnglish ? "Relapse never removes earned points" : "Срыв не отнимает заработанные баллы"}</small></div><span>{addictionStreak(workspace.addictionEntries, tracker.id, date)} {isEnglish ? "days" : "дней"}</span></article>)}</div> : null}
    </section>
  );
}

function SacredHabitLibrary({
  workspace,
  date,
  language,
  calendarMode,
  onChange,
  onStart,
  onEdit,
  onOpenTheokyklosSector,
}: {
  workspace: HabitWorkspace;
  date: string;
  language: Language;
  calendarMode: CalendarMode;
  onChange: (workspace: HabitWorkspace) => void;
  onStart: (practice: SacredPractice) => void;
  onEdit: (habit: Habit) => void;
  onOpenTheokyklosSector?: (sectorId: SacredPracticeSectorId) => void;
}) {
  const isEnglish = language === "en";
  const [selectedSectorId, setSelectedSectorId] = useState<SacredPracticeSectorId>("north");
  const segments = useMemo(() => new Map(THEOKYKLOS_SEGMENTS.map((segment) => [segment.id, segment])), []);
  const sector = segments.get(selectedSectorId)!;
  const practices = sacredPracticesForSector(selectedSectorId);
  const renderSectorTab = (sectorId: SacredPracticeSectorId) => {
    const item = segments.get(sectorId)!;
    const started = workspace.habits.filter((habit) => habit.sacredSectorId === sectorId).length;
    const sectorName = SACRED_SECTOR_NAMES[sectorId][language];
    return (
      <button
        type="button"
        role="tab"
        aria-label={`${sectorName}: ${item.patrons[language]}`}
        aria-selected={selectedSectorId === sectorId}
        className={selectedSectorId === sectorId ? "active" : ""}
        data-sector-id={sectorId}
        style={{ "--sector-sigil-color": SACRED_SECTOR_SIGIL_MOTIFS[sectorId].color } as CSSProperties}
        onClick={() => setSelectedSectorId(sectorId)}
        key={sectorId}
      >
        <SacredSectorSigil sectorId={sectorId} active={selectedSectorId === sectorId} compact />
        <strong>{sectorName}</strong>
        <small>{started ? `${started}/${sacredPracticesForSector(sectorId).length}` : item.patrons[language]}</small>
      </button>
    );
  };

  return (
    <section className="sacred-habit-library" aria-labelledby="sacred-habit-library-title">
      <header>
        <div>
          <span className="eyebrow">ΘΕΟΚΥΚΛΟΣ · {isEnglish ? "embodied myth" : "воплощённый миф"}</span>
          <h2 id="sacred-habit-library-title">{isEnglish ? "Sacred habits" : "Сакральные привычки"}</h2>
          <p>{isEnglish ? "Every practice is an ordinary, trackable action illuminated by a myth and a patron deity." : "Каждая практика — обычное отслеживаемое действие, освещённое мифом и божеством-покровителем."}</p>
        </div>
        {onOpenTheokyklosSector ? <button type="button" className="secondary-button" onClick={() => onOpenTheokyklosSector(selectedSectorId)}>{isEnglish ? "Open sector" : "Открыть сектор"} →</button> : null}
      </header>

      <div className="sacred-sector-navigation" role="tablist" aria-label={isEnglish ? "Theokyklos practice sectors" : "Секторы практик Теокиклоса"}>
        <div className="sacred-compass">
          <div className="sacred-compass-rose" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="sacred-compass-grid">
            {SACRED_COMPASS_SECTOR_IDS.map(renderSectorTab)}
          </div>
        </div>
        <aside className="sacred-auxiliary-sectors">
          <div>
            <span>{isEnglish ? "Sacred axis" : "Сакральная ось"}</span>
            <div className="sacred-axis-grid">{SACRED_AXIS_SECTOR_IDS.map(renderSectorTab)}</div>
          </div>
          <div>
            <span>{isEnglish ? "Thresholds" : "Пороги"}</span>
            <div className="sacred-threshold-grid">{SACRED_THRESHOLD_SECTOR_IDS.map(renderSectorTab)}</div>
          </div>
        </aside>
      </div>

      <div className="sacred-sector-summary">
        <div><SacredSectorSigil sectorId={selectedSectorId} active /><p><small>{SACRED_SECTOR_NAMES[selectedSectorId][language]} · {isEnglish ? "patron deity" : "божество-покровитель"}</small><strong>{sector.patrons[language]}</strong></p></div>
        <p>{sector.essence[language]}</p>
      </div>

      <div className="sacred-practice-grid">
        {practices.map((practice) => {
          const habit = workspace.habits.find((item) => item.sacredPracticeId === practice.id);
          const entry = habit ? completionFor(workspace, habit.id, date) : undefined;
          const canTrack = habit?.active && isHabitScheduledForDate(habit, date, calendarMode) && canRecordHabitOnDate(habit.createdDate, date, habitDateKey(new Date()));
          return (
            <article className={`${habit ? "started" : ""}${habit && !habit.active ? " paused" : ""}`} style={{ "--habit-color": habit?.color ?? practice.color } as CSSProperties} key={practice.id}>
              <header><span aria-hidden="true">{habit?.emoji ?? practice.emoji}</span><div><small>{sector.patrons[language]}</small><h3 data-no-translate={habit ? true : undefined}>{habit?.title ?? practice.title[language]}</h3></div>{habit ? <em>{habit.active ? (isEnglish ? "Active" : "Активна") : (isEnglish ? "Paused" : "На паузе")}</em> : null}</header>
              <p data-no-translate={habit ? true : undefined}>{habit?.description ?? practice.description[language]}</p>
              <blockquote>{practice.myth[language]}</blockquote>
              <footer>
                {habit ? (
                  <div className="sacred-practice-actions">
                    <button type="button" className="sacred-practice-edit" onClick={() => onEdit(habit)}>{isEnglish ? "Edit" : "Изменить"}</button>
                    {habit.active ? <>
                      <button
                        type="button"
                        className={entry?.completed ? "sacred-practice-done" : "primary-button"}
                        disabled={!canTrack}
                        onClick={() => onChange(updateHabitCompletion(workspace, habit, date, { completed: !entry?.completed }))}
                      >
                        {entry?.completed ? `✓ ${isEnglish ? "Completed today" : "Выполнено сегодня"}` : (isEnglish ? "Mark today" : "Отметить сегодня")}
                      </button>
                      <button type="button" className="sacred-practice-disable" onClick={() => onChange({ ...workspace, habits: workspace.habits.map((item) => item.id === habit.id ? markTrackerEntityChanged({ ...item, active: false }) : item) })}>{isEnglish ? "Disable" : "Отключить"}</button>
                    </> : <button type="button" className="primary-button" onClick={() => onChange({ ...workspace, habits: workspace.habits.map((item) => item.id === habit.id ? markTrackerEntityChanged({ ...item, active: true }) : item) })}>{isEnglish ? "Enable again" : "Включить снова"}</button>}
                  </div>
                ) : <button type="button" className="primary-button" onClick={() => onStart(practice)}>{isEnglish ? "Begin practice" : "Начать практику"}</button>}
                <small>{habit?.preferredTime || habit?.reminder.time || practice.suggestedTime} · {isEnglish ? `priority ${habit?.priority ?? practice.priority}` : `приоритет ${habit?.priority ?? practice.priority}`}</small>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function HabitTrackerPage({ workspace, date, language, timeFormat, calendarMode, googleTasksReady, onChange, onReminderRequested, onReminderRemoved, onOpenTheokyklosSector }: HabitTrackerPageProps) {
  const isEnglish = language === "en";
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [activatingTemplate, setActivatingTemplate] = useState<HabitTemplate | null>(null);
  const [editingSleep, setEditingSleep] = useState<SleepPlan | null>(null);
  const [editingAddiction, setEditingAddiction] = useState<AddictionTracker | null>(null);
  const [message, setMessage] = useState("");
  const [heroPathOpen, setHeroPathOpen] = useState(false);
  const range = reportDateRange(workspace.habitSettings, date);
  const total = calculateHabitTotal(workspace);
  const rank = heroicRankForProgress(workspace.userProgress);
  const creationDate = habitDateKey(new Date());
  const comeback = calculateComebackSummary(workspace.dailyGoalRecords, creationDate);
  const sparkCount = workspace.userProgress.streakFreezeCount;
  const canBuySpark = sparkCount < HESTIA_SPARK_MAX && workspace.userProgress.laurelsBalance >= HESTIA_SPARK_COST;
  const latestProtectedDate = [...workspace.dailyGoalRecords].reverse().find((record) => record.status === "protected")?.date ?? null;
  const openNewHabit = () => setEditingHabit(defaultHabit(habitDateKey(new Date()), calendarMode));
  const hasHabits = workspace.habits.length > 0;
  const activeTemplateIds = new Set(workspace.habits.flatMap((habit) => habit.sourceTemplateId ? [habit.sourceTemplateId] : []));
  const visibleStarterTemplates = STARTER_HABIT_TEMPLATES.filter((template) => !workspace.hiddenDefaultTemplates.includes(template.id) && !activeTemplateIds.has(template.id));
  const dailyPanel = <HabitDailyPanel workspace={workspace} date={date} language={language} timeFormat={timeFormat} calendarMode={calendarMode} onChange={onChange} showGoalSettings />;

  const saveHabit = (candidate: Habit) => {
    const previous = workspace.habits.find((item) => item.id === candidate.id);
    const habit = previous ? applyEditableHabitUpdate(previous, candidate) : candidate;
    const nextWorkspace = {
      ...workspace,
      habits: previous
        ? workspace.habits.map((item) => item.id === habit.id ? habit : item)
        : [...workspace.habits, habit],
    };
    onChange(nextWorkspace);
    setEditingHabit(null);
    setMessage(previous
      ? (isEnglish ? "Habit settings updated. Its scoring formula and history were preserved." : "Настройки привычки обновлены. Формула баллов и история сохранены.")
      : (isEnglish ? "Habit saved in the encrypted core." : "Привычка сохранена в зашифрованном ядре."));
    const wantsExternal = habit.reminder.enabled && (habit.reminder.syncToGoogleTasks || habit.reminder.showInGoogleCalendar);
    if (!previous?.reminder.googleTaskId && !previous?.reminder.googleEventId && !wantsExternal) return;
    void (async () => {
      if ((previous?.reminder.googleTaskId || previous?.reminder.googleEventId) && onReminderRemoved) await onReminderRemoved(previous);
      const external = wantsExternal && onReminderRequested
        ? await onReminderRequested({ ...habit, reminder: { ...habit.reminder, googleTaskId: null, googleEventId: null } })
        : { googleTaskId: null, googleEventId: null };
      onChange({ ...nextWorkspace, habits: nextWorkspace.habits.map((item) => item.id === habit.id ? { ...item, reminder: { ...item.reminder, ...external }, updatedAt: trackerTimestamp(), version: item.version + 1, syncState: "pending" } : item) });
      setMessage(wantsExternal ? (isEnglish ? "External reminder synchronized." : "Внешнее напоминание синхронизировано.") : (isEnglish ? "External reminder removed." : "Внешнее напоминание удалено."));
    })().catch((error: Error) => setMessage(error.message));
  };

  const removeHabit = (habit: Habit) => {
    const completionCount = habitCompletionCount(workspace.habitCompletions, habit.id);
    const retainsLaurels = habitRetainsLaurelsOnDeletion(workspace.habitCompletions, habit.id);
    const warning = retainsLaurels
      ? (isEnglish
        ? `Delete “${habit.title}” and its completions? The ${HABIT_LAUREL_RETENTION_COMPLETIONS}-completion milestone is reached, so earned Laurels will remain.`
        : `Удалить «${habit.title}» и все отметки? Рубеж в ${HABIT_LAUREL_RETENTION_COMPLETIONS} выполнений достигнут, поэтому заработанные Лавры сохранятся.`)
      : (isEnglish
        ? `Delete “${habit.title}” and its completions? Progress is ${completionCount}/${HABIT_LAUREL_RETENTION_COMPLETIONS}; the entire Laurels balance will be reset to zero.`
        : `Удалить «${habit.title}» и все отметки? Прогресс: ${completionCount}/${HABIT_LAUREL_RETENTION_COMPLETIONS}; весь баланс Лавров будет обнулён.`);
    if (!window.confirm(warning)) return;
    onChange(removeHabitFromWorkspace(workspace, habit.id));
    setMessage(retainsLaurels
      ? (isEnglish ? "Habit deleted after the mastery milestone. Earned Laurels were retained." : "Привычка удалена после рубежа мастерства. Заработанные Лавры сохранены.")
      : (isEnglish ? "Habit deleted before the mastery milestone. The Laurels balance was reset to zero." : "Привычка удалена до рубежа мастерства. Баланс Лавров обнулён."));
    if ((habit.reminder.googleTaskId || habit.reminder.googleEventId) && onReminderRemoved) void onReminderRemoved(habit).catch((error: Error) => setMessage(error.message));
  };

  const hideStarterTemplate = (template: HabitTemplate) => {
    onChange({ ...workspace, hiddenDefaultTemplates: Array.from(new Set([...workspace.hiddenDefaultTemplates, template.id])) });
    setMessage(isEnglish ? `“${template.titleEn}” was removed from suggestions.` : `«${template.title}» скрыта из предложений.`);
  };

  const purchaseSpark = () => {
    if (sparkCount >= HESTIA_SPARK_MAX) {
      setMessage(isEnglish ? "The Hestia Spark reserve is full." : "Запас Искр Гестии уже заполнен.");
      return;
    }
    if (workspace.userProgress.laurelsBalance < HESTIA_SPARK_COST) {
      setMessage(isEnglish ? `You need ${HESTIA_SPARK_COST} Laurels for a Hestia Spark.` : `Для Искры Гестии нужно ${HESTIA_SPARK_COST} Лавров.`);
      return;
    }
    onChange(buyHestiaSpark(workspace));
    setMessage(isEnglish ? "Hestia's Spark added. It will automatically protect one missed streak day." : "Искра Гестии добавлена. Она автоматически защитит один пропущенный день серии.");
  };

  return (
    <div className="habits-view">
      <header className="habits-hero">
        <div><span className="eyebrow">{isEnglish ? "Encrypted personal tracker" : "Зашифрованный личный трекер"}</span><h1>{isEnglish ? "Trackers" : "Привычки"}</h1><p>{isEnglish ? "Habits, sleep, mood and abstinence are independent modules over one secure tracker core." : "Привычки, сон, настроение и воздержание — независимые модули поверх единого защищённого ядра."}</p></div>
        <div className="habits-hero-status">
          <article className="habits-hero-laurels"><HabitMetricSigil variant="laurels" value={workspace.userProgress.laurelsBalance} /><div><small>{isEnglish ? "Laurels" : "Лавры"}</small><strong>{workspace.userProgress.laurelsBalance}</strong><em>{isEnglish ? "spendable" : "можно тратить"}</em></div></article>
          <article className="habits-hero-streak"><HabitMetricSigil variant="streak" value={workspace.userProgress.currentStreak} record={workspace.userProgress.longestStreak} /><div><small>{isEnglish ? "Current streak" : "Текущая серия"}</small><strong>{workspace.userProgress.currentStreak}</strong><em>{isEnglish ? `best ${workspace.userProgress.longestStreak} days` : `рекорд ${workspace.userProgress.longestStreak} дней`}</em></div></article>
          <div className="habits-hero-score" style={{ "--rank-color": rank.color } as CSSProperties}><HeroicRankSigil rankId={rank.id} color={rank.color} /><div><small>{isEnglish ? "Current rank" : "Текущий ранг"}</small><strong>{isEnglish ? rank.titleEn : rank.title}</strong><em>{total} XP</em></div></div>
        </div>
        <div className="habits-hero-actions"><button type="button" className="secondary-button hero-path-open" onClick={() => setHeroPathOpen(true)}>{isEnglish ? "Path of the Hero" : "Путь Героя"} →</button><button type="button" className="primary-button" onClick={openNewHabit}>＋ {isEnglish ? "New habit" : "Новая привычка"}</button></div>
      </header>
      {hasHabits ? <section className="streak-resilience" aria-label={isEnglish ? "Streak protection and comeback" : "Защита серии и возвращение"}>
        <article className="hestia-spark-card">
          <span className="hestia-spark-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><defs><radialGradient id="hestia-flame"><stop offset="0" stopColor="#fff1b7" /><stop offset=".55" stopColor="#e7bb5f" /><stop offset="1" stopColor="#aa5c36" /></radialGradient></defs><path d="M25 5c3 8-3 10 1 16 2-4 6-5 7-10 7 7 10 15 7 23-3 8-10 11-17 10C13 43 7 37 8 28c1-8 7-13 13-18-1 6 1 8 4 11 2-5-1-9 0-16Z" fill="url(#hestia-flame)" /><path d="M24 26c4 4 5 7 3 11-2 3-7 3-9 0-3-5 1-8 6-11Z" fill="#fff7d6" /></svg>
          </span>
          <div><small>{isEnglish ? "Automatic streak protection" : "Автоматическая защита серии"}</small><h2>{isEnglish ? "Hestia's Spark" : "Искра Гестии"}</h2><p>{isEnglish ? "Protects one missed day without XP or a fake completion." : "Сохраняет серию при одном пропуске, не начисляя XP и не создавая ложного выполнения."}</p>{latestProtectedDate ? <em>{isEnglish ? `Last protection: ${latestProtectedDate}` : `Последняя защита: ${latestProtectedDate}`}</em> : null}</div>
          <div className="hestia-spark-inventory" aria-label={isEnglish ? `${sparkCount} of ${HESTIA_SPARK_MAX} Sparks` : `${sparkCount} из ${HESTIA_SPARK_MAX} Искр`}>
            {Array.from({ length: HESTIA_SPARK_MAX }, (_, index) => <i className={index < sparkCount ? "filled" : ""} key={index}>✦</i>)}
            <strong>{sparkCount} / {HESTIA_SPARK_MAX}</strong>
          </div>
          <button type="button" disabled={!canBuySpark} onClick={purchaseSpark}>{sparkCount >= HESTIA_SPARK_MAX ? (isEnglish ? "Reserve full" : "Запас полон") : <>♕ {HESTIA_SPARK_COST} · {isEnglish ? "Buy" : "Купить"}</>}</button>
        </article>
        <article className={`comeback-card${comeback.active ? " active" : ""}`}>
          <span className="comeback-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M39 19A16 16 0 1 0 40 31" /><path d="m31 10 8 9 4-11" /><path d="M16 31c4-7 11-10 18-8" /></svg></span>
          <div><small>{isEnglish ? "After a broken streak" : "После разрыва серии"}</small><h2>{isEnglish ? "Comeback" : "Возвращение"}</h2><p>{comeback.active ? (isEnglish ? "Reach the daily goal three times in a row. The old streak is not restored." : "Выполните дневную цель три раза подряд. Прежняя серия не восстанавливается.") : (isEnglish ? "If a streak breaks, a humane three-day return path will appear here." : "Если серия прервётся, здесь появится бережный трёхдневный путь возвращения.")}</p>{comeback.lastCompletedDate && !comeback.active ? <em>{isEnglish ? `Last comeback: ${comeback.lastCompletedDate} · +${COMEBACK_REWARD_LAURELS} Laurels` : `Последнее возвращение: ${comeback.lastCompletedDate} · +${COMEBACK_REWARD_LAURELS} Лавров`}</em> : null}</div>
          <div className="comeback-progress" aria-label={isEnglish ? `${comeback.progress} of ${comeback.target} days` : `${comeback.progress} из ${comeback.target} дней`}><div>{Array.from({ length: comeback.target }, (_, index) => <i className={index < comeback.progress ? "done" : ""} key={index}>{index < comeback.progress ? "✓" : index + 1}</i>)}</div><strong>{comeback.active ? `${comeback.progress} / ${comeback.target}` : (isEnglish ? "Ready" : "Готово")}</strong></div>
        </article>
      </section> : null}
      {hasHabits ? dailyPanel : null}
      {hasHabits ? <HabitQuestPanel workspace={workspace} date={date} language={language} /> : null}
      {message ? <p className="habit-status-message" role="status">{message}</p> : null}

      {visibleStarterTemplates.length || workspace.hiddenDefaultTemplates.length ? (
        <section className="habit-template-library" aria-labelledby="habit-template-library-title">
          <header><div><span className="eyebrow">{isEnglish ? "A considered beginning" : "Продуманное начало"}</span><h2 id="habit-template-library-title">{isEnglish ? "Starter habits" : "Стартовые привычки"}</h2><p>{isEnglish ? "Choose only what supports your rhythm. Suggestions do nothing until you add them." : "Выберите только то, что поддерживает ваш ритм. До добавления предложения ничего не создают и не начисляют."}</p></div>{workspace.hiddenDefaultTemplates.length ? <button type="button" className="secondary-button" onClick={() => onChange({ ...workspace, hiddenDefaultTemplates: [] })}>{isEnglish ? "Restore hidden" : "Восстановить скрытые"}</button> : null}</header>
          {visibleStarterTemplates.length ? <div className="habit-template-grid">{visibleStarterTemplates.map((template) => <article style={{ "--habit-color": template.color } as CSSProperties} key={template.id}><span className="habit-template-icon" aria-hidden="true">{template.icon}</span><div><h3>{isEnglish ? template.titleEn : template.title}</h3><p>{isEnglish ? template.descriptionEn : template.description}</p><small>{isEnglish ? template.frequencyEn : template.frequency}</small></div><footer><button type="button" className="primary-button" onClick={() => setActivatingTemplate(template)}>{isEnglish ? "Add" : "Добавить"}</button><button type="button" className="habit-template-hide" onClick={() => hideStarterTemplate(template)}>{isEnglish ? "Hide suggestion" : "Скрыть предложение"}</button></footer></article>)}</div> : <p className="habit-template-empty">{isEnglish ? "All remaining suggestions are hidden. You can restore them here or in account settings." : "Все оставшиеся предложения скрыты. Их можно вернуть здесь или в настройках личного кабинета."}</p>}
        </section>
      ) : null}

      <SacredHabitLibrary
        workspace={workspace}
        date={date}
        language={language}
        calendarMode={calendarMode}
        onChange={onChange}
        onStart={(practice) => saveHabit(createHabitFromSacredPractice(practice, creationDate, calendarMode, language))}
        onEdit={setEditingHabit}
        onOpenTheokyklosSector={onOpenTheokyklosSector}
      />

      {!hasHabits ? dailyPanel : null}

      <section className="habit-library"><header><div><span className="eyebrow">{isEnglish ? "Habit core" : "Ядро привычек"}</span><h2>{isEnglish ? "Habits" : "Обычные привычки"}</h2></div><button type="button" onClick={openNewHabit}>＋ {isEnglish ? "Add" : "Добавить"}</button></header><p className="habit-library-rule">🔒 {isEnglish ? `All settings can be edited except points and the quality scale. Deleting before ${HABIT_LAUREL_RETENTION_COMPLETIONS} completions resets all Laurels.` : `Можно изменять все настройки, кроме баллов и шкалы качества. Удаление до ${HABIT_LAUREL_RETENTION_COMPLETIONS} выполнений обнуляет все Лавры.`}</p>{workspace.habits.length ? <div>{[...workspace.habits].sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title)).map((habit) => <article className={!habit.active ? "paused" : ""} style={{ "--habit-color": habit.color } as CSSProperties} key={habit.id}><i /><div><span><b className="habit-emoji" aria-hidden="true">{habit.emoji}</b><strong data-no-translate>{habit.title}</strong><em>{isEnglish ? `Priority ${habit.priority}` : `Приоритет ${habit.priority}`}</em></span><small>{scoringFormula(habit.scoringMode, isEnglish)} · {isEnglish ? `created ${habit.createdDate}` : `создана ${habit.createdDate}`} · {isEnglish ? "Laurels milestone" : "Рубеж Лавров"} {Math.min(habitCompletionCount(workspace.habitCompletions, habit.id), HABIT_LAUREL_RETENTION_COMPLETIONS)}/{HABIT_LAUREL_RETENTION_COMPLETIONS}</small></div><output>{habit.scoringMode === "none" ? "—" : `≤${MAX_HABIT_XP_PER_COMPLETION}`}</output><div className="habit-library-actions"><button type="button" onClick={() => setEditingHabit(habit)}>{isEnglish ? "Edit" : "Изменить"}</button><button type="button" onClick={() => onChange({ ...workspace, habits: workspace.habits.map((item) => item.id === habit.id ? markTrackerEntityChanged({ ...item, active: !item.active }) : item) })}>{habit.active ? (isEnglish ? "Pause" : "Пауза") : (isEnglish ? "Resume" : "Включить")}</button><button type="button" className="danger" onClick={() => removeHabit(habit)}>{isEnglish ? "Delete" : "Удалить"}</button></div></article>)}</div> : <div className="habit-library-empty"><p>{isEnglish ? "No regular habits yet." : "Обычных привычек пока нет."}</p><button type="button" className="primary-button" onClick={openNewHabit}>{isEnglish ? "Create first habit" : "Создать первую привычку"}</button></div>}</section>

      <div className="tracker-module-grid">
        <section className="tracker-module-card sleep-module"><header><div><span className="eyebrow">{isEnglish ? "Independent module" : "Независимый модуль"}</span><h2>{isEnglish ? "Sleep" : "Сон"}</h2></div><button type="button" onClick={() => setEditingSleep(defaultSleepPlan(date, calendarMode))}>＋ {isEnglish ? "Plan" : "План"}</button></header>{workspace.sleepPlans.length ? workspace.sleepPlans.map((plan) => <article key={plan.id}><div><strong data-no-translate>{plan.title}</strong><small>{plan.targetBedtime} → {plan.targetWakeTime} · {plan.schedule.timezone}</small></div><button type="button" onClick={() => setEditingSleep(plan)}>{isEnglish ? "Edit" : "Изменить"}</button><button type="button" className="danger" onClick={() => onChange({ ...workspace, sleepPlans: workspace.sleepPlans.filter((item) => item.id !== plan.id), sleepEntries: workspace.sleepEntries.filter((entry) => entry.planId !== plan.id) })}>{isEnglish ? "Delete" : "Удалить"}</button></article>) : <p>{isEnglish ? "Track bedtime, wake time, duration and quality across midnight and DST." : "Отслеживайте сон, пробуждение, длительность и качество с учётом полуночи и DST."}</p>}</section>
        <section className="tracker-module-card addiction-module"><header><div><span className="eyebrow">{isEnglish ? "Independent module" : "Независимый модуль"}</span><h2>{isEnglish ? "Abstinence" : "Воздержание"}</h2></div><button type="button" onClick={() => setEditingAddiction(defaultAddictionTracker(date, calendarMode))}>＋ {isEnglish ? "Tracker" : "Трекер"}</button></header>{workspace.addictionTrackers.length ? workspace.addictionTrackers.map((tracker) => <article key={tracker.id}><div><strong data-no-translate>{tracker.trackedBehavior}</strong><small>{isEnglish ? `Clean day +${tracker.cleanDayPoints} · relapse -${tracker.relapsePenalty}` : `Чистый день +${tracker.cleanDayPoints} · срыв -${tracker.relapsePenalty}`}</small></div><button type="button" onClick={() => setEditingAddiction(tracker)}>{isEnglish ? "Edit" : "Изменить"}</button><button type="button" className="danger" onClick={() => onChange({ ...workspace, addictionTrackers: workspace.addictionTrackers.filter((item) => item.id !== tracker.id), addictionEntries: workspace.addictionEntries.filter((entry) => entry.trackerId !== tracker.id) })}>{isEnglish ? "Delete" : "Удалить"}</button></article>) : <p>{isEnglish ? "Clean days, relapses, craving and triggers stay separate from habit completions." : "Чистые дни, срывы, тяга и триггеры хранятся отдельно от выполнений привычек."}</p>}</section>
      </div>

      <AchievementPanel workspace={workspace} language={language} />
      <section className="habit-range-toolbar"><span>{isEnglish ? "Analytics period" : "Период аналитики"}</span><div>{(["week", "days-30", "month", "quarter", "year", "custom"] as const).map((period) => <button type="button" className={workspace.habitSettings.reportRange === period ? "active" : ""} onClick={() => onChange({ ...workspace, habitSettings: { ...workspace.habitSettings, reportRange: period } })} key={period}>{period === "week" ? (isEnglish ? "7 days" : "7 дней") : period === "days-30" ? (isEnglish ? "30 days" : "30 дней") : period === "month" ? (isEnglish ? "Month" : "Месяц") : period === "quarter" ? (isEnglish ? "Quarter" : "Квартал") : period === "year" ? (isEnglish ? "Year" : "Год") : (isEnglish ? "Custom" : "Свой")}</button>)}</div>{workspace.habitSettings.reportRange === "custom" ? <label><input type="date" value={workspace.habitSettings.customRangeStart} onChange={(event) => onChange({ ...workspace, habitSettings: { ...workspace.habitSettings, customRangeStart: event.target.value } })} /><span>—</span><input type="date" value={workspace.habitSettings.customRangeEnd} onChange={(event) => onChange({ ...workspace, habitSettings: { ...workspace.habitSettings, customRangeEnd: event.target.value } })} /></label> : <small>{range.start} — {range.end}</small>}</section>
      <HabitStatistics workspace={workspace} date={date} language={language} calendarMode={calendarMode} />
      {heroPathOpen ? <HeroPathPanel workspace={workspace} language={language} onClaimCheckpoint={(rankId) => { const next = claimHeroPathAmphora(workspace, rankId); onChange(next); if (next !== workspace) setMessage(isEnglish ? "The amphora is open. Laurels were added to your ledger." : "Амфора открыта. Лавры добавлены в журнал наград."); }} onRevealHiddenPath={() => { const next = revealHiddenHeroicPath(workspace); onChange(next); if (next !== workspace) setMessage(isEnglish ? "The second path has been revealed." : "Второй путь открыт."); }} onClose={() => setHeroPathOpen(false)} /> : null}
      {activatingTemplate ? <HabitTemplateSetup template={activatingTemplate} date={creationDate} language={language} calendarMode={calendarMode} googleTasksReady={googleTasksReady} onSave={(habit) => { setActivatingTemplate(null); saveHabit(habit); }} onClose={() => setActivatingTemplate(null)} /> : null}
      {editingHabit ? <HabitEditor habit={editingHabit} isExisting={workspace.habits.some((habit) => habit.id === editingHabit.id)} language={language} calendarMode={calendarMode} googleTasksReady={googleTasksReady} onSave={saveHabit} onClose={() => setEditingHabit(null)} /> : null}
      {editingSleep ? <SleepEditor plan={editingSleep} language={language} calendarMode={calendarMode} onSave={(plan) => { onChange({ ...workspace, sleepPlans: workspace.sleepPlans.some((item) => item.id === plan.id) ? workspace.sleepPlans.map((item) => item.id === plan.id ? plan : item) : [...workspace.sleepPlans, plan] }); setEditingSleep(null); }} onClose={() => setEditingSleep(null)} /> : null}
      {editingAddiction ? <AddictionEditor tracker={editingAddiction} language={language} calendarMode={calendarMode} onSave={(tracker) => { onChange({ ...workspace, addictionTrackers: workspace.addictionTrackers.some((item) => item.id === tracker.id) ? workspace.addictionTrackers.map((item) => item.id === tracker.id ? tracker : item) : [...workspace.addictionTrackers, tracker] }); setEditingAddiction(null); }} onClose={() => setEditingAddiction(null)} /> : null}
    </div>
  );
}
