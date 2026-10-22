"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { CalendarMode } from "./calendar-data";
import { getRuntimeLanguage } from "./i18n";
import { habitLifecycleState } from "./habit-lifecycle";
import { getStoicheionLetters } from "./stoicheion-data";
import { isHabitScheduledForDate, updateHabitCompletion, type Habit, type HabitWorkspace } from "./habits";
import { markTrackerEntityChanged } from "./tracker-core";
import { RESTORATION_AUXILIARIES, RESTORATION_SECTORS } from "./stoicheion-restoration-data";
import { restorationCopy, restorationLocal } from "./stoicheion-restoration-copy";
import { restorationCompletionDates, RESTORATION_POSITION_IDS, RESTORATION_STAGES, type RestorationDrawCard } from "./stoicheion-restoration-state";
import { restorationPlanEquation, restorationPreparedCount, restorationSourceKey, reversedSectors, snapshotMatchesSource, validateRestorationStrategy,
  type RestorationSource, type RestorationStrategy } from "./stoicheion-restoration-strategy";
import { useSharedWorkDrafts } from "./use-shared-work-drafts";
import type { WorkDraft } from "./shared-work-draft-journal";
import { RestorationStrategyDialog, RESTORATION_DRAFT_SCOPE } from "./StoicheionRestorationDialog";
import { StoicheionActionButton } from "./StoicheionActionButton";
import { ExperimentalIcon } from "./ExperimentalIcon";
import "./stoicheion-restoration.css";

export type RestorationPrimaryState = "preparing" | "begin" | "resume" | "view";
export type RestorationHandle = { activate: (sectorId?: string | null) => void };
type Props = {
  cards: RestorationDrawCard[]; sourceDate: string; sourceSeed: number | null; today: string;
  workspace: HabitWorkspace; calendarMode: CalendarMode; userId?: string;
  onChange: (workspace: HabitWorkspace) => void | Promise<void>; onOpenHabits?: () => void;
  onPrimaryStateChange?: (state: RestorationPrimaryState) => void;
};

function scrollToResult(id: string) {
  requestAnimationFrame(() => {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  });
}

