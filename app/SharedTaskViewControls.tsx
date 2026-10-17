"use client";
import { useSyncExternalStore, type ReactNode } from "react";

const query = "(max-width: 760px)";
const compactSnapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => true;
const subscribe = (changed: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", changed);
  return () => media.removeEventListener("change", changed);
};

/** Keep the DOM and keyboard order aligned with each responsive layout. */
export function SharedTaskViewControls({mindmaps, sorting, search}: {
  mindmaps: ReactNode; sorting: ReactNode; search: ReactNode;
}) {
  const compact = useSyncExternalStore(subscribe, compactSnapshot, serverSnapshot);
  return <div className="shared-task-view-controls">
    {compact ? mindmaps : null}{sorting}{search}{compact ? null : mindmaps}
  </div>;
}
