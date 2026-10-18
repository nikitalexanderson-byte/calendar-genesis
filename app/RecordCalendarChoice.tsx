"use client";

import { CalendarModeIcon } from "./CalendarModeIcon";
import type { CalendarMode } from "./calendar-data";
import { getRuntimeLanguage, translateText, type Language } from "./i18n";
import { useSacredFeaturesEnabled } from "./sacred-features";

export function RecordCalendarChoice({ value, onChange, language = getRuntimeLanguage() }: {
  value: CalendarMode; onChange: (mode: CalendarMode) => void; language?: string;
}) {
  const t=(value:string)=>translateText(value,language as Language);
  const sacredFeaturesEnabled = useSacredFeaturesEnabled();
  if (!sacredFeaturesEnabled) return null;
  return <fieldset className="record-calendar-choice" data-no-translate>
    <legend>{t('Календарь')}</legend>
    <div role="group" aria-label={t('Календарь записи')}>
      {([
        ["sacred", t('Сакральный')],
        ["profane", t('Григорианский')],
        ["lunar", t('Лунный')],
      ] as const).map(([mode, label]) => <button type="button" key={mode}
        aria-pressed={value === mode} onClick={() => onChange(mode)}>
        <CalendarModeIcon mode={mode} /><span>{label}</span>
      </button>)}
    </div>
  </fieldset>;
}