export const StoicheionRestoration = forwardRef<RestorationHandle, Props>(function StoicheionRestoration({
  cards, sourceDate, sourceSeed, today, workspace, calendarMode, userId = "", onChange, onOpenHabits, onPrimaryStateChange,
}, ref) {
  const language = getRuntimeLanguage();
  const t = restorationCopy(language);
  const local = (value: {ru: string; en: string}) => restorationLocal(value, language);
  const currentSource: RestorationSource | null = cards.length === 9 && sourceSeed !== null ? { cards, sourceDate, sourceSeed } : null;
  const journal = useSharedWorkDrafts(userId || "anonymous", RESTORATION_DRAFT_SCOPE, "stoicheion-restoration", true, validateRestorationStrategy);
  const hydrated = journal.loaded;
  const [memory, setMemory] = useState<Record<string, RestorationStrategy>>({});
  const [staged, setStaged] = useState<Record<string, WorkDraft<RestorationStrategy>>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<WorkDraft<RestorationStrategy> | null>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const cycles = workspace.habits.filter(habit => habit.stoicheionRestoration && habitLifecycleState(habit).status !== "deleted");
  const snapshots = cycles.map(habit => habit.stoicheionRestoration!);
  const groups = [...new Set(snapshots.map(restorationSourceKey))].map(key => ({ key, habits: cycles.filter(habit => restorationSourceKey(habit.stoicheionRestoration!) === key) }));
  const { refresh } = journal;
  const records = useMemo(() => {
    const bySource = new Map<string, WorkDraft<RestorationStrategy>>();
    for (const row of [...journal.rows, ...Object.values(staged)].sort((a,b) => b.at.localeCompare(a.at))) {
      const key = restorationSourceKey(row.value);
      if (!bySource.has(key)) bySource.set(key, row);
    }
    return bySource;
  }, [journal.rows, staged]);
  const currentKey = currentSource ? restorationSourceKey(currentSource) : "";
  const currentDraft = memory[currentKey] ?? records.get(currentKey)?.value;
  const currentSaved = currentSource ? reversedSectors(currentSource).every(id => snapshots.some(snapshot => snapshot.sectorId === id && snapshotMatchesSource(snapshot, currentSource))) : false;
  const primary: RestorationPrimaryState = !hydrated ? "preparing" : currentSaved && currentSource && reversedSectors(currentSource).length ? "view"
    : currentDraft || currentSource && snapshots.some(snapshot => snapshotMatchesSource(snapshot, currentSource)) ? "resume" : "begin";
  useEffect(() => onPrimaryStateChange?.(primary), [onPrimaryStateChange, primary]);

  function activateSource(source: RestorationSource, sectorId?: string | null) {
    if (!reversedSectors(source).length) { scrollToResult("stoicheion-restoration"); return; }
    const key = restorationSourceKey(source);
    const saved = snapshots.filter(snapshot => snapshotMatchesSource(snapshot, source));
    if (reversedSectors(source).every(id => saved.some(snapshot => snapshot.sectorId === id))) {
      const habit = cycles.find(habit => snapshotMatchesSource(habit.stoicheionRestoration!, source) && (!sectorId || habit.stoicheionRestoration!.sectorId === sectorId));
      if (habit) scrollToResult(`restoration-cycle-${habit.id}`);
      return;
    }
    let draft = memory[key] ?? records.get(key)?.value;
    if (!draft) {
      const ids = reversedSectors(source);
      draft = { version: 1, ...source, activeSectorId: ids[0], plans: Object.fromEntries(ids.map(id => {
        const guidance = RESTORATION_SECTORS.find(item => item.id === id)!.needs.conflict;
        return [id, { need: "conflict", supportIds: [guidance.supportId], resourceLetterId: "", intention: local(guidance.intention), linkedHabitId: "", step: 0, prepared: false, touched: false }];
      })) };
    }
    if (sectorId && reversedSectors(source).includes(sectorId)) draft = { ...draft, activeSectorId: sectorId };
    setMemory(previous => ({ ...previous, [key]: draft }));
    setRecovered(records.get(key) ?? null); setEditingKey(key); setOpen(true); setNotice("");
  }
  useImperativeHandle(ref, () => ({ activate: sectorId => { if (hydrated && currentSource) activateSource(currentSource, sectorId); } }));
  const onStaged = (record: WorkDraft<RestorationStrategy>) => setStaged(previous => ({ ...previous, [record.id]: record }));
  const unfinished = [...new Set([...records.keys(), ...Object.keys(memory)])].map(key => memory[key] ?? records.get(key)!.value)
    .filter(draft => !reversedSectors(draft).every(id => snapshots.some(snapshot => snapshot.sectorId === id && snapshotMatchesSource(snapshot, draft))));

  return <>
    <section id="stoicheion-restoration" className="restoration restoration-results" aria-labelledby="restoration-title" tabIndex={-1} data-no-translate>
      <header className="restoration-heading"><div><h2 id="restoration-title">{t.title}</h2><p>{cycles.length ? t.resultsIntro : t.intro}</p></div>
        {currentSource && !currentSaved ? <StoicheionActionButton icon="restoration" className="primary-button" disabled={!hydrated} onClick={() => activateSource(currentSource)}>{t[primary]}</StoicheionActionButton> : null}</header>
      {currentSource && cards.every(card => !card.reversed) ? <p>{t.allUpright}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {groups.map(group => <section className="restoration-saved-group" key={group.key} aria-label={`${t.strategy} · ${group.habits[0].stoicheionRestoration!.sourceDate}`}>
        <header><h3>{t.strategy}</h3><span>{group.habits[0].stoicheionRestoration!.sourceDate} · {t.cards}: {group.habits.length}</span></header>
        {group.habits.map(habit => <RestorationCycle key={habit.id} habit={habit} workspace={workspace} calendarMode={calendarMode} today={today} onChange={onChange} />)}
      </section>)}
      {unfinished.length ? <details className="restoration-history"><summary>{t.drafts} · {unfinished.length}</summary><div>{unfinished.map(draft => <button type="button" className="secondary-button" key={restorationSourceKey(draft)} onClick={() => activateSource(draft)}>
        <ExperimentalIcon name="stoicheion" /><span>{draft.sourceDate}<small>{t.cardsReady}: {restorationPreparedCount(draft, snapshots)} {t.countOf} {reversedSectors(draft).length}</small></span><ExperimentalIcon name="chevron" />
      </button>)}</div></details> : null}
      {!workspace.habitSettings.enabled ? <p className="restoration-note">{t.disabled}</p> : null}
      {onOpenHabits && cycles.length ? <button type="button" className="secondary-button" onClick={onOpenHabits}><ExperimentalIcon name="habits" />{t.openHabits}</button> : null}
    </section>
    {editingKey && memory[editingKey] ? <RestorationStrategyDialog key={`${userId}:${editingKey}`} userId={userId} open={open} draft={memory[editingKey]} recovered={recovered}
      workspace={workspace} calendarMode={calendarMode} today={today} onChange={onChange} onClose={() => setOpen(false)}
      onDraftChange={draft => setMemory(previous => ({ ...previous, [editingKey]: draft }))} onStaged={onStaged}
      onSaved={cleanupError => {
        setOpen(false); setEditingKey(null); setMemory(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== editingKey)));
        setStaged(previous => Object.fromEntries(Object.entries(previous).filter(([,row]) => restorationSourceKey(row.value) !== editingKey)));
        setNotice(cleanupError ? `${t.strategySaved}. ${t.draftError}` : t.strategySaved); void refresh(); scrollToResult("stoicheion-restoration");
      }} /> : null}
  </>;
});

