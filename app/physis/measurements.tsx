import { useEffect, useState, type ReactNode } from 'react';
import { momentCivilDate, todayCivilDate, addCivilDays } from '../calendar-context';
import { formatCalendarDateValue } from '../calendar-data';
import { METRICS, convertGlucose, measurementUnits, type Measurement } from './care-domain';
import { editPhysisRecord, newPhysisRecord, physisRecords, type PhysisFeatureProps, type PhysisRecord } from './types';
import { Field, NumberField, usePhysisAction } from './fields';
import { PhysisMomentFields } from './care-time-fields';
import { IconActionButton } from '../IconActionButton';
import { translateText, type Language } from '../i18n';

const metricDescriptions: Record<Measurement['type'], string> = {
  pressure: 'Систолическое и диастолическое давление, рука и положение тела.',
  glucose: 'Сахар крови с учётом времени приёма пищи и единиц измерения.',
  weight: 'Масса тела и её изменение по датам измерений.',
  waist: 'Обхват талии и история измерений в сантиметрах.',
  'resting-pulse': 'Частота сердечных сокращений в покое.',
  sleep: 'Продолжительность сна и заметки о восстановлении.',
  wellbeing: 'Личная оценка самочувствия по шкале от 1 до 10.',
  soreness: 'Личная оценка мышечной болезненности по шкале от 0 до 10.',
  steps: 'Количество шагов и история ежедневной активности.',
  water: 'Объём выпитой воды и записи по времени.',
  hrv: 'Вариабельность сердечного ритма с указанием устройства и контекста.',
  spo2: 'Насыщение крови кислородом по показанию пульсоксиметра.',
  temperature: 'Температура тела, время и условия измерения.',
  custom: 'Свой показатель с названием, единицей и личной шкалой.',
};
function MetricIcon({ type }: { type: Measurement['type'] }) {
  const paths: Record<Measurement['type'], ReactNode> = {
    pressure: <><circle cx="12" cy="12" r="9" /><path d="m12 12 4-4M5 13h2m10 0h2M12 5v2M8 7l1 2M16 7l-1 2" /><circle cx="12" cy="12" r="1" /></>,
    glucose: <><path d="M12 2C9 6 5 10 5 14a7 7 0 0 0 14 0c0-4-4-8-7-12Z" /><path d="M9 15h6m-3-3v6" /></>,
    weight: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M7 8a7 7 0 0 1 10 0l-2 4H9Zm5 1 1-2" /></>,
    waist: <><path d="M6 3c0 5 2 5 2 9s-2 5-2 9M18 3c0 5-2 5-2 9s2 5 2 9M4 10h16v5H4Z" /><path d="M8 10v2m4-2v3m4-3v2" /></>,
    'resting-pulse': <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /><path d="M3 12h4l2-4 3 8 2-4h7" /></>,
    sleep: <><path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" /><path d="M17 3v4m-2-2h4" /></>,
    wellbeing: <><circle cx="12" cy="12" r="9" /><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01" /></>,
    soreness: <><path d="m4 16 3-3 4 1 3-3 1-5 3-2 3 3-2 3-3 1-2 5-4 3H5Z" /><path d="m3 4 2 2m2-4v3M2 8h3" /></>,
    steps: <><ellipse cx="7" cy="8" rx="3" ry="5" transform="rotate(-15 7 8)" /><path d="m5 16 .5 3a2 2 0 0 0 4-.7l-.5-3" /><ellipse cx="17" cy="15" rx="3" ry="5" transform="rotate(15 17 15)" /><path d="m15 7 .5-3a2 2 0 0 1 4 .7l-.5 3" /></>,
    water: <><path d="m5 3 2 18h10l2-18H5ZM6 9c4-3 8 3 12 0" /></>,
    hrv: <><path d="M2 12h4l2-7 4 14 3-10 2 3h5M5 3v3m14 12v3" /></>,
    spo2: <><path d="M12 3v7M12 8c-2-3-4-4-5-2L3 16c-1 3 1 5 4 4l3-2V9m2-1c2-3 4-4 5-2l4 10c1 3-1 5-4 4l-3-2V9" /></>,
    temperature: <><path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z" /><path d="M12 8v9m6-10h3m-3 4h2" /><circle cx="12" cy="18" r="1" /></>,
    custom: <><path d="M4 7h6m4 0h6M4 17h2m4 0h10" /><circle cx="12" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[type]}</svg>;
}

