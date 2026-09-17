"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type CalendarMode,
  MONTHS,
  formatCalendarDate,
  formatGregorian,
  getGregorianDate,
  getLunarDate,
  getLunarMonthDates,
  getMoon,
  getSacredDay,
  getSacredDate,
  lunarMonthIndex,
} from "./calendar-data";
import { MoonPhaseIcon } from "./MoonPhaseIcon";
import { getRuntimeLanguage, runtimeLocale } from "./i18n";

type CalendarDatePickerProps = {
  id?: string;
  value: string;
  mode: CalendarMode;
  min?: string;
  max?: string;
  required?: boolean;
  ariaLabel?: string;
  onChange: (value: string) => void;
};

function inputDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function allowed(value: string, min?: string, max?: string) {
  return (!min || value >= min) && (!max || value <= max);
}

function formatCompactGregorian(date: Date) {
  const locale = runtimeLocale();
  const dateLabel = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
  const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: "short" })
    .format(date)
    .replace(/\.$/u, "");
  const capitalizedWeekday = weekdayLabel.charAt(0).toLocaleUpperCase(locale) + weekdayLabel.slice(1);
  return `${dateLabel} ${capitalizedWeekday}`;
}

export function CalendarDatePicker({ id, value, mode, min, max, required, ariaLabel, onChange }: CalendarDatePickerProps) {
  const isEnglish = getRuntimeLanguage() === "en";
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseDate(value), [value]);
  const selectedSacred = useMemo(() => getSacredDate(selectedDate), [selectedDate]);
  const [sacredYear, setSacredYear] = useState(selectedSacred.sacredYear);
  const [sacredMonth, setSacredMonth] = useState(selectedSacred.monthIndex);
  const [lunarMonth, setLunarMonth] = useState(() => lunarMonthIndex(selectedDate));

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  if (mode === "profane") {
    return <input id={id} type="date" value={value} min={min} max={max} required={required} aria-label={ariaLabel} onChange={(event) => onChange(event.target.value)} />;
  }

  const choose = (date: Date) => {
    const next = inputDate(date);
    if (!allowed(next, min, max)) return;
    onChange(next);
    setOpen(false);
  };
  const openPicker = () => {
    setSacredYear(selectedSacred.sacredYear);
    setSacredMonth(selectedSacred.monthIndex);
    setLunarMonth(lunarMonthIndex(selectedDate));
    setOpen(true);
  };
  const month = MONTHS[sacredMonth];
  const sacredDays = month.days
    .map((day) => getSacredDay(sacredMonth, day.day))
    .filter((day) => sacredMonth !== 12 || inputDate(getGregorianDate(sacredYear, sacredMonth, day.day)) < inputDate(getGregorianDate(sacredYear + 1, 0, 1)));
  const lunarDates = getLunarMonthDates(lunarMonth);
  const lunarTitleDate = lunarDates[Math.floor(lunarDates.length / 2)] ?? selectedDate;
  const lunarTitle = getLunarDate(lunarTitleDate);

  return (
    <>
      <button id={id} type="button" className={`calendar-date-trigger mode-${mode}`} onClick={openPicker} aria-label={ariaLabel} aria-haspopup="dialog">
        <span>{formatCalendarDate(selectedDate, mode, true)}</span>
        <small>{formatGregorian(selectedDate, true)}</small>
      </button>
      {open ? (
        <div className="modal-backdrop calendar-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className={`calendar-picker mode-${mode}`} role="dialog" aria-modal="true" aria-label={mode === "sacred" ? "Выбор сакральной даты" : "Выбор лунной даты"}>
            <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
            <span className="eyebrow">{mode === "sacred" ? "Сакральный календарь" : "Лунный календарь"}</span>
            <h2>{mode === "sacred" ? "Выберите день круга" : "Выберите лунный день"}</h2>
            {mode === "sacred" ? (
              <>
                <div className="calendar-picker-controls">
                  <button type="button" onClick={() => setSacredYear((current) => current - 1)} aria-label="Предыдущий сакральный год">←</button>
                  <strong>{sacredYear}–{sacredYear + 1}</strong>
                  <button type="button" onClick={() => setSacredYear((current) => current + 1)} aria-label="Следующий сакральный год">→</button>
                </div>
                <div className="calendar-picker-months" role="listbox" aria-label="Сакральный месяц">
                  {MONTHS.map((item) => <button type="button" className={item.index === sacredMonth ? "active" : ""} onClick={() => setSacredMonth(item.index)} key={item.index}>{item.roman}</button>)}
                </div>
                <header className="calendar-picker-heading"><strong>{month.name}</strong><span>{month.title}</span></header>
                <div className="sacred-picker-days">
                  {sacredDays.map((day) => {
                    const date = getGregorianDate(sacredYear, sacredMonth, day.day);
                    const dateValue = inputDate(date);
                    return (
                      <button type="button" disabled={!allowed(dateValue, min, max)} className={dateValue === value ? "selected" : ""} onClick={() => choose(date)} key={day.id}>
                        <small>Пята {day.pyata || "Ω"}</small><strong>{day.day}</strong><span>{day.name.split("(")[0].trim()}</span>
                        <time dateTime={dateValue}>{formatCompactGregorian(date)}</time>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="calendar-picker-controls">
                  <button type="button" onClick={() => setLunarMonth((current) => current - 1)} aria-label="Предыдущий лунный месяц">←</button>
                  <strong>{lunarTitle.month.name} · {lunarTitle.month.roman}</strong>
                  <button type="button" onClick={() => setLunarMonth((current) => current + 1)} aria-label="Следующий лунный месяц">→</button>
                </div>
                <p className="calendar-picker-note">{lunarTitle.month.title}. {isEnglish
                  ? "The month begins at the exact new moon and is divided into the Decades of Growth, Fullness, and Outflow."
                  : "Месяц начинается точным новолунием и делится на декады Роста, Полноты и Исхода."}</p>
                <div className="lunar-picker-days">
                  {lunarDates.map((date) => {
                    const dateValue = inputDate(date);
                    const moon = getMoon(date);
                    const lunar = getLunarDate(date);
                    return (
                      <button type="button" disabled={!allowed(dateValue, min, max)} className={dateValue === value ? "selected" : ""} onClick={() => choose(date)} key={dateValue}>
                        <MoonPhaseIcon phaseStep={moon.phaseStep} size={24} /><strong>{moon.day}</strong><span>{lunar.isThreshold ? "Рубеж" : lunar.decade.name}</span><small>{moon.phase} · {moon.illumination}%</small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
