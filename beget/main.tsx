import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GenesisCalendar } from "../app/GenesisCalendar";
import { AppUrlCleaner } from "../app/AppUrlCleaner";
import "../app/globals.css";
import "../app/experimental-theme.css";

const PRELOAD_RECOVERY_KEY = "genesis-preload-recovery-at";
const APP_BASE = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");

function registerProductionServiceWorker() {
  const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  if (process.env.NODE_ENV !== "production" || isLocalPreview || !("serviceWorker" in navigator)) return;

  let reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });
  void navigator.serviceWorker.register(`${APP_BASE}/sw.js`, {
    scope: `${APP_BASE || ""}/`,
    updateViaCache: "none",
  }).then((registration) => registration.update());
}

registerProductionServiceWorker();

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const previousRecovery = Number(sessionStorage.getItem(PRELOAD_RECOVERY_KEY)) || 0;
  if (Date.now() - previousRecovery < 30_000) return;
  sessionStorage.setItem(PRELOAD_RECOVERY_KEY, String(Date.now()));
  window.location.reload();
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("GENESIS root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <AppUrlCleaner />
    <GenesisCalendar />
  </StrictMode>,
);
