"use client";
/* eslint-disable @next/next/no-img-element -- Decorative account-specific artwork uses native lazy loading in both web builds. */

import { useEffect, useMemo, useRef, useState } from "react";
import { loadDailyAdvice, recordDailyAdvice, type GenesisUser } from "./cloud-sync";
import { ADVICE_CATEGORIES, adviceHabitScores, adviceHabitTopicScores, advicePreferences, type AdviceScores, type AdviceTopicScores, type DailyAdviceResponse } from "./daily-advice";
import type { Habit } from "./habits";
import labels from "./daily-advice-copy.json";
import "./daily-advice.css";

export function TodayAdvice({ user, habits, day, ready }: { user: GenesisUser; habits: readonly Habit[]; day: string; ready: boolean }) {
  const preferences = advicePreferences(user.advicePreferences);
  const scores = useMemo(() => adviceHabitScores(habits, day), [habits, day]);
  const topics = useMemo(() => adviceHabitTopicScores(habits, day), [habits, day]);
  const context = JSON.stringify(preferences.smart ? { scores, topics } : { scores: {}, topics: {} });
  const requestKey = `${user.uid}:${day}:${user.language}:${JSON.stringify(preferences)}`;
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
    const payload = JSON.parse(context) as { scores: AdviceScores; topics: AdviceTopicScores };
    void loadDailyAdvice(payload.scores, controller.signal, payload.topics).then(result => {
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
  const base = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");
  const artwork = advice.image && /^\/advice-art\/[a-z0-9-]+\/advice-[a-f0-9]{24}\.webp$/.test(advice.image) ? `${base}${advice.image}` : null;
  return <aside ref={container} className={`daily-advice-card${artwork ? " daily-advice-illustrated" : ""}`} aria-labelledby="daily-advice-title" data-no-translate>
    {artwork ? <img className="daily-advice-art" src={artwork} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : null}
    <div className="daily-advice-reading">
    <header>
      <h2 id="daily-advice-title" lang={advice.language}>{advice.title || copy.title}</h2>
      <button type="button" className="daily-advice-hide" onClick={() => void dismiss()} disabled={busy} aria-label={copy.hide} title={copy.hide}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </header>
    <p className="daily-advice-body" lang={advice.language}>{advice.body}</p>
    <footer><span className="daily-advice-category-name">{copy.title} · {advice.categories.map(id => copy.categories[ADVICE_CATEGORIES.indexOf(id)]).join(" · ")}</span>
    {advice.sources.map((source, index) => <span key={index} lang={advice.language}>
      {source.kind === "quote" ? copy.source : copy.inspired}: {[source.author, source.work, source.reference].filter(Boolean).join(" · ")}
    </span>)}</footer>
    {hideError ? <p role="alert">{copy.hideError}</p> : null}
    </div>
  </aside>;
}
