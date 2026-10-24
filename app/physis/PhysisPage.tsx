"use client";
import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LOCAL_SESSION_ENDED_EVENT, captureAccountSessionGuard, physisRequest } from '../cloud-sync';
import { calendarContext, todayCivilDate } from '../calendar-context';
import type { CalendarMode } from '../calendar-data';
import { NavigationIcon } from '../NavigationIcon';
import { createPhysisVault, changePhysisPassword, unlockPhysisVault, validateVault, type PhysisVault } from './crypto';
import { PhysisMemoryStore } from './store';
import { editPhysisRecord, newPhysisRecord, physisRecords, type PhysisFeatureProps, type PhysisSettings } from './types';
import { METRICS, pendingIntakeEvents, type Intake, type Regimen } from './care-domain';
import { PhysisDrugCatalog, PhysisIntakes } from './care';
import { PhysisMeasurements } from './measurements';
import { PhysisTraining, PhysisTrainingSummary } from './training';
import { PhysisNutrition, PhysisNutritionSummary } from './nutrition';
import { PhysisExchange, downloadPhysis } from './exchange';
import { Field, NumberField, usePhysisAction } from './fields';
import './physis.css';

type PageName = 'overview' | 'control' | 'exercises' | 'diary' | 'foods' | 'intakes' | 'drugs' | 'settings';
type VaultState = { vault: PhysisVault | null; revision: number };
type KeyState = { key: CryptoKey; model: PhysisMemoryStore };
type Candidate = Awaited<ReturnType<typeof createPhysisVault>> & { requestId: string };
type Props = { owner: string; language: string; calendarMode: CalendarMode; inputCalendarMode: CalendarMode; timeZone: string; settingsRequest?: number };
const GROUPS: { title: string; pages: [PageName, string][] }[] = [
  { title: 'Тренировки', pages: [['control', 'Контроль выполнения'], ['exercises', 'Справочник упражнений']] },
  { title: 'Питание', pages: [['diary', 'Рацион'], ['foods', 'Список продуктов']] },
  { title: 'БАДы и лекарства', pages: [['intakes', 'Контроль приема'], ['drugs', 'Справочник']] },
];
export const defaultPhysisSettings = (props: Pick<Props, 'calendarMode' | 'inputCalendarMode' | 'timeZone'>): PhysisSettings => ({
  calendarMode: props.calendarMode, inputCalendarMode: props.inputCalendarMode, timeZone: props.timeZone,
  weightUnit: 'kg', distanceUnit: 'km', energyUnit: 'kcal', glucoseUnit: 'mmol/L', restSeconds: 90, reminders: true,
  foodRules: ['soy', 'legumes', 'seed-oils'], enabledMetrics: [], overviewBlocks: ['workout', 'nutrition', 'intakes', 'measurements'],
});
export function PhysisPage(props: Props) {
  const [vaultState, setVaultState] = useState<VaultState | null>(null); const [keys, setKeys] = useState<KeyState | null>(null);
  const [method, setMethod] = useState<'password' | 'recovery'>('password'); const [secret, setSecret] = useState('');
  const [candidate, setCandidate] = useState<Candidate | null>(null); const [recoverySaved, setRecoverySaved] = useState(false);
  const action = usePhysisAction(); const keyRef = useRef<KeyState | null>(null); const generation = useRef(0);
  const lock = useCallback((force = false) => {
    if (!force && (keyRef.current?.model.hasPending || keyRef.current?.model.rotationPending) && !confirm('Есть несохранённые изменения или неподтвержденная смена ключа. Заблокировать раздел и потерять несохранённое?')) return;
    generation.current++; keyRef.current?.model.destroy(); keyRef.current = null; setKeys(null); setSecret(''); setCandidate(null); setRecoverySaved(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const lifecycle = generation;
    void physisRequest<VaultState>('/vault', { signal: controller.signal }).then(result => {
      if (result.vault) validateVault(result.vault);
      if (!controller.signal.aborted) setVaultState(result);
    }).catch(error => { if (!controller.signal.aborted) action.setError(error instanceof Error ? error.message : 'Не удалось загрузить хранилище.'); });
    const end = () => lock(true);
    window.addEventListener(LOCAL_SESSION_ENDED_EVENT, end);
    return () => { controller.abort(); lifecycle.current++; keyRef.current?.model.destroy(); keyRef.current = null; window.removeEventListener(LOCAL_SESSION_ENDED_EVENT, end); };
    // Account-keyed parent remounts this boundary on every owner change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.owner, lock]);
  const enter = async (key: CryptoKey, vault: PhysisVault) => {
    const check = captureAccountSessionGuard(); const epoch = generation.current;
    const model = new PhysisMemoryStore(props.owner, key, vault.keyVersion);
    try { await model.reload(); check(); if (epoch !== generation.current) throw new Error('PHYSIS_LOCKED'); }
    catch (error) { model.destroy(); throw error; }
    keyRef.current?.model.destroy(); keyRef.current = { key, model }; setKeys({ key, model }); setSecret(''); setCandidate(null); setRecoverySaved(false);
  };
  return <div className="physis" data-physis-private="true"><header className="physis-header"><div className="physis-row"><NavigationIcon name="physis" /><h1>Фюзис</h1></div>{keys ? <button onClick={() => lock()}>Заблокировать</button> : null}</header>
    {!keys ? <section className="physis-panel physis-lock"><h2>{vaultState?.vault ? 'Разблокировать Фюзис' : 'Личное пространство Фюзиса'}</h2><p>Тренировки, дневник питания, приемы и измерения защищены отдельным ключом. Вход Google подтверждает аккаунт, а пароль Фюзиса открывает ваши данные.</p>
      {!vaultState ? <p role="status">Загружаем защищённое хранилище…</p> : candidate ? <><h3>Сохраните код восстановления</h3><p>Он понадобится на новом устройстве или при потере пароля. Сервер не может восстановить ключ. Сохраните код отдельно от зашифрованной копии данных.</p><code className="physis-recovery">{candidate.recovery}</code><label className="physis-check"><input type="checkbox" checked={recoverySaved} onChange={e => setRecoverySaved(e.target.checked)} />Я сохранил код восстановления</label><div className="physis-actions"><button className="physis-primary" disabled={!recoverySaved || action.busy} onClick={() => void action.run(async () => {
        const result = await physisRequest<{ revision: number }>('/vault', { method: 'PUT', body: JSON.stringify({ requestId: candidate.requestId, expectedRevision: 0, vault: candidate.vault }) });
        setVaultState({ vault: candidate.vault, revision: result.revision }); await enter(candidate.key, candidate.vault);
      })}>Создать защищённое пространство</button><button disabled={action.busy} onClick={() => { setCandidate(null); setRecoverySaved(false); }}>Отмена</button></div></> : <form className="physis-form" onSubmit={e => { e.preventDefault(); void action.run(async () => {
        if (vaultState.vault) {
          const latest = await physisRequest<VaultState>('/vault');
          if (!latest.vault) throw new Error('PHYSIS_VAULT_UNAVAILABLE');
          setVaultState(latest); await enter(await unlockPhysisVault(props.owner, latest.vault, secret, method), latest.vault);
        }
        else { const created = await createPhysisVault(props.owner, secret); setCandidate({ ...created, requestId: crypto.randomUUID() }); setSecret(''); }
      }); }}>
        {vaultState.vault ? <div className="physis-tabs"><button type="button" aria-pressed={method === 'password'} onClick={() => { setMethod('password'); setSecret(''); }}>Пароль</button><button type="button" aria-pressed={method === 'recovery'} onClick={() => { setMethod('recovery'); setSecret(''); }}>Код восстановления</button></div> : null}
        <Field label={method === 'recovery' ? 'Код восстановления PHY1-…' : vaultState.vault ? 'Пароль Фюзиса' : 'Создайте пароль Фюзиса — минимум 12 символов'}><input type="password" required minLength={!vaultState.vault ? 12 : undefined} maxLength={1024} autoComplete={vaultState.vault ? 'current-password' : 'new-password'} value={secret} onChange={e => setSecret(e.target.value)} /></Field>
        <button className="physis-primary" disabled={action.busy}>{action.busy ? 'Открываем…' : vaultState.vault ? 'Разблокировать' : 'Создать ключ'}</button>
      </form>}
      {action.error ? <p role="alert" className="physis-warning">{action.error}</p> : null}<p className="physis-muted">Ключ и расшифрованные данные находятся только в памяти этой вкладки. После закрытия потребуется разблокирование. Ошибка пароля не меняет сохранённые данные.</p>
    </section> : <UnlockedPhysis {...props} keys={keys} vaultState={vaultState!} onVault={setVaultState} onReplaceKeys={enter} />}
  </div>;
}

function UnlockedPhysis(props: Props & { keys: KeyState; vaultState: VaultState; onVault: (value: VaultState) => void; onReplaceKeys: (key: CryptoKey, vault: PhysisVault) => Promise<void> }) {
  const { keys: { model, key }, vaultState } = props;
  const store = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const [page, setPage] = useState<PageName>(props.settingsRequest ? 'settings' : 'overview');
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [now, setNow] = useState(() => Date.now()); const action = usePhysisAction();
  const settingsRecord = physisRecords<PhysisSettings>(store, 'settings')[0];
  const settings = settingsRecord?.data ?? defaultPhysisSettings(props); const context = calendarContext({ timeZone: settings.timeZone });
  const feature: PhysisFeatureProps = { store, settings, context, language: props.language };
  useEffect(() => {
    if (!props.settingsRequest) return;
    const frame = requestAnimationFrame(() => setPage('settings')); return () => cancelAnimationFrame(frame);
  }, [props.settingsRequest]);
  useEffect(() => {
    const retry = () => { if (model.hasPending) void model.flush().catch(() => undefined); };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (model.hasPending || model.rotationPending) { event.preventDefault(); event.returnValue = ''; } };
    const timer = setInterval(() => { setNow(Date.now()); if (navigator.onLine) retry(); }, 15000);
    window.addEventListener('online', retry); window.addEventListener('beforeunload', beforeUnload);
    return () => { clearInterval(timer); window.removeEventListener('online', retry); window.removeEventListener('beforeunload', beforeUnload); };
  }, [model]);
  const today = todayCivilDate(context);
  const due = settings.reminders ? pendingIntakeEvents(physisRecords<Regimen>(store, 'regimen'), physisRecords<Intake>(store, 'intake'), today, true).filter(event => Date.parse(event.dueAt) <= now).length : 0;
  const exportEncrypted = async () => {
    const records = await model.exportWire();
    downloadPhysis('physis-encrypted.json', JSON.stringify({ format: 'physis-encrypted', version: 1, owner: props.owner, exportedAt: new Date().toISOString(), vault: vaultState.vault, records }));
  };
  return <>
    <div className="physis-header"><div className="physis-tabs"><button aria-pressed={page === 'overview'} onClick={() => setPage('overview')}>Обзор</button><button aria-pressed={page === 'settings'} onClick={() => setPage('settings')}>Настройки Фюзиса</button></div><p className="physis-status" role="status" aria-live="polite">{({ saved: 'Сохранено', saving: 'Сохраняется…', offline: 'Не сохранено — нет связи', conflict: 'Конфликт устройств', error: 'Не сохранено — ошибка' })[store.status]}</p></div>
    {store.error ? <div role="alert" className="physis-warning"><p>{store.error}</p><div className="physis-actions"><button onClick={() => void action.run(() => model.flush())}>Повторить сохранение</button><button onClick={() => { if (confirm('Открытый файл содержит личные данные. Экспортировать локальный вариант?')) downloadPhysis('physis-unsaved.json', JSON.stringify({ format: 'physis-plain', version: 1, records: store.records })); }}>Экспортировать локальный вариант</button><button onClick={() => { if (confirm('Отменить все несохранённые изменения этой вкладки и загрузить серверный вариант?')) void action.run(async () => { await model.discardAndReload(); setEditorEpoch(value => value + 1); }); }}>Загрузить серверный вариант</button></div></div> : null}
    {action.error ? <p role="alert" className="physis-warning">{action.error}</p> : null}
    {due > 0 ? <div className="physis-warning" role="status">Есть запланированные приемы без отметки: {due}. <button onClick={() => setPage('intakes')}>Открыть контроль приема</button></div> : null}
    <nav className="physis-main-nav" aria-label="Подразделы Фюзиса">{GROUPS.map(group => <div key={group.title}><h2>{group.title}</h2><div className="physis-tabs">{group.pages.map(([id, name]) => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>{name}</button>)}</div></div>)}</nav>
    <Fragment key={editorEpoch}>
    {page === 'overview' ? <><PhysisTrainingSummary {...feature} />{settings.overviewBlocks.includes('nutrition') ? <PhysisNutritionSummary {...feature} /> : null}{settings.overviewBlocks.includes('intakes') ? <PhysisIntakes {...feature} owner={props.owner} compact /> : null}{settings.overviewBlocks.includes('measurements') ? <PhysisMeasurements key={settings.enabledMetrics.join(':')} {...feature} /> : null}</> : null}
    {page === 'control' || page === 'exercises' ? <PhysisTraining {...feature} page={page} /> : null}
    {page === 'diary' || page === 'foods' ? <PhysisNutrition {...feature} page={page} /> : null}
    {page === 'drugs' ? <PhysisDrugCatalog {...feature} /> : null}
    {page === 'intakes' ? <PhysisIntakes {...feature} owner={props.owner} /> : null}
    <div hidden={page !== 'settings'}><PhysisSettingsForm {...feature} /><PhysisNutrition {...feature} page="settings" /><section className="physis-panel"><h2>Ключи, приватность и перенос данных</h2><p>Ключ Фюзиса не передаётся серверу. Сервер хранит ciphertext, технические ID, версии, размеры и времена изменения. Потеря пароля и кода восстановления означает потерю возможности расшифровки.</p><KeySettings owner={props.owner} model={model} dataKey={key} vaultState={vaultState} onVault={props.onVault} onReplaceKeys={props.onReplaceKeys} /><PhysisExchange store={store} exportEncrypted={exportEncrypted} /><p className="physis-muted">Удалённое содержимое убирается из активного хранилища. Журнал удалений и повторных запросов: 90 дней; минимальный реестр использованных ID сохраняется для защиты от восстановления старыми устройствами. Время удаления из резервных копий зависит от политики хранения оператора.</p></section><section className="physis-panel"><h2>Будущие подключения</h2><ul><li>Google Health API — планируется</li><li>Health Connect — планируется через отдельный Android-клиент</li><li>HealthKit — планируется через Apple-клиент</li><li>Garmin и Health Services — планируется</li></ul><p>Ни одно подключение не включено. Сейчас работают ручной учет и импорт/экспорт; данные не отправляются этим поставщикам.</p></section></div>
    </Fragment>
  </>;
}

function PhysisSettingsForm({ store, settings }: PhysisFeatureProps) {
  const [draft, setDraft] = useState(settings); const action = usePhysisAction();
  const change = (patch: Partial<PhysisSettings>) => setDraft(s => ({ ...s, ...patch }));
  const calendarOptions = <><option value="profane">Григорианский</option><option value="sacred">Сакральный</option><option value="lunar">Лунный</option></>;
  return <section className="physis-panel"><h2>Настройки Фюзиса</h2><form className="physis-form" onSubmit={e => { e.preventDefault(); void action.run(async () => {
    const record = physisRecords<PhysisSettings>(store, 'settings')[0]; await store.save(record ? editPhysisRecord(record, draft) : newPhysisRecord('settings', draft));
  }); }}>
    <Field label="Календарь отображения"><select value={draft.calendarMode} onChange={e => change({ calendarMode: e.target.value as CalendarMode })}>{calendarOptions}</select></Field><Field label="Календарь ввода"><select value={draft.inputCalendarMode} onChange={e => change({ inputCalendarMode: e.target.value as CalendarMode })}>{calendarOptions}</select></Field><Field label="Часовой пояс IANA"><input required value={draft.timeZone} onChange={e => change({ timeZone: e.target.value })} /></Field>
    <Field label="Масса"><select value={draft.weightUnit} onChange={e => change({ weightUnit: e.target.value as 'kg' })}><option value="kg">кг</option><option value="lb">фунты</option></select></Field><Field label="Расстояние"><select value={draft.distanceUnit} onChange={e => change({ distanceUnit: e.target.value as 'km' })}><option value="km">км</option><option value="mi">мили</option></select></Field><Field label="Энергия"><select value={draft.energyUnit} onChange={e => change({ energyUnit: e.target.value as 'kcal' })}><option value="kcal">ккал</option><option value="kJ">кДж</option></select></Field><Field label="Глюкоза"><select value={draft.glucoseUnit} onChange={e => change({ glucoseUnit: e.target.value as 'mmol/L' })}><option value="mmol/L">ммоль/л</option><option value="mg/dL">мг/дл</option></select></Field>
    <NumberField label="Отдых между подходами, секунд" min={0} max={3600} value={draft.restSeconds} onChange={v => change({ restSeconds: v ?? 0 })} />
    <div className="physis-wide"><h3>Включенные показатели</h3><p className="physis-muted">Переключатели независимы. Выключение скрывает инструмент и сохраняет всю историю.</p><div className="physis-grid">{METRICS.map(([id, title]) => <label className="physis-check" key={id}><input type="checkbox" checked={draft.enabledMetrics.includes(id)} onChange={e => change({ enabledMetrics: e.target.checked ? [...draft.enabledMetrics, id] : draft.enabledMetrics.filter(k => k !== id) })} />{title}</label>)}</div></div>
    <div className="physis-wide"><h3>Обзор</h3>{[['nutrition', 'Питание'], ['intakes', 'Ближайшие приемы'], ['measurements', 'Показатели']].map(([id, title]) => <label key={id} className="physis-check"><input type="checkbox" checked={draft.overviewBlocks.includes(id)} onChange={e => change({ overviewBlocks: e.target.checked ? [...draft.overviewBlocks, id] : draft.overviewBlocks.filter(k => k !== id) })} />{title}</label>)}</div>
    <label className="physis-check physis-wide"><input type="checkbox" checked={draft.reminders} onChange={e => change({ reminders: e.target.checked })} />Внутренние напоминания о приёмах</label>
    <p className="physis-wide physis-muted">Изменение timezone не переносит прошлые факты. Плановые дни — даты без времени; факты сохраняют момент, timezone и исторический локальный день. Внешние уведомления и offline cache не включены.</p>
    <div className="physis-actions"><button className="physis-primary" disabled={action.busy}>Сохранить настройки</button></div>{action.error ? <p role="alert" className="physis-warning">{action.error}</p> : null}
  </form></section>;
}

function KeySettings({ owner, model, dataKey, vaultState, onVault, onReplaceKeys }: {
  owner: string; model: PhysisMemoryStore; dataKey: CryptoKey; vaultState: VaultState;
  onVault: (state: VaultState) => void; onReplaceKeys: (key: CryptoKey, vault: PhysisVault) => Promise<void>;
}) {
  const [password, setPassword] = useState(''); const [candidate, setCandidate] = useState<Candidate | null>(null); const [accepted, setAccepted] = useState(false);
  const [passwordRequest, setPasswordRequest] = useState<{ vault: PhysisVault; requestId: string; expectedRevision: number } | null>(null);
  const action = usePhysisAction();
  return <><form className="physis-form" onSubmit={e => { e.preventDefault(); void action.run(async () => {
    const request = passwordRequest ?? { vault: await changePhysisPassword(owner, vaultState.vault!, dataKey, password), requestId: crypto.randomUUID(), expectedRevision: vaultState.revision };
    setPasswordRequest(request);
    const response = await physisRequest<{ revision: number }>('/vault', { method: 'PUT', body: JSON.stringify(request) });
    onVault({ vault: request.vault, revision: response.revision }); setPassword(''); setPasswordRequest(null);
  }); }}><Field label="Новый пароль Фюзиса"><input type="password" autoComplete="new-password" required minLength={12} maxLength={1024} disabled={!!passwordRequest} value={password} onChange={e => setPassword(e.target.value)} /></Field><button disabled={action.busy || !!candidate}>{passwordRequest ? 'Повторить сохранение пароля' : 'Сменить пароль'}</button><button type="button" disabled={action.busy || password.length < 12 || !!passwordRequest || !!candidate} onClick={() => void action.run(async () => {
    const next = await createPhysisVault(owner, password, vaultState.vault!.keyVersion + 1); setCandidate({ ...next, requestId: crypto.randomUUID() }); setAccepted(false);
  })}>Заменить ключ и код восстановления</button></form>
    {candidate ? <><p>Сохраните новый код. Все текущие записи будут атомарно зашифрованы новым ключом. Для старой резервной копии по-прежнему нужен её прежний код.</p><code className="physis-recovery">{candidate.recovery}</code><label className="physis-check"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />Новый код сохранён</label><button disabled={!accepted || action.busy} onClick={() => void action.run(async () => {
      const result = await model.rotate(candidate.key, candidate.vault, vaultState.revision);
      onVault({ vault: candidate.vault, revision: result.revision }); await onReplaceKeys(candidate.key, candidate.vault); setCandidate(null); setPassword('');
    })}>Подтвердить / повторить замену ключа</button></> : null}
    {action.error ? <p role="alert" className="physis-warning">{action.error}</p> : null}
  </>;
}
