"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import type { CalendarMode } from "./calendar-data";
import { formatTimeValue, type TimeFormat } from "./time-format";
import {
  HABIT_COLORS,
  HEROIC_RANKS,
  MOOD_OPTIONS,
  addHabitDays,
  calculateHabitTotal,
  dateValuesBetween,
  habitDateKey,
  habitRangeEnd,
  habitScore,
  heroicRank,
  isHabitScheduledForDate,
  nextHeroicRank,
  reportDateRange,
  scheduleCycleLabels,
  type Habit,
  type HabitEntry,
  type HabitKind,
  type HabitQualityScale,
  type HabitRangePreset,
  type HabitTimeRule,
  type HabitWorkspace,
  type MoodEntry,
} from "./habits";
import type { Language } from "./i18n";

type DailyPanelProps = {
  workspace: HabitWorkspace;
  date: string;
  language: Language;
  timeFormat: TimeFormat;
  onChange: (workspace: HabitWorkspace) => void;
  onOpenHabits?: () => void;
  compact?: boolean;
};

type HabitTrackerPageProps = DailyPanelProps & {
  calendarMode: CalendarMode;
  googleTasksReady: boolean;
  onReminderRequested?: (habit: Habit) => Promise<string>;
  onReminderRemoved?: (taskId: string) => Promise<void>;
};

function createId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultHabit(date: string, calendarMode: CalendarMode): Habit {
  const now = new Date().toISOString();
  return {
    id: createId("habit"),
    title: "",
    description: "",
    kind: "positive",
    color: HABIT_COLORS[0],
    active: true,
    scoringEnabled: true,
    completionPoints: 10,
    failurePoints: -10,
    negativePoints: -10,
    qualityScale: "none",
    schedule: {
      calendarMode,
      cadence: "daily",
      interval: 1,
      days: [],
      startDate: date,
      endDate: null,
      rangePreset: "forever",
    },
    reminder: { enabled: false, time: "09:00", syncToGoogle: false, googleTaskId: null },
    timeRules: [],
    createdAt: now,
    updatedAt: now,
  };
}

function entryFor(workspace: HabitWorkspace, habitId: string, date: string) {
  return workspace.habitEntries.find((entry) => entry.habitId === habitId && entry.date === date);
}

function replaceEntry(workspace: HabitWorkspace, habit: Habit, date: string, patch: Partial<HabitEntry>) {
  const current = entryFor(workspace, habit.id, date);
  const entry: HabitEntry = {
    id: current?.id ?? createId("habit-entry"),
    habitId: habit.id,
    date,
    completed: current?.completed ?? false,
    quality: current?.quality ?? null,
    time: current?.time ?? "",
    note: current?.note ?? "",
    updatedAt: new Date().toISOString(),
    ...patch,
  };
  return {
    ...workspace,
    habitEntries: [...workspace.habitEntries.filter((item) => !(item.habitId === habit.id && item.date === date)), entry],
  };
}

function qualityLabel(scale: HabitQualityScale, quality: number | null, isEnglish: boolean) {
  if (quality === null) return "—";
  if (scale === "bipolar") return quality > 0 ? `+${quality}` : String(quality);
  if (quality <= 3) return isEnglish ? `${quality} · difficult` : `${quality} · тяжело`;
  if (quality <= 7) return isEnglish ? `${quality} · good` : `${quality} · хорошо`;
  return isEnglish ? `${quality} · excellent` : `${quality} · отлично`;
}

function kindLabel(kind: HabitKind, isEnglish: boolean) {
  const labels = {
    positive: isEnglish ? "Positive habit" : "Положительная привычка",
    negative: isEnglish ? "Negative habit" : "Негативная привычка",
    monitor: isEnglish ? "Observation only" : "Только наблюдение",
    sleep: isEnglish ? "Bedtime" : "Отход ко сну",
    wake: isEnglish ? "Wake-up time" : "Пробуждение",
  };
  return labels[kind];
}

