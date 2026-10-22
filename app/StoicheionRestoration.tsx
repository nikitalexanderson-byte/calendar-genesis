"use client";

import { useRef, useState } from "react";
import type { CalendarMode } from "./calendar-data";
import { getRuntimeLanguage } from "./i18n";
import { habitLifecycleState } from "./habit-lifecycle";
import { getStoicheionLetters } from "./stoicheion-data";
import { SACRED_PRACTICES } from "./sacred-practices";
import { ExperimentalIcon } from "./ExperimentalIcon";
import { isHabitScheduledForDate, updateHabitCompletion, type Habit, type HabitWorkspace } from "./habits";
import { createRestorationHabit, isEligibleRestorationHabit } from "./stoicheion-restoration-habits";
import { markTrackerEntityChanged } from "./tracker-core";
import { RESTORATION_AUXILIARIES, RESTORATION_FRAMEWORK, RESTORATION_LETTER_FOCI, RESTORATION_SECTORS } from "./stoicheion-restoration-data";
import { buildRestorationEquation, restorationTrace, type AuxiliaryId, type RestorationNeed } from "./stoicheion-restoration-math";
import { normalizeRestorationSnapshot, restorationCompletionDates, RESTORATION_POSITION_IDS, RESTORATION_STAGES, type RestorationDrawCard } from "./stoicheion-restoration-state";
import copy from "./stoicheion-restoration-ui.json";
import "./stoicheion-restoration.css";

type Props = {
  cards: RestorationDrawCard[];
  sourceDate: string;
  sourceSeed: number | null;
  today: string;
  workspace: HabitWorkspace;
  calendarMode: CalendarMode;
  onChange: (workspace: HabitWorkspace) => void;
  onOpenHabits?: () => void;
  initialSectorId?: string | null;
  initiallyOpen?: boolean;
};
type CopyKey = keyof typeof copy.en;

