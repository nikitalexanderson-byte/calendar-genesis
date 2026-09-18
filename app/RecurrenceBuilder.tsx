"use client";

import { MONTHS } from "./calendar-data";
import {
  buildRecurrenceDates,
  alignRecurrenceConfigWithCalendar,
  lunarMonthOptions,
  MAX_RECURRENCE_OCCURRENCES,
  RECURRENCE_MODE_COPY,
  recurrenceDefaultEndDate,
  recurrenceMaximumEndDate,
  suggestedRecurrenceDays,
  type RecurrenceConfig,
} from "./task-recurrence";
import type { CalendarMode } from "./calendar-data";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { CronusSickleIcon } from "./CronusSickleIcon";
import { getRuntimeLanguage, runtimeLocale } from "./i18n";

const PYATA_DAY_LABELS = ["I", "II", "III", "IIII", "V"];
const PYATA_LABELS = ["I пята", "II пята", "III пята", "IIII пята", "V пята", "VI пята"];
const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const ALL_PYATAS = [1, 2, 3, 4, 5, 6];
const ODD_PYATAS = [1, 3, 5];
const EVEN_PYATAS = [2, 4, 6];
const SACRED_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const CLASSIC_PATTERN_COPY = {
  daily: "Каждый день",
  weekdays: "По дням недели",
  monthly: "Каждый месяц",
  yearly: "Каждый год",
} as const;

function sameNumbers(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function effectiveSelection(selected: number[], all: number[]) {
  return selected.length ? selected : all;
}

function toggleSelection(selected: number[], item: number, all: number[]) {
  if (selected.length === 0) return [item];
  const current = effectiveSelection(selected, all);
  if (current.includes(item) && current.length === 1) return selected;
  const next = current.includes(item)
    ? current.filter((value) => value !== item)
    : [...current, item].sort((left, right) => left - right);
  return sameNumbers(next, all) ? [] : next;
}

function shortDate(value: string, includeYear = false) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(runtimeLocale(), { day: "numeric", month: "short", year: includeYear ? "numeric" : undefined }).format(date);
}

