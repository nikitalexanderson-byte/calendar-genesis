import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";

const clamp = (width: number) => Math.round(Math.max(56, Math.min(240, width)));

export function useSidebarCollapse(savedWidth: number, delaySeconds: number, saveWidth: (width: number) => void) {
  const [drag, setDrag] = useState<{ x: number; initial: number; width: number } | null>(null);
  const width = drag?.width ?? savedWidth;
  const sidebarRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const [hidden, setHidden] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const escapeFocus = useRef(false);
  const autoHide = delaySeconds > 0 && desktop;
  const cancel = () => clearTimeout(timer.current);
  const reveal = () => { cancel(); setHidden(false); };

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1200px)");
    const update = () => { setDesktop(media.matches); setHidden(false); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const handle = revealRef.current;
    if (!sidebar || !autoHide || drag) { setHidden(false); return; }
    const surfaces = [sidebar, handle].filter((node): node is HTMLElement => Boolean(node));
    const cancel = () => clearTimeout(timer.current);
    const schedule = () => {
      cancel();
      if (surfaces.some(node => node.matches(":hover") || node.contains(document.activeElement))) return;
      timer.current = setTimeout(() => setHidden(true), delaySeconds * 1000);
    };
    const onBlur = (event: FocusEvent) => {
      if (!surfaces.some(node => node.contains(event.relatedTarget as Node | null))) schedule();
    };
    const onEnter = () => { cancel(); setHidden(false); };
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); cancel(); escapeFocus.current = true;
      handle?.focus(); setHidden(true);
      window.requestAnimationFrame(() => { escapeFocus.current = false; });
    };
    for (const node of surfaces) {
      node.addEventListener("pointerenter", onEnter);
      node.addEventListener("pointerleave", schedule);
      node.addEventListener("focusin", cancel);
      node.addEventListener("focusout", onBlur);
    }
    sidebar.addEventListener("keydown", onEscape);
    schedule();
    return () => {
      cancel();
      for (const node of surfaces) {
        node.removeEventListener("pointerenter", onEnter);
        node.removeEventListener("pointerleave", schedule);
        node.removeEventListener("focusin", cancel);
        node.removeEventListener("focusout", onBlur);
      }
      sidebar.removeEventListener("keydown", onEscape);
    };
  }, [drag, autoHide, delaySeconds]);
  const resizeProps = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      reveal();
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ x: event.clientX, initial: width, width });
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (drag) setDrag({ ...drag, width: clamp(drag.initial + event.clientX - drag.x) });
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (!drag) return;
      saveWidth(clamp(drag.initial + event.clientX - drag.x)); setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
    onLostPointerCapture: () => setDrag(null),
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      const next = event.key === "ArrowLeft" ? width - 16 : event.key === "ArrowRight" ? width + 16
        : event.key === "Home" ? 56 : event.key === "End" ? 240 : null;
      if (next !== null) { event.preventDefault(); saveWidth(clamp(next)); }
    },
  };
  const revealProps = {
    onFocus: () => { if (!escapeFocus.current) reveal(); },
    onClick: () => { reveal(); requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>("button, a[href], [tabindex='0']")?.focus()); },
  };
  return { width, collapsed: width < 144, resizing: Boolean(drag), sidebarRef, resizeProps,
    autoHide, hidden: autoHide && hidden && !drag, revealRef, revealProps };
}