export function HabitDailyPanel({ workspace, date, language, timeFormat, onChange, onOpenHabits, compact = false }: DailyPanelProps) {
  const isEnglish = language === "en";
  const dueHabits = workspace.habits.filter((habit) => isHabitScheduledForDate(habit, date));
  const completed = dueHabits.filter((habit) => entryFor(workspace, habit.id, date)?.completed).length;
  const dayPoints = dueHabits.reduce((sum, habit) => sum + habitScore(habit, entryFor(workspace, habit.id, date), date), 0);
  const mood = workspace.moodEntries.find((entry) => entry.date === date);
  const selectedMood = MOOD_OPTIONS.find((option) => option.id === mood?.moodId);
  const moodLabel = selectedMood ? (isEnglish ? selectedMood.labelEn : selectedMood.label) : mood?.label;

  const toggleHabit = (habit: Habit) => {
    const current = entryFor(workspace, habit.id, date);
    onChange(replaceEntry(workspace, habit, date, {
      completed: !current?.completed,
      quality: !current?.completed && habit.qualityScale !== "none"
        ? current?.quality ?? (habit.qualityScale === "ten" ? 5 : 0)
        : current?.quality ?? null,
    }));
  };

  const setMood = (option: (typeof MOOD_OPTIONS)[number]) => {
    const next: MoodEntry = {
      date,
      moodId: option.id,
      label: option.label,
      color: option.color,
      custom: mood?.custom ?? "",
      updatedAt: new Date().toISOString(),
    };
    onChange({ ...workspace, moodEntries: [...workspace.moodEntries.filter((entry) => entry.date !== date), next] });
  };

  const setCustomMood = (custom: string) => {
    const next: MoodEntry = {
      date,
      moodId: mood?.moodId ?? "custom",
      label: mood?.label ?? (isEnglish ? "My mood" : "Моё настроение"),
      color: mood?.color ?? "#8a918d",
      custom,
      updatedAt: new Date().toISOString(),
    };
    onChange({ ...workspace, moodEntries: [...workspace.moodEntries.filter((entry) => entry.date !== date), next] });
  };

  return (
    <section className={`habit-daily-panel${compact ? " compact" : ""}`} aria-labelledby={`habit-daily-title-${date}`}>
      <header>
        <div>
          <span className="eyebrow">{isEnglish ? "Daily rhythm" : "Ежедневный ритм"}</span>
          <h2 id={`habit-daily-title-${date}`}>{isEnglish ? "Habits" : "Привычки"}</h2>
        </div>
        {dueHabits.length ? (
          <div className="habit-day-progress" aria-label={isEnglish ? `${completed} of ${dueHabits.length} completed` : `Выполнено ${completed} из ${dueHabits.length}`}>
            <strong>{completed}/{dueHabits.length}</strong>
            <span><i style={{ width: `${dueHabits.length ? Math.round(completed / dueHabits.length * 100) : 0}%` }} /></span>
            <small>{dayPoints > 0 ? "+" : ""}{dayPoints} {isEnglish ? "pts" : "баллов"}</small>
          </div>
        ) : null}
      </header>

      {!workspace.habits.length ? (
        <div className="habit-empty-state">
          <span aria-hidden="true">✦</span>
          <div>
            <h3>{isEnglish ? "Create your first habit" : "Создайте первую привычку"}</h3>
            <p>{isEnglish ? "Choose a rhythm, scoring and an optional reminder. Your data will stay in the encrypted workspace." : "Выберите ритм, баллы и необязательное напоминание. Данные останутся в зашифрованном пространстве."}</p>
          </div>
          {onOpenHabits ? <button type="button" className="primary-button" onClick={onOpenHabits}>{isEnglish ? "Create habit" : "Создать привычку"}</button> : null}
        </div>
      ) : dueHabits.length ? (
        <div className="habit-check-list">
          {dueHabits.map((habit) => {
            const entry = entryFor(workspace, habit.id, date);
            const score = habitScore(habit, entry, date);
            const isTimeHabit = habit.kind === "sleep" || habit.kind === "wake";
            return (
              <article className={`${entry?.completed ? "done" : ""} kind-${habit.kind}`} style={{ "--habit-color": habit.color } as CSSProperties} key={habit.id}>
                <button type="button" className="habit-check" onClick={() => toggleHabit(habit)} aria-pressed={Boolean(entry?.completed)} aria-label={entry?.completed ? (isEnglish ? `Unmark ${habit.title}` : `Снять отметку «${habit.title}»`) : (isEnglish ? `Mark ${habit.title}` : `Отметить «${habit.title}»`)}>
                  {entry?.completed ? (habit.kind === "negative" ? "!" : "✓") : ""}
                </button>
                <div className="habit-check-copy">
                  <span><strong data-no-translate>{habit.title}</strong><em>{kindLabel(habit.kind, isEnglish)}</em></span>
                  {habit.description ? <small data-no-translate>{habit.description}</small> : null}
                </div>
                {isTimeHabit ? (
                  <label className="habit-time-entry">
                    <span>{habit.kind === "sleep" ? (isEnglish ? "Bedtime" : "Лёг(ла)") : (isEnglish ? "Woke up" : "Проснулся(ась)")}</span>
                    <input type="time" value={entry?.time ?? ""} onChange={(event) => onChange(replaceEntry(workspace, habit, date, { completed: true, time: event.target.value }))} />
                    {entry?.time ? <small>{formatTimeValue(entry.time, timeFormat)}</small> : null}
                  </label>
                ) : null}
                {entry?.completed && habit.qualityScale !== "none" ? (
                  <label className={`habit-quality-slider scale-${habit.qualityScale}`}>
                    <span>{isEnglish ? "Quality" : "Качество"} <strong>{qualityLabel(habit.qualityScale, entry.quality, isEnglish)}</strong></span>
                    <input
                      type="range"
                      min={habit.qualityScale === "ten" ? 1 : -5}
                      max={habit.qualityScale === "ten" ? 10 : 5}
                      step="1"
                      value={entry.quality ?? (habit.qualityScale === "ten" ? 5 : 0)}
                      onChange={(event) => onChange(replaceEntry(workspace, habit, date, { completed: true, quality: Number(event.target.value) }))}
                    />
                    <div><span>{habit.qualityScale === "ten" ? "1" : "−5"}</span>{habit.qualityScale === "bipolar" ? <i>0</i> : null}<span>{habit.qualityScale === "ten" ? "10" : "+5"}</span></div>
                  </label>
                ) : null}
                {habit.scoringEnabled ? <output className={score < 0 ? "negative" : ""}>{score > 0 ? "+" : ""}{score}</output> : <output className="monitor">{isEnglish ? "log" : "учёт"}</output>}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="habit-rest-day">{isEnglish ? "No scheduled habits today — a planned recovery day." : "На этот день привычки не запланированы — время для осознанного отдыха."}</p>
      )}

      <details className="mood-tracker" open={!compact ? true : undefined}>
        <summary>
          <span>{isEnglish ? "Mood of the day" : "Настроение дня"}</span>
          <strong style={{ color: mood?.color }}>{mood ? `${moodLabel}${mood.custom ? ` · ${mood.custom}` : ""}` : (isEnglish ? "Not selected" : "Не выбрано")}</strong>
        </summary>
        <div className="mood-options" role="listbox" aria-label={isEnglish ? "Choose mood" : "Выберите настроение"}>
          {MOOD_OPTIONS.map((option) => (
            <button type="button" role="option" aria-selected={mood?.moodId === option.id} className={mood?.moodId === option.id ? "selected" : ""} style={{ "--mood-color": option.color } as CSSProperties} onClick={() => setMood(option)} title={isEnglish ? option.labelEn : option.label} key={option.id}>
              <span aria-hidden="true">{option.symbol}</span><small>{isEnglish ? option.labelEn : option.label}</small>
            </button>
          ))}
        </div>
        <label className="mood-custom"><span>{isEnglish ? "In my own words" : "Своими словами"}</span><input value={mood?.custom ?? ""} maxLength={100} placeholder={isEnglish ? "How do you really feel?" : "Как вы себя чувствуете на самом деле?"} onChange={(event) => setCustomMood(event.target.value)} /></label>
      </details>
    </section>
  );
}

function HabitEditor({ initial, language, googleTasksReady, onCancel, onSave }: {
  initial: Habit;
  language: Language;
  googleTasksReady: boolean;
  onCancel: () => void;
  onSave: (habit: Habit) => void;
}) {
  const isEnglish = language === "en";
  const [draft, setDraft] = useState(initial);
  const [customEnd, setCustomEnd] = useState(initial.schedule.endDate ?? "");
  const cycleLabels = scheduleCycleLabels(draft.schedule.calendarMode);
  const patchSchedule = (patch: Partial<Habit["schedule"]>) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, ...patch } }));

  const changeRange = (rangePreset: HabitRangePreset) => {
    patchSchedule({ rangePreset, endDate: habitRangeEnd(draft.schedule.startDate, rangePreset, customEnd) });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const now = new Date().toISOString();
    onSave({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      scoringEnabled: draft.kind === "monitor" ? false : draft.scoringEnabled,
      schedule: {
        ...draft.schedule,
        interval: Math.max(1, Math.min(99, Math.round(draft.schedule.interval || 1))),
        endDate: habitRangeEnd(draft.schedule.startDate, draft.schedule.rangePreset, customEnd),
      },
      updatedAt: now,
    });
  };

  const addTimeRule = () => {
    const positive = !draft.timeRules.some((rule) => rule.points > 0);
    const rule: HabitTimeRule = { id: createId("time-rule"), operator: positive ? "before" : "after", threshold: draft.kind === "sleep" ? "23:00" : "08:00", points: positive ? 10 : -10 };
    setDraft((current) => ({ ...current, timeRules: [...current.timeRules, rule] }));
  };

  return (
    <form className="habit-editor" onSubmit={submit}>
      <header>
        <div><span className="eyebrow">{isEnglish ? "Habit constructor" : "Конструктор привычки"}</span><h2>{initial.title ? (isEnglish ? "Edit habit" : "Изменить привычку") : (isEnglish ? "New habit" : "Новая привычка")}</h2></div>
        <button type="button" className="modal-close" onClick={onCancel} aria-label={isEnglish ? "Close editor" : "Закрыть редактор"}>×</button>
      </header>

      <div className="habit-editor-grid">
        <label className="wide"><span>{isEnglish ? "Name" : "Название привычки"}</span><input value={draft.title} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={isEnglish ? "For example: 20 minutes of reading" : "Например: читать 20 минут"} required /></label>
        <label className="wide"><span>{isEnglish ? "Description" : "Описание"}</span><textarea value={draft.description} maxLength={1200} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder={isEnglish ? "Why this matters and what counts as completion" : "Зачем это нужно и что считать выполнением"} /></label>
        <label><span>{isEnglish ? "Type" : "Тип привычки"}</span><select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as HabitKind, scoringEnabled: event.target.value === "monitor" ? false : current.scoringEnabled }))}>
          <option value="positive">{isEnglish ? "Positive" : "Положительная"}</option><option value="negative">{isEnglish ? "Negative / dependency" : "Негативная / зависимость"}</option><option value="monitor">{isEnglish ? "Observation without points" : "Наблюдение без баллов"}</option><option value="sleep">{isEnglish ? "Bedtime" : "Отход ко сну"}</option><option value="wake">{isEnglish ? "Wake-up time" : "Пробуждение"}</option>
        </select></label>
        <fieldset className="habit-color-field"><legend>{isEnglish ? "Color" : "Цвет"}</legend><div>{HABIT_COLORS.map((color) => <button type="button" className={draft.color === color ? "selected" : ""} style={{ backgroundColor: color }} onClick={() => setDraft((current) => ({ ...current, color }))} aria-label={`${isEnglish ? "Color" : "Цвет"} ${color}`} key={color} />)}</div></fieldset>
      </div>

      <fieldset className="habit-editor-section schedule-section">
        <legend><span>01</span>{isEnglish ? "Rhythm and calendar" : "Ритм и календарь"}</legend>
        <div className="habit-editor-grid">
          <label><span>{isEnglish ? "Calendar" : "Система календаря"}</span><select value={draft.schedule.calendarMode} onChange={(event) => patchSchedule({ calendarMode: event.target.value as CalendarMode, days: [] })}><option value="sacred">{isEnglish ? "Sacred" : "Сакральный"}</option><option value="lunar">{isEnglish ? "Lunar" : "Лунный"}</option><option value="profane">{isEnglish ? "Gregorian" : "Григорианский"}</option></select></label>
          <label><span>{isEnglish ? "Repeat" : "Повторять"}</span><select value={draft.schedule.cadence} onChange={(event) => patchSchedule({ cadence: event.target.value as Habit["schedule"]["cadence"], days: [] })}><option value="daily">{isEnglish ? "Every N days" : "Каждые N дней"}</option><option value="weekly">{isEnglish ? "On selected cycle days" : "По выбранным дням цикла"}</option><option value="monthly">{isEnglish ? "On selected month days" : "По дням месяца"}</option><option value="yearly">{isEnglish ? "Every N years" : "Каждые N лет"}</option></select></label>
          <label><span>{isEnglish ? "Interval" : "Интервал"}</span><input type="number" min="1" max="99" value={draft.schedule.interval} onChange={(event) => patchSchedule({ interval: Number(event.target.value) })} /></label>
          <label><span>{isEnglish ? "Start" : "Начало"}</span><input type="date" value={draft.schedule.startDate} onChange={(event) => patchSchedule({ startDate: event.target.value })} required /></label>
          <label><span>{isEnglish ? "Duration" : "Период отслеживания"}</span><select value={draft.schedule.rangePreset} onChange={(event) => changeRange(event.target.value as HabitRangePreset)}><option value="week">{isEnglish ? "1 week" : "1 неделя"}</option><option value="month">{isEnglish ? "1 month" : "1 месяц"}</option><option value="half-year">{isEnglish ? "6 months" : "Полгода"}</option><option value="year">{isEnglish ? "1 year" : "1 год"}</option><option value="custom">{isEnglish ? "Custom end" : "Своя дата"}</option><option value="forever">{isEnglish ? "Forever" : "Всегда"}</option></select></label>
          {draft.schedule.rangePreset === "custom" ? <label><span>{isEnglish ? "End" : "Окончание"}</span><input type="date" min={draft.schedule.startDate} value={customEnd} onChange={(event) => { setCustomEnd(event.target.value); patchSchedule({ endDate: event.target.value }); }} required /></label> : null}
        </div>
        {draft.schedule.cadence === "weekly" ? <div className="habit-cycle-days"><strong>{isEnglish ? "Cycle days" : "Дни цикла"}</strong>{cycleLabels.map((label, index) => <label key={label}><input type="checkbox" checked={draft.schedule.days.includes(index)} onChange={(event) => patchSchedule({ days: event.target.checked ? [...draft.schedule.days, index].sort((a, b) => a - b) : draft.schedule.days.filter((day) => day !== index) })} /><span>{label}</span></label>)}</div> : null}
        {draft.schedule.cadence === "monthly" ? <label className="habit-month-days"><span>{isEnglish ? "Month days, comma-separated" : "Дни месяца через запятую"}</span><input value={draft.schedule.days.join(", ")} onChange={(event) => patchSchedule({ days: Array.from(new Set(event.target.value.split(/[,\s]+/).map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))) })} placeholder="1, 10, 21" /></label> : null}
      </fieldset>

      <fieldset className="habit-editor-section scoring-section">
        <legend><span>02</span>{isEnglish ? "Quality and points" : "Качество и баллы"}</legend>
        <label className="habit-switch"><span><strong>{isEnglish ? "Count points" : "Учитывать баллы"}</strong><small>{isEnglish ? "Turn off for a simple observation log" : "Отключите для простого журнала наблюдений"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Count habit points" : "Учитывать баллы привычки"} disabled={draft.kind === "monitor"} checked={draft.scoringEnabled && draft.kind !== "monitor"} onChange={(event) => setDraft((current) => ({ ...current, scoringEnabled: event.target.checked }))} /><i /></label>
        {draft.kind !== "negative" && draft.kind !== "monitor" && draft.kind !== "sleep" && draft.kind !== "wake" ? <div className="habit-editor-grid"><label><span>{isEnglish ? "Quality scale" : "Шкала качества"}</span><select value={draft.qualityScale} onChange={(event) => setDraft((current) => ({ ...current, qualityScale: event.target.value as HabitQualityScale }))}><option value="none">{isEnglish ? "No scale" : "Без оценки"}</option><option value="ten">{isEnglish ? "1 to 10" : "От 1 до 10"}</option><option value="bipolar">{isEnglish ? "−5 to +5" : "От −5 до +5"}</option></select></label><label><span>{isEnglish ? "Missed day" : "За невыполнение"}</span><input type="number" max="0" value={draft.failurePoints} onChange={(event) => setDraft((current) => ({ ...current, failurePoints: Number(event.target.value) }))} /></label>{draft.qualityScale === "none" ? <label><span>{isEnglish ? "Completed" : "За выполнение"}</span><input type="number" min="0" value={draft.completionPoints} onChange={(event) => setDraft((current) => ({ ...current, completionPoints: Number(event.target.value) }))} /></label> : null}</div> : null}
        {draft.kind === "negative" ? <label className="habit-penalty"><span>{isEnglish ? "Penalty when marked" : "Списание при отметке"}</span><input type="number" max="0" value={draft.negativePoints} onChange={(event) => setDraft((current) => ({ ...current, negativePoints: Number(event.target.value) }))} /><small>{isEnglish ? "For example, −10 for a cigarette" : "Например, −10 за сигарету"}</small></label> : null}
        {(draft.kind === "sleep" || draft.kind === "wake") ? <div className="habit-time-rules"><header><div><strong>{isEnglish ? "Time conditions" : "Условия по времени"}</strong><small>{isEnglish ? "Add positive and negative rules" : "Добавьте положительные и отрицательные условия"}</small></div><button type="button" onClick={addTimeRule}>＋ {isEnglish ? "Condition" : "Условие"}</button></header>{draft.timeRules.map((rule) => <div key={rule.id}><select value={rule.operator} onChange={(event) => setDraft((current) => ({ ...current, timeRules: current.timeRules.map((item) => item.id === rule.id ? { ...item, operator: event.target.value as HabitTimeRule["operator"] } : item) }))}><option value="before">{isEnglish ? "At or before" : "Не позже"}</option><option value="after">{isEnglish ? "After" : "Позже"}</option></select><input type="time" value={rule.threshold} onChange={(event) => setDraft((current) => ({ ...current, timeRules: current.timeRules.map((item) => item.id === rule.id ? { ...item, threshold: event.target.value } : item) }))} /><input type="number" value={rule.points} aria-label={isEnglish ? "Points" : "Баллы"} onChange={(event) => setDraft((current) => ({ ...current, timeRules: current.timeRules.map((item) => item.id === rule.id ? { ...item, points: Number(event.target.value) } : item) }))} /><button type="button" onClick={() => setDraft((current) => ({ ...current, timeRules: current.timeRules.filter((item) => item.id !== rule.id) }))} aria-label={isEnglish ? "Remove condition" : "Удалить условие"}>×</button></div>)}</div> : null}
      </fieldset>

      <fieldset className="habit-editor-section reminder-section">
        <legend><span>03</span>{isEnglish ? "Reminder" : "Напоминание"}</legend>
        <label className="habit-switch"><span><strong>{isEnglish ? "Remind me" : "Напоминать о привычке"}</strong><small>{isEnglish ? "A reusable Google Task keeps the calendar clean" : "Повторяющаяся Google-задача не засоряет календарь"}</small></span><input type="checkbox" role="switch" aria-label={isEnglish ? "Enable habit reminder" : "Включить напоминание о привычке"} checked={draft.reminder.enabled} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, enabled: event.target.checked } }))} /><i /></label>
        {draft.reminder.enabled ? <div className="habit-editor-grid"><label><span>{isEnglish ? "Time" : "Время"}</span><input type="time" value={draft.reminder.time} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, time: event.target.value } }))} /></label><label className="habit-google-check"><input type="checkbox" aria-label={isEnglish ? "Sync reminder to Google Tasks" : "Синхронизировать напоминание с Google Tasks"} checked={draft.reminder.syncToGoogle} disabled={!googleTasksReady} onChange={(event) => setDraft((current) => ({ ...current, reminder: { ...current.reminder, syncToGoogle: event.target.checked } }))} /><span><strong>Google Tasks</strong><small>{googleTasksReady ? (isEnglish ? "Sync after saving" : "Синхронизировать после сохранения") : (isEnglish ? "Connect Google Tasks in your account" : "Подключите Google Tasks в аккаунте")}</small></span></label></div> : null}
      </fieldset>

      <footer><button type="button" className="text-button" onClick={onCancel}>{isEnglish ? "Cancel" : "Отмена"}</button><button type="submit" className="primary-button" disabled={!draft.title.trim()}>{isEnglish ? "Save habit" : "Сохранить привычку"}</button></footer>
    </form>
  );
}

