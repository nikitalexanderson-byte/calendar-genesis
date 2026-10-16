"use client";
import type { CalendarContext } from "./calendar-context";

import { useId, useMemo, useState, type CSSProperties } from "react";
import {
  calendarMonthKey,
  calendarMonthRange,
  calendarYearRange,
  calendarYearLabel,
  formatCalendarDateValue,
  formatCalendarMonthValue,
  type CalendarMode,
} from "./calendar-data";
import { translateText, type Language } from "./i18n";
import { dateValuesBetween, isHabitScheduledForDate, type HabitWorkspace } from "./habits";
import { habitRuleForDate } from "./habit-measurement";
import { habitPeriodSettlement, habitPeriodStreak, habitQuestCompletions } from "./habit-period-progress";
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
  showCompletionCalendar?: boolean;
  reportContext?: CalendarContext;
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

export function HabitInsightsPanel({ workspace, date, language, calendarMode, reportContext, showCompletionCalendar = false }: HabitInsightsPanelProps) {
  const isEnglish = language === "en";
  const [mosaicOpen, setMosaicOpen] = useState(false);
  const [completionCalendarMode, setCompletionCalendarMode] = useState<CalendarMode>(calendarMode);
  const mosaicBodyId = useId();
  const weekly = useMemo(() => buildWeeklyHabitSummary(workspace, date), [date, workspace]);
  const mosaicRange = useMemo(() => calendarYearRange(date, calendarMode, reportContext), [calendarMode, date, reportContext]);
  const mosaic = useMemo(() => buildHabitYearMosaic(workspace.dailyGoalRecords, date, mosaicRange), [date, mosaicRange, workspace.dailyGoalRecords]);
  const records = useMemo(() => [...workspace.habits]
    .sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title))
    .map((habit) => {
      const goal = habitRuleForDate(habit,date).periodGoal;
      const now = new Date();
      const completions = goal ? habitQuestCompletions([habit],workspace,habit.createdDate,date,now,false) : workspace.habitCompletions;
      const record = buildHabitPersonalRecord(habit, completions, date, calendarMode,
        goal ? (value,day) => Boolean(habitPeriodSettlement(value,day,workspace,now)) : isHabitScheduledForDate, (value) => ({
        key: calendarMonthKey(value, calendarMode, reportContext),
        label: formatCalendarMonthValue(value, calendarMode, reportContext),
      }));
      const streak = goal ? habitPeriodStreak(habit,date,workspace,now) : record.currentStreak;
      return { habit, record: { ...record, periodUnit: goal?.period, currentStreak: streak, longestStreak: Math.max(record.longestStreak,streak) } };
    }), [calendarMode, date, reportContext, workspace]);
  const rhythm = workspace.userProgress.rhythmScore;
  const perfectDays = mosaic.filter((cell) => cell.status === "perfect").length;
  const qualifiedDays = mosaic.filter((cell) => cell.status === "qualified" || cell.status === "perfect").length;
  const yearLabel = calendarYearLabel(date, calendarMode, reportContext);
  const mosaicWeeks = Math.max(1, ...mosaic.map((cell) => cell.week));
  const completionRange = useMemo(() => calendarMonthRange(date, completionCalendarMode, reportContext), [date, completionCalendarMode, reportContext]);
  const completionDates = useMemo(() => dateValuesBetween(completionRange.start, completionRange.end), [completionRange]);
  const completionCalendarOptions: { mode: CalendarMode; ru: string }[] = [
    { mode: "profane", ru: "Григорианский" },
    { mode: "sacred", ru: "Сакральный" },
    { mode: "lunar", ru: "Лунный" },
  ];
  const localized = (value: string) => translateText(value, language);

  return (
    <div className="habit-phase-k-insights">
      {showCompletionCalendar ? <section className="habit-completion-calendar" aria-labelledby="habit-completion-calendar-title">
        <header>
          <div><span className="eyebrow">{localized("Наблюдение привычек")}</span><h3 id="habit-completion-calendar-title">{localized("Календарь выполнения привычек")}</h3><p>{formatCalendarDateValue(completionRange.start, completionCalendarMode)} — {formatCalendarDateValue(completionRange.end, completionCalendarMode)}</p></div>
          <div className="habit-completion-modes" role="group" aria-label={localized("Календарь просмотра")}>
            {completionCalendarOptions.map((option) => <button type="button" key={option.mode} className={completionCalendarMode === option.mode ? "active" : ""} aria-pressed={completionCalendarMode === option.mode} onClick={() => setCompletionCalendarMode(option.mode)}>{localized(option.ru)}</button>)}
          </div>
        </header>
        {workspace.habits.length ? <div className="habit-completion-list">{workspace.habits.map((habit) => {
          const marks = new Set(workspace.habitCompletions.filter((entry) => entry.habitId === habit.id && entry.completed).map((entry) => entry.date));
          const scheduled = completionDates.filter((value) => value <= date && habit.active && isHabitScheduledForDate(habit, value, completionCalendarMode)).length;
          const completed = completionDates.filter((value) => value <= date && marks.has(value)).length;
          return <article key={habit.id} style={{ "--habit-color": habit.color } as CSSProperties}>
            <div><strong data-no-translate>{habit.emoji} {habit.title}</strong><small>{completed}/{scheduled} · {scheduled ? Math.round(completed / scheduled * 100) : 0}%</small></div>
            <div className="habit-completion-days" style={{ "--habit-day-columns": completionCalendarMode === "sacred" ? 5 : 7 } as CSSProperties}>
              {completionDates.map((value) => { const done = marks.has(value); const planned = value <= date && habit.active && isHabitScheduledForDate(habit, value, completionCalendarMode); const status = localized(done ? "Выполнено" : planned ? "Запланировано" : "Отдых"); return <span key={value} className={done ? "done" : planned ? "planned" : "rest"} title={`${formatCalendarDateValue(value, completionCalendarMode, true)} · ${status}`} aria-label={`${formatCalendarDateValue(value, completionCalendarMode, true)}: ${status}`} />; })}
            </div>
          </article>;
        })}</div> : <p>{localized("Создайте привычку, чтобы увидеть её историю.")}</p>}
        <footer><i className="done" />{localized("Выполнено")}<i className="planned" />{localized("Запланировано")}<i className="rest" />{localized("Отдых")}</footer>
      </section> : null}
      <section className="habit-weekly-summary" aria-labelledby="habit-weekly-summary-title">
        <header>
          <div><span className="eyebrow">{isEnglish ? "Seven-day perspective" : "Перспектива семи дней"}</span><h3 id="habit-weekly-summary-title">{isEnglish ? "Weekly summary" : "Итоги недели"}</h3><p>{formatCalendarDateValue(weekly.startDate, calendarMode)} — {formatCalendarDateValue(weekly.endDate, calendarMode)}</p></div>
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
          <span><small>{isEnglish ? "Year perspective" : "Перспектива года"}</small><strong>{isEnglish ? "Year mosaic" : "Мозаика года"}</strong></span>
          <span className="habit-year-mosaic-meta">{yearLabel} · {qualifiedDays} {isEnglish ? "goal days" : "дней с целью"} · {perfectDays} Perfect</span>
          <svg className={`disclosure-chevron${mosaicOpen ? " open" : ""}`} viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
          </svg>
        </button>
        {mosaicOpen ? <div className="habit-year-mosaic-body" id={mosaicBodyId}>
          <div className="habit-year-mosaic-grid" role="img" aria-label={isEnglish ? `Habit activity mosaic for ${yearLabel}` : `Мозаика активности привычек за ${yearLabel} год`} style={{ "--mosaic-weeks": mosaicWeeks } as CSSProperties}>
            {mosaic.map((cell) => <i className={cell.status} style={{ "--mosaic-week": cell.week, "--mosaic-weekday": cell.weekday } as CSSProperties} title={`${formatCalendarDateValue(cell.date, calendarMode, true)}: ${cell.completed}/${cell.scheduled}`} key={cell.date} />)}
          </div>
          <footer><span>{isEnglish ? "No activity" : "Нет активности"}</span><i className="none" /><i className="partial" /><i className="qualified" /><i className="perfect" /><span>{isEnglish ? "Perfect Day" : "Идеальный день"}</span></footer>
        </div> : null}
      </section>

      {records.length ? <section className="habit-personal-records" aria-labelledby="habit-personal-records-title">
        <header><div><span className="eyebrow">{isEnglish ? "Compete with yourself" : "Соревнование с собой"}</span><h3 id="habit-personal-records-title">{isEnglish ? "Personal records and mastery" : "Личные рекорды и мастерство"}</h3><p>{isEnglish ? "Progress for each habit is separate from your overall heroic rank." : "Прогресс каждой привычки существует отдельно от общего героического ранга."}</p></div></header>
        <div className="habit-personal-record-grid">{records.map(({ habit, record }) => (
          <article style={{ "--habit-color": habit.color, "--mastery-progress": record.milestoneProgress } as CSSProperties} key={habit.id}>
            <header><span aria-hidden="true">{habit.emoji}</span><div><h4 data-no-translate>{habit.title}</h4><small>{isEnglish ? "Started" : "Начало"} {formatCalendarDateValue(record.startedAt, calendarMode, true)}</small></div><div className="habit-mastery-ring"><strong>{record.totalCompletions}</strong><small>{isEnglish ? "done" : "всего"}</small></div></header>
            <div className="habit-record-metrics"><div><span>{isEnglish ? "Current streak" : "Текущая серия"}</span><strong>{record.currentStreak}{record.periodUnit ? ` ${translateText("периодов",language)}` : ""}</strong></div><div><span>{isEnglish ? "Best streak" : "Лучшая серия"}</span><strong>{record.longestStreak}{record.periodUnit ? ` ${translateText("периодов",language)}` : ""}</strong></div><div><span>{isEnglish ? "Completion" : "Выполнение"}</span><strong>{record.completionRate}%</strong></div><div><span>{isEnglish ? "Best month" : "Лучший месяц"}</span><strong>{record.bestMonth ?? "—"}</strong><small>{record.bestMonthCompletions || ""}</small></div></div>
            <footer><div><span>{record.reachedMilestone ? (isEnglish ? `Milestone ${record.reachedMilestone}` : `Рубеж ${record.reachedMilestone}`) : (isEnglish ? "First milestone" : "Первый рубеж")}</span><div><i /></div></div><strong>{record.nextMilestone ? (isEnglish ? `${record.nextMilestone - record.totalCompletions} to ${record.nextMilestone}` : `${record.nextMilestone - record.totalCompletions} до ${record.nextMilestone}`) : (isEnglish ? "Highest milestone reached" : "Высший рубеж достигнут")}</strong></footer>
          </article>
        ))}</div>
      </section> : null}
    </div>
  );
}
