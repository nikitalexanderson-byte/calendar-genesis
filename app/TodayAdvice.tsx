"use client";
/* eslint-disable @next/next/no-img-element -- Decorative account-specific artwork uses native lazy loading in both web builds. */

import { useEffect, useMemo, useRef, useState } from "react";
import { loadDailyAdvice, recordDailyAdvice, type GenesisUser } from "./cloud-sync";
import { ADVICE_CATEGORIES, ADVICE_TOPICS, adviceHabitScores, adviceHabitTopicScores, adviceTaskContext, advicePreferences, type AdviceScores, type AdviceTopicScores, type AdvicePersonalTask, type DailyAdviceResponse } from "./daily-advice";
import type { Habit } from "./habits";
import labels from "./daily-advice-copy.json";
import "./daily-advice.css";
import { useDiary } from './DiaryProvider';
import diaryLabels from './diary-copy.json';
import { ExperimentalIcon } from './ExperimentalIcon';
import { DiaryMark } from './DiaryLaunchButton';
import { AdviceShareButton } from './AdviceShareButton';
import { translateText } from './i18n';

export function TodayAdvice({ user, habits, tasks, day, ready, onOpenDiary }: { user: GenesisUser; habits: readonly Habit[]; tasks: readonly AdvicePersonalTask[]; day: string; ready: boolean; onOpenDiary?: () => void }) {
  const diary = useDiary(); const diaryText = user.language === 'en' ? diaryLabels.en : diaryLabels.ru;
  const [reactionError, setReactionError] = useState(false);
  const preferences = advicePreferences(user.advicePreferences);
  const taskContext = useMemo(() => adviceTaskContext(tasks, day), [tasks, day]);
  const scores = useMemo(() => {
    const values = adviceHabitScores(habits, day);
    for (const category of ADVICE_CATEGORIES) values[category] = Math.min(1000, values[category] + taskContext.scores[category]);
    return values;
  }, [habits, day, taskContext]);
  const topics = useMemo(() => {
    const values = adviceHabitTopicScores(habits, day);
    for (const topic of ADVICE_TOPICS) values[topic] = Math.min(1000, values[topic] + taskContext.topics[topic]);
    return values;
  }, [habits, day, taskContext]);
  const context = JSON.stringify(preferences.smart ? { scores, topics } : { scores: {}, topics: taskContext.topics });
  const requestKey = `${user.uid}:${day}:${user.language}:${JSON.stringify(preferences)}`;
  const [saved, setSaved] = useState<{ key: string; result: DailyAdviceResponse } | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hideError, setHideError] = useState(false);
  const [nextError, setNextError] = useState(false);
  const requestSerial = useRef(0);
  const container = useRef<HTMLElement>(null);
  const copy = labels[user.language];
  const advice = saved?.key === requestKey ? saved.result.advice : null;
  const diaryNote = advice ? diary.records.find(row => !row.draftKey && row.note.advice?.id === advice.id)?.note : undefined;
  const archived = diaryNote?.reaction === 'dislike';
  const shown = ready && preferences.enabled && advice && !advice.dismissed && !archived
    && (!advice.requiresAdult || preferences.aphrodisiaAdult === true)
    && (!advice.categories.includes("aphrodisia") || (preferences.categories.includes("aphrodisia") && preferences.aphrodisiaAdult !== null));

  useEffect(() => {
    const online = () => setRetry(value => value + 1);
    const visible = () => { if (document.visibilityState === "visible") online(); };
    const timeKey = () => {
      const now = new Date(), hour = now.getHours();
      return `${now.toDateString()}:${hour < 5 || hour >= 18 ? "evening" : hour < 12 ? "morning" : "day"}:${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    };
    let clock = timeKey();
    const timer = window.setInterval(() => { const next = timeKey(); if (next !== clock) { clock = next; visible(); } }, 60000);
    window.addEventListener("online", online);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(timer); window.removeEventListener("online", online); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, []);

  useEffect(() => {
    if (!ready || !preferences.enabled || busy) return;
    const controller = new AbortController();
    const serial = ++requestSerial.current;
    const payload = JSON.parse(context) as { scores: AdviceScores; topics: AdviceTopicScores };
    void loadDailyAdvice(payload.scores, controller.signal, payload.topics).then(result => {
      if (!controller.signal.aborted && serial === requestSerial.current) setSaved({ key: requestKey, result });
    }).catch(() => { /* No offline draw: daily identity and history belong to the account on the server. */ });
    return () => controller.abort();
  }, [ready, preferences.enabled, context, requestKey, retry, busy]);

  useEffect(() => {
    if (!shown || !container.current) return;
    let inViewport = false; let pending = false; let recorded = false; let active = true;
    const acknowledge = () => {
      if (!active || !inViewport || document.visibilityState !== "visible" || pending || recorded) return;
      pending = true;
      void recordDailyAdvice(advice).then(() => { recorded = true; }).catch(() => undefined).finally(() => { pending = false; });
    };
    const observer = new IntersectionObserver(entries => { inViewport = entries.some(entry => entry.isIntersecting); acknowledge(); }, { threshold: 0.1 });
    observer.observe(container.current);
    document.addEventListener("visibilitychange", acknowledge);
    window.addEventListener("online", acknowledge);
    return () => { active = false; observer.disconnect(); document.removeEventListener("visibilitychange", acknowledge); window.removeEventListener("online", acknowledge); };
  }, [shown, advice]);

  if ((!shown && !archived) || !advice || !ready || !preferences.enabled) return null;
  const react = async (reaction: 'favorite' | 'dislike') => {
    setReactionError(false); try { await diary.react(advice, reaction); } catch { setReactionError(true); }
  };
  const dismiss = async () => {
    setBusy(true); setHideError(false);
    try {
      await recordDailyAdvice(advice, true);
      setSaved(previous => previous?.key === requestKey ? { ...previous, result: { ...previous.result, advice: { ...advice, dismissed: true } } } : previous);
    } catch { setHideError(true); }
    finally { setBusy(false); }
  };
  const next = async () => {
    if (busy || !saved?.result.canNext) return;
    const serial = ++requestSerial.current;
    setBusy(true); setNextError(false); setHideError(false);
    try {
      const payload = JSON.parse(context) as { scores: AdviceScores; topics: AdviceTopicScores };
      const result = await loadDailyAdvice(payload.scores, undefined, payload.topics, advice);
      if (serial === requestSerial.current) setSaved({ key: requestKey, result });
    } catch { if (serial === requestSerial.current) setNextError(true); }
    finally { setBusy(false); }
  };
  const base = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");
  const artwork = advice.image && /^\/advice-art\/[a-z0-9-]+\/advice-[a-f0-9]{24}\.webp$/.test(advice.image) ? `${base}${advice.image}` : null;
  if (archived) return <aside className="daily-advice-card daily-advice-archived" data-no-translate><p role="status">{diaryText.archived}</p><div className="daily-advice-actions"><div className="daily-advice-action-row"><button type="button" className="daily-advice-icon-action" disabled={diary.busy} aria-label={diaryText.undoDislike} title={diaryText.undoDislike} onClick={() => void react('dislike')}><ExperimentalIcon name="undo"/></button>{onOpenDiary ? <button type="button" className="daily-advice-icon-action" aria-label={diaryText.openDiary} title={diaryText.openDiary} onClick={onOpenDiary}><DiaryMark/></button> : null}{saved?.result.canNext ? <button type="button" className="daily-advice-next" disabled={busy} aria-label={copy.next} title={copy.next} onClick={() => void next()}><ExperimentalIcon name="map-refresh"/><span className="daily-advice-next-label">{copy.next}</span></button> : null}</div></div>{reactionError ? <p role="alert">{diaryText.error}</p> : null}</aside>;
  return <aside ref={container} className={`daily-advice-card${artwork ? " daily-advice-illustrated" : ""}`} aria-labelledby="daily-advice-title" aria-busy={busy} data-no-translate>
    {artwork ? <img className="daily-advice-art" src={artwork} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : null}
    <div className="daily-advice-reading">
    <header>
      <h2 id="daily-advice-title" lang={advice.language}>{advice.title || copy.title}</h2>
      <button type="button" className="daily-advice-hide" onClick={() => void dismiss()} disabled={busy} aria-label={copy.hide} title={copy.hide}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </header>
    <p className="daily-advice-body" lang={advice.language}>{advice.body}</p>
    <footer><span className="daily-advice-category-name">{copy.title} · {advice.categories.map(id => id === "aphrodisia" && advice.aphrodisiaTheme
      ? copy[`theme${advice.aphrodisiaTheme === "love" ? "Love" : advice.aphrodisiaTheme === "aesthetics" ? "Aesthetics" : "Consciousness"}`]
      : copy.categories[ADVICE_CATEGORIES.indexOf(id)]).join(" · ")}</span>
    {advice.sources.map((source, index) => <span key={index} lang={advice.language}>
      {source.kind === "quote" ? copy.source : copy.inspired}: {[source.author, source.work, source.reference].filter(Boolean).join(" · ")}
    </span>)}</footer>
    <div className="daily-advice-actions">
      <div className="daily-advice-action-row">
        <button type="button" className="daily-advice-icon-action" aria-label={diaryNote?.reaction === 'favorite' ? diaryText.unfavorite : diaryText.favorite} title={diaryNote?.reaction === 'favorite' ? diaryText.unfavorite : diaryText.favorite} aria-pressed={diaryNote?.reaction === 'favorite'} disabled={diary.busy || diary.loading || diary.error} onClick={() => void react('favorite')}><ExperimentalIcon name="heart"/></button>
        <button type="button" className="daily-advice-icon-action" aria-label={diaryText.dislike} title={diaryText.dislike} disabled={diary.busy || diary.loading || diary.error} onClick={() => void react('dislike')}><ExperimentalIcon name="advice-dislike"/></button>
        {typeof saved?.result.dailyLimit === "number" ? <button type="button" className="daily-advice-next" aria-label={copy.next} data-tooltip={saved.result.canNext ? copy.next : copy.limitReached} onClick={() => void next()} disabled={busy || !saved.result.canNext}>
          <ExperimentalIcon name="map-refresh"/><span className="daily-advice-next-label">{copy.next}</span>
        </button> : null}
        {diaryNote?.reaction === 'favorite' && onOpenDiary ? <button type="button" className="daily-advice-icon-action" aria-label={diaryText.openDiary} title={diaryText.openDiary} onClick={onOpenDiary}><DiaryMark/></button> : null}
        <AdviceShareButton key={advice.id} advice={advice} copy={copy} closeLabel={translateText('Закрыть', user.language)}/>
      </div>
      {typeof saved?.result.dailyLimit === "number" ? <span role="status" aria-live="polite">{copy.position.replace("{current}", String(saved.result.sequence ?? 1)).replace("{limit}", String(saved.result.dailyLimit))}{!saved.result.canNext ? ` · ${copy.limitReached}` : ""}</span> : null}
    </div>
    {reactionError || diary.error ? <p role="alert">{diaryText.error}<button type="button" onClick={() => void diary.refresh()}>{diaryText.retry}</button></p> : null}
    {nextError ? <p role="alert">{copy.nextError}</p> : null}
    {hideError ? <p role="alert">{copy.hideError}</p> : null}
    </div>
  </aside>;
}
