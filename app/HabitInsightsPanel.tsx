"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import type { CalendarMode } from "./calendar-data";
import type { Language } from "./i18n";
import { isHabitScheduledForDate, type HabitWorkspace } from "./habits";
import {
  buildHabitPersonalRecord,
  buildHabitYearMosaic,
  buildWeeklyHabitSummary,
} from "./habit-insights";

type HabitInsightsPanelProps = {
  workspace: HabitWorkspace;
  date: string;
  language: Language;
  calendarMode: CalendarMode;
};

function rhythmLabel(score: number, isEnglish: boolean) {
  if (score >= 80) return isEnglish ? "Steady rhythm" : "Устойчивый ритм";
  if (score >= 60) return isEnglish ? "Rhythm is growing" : "Ритм укрепляется";
  if (score >= 35) return isEnglish ? "Rhythm is returning" : "Ритм возвращается";
  return isEnglish ? "Beginning the rhythm" : "Начало ритма";
}

function comparisonCopy(current: number, previous: number, change: number, isEnglish: boolean) {
  if (!previous && !current) return isEnglish ? "No completions in these two weeks yet" : "За эти две недели выполнений пока нет";
  if (!previous) return isEnglish ? "First measured week" : "Первая измеренная неделя";
  if (!change) return isEnglish ? "Same as last week" : "На уровне прошлой недели";
  const value = `${change > 0 ? "+" : ""}${change}%`;
  return isEnglish ? `${value} vs last week` : `${value} к прошлой неделе`;
}

