"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { LEGAL_UPDATED, legalPages } from "./legal-content";

export type LegalPageName = keyof typeof legalPages;

export function LegalPage({ page }: { page: LegalPageName }) {
  const content = legalPages[page];
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <a className="welcome-brand" href="/"><span className="solar-mark"><i /></span><span><strong>GENESIS</strong><small>доверие и ясность</small></span></a>
        <a href="/">← На главную</a>
      </header>
      <article className="legal-document">
        <span className="welcome-kicker">ОФИЦИАЛЬНЫЙ ДОКУМЕНТ</span>
        <h1>{content.title}</h1>
        <p className="legal-intro">{content.intro}</p>
        <p className="legal-date">Редакция от {LEGAL_UPDATED}</p>
        {content.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
        {page === "privacy" ? (
          <p className="legal-policy-link">
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>
          </p>
        ) : null}
      </article>
      <footer className="legal-footer"><a href="/privacy">Конфиденциальность</a><a href="/terms">Соглашение</a><a href="/support">Поддержка</a><a href="/delete-account">Удаление аккаунта</a></footer>
    </main>
  );
}

export function currentLegalPage(): LegalPageName | null {
  if (typeof window === "undefined") return null;
  const name = window.location.pathname.replace(/^\/+|\/+$/g, "").replace(/\.html$/, "") as LegalPageName;
  return name in legalPages ? name : null;
}
