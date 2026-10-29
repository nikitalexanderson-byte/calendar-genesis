"use client";

import { useState, useRef, useEffect } from "react";
import { DialogCloseButton } from "./DialogCloseButton";
import { updateAccountPreferences, type GenesisUser } from "./cloud-sync";
import { ADVICE_CATEGORIES, adviceAvailableCategories, advicePreferences, type AdvicePreferences } from "./daily-advice";
import labels from "./daily-advice-copy.json";
import "./daily-advice.css";

export function DailyAdviceSettings({ user, onUserChange }: { user: GenesisUser; onUserChange: (user: GenesisUser) => void }) {
  const copy = labels[user.language];
  const preferences = advicePreferences(user.advicePreferences);
  const available = adviceAvailableCategories(user.adviceAvailableCategories);
  const selected = available.filter(id => preferences.categories.includes(id));
  const effective = selected.length ? selected : available.slice(0, 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ageCategories, setAgeCategories] = useState<AdvicePreferences["categories"] | null>(null);
  const change = async (patch: Partial<AdvicePreferences>) => {
    setBusy(true); setError("");
    try {
      const { user: saved } = await updateAccountPreferences({ advicePreferences: patch });
      const expected = { ...preferences, ...patch };
      const actual = advicePreferences(saved.advicePreferences);
      if (!saved.advicePreferences || actual.enabled !== expected.enabled || actual.smart !== expected.smart
        || actual.categories.join() !== expected.categories.join()
        || actual.aphrodisiaAdult !== expected.aphrodisiaAdult) throw new Error("ADVICE_PREFERENCES_NOT_SAVED");
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
        <input id="advice-smart" aria-label={copy.smart} type="checkbox" role="switch" checked={preferences.smart} disabled={busy || available.length === 0} onChange={event => void change({ smart: event.target.checked, categories: effective })} />
        <i aria-hidden="true" />
      </label>
      {preferences.smart ? <p className="daily-advice-note">{copy.fallback}</p> : <fieldset className="daily-advice-categories" aria-describedby="advice-category-hint">
        <legend>{copy.choose}</legend>
        {ADVICE_CATEGORIES.map((category, index) => <label className="daily-advice-category" data-unavailable={!available.includes(category)} key={category} htmlFor={`advice-category-${category}`}>
          <input id={`advice-category-${category}`} aria-label={copy.categories[index]} aria-describedby={`advice-category-hint-${category}`} type="checkbox" checked={effective.includes(category)}
            disabled={busy || !available.includes(category) || (effective.length === 1 && effective[0] === category)}
            onChange={event => {
              const categories = available.filter(id => id === category ? event.target.checked : effective.includes(id));
              if (category === "aphrodisia" && event.target.checked) setAgeCategories(categories);
              else void change({ categories });
            }} />
          <span><strong>{copy.categories[index]}</strong><small id={`advice-category-hint-${category}`}>{copy.categoryHints[index]}{!available.includes(category) ? ` · ${copy.comingSoon}` : ""}</small></span>
        </label>)}
        <p id="advice-category-hint" className="daily-advice-note">{copy.oneCategory}</p>
      </fieldset>}
      {preferences.smart && available.includes("aphrodisia") ? <label className="daily-advice-category">
        <input type="checkbox" checked={effective.includes("aphrodisia")} disabled={busy} aria-label={copy.categories[4]} onChange={event => {
          if(event.target.checked) setAgeCategories(available.filter(id => id === "aphrodisia" || effective.includes(id)));
          else void change({categories: effective.filter(id => id !== "aphrodisia")});
        }} /><span><strong>{copy.categories[4]}</strong><small>{copy.categoryHints[4]}</small></span>
      </label> : null}
      {available.includes("aphrodisia") && effective.includes("aphrodisia") ? <div className="daily-advice-age-setting">
        <button type="button" disabled={busy} onClick={() => setAgeCategories(preferences.categories)}>{copy.ageManage}</button>
        <p className="daily-advice-note" role="status">{preferences.aphrodisiaAdult === true ? copy.ageAllowed : copy.ageRestricted}</p>
      </div> : null}
      <p className="daily-advice-note">{copy.scopeHint}</p>
      {user.adviceCatalogAvailable === false ? <p className="daily-advice-note" role="status">{copy.pending}</p> : null}
    </> : null}
    {error ? <p role="alert">{error}</p> : null}
    {ageCategories ? <AdviceAgeDialog copy={copy} onClose={() => setAgeCategories(null)} onAnswer={adult => {
      const categories=ageCategories; setAgeCategories(null); void change({categories, aphrodisiaAdult: adult});
    }} /> : null}
  </section>;
}

function AdviceAgeDialog({copy, onClose, onAnswer}: {copy: typeof labels.ru; onClose: () => void; onAnswer: (adult: boolean) => void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="daily-advice-age-dialog" aria-labelledby="advice-age-title" aria-describedby="advice-age-hint" onClose={onClose}>
    <header><h2 id="advice-age-title">{copy.ageQuestion}</h2><DialogCloseButton type="button" onClick={onClose}/></header>
    <p id="advice-age-hint">{copy.ageHint}</p>
    <div className="daily-advice-age-actions"><button type="button" onClick={() => onAnswer(false)}>{copy.ageNo}</button><button type="button" onClick={() => onAnswer(true)}>{copy.ageYes}</button></div>
  </dialog>;
}

export function AdvicePrivacyNotice({ language }: { language: GenesisUser["language"] }) {
  const copy = labels[language];
  return <section className="daily-advice-privacy" aria-labelledby="advice-privacy-title" data-no-translate>
    <h3 id="advice-privacy-title">{copy.privacyTitle}</h3><p>{copy.privacyNotice}</p>
  </section>;
}