export function HabitInsightsPanel({ workspace, date, language, calendarMode }: HabitInsightsPanelProps) {
  const isEnglish = language === "en";
  const [mosaicOpen, setMosaicOpen] = useState(false);
  const mosaicBodyId = useId();
  const weekly = useMemo(() => buildWeeklyHabitSummary(workspace, date), [date, workspace]);
  const mosaic = useMemo(() => buildHabitYearMosaic(workspace.dailyGoalRecords, date), [date, workspace.dailyGoalRecords]);
  const records = useMemo(() => [...workspace.habits]
    .sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title))
    .map((habit) => ({
      habit,
      record: buildHabitPersonalRecord(habit, workspace.habitCompletions, date, calendarMode, isHabitScheduledForDate),
    })), [calendarMode, date, workspace.habitCompletions, workspace.habits]);
  const rhythm = workspace.userProgress.rhythmScore;
  const perfectDays = mosaic.filter((cell) => cell.status === "perfect").length;
  const qualifiedDays = mosaic.filter((cell) => cell.status === "qualified" || cell.status === "perfect").length;

  return (
    <div className="habit-phase-k-insights">
      <section className="habit-weekly-summary" aria-labelledby="habit-weekly-summary-title">
        <header>
          <div><span className="eyebrow">{isEnglish ? "Seven-day perspective" : "Перспектива семи дней"}</span><h3 id="habit-weekly-summary-title">{isEnglish ? "Weekly summary" : "Итоги недели"}</h3><p>{weekly.startDate} — {weekly.endDate}</p></div>
          <div className={`habit-weekly-change ${weekly.changePercent > 0 ? "positive" : weekly.changePercent < 0 ? "negative" : "neutral"}`}><strong>{comparisonCopy(weekly.completed, weekly.previousCompleted, weekly.changePercent, isEnglish)}</strong><small>{isEnglish ? `${weekly.previousCompleted} completions last week` : `${weekly.previousCompleted} выполнений на прошлой неделе`}</small></div>
        </header>
        <div className="habit-weekly-grid">
          <article><span>{isEnglish ? "Habits completed" : "Привычек выполнено"}</span><strong>{weekly.completed}</strong><small>{isEnglish ? "real completion marks" : "реальных отметок"}</small></article>
          <article><span>{isEnglish ? "Daily goals" : "Дневных целей"}</span><strong>{weekly.dailyGoals}</strong><small>{isEnglish ? "of the days elapsed" : "за прошедшие дни"}</small></article>
          <article><span>{isEnglish ? "Perfect Days" : "Идеальных дней"}</span><strong>{weekly.perfectDays}</strong><small>Perfect Day</small></article>
          <article><span>{isEnglish ? "Experience" : "Опыт"}</span><strong>+{weekly.xp} XP</strong><small>{isEnglish ? "from actual completions" : "за реальные выполнения"}</small></article>
          <article><span>{isEnglish ? "Laurels earned" : "Лавров начислено"}</span><strong>♕ {weekly.laurels}</strong><small>{isEnglish ? "positive ledger entries" : "положительные записи журнала"}</small></article>
          <article><span>{isEnglish ? "Best habit" : "Лучшая привычка"}</span><strong data-no-translate>{weekly.bestHabitTitle ?? "—"}</strong><small>{weekly.bestHabitCompleted ? (isEnglish ? `${weekly.bestHabitCompleted} completions` : `${weekly.bestHabitCompleted} выполнений`) : (isEnglish ? "No leader yet" : "Лидера пока нет")}</small></article>
        </div>
      </section>

      <section className="habit-rhythm-index" aria-labelledby="habit-rhythm-index-title" style={{ "--rhythm-score": rhythm } as CSSProperties}>
        <div className="habit-rhythm-gauge" aria-label={isEnglish ? `Rhythm index ${rhythm} of 100` : `Индекс Ритма ${rhythm} из 100`}><span><strong>{rhythm}</strong><small>/100</small></span></div>
        <div><span className="eyebrow">{isEnglish ? "Recent 28 days" : "Последние 28 дней"}</span><h3 id="habit-rhythm-index-title">{isEnglish ? "Rhythm index" : "Индекс Ритма"}</h3><strong>{rhythmLabel(rhythm, isEnglish)}</strong><p>{isEnglish ? "A client-side consistency indicator. Recent days weigh more, so returning to practice becomes visible quickly." : "Клиентский показатель последовательности. Недавние дни имеют больший вес, поэтому возвращение к практике становится заметно быстро."}</p></div>
      </section>

      <section className={`habit-year-mosaic${mosaicOpen ? " open" : ""}`}>
        <button
          type="button"
          className="habit-year-mosaic-toggle"
          aria-expanded={mosaicOpen}
          aria-controls={mosaicBodyId}
          onClick={() => setMosaicOpen((current) => !current)}
        >
          <span><small>{isEnglish ? "365-day perspective" : "Перспектива 365 дней"}</small><strong>{isEnglish ? "Year mosaic" : "Мозаика года"}</strong></span>
          <span className="habit-year-mosaic-meta">{date.slice(0, 4)} · {qualifiedDays} {isEnglish ? "goal days" : "дней с целью"} · {perfectDays} Perfect</span>
          <svg className={`disclosure-chevron${mosaicOpen ? " open" : ""}`} viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
          </svg>
        </button>
        {mosaicOpen ? <div className="habit-year-mosaic-body" id={mosaicBodyId}>
          <div className="habit-year-mosaic-grid" role="img" aria-label={isEnglish ? `Habit activity mosaic for ${date.slice(0, 4)}` : `Мозаика активности привычек за ${date.slice(0, 4)} год`}>
            {mosaic.map((cell) => <i className={cell.status} style={{ "--mosaic-week": cell.week, "--mosaic-weekday": cell.weekday } as CSSProperties} title={`${cell.date}: ${cell.completed}/${cell.scheduled}`} key={cell.date} />)}
          </div>
          <footer><span>{isEnglish ? "No activity" : "Нет активности"}</span><i className="none" /><i className="partial" /><i className="qualified" /><i className="perfect" /><span>{isEnglish ? "Perfect Day" : "Идеальный день"}</span></footer>
        </div> : null}
      </section>

      {records.length ? <section className="habit-personal-records" aria-labelledby="habit-personal-records-title">
        <header><div><span className="eyebrow">{isEnglish ? "Compete with yourself" : "Соревнование с собой"}</span><h3 id="habit-personal-records-title">{isEnglish ? "Personal records and mastery" : "Личные рекорды и мастерство"}</h3><p>{isEnglish ? "Progress for each habit is separate from your overall heroic rank." : "Прогресс каждой привычки существует отдельно от общего героического ранга."}</p></div></header>
        <div className="habit-personal-record-grid">{records.map(({ habit, record }) => (
          <article style={{ "--habit-color": habit.color, "--mastery-progress": record.milestoneProgress } as CSSProperties} key={habit.id}>
            <header><span aria-hidden="true">{habit.emoji}</span><div><h4 data-no-translate>{habit.title}</h4><small>{isEnglish ? `Started ${record.startedAt}` : `Начало ${record.startedAt}`}</small></div><div className="habit-mastery-ring"><strong>{record.totalCompletions}</strong><small>{isEnglish ? "done" : "всего"}</small></div></header>
            <div className="habit-record-metrics"><div><span>{isEnglish ? "Current streak" : "Текущая серия"}</span><strong>{record.currentStreak}</strong></div><div><span>{isEnglish ? "Best streak" : "Лучшая серия"}</span><strong>{record.longestStreak}</strong></div><div><span>{isEnglish ? "Completion" : "Выполнение"}</span><strong>{record.completionRate}%</strong></div><div><span>{isEnglish ? "Best month" : "Лучший месяц"}</span><strong>{record.bestMonth ?? "—"}</strong><small>{record.bestMonthCompletions || ""}</small></div></div>
            <footer><div><span>{record.reachedMilestone ? (isEnglish ? `Milestone ${record.reachedMilestone}` : `Рубеж ${record.reachedMilestone}`) : (isEnglish ? "First milestone" : "Первый рубеж")}</span><div><i /></div></div><strong>{record.nextMilestone ? (isEnglish ? `${record.nextMilestone - record.totalCompletions} to ${record.nextMilestone}` : `${record.nextMilestone - record.totalCompletions} до ${record.nextMilestone}`) : (isEnglish ? "Highest milestone reached" : "Высший рубеж достигнут")}</strong></footer>
          </article>
        ))}</div>
      </section> : null}
    </div>
  );
}
