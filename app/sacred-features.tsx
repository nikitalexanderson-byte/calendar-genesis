"use client";
import { createContext, useContext } from "react";
import type { CalendarMode } from "./calendar-data";

export const SacredFeaturesContext = createContext(true);
export const useSacredFeaturesEnabled = () => useContext(SacredFeaturesContext);

/** Existing saved calendars remain readable; hidden calendars are not offered for new records. */
export function useCalendarModeAvailable(current?: CalendarMode) {
  const enabled = useSacredFeaturesEnabled();
  return (mode: CalendarMode) => enabled || mode !== "sacred" || current === "sacred";
}
