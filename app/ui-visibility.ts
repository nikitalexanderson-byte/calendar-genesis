import type { CalendarMode } from "./calendar-data";

export type UiVisibility = {
  hiddenMenuItems: string[];
  hiddenSubmenus: string[];
  hiddenTodayBlocks: string[];
  enabledCalendars: CalendarMode[];
};

export const DEFAULT_UI_VISIBILITY: UiVisibility = {
  hiddenMenuItems: [], hiddenSubmenus: [], hiddenTodayBlocks: [],
  enabledCalendars: ["profane", "sacred", "lunar"],
};

export function uiVisibility(value?: Partial<UiVisibility> | null): UiVisibility {
  return {
    hiddenMenuItems: value?.hiddenMenuItems ?? [],
    hiddenSubmenus: value?.hiddenSubmenus ?? [],
    hiddenTodayBlocks: value?.hiddenTodayBlocks ?? [],
    enabledCalendars: value?.enabledCalendars?.length ? value.enabledCalendars : DEFAULT_UI_VISIBILITY.enabledCalendars,
  };
}

export function viewIsVisible(view: string, settings: UiVisibility): boolean {
  if (view === "today" || view === "admin") return true;
  if ((view === "stoicheion" || view === "theokyklos") && settings.hiddenMenuItems.includes("sacred")) return false;
  const parent = view === "all-tasks" ? "tasks" : view === "year" ? "calendar" : view;
  if (settings.hiddenMenuItems.includes(parent)) return false;
  if (view === "calendar" && settings.hiddenSubmenus.includes("calendar.month")) return false;
  if (view === "year" && settings.hiddenSubmenus.includes("calendar.year")) return false;
  return true;
}
