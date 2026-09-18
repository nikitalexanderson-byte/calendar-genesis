"use client";

import { Fragment, useEffect, type CSSProperties } from "react";
import type { Language } from "./i18n";
import { HeroicRankSigil } from "./HeroicRankSigil";
import {
  FOUNDATIONAL_HEROIC_RANKS,
  HERO_PATH_CHECKPOINTS,
  heroicRank,
  type HabitWorkspace,
  type HeroicRankId,
} from "./habits";

type HeroPathPanelProps = {
  workspace: HabitWorkspace;
  language: Language;
  onClaimCheckpoint: (rankId: HeroicRankId) => void;
  onClose: () => void;
};

function AmphoraSigil({ open }: { open: boolean }) {
  return <span className={`hero-amphora-sigil${open ? " open" : ""}`} aria-hidden="true"><svg viewBox="0 0 80 90"><path className="hero-amphora-lid" d="M27 14h26l4 7H23z" /><path d="M25 23c2 8 1 12-5 18-7 7-7 19-1 28 9 14 33 14 42 0 6-9 6-21-1-28-6-6-7-10-5-18z" /><path d="M22 36c-12-2-16 6-12 16 2 5 7 7 12 8M58 36c12-2 16 6 12 16-2 5-7 7-12 8M25 50h30M29 65c8-7 14-7 22 0" /><circle cx="40" cy="50" r="5" /></svg></span>;
}

export function HeroPathPanel({ workspace, language, onClaimCheckpoint, onClose }: HeroPathPanelProps) {
  const isEnglish = language === "en";
  const total = workspace.userProgress.lifetimeXp;
  const rank = heroicRank(total);
  const currentFoundationalRank = rank.path === "hidden" ? FOUNDATIONAL_HEROIC_RANKS.at(-1)! : rank;
  const nextRank = FOUNDATIONAL_HEROIC_RANKS.find((item) => item.threshold > total);
  const previousThreshold = currentFoundationalRank.threshold;
  const progress = nextRank
    ? Math.max(0, Math.min(100, Math.round((total - previousThreshold) / Math.max(1, nextRank.threshold - previousThreshold) * 100)))
    : 100;
  const checkpoints = new Map(HERO_PATH_CHECKPOINTS.map((checkpoint) => [checkpoint.rankId, checkpoint]));

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop hero-path-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="hero-path-panel" role="dialog" aria-modal="true" aria-labelledby="hero-path-title">
        <header className="hero-path-header">
          <div><span className="eyebrow">{isEnglish ? "Lifetime progress" : "Пожизненный прогресс"}</span><h2 id="hero-path-title">{isEnglish ? "Path of the Hero" : "Путь Героя"}</h2><p>{isEnglish ? "Every point records a real completion. XP is never spent and ranks are never lost." : "Каждый балл сохраняет реальное выполнение. XP не тратится, а достигнутые ранги не теряются."}</p></div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={isEnglish ? "Close" : "Закрыть"}>×</button>
        </header>

        <div className="hero-path-summary" style={{ "--rank-color": currentFoundationalRank.color } as CSSProperties}>
          <HeroicRankSigil rankId={currentFoundationalRank.id} color={currentFoundationalRank.color} />
          <div><small>{isEnglish ? "Current rank" : "Текущий ранг"}</small><strong>{isEnglish ? currentFoundationalRank.titleEn : currentFoundationalRank.title}</strong><span>{total.toLocaleString(isEnglish ? "en-US" : "ru-RU")} XP</span><div className="hero-path-progress"><i style={{ width: `${progress}%` }} /></div><em>{nextRank ? (isEnglish ? `${(nextRank.threshold - total).toLocaleString("en-US")} XP to ${nextRank.titleEn}` : `${(nextRank.threshold - total).toLocaleString("ru-RU")} XP до «${nextRank.title}»`) : (isEnglish ? "The visible path is complete" : "Видимый путь пройден")}</em></div>
        </div>

        <div className="hero-path-map">
          <span className="hero-path-line" aria-hidden="true" />
          {FOUNDATIONAL_HEROIC_RANKS.map((item, index) => {
            const reached = total >= item.threshold;
            const current = currentFoundationalRank.id === item.id;
            const checkpoint = checkpoints.get(item.id);
            const claimed = checkpoint ? workspace.rewardTransactions.some((transaction) => transaction.idempotencyKey === `hero-path-amphora:self:${item.id}`) : false;
            return <Fragment key={item.id}>
              <article className={`hero-path-rank${reached ? " reached" : ""}${current ? " current" : ""}${index % 2 ? " right" : " left"}`} style={{ "--rank-color": item.color } as CSSProperties}>
                <div className="hero-path-rank-copy"><small>{isEnglish ? `Step ${index + 1}` : `Ступень ${index + 1}`}</small><h3>{isEnglish ? item.titleEn : item.title}</h3><span>{item.threshold.toLocaleString(isEnglish ? "en-US" : "ru-RU")} XP</span>{current ? <em>{isEnglish ? "You are here" : "Вы здесь"}</em> : reached ? <em>✓ {isEnglish ? "Reached" : "Достигнут"}</em> : null}</div>
                <HeroicRankSigil compact rankId={item.id} color={item.color} />
              </article>
              {checkpoint ? <article className={`hero-path-checkpoint${reached ? " unlocked" : ""}${claimed ? " claimed" : ""}`}>
                <AmphoraSigil open={claimed} />
                <div><small>{isEnglish ? "Guaranteed checkpoint reward" : "Гарантированная награда чекпоинта"}</small><strong>{isEnglish ? checkpoint.titleEn : checkpoint.title}</strong><span>♕ +{checkpoint.rewardLaurels} {isEnglish ? "Laurels" : "Лавров"}</span></div>
                <button type="button" disabled={!reached || claimed} onClick={() => onClaimCheckpoint(item.id)}>{claimed ? (isEnglish ? "Received" : "Получено") : reached ? (isEnglish ? "Open amphora" : "Открыть амфору") : (isEnglish ? "Locked" : "Закрыто")}</button>
              </article> : null}
            </Fragment>;
          })}
          <aside className="hero-path-mist-gate"><span aria-hidden="true">◇</span><div><strong>{isEnglish ? "The path continues…" : "Путь продолжается…"}</strong><small>{isEnglish ? "Something waits beyond the visible gate." : "За видимыми вратами скрывается продолжение."}</small></div></aside>
        </div>
      </section>
    </div>
  );
}