export function RecurrenceBuilder({
  value: rawValue,
  onChange,
  startDate,
  destination = "calendar",
  calendarMode = "profane",
  lockRangeStart = false,
}: {
  value: RecurrenceConfig;
  onChange: (value: RecurrenceConfig) => void;
  startDate: string;
  destination?: "calendar" | "tasks" | "tracker";
  calendarMode?: CalendarMode;
  lockRangeStart?: boolean;
}) {
  const isEnglish = getRuntimeLanguage() === "en";
  const value = alignRecurrenceConfigWithCalendar(rawValue, calendarMode, startDate);
  const rangeStart = value.rangeStart && value.rangeStart >= startDate ? value.rangeStart : startDate;
  const maximumEnd = recurrenceMaximumEndDate(rangeStart);
  const rangeEnd = value.rangeEnd && value.rangeEnd >= rangeStart
    ? value.rangeEnd <= maximumEnd ? value.rangeEnd : maximumEnd
    : recurrenceDefaultEndDate(rangeStart);
  const lunarMonths = lunarMonthOptions(rangeStart, rangeEnd);
  const monthValues = value.mode === "lunar" ? lunarMonths.map((month) => month.value) : SACRED_MONTHS;
  const selectedMonths = effectiveSelection(value.months, monthValues);
  const selectedPyatas = effectiveSelection(value.pyatas, ALL_PYATAS);
  const occurrenceCount = value.enabled ? buildRecurrenceDates(startDate, { ...value, rangeStart, rangeEnd }).length : 1;
  const tooManyOccurrences = occurrenceCount > MAX_RECURRENCE_OCCURRENCES;

  const setPattern = (pattern: RecurrenceConfig["pattern"]) => {
    onChange({
      ...value,
      pattern,
      days: suggestedRecurrenceDays(value.mode, pattern, rangeStart),
      interval: 1,
    });
  };

  const toggleDay = (day: number) => {
    const selected = value.days.includes(day);
    if (selected && value.days.length === 1) return;
    onChange({
      ...value,
      days: selected ? value.days.filter((item) => item !== day) : [...value.days, day].sort((left, right) => left - right),
    });
  };

  const setWeekdayPreset = (days: number[]) => onChange({ ...value, days: [...days] });
  const setPyataPreset = (pyatas: number[]) => onChange({ ...value, pyatas: sameNumbers(pyatas, ALL_PYATAS) ? [] : [...pyatas] });
  const intervalUnit = value.pattern === "daily"
    ? "дн."
    : value.pattern === "weekdays"
      ? "нед."
      : value.pattern === "monthly" ? "мес." : "г.";

  return (
    <section className={`recurrence-builder${value.enabled ? " enabled" : ""}`} aria-label="Настройка повторения">
      <div className="recurrence-switch-row">
        <div>
          <strong>Повторение</strong>
          <small>{value.enabled ? RECURRENCE_MODE_COPY[value.mode].description : "Одиночная задача без повторений"}</small>
        </div>
        <label className="recurrence-switch">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) => onChange({
              ...value,
              enabled: event.target.checked,
              rangeStart,
              rangeEnd,
              days: event.target.checked ? suggestedRecurrenceDays(value.mode, value.pattern, rangeStart) : value.days,
            })}
          />
          <span aria-hidden="true" />
          <b>{value.enabled ? "Включено" : "Выключено"}</b>
        </label>
      </div>

      {value.enabled ? (
        <div className="recurrence-builder-body">
          <div className="recurrence-inherited-mode" aria-label={`Система повторения: ${RECURRENCE_MODE_COPY[value.mode].shortTitle}`}>
            <span aria-hidden="true">{value.mode === "genesis" ? "✦" : value.mode === "classic" ? <CronusSickleIcon size={24} /> : "☾"}</span>
            <div>
              <small>Из личного кабинета</small>
              <strong>{RECURRENCE_MODE_COPY[value.mode].shortTitle}</strong>
            </div>
          </div>

          <fieldset className="recurrence-range">
            <legend>Период повторения</legend>
            {lockRangeStart ? <div className="recurrence-locked-start"><span>С какого</span><strong>{rangeStart}</strong><small>Дата создания · изменить нельзя</small></div> : <label htmlFor="recurrence-range-start">
              <span>С какого</span>
              <CalendarDatePicker id="recurrence-range-start" mode={calendarMode} min={startDate} value={rangeStart} onChange={(nextStart) => {
                const nextEnd = rangeEnd < nextStart ? recurrenceDefaultEndDate(nextStart) : rangeEnd;
                onChange({ ...value, rangeStart: nextStart, rangeEnd: nextEnd, months: value.mode === "lunar" ? [] : value.months });
              }} />
            </label>}
            <label htmlFor="recurrence-range-end">
              <span>По какое</span>
              <CalendarDatePicker id="recurrence-range-end" mode={calendarMode} min={rangeStart} max={maximumEnd} value={rangeEnd} onChange={(nextEnd) => onChange({
                ...value,
                rangeStart,
                rangeEnd: nextEnd,
                months: value.mode === "lunar" ? [] : value.months,
              })} />
            </label>
            <small>Можно запланировать серию на срок до пяти лет.</small>
          </fieldset>

          {value.mode === "classic" ? (
            <>
              <div className="recurrence-pattern-toggle wrap" role="group" aria-label="Ритм григорианского календаря">
                {(Object.keys(CLASSIC_PATTERN_COPY) as Array<keyof typeof CLASSIC_PATTERN_COPY>).map((pattern) => (
                  <button type="button" key={pattern} className={value.pattern === pattern ? "active" : ""} aria-pressed={value.pattern === pattern} onClick={() => setPattern(pattern)}>{CLASSIC_PATTERN_COPY[pattern]}</button>
                ))}
              </div>
              {value.pattern === "weekdays" ? (
                <div className="recurrence-day-field">
                  <span>В какие дни недели</span>
                  <div className="recurrence-preset-row" role="group" aria-label="Готовые наборы дней">
                    <button type="button" className={sameNumbers(value.days, [1, 2, 3, 4, 5]) ? "active" : ""} onClick={() => setWeekdayPreset([1, 2, 3, 4, 5])}>Будни</button>
                    <button type="button" className={sameNumbers(value.days, [6, 7]) ? "active" : ""} onClick={() => setWeekdayPreset([6, 7])}>Выходные</button>
                    <button type="button" className={sameNumbers(value.days, ALL_WEEKDAYS) ? "active" : ""} onClick={() => setWeekdayPreset(ALL_WEEKDAYS)}>Все дни</button>
                  </div>
                  <div className="recurrence-day-grid" role="group" aria-label="Дни недели">
                    {WEEKDAY_LABELS.map((label, index) => {
                      const day = index + 1;
                      const selected = value.days.includes(day);
                      return <button type="button" key={day} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleDay(day)}>{label}</button>;
                    })}
                  </div>
                </div>
              ) : (
                <p className="recurrence-pattern-explainer">
                  {value.pattern === "daily"
                    ? "Задача появится через выбранное число календарных дней."
                    : value.pattern === "monthly"
                      ? `Задача появится ${new Date(`${startDate}T12:00:00`).getDate()} числа выбранных месяцев.`
                      : `Задача появится ежегодно ${shortDate(startDate)}.`}
                </p>
              )}
              <label className="recurrence-interval">
                <span>Интервал</span>
                <input type="number" min="1" max="99" value={value.interval} onChange={(event) => onChange({ ...value, interval: Math.min(99, Math.max(1, Number(event.target.value) || 1)) })} />
                <span>{intervalUnit}</span>
              </label>
            </>
          ) : null}

          {value.mode === "genesis" ? (
            <>
              <div className="recurrence-pattern-toggle" role="group" aria-label="Ритм сакрального календаря">
                <button type="button" className={value.pattern === "pyata-days" ? "active" : ""} aria-pressed={value.pattern === "pyata-days"} onClick={() => setPattern("pyata-days")}>По пятам</button>
                <button type="button" className={value.pattern === "month-days" ? "active" : ""} aria-pressed={value.pattern === "month-days"} onClick={() => setPattern("month-days")}>По дням месяца</button>
              </div>
              <div className="recurrence-day-field">
                <div className="recurrence-field-heading">
                  <span>В какие сакральные месяцы</span>
                  <button type="button" disabled={value.months.length === 0} onClick={() => onChange({ ...value, months: [] })}>{value.months.length ? "Выбрать все" : "Все выбраны"}</button>
                </div>
                <div className="recurrence-month-grid sacred" role="group" aria-label="Сакральные месяцы">
                  {MONTHS.slice(0, 12).map((month, index) => {
                    const monthNumber = index + 1;
                    const selected = selectedMonths.includes(monthNumber);
                    return (
                      <button type="button" key={monthNumber} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => onChange({ ...value, months: toggleSelection(value.months, monthNumber, SACRED_MONTHS) })}>
                        <strong>{month.roman}</strong><span>{month.name}</span>
                      </button>
                    );
                  })}
                </div>
                <small className="recurrence-selection-hint">Нажмите месяц, чтобы оставить только его, затем добавьте остальные.</small>
              </div>
              {value.pattern === "pyata-days" ? (
                <div className="recurrence-day-field">
                  <span>В какие пяты месяца</span>
                  <div className="recurrence-preset-row" role="group" aria-label="Чётность пят">
                    <button type="button" className={sameNumbers(selectedPyatas, ALL_PYATAS) ? "active" : ""} onClick={() => setPyataPreset(ALL_PYATAS)}>Все</button>
                    <button type="button" className={sameNumbers(selectedPyatas, ODD_PYATAS) ? "active" : ""} onClick={() => setPyataPreset(ODD_PYATAS)}>Нечётные</button>
                    <button type="button" className={sameNumbers(selectedPyatas, EVEN_PYATAS) ? "active" : ""} onClick={() => setPyataPreset(EVEN_PYATAS)}>Чётные</button>
                  </div>
                  <div className="recurrence-day-grid pyatas" role="group" aria-label="Пяты месяца">
                    {PYATA_LABELS.map((label, index) => {
                      const pyata = index + 1;
                      const selected = selectedPyatas.includes(pyata);
                      return <button type="button" key={pyata} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => onChange({ ...value, pyatas: toggleSelection(value.pyatas, pyata, ALL_PYATAS) })}>{label}</button>;
                    })}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {value.mode === "lunar" ? (
            <div className="recurrence-day-field">
              <div className="recurrence-field-heading">
                <span>В какие лунные месяцы</span>
                <button type="button" disabled={value.months.length === 0} onClick={() => onChange({ ...value, months: [] })}>{value.months.length ? "Выбрать все" : "Все выбраны"}</button>
              </div>
              <div className="recurrence-month-grid lunar" role="group" aria-label="Лунные месяцы">
                {lunarMonths.map((month) => {
                  const selected = selectedMonths.includes(month.value);
                  return (
                    <button type="button" key={month.value} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => onChange({ ...value, months: toggleSelection(value.months, month.value, monthValues) })}>
                      <strong>{month.value}</strong><span>{shortDate(month.startDate)} — {shortDate(month.endDate)}</span>
                    </button>
                  );
                })}
              </div>
              <small className="recurrence-selection-hint">Нажмите месяц, чтобы оставить только его, затем добавьте остальные.</small>
            </div>
          ) : null}

          {value.mode !== "classic" || value.pattern === "weekdays" ? (
            value.mode === "classic" ? null : (
              <div className="recurrence-day-field">
                <span>{value.mode === "lunar" ? "В какие дни лунного месяца" : value.pattern === "pyata-days" ? "Какие дни внутри пяты" : "Какие дни сакрального месяца"}</span>
                <div className={`recurrence-day-grid${value.mode === "genesis" && value.pattern === "pyata-days" ? "" : " dense"}`} role="group" aria-label="Дни повторения">
                  {(value.mode === "genesis" && value.pattern === "pyata-days" ? PYATA_DAY_LABELS : Array.from({ length: 30 }, (_, index) => String(index + 1))).map((label, index) => {
                    const day = index + 1;
                    const selected = value.days.includes(day);
                    return <button type="button" key={day} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleDay(day)}>{label}</button>;
                  })}
                </div>
              </div>
            )
          ) : null}

          <div className={`recurrence-summary${tooManyOccurrences ? " warning" : ""}`} role={tooManyOccurrences ? "alert" : "status"}>
            <strong>{occurrenceCount}</strong>
            <span>{tooManyOccurrences
              ? (isEnglish
                  ? `Too many recurrences. Shorten the period or choose fewer dates — maximum ${MAX_RECURRENCE_OCCURRENCES}.`
                  : `Слишком много повторений. Сократите период или выберите меньше дат — максимум ${MAX_RECURRENCE_OCCURRENCES}.`)
              : (isEnglish
                  ? `— number of ${destination === "calendar" ? "recurrences of one task" : destination === "tracker" ? "tracker dates" : "separate tasks"} from ${shortDate(rangeStart, true)} to ${shortDate(rangeEnd, true)}`
                  : `— количество ${destination === "calendar" ? "повторений одной задачи" : destination === "tracker" ? "дней трекинга" : "отдельных задач"} с ${shortDate(rangeStart, true)} по ${shortDate(rangeEnd, true)}`)}</span>
          </div>

          <small className="recurrence-sync-note">
            {destination === "tracker"
              ? (isEnglish
                  ? "GENESIS owns the recurrence. Google Tasks or Calendar are used only when you explicitly enable a reminder."
                  : "Повтор хранится в GENESIS. Google Tasks или Календарь используются только при явно включённом напоминании.")
              : destination === "tasks"
              ? (isEnglish
                  ? "The Google Tasks API does not support recurring tasks, so every selected date will become a separate task in the list."
                  : "Google Tasks API не поддерживает создание повторяющейся задачи, поэтому каждая выбранная дата станет отдельной задачей в списке.")
              : (isEnglish
                  ? `GENESIS will save one task, and Google Calendar will save one recurring event with all ${value.mode === "lunar" ? "lunar" : value.mode === "genesis" ? "sacred" : "selected"} dates.`
                  : `GENESIS сохранит одну задачу, а Google Calendar — одно повторяющееся событие со всеми ${value.mode === "lunar" ? "лунными" : value.mode === "genesis" ? "сакральными" : "выбранными"} датами.`)}
          </small>
        </div>
      ) : null}
    </section>
  );
}
