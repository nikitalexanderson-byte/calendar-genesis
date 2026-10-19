import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./account-discovery.css";

export function useAccountGuide(userId: string) {
  const [target, targetRef] = useState<HTMLButtonElement | null>(null);
  const [request, setRequest] = useState<{ userId: string; at: number } | null>(null);
  const [arrow, setArrow] = useState(false);
  const [highlighted, setHighlighted] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; tip: number } | null>(null);
  const active = Boolean(userId && request?.userId === userId);
  const start = useCallback(() => {
    if (!userId || !target) return;
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    target.focus({ preventScroll: true });
    setArrow(true); setHighlighted(true);
    setRequest({ userId, at: Date.now() });
  }, [userId, target]);

  useEffect(() => {
    if (!active || !request) return;
    const arrowTimer = window.setTimeout(() => setArrow(false), Math.max(0, request.at + 15_000 - Date.now()));
    const highlightTimer = window.setTimeout(() => setHighlighted(false), Math.max(0, request.at + 15 * 60_000 - Date.now()));
    return () => { window.clearTimeout(arrowTimer); window.clearTimeout(highlightTimer); };
  }, [active, request]);

  useEffect(() => {
    if (!active || !arrow || !target) return;
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        if (!rect.width || rect.bottom < 0 || rect.top > window.innerHeight) { setPosition(null); return; }
        const center = rect.left + rect.width / 2;
        const left = Math.max(8, Math.min(window.innerWidth - 118, center - 80));
        setPosition({ left, top: rect.bottom + 8, tip: center - left });
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(target);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      resize.disconnect(); window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [active, arrow, target]);

  const overlay = active && arrow && position && typeof document !== "undefined" ? createPortal(
    <svg className="account-guide-arrow" width="110" height="110" viewBox="0 0 110 110" aria-hidden="true" focusable="false"
      style={{ left: position.left, top: position.top }}>
      <path className="account-guide-stroke" d={`M10 94 C70 101 ${position.tip + 20} 51 ${position.tip} 5 M${position.tip - 11} 18 L${position.tip} 5 L${position.tip + 12} 17`} />
    </svg>, document.body) : null;
  return { targetRef, start, highlighted: active && highlighted, overlay };
}
