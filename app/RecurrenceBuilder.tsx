"use client";

import {
  buildRecurrenceDates,
  RECURRENCE_MODE_COPY,
  suggestedRecurrenceDays,
  type RecurrenceConfig,
} from "./task-recurrence";

const PYATA_DAY_LABELS = ["I", "II", "III", "IIII", "V"];
const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function RecurrenceBuilder({
  value,
  onChange,
  startDate,
  disabled = false,
}: {
  value: RecurrenceConfig;
  onChange: (value: RecurrenceConfig) => void;
  startDate: string;
  disabled?: boolean;
}) {
  const setMode = (mode: RecurrenceConfig["mode"]) => {
    const pattern = mode === "classic" ? "weekdays" : mode === "lunar" ? "lunar-days" : "pyata-days";
    onChange({
      ...value,
      mode,
      pattern,
      days: suggestedRecurrenceDays(mode, pattern, startDate),
      interval: 1,
    });
  };

  const setPattern = (pattern: RecurrenceConfig["pattern"]) => {
    onChange({
      ...value,
      pattern,
      days: suggestedRecurrenceDays(value.mode, pattern, startDate),
      interval: 1,
    });
  };

  const toggleDay = (day: number) => {
    const selected = value.days.includes(day);
    if (selected && value.days.length === 1) return;
    onChange({
      ...value,
      days: selected ? value.days.filter((item) => item !== day) : [...value.days, day].sort((a, b) => a - b),
    });
  };

  const visibleDays = value.mode === "classic"
    ? WEEKDAY_LABELS
    : value.mode === "genesis" && value.pattern === "pyata-days"
      ? PYATA_DAY_LABELS
      : Array.from({ length: 30 }, (_, index) => String(index + 1));
  const occurrenceCount = value.enabled ? buildRecurrenceDates(startDate, value).length : 1;
  const intervalUnit = value.mode === "classic"
    ? "неделю"
    : value.mode === "lunar"
      ? "лунный месяц"
      : value.pattern === "pyata-days" ? "пяту" : "месяц GENESIS";

  return (
    <section className={`recurrence-builder${value.enabled ? " enabled" : ""}${disabled ? " disabled" : ""}`} aria-label="Настройка повторения">
      <div className="recurrence-switch-row">
        <div>
          <strong>Повторение</strong>
          <small>{disabled ? "Недоступно для списков Google Tasks" : value.enabled ? RECURRENCE_MODE_COPY[value.mode].description : "Одиночная задача без повторений"}</small>
        </div>
        <label className="recurrence-switch">
          <input
            type="checkbox"
            checked={value.enabled}
            disabled={disabled}
            onChange={(event) => onChange({
              ...value,
              enabled: event.target.checked,
              days: event.target.checked ? suggestedRecurrenceDays(value.mode, value.pattern, startDate) : value.days,
            })}
          />
          <span aria-hidden="true" />
          <b>{value.enabled ? "Включено" : "Выключено"}</b>
        </label>
      </div>

      {value.enabled && !disabled ? (
        <div className="recurrence-builder-body">
          <div className="recurrence-mode-toggle" role="group" aria-label="Система повторения">
            {(Object.keys(RECURRENCE_MODE_COPY) as Array<RecurrenceConfig["mode"]>).map((mode) => (
              <button type="button" key={mode} className={value.mode === mode ? "active" : ""} aria-pressed={value.mode === mode} onClick={() => setMode(mode)}>
                <span>{mode === "genesis" ? "✦" : mode === "classic" ? "□" : "☾"}</span>
                <strong>{RECURRENCE_MODE_COPY[mode].shortTitle}</strong>
              </button>
            ))}
          </div>

          {value.mode === "genesis" ? (
            <div className="recurrence-pattern-toggle" role="group" aria-label="Цикл GENESIS">
              <button type="button" className={value.pattern === "pyata-days" ? "active" : ""} aria-pressed={value.pattern === "pyata-days"} onClick={() => setPattern("pyata-days")}>Дни каждой пяты</button>
              <button type="button" className={value.pattern === "month-days" ? "active" : ""} aria-pressed={value.pattern === "month-days"} onClick={() => setPattern("month-days")}>Дни месяца</button>
            </div>
          ) : null}

          <div className="recurrence-day-field">
            <span>{value.mode === "classic" ? "Дни недельного цикла" : value.mode === "lunar" ? "Дни лунного месяца" : value.pattern === "pyata-days" ? "Позиции внутри пяты" : "Дни 30-дневного месяца"}</span>
            <div className={`recurrence-day-grid${visibleDays.length > 7 ? " dense" : ""}`} role="group" aria-label="Дни повторения">
              {visibleDays.map((label, index) => {
                const day = index + 1;
                const selected = value.days.includes(day);
                return <button type="button" key={day} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleDay(day)}>{label}</button>;
              })}
            </div>
          </div>

          <div className="recurrence-footer">
            <label>
              <span>Каждую</span>
              <input type="number" min="1" max="12" value={value.interval} onChange={(event) => onChange({ ...value, interval: Math.min(12, Math.max(1, Number(event.target.value) || 1)) })} />
              <span>{intervalUnit}</span>
            </label>
            <p><strong>{occurrenceCount}</strong><span>задач будет создано до конца {value.mode === "lunar" ? "текущего сакрального года по лунным датам" : "текущего сакрального года"}</span></p>
          </div>

          <small className="recurrence-sync-note">
            {value.mode === "classic"
              ? "Все выбранные даты классической недели напрямую синхронизируются с Google Calendar."
              : `Расписание рассчитывает GENESIS; ${value.mode === "lunar" ? "лунные сутки" : "пяты и сакральные месяцы"} не зависят от правил повторения Google.`}
          </small>
        </div>
      ) : null}
    </section>
  );
}
