"use client";
import { useEffect, useState } from "react";
import { loadSharedCalendarPreviews } from "./cloud-sync";

type Preview = Awaited<ReturnType<typeof loadSharedCalendarPreviews>>;

/** One bounded month request, only while the desktop plain calendar is visible. */
export function useCalendarTaskPreviews(userId: string | undefined, from: string, to: string, enabled: boolean) {
  const key = JSON.stringify([userId, from, to, enabled]);
  const [state, setState] = useState<{key:string;data:Preview} | null>(null);
  useEffect(() => {
    if (!userId || !enabled) return;
    const media = window.matchMedia("(min-width: 1100px)");
    let controller: AbortController | null = null;
    let live = true;
    const refresh = () => {
      controller?.abort();
      if (!media.matches) return;
      const current = new AbortController(); controller = current;
      void loadSharedCalendarPreviews(from, to, current.signal).then(data => {
        if (live && !current.signal.aborted) setState({key,data});
      }).catch(() => { if (live && !current.signal.aborted) setState(null); });
    };
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) refresh();
    }, 30000);
    media.addEventListener("change", refresh);
    window.addEventListener("genesis:shared-updates", refresh);
    return () => {
      live = false; controller?.abort(); window.clearInterval(timer);
      media.removeEventListener("change", refresh);
      window.removeEventListener("genesis:shared-updates", refresh);
    };
  }, [key, userId, from, to, enabled]);
  return state?.key === key ? state.data : null;
}
