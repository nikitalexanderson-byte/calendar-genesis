"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { MONTHS, PYATA_DETAILS, getGregorianDate, getSacredDate, getSacredDay } from "./calendar-data";
import { DialogCloseButton } from "./DialogCloseButton";
import { useDialogAccessibility } from "./use-dialog-accessibility";
import { translateText, type Language } from "./i18n";
import { SOLAR_OVERVIEW, clampSolarCamera, fitSolarElement, zoomSolarCamera, type SolarCamera } from "./solar-calendar-camera";
import "./solar-calendar-explorer.css";

type Selection = { kind: "month" | "pentad" | "day"; month: number; day: number };
type Point = { x: number; y: number };
const ASSET = "/calendar-art/genesis-sacred-calendar-v8.svg";
const readSelection = (node: Element): Selection => ({ kind: node.getAttribute("data-kind") as Selection["kind"], month: Number(node.getAttribute("data-month")) - 1,
  day: Number(node.getAttribute("data-day") || node.getAttribute("data-first") || 1) });
const selectorFor = (s: Selection) => s.kind === "pentad" ? `[data-kind="pentad"][data-month="${s.month + 1}"][data-pentad="${Math.ceil(s.day / 5)}"]`
  : `[data-kind="${s.kind}"][data-month="${s.month + 1}"]${s.kind === "day" ? `[data-day="${s.day}"]` : ""}`;