export function StoicheionRestoration({ cards, sourceDate, sourceSeed, today, workspace, calendarMode, onChange,
  onOpenHabits, initialSectorId = null, initiallyOpen = false }: Props) {
  const language = getRuntimeLanguage();
  const dictionary = copy[language as keyof typeof copy] ?? copy.en;
  const t = (key: CopyKey) => dictionary[key];
  const local = (text: {ru: string; en: string}) => language === "ru" ? text.ru : text.en;
  const letters = getStoicheionLetters(language);
  const [open, setOpen] = useState(initiallyOpen);
  const [selectedSector, setSelectedSector] = useState<string | null>(initialSectorId);
  const [choosingCard, setChoosingCard] = useState(initialSectorId === null);
  const [need, setNeed] = useState<RestorationNeed>("conflict");
  const firstSector = RESTORATION_SECTORS.find(sector => sector.id === initialSectorId);
  const [supportIds, setSupportIds] = useState<AuxiliaryId[]>(firstSector ? [firstSector.needs.conflict.supportId] : []);
  const [resourceId, setResourceId] = useState("");
  const [step, setStep] = useState(0);
  const [intention, setIntention] = useState(firstSector ? local(firstSector.needs.conflict.intention) : "");
  const [linkedHabitId, setLinkedHabitId] = useState("");
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [reflection, setReflection] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const mainRef = useRef<HTMLDivElement>(null);
  const cycles = workspace.habits.filter(habit => habit.stoicheionRestoration && habitLifecycleState(habit).status !== "deleted");
  const selectedIndex = RESTORATION_POSITION_IDS.findIndex(id => id === selectedSector);
  const card = cards[selectedIndex];
  const letter = card ? letters.find(item => item.id === card.letterId) : null;
  const sector = RESTORATION_SECTORS.find(item => item.id === selectedSector);
  const guidance = sector?.needs[need];
  const spreadTotal = cards.reduce((sum, item) => sum + (letters.find(candidate => candidate.id === item.letterId)?.value ?? 0), 0);
  const equation = letter && spreadTotal > 0 ? buildRestorationEquation(letter.value, spreadTotal, supportIds) : null;
  const resource = equation?.candidates.find(candidate => candidate.id === resourceId);
  const resourceLetter = resource ? letters.find(item => item.id === resource.id) : null;
  const letterPractice = letter ? RESTORATION_LETTER_FOCI[letter.id].needs[need] : null;
  const supportPractices = equation?.supports.flatMap(support => {
    const auxiliary = RESTORATION_AUXILIARIES.find(item => item.id === support.id);
    const practice = SACRED_PRACTICES.find(item => item.id === auxiliary?.practiceId);
    return practice ? [practice] : [];
  }) ?? [];
  const practiceText = guidance && letterPractice ? [local(guidance.practice), local(letterPractice.practice),
    resource && resourceLetter ? `${resourceLetter.symbol} · ${resourceLetter.name}: ${local(RESTORATION_LETTER_FOCI[resource.id].quality)}` : ""].filter(Boolean).join("\n\n") : "";
  const actionText = guidance && letterPractice ? [local(guidance.action), local(letterPractice.action),
    ...supportPractices.map(practice => `${local(practice.title)}: ${local(practice.description)}`)].join("\n\n") : "";
  const currentCycleId = sourceSeed !== null && letter && sector ? `${sourceDate}:${sourceSeed}:${sector.id}:${letter.id}` : null;
  const existing = selectedHabitId ? cycles.find(habit => habit.id === selectedHabitId)
    : cycles.find(habit => habit.stoicheionRestoration!.cycleId === currentCycleId);
  const snapshot = existing?.stoicheionRestoration;
  const progress = snapshot && existing ? restorationCompletionDates(snapshot, existing.id, workspace.habitCompletions, today) : [];
  const todayEntry = existing ? workspace.habitCompletions.find(entry => entry.habitId === existing.id && entry.date === today && entry.completed) : null;
  const scheduled = existing ? isHabitScheduledForDate(existing, today, calendarMode) : false;
  const enabled = workspace.habitSettings.enabled;

  function commit(next: HabitWorkspace) {
    try { onChange(next); setError(""); return true; }
    catch { setError(t("error")); return false; }
  }
  function chooseSector(id: string) {
    const nextSector = RESTORATION_SECTORS.find(item => item.id === id)!;
    setSelectedSector(id); setSelectedHabitId(null); setChoosingCard(false); setStep(0); setResourceId(""); setLinkedHabitId("");
    setSupportIds([nextSector.needs[need].supportId]); setIntention(local(nextSector.needs[need].intention));
    setOpen(true); setReflection(null); setNotice(""); setError("");
    requestAnimationFrame(() => mainRef.current?.focus());
  }
  function changeNeed(next: RestorationNeed) {
    setNeed(next); setResourceId("");
    if (sector) { setSupportIds([sector.needs[next].supportId]); setIntention(local(sector.needs[next].intention)); }
  }
  function changeStep(next: number) {
    setStep(next);
    requestAnimationFrame(() => mainRef.current?.focus());
  }
  function startCycle() {
    if (!enabled || !letter || !sector || !guidance || !resource || !equation || sourceSeed === null || !card?.reversed) return;
    const startedAt = new Date().toISOString();
    const metadata = normalizeRestorationSnapshot({
      version: 1, cycleId: currentCycleId, startedAt, startedDate: today, sourceDate, sourceSeed, cards,
      excludeStartDate: Boolean(linkedHabitId && workspace.habitCompletions.some(entry => entry.habitId === linkedHabitId && entry.date === today && entry.completed)),
      sectorId: sector.id, letterId: letter.id, need, supportIds, resourceLetterId: resource.id,
      practiceId: guidance.practiceId, spreadTotal, pythmen: equation.target, intention,
      action: actionText, practiceText, reflection: "",
    });
    if (!metadata) { setError(t("error")); return; }
    const duplicate = cycles.find(habit => habit.stoicheionRestoration!.cycleId === metadata.cycleId);
    if (duplicate) { setSelectedHabitId(duplicate.id); return; }
    let habit: Habit;
    if (linkedHabitId) {
      const previous = workspace.habits.find(item => item.id === linkedHabitId && isEligibleRestorationHabit(item));
      if (!previous) { setError(t("error")); return; }
      habit = markTrackerEntityChanged({ ...previous, stoicheionRestoration: metadata });
    } else {
      const practice = SACRED_PRACTICES.find(item => item.id === guidance.practiceId);
      if (!practice) { setError(t("error")); return; }
      habit = createRestorationHabit(practice, metadata, calendarMode, language, `${t("title")} · ${letter.name}`);
    }
    if (commit({ ...workspace, habits: [...workspace.habits.filter(item => item.id !== habit.id), habit] })) {
      setSelectedHabitId(habit.id); setReflection("");
      requestAnimationFrame(() => mainRef.current?.focus());
    }
  }
  function completeToday() {
    if (!existing || !enabled || !scheduled || todayEntry || progress.length >= 10) return;
    try { commit(updateHabitCompletion(workspace, existing, today, { completed: true }, today)); }
    catch { setError(t("error")); }
  }
  function saveReflection() {
    if (!existing || !snapshot || !enabled || reflection === null) return;
    const updated = markTrackerEntityChanged({ ...existing, stoicheionRestoration: { ...snapshot, reflection: reflection.trim().slice(0, 2000) } });
    if (commit({ ...workspace, habits: workspace.habits.map(item => item.id === updated.id ? updated : item) })) setNotice(t("saved"));
  }
  const archivedCards = snapshot?.cards.map((item, index) => ({...item,sector:RESTORATION_SECTORS.find(candidate => candidate.id === RESTORATION_POSITION_IDS[index])}));

  return <section id="stoicheion-restoration" className="restoration" aria-labelledby="restoration-title" tabIndex={-1} data-no-translate>
    <header className="restoration-heading"><div><h2 id="restoration-title">{t("title")}</h2><p>{t("intro")}</p></div>
      {!open ? <button type="button" className="primary-button" onClick={() => setOpen(true)}><ExperimentalIcon name="stoicheion" />{t("begin")}</button> : null}</header>
    {open && !existing ? <>
      {letter && sector && !choosingCard ? <div className="restoration-selection"><span><b aria-hidden="true">{letter.symbol}</b><span><strong>{letter.name}</strong><small>{local(sector.title)}</small></span></span>
        <button type="button" className="secondary-button" onClick={() => setChoosingCard(true)}>{t("changeCard")}</button></div> : <fieldset className="restoration-card-picker"><legend>{t("chooseCard")}</legend>
        {cards.map((item, index) => {
          if (!item.reversed) return null;
          const position = RESTORATION_SECTORS.find(candidate => candidate.id === RESTORATION_POSITION_IDS[index]);
          const chosen = letters.find(candidate => candidate.id === item.letterId);
          return position && chosen ? <button type="button" key={position.id} aria-pressed={selectedSector === position.id} onClick={() => chooseSector(position.id)}>
            <b aria-hidden="true">{chosen.symbol}</b><span><strong>{chosen.name}</strong><small>{local(position.title)}</small></span></button> : null;
        })}
        {cards.length === 9 && cards.every(item => !item.reversed) ? <p>{t("allUpright")}</p> : null}
      </fieldset>}
      {letter && sector && guidance && equation ? <div className={`restoration-workspace restoration-step-${step}`}>
        <nav className="restoration-steps" aria-label={t("title")}>
          {(["meaning", "myth", "equation", "practice"] as const).map((key,index) => <button type="button" key={key} aria-current={step === index ? "step" : undefined}
            disabled={index === 3 && !resource} onClick={() => changeStep(index)}><span>{index + 1}</span>{t(key)}</button>)}
        </nav>
        <div className="restoration-columns"><div className="restoration-main" key={step} ref={mainRef} tabIndex={-1}>
          {step === 0 ? <>
            <h3>{t("field")}</h3><p>{local(sector.field)}</p>
            <h3>{t("cardFocus")} · {letter.name}</h3><p>{local(RESTORATION_LETTER_FOCI[letter.id].risk)}</p>
            <fieldset className="restoration-needs"><legend>{t("need")}</legend><p>{t("possibility")}</p>
              {(["deficit", "excess", "conflict"] as const).map(key => <label key={key}><input type="radio" name="restoration-need" value={key} checked={need === key} onChange={() => changeNeed(key)} /><span>{t(key)}</span></label>)}
            </fieldset>
            <h3>{t("risk")}</h3><p>{local(guidance.risk)}</p><h3>{t("quality")}</h3><p>{local(guidance.quality)} {local(RESTORATION_LETTER_FOCI[letter.id].quality)}</p>
          </> : null}
          {step === 1 ? <>
            <h3>{t("ambivalence")}</h3><p>{local(sector.ambivalence)}</p>
            <h3>{local(sector.myth.title)}</h3><p>{local(sector.myth.body)}</p>
            <a href={sector.myth.url} target="_blank" rel="noreferrer">{t("source")} · {sector.myth.source}<ExperimentalIcon name="open" /></a>
            <p className="restoration-note">{t("interpretation")}</p>
            <details className="restoration-model"><summary>{local(RESTORATION_FRAMEWORK.title)}</summary><p className="restoration-formula">{RESTORATION_FRAMEWORK.formula}</p><p>{local(RESTORATION_FRAMEWORK.body)}</p></details>
            <fieldset className="restoration-supports"><legend>{t("supports")}</legend><p>{t("supportHelp")}</p>
              {RESTORATION_AUXILIARIES.map(support => <label key={support.id} aria-label={local(support.title)} htmlFor={`restoration-support-${support.id}`}><input id={`restoration-support-${support.id}`} type="checkbox" checked={supportIds.includes(support.id)} onChange={event => {
                setSupportIds(event.target.checked ? [...supportIds, support.id] : supportIds.filter(id => id !== support.id)); setResourceId("");
              }} /><span><strong>{local(support.title)}</strong><small>{local(support.purpose)}</small></span></label>)}
            </fieldset>
          </> : null}
          {step === 2 ? <>
            <h3>{t("resource")}</h3><p>{t("resourceHelp")}</p>
            <div className="restoration-resources">{equation.candidates.map(candidate => <button type="button" key={candidate.id} aria-pressed={resourceId === candidate.id} onClick={() => setResourceId(candidate.id)}>
              <b aria-hidden="true">{candidate.symbol}</b><span><strong>{letters.find(item => item.id === candidate.id)?.name} · {candidate.value}</strong><small>{local(RESTORATION_LETTER_FOCI[candidate.id].quality)}</small></span></button>)}</div>
            <p className="restoration-note">{t("arithmeticNote")}</p>
          </> : null}
          {step === 3 ? <>
            <h3>{t("contemplation")}</h3>{practiceText.split("\n\n").map((paragraph,index) => <p key={index}>{paragraph}</p>)}
            <h3>{t("action")}</h3>{actionText.split("\n\n").map((paragraph,index) => <p key={index}>{paragraph}</p>)}
            <label className="restoration-field"><span>{t("intention")}</span><textarea value={intention} maxLength={500} rows={3} onChange={event => setIntention(event.target.value)} /></label>
            <label className="restoration-field"><span>{t("habit")}</span><select value={linkedHabitId} onChange={event => setLinkedHabitId(event.target.value)}>
              <option value="">{t("newHabit")}</option>
              {workspace.habits.filter(isEligibleRestorationHabit).map(habit => <option key={habit.id} value={habit.id}>{t("existingHabit")} · {habit.title}</option>)}
            </select></label>
            <p>{t("cycleHelp")}</p>
            <button type="button" className="primary-button" disabled={!enabled || !resource || !intention.trim()} onClick={startCycle}><ExperimentalIcon name="habits" />{t("startCycle")}</button>
          </> : null}
        </div><aside className="restoration-equation" aria-label={t("equation")}>
          <h3>{t("equation")}</h3><p className="restoration-formula">{t("formula")}</p>
          <dl><div><dt>{t("original")}</dt><dd>{spreadTotal} → <strong>{equation.target}</strong></dd></div>
            <div><dt>A · {letter.name}</dt><dd>{letter.value}</dd></div>
            <div><dt>B · {resourceLetter?.name ?? t("resource")}</dt><dd>{resource?.value ?? "?"}</dd></div>
            <div><dt>U · {t("supportSum")}</dt><dd>{equation.supportTotal}</dd></div></dl>
          {equation.supports.map(support => <p className="restoration-key" key={support.id}><span lang="grc">{support.word}</span><span>{support.value}</span></p>)}
          {resource ? <p className="restoration-result">{letter.value} + {resource.value} + {equation.supportTotal} = {letter.value + resource.value + equation.supportTotal}<br />{restorationTrace(letter.value + resource.value + equation.supportTotal).join(" → ")}</p> : <p>{t("root")} B = {equation.requiredRoot}</p>}
        </aside></div>
        <footer className="restoration-navigation"><button type="button" className="secondary-button" disabled={step === 0} onClick={() => changeStep(step - 1)}>{t("back")}</button>
          {step < 3 ? <button type="button" className="primary-button" disabled={step === 2 && !resource} onClick={() => changeStep(step + 1)}>{t("next")}<ExperimentalIcon name="chevron" /></button> : null}</footer>
      </div> : null}
    </> : null}
    {open && existing && snapshot ? <div className="restoration-cycle">
      <div className="restoration-cycle-heading"><div><h3>{progress.length >= 10 ? t("completed") : t("cycle")}</h3><p>{existing.title} · {snapshot.sourceDate}</p></div><strong aria-live="polite" aria-atomic="true">{progress.length} / 10</strong></div>
      <div className="restoration-columns"><div className="restoration-main" ref={mainRef} tabIndex={-1}><h3>{t("intention")}</h3><p>{snapshot.intention}</p>
        <h3>{t("contemplation")}</h3>{snapshot.practiceText.split("\n\n").map((paragraph,index) => <p key={index}>{paragraph}</p>)}
        <h3>{t("action")}</h3>{snapshot.action.split("\n\n").map((paragraph,index) => <p key={index}>{paragraph}</p>)}
        {progress.length < 10 ? <button type="button" className="primary-button" disabled={!enabled || !scheduled || Boolean(todayEntry)} onClick={completeToday}><ExperimentalIcon name="check" />{todayEntry ? t("doneToday") : t("completeToday")}</button> : null}
        {!scheduled && progress.length < 10 ? <p>{t("notScheduled")}</p> : null}
        {todayEntry && !progress.includes(today) ? <p>{t("todayEarlier")}</p> : null}
        <label className="restoration-field"><span>{t("reflection")}</span><textarea rows={3} maxLength={2000} value={reflection ?? snapshot.reflection} onChange={event => {setReflection(event.target.value);setNotice("");}} /></label>
        <button type="button" className="secondary-button" disabled={!enabled || reflection === null || reflection.trim() === snapshot.reflection} onClick={saveReflection}><ExperimentalIcon name="save" />{t("saveReflection")}</button>
        <details><summary>{t("snapshot")}</summary><p>{snapshot.sourceDate} · {snapshot.spreadTotal} → {snapshot.pythmen}</p><ol>{archivedCards?.map((item,index) => <li key={index}>{item.sector ? local(item.sector.title) : ""} · {letters.find(candidate => candidate.id === item.letterId)?.name} · {item.reversed ? "↓" : "↑"}</li>)}</ol></details>
      </div><aside className="restoration-tetractys" aria-label={`${t("progress")}: ${progress.length} / 10`}>
        <h3>{t("tetractys")}</h3><div className="restoration-triangle" aria-hidden="true">{RESTORATION_STAGES.map((stage,row) => <div key={stage.id}>{Array.from({length:stage.count},(_,index) => <i className={row * (row + 1) / 2 + index < progress.length ? "is-complete" : ""} key={index} />)}</div>)}</div>
        <ol>{RESTORATION_STAGES.map(stage => <li key={stage.id}>{t(stage.id)} · {stage.count}</li>)}</ol><p>{t("cycleHelp")}</p>
      </aside></div>
      <div className="restoration-navigation"><button type="button" className="secondary-button" onClick={() => {setSelectedSector(null);setSelectedHabitId(null);setChoosingCard(true);setReflection(null);setNotice("");setError("");}}>{t("changeCard")}</button>{onOpenHabits ? <button type="button" className="secondary-button" onClick={onOpenHabits}>{t("openHabits")}</button> : null}</div>
    </div> : null}
    {!enabled && open ? <p className="restoration-note">{t("disabled")}</p> : null}
    {cycles.length ? <details className="restoration-history" open={!cards.length}><summary>{t("history")} · {cycles.length}</summary><div>{cycles.map(habit => <button type="button" className="secondary-button" key={habit.id} onClick={() => {setSelectedHabitId(habit.id);setOpen(true);setReflection(habit.stoicheionRestoration!.reflection);setNotice("");requestAnimationFrame(() => mainRef.current?.focus());}}>
      <ExperimentalIcon name="history" /><span>{habit.title}<small>{habit.stoicheionRestoration!.sourceDate} · {restorationCompletionDates(habit.stoicheionRestoration!,habit.id,workspace.habitCompletions,today).length} / 10</small></span></button>)}</div></details> : null}
    {notice ? <p role="status">{notice}</p> : null}{error ? <p className="restoration-error" role="alert">{error}</p> : null}
  </section>;
}
