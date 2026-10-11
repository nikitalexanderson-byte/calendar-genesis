import { useState, type PointerEvent } from "react";
import type { InboxPosition } from "./ui-visibility";

const positions: InboxPosition[] = ["top", "right", "left", "bottom"];
const label = (position: InboxPosition, english: boolean) => (english
  ? { top: "Top", right: "Right", left: "Left", bottom: "Bottom" }
  : { top: "Сверху", right: "Справа", left: "Слева", bottom: "Снизу" })[position];

export function InboxToolbar({ title, scopeLabel, titleId, count, position, english, onPosition, onHide }: {
  title: string; scopeLabel: string; titleId?: string; count: number; position: InboxPosition; english: boolean;
  onPosition: (position: InboxPosition) => void; onHide: () => void;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number; target: InboxPosition | null } | null>(null);
  const targetAt = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.closest("[data-inbox-workspace]")?.getBoundingClientRect();
    if (!rect || !drag || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return null;
    const y = (event.clientY - rect.top) / rect.height;
    return y < .25 ? "top" : y > .75 ? "bottom" : event.clientX < rect.left + rect.width / 2 ? "left" : "right";
  };
  return <>
    <header className="workspace-inbox-header inbox-move-bar">
      <button type="button" className="inbox-drag-handle" title={english ? "Drag to move the inbox" : "Перетащите плашку, чтобы переместить хаос-бокс"}
        aria-label={english ? "Move inbox" : "Переместить хаос-бокс"} aria-pressed={Boolean(drag)}
        onPointerDown={event => { if (event.button !== 0) return; event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDrag({ x: event.clientX, y: event.clientY, target: null }); }}
        onPointerMove={event => { if (drag) setDrag({ ...drag, target: targetAt(event) }); }}
        onPointerUp={event => { if (!drag) return; const target = targetAt(event); setDrag(null); if (target) onPosition(target); }}
        onPointerCancel={() => setDrag(null)} onLostPointerCapture={() => setDrag(null)}
        onKeyDown={event => { const target = ({ ArrowUp: "top", ArrowDown: "bottom", ArrowLeft: "left", ArrowRight: "right" } as Record<string, InboxPosition>)[event.key]; if (target) { event.preventDefault(); onPosition(target); } }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01" /></svg>
        <span id={titleId} className="inbox-heading"><span>{title}</span><span className="inbox-heading-scope">({scopeLabel})</span></span>
      </button>
      <small aria-label={english ? "Task and list count" : "Количество задач и списков"}>{count}</small>
      <button type="button" className="inbox-hide-button" onClick={onHide} title={english ? "Hide inbox" : "Скрыть хаос-бокс"} aria-label={english ? "Hide inbox" : "Скрыть хаос-бокс"}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.5 10.5a2.1 2.1 0 0 0 3 3M7 6.5C4.3 8.2 2 12 2 12s4 7 10 7c1.7 0 3.3-.5 4.8-1.4M10 5.2c.7-.1 1.3-.2 2-.2 6 0 10 7 10 7s-1.2 2.1-3.2 4" /></svg>
      </button>
    </header>
    <label className="inbox-position-choice"><span>{english ? "Position" : "Расположение"}</span>
      <select aria-label={english ? "Inbox position" : "Расположение хаос-бокса"} value={position} onChange={event => onPosition(event.target.value as InboxPosition)}>
        {positions.map(item => <option key={item} value={item}>{label(item, english)}</option>)}
      </select>
    </label>
    {drag?.target ? <div className="inbox-dock-preview" aria-live="polite">{english ? "Release to place" : "Отпустите для размещения"}: {label(drag.target, english)}</div> : null}
  </>;
}

export function InboxRestore({ english, onRestore }: { english: boolean; onRestore: () => void }) {
  return <button type="button" className="secondary-button inbox-restore" onClick={onRestore}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
    {english ? "Show inbox" : "Показать хаос-бокс"}
  </button>;
}
