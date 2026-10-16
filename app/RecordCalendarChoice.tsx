"use client";

import { CalendarModeIcon } from "./CalendarModeIcon";
import type { CalendarMode } from "./calendar-data";
import { getRuntimeLanguage } from "./i18n";
import { useSacredFeaturesEnabled } from "./sacred-features";

export function RecordCalendarChoice({ value, onChange, language = getRuntimeLanguage() }: {
  value: CalendarMode; onChange: (mode: CalendarMode) => void; language?: string;
}) {
  const english = language === "en";
  const sacredFeaturesEnabled = useSacredFeaturesEnabled();
  if (!sacredFeaturesEnabled) return null;
  return <fieldset className="record-calendar-choice">
    <legend>{english ? "Calendar" : "Календарь"}</legend>
    <div role="group" aria-label={english ? "Record calendar" : "Календарь записи"}>
      {([
        ["sacred", english ? "Sacred" : "Сакральный"],
        ["profane", english ? "Gregorian" : "Григорианский"],
        ["lunar", english ? "Lunar" : "Лунный"],
      ] as const).map(([mode, label]) => <button type="button" key={mode}
        aria-pressed={value === mode} onClick={() => onChange(mode)}>
        <CalendarModeIcon mode={mode} /><span>{label}</span>
      </button>)}
    </div>
  </fieldset>;
}
