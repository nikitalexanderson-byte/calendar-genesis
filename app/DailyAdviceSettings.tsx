"use client";

import { useState } from "react";
import { updateAccountPreferences, type GenesisUser } from "./cloud-sync";
import { ADVICE_CATEGORIES, advicePreferences, type AdvicePreferences } from "./daily-advice";
import labels from "./daily-advice-copy.json";
import "./daily-advice.css";

export function DailyAdviceSettings({ user, onUserChange }: { user: GenesisUser; onUserChange: (user: GenesisUser) => void }) {
  const copy = labels[user.language];
  const preferences = advicePreferences(user.advicePreferences);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = async (patch: Partial<AdvicePreferences>) => {
    setBusy(true); setError("");
    try {
      const { user: saved } = await updateAccountPreferences({ advicePreferences: patch });
      const expected = { ...preferences, ...patch };
      const actual = advicePreferences(saved.advicePreferences);
      if (!saved.advicePreferences || actual.enabled !== expected.enabled || actual.smart !== expected.smart
        || actual.categories.join() !== expected.categories.join()) throw new Error("ADVICE_PREFERENCES_NOT_SAVED");
      onUserChange(saved);
    } catch { setError(copy.saveError); }
    finally { setBusy(false); }
  };
  return <section className="account-preferences daily-advice-settings" data-settings-group="appearance" aria-labelledby="advice-settings-title" data-no-translate>
    <div><h3 id="advice-settings-title">{copy.title}</h3><p>{copy.tradition}</p></div>
    <label className="account-switch-row" htmlFor="advice-enabled">
      <span><strong>{copy.enable}</strong><small>{copy.enableHint}</small></span>
      <input id="advice-enabled" aria-label={copy.enable} type="checkbox" role="switch" checked={preferences.enabled} disabled={busy} onChange={event => void change({ enabled: event.target.checked })} />
      <i aria-hidden="true" />
    </label>
    {preferences.enabled ? <>
      <label className="account-switch-row" htmlFor="advice-smart">
        <span><strong>{copy.smart}</strong><small>{copy.smartHint}</small></span>
        <input id="advice-smart" aria-label={copy.smart} type="checkbox" role="switch" checked={preferences.smart} disabled={busy} onChange={event => void change({ smart: event.target.checked })} />
        <i aria-hidden="true" />
      </label>
      {preferences.smart ? <p className="daily-advice-note">{copy.fallback}</p> : <fieldset className="daily-advice-categories" aria-describedby="advice-category-hint">
        <legend>{copy.choose}</legend>
        {ADVICE_CATEGORIES.map((category, index) => <label className="daily-advice-category" key={category} htmlFor={`advice-category-${category}`}>
          <input id={`advice-category-${category}`} aria-label={copy.categories[index]} type="checkbox" checked={preferences.categories.includes(category)}
            disabled={busy || (preferences.categories.length === 1 && preferences.categories[0] === category)}
            onChange={event => void change({ categories: ADVICE_CATEGORIES.filter(id => id === category ? event.target.checked : preferences.categories.includes(id)) })} />
          <span><strong>{copy.categories[index]}</strong><small>{copy.categoryHints[index]}</small></span>
        </label>)}
        <p id="advice-category-hint" className="daily-advice-note">{copy.oneCategory}</p>
      </fieldset>}
      <p className="daily-advice-note">{copy.scopeHint}</p>
      {user.adviceCatalogAvailable === false ? <p className="daily-advice-note" role="status">{copy.pending}</p> : null}
    </> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
