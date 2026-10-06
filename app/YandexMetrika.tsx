"use client";

import { useEffect } from "react";

const COUNTER_ID = 113449674;
const TAG_URL = `https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}`;
const PUBLIC_PATHS = new Set(["/", "/privacy", "/terms", "/support", "/delete-account"]);
const APP_VIEWS = new Set([
  "today", "calendar", "projects", "year", "all-tasks", "habits", "stoicheion", "theokyklos", "admin",
]);

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

function safePageUrl(): string {
  const path = PUBLIC_PATHS.has(window.location.pathname) ? window.location.pathname : "/";
  const view = window.location.hash.replace(/^#\/?/, "").split(/[?&]/, 1)[0];
  return `${window.location.origin}${path}${path === "/" && APP_VIEWS.has(view) ? `#${view}` : ""}`;
}

/** Counts public pages and named app sections without sending queries, task links or titles. */
export function YandexMetrika() {
  useEffect(() => {
    if (window.location.hostname !== "genesiscalendar.ru") return;
    // The tag can inspect the current browser URL even with deferred page views.
    // Never load it on an OAuth callback or any other URL carrying query data.
    const initialView = window.location.hash.replace(/^#\/?/, "").split(/[?&]/, 1)[0];
    if (window.location.search || (window.location.hash && !APP_VIEWS.has(initialView))) return;
    if (!window.ym) {
      const queue = ((...args: unknown[]) => { (queue.a ??= []).push(args); }) as
        ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
      queue.l = Date.now();
      window.ym = queue;
    }
    if (!document.querySelector(`script[src="${TAG_URL}"]`)) {
      const tag = document.createElement("script");
      tag.async = true;
      tag.src = TAG_URL;
      document.head.appendChild(tag);
    }
    window.ym(COUNTER_ID, "init", {
      ssr: true,
      defer: true,
      webvisor: false,
      clickmap: false,
      trackLinks: false,
      sendTitle: false,
      accurateTrackBounce: true,
    });
    let lastPage = "";
    const recordPage = () => {
      const page = safePageUrl();
      if (page === lastPage) return;
      lastPage = page;
      window.ym?.(COUNTER_ID, "hit", page);
    };
    const initial = window.setTimeout(recordPage, 0);
    window.addEventListener("genesis:route", recordPage);
    window.addEventListener("hashchange", recordPage);
    window.addEventListener("popstate", recordPage);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("genesis:route", recordPage);
      window.removeEventListener("hashchange", recordPage);
      window.removeEventListener("popstate", recordPage);
    };
  }, []);
  return null;
}
