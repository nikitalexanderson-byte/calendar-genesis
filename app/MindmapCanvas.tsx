"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { layoutMap, type Mindmap, type MapNode, type MapView } from "./mindmaps-model";

export default function MindmapCanvas({ map, view, selected, title, onSelect, onZoom, onViewport }: {
  map: Mindmap; view: MapView; selected: string; title: (node: MapNode) => string;
  onSelect: (id: string) => void; onZoom: (zoom: number) => void; onViewport: (viewport: {left:number;top:number}) => void;
}) {
  const rows = useMemo(() => layoutMap(map, view), [map, view]);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewport, setViewport] = useState({ top: view.viewport?.top ?? 0, height: 800 });
  useEffect(() => {
    // Decryption may finish after the canvas first mounts. Restore after layout
    // and again when the persisted coordinates arrive, not only on map ID changes.
    const frame = requestAnimationFrame(() => scroller.current?.scrollTo({
      left: view.viewport?.left ?? 0, top: view.viewport?.top ?? 0, behavior: "instant",
    }));
    return () => cancelAnimationFrame(frame);
  }, [map.id, view.viewport?.left, view.viewport?.top]);
  useEffect(() => () => { if (scrollTimer.current) clearTimeout(scrollTimer.current); }, []);
  const width = Math.max(...rows.map(r => r.x)) + 280; const height = rows.length * 116 + 48;
  const byId = new Map(rows.map(r => [r.node.id, r]));
  // Large documents keep their geometry, but only visible buttons need DOM/layout.
  // Structure remains a complete native list for keyboard and assistive navigation.
  const paintedRows = rows.length <= 200 ? rows : rows.filter(r => r.node.id === selected
    || (r.y + 88 >= viewport.top / view.zoom - 200 && r.y <= (viewport.top + viewport.height) / view.zoom + 200));
  return <div className="mindmap-canvas-wrap">
    <div className="mindmap-toolbar" aria-label="Масштаб карты">
      <button type="button" onClick={() => onZoom(Math.max(.4, view.zoom - .2))} aria-label="Уменьшить масштаб">−</button>
      <span>{Math.round(view.zoom * 100)}%</span>
      <button type="button" onClick={() => onZoom(Math.min(2, view.zoom + .2))} aria-label="Увеличить масштаб">+</button>
      <button type="button" onClick={() => { onZoom(1); scroller.current?.scrollTo({ left: 0, top: 0 }); }}>К началу</button>
      <button type="button" onClick={() => { const r = byId.get(selected); if (r) scroller.current?.scrollTo({ left: Math.max(0, r.x * view.zoom - 32), top: Math.max(0, r.y * view.zoom - 32) }); }}>К выбранному узлу</button>
    </div>
    {/* Keyboard focus permits native arrow-key scrolling of this bounded canvas. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div className="mindmap-canvas" ref={scroller} tabIndex={0} role="region" aria-label="Полотно карты: прокрутка и перемещение по пустому месту"
      onScroll={e => { setViewport({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight }); if(scrollTimer.current) clearTimeout(scrollTimer.current); scrollTimer.current=setTimeout(()=>{if(scroller.current)onViewport({left:scroller.current.scrollLeft,top:scroller.current.scrollTop});},180); }}
      onPointerDown={e => { if (e.button !== 0 || (e.target as Element).closest('button')) return; const el = scroller.current!; drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }; el.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (!drag.current) return; scroller.current!.scrollLeft = drag.current.left + drag.current.x - e.clientX; scroller.current!.scrollTop = drag.current.top + drag.current.y - e.clientY; }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div style={{ width: width * view.zoom, height: height * view.zoom, position: "relative" }}>
        <div className="mindmap-plane" style={{ width, height, transform: `scale(${view.zoom})` }}>
          <svg width={width} height={height} aria-hidden="true">
            {rows.map(r => { const p = byId.get(r.node.parentId ?? ""); return p ? <path key={r.node.id} d={`M${p.x + 240} ${p.y + 44} C${p.x + 270} ${p.y + 44},${r.x - 30} ${r.y + 44},${r.x} ${r.y + 44}`} /> : null; })}
            {map.links.filter(l => l.from === selected || l.to === selected).map(l => { const a = byId.get(l.from), b = byId.get(l.to); return a && b ? <g key={l.id}><path className="mindmap-semantic" d={`M${a.x + 120} ${a.y + 88} Q${Math.max(a.x,b.x) + 260} ${(a.y + b.y)/2},${b.x + 120} ${b.y}`} /><text x={a.x + 130} y={a.y + 107}>{l.label || "Связано с"}</text></g> : null; })}
          </svg>
          {paintedRows.map(r => <button key={r.node.id} type="button" className="mindmap-graph-node" aria-pressed={selected === r.node.id}
            style={{ left: r.x, top: r.y }} onClick={() => onSelect(r.node.id)} title={title(r.node)}>
            <span>{r.node.kind === "idea" ? "Мысль" : r.node.kind === "task" ? "Задача GENESIS" : "Проект GENESIS"}</span>
            <strong data-no-translate>{title(r.node)}</strong>
            {view.collapsed.includes(r.node.id) ? <small>Ветка свёрнута</small> : null}
          </button>)}
        </div>
      </div>
    </div>
  </div>;
}
