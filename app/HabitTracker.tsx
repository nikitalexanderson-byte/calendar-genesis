"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { CalendarMode } from "./calendar-data";
import type { Language } from "./i18n";
import { formatTimeValue, type TimeFormat } from "./time-format";
import { RecurrenceBuilder } from "./RecurrenceBuilder";
import {
  HABIT_COLORS,
  HEROIC_RANKS,
  addHabitDays,
  calculateHabitTotal,
  dateValuesBetween,
  defaultHabit,
  heroicRank,
  isHabitScheduledForDate,
  reportDateRange,
  scoreHabitCompletion,
  type Habit,
  type HabitCompletion,
  type HabitQualityScale,
  type HabitScoringMode,
  type HabitWorkspace,
} from "./habits";
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

type DailyPanelProps = {
  workspace: HabitWorkspace;
  date: string;
  language: Language;
  timeFormat: TimeFormat;
  calendarMode: CalendarMode;
  onChange: (workspace: HabitWorkspace) => void;
  onOpenHabits?: () => void;
  compact?: boolean;
};

type HabitTrackerPageProps = DailyPanelProps & {
  googleTasksReady: boolean;
  onReminderRequested?: (habit: Habit) => Promise<{ googleTaskId: string | null; googleEventId: string | null }>;
  onReminderRemoved?: (habit: Habit) => Promise<void>;
};

function completionFor(workspace: HabitWorkspace, habitId: string, date: string) {
  return workspace.habitCompletions.find((entry) => entry.habitId === habitId && entry.date === date);
}