export default function SolarCalendarExplorer({ year, language, onClose, onOpenDate }: {
  year: number; language: Language; onClose: () => void; onOpenDate: (month: number, day: number) => void;
}) {
  const english = language === "en";
  const dialogRef = useDialogAccessibility<HTMLElement>(onClose);
  const host = useRef<HTMLDivElement>(null);
  const camera = useRef<SolarCamera>({ ...SOLAR_OVERVIEW });
  const frame = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [selection, setSelection] = useState<Selection | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ origin: Point; camera: SolarCamera; distance: number } | null>(null);
  const moved = useRef(false);
  const hovered = useRef<Element | null>(null);
  const moveCamera = useCallback((target: SolarCamera, animate = true) => {
    cancelAnimationFrame(frame.current);
    const next = clampSolarCamera(target), start = { ...camera.current }, started = performance.now();
    const duration = animate && !matchMedia("(prefers-reduced-motion: reduce)").matches ? 520 : 0;
    setZoom(Math.round(500000 / next.size));
    const tick = (now: number) => {
      const progress = duration ? Math.min(1, (now - started) / duration) : 1;
      const ease = 1 - Math.pow(1 - progress, 4);
      camera.current = { x: start.x + (next.x - start.x) * ease, y: start.y + (next.y - start.y) * ease, size: start.size + (next.size - start.size) * ease };
      const { x, y, size } = camera.current;
      host.current?.querySelector("svg")?.setAttribute("viewBox", `${x} ${y} ${size} ${size}`);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(ASSET, { signal: controller.signal }).then(response => { if (!response.ok) throw Error("SVG_UNAVAILABLE"); return response.text(); }).then(source => {
      const document = new DOMParser().parseFromString(source, "image/svg+xml");
      const svg = document.documentElement;
      if (svg.localName !== "svg" || document.querySelector("parsererror")) throw Error("SVG_INVALID");
      const imported = window.document.importNode(svg, true);
      imported.querySelectorAll<SVGElement>("[data-kind]").forEach((node, index) => {
        const s = readSelection(node), month = translateText(MONTHS[s.month].name, language);
        const label = s.kind === "month" ? month : s.kind === "pentad" ? `${month} · ${english ? "Pentad" : "Пята"} ${Math.ceil(s.day / 5)}` : `${month} · ${english ? "Day" : "День"} ${s.day}`;
        node.setAttribute("role", "button"); node.setAttribute("aria-label", label); node.setAttribute("tabindex", index === 0 ? "0" : "-1");
      });
      host.current?.replaceChildren(imported); setReady(true);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); cancelAnimationFrame(frame.current); };
  }, [attempt, language, english]);

  useEffect(() => {
    const node = host.current;
    if (!ready || !node) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); moveCamera(zoomSolarCamera(camera.current, Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * .004)), false); };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [ready, moveCamera]);

  const select = (next: Selection, focus = false) => {
    const node = host.current?.querySelector<SVGGraphicsElement>(selectorFor(next));
    if (!node) return;
    host.current?.querySelectorAll("[data-selected]").forEach(item => item.removeAttribute("data-selected"));
    host.current?.querySelectorAll('[tabindex="0"]').forEach(item => item.setAttribute("tabindex", "-1"));
    node.setAttribute("data-selected", "true"); node.setAttribute("tabindex", "0");
    if (focus) node.focus({ preventScroll: true });
    setSelection(next);
    // getBBox is in the SVG's own coordinates, independent of the current camera.
    moveCamera(fitSolarElement(node.getBBox()));
  };
  const reset = () => { setSelection(null); host.current?.querySelectorAll("[data-selected]").forEach(node => node.removeAttribute("data-selected")); moveCamera(SOLAR_OVERVIEW); };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target.closest<SVGGraphicsElement>("[data-kind]") : null;
    if (!target) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(readSelection(target)); }
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const siblings = [...host.current!.querySelectorAll<SVGGraphicsElement>(`[data-kind="${target.dataset.kind}"]`)];
    const next = siblings[(siblings.indexOf(target) + direction + siblings.length) % siblings.length];
    select(readSelection(next), true);
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    cancelAnimationFrame(frame.current);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()]; moved.current = points.length > 1;
    gesture.current = { origin: points[0], camera: { ...camera.current }, distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0 };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()], start = gesture.current;
    if (points.length > 1) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (distance && start.distance) moveCamera(zoomSolarCamera(start.camera, start.distance / distance), false);
      moved.current = true; return;
    }
    const dx = event.clientX - start.origin.x, dy = event.clientY - start.origin.y;
    if (Math.hypot(dx, dy) < 5 && !moved.current) return;
    moved.current = true; event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect(), ratio = start.camera.size / Math.min(bounds.width, bounds.height);
    moveCamera({ ...start.camera, x: start.camera.x - dx * ratio, y: start.camera.y - dy * ratio }, false);
  };
  const pointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const remaining = [...pointers.current.values()][0];
    gesture.current = remaining ? { origin: remaining, camera: { ...camera.current }, distance: 0 } : null;
  };
  const month = selection?.month ?? 0, day = selection?.day ?? 1, pentad = Math.ceil(day / 5);
  const currentMonth = MONTHS[month], dayLimit = month === 12 ? getSacredDate(getGregorianDate(year,0,1)).apeironDays : 30;
  const sacredDay = getSacredDay(month, day);
  const exists = day <= dayLimit;
  const date = exists ? getGregorianDate(year, month, day) : null;
  const monthLabel = translateText(currentMonth.name, language);
  return <div className="modal-backdrop solar-model-backdrop">
    <section ref={dialogRef} className="solar-model-dialog" role="dialog" aria-modal="true" aria-labelledby="solar-model-title" aria-describedby="solar-model-help" tabIndex={-1}>
      <header className="solar-model-header"><div><h2 id="solar-model-title">{english ? "GENESIS circle" : "Круг GENESIS"}</h2><p>{english ? "Solar calendar" : "Солнечный календарь"} · {year}</p></div>
        <DialogCloseButton onClick={onClose} aria-label={english ? "Close calendar model" : "Закрыть модель календаря"} /></header>
      <div className="solar-model-layout">
        <div className="solar-model-canvas">
          <div className="solar-model-toolbar"><button type="button" onClick={reset} disabled={!ready}>{english ? "Whole circle" : "Весь круг"}</button>
            <div><button type="button" disabled={!ready || zoom <= 100} onClick={() => moveCamera(zoomSolarCamera(camera.current, 1.4))} aria-label={english ? "Zoom out" : "Отдалить"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg></button>
              <output aria-label={english ? "Scale" : "Масштаб"}>{zoom}%</output>
              <button type="button" disabled={!ready || zoom >= 1563} onClick={() => moveCamera(zoomSolarCamera(camera.current, 1 / 1.4))} aria-label={english ? "Zoom in" : "Приблизить"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg></button></div></div>
          {/* SVG buttons own keyboard focus; this group delegates their pointer and key events. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div ref={host} className="solar-svg-host" role="group" aria-label={english ? "Interactive calendar circle" : "Интерактивный круг календаря"} aria-describedby="solar-model-help"
            onClick={event => { if (moved.current) return; const target = event.target instanceof Element ? event.target.closest("[data-kind]") : null; if (target) select(readSelection(target)); }}
            onKeyDown={keyboard} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
            onPointerOver={event => { const target = event.target instanceof Element ? event.target.closest("[data-kind]") : null; if (target === hovered.current) return; hovered.current?.removeAttribute("data-hovered"); target?.setAttribute("data-hovered", "true"); hovered.current = target; }}
            onPointerLeave={() => { hovered.current?.removeAttribute("data-hovered"); hovered.current = null; pointers.current.clear(); gesture.current = null; }} />
          {!ready ? <div className="solar-model-loading" role={failed ? "alert" : "status"}><p>{failed ? (english ? "The calendar could not load." : "Не удалось загрузить календарь.") : (english ? "Loading the circle…" : "Открываем круг…")}</p>
            {failed ? <button type="button" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>{english ? "Retry" : "Повторить"}</button> : null}</div> : null}
          <p id="solar-model-help" className="solar-model-help">{english ? "Select a month, pentad or day to explore. Drag to move; use the wheel or pinch to zoom." : "Нажмите на месяц, пяту или день, чтобы приблизить. Перетаскивайте круг; меняйте масштаб колёсиком или двумя пальцами."}</p>
        </div>
        <aside className="solar-model-inspector" aria-label={english ? "Calendar navigation" : "Навигация по кругу"}>
          <div className="solar-model-selectors">
            <label>{english ? "Month" : "Месяц"}<select value={selection ? month : ""} disabled={!ready} onChange={e => select({ kind: "month", month: Number(e.target.value), day: 1 })}><option value="" disabled>{english ? "Choose a month" : "Выберите месяц"}</option>{MONTHS.map(item => <option key={item.index} value={item.index}>{translateText(item.name, language)}</option>)}</select></label>
            <label>{english ? "Pentad" : "Пята"}<select value={selection?.kind === "month" || !selection ? "" : pentad} disabled={!ready || !selection || month === 12} onChange={e => select({ kind: "pentad", month, day: (Number(e.target.value) - 1) * 5 + 1 })}><option value="" disabled>{english ? "Choose a pentad" : "Выберите пяту"}</option>{PYATA_DETAILS.map((item,index) => <option value={index + 1} key={item.title}>{index + 1} · {translateText(item.title,language)}</option>)}</select></label>
            <label>{english ? "Day" : "День"}<select value={selection?.kind === "day" ? day : ""} disabled={!ready || !selection} onChange={e => select({ kind: "day", month, day: Number(e.target.value) })}><option value="" disabled>{english ? "Choose a day" : "Выберите день"}</option>{Array.from({ length: dayLimit }, (_,index) => <option value={index+1} key={index}>{index + 1} · {translateText(getSacredDay(month,index+1).name.split("(")[0].trim(),language)}</option>)}</select></label>
          </div>
          <div className="solar-model-selection" aria-live="polite">
            <h3>{selection ? selection.kind === "day" ? translateText(sacredDay.name.split("(")[0].trim(),language) : monthLabel : (english ? "A year in one circle" : "Год в одном круге")}</h3>
            <p>{selection ? selection.kind === "month" ? translateText(currentMonth.title,language) : selection.kind === "pentad" ? translateText(PYATA_DETAILS[pentad-1].description,language) : translateText(sacredDay.description,language) : (english ? "12 months, 72 pentads and 360 days. Apeiron lies at the centre, outside the regular count." : "12 месяцев, 72 пяты и 360 дней. В центре — Апейрон, вне обычного счёта.")}</p>
            {selection && selection.kind !== "month" && date ? <time dateTime={`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}>{date.toLocaleDateString(english ? "en-GB" : "ru-RU", { day:"numeric", month:"long", year:"numeric" })}{selection.kind === "pentad" ? ` — ${getGregorianDate(year,month,Math.min(day+4,dayLimit)).toLocaleDateString(english ? "en-GB" : "ru-RU",{day:"numeric",month:"long"})}` : ""}</time> : null}
            {selection && !exists ? <p>{english ? "This unmanifest day is not part of the selected year." : "В выбранном году этот неявный день не входит в календарный счёт."}</p> : null}
            {selection ? <button type="button" className="solar-model-open-day" disabled={!exists} onClick={() => onOpenDate(month,day)}>{english ? "Open day in calendar" : "Открыть день в календаре"}</button> : null}
          </div>
        </aside>
      </div>
    </section>
  </div>;
}
