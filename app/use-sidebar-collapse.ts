import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";

const clamp = (width: number) => Math.round(Math.max(56, Math.min(240, width)));

export function useSidebarCollapse(savedWidth: number, delaySeconds: number, saveWidth: (width: number) => void) {
  const [drag, setDrag] = useState<{ x: number; initial: number; width: number } | null>(null);
  const width = drag?.width ?? savedWidth;
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || drag || width === 56 || !delaySeconds) return;
    const desktop = window.matchMedia("(min-width: 1200px)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => { clearTimeout(timer); };
    const schedule = () => {
      cancel();
      if (!desktop.matches || sidebar.matches(":hover") || sidebar.contains(document.activeElement)) return;
      timer = setTimeout(() => saveWidth(56), delaySeconds * 1000);
    };
    const onBlur = (event: FocusEvent) => {
      if (!sidebar.contains(event.relatedTarget as Node | null)) schedule();
    };
    sidebar.addEventListener("pointerenter", cancel);
    sidebar.addEventListener("pointerleave", schedule);
    sidebar.addEventListener("focusin", cancel);
    sidebar.addEventListener("focusout", onBlur);
    desktop.addEventListener("change", schedule);
    schedule();
    return () => {
      cancel();
      sidebar.removeEventListener("pointerenter", cancel);
      sidebar.removeEventListener("pointerleave", schedule);
      sidebar.removeEventListener("focusin", cancel);
      sidebar.removeEventListener("focusout", onBlur);
      desktop.removeEventListener("change", schedule);
    };
  }, [drag, width, delaySeconds, saveWidth]);
  const resizeProps = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
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
  return { width, collapsed: width < 144, resizing: Boolean(drag), sidebarRef, resizeProps };
}