function replaceCompletion(workspace: HabitWorkspace, habit: Habit, date: string, patch: Partial<HabitCompletion>) {
  const current = completionFor(workspace, habit.id, date);
  const base: HabitCompletion = current ?? {
    ...newTrackerEntity("habit-completion"),
    habitId: habit.id,
    date,
    completed: false,
    qualityValue: null,
    score: 0,
    note: "",
  };
  const patched = markTrackerEntityChanged({ ...base, ...patch });
  const entry = { ...patched, score: scoreHabitCompletion(habit, patched) };
  return {
    ...workspace,
    habitCompletions: [
      ...workspace.habitCompletions.filter((item) => !(item.habitId === habit.id && item.date === date)),
      entry,
    ],
  };
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

export function HabitDailyPanel({ workspace, date, language, timeFormat, calendarMode, onChange, onOpenHabits, compact = false }: DailyPanelProps) {
  const isEnglish = language === "en";
  const dueHabits = workspace.habits.filter((habit) => isHabitScheduledForDate(habit, date, calendarMode));
  const dueSleepPlans = workspace.sleepPlans.filter((plan) => plan.active && isTrackerScheduledForDate(plan.schedule, date, calendarMode));
  const dueAddictions = workspace.addictionTrackers.filter((tracker) => tracker.status === "active" && isTrackerScheduledForDate(tracker.schedule, date, calendarMode));
  const completedHabits = dueHabits.filter((habit) => completionFor(workspace, habit.id, date)?.completed).length;
  const completedSleep = dueSleepPlans.filter((plan) => {
    const entry = workspace.sleepEntries.find((item) => item.planId === plan.id && item.date === date);
    return Boolean(entry?.fellAsleepAt && entry.wokeAt);
  }).length;
  const completedAddictions = dueAddictions.filter((tracker) => workspace.addictionEntries.some((entry) => entry.trackerId === tracker.id && entry.date === date && (entry.cleanDay || entry.relapse))).length;
  const totalDue = dueHabits.length + dueSleepPlans.length + dueAddictions.length;
  const completed = completedHabits + completedSleep + completedAddictions;
  const dayPoints = workspace.habitCompletions.filter((entry) => entry.date === date).reduce((sum, entry) => sum + Math.max(0, entry.score), 0)
    + workspace.sleepEntries.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.score, 0)
    + workspace.addictionEntries.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.score, 0);
  const hasTrackers = workspace.habits.length || workspace.sleepPlans.length || workspace.addictionTrackers.length;

  return (
    <section className={`habit-daily-panel${compact ? " compact" : ""}`} aria-labelledby={`habit-daily-title-${date}`}>
      <header>
        <div>
          <span className="eyebrow">{isEnglish ? "Daily rhythm" : "Ежедневный ритм"}</span>
          <h2 id={`habit-daily-title-${date}`}>{isEnglish ? "Personal trackers" : "Личные трекеры"}</h2>
        </div>
        {totalDue ? (
          <div className="habit-day-progress" aria-label={isEnglish ? `${completed} of ${totalDue} recorded` : `Зафиксировано ${completed} из ${totalDue}`}>
            <strong>{completed}/{totalDue}</strong>
            <span><i style={{ width: `${Math.round(completed / totalDue * 100)}%` }} /></span>
            <small>+{Math.max(0, dayPoints)} {isEnglish ? "pts" : "баллов"}</small>
          </div>
        ) : null}
      </header>

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
            return (
              <article className={entry?.completed ? "done" : ""} style={{ "--habit-color": habit.color } as CSSProperties} key={habit.id}>
                <button
                  type="button"
                  className="habit-check"
                  onClick={() => onChange(replaceCompletion(workspace, habit, date, {
                    completed: !entry?.completed,
                    qualityValue: !entry?.completed && habit.qualityScale !== "none" ? entry?.qualityValue ?? (habit.qualityScale === "ten" ? 5 : 0) : entry?.qualityValue ?? null,
                  }))}
                  aria-pressed={Boolean(entry?.completed)}
                  aria-label={entry?.completed ? (isEnglish ? `Unmark ${habit.title}` : `Снять отметку «${habit.title}»`) : (isEnglish ? `Mark ${habit.title}` : `Отметить «${habit.title}»`)}
                >
                  {entry?.completed ? "✓" : ""}
                </button>
                <div className="habit-check-copy">
                  <span><strong data-no-translate>{habit.title}</strong><em>{habit.scoringMode === "none" ? (isEnglish ? "Observation" : "Наблюдение") : (isEnglish ? "Habit" : "Привычка")}</em></span>
                  {habit.description ? <small data-no-translate>{habit.description}</small> : null}
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
                      onChange={(event) => onChange(replaceCompletion(workspace, habit, date, { completed: true, qualityValue: Number(event.target.value) }))}
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

function HabitEditor({ habit, language, calendarMode, googleTasksReady, onSave, onClose }: { habit: Habit; language: Language; calendarMode: CalendarMode; googleTasksReady: boolean; onSave: (habit: Habit) => void; onClose: () => void }) {
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
      <form className="habit-editor" onSubmit={(event) => { event.preventDefault(); onSave(markTrackerEntityChanged(draft)); }}>
        <header><div><span className="eyebrow">{isEnglish ? "Habit core" : "Ядро привычек"}</span><h2>{habit.title ? (isEnglish ? "Edit habit" : "Изменить привычку") : (isEnglish ? "New habit" : "Новая привычка")}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label={isEnglish ? "Close" : "Закрыть"}>×</button></header>
        <div className="habit-editor-grid">
          <label><span>{isEnglish ? "Name" : "Название"}</span><input required maxLength={100} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
          <label className="wide"><span>{isEnglish ? "Description" : "Описание"}</span><textarea maxLength={500} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
          <fieldset className="habit-color-field wide"><legend>{isEnglish ? "Color" : "Цвет"}</legend><div>{HABIT_COLORS.map((color) => <button type="button" className={draft.color === color ? "selected" : ""} style={{ background: color }} onClick={() => setDraft((current) => ({ ...current, color }))} aria-label={color} key={color} />)}</div></fieldset>
        </div>
        <fieldset className="habit-editor-section">
          <legend><span>01</span>{isEnglish ? "Rhythm and calendar" : "Ритм и календарь"}</legend>
          <div className="habit-editor-grid">
            <label><span>{isEnglish ? "Tracking starts" : "Начало отслеживания"}</span><input type="date" value={draft.schedule.startDate} onChange={(event) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, startDate: event.target.value, recurrence: { ...current.schedule.recurrence, rangeStart: event.target.value } } }))} /></label>
            <label className="habit-switch"><span><strong>{isEnglish ? "Track indefinitely" : "Отслеживать всегда"}</strong><small>{isEnglish ? "No final date" : "Без даты окончания"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Track indefinitely" : "Отслеживать всегда"} checked={forever} onChange={(event) => { setForever(event.target.checked); setDraft((current) => ({ ...current, schedule: { ...current.schedule, endDate: event.target.checked ? null : current.schedule.recurrence.rangeEnd || current.schedule.startDate } })); }} /><i /></label>
          </div>
          <RecurrenceBuilder
            value={draft.schedule.recurrence}
            startDate={draft.schedule.startDate}
            calendarMode={calendarMode}
            destination="tracker"
            onChange={(recurrence) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, recurrence, endDate: forever ? null : recurrence.rangeEnd || current.schedule.endDate } }))}
          />
        </fieldset>
        <fieldset className="habit-editor-section">
          <legend><span>02</span>{isEnglish ? "Quality and points" : "Качество и баллы"}</legend>
          <label className="habit-switch habit-disable-switch"><span><strong>{isEnglish ? "Disable scoring" : "Отключить начисление баллов"}</strong><small>{isEnglish ? "All scoring fields will be disabled" : "Все поля качества и баллов будут выключены"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Disable habit scoring" : "Отключить начисление баллов"} checked={scoringDisabled} onChange={(event) => setDraft((current) => ({ ...current, scoringMode: event.target.checked ? "none" : current.qualityScale === "ten" ? "quality-ten" : current.qualityScale === "bipolar" ? "quality-bipolar" : "binary" }))} /><i /></label>
          <fieldset className="habit-scoring-fields" disabled={scoringDisabled}>
            <div className="habit-editor-grid">
              <label><span>{isEnglish ? "Quality scale" : "Шкала качества"}</span><select value={draft.qualityScale} onChange={(event) => setQualityScale(event.target.value as HabitQualityScale)}><option value="none">{isEnglish ? "No scale" : "Без оценки"}</option><option value="ten">{isEnglish ? "1 to 10" : "От 1 до 10"}</option><option value="bipolar">{isEnglish ? "−5 to +5" : "От −5 до +5"}</option></select></label>
              <div className="habit-formula-card"><span>{isEnglish ? "Exact formula" : "Точная формула"}</span><strong>{scoringFormula(scoringDisabled ? "none" : draft.scoringMode, isEnglish)}</strong></div>
            </div>
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
        <footer><button type="button" className="secondary-button" onClick={onClose}>{isEnglish ? "Cancel" : "Отмена"}</button><button type="submit" className="primary-button" disabled={!draft.title.trim()}>{isEnglish ? "Save habit" : "Сохранить привычку"}</button></footer>
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
  const total = calculateHabitTotal(workspace);
  const rank = heroicRank(total);
  const nextRank = HEROIC_RANKS.find((item) => item.threshold > total);
  const progress = nextRank ? Math.max(0, Math.min(100, Math.round((total - rank.threshold) / (nextRank.threshold - rank.threshold) * 100))) : 100;
  const maxDaily = Math.max(20, ...daily.map((item) => item.habit.score + item.sleep.score + item.addiction.score));
  const points = daily.map((item, index) => `${daily.length > 1 ? index / (daily.length - 1) * 100 : 0},${55 - (item.habit.score + item.sleep.score + item.addiction.score) / maxDaily * 50}`).join(" ");
  return (
    <section className="habit-statistics" aria-labelledby="habit-statistics-title">
      <header className="habit-stats-heading"><div><span className="eyebrow">{isEnglish ? "Client-side analytics" : "Клиентская аналитика"}</span><h2 id="habit-statistics-title">{isEnglish ? "Independent tracker metrics" : "Метрики отдельных трекеров"}</h2></div></header>
      <article className="heroic-rank-card" style={{ "--rank-color": rank.color } as CSSProperties}><div className="heroic-rank-art" /><div className="heroic-rank-copy"><span>{isEnglish ? "Heroic progression" : "Героический путь"}</span><h3>{isEnglish ? rank.titleEn : rank.title}</h3><p>{isEnglish ? `${total} points · the balance never drops below zero` : `${total} баллов · баланс никогда не опускается ниже нуля`}</p><div><i style={{ width: `${progress}%` }} /></div><small>{nextRank ? (isEnglish ? `${nextRank.threshold - total} points to ${nextRank.titleEn}` : `${nextRank.threshold - total} баллов до «${nextRank.title}»`) : (isEnglish ? "Highest rank reached" : "Высший ранг достигнут")}</small></div><span className="heroic-rank-seal" aria-hidden="true">{rank.symbol}</span></article>
      <div className="habit-stat-cards"><article><span>{isEnglish ? "Habit completion" : "Выполнение привычек"}</span><strong>{rate}%</strong><small>{done} / {scheduled}</small></article><article><span>{isEnglish ? "Average quality" : "Среднее качество"}</span><strong>{habitQualityCount ? (habitQualityTotal / habitQualityCount).toFixed(1) : "—"}</strong><small>{habitQualityCount} {isEnglish ? "ratings" : "оценок"}</small></article><article><span>{isEnglish ? "Period score" : "Баллы периода"}</span><strong>{Math.max(0, periodScore)}</strong><small>{range.start} — {range.end}</small></article><article><span>{isEnglish ? "Average sleep" : "Средняя длительность сна"}</span><strong>{formatDuration(sleepCount ? Math.round(sleepMinutes / sleepCount) : 0, isEnglish)}</strong><small>{sleepCount} {isEnglish ? "entries" : "записей"}</small></article><article><span>{isEnglish ? "Average mood" : "Среднее настроение"}</span><strong>{moodCount ? (moodTotal / moodCount).toFixed(1) : "—"}</strong><small>{moodCount} {isEnglish ? "entries" : "записей"}</small></article><article><span>{isEnglish ? "Abstinence" : "Воздержание"}</span><strong>{cleanDays}</strong><small>{isEnglish ? `${relapses} relapse(s)` : `${relapses} срывов`}</small></article></div>
      <div className="habit-charts-grid"><article className="habit-line-chart"><header><div><span className="eyebrow">{isEnglish ? "Score" : "Баллы"}</span><h3>{isEnglish ? "Earned over time" : "Динамика начисления"}</h3></div><strong>+{Math.max(0, periodScore)}</strong></header><svg viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label={isEnglish ? "Daily points chart" : "График баллов по дням"}><line x1="0" y1="55" x2="100" y2="55" /><line x1="0" y1="30" x2="100" y2="30" /><polygon points={`0,55 ${points} 100,55`} /><polyline points={points} /></svg><footer><span>{range.start}</span><span>{range.end}</span></footer></article><article className="habit-heatmap"><header><span className="eyebrow">{isEnglish ? "Regularity" : "Регулярность"}</span><h3>{isEnglish ? "Last 35 days" : "Последние 35 дней"}</h3></header><div>{dateValuesBetween(addHabitDays(date, -34), date).map((value) => { const snapshot = trackerSnapshot(workspace, "habit", "day", value, calendarMode).metrics; const intensity = snapshot.scheduled ? snapshot.completed / snapshot.scheduled : -1; return <span className={intensity < 0 ? "rest" : ""} style={intensity >= 0 ? { opacity: .22 + intensity * .78 } : undefined} title={`${value}: ${snapshot.completed}/${snapshot.scheduled}`} key={value} />; })}</div><footer><span>{isEnglish ? "Less" : "Меньше"}</span><i /><i /><i /><i /><span>{isEnglish ? "More" : "Больше"}</span></footer></article></div>
      <div className="tracker-insight-grid">
        <article><header><span className="eyebrow">{isEnglish ? "Sleep" : "Сон"}</span><h3>{isEnglish ? "Rhythm and quality" : "Ритм и качество"}</h3></header><dl><div><dt>{isEnglish ? "Bedtime" : "Засыпание"}</dt><dd>{sleepCount ? formatClockMinutes(sleepBedtimeMinutes / sleepCount) : "—"}</dd></div><div><dt>{isEnglish ? "Wake time" : "Пробуждение"}</dt><dd>{sleepCount ? formatClockMinutes(sleepWakeMinutes / sleepCount) : "—"}</dd></div><div><dt>{isEnglish ? "Plan deviation" : "Отклонение"}</dt><dd>{sleepCount ? `${Math.round(sleepDeviation / sleepCount)} ${isEnglish ? "min" : "мин"}` : "—"}</dd></div><div><dt>{isEnglish ? "Quality" : "Качество"}</dt><dd>{sleepQualityCount ? (sleepQualityTotal / sleepQualityCount).toFixed(1) : "—"}</dd></div></dl></article>
        <article className="mood-distribution"><header><span className="eyebrow">{isEnglish ? "Mood" : "Настроение"}</span><h3>{isEnglish ? "Distribution" : "Распределение"}</h3></header><div>{moodDistribution.map((count, index) => <i style={{ "--mood-color": moodColor(index - 5), height: `${Math.max(5, moodCount ? count / Math.max(...moodDistribution, 1) * 100 : 5)}%` } as CSSProperties} title={`${index - 5}: ${count}`} key={index}><span>{index - 5 > 0 ? `+${index - 5}` : index - 5}</span></i>)}</div></article>
        <article><header><span className="eyebrow">{isEnglish ? "Abstinence" : "Воздержание"}</span><h3>{isEnglish ? "Craving load" : "Динамика тяги"}</h3></header><strong className="tracker-insight-value">{cravingCount ? (cravingTotal / cravingCount).toFixed(1) : "—"}<small>/10</small></strong><p>{isEnglish ? `${cleanDays} clean days · ${relapses} relapses` : `${cleanDays} чистых дней · ${relapses} срывов`}</p></article>
      </div>
      {workspace.habits.length ? <div className="habit-ranking-list"><header><span className="eyebrow">{isEnglish ? "Habits" : "Привычки"}</span><h3>{isEnglish ? "Current streaks" : "Текущие серии"}</h3></header>{workspace.habits.map((habit) => { const completions = workspace.habitCompletions.filter((entry) => entry.habitId === habit.id && entry.date >= range.start && entry.date <= range.end && entry.completed); const qualities = completions.filter((entry) => entry.qualityValue !== null); return <article style={{ "--habit-color": habit.color } as CSSProperties} key={habit.id}><i /><div><strong data-no-translate>{habit.title}</strong><small>{completions.length} {isEnglish ? "completions" : "выполнений"}{qualities.length ? ` · ${isEnglish ? "quality" : "качество"} ${(qualities.reduce((sum, entry) => sum + (entry.qualityValue ?? 0), 0) / qualities.length).toFixed(1)}` : ""}</small></div><span>{habitStreak(workspace, habit, date, calendarMode)} {isEnglish ? "days" : "дней"}</span></article>; })}</div> : null}
      {workspace.addictionTrackers.length ? <div className="habit-ranking-list"><header><span className="eyebrow">{isEnglish ? "Abstinence" : "Воздержание"}</span><h3>{isEnglish ? "Current clean streaks" : "Текущие чистые серии"}</h3></header>{workspace.addictionTrackers.map((tracker) => <article style={{ "--habit-color": "#8f6951" } as CSSProperties} key={tracker.id}><i /><div><strong data-no-translate>{tracker.trackedBehavior}</strong><small>{isEnglish ? "Relapse never removes earned points" : "Срыв не отнимает заработанные баллы"}</small></div><span>{addictionStreak(workspace.addictionEntries, tracker.id, date)} {isEnglish ? "days" : "дней"}</span></article>)}</div> : null}
      <div className="heroic-rank-road"><header><span className="eyebrow">{isEnglish ? "Path of the hero" : "Путь героя"}</span><h3>{isEnglish ? "Rank milestones" : "Ступени рангов"}</h3></header><div>{HEROIC_RANKS.map((item) => <article className={total >= item.threshold ? "reached" : ""} style={{ "--rank-color": item.color } as CSSProperties} key={item.id}><span aria-hidden="true">{item.symbol}</span><strong>{isEnglish ? item.titleEn : item.title}</strong><small>{item.threshold} {isEnglish ? "pts" : "баллов"}</small></article>)}</div></div>
    </section>
  );
}