function HabitStatistics({ workspace, language }: { workspace: HabitWorkspace; language: Language }) {
  const isEnglish = language === "en";
  const today = habitDateKey(new Date());
  const range = reportDateRange(workspace.habitSettings, today);
  const dates = dateValuesBetween(range.start, range.end);
  const daily = dates.map((date) => ({
    date,
    points: workspace.habits.reduce((sum, habit) => sum + habitScore(habit, entryFor(workspace, habit.id, date), date, today), 0),
  }));
  const scheduled = dates.reduce((sum, date) => sum + workspace.habits.filter((habit) => isHabitScheduledForDate(habit, date)).length, 0);
  const done = dates.reduce((sum, date) => sum + workspace.habits.filter((habit) => isHabitScheduledForDate(habit, date) && entryFor(workspace, habit.id, date)?.completed).length, 0);
  const rate = scheduled ? Math.round(done / scheduled * 100) : 0;
  const maxAbs = Math.max(10, ...daily.map((item) => Math.abs(item.points)));
  const chartPoints = daily.map((item, index) => `${daily.length <= 1 ? 0 : index / (daily.length - 1) * 100},${50 - item.points / maxAbs * 42}`).join(" ");
  const total = calculateHabitTotal(workspace, today);
  const currentRank = heroicRank(total);
  const nextRank = nextHeroicRank(total);
  const rankProgress = nextRank ? Math.max(0, Math.min(100, Math.round((total - currentRank.threshold) / (nextRank.threshold - currentRank.threshold) * 100))) : 100;

  const streakFor = (habit: Habit) => {
    let streak = 0;
    for (let date = today; date >= habit.schedule.startDate && streak < 740; date = addHabitDays(date, -1)) {
      if (!isHabitScheduledForDate(habit, date)) continue;
      if (!entryFor(workspace, habit.id, date)?.completed) break;
      streak += 1;
    }
    return streak;
  };

  return (
    <section className="habit-statistics" aria-labelledby="habit-statistics-title">
      <header className="habit-stats-heading"><div><span className="eyebrow">{isEnglish ? "Analytics" : "Аналитика"}</span><h2 id="habit-statistics-title">{isEnglish ? "Progress and motivation" : "Прогресс и мотивация"}</h2></div><label><span>{isEnglish ? "Period" : "Период"}</span><select value={workspace.habitSettings.reportRange} onChange={() => undefined} disabled><option>{isEnglish ? "Selected above" : "Выбран выше"}</option></select></label></header>

      <article className="heroic-rank-card" style={{ "--rank-color": currentRank.color } as CSSProperties}>
        <div className="heroic-rank-art" />
        <div className="heroic-rank-copy"><span>{isEnglish ? "Heroic rank" : "Героический ранг"}</span><h3>{isEnglish ? currentRank.titleEn : currentRank.title}</h3><p>{total} {isEnglish ? "total points" : "баллов за всё время"}</p>{nextRank ? <><div><i style={{ width: `${rankProgress}%` }} /></div><small>{isEnglish ? `${nextRank.threshold - total} points to ${nextRank.titleEn}` : `${nextRank.threshold - total} баллов до ранга «${nextRank.title}»`}</small></> : <small>{isEnglish ? "The highest rank has been reached" : "Высший ранг достигнут"}</small>}</div>
        <span className="heroic-rank-seal" aria-hidden="true">{currentRank.symbol}</span>
      </article>

      <div className="habit-stat-cards"><article><span>{isEnglish ? "Completion" : "Выполнение"}</span><strong>{rate}%</strong><small>{done} / {scheduled}</small></article><article><span>{isEnglish ? "Period balance" : "Баланс периода"}</span><strong>{daily.reduce((sum, item) => sum + item.points, 0)}</strong><small>{range.start} — {range.end}</small></article><article><span>{isEnglish ? "Active habits" : "Активных привычек"}</span><strong>{workspace.habits.filter((habit) => habit.active).length}</strong><small>{workspace.habits.length} {isEnglish ? "total" : "всего"}</small></article><article><span>{isEnglish ? "Mood records" : "Отметок настроения"}</span><strong>{workspace.moodEntries.filter((entry) => entry.date >= range.start && entry.date <= range.end).length}</strong><small>{isEnglish ? "in selected period" : "за выбранный период"}</small></article></div>

      <div className="habit-charts-grid">
        <article className="habit-line-chart"><header><div><span className="eyebrow">{isEnglish ? "Point dynamics" : "Динамика баллов"}</span><h3>{isEnglish ? "Daily balance" : "Баланс по дням"}</h3></div><strong>{daily.reduce((sum, item) => sum + item.points, 0)}</strong></header><svg viewBox="0 0 100 100" role="img" aria-label={isEnglish ? "Daily points chart" : "График баллов по дням"} preserveAspectRatio="none"><line x1="0" x2="100" y1="50" y2="50" /><polygon points={`0,50 ${chartPoints} 100,50`} /><polyline points={chartPoints} /></svg><footer><span>{range.start}</span><span>0</span><span>{range.end}</span></footer></article>
        <article className="habit-heatmap"><header><span className="eyebrow">{isEnglish ? "Regularity" : "Регулярность"}</span><h3>{isEnglish ? "Last 35 days" : "Последние 35 дней"}</h3></header><div>{dateValuesBetween(addHabitDays(today, -34), today).map((date) => { const due = workspace.habits.filter((habit) => isHabitScheduledForDate(habit, date)); const complete = due.filter((habit) => entryFor(workspace, habit.id, date)?.completed).length; const intensity = due.length ? complete / due.length : -1; return <span className={intensity < 0 ? "rest" : ""} style={intensity >= 0 ? { opacity: .22 + intensity * .78 } : undefined} title={`${date}: ${complete}/${due.length}`} key={date} />; })}</div><footer><span>{isEnglish ? "Less" : "Меньше"}</span><i /><i /><i /><i /><span>{isEnglish ? "More" : "Больше"}</span></footer></article>
      </div>

      <div className="habit-ranking-list"><header><span className="eyebrow">{isEnglish ? "Personal records" : "Личные серии"}</span><h3>{isEnglish ? "Current streaks" : "Текущие серии"}</h3></header>{workspace.habits.filter((habit) => habit.active).sort((a, b) => streakFor(b) - streakFor(a)).map((habit) => <article style={{ "--habit-color": habit.color } as CSSProperties} key={habit.id}><i /><div><strong data-no-translate>{habit.title}</strong><small>{kindLabel(habit.kind, isEnglish)}</small></div><span>{streakFor(habit)} {isEnglish ? "days" : "дней"}</span></article>)}</div>

      <div className="heroic-rank-road"><header><span className="eyebrow">{isEnglish ? "Path of the hero" : "Путь героя"}</span><h3>{isEnglish ? "Rank milestones" : "Ступени рангов"}</h3></header><div>{HEROIC_RANKS.map((rank) => <article className={total >= rank.threshold ? "reached" : ""} style={{ "--rank-color": rank.color } as CSSProperties} key={rank.id}><span aria-hidden="true">{rank.symbol}</span><strong>{isEnglish ? rank.titleEn : rank.title}</strong><small>{rank.threshold} {isEnglish ? "pts" : "баллов"}</small></article>)}</div></div>
    </section>
  );
}

