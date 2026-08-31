import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GenesisCalendar } from "../app/GenesisCalendar";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("GENESIS root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <GenesisCalendar />
  </StrictMode>,
);
