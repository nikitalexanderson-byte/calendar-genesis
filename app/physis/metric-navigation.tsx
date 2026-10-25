import type { CSSProperties } from 'react';
import { METRICS, type Measurement } from './care-domain';
import { HealthIcon } from './health-icons';
import type { HealthIconName } from './health-icon-names';

const labels: Record<Measurement['type'], [string, string]> = {
  pressure: ['Давление', 'Pressure'], glucose: ['Сахар', 'Glucose'], weight: ['Вес', 'Weight'], waist: ['Талия', 'Waist'],
  'resting-pulse': ['Пульс', 'Pulse'], sleep: ['Сон', 'Sleep'], wellbeing: ['Самочувствие', 'Wellbeing'], soreness: ['Боль', 'Soreness'],
  steps: ['Шаги', 'Steps'], water: ['Вода', 'Water'], hrv: ['HRV', 'HRV'], spo2: ['SpO₂', 'SpO₂'], temperature: ['Температура', 'Temperature'], custom: ['Своё', 'Custom'],
};
const icons: Record<Measurement['type'], HealthIconName> = {
  pressure: 'gauge', glucose: 'droplet', weight: 'weight', waist: 'ruler', 'resting-pulse': 'heart-pulse', sleep: 'moon', wellbeing: 'smile',
  soreness: 'bone', steps: 'footprints', water: 'glass-water', hrv: 'activity', spo2: 'wind', temperature: 'thermometer', custom: 'sliders-horizontal',
};
export function MetricNavigation({ enabled, selected, language, describe, onSelect }: {
  enabled: string[]; selected: Measurement['type']; language: string;
  describe: (type: Measurement['type'], name: string) => string; onSelect: (type: Measurement['type']) => void;
}) {
  const entries = METRICS.filter(([id]) => enabled.includes(id)); const columns = Math.ceil(entries.length / 2);
  const rows = [entries.slice(0, columns), entries.slice(columns)];
  return <div className="physis-metric-navigation"><nav className="physis-tabs physis-measurement-nav" aria-label={language === 'ru' ? 'Показатели здоровья' : 'Health metrics'} style={{ '--metric-columns': columns } as CSSProperties}>
    {rows.map((row, index) => <div className="physis-metric-row" key={index}>{row.map(([id, name]) => <button key={id} type="button" className="secondary-button icon-action-button physis-metric-tab" data-no-translate aria-label={describe(id, name)} data-tooltip={describe(id, name)} aria-current={selected === id ? 'page' : undefined} aria-controls="physis-measurement-page" onClick={() => onSelect(id)}>
      <HealthIcon name={icons[id]} /><span aria-hidden="true">{labels[id][language === 'ru' ? 0 : 1]}</span>
    </button>)}</div>)}
  </nav></div>;
}
