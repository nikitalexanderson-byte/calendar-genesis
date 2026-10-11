import { useCallback, useEffect, useRef, useState } from "react";

export function useSidebarCollapse(delaySeconds: number) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const toggle = useCallback(() => setCollapsed(value => !value), []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || collapsed || !delaySeconds) return;
    const desktop = window.matchMedia("(min-width: 1200px)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => { clearTimeout(timer); };
    const schedule = () => {
      cancel();
      if (!desktop.matches || sidebar.matches(":hover") || sidebar.contains(document.activeElement)) return;
      timer = setTimeout(() => setCollapsed(true), delaySeconds * 1000);
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
  }, [collapsed, delaySeconds]);
  return { collapsed, sidebarRef, toggle };
}
