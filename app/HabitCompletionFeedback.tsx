"use client";

import type { Language } from "./i18n";
import type { HabitFeedbackEvent } from "./habit-feedback";

type HabitCompletionFeedbackProps = {
  event: HabitFeedbackEvent;
  language: Language;
  showGamification: boolean;
};

function feedbackHeading(event: HabitFeedbackEvent, isEnglish: boolean) {
  if (event.kind === "rank-up") return isEnglish ? `New rank — ${event.rankTitleEn}` : `Новый ранг — ${event.rankTitle}`;
  if (event.kind === "perfect-day") return isEnglish ? "Perfect Day" : "Идеальный день";
  if (event.kind === "daily-goal") return isEnglish ? "Daily goal achieved" : "Дневная цель выполнена";
  return isEnglish ? "Completed" : "Выполнено";
}

export function HabitCompletionFeedback({ event, language, showGamification }: HabitCompletionFeedbackProps) {
  const isEnglish = language === "en";
  const achievement = isEnglish ? event.achievementTitleEn : event.achievementTitle;
  return (
    <aside
      className={`habit-completion-feedback kind-${event.kind}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="habit-feedback-symbol" aria-hidden="true">{event.habitEmoji || "✓"}</span>
      <div>
        <small>{feedbackHeading(event, isEnglish)}</small>
        <strong data-no-translate>{event.habitTitle}</strong>
        {showGamification && (event.xp > 0 || event.laurels > 0) ? (
          <p>
            {event.xp > 0 ? <b>+{event.xp} XP</b> : null}
            {event.laurels > 0 ? <b>♕ +{event.laurels} {isEnglish ? "Laurels" : "Лавров"}</b> : null}
          </p>
        ) : null}
        {achievement ? <em>{isEnglish ? `Achievement: ${achievement}` : `Достижение: ${achievement}`}</em> : null}
      </div>
      <span className="habit-feedback-check" aria-hidden="true">✓</span>
    </aside>
  );
}
