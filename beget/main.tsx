import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GenesisCalendar } from "../app/GenesisCalendar";
import "../app/globals.css";

const PRELOAD_RECOVERY_KEY = "genesis-preload-recovery-at";

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
    <GenesisCalendar />
  </StrictMode>,
);