const metricName = (type: string) => METRICS.find(([key]) => key === type)?.[1] ?? type;
export function PhysisMeasurements({ store, settings, context, language, hintOwner, onDisableHints }: PhysisFeatureProps & { hintOwner?: string; onDisableHints?: () => void }) {
  const text = (value: string) => translateText(value, language as Language);
  const [hintOpen, setHintOpen] = useState(false);
  useEffect(() => {
    if (!hintOwner || settings.monitoringHints === false) return;
    try {
      const key = `genesis:physis:monitoring-hint:${hintOwner}`;
      const last = Number(localStorage.getItem(key));
      if (!last || Date.now() - last >= 7 * 86400000) {
        const timer = setTimeout(() => { localStorage.setItem(key, String(Date.now())); setHintOpen(true); }, 650);
        return () => clearTimeout(timer);
      }
    } catch { /* Storage unavailable: the optional hint stays closed. */ }
  }, [hintOwner, settings.monitoringHints]);
  const hint = hintOpen && settings.monitoringHints !== false ? <aside className="physis-monitoring-hint" role="status"><h3>Больше показателей</h3><p>В настройках Фюзиса можно включить давление, сахар и другие показатели. История сохраняется и после отключения.</p><div className="physis-actions"><button type="button" onClick={() => setHintOpen(false)}>Понятно</button><button type="button" onClick={() => { setHintOpen(false); onDisableHints?.(); }}>Больше не показывать</button></div></aside> : null;
  const [selectedType, setType] = useState<Measurement['type']>((settings.enabledMetrics[0] as Measurement['type']) ?? 'weight');
  const type = settings.enabledMetrics.includes(selectedType) ? selectedType : (settings.enabledMetrics[0] as Measurement['type']) ?? 'weight';
  const [contextFilter, setContextFilter] = useState(''); const [period, setPeriod] = useState('30');
  const [customLabel, setCustomLabel] = useState('');
  const [drafts, setDrafts] = useState<Partial<Record<Measurement['type'], PhysisRecord<Measurement> | null>>>({});
  const draft = drafts[type] ?? null;
  const setDraft = (next: PhysisRecord<Measurement> | null | ((current: PhysisRecord<Measurement> | null) => PhysisRecord<Measurement> | null)) => setDrafts(current => ({ ...current, [type]: typeof next === 'function' ? next(current[type] ?? null) : next }));
  const action = usePhysisAction(); const today = todayCivilDate(context);
  const records = physisRecords<Measurement>(store, 'measurement');
  const history = records.filter(r => r.data.type === type && r.data.day >= addCivilDays(today, 1 - Number(period)) && r.data.day <= today && (!contextFilter || r.data.context === contextFilter) && (type !== 'custom' || !customLabel || r.data.label === customLabel))
    .sort((a, b) => a.data.timestamp.localeCompare(b.data.timestamp));
  const contexts = [...new Set(records.filter(r => r.data.type === type).map(r => r.data.context))];
  const value = (m: Measurement) => m.type === 'glucose' ? convertGlucose(m.value, m.unit, settings.glucoseUnit)
    : m.type === 'weight' && m.unit === 'kg' && settings.weightUnit === 'lb' ? m.value * 2.2046226218
    : m.type === 'weight' && m.unit === 'lb' && settings.weightUnit === 'kg' ? m.value / 2.2046226218 : m.value;
  const unit = (m: Measurement) => m.type === 'glucose' ? settings.glucoseUnit : m.type === 'weight' ? settings.weightUnit : m.unit;
  const newEntry = () => {
    if (draft) return;
    const now = new Date().toISOString(); const metric = METRICS.find(([id]) => id === type)!;
    setDraft(newPhysisRecord<Measurement>('measurement', { type, label: metric[1], value: 0, secondValue: type === 'pressure' ? 0 : null, pulse: null,
      unit: type === 'glucose' ? settings.glucoseUnit : type === 'weight' ? settings.weightUnit : metric[2], timestamp: now, timeZone: settings.timeZone,
      day: momentCivilDate(new Date(now), settings.timeZone), source: 'Вручную', device: '', context: '', intervalMinutes: null, arm: '', position: '', note: '',
      scale: type === 'wellbeing' || type === 'soreness' ? 'subjective' : 'numeric', target: null, editedAt: null }));
  };
  const change = (patch: Partial<Measurement>) => setDraft(record => record ? editPhysisRecord(record, { ...record.data, ...patch }) : record);
  const chartAllowed = history.length > 1 && new Set(history.map(r => `${r.data.type === 'custom' ? r.data.label : r.data.type}:${unit(r.data)}:${r.data.scale}:${r.data.context}`)).size === 1;
  const values = history.map(r => value(r.data)); const lo = Math.min(...values); const hi = Math.max(...values);
  const firstTime = history.length ? Date.parse(history[0].data.timestamp) : 0;
  const span = history.length ? Math.max(1, Date.parse(history.at(-1)!.data.timestamp) - firstTime) : 1;
  const points = history.map(r => `${20 + (Date.parse(r.data.timestamp) - firstTime) / span * 560},${140 - (value(r.data) - lo) / Math.max(1, hi - lo) * 120}`).join(' ');
  if (!settings.enabledMetrics.length) return <section className="physis-panel"><h2>Мониторинг показателей</h2>{hint}<p className="physis-empty">Включите нужные показатели в настройках Фюзиса. Отключение инструмента сохраняет историю.</p></section>;
  return <div className="physis-monitoring-layout">{hint}<nav className="physis-tabs physis-measurement-nav" aria-label={text('Показатели здоровья')}>{METRICS.filter(([id]) => settings.enabledMetrics.includes(id)).map(([id, name]) => <IconActionButton key={id} icon={<MetricIcon type={id} />} label={`${text(name)}. ${text(metricDescriptions[id])}`} aria-current={type === id ? 'page' : undefined} aria-controls="physis-measurement-page" onClick={() => { setType(id); setContextFilter(''); setCustomLabel(''); }} />)}</nav><section id="physis-measurement-page" aria-labelledby="physis-measurement-title" className="physis-panel"><header className="physis-measurement-heading"><div><h2 id="physis-measurement-title">{text(metricName(type))}</h2><p className="physis-muted">{text(metricDescriptions[type])}</p></div><button className="physis-primary" onClick={newEntry}>Записать измерение</button></header><div className="physis-form"><Field label="Период истории"><select value={period} onChange={e => setPeriod(e.target.value)}><option value="7">7 дней</option><option value="30">30 дней</option><option value="90">90 дней</option><option value="365">Год</option></select></Field><Field label="Контекст"><select value={contextFilter} onChange={e => setContextFilter(e.target.value)}><option value="">Все контексты (без общей линии)</option>{contexts.filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></Field></div>
    {type === 'custom' ? <Field label="Свой показатель по названию"><select value={customLabel} onChange={e => setCustomLabel(e.target.value)}><option value="">Все названия — без общей линии</option>{[...new Set(records.filter(r => r.data.type === 'custom').map(r => r.data.label))].map(label => <option key={label}>{label}</option>)}</select></Field> : null}
    {action.error ? <p role="alert" className="physis-warning">{action.error}</p> : null}
    {draft ? <form key={draft.id} className="physis-form" onSubmit={e => { e.preventDefault(); void action.run(async () => { await store.save(editPhysisRecord(draft, { ...draft.data, editedAt: records.some(r => r.id === draft.id) ? new Date().toISOString() : null })); setDraft(current => current === draft ? null : current); }); }}>
      <h3 className="physis-wide">{metricName(draft.data.type)}</h3>
      {draft.data.type === 'custom' ? <Field label="Название показателя"><input required value={draft.data.label} onChange={e => change({ label: e.target.value })} /></Field> : null}
      <NumberField label={draft.data.type === 'pressure' ? 'Систолическое, мм рт. ст.' : 'Значение'} required value={draft.data.value} min={draft.data.type === 'temperature' ? -50 : 0} onChange={v => change({ value: v ?? 0 })} />
      {draft.data.type === 'pressure' ? <><NumberField label="Диастолическое, мм рт. ст." required value={draft.data.secondValue} onChange={secondValue => change({ secondValue })} /><NumberField label="Пульс (необязательно), уд/мин" value={draft.data.pulse} onChange={pulse => change({ pulse })} /><Field label="Рука"><select value={draft.data.arm} onChange={e => change({ arm: e.target.value })}><option value="">Не указана</option><option>Левая</option><option>Правая</option></select></Field><Field label="Положение"><select value={draft.data.position} onChange={e => change({ position: e.target.value })}><option value="">Не указано</option><option>Сидя</option><option>Лёжа</option><option>Стоя</option></select></Field></> : null}
      {draft.data.type === 'glucose' ? <><Field label="Исходная единица"><select value={draft.data.unit} onChange={e => change({ unit: e.target.value })}><option value="mmol/L">ммоль/л</option><option value="mg/dL">мг/дл</option></select></Field><Field label="Контекст сахара"><select value={draft.data.context} onChange={e => change({ context: e.target.value })}><option value="">Не указан</option><option>Натощак</option><option>До еды</option><option>После еды</option></select></Field><NumberField label="Минут после еды" value={draft.data.intervalMinutes} onChange={intervalMinutes => change({ intervalMinutes })} /><Field label="Источник"><select value={draft.data.source} onChange={e => change({ source: e.target.value })}><option>Вручную</option><option>Глюкометр</option><option>Лаборатория</option><option>CGM</option></select></Field></> : <><Field label="Единица">{draft.data.type === 'custom' ? <input required value={draft.data.unit} onChange={e => change({ unit: e.target.value })} /> : <select value={draft.data.unit} onChange={e => change({ unit: e.target.value })}>{measurementUnits(draft.data.type).map(unit => <option key={unit}>{unit}</option>)}</select>}</Field><Field label="Контекст"><input value={draft.data.context} onChange={e => change({ context: e.target.value })} placeholder="Например, после пробуждения" /></Field><Field label="Источник"><input value={draft.data.source} onChange={e => change({ source: e.target.value })} /></Field></>}
      <PhysisMomentFields value={draft.data.timestamp} fallbackDay={draft.data.day} timeZone={draft.data.timeZone} context={context} calendarMode={settings.inputCalendarMode} dayLabel="День измерения" timeLabel="Время измерения" onChange={(timestamp, day) => change({ timestamp, day })} />
      <Field label="Устройство"><input value={draft.data.device} onChange={e => change({ device: e.target.value })} /></Field><Field label="Заметка"><textarea value={draft.data.note} onChange={e => change({ note: e.target.value })} /></Field>
      {draft.data.type === 'custom' ? <Field label="Тип шкалы"><select value={draft.data.scale} onChange={e => change({ scale: e.target.value as Measurement['scale'] })}><option value="numeric">Числовая</option><option value="subjective">Субъективная</option></select></Field> : null}
      <div className="physis-wide"><label className="physis-check"><input type="checkbox" checked={draft.data.target !== null} onChange={e => change({ target: e.target.checked ? { min: 0, max: 0, source: '' } : null })} />Указать личный целевой диапазон</label>{draft.data.target ? <div className="physis-form"><NumberField label="Нижняя граница" value={draft.data.target.min} onChange={v => change({ target: { ...draft.data.target!, min: v ?? 0 } })} /><NumberField label="Верхняя граница" value={draft.data.target.max} onChange={v => change({ target: { ...draft.data.target!, max: v ?? 0 } })} /><Field label="Источник диапазона"><input required value={draft.data.target.source} onChange={e => change({ target: { ...draft.data.target!, source: e.target.value } })} /></Field></div> : null}</div>
      <div className="physis-actions"><button className="physis-primary" disabled={action.busy}>Сохранить измерение</button><button type="button" onClick={() => setDraft(null)}>Отмена</button></div>
    </form> : null}
    {!history.length ? <p className="physis-empty">За этот период измерений нет. Добавьте первое.</p> : <>
      {chartAllowed ? <figure><figcaption>{metricName(type)} · {history.length} отдельных измерений · {unit(history[0].data)} · {history[0].data.context || 'Контекст не указан'}</figcaption><svg className="physis-chart" viewBox="0 0 600 160" role="img" aria-label={`График ${metricName(type)}: от ${lo.toFixed(2)} до ${hi.toFixed(2)}. Точные значения в таблице ниже.`}><polyline points={points} /></svg></figure> : <p className="physis-muted">Выберите один контекст и совместимые единицы для графика. Разные контексты не объединяются.</p>}
      <div className="physis-table-wrap"><table><caption>История измерений — каждое измерение отдельно</caption><thead><tr><th>Дата</th><th>Значение</th><th>Контекст и источник</th><th>Действия</th></tr></thead><tbody>{[...history].reverse().map(r => <tr key={r.id}><td>{formatCalendarDateValue(r.data.day, settings.calendarMode, false, context)}<br />{new Date(r.data.timestamp).toLocaleTimeString('ru', { timeZone: r.data.timeZone, hour: '2-digit', minute: '2-digit' })}{r.data.editedAt ? ' · Исправлено' : ''}</td><td>{value(r.data).toLocaleString('ru', { maximumFractionDigits: 2 })}{r.data.type === 'pressure' ? ` / ${r.data.secondValue}` : ''} {unit(r.data)}{r.data.pulse !== null ? ` · пульс ${r.data.pulse}` : ''}{r.data.unit !== unit(r.data) ? <small> (исходно {r.data.value} {r.data.unit})</small> : null}</td><td>{r.data.context || 'Не указан'} {r.data.intervalMinutes !== null ? ` · ${r.data.intervalMinutes} мин` : ''}<br />{r.data.source} · {r.data.device}{r.data.target ? <p>Личный диапазон: {r.data.target.min}–{r.data.target.max} {r.data.unit}, источник: {r.data.target.source}</p> : null}</td><td><button onClick={() => setDraft(structuredClone(r))}>Изменить</button><button onClick={() => { if (confirm('Удалить измерение?')) void action.run(() => store.remove(r.id)); }}>Удалить</button></td></tr>)}</tbody></table></div></>}
    <details className="physis-measurement-help"><summary>Об измерениях</summary><p className="physis-muted">Фюзис не измеряет показатели браузером и не ставит диагнозы. Перевод глюкозы использует коэффициент 18,0182 мг/дл на ммоль/л; исходное значение сохраняется.</p></details>
  </section></div>;
}
