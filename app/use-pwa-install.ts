"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const APP_BASE = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [isStandalone, setStandalone] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );

  useEffect(() => {
    const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (process.env.NODE_ENV === "production" && !isLocalPreview && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(`${APP_BASE}/sw.js`, {
        scope: `${APP_BASE || ""}/`,
      });
    }

    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setPrompt(null);
      setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = async () => {
    if (!prompt) return false;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setPrompt(null);
    return choice.outcome === "accepted";
  };

  return { canInstall: Boolean(prompt), install, isStandalone };
}
