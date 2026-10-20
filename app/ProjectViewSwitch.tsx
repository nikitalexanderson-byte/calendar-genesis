"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { translateText, type Language } from "./i18n";
import { PROJECT_VIEWS, moveProjectView, type ProjectView } from "./project-view-order";
import copy from "./project-view-order-copy.json";
import "./project-view-order.css";

type Gesture = { id: ProjectView; pointer: number; x: number; y: number; active: boolean; timer: number; original: string; button: HTMLButtonElement; order: ProjectView[] };
const names = { list: "Список", board: "Доски", calendar: "Календарь", gantt: "Гант" };

export function ProjectViewSwitch({ order, active, language, dropView, onSelect, onReorder }: {
  order: ProjectView[] | null; active: ProjectView; language: Language; dropView?: string;
  onSelect: (view: ProjectView) => void; onReorder: (views: ProjectView[]) => void;
}) {
  const saved = order ?? [...PROJECT_VIEWS], identity = saved.join(","), helpId = useId();
  const currentIdentity = useRef(identity);
  useLayoutEffect(() => { currentIdentity.current = identity; }, [identity]);
  const gesture = useRef<Gesture | null>(null), suppressClick = useRef(false), resetClick = useRef(0);
  const [preview, setPreview] = useState<ProjectView[] | null>(null), [dragging, setDragging] = useState<ProjectView | null>(null);
  const [message, setMessage] = useState("");
  const labels = copy[language];
  const label = (view: ProjectView) => translateText(names[view], language);
  const finish = (commit: boolean) => {
    const item = gesture.current; if (!item) return;
    window.clearTimeout(item.timer); gesture.current = null;
    if (item.active) {
      suppressClick.current = true; window.clearTimeout(resetClick.current);
      resetClick.current = window.setTimeout(() => { suppressClick.current = false; }, 250);
      if (commit && item.original === currentIdentity.current && item.order.join(",") !== item.original) {
        onReorder(item.order); setMessage(labels.first.replace("{view}", label(item.order[0])));
      } else if (commit && item.original !== currentIdentity.current) setMessage(labels.changed);
    }
    if (item.button.hasPointerCapture(item.pointer)) item.button.releasePointerCapture(item.pointer);
    setPreview(null); setDragging(null);
  };
  useEffect(() => () => { if (gesture.current) window.clearTimeout(gesture.current.timer); window.clearTimeout(resetClick.current); }, []);
  const down = (event: PointerEvent<HTMLButtonElement>, id: ProjectView) => {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return;
    const button = event.currentTarget;
    const item: Gesture = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, active: false, timer: 0, original: identity, button, order: [...saved] };
    item.timer = window.setTimeout(() => {
      if (gesture.current !== item || currentIdentity.current !== item.original) return;
      item.active = true; button.setPointerCapture(item.pointer); setPreview(item.order); setDragging(id);
    }, 350);
    gesture.current = item;
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const item = gesture.current; if (!item || event.pointerId !== item.pointer) return;
    if (!item.active) { if (Math.hypot(event.clientX - item.x, event.clientY - item.y) > 8) finish(false); return; }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>("[data-project-view]");
    if (!target || target.closest(".shared-projects-view-switch") !== event.currentTarget.closest(".shared-projects-view-switch")) return;
    const id = target.dataset.projectView as ProjectView;
    if (id === item.id) return;
    item.order = moveProjectView(item.order, item.id, id); setPreview(item.order);
  };
  return <>
    <div className="shared-projects-view-switch reorderable-project-views" role="group" aria-label={translateText("Вид проекта", language)}
      aria-describedby={helpId} data-reordering={dragging ? true : undefined}>
      {(preview ?? saved).map(view => <button key={view} type="button" data-project-view={view}
        data-shared-drop-view={view === "list" || view === "board" ? view : undefined} data-drop-active={dropView === view || undefined}
        data-view-dragging={dragging === view || undefined} aria-pressed={active === view} aria-describedby={helpId}
        onContextMenu={event => event.preventDefault()} onPointerDown={event => down(event, view)} onPointerMove={move}
        onPointerUp={() => finish(true)} onPointerCancel={() => finish(false)} onLostPointerCapture={() => finish(false)}
        onClick={event => { if (suppressClick.current) { event.preventDefault(); suppressClick.current = false; } else onSelect(view); }}
        onKeyDown={event => {
          if (event.key === "Escape" && gesture.current) { event.preventDefault(); finish(false); return; }
          if (!event.altKey || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); const index = saved.indexOf(view);
          const destination = event.key === "Home" ? 0 : event.key === "End" ? saved.length - 1 : Math.max(0, Math.min(saved.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
          if (destination === index) return;
          const next = moveProjectView(saved, view, saved[destination]); onReorder(next); setMessage(labels.first.replace("{view}", label(next[0])));
        }}>{label(view)}</button>)}
    </div>
    <p id={helpId} className="project-view-order-help">{labels.help}</p>
    <span className="sr-only" aria-live="polite">{message}</span>
  </>;
}
