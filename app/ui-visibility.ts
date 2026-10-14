import type { CalendarMode } from "./calendar-data";

export type InboxPosition = "top" | "right" | "left" | "bottom";
export type AccountLayout = {
  sidebarWidth: number;
  personalInboxPosition: InboxPosition;
  personalInboxHidden: boolean;
  personalInboxCompact: boolean;
  personalInboxWidth: number;
  sharedInboxPosition: InboxPosition;
  sharedInboxHidden: boolean;
  sharedInboxCompact: boolean;
  sharedInboxWidth: number;
  sharedCategoriesExpanded: boolean;
  personalCategoriesExpanded: boolean;
  personalCategoriesView: "cards" | "list";
  sharedCategoriesView: "cards" | "list";
};
export const DEFAULT_ACCOUNT_LAYOUT: AccountLayout = {
  sidebarWidth: 240, personalInboxPosition: "right", personalInboxHidden: false, personalInboxCompact: false,
  sharedInboxPosition: "right", sharedInboxHidden: false, sharedInboxCompact: false,
  sharedCategoriesExpanded: false,
  personalCategoriesExpanded: false, personalCategoriesView: "cards", sharedCategoriesView: "list",
  personalInboxWidth: 300, sharedInboxWidth: 300,
};
export function accountLayout(value?: Partial<AccountLayout> | null): AccountLayout {
  const position = (input?: InboxPosition): InboxPosition => input && ["top", "right", "left", "bottom"].includes(input) ? input : "right";
  return {
    sidebarWidth: Number.isInteger(value?.sidebarWidth) ? Math.max(56, Math.min(240, value!.sidebarWidth!)) : 240,
    personalInboxPosition: position(value?.personalInboxPosition), personalInboxHidden: value?.personalInboxHidden === true,
    personalInboxCompact: value?.personalInboxCompact === true,
    sharedInboxPosition: position(value?.sharedInboxPosition), sharedInboxHidden: value?.sharedInboxHidden === true,
    sharedInboxCompact: value?.sharedInboxCompact === true,
    sharedCategoriesExpanded: value?.sharedCategoriesExpanded === true,
    personalCategoriesExpanded: value?.personalCategoriesExpanded === true,
    personalCategoriesView: value?.personalCategoriesView === "list" ? "list" : "cards",
    sharedCategoriesView: value?.sharedCategoriesView === "cards" ? "cards" : "list",
    personalInboxWidth: Number.isInteger(value?.personalInboxWidth) ? Math.max(300, Math.min(5000, value!.personalInboxWidth!)) : 300,
    sharedInboxWidth: Number.isInteger(value?.sharedInboxWidth) ? Math.max(300, Math.min(5000, value!.sharedInboxWidth!)) : 300,
  };
}

export type UiVisibility = AccountLayout & {
  hiddenMenuItems: string[];
  hiddenSubmenus: string[];
  hiddenTodayBlocks: string[];
  enabledCalendars: CalendarMode[];
  sidebarAutoCollapseSeconds: number;
};

export const DEFAULT_UI_VISIBILITY: UiVisibility = {
  ...DEFAULT_ACCOUNT_LAYOUT,
  hiddenMenuItems: [], hiddenSubmenus: [], hiddenTodayBlocks: [],
  enabledCalendars: ["profane", "sacred", "lunar"],
  sidebarAutoCollapseSeconds: 0,
};

export function uiVisibility(value?: Partial<UiVisibility> | null): UiVisibility {
  return {
    ...accountLayout(value),
    hiddenMenuItems: value?.hiddenMenuItems ?? [],
    hiddenSubmenus: value?.hiddenSubmenus ?? [],
    hiddenTodayBlocks: value?.hiddenTodayBlocks ?? [],
    enabledCalendars: value?.enabledCalendars?.length ? value.enabledCalendars : DEFAULT_UI_VISIBILITY.enabledCalendars,
    sidebarAutoCollapseSeconds: [0, 15, 30, 60, 120, 300].includes(value?.sidebarAutoCollapseSeconds ?? 0)
      ? value?.sidebarAutoCollapseSeconds ?? 0 : 0,
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