export function HabitTrackerPage({ workspace, date, language, timeFormat, calendarMode, googleTasksReady, onChange, onReminderRequested, onReminderRemoved }: HabitTrackerPageProps) {
  const isEnglish = language === "en";
  const [editing, setEditing] = useState<Habit | null>(workspace.habits.length ? null : defaultHabit(date, calendarMode));
  const [message, setMessage] = useState("");
  const range = reportDateRange(workspace.habitSettings, date);
  const total = useMemo(() => calculateHabitTotal(workspace), [workspace]);
  const rank = heroicRank(total);

  const saveHabit = (habit: Habit) => {
    const exists = workspace.habits.some((item) => item.id === habit.id);
    const nextWorkspace = { ...workspace, habits: exists ? workspace.habits.map((item) => item.id === habit.id ? habit : item) : [...workspace.habits, habit] };
    onChange(nextWorkspace);
    setEditing(null);
    setMessage(isEnglish ? "Habit saved in the encrypted workspace." : "Привычка сохранена в зашифрованном пространстве.");
    if (habit.reminder.enabled && habit.reminder.syncToGoogle && onReminderRequested) {
      void onReminderRequested(habit).then((googleTaskId) => {
        onChange({
          ...nextWorkspace,
          habits: nextWorkspace.habits.map((item) => item.id === habit.id
            ? { ...item, reminder: { ...item.reminder, googleTaskId }, updatedAt: new Date().toISOString() }
            : item),
        });
        setMessage(isEnglish ? "Habit saved and reminder synced to Google Tasks." : "Привычка сохранена, напоминание отправлено в Google Tasks.");
      }).catch((error: Error) => setMessage(error.message));
    }
  };

  const removeHabit = (habit: Habit) => {
    if (!window.confirm(isEnglish ? `Delete “${habit.title}” and all its records?` : `Удалить «${habit.title}» и все её отметки?`)) return;
    onChange({ ...workspace, habits: workspace.habits.filter((item) => item.id !== habit.id), habitEntries: workspace.habitEntries.filter((entry) => entry.habitId !== habit.id) });
    if (habit.reminder.googleTaskId && onReminderRemoved) {
      void onReminderRemoved(habit.reminder.googleTaskId).catch((error: Error) => setMessage(error.message));
    }
  };

  return (
    <div className="habits-view">
      <header className="habits-hero">
        <div><span className="eyebrow">{isEnglish ? "Encrypted personal tracker" : "Зашифрованный личный трекер"}</span><h1>{isEnglish ? "Habits" : "Привычки"}</h1><p>{isEnglish ? "Build a rhythm, observe quality, sleep, mood and progress without exposing personal data on the server." : "Создавайте ритм, наблюдайте качество, сон, настроение и прогресс — без открытых личных данных на сервере."}</p></div>
        <div className="habits-hero-score" style={{ "--rank-color": rank.color } as CSSProperties}><span aria-hidden="true">{rank.symbol}</span><div><small>{isEnglish ? "Current rank" : "Текущий ранг"}</small><strong>{isEnglish ? rank.titleEn : rank.title}</strong><em>{total} {isEnglish ? "pts" : "баллов"}</em></div></div>
        <button type="button" className="primary-button" onClick={() => setEditing(defaultHabit(date, calendarMode))}>＋ {isEnglish ? "New habit" : "Новая привычка"}</button>
      </header>

      <div className="habit-range-toolbar">
        <div><span>{isEnglish ? "Statistics period" : "Период статистики"}</span><strong>{range.start} — {range.end}</strong></div>
        <select value={workspace.habitSettings.reportRange} onChange={(event) => onChange({ ...workspace, habitSettings: { ...workspace.habitSettings, reportRange: event.target.value as HabitWorkspace["habitSettings"]["reportRange"] } })}><option value="week">{isEnglish ? "Week" : "Неделя"}</option><option value="month">{isEnglish ? "Month" : "Месяц"}</option><option value="half-year">{isEnglish ? "6 months" : "Полгода"}</option><option value="year">{isEnglish ? "Year" : "Год"}</option><option value="custom">{isEnglish ? "Custom" : "Свой период"}</option></select>
        {workspace.habitSettings.reportRange === "custom" ? <><input type="date" value={workspace.habitSettings.customRangeStart} onChange={(event) => onChange({ ...workspace, habitSettings: { ...workspace.habitSettings, customRangeStart: event.target.value } })} aria-label={isEnglish ? "Period start" : "Начало периода"} /><input type="date" value={workspace.habitSettings.customRangeEnd} onChange={(event) => onChange({ ...workspace, habitSettings: { ...workspace.habitSettings, customRangeEnd: event.target.value } })} aria-label={isEnglish ? "Period end" : "Окончание периода"} /></> : null}
      </div>

      {message ? <p className="habit-status" role="status">{message}</p> : null}
      <HabitDailyPanel workspace={workspace} date={date} language={language} timeFormat={timeFormat} onChange={onChange} />

      <section className="habit-library" aria-labelledby="habit-library-title">
        <header><div><span className="eyebrow">{isEnglish ? "Your system" : "Ваша система"}</span><h2 id="habit-library-title">{isEnglish ? "All habits" : "Все привычки"}</h2></div><span>{workspace.habits.filter((habit) => habit.active).length} {isEnglish ? "active" : "активных"}</span></header>
        {workspace.habits.length ? <div>{workspace.habits.map((habit) => <article className={!habit.active ? "paused" : ""} style={{ "--habit-color": habit.color } as CSSProperties} key={habit.id}><i /><div><span><strong data-no-translate>{habit.title}</strong><em>{kindLabel(habit.kind, isEnglish)}</em></span><small>{habit.schedule.cadence === "daily" ? (isEnglish ? `Every ${habit.schedule.interval} day(s)` : `Каждые ${habit.schedule.interval} дн.`) : habit.schedule.cadence === "weekly" ? (isEnglish ? "Selected cycle days" : "По дням цикла") : habit.schedule.cadence === "monthly" ? (isEnglish ? "Monthly rhythm" : "Месячный ритм") : (isEnglish ? "Yearly rhythm" : "Годовой ритм")}{habit.schedule.endDate ? ` · ${isEnglish ? "until" : "до"} ${habit.schedule.endDate}` : ` · ${isEnglish ? "forever" : "всегда"}`}</small></div><output>{habit.scoringEnabled ? (habit.kind === "negative" ? habit.negativePoints : habit.completionPoints) : "—"}</output><button type="button" onClick={() => onChange({ ...workspace, habits: workspace.habits.map((item) => item.id === habit.id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item) })}>{habit.active ? (isEnglish ? "Pause" : "Пауза") : (isEnglish ? "Resume" : "Включить")}</button><button type="button" onClick={() => setEditing(habit)}>{isEnglish ? "Edit" : "Изменить"}</button><button type="button" className="danger" onClick={() => removeHabit(habit)}>{isEnglish ? "Delete" : "Удалить"}</button></article>)}</div> : <div className="habit-library-empty"><p>{isEnglish ? "There are no habits yet. Start with one small action that is easy to repeat." : "Пока привычек нет. Начните с одного небольшого действия, которое легко повторить."}</p><button type="button" className="primary-button" onClick={() => setEditing(defaultHabit(date, calendarMode))}>{isEnglish ? "Create first habit" : "Создать первую привычку"}</button></div>}
      </section>

      {workspace.habits.length ? <HabitStatistics workspace={workspace} language={language} /> : null}
      {editing ? <div className="modal-backdrop habit-editor-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><HabitEditor initial={editing} language={language} googleTasksReady={googleTasksReady} onCancel={() => setEditing(null)} onSave={saveHabit} /></div> : null}
    </div>
  );
}
