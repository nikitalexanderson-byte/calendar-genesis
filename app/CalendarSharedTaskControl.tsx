import { useLayoutEffect, useRef } from "react";
import type { SharedCalendarTask } from "./cloud-sync";
import { ExperimentalIcon } from "./ExperimentalIcon";
import type { Language } from "./i18n";

export function CalendarSharedTaskControl({ tasks, dateLabel, language, popoverKey, alignment,
  openKey, onOpenKey, onOpenTask }: {
  tasks: readonly SharedCalendarTask[]; dateLabel: string; language: Language;
  popoverKey: string; alignment: string; openKey: string;
  onOpenKey: (key: string) => void; onOpenTask: (task: SharedCalendarTask) => void;
}) {
  const expanded = openKey === popoverKey;
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!expanded) return;
    const placePopup = () => {
      const anchor = controlRef.current?.getBoundingClientRect();
      const popup = popupRef.current;
      if (!anchor || !popup) return;
      const navigation = document.querySelector(".mobile-nav")?.getBoundingClientRect();
      const bottom = navigation?.height ? Math.min(window.innerHeight, navigation.top) : window.innerHeight;
      const below = bottom - anchor.bottom - 8;
      popup.dataset.side = popup.offsetHeight > below && anchor.top > below ? "above" : "below";
    };
    placePopup();
    window.addEventListener("resize", placePopup);
    window.addEventListener("scroll", placePopup, true);
    return () => {
      window.removeEventListener("resize", placePopup);
      window.removeEventListener("scroll", placePopup, true);
    };
  }, [expanded]);
  if (!tasks.length) return null;
  const english = language === "en";
  const title = english ? "Shared tasks" : "Общие задачи";
  const id = `calendar-task-popover-${popoverKey}`;
  return <div ref={controlRef} className="calendar-day-task-control calendar-shared-task-control"
    onPointerEnter={event => { if (event.pointerType === "mouse") onOpenKey(popoverKey); }}
    onPointerLeave={event => { if (event.pointerType === "mouse" && expanded) onOpenKey(""); }}
    onFocus={() => onOpenKey(popoverKey)}
    onBlur={event => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
        if (expanded) onOpenKey("");
      }
    }}>
    <button type="button" className="calendar-shared-task-count" onClick={() => onOpenKey(popoverKey)}
      aria-label={`${title}: ${tasks.length} · ${dateLabel}`}
      aria-expanded={expanded} aria-controls={id} aria-haspopup="dialog">{tasks.length}</button>
    {expanded ? <div ref={popupRef} className={`calendar-task-popover calendar-shared-task-popover ${alignment}`}
      id={id} role="dialog" aria-label={`${title} · ${dateLabel}`}>
      <header><strong>{title} · {tasks.length}</strong>
        <button type="button" onClick={() => onOpenKey("")} aria-label={english ? "Close task list" : "Закрыть список задач"}>
          <ExperimentalIcon name="close" />
        </button>
      </header>
      <ul>{tasks.slice(0, 6).map(task => <li className={task.completedAt ? "done" : ""} key={task.id}>
        <button type="button" onClick={() => { onOpenKey(""); onOpenTask(task); }}>
          <span data-no-translate>{task.title}</span>
          <small data-no-translate>{task.projectTitle || (english ? "Space inbox" : "Хаос-бокс пространства")}</small>
        </button>
      </li>)}</ul>
      {tasks.length > 6 ? <small>{english ? "More" : "Ещё"} {tasks.length - 6}</small> : null}
    </div> : null}
  </div>;
}