function RestorationCycle({ habit, workspace, calendarMode, today, onChange }: {habit: Habit; workspace: HabitWorkspace; calendarMode: CalendarMode; today: string; onChange: (next: HabitWorkspace) => void | Promise<void>}) {
  const language = getRuntimeLanguage();
  const t = restorationCopy(language);
  const local = (value: {ru: string; en: string}) => restorationLocal(value, language);
  const snapshot = habit.stoicheionRestoration!;
  const letters = getStoicheionLetters(language);
  const letter = letters.find(item => item.id === snapshot.letterId)!;
  const sector = RESTORATION_SECTORS.find(item => item.id === snapshot.sectorId)!;
  const resource = letters.find(item => item.id === snapshot.resourceLetterId)!;
  const progress = restorationCompletionDates(snapshot, habit.id, workspace.habitCompletions, today);
  const todayEntry = workspace.habitCompletions.some(entry => entry.habitId === habit.id && entry.date === today && entry.completed);
  const scheduled = isHabitScheduledForDate(habit, today, calendarMode) && habitLifecycleState(habit).status === "active";
  const enabled = workspace.habitSettings.enabled;
  const [reflection, setReflection] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const equation = restorationPlanEquation(snapshot, snapshot.sectorId, { ...snapshot, linkedHabitId: "", prepared: true, touched: true, step: 3 });
  async function commit(next: HabitWorkspace) {
    setSaving(true);
    try { await onChange(next); setError(""); return true; } catch { setError(t.error); return false; }
    finally { setSaving(false); }
  }
  return <article id={`restoration-cycle-${habit.id}`} className="restoration-cycle" tabIndex={-1}>
    <header className="restoration-cycle-heading"><span className="restoration-letter-mark" aria-hidden="true">{letter.symbol}</span><div><h3>{letter.name} · {local(sector.title)}</h3><p>{snapshot.intention}</p></div>
      <span className="restoration-status"><ExperimentalIcon name="check" />{t.strategyReady}</span></header>
    <div className="restoration-columns"><div className="restoration-main">
      <h4>{t.contemplation}</h4>{snapshot.practiceText.split("\n\n").map((paragraph,index) => <p key={index}>{paragraph}</p>)}
      <h4>{t.action}</h4>{snapshot.action.split("\n\n").map((paragraph,index) => <p key={index}>{paragraph}</p>)}
      <details className="restoration-source"><summary>{t.showDetails}</summary>
        <p>{t.need} · {t[snapshot.need]}</p>
        <h4>{local(sector.myth.title)}</h4><p>{local(sector.myth.body)}</p><a href={sector.myth.url} target="_blank" rel="noreferrer">{t.source} · {sector.myth.source}</a><p className="restoration-note">{t.interpretation}</p>
        <p className="restoration-formula">{t.formula}</p><p>{snapshot.spreadTotal} → {snapshot.pythmen} · {letter.value} + {resource.value} + {equation.supportTotal} = {letter.value + resource.value + equation.supportTotal} → {snapshot.pythmen}</p>
        <h4>{t.supports}</h4><ul>{equation.supports.map(support => <li key={support.id}>{local(RESTORATION_AUXILIARIES.find(item => item.id === support.id)!.title)} · <span lang="grc">{support.word}</span> · {support.value}</li>)}</ul>
        <p>{t.snapshot} · {snapshot.sourceDate}</p><ol>{snapshot.cards.map((card,index) => <li key={index}>{local(RESTORATION_SECTORS.find(item => item.id === RESTORATION_POSITION_IDS[index])!.title)} · {letters.find(item => item.id === card.letterId)?.name} · {card.reversed ? "↓" : "↑"}</li>)}</ol>
      </details>
      <label className="restoration-field"><span>{t.reflection}</span><textarea rows={3} disabled={saving} maxLength={2000} value={reflection ?? snapshot.reflection} onChange={event => { setReflection(event.target.value); setNotice(""); }} /></label>
      <button type="button" className="secondary-button" disabled={saving || !enabled || reflection === null || reflection.trim() === snapshot.reflection} onClick={async () => {
        const updated = markTrackerEntityChanged({ ...habit, stoicheionRestoration: { ...snapshot, reflection: reflection!.trim() } });
        if (await commit({ ...workspace, habits: workspace.habits.map(item => item.id === habit.id ? updated : item) })) { setNotice(t.saved); setReflection(null); }
      }}><ExperimentalIcon name="save" />{t.saveReflection}</button>
      {notice ? <p role="status">{notice}</p> : null}{error ? <p className="restoration-error" role="alert">{error}</p> : null}
    </div><aside className="restoration-tetractys" aria-label={t.practiceProgress}>
      <h4>{progress.length === 10 ? t.completed : t.practiceProgress}</h4><p className="restoration-progress" aria-live="polite">{progress.length} / 10</p>
      <div className="restoration-triangle" aria-hidden="true">{RESTORATION_STAGES.map((stage,row) => <div key={stage.id}>{Array.from({length:stage.count},(_,index) => <i key={index} className={progress.length > row*(row+1)/2+index ? "is-complete" : undefined} />)}</div>)}</div>
      <p>{t.tetractys}</p><ol>{RESTORATION_STAGES.map(stage => <li key={stage.id}>{stage.count} · {t[stage.id]}</li>)}</ol><p className="restoration-note">{t.cycleHelp}</p>
      {progress.length < 10 ? <button type="button" className="primary-button" disabled={saving || !enabled || !scheduled || todayEntry} onClick={() => {
        try { void commit(updateHabitCompletion(workspace, habit, today, { completed: true }, today)); } catch { setError(t.error); }
      }}><ExperimentalIcon name="check" />{todayEntry ? t.doneToday : t.completeToday}</button> : null}
      {!scheduled && progress.length < 10 ? <p className="restoration-note">{t.notScheduled}</p> : null}
      {todayEntry && !progress.includes(today) ? <p className="restoration-note">{t.todayEarlier}</p> : null}
    </aside></div>
  </article>;
}