export function HabitTrackerPage({ workspace, date, language, timeFormat, calendarMode, googleTasksReady, onChange, onReminderRequested, onReminderRemoved }: HabitTrackerPageProps) {
  const isEnglish = language === "en";
  const [editingHabit, setEditingHabit] = useState<Habit | null>(workspace.habits.length ? null : defaultHabit(date, calendarMode));
  const [editingSleep, setEditingSleep] = useState<SleepPlan | null>(null);
  const [editingAddiction, setEditingAddiction] = useState<AddictionTracker | null>(null);
  const [message, setMessage] = useState("");
  const range = reportDateRange(workspace.habitSettings, date);
  const total = calculateHabitTotal(workspace);
  const rank = heroicRank(total);

  const saveHabit = (habit: Habit) => {
    const previous = workspace.habits.find((item) => item.id === habit.id);
    const exists = Boolean(previous);
    const nextWorkspace = { ...workspace, habits: exists ? workspace.habits.map((item) => item.id === habit.id ? habit : item) : [...workspace.habits, habit] };
    onChange(nextWorkspace);
    setEditingHabit(null);
    setMessage(isEnglish ? "Habit saved in the encrypted core." : "Привычка сохранена в зашифрованном ядре.");
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
    if (!window.confirm(isEnglish ? `Delete “${habit.title}” and its completions?` : `Удалить «${habit.title}» и все отметки?`)) return;
    onChange({ ...workspace, habits: workspace.habits.filter((item) => item.id !== habit.id), habitCompletions: workspace.habitCompletions.filter((entry) => entry.habitId !== habit.id) });
    if ((habit.reminder.googleTaskId || habit.reminder.googleEventId) && onReminderRemoved) void onReminderRemoved(habit).catch((error: Error) => setMessage(error.message));
  };

  return (
    <div className="habits-view">
      <header className="habits-hero">
        <div><span className="eyebrow">{isEnglish ? "Encrypted personal tracker" : "Зашифрованный личный трекер"}</span><h1>{isEnglish ? "Trackers" : "Привычки"}</h1><p>{isEnglish ? "Habits, sleep, mood and abstinence are independent modules over one secure tracker core." : "Привычки, сон, настроение и воздержание — независимые модули поверх единого защищённого ядра."}</p></div>
        <div className="habits-hero-score" style={{ "--rank-color": rank.color } as CSSProperties}><span aria-hidden="true">{rank.symbol}</span><div><small>{isEnglish ? "Current rank" : "Текущий ранг"}</small><strong>{isEnglish ? rank.titleEn : rank.title}</strong><em>{total} {isEnglish ? "pts" : "баллов"}</em></div></div>
        <button type="button" className="primary-button" onClick={() => setEditingHabit(defaultHabit(date, calendarMode))}>＋ {isEnglish ? "New habit" : "Новая привычка"}</button>
      </header>
      <section className="habit-range-toolbar"><span>{isEnglish ? "Analytics period" : "Период аналитики"}</span><div>{(["week", "days-30", "month", "quarter", "year", "custom"] as const).map((period) => <button type="button" className={workspace.habitSettings.reportRange === period ? "active" : ""} onClick={() => onChange({ ...workspace, habitSettings: { ...workspace.habitSettings, reportRange: period } })} key={period}>{period === "week" ? (isEnglish ? "7 days" : "7 дней") : period === "days-30" ? (isEnglish ? "30 days" : "30 дней") : period === "month" ? (isEnglish ? "Month" : "Месяц") : period === "quarter" ? (isEnglish ? "Quarter" : "Квартал") : period === "year" ? (isEnglish ? "Year" : "Год") : (isEnglish ? "Custom" : "Свой")}</button>)}</div>{workspace.habitSettings.reportRange === "custom" ? <label><input type="date" value={workspace.habitSettings.customRangeStart} onChange={(event) => onChange({ ...workspace, habitSettings: { ...workspace.habitSettings, customRangeStart: event.target.value } })} /><span>—</span><input type="date" value={workspace.habitSettings.customRangeEnd} onChange={(event) => onChange({ ...workspace, habitSettings: { ...workspace.habitSettings, customRangeEnd: event.target.value } })} /></label> : <small>{range.start} — {range.end}</small>}</section>
      {message ? <p className="habit-status-message" role="status">{message}</p> : null}
      <HabitDailyPanel workspace={workspace} date={date} language={language} timeFormat={timeFormat} calendarMode={calendarMode} onChange={onChange} />

      <section className="habit-library"><header><div><span className="eyebrow">{isEnglish ? "Habit core" : "Ядро привычек"}</span><h2>{isEnglish ? "Habits" : "Обычные привычки"}</h2></div><button type="button" onClick={() => setEditingHabit(defaultHabit(date, calendarMode))}>＋ {isEnglish ? "Add" : "Добавить"}</button></header>{workspace.habits.length ? <div>{workspace.habits.map((habit) => <article className={!habit.active ? "paused" : ""} style={{ "--habit-color": habit.color } as CSSProperties} key={habit.id}><i /><div><span><strong data-no-translate>{habit.title}</strong><em>{habit.scoringMode === "none" ? (isEnglish ? "Observation" : "Наблюдение") : (isEnglish ? "Habit" : "Привычка")}</em></span><small>{scoringFormula(habit.scoringMode, isEnglish)}</small></div><output>{habit.scoringMode === "none" ? "—" : "10"}</output><button type="button" onClick={() => onChange({ ...workspace, habits: workspace.habits.map((item) => item.id === habit.id ? markTrackerEntityChanged({ ...item, active: !item.active }) : item) })}>{habit.active ? (isEnglish ? "Pause" : "Пауза") : (isEnglish ? "Resume" : "Включить")}</button><button type="button" onClick={() => setEditingHabit(habit)}>{isEnglish ? "Edit" : "Изменить"}</button><button type="button" className="danger" onClick={() => removeHabit(habit)}>{isEnglish ? "Delete" : "Удалить"}</button></article>)}</div> : <div className="habit-library-empty"><p>{isEnglish ? "No regular habits yet." : "Обычных привычек пока нет."}</p><button type="button" className="primary-button" onClick={() => setEditingHabit(defaultHabit(date, calendarMode))}>{isEnglish ? "Create first habit" : "Создать первую привычку"}</button></div>}</section>

      <div className="tracker-module-grid">
        <section className="tracker-module-card sleep-module"><header><div><span className="eyebrow">{isEnglish ? "Independent module" : "Независимый модуль"}</span><h2>{isEnglish ? "Sleep" : "Сон"}</h2></div><button type="button" onClick={() => setEditingSleep(defaultSleepPlan(date, calendarMode))}>＋ {isEnglish ? "Plan" : "План"}</button></header>{workspace.sleepPlans.length ? workspace.sleepPlans.map((plan) => <article key={plan.id}><div><strong data-no-translate>{plan.title}</strong><small>{plan.targetBedtime} → {plan.targetWakeTime} · {plan.schedule.timezone}</small></div><button type="button" onClick={() => setEditingSleep(plan)}>{isEnglish ? "Edit" : "Изменить"}</button><button type="button" className="danger" onClick={() => onChange({ ...workspace, sleepPlans: workspace.sleepPlans.filter((item) => item.id !== plan.id), sleepEntries: workspace.sleepEntries.filter((entry) => entry.planId !== plan.id) })}>{isEnglish ? "Delete" : "Удалить"}</button></article>) : <p>{isEnglish ? "Track bedtime, wake time, duration and quality across midnight and DST." : "Отслеживайте сон, пробуждение, длительность и качество с учётом полуночи и DST."}</p>}</section>
        <section className="tracker-module-card addiction-module"><header><div><span className="eyebrow">{isEnglish ? "Independent module" : "Независимый модуль"}</span><h2>{isEnglish ? "Abstinence" : "Воздержание"}</h2></div><button type="button" onClick={() => setEditingAddiction(defaultAddictionTracker(date, calendarMode))}>＋ {isEnglish ? "Tracker" : "Трекер"}</button></header>{workspace.addictionTrackers.length ? workspace.addictionTrackers.map((tracker) => <article key={tracker.id}><div><strong data-no-translate>{tracker.trackedBehavior}</strong><small>{isEnglish ? `Clean day +${tracker.cleanDayPoints} · relapse -${tracker.relapsePenalty}` : `Чистый день +${tracker.cleanDayPoints} · срыв -${tracker.relapsePenalty}`}</small></div><button type="button" onClick={() => setEditingAddiction(tracker)}>{isEnglish ? "Edit" : "Изменить"}</button><button type="button" className="danger" onClick={() => onChange({ ...workspace, addictionTrackers: workspace.addictionTrackers.filter((item) => item.id !== tracker.id), addictionEntries: workspace.addictionEntries.filter((entry) => entry.trackerId !== tracker.id) })}>{isEnglish ? "Delete" : "Удалить"}</button></article>) : <p>{isEnglish ? "Clean days, relapses, craving and triggers stay separate from habit completions." : "Чистые дни, срывы, тяга и триггеры хранятся отдельно от выполнений привычек."}</p>}</section>
      </div>

      <HabitStatistics workspace={workspace} date={date} language={language} calendarMode={calendarMode} />
      {editingHabit ? <HabitEditor habit={editingHabit} language={language} calendarMode={calendarMode} googleTasksReady={googleTasksReady} onSave={saveHabit} onClose={() => setEditingHabit(null)} /> : null}
      {editingSleep ? <SleepEditor plan={editingSleep} language={language} calendarMode={calendarMode} onSave={(plan) => { onChange({ ...workspace, sleepPlans: workspace.sleepPlans.some((item) => item.id === plan.id) ? workspace.sleepPlans.map((item) => item.id === plan.id ? plan : item) : [...workspace.sleepPlans, plan] }); setEditingSleep(null); }} onClose={() => setEditingSleep(null)} /> : null}
      {editingAddiction ? <AddictionEditor tracker={editingAddiction} language={language} calendarMode={calendarMode} onSave={(tracker) => { onChange({ ...workspace, addictionTrackers: workspace.addictionTrackers.some((item) => item.id === tracker.id) ? workspace.addictionTrackers.map((item) => item.id === tracker.id ? tracker : item) : [...workspace.addictionTrackers, tracker] }); setEditingAddiction(null); }} onClose={() => setEditingAddiction(null)} /> : null}
    </div>
  );
}
