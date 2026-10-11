import { useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { SharedCalendarTask } from "./cloud-sync";
import { ExperimentalIcon } from "./ExperimentalIcon";
import type { Language } from "./i18n";

export function CalendarSharedTaskControl({ tasks, dateLabel, language, popoverKey, alignment,
  openKey, onOpenKey, onOpenTask }: {
  tasks: readonly SharedCalendarTask[]; dateLabel: string; language: Language;
  popoverKey: string; alignment: string; openKey: string;
  onOpenKey: Dispatch<SetStateAction<string>>; onOpenTask: (task: SharedCalendarTask) => void;
}) {
  const expanded = openKey === popoverKey;
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openPopover = () => { clearTimeout(closeTimer.current); onOpenKey(popoverKey); };
  useLayoutEffect(() => () => clearTimeout(closeTimer.current), []);
  useLayoutEffect(() => {
    if (!expanded) return;
    const placePopup = () => {
      const anchor = controlRef.current?.getBoundingClientRect();
      const popup = popupRef.current;
      if (!anchor || !popup) return;
      const navigation = document.querySelector(".mobile-nav")?.getBoundingClientRect();
      let top = 0;
      let bottom = navigation?.height ? Math.min(window.innerHeight, navigation.top) : window.innerHeight;
      let left = 0;
      let right = document.documentElement.clientWidth;
      for (let parent = controlRef.current?.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const bounds = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          top = Math.max(top, bounds.top);
          bottom = Math.min(bottom, bounds.bottom);
        }
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
          left = Math.max(left, bounds.left);
          right = Math.min(right, bounds.right);
        }
      }
      const below = Math.max(0, bottom - anchor.bottom - 8);
      const above = Math.max(0, anchor.top - top - 8);
      const side = Math.max(popup.scrollHeight, popup.offsetHeight) > below && above > below ? "above" : "below";
      popup.dataset.side = side;
      popup.style.maxHeight = `${Math.max(80, side === "above" ? above : below)}px`;
      const bounds = popup.getBoundingClientRect();
      const currentOffset = parseFloat(popup.style.getPropertyValue("--shared-popup-offset-x")) || 0;
      const originalLeft = bounds.left - currentOffset;
      const targetLeft = Math.max(left + 8, Math.min(originalLeft, right - bounds.width - 8));
      popup.style.setProperty("--shared-popup-offset-x", `${targetLeft - originalLeft}px`);
    };
    placePopup();
    const settleTimer = window.setTimeout(placePopup, 180);
    window.addEventListener("resize", placePopup);
    window.addEventListener("scroll", placePopup, true);
    const observer = new ResizeObserver(placePopup);
    if (popupRef.current) observer.observe(popupRef.current);
    if (controlRef.current?.parentElement) observer.observe(controlRef.current.parentElement);
    return () => {
      window.removeEventListener("resize", placePopup);
      window.removeEventListener("scroll", placePopup, true);
      observer.disconnect();
      window.clearTimeout(settleTimer);
    };
  }, [expanded]);
  if (!tasks.length) return null;
  const english = language === "en";
  const title = english ? "Shared tasks" : "Общие задачи";
  const id = `calendar-task-popover-${popoverKey}`;
  return <div ref={controlRef} className="calendar-day-task-control calendar-shared-task-control"
    onPointerEnter={event => { if (event.pointerType === "mouse") openPopover(); }}
    onPointerLeave={event => {
      if (event.pointerType === "mouse" && expanded) {
        closeTimer.current = setTimeout(() => onOpenKey(current => current === popoverKey ? "" : current), 400);
      }
    }}
    onFocus={openPopover}
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
