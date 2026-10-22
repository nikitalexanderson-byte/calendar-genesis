"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadDailyAdvice, recordDailyAdvice, type GenesisUser } from "./cloud-sync";
import { ADVICE_CATEGORIES, adviceHabitScores, advicePreferences, type AdviceScores, type DailyAdviceResponse } from "./daily-advice";
import type { Habit } from "./habits";
import labels from "./daily-advice-copy.json";
import "./daily-advice.css";

export function TodayAdvice({ user, habits, day, ready }: { user: GenesisUser; habits: readonly Habit[]; day: string; ready: boolean }) {
  const preferences = advicePreferences(user.advicePreferences);
  const scores = useMemo(() => adviceHabitScores(habits, day), [habits, day]);
  const context = JSON.stringify(preferences.smart ? scores : {});
  const requestKey = `${user.uid}:${day}:${JSON.stringify(preferences)}`;
  const [saved, setSaved] = useState<{ key: string; result: DailyAdviceResponse } | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hideError, setHideError] = useState(false);
  const container = useRef<HTMLElement>(null);
  const copy = labels[user.language];
  const advice = saved?.key === requestKey ? saved.result.advice : null;
  const shown = ready && preferences.enabled && advice && !advice.dismissed;

  useEffect(() => {
    const online = () => setRetry(value => value + 1);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);

  useEffect(() => {
    if (!ready || !preferences.enabled) return;
    const controller = new AbortController();
    void loadDailyAdvice(JSON.parse(context) as AdviceScores, controller.signal).then(result => {
      if (!controller.signal.aborted) setSaved({ key: requestKey, result });
    }).catch(() => { /* No offline draw: daily identity and history belong to the account on the server. */ });
    return () => controller.abort();
  }, [ready, preferences.enabled, context, requestKey, retry]);

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

  if (!shown) return null;
  const dismiss = async () => {
    setBusy(true); setHideError(false);
    try {
      await recordDailyAdvice(advice, true);
      setSaved(previous => previous?.key === requestKey ? { ...previous, result: { ...previous.result, advice: { ...advice, dismissed: true } } } : previous);
    } catch { setHideError(true); }
    finally { setBusy(false); }
  };
  return <aside ref={container} className="daily-advice-card" aria-labelledby="daily-advice-title" data-no-translate>
    <header>
      <div><h2 id="daily-advice-title">{copy.title}</h2><span className="daily-advice-category-name">{advice.categories.map(id => copy.categories[ADVICE_CATEGORIES.indexOf(id)]).join(" · ")}</span></div>
      <button type="button" className="daily-advice-hide" onClick={() => void dismiss()} disabled={busy} aria-label={copy.hide} title={copy.hide}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </header>
    <p className="daily-advice-body" lang={advice.language}>{advice.body}</p>
    {advice.sources.length ? <footer lang={advice.language}>{advice.sources.map((source, index) => <span key={index}>
      {source.kind === "quote" ? copy.source : copy.inspired}: {[source.author, source.work, source.reference].filter(Boolean).join(" · ")}
    </span>)}</footer> : null}
    {hideError ? <p role="alert">{copy.hideError}</p> : null}
  </aside>;
}
