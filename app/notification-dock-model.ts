export type NoticeActivity = { count: number; tokens: string[]; title: string };
export type DockPosition = { x: number; y: number };
export type DockBounds = { left: number; top: number; right: number; bottom: number };
export type DockSize = { width: number; height: number };
export const NOTIFICATION_PREVIEW_MS = 5000;

export function clampDockSize(size: DockSize, bounds: DockBounds): DockSize {
  const width = Math.max(0, bounds.right - bounds.left), height = Math.max(0, bounds.bottom - bounds.top);
  return { width: Math.min(Math.max(size.width, 320), 760, width), height: Math.min(Math.max(size.height, 240), 820, height) };
}

export function clampDockPosition(position: DockPosition, bounds: DockBounds, width: number, height: number): DockPosition {
  return {
    x: Math.min(Math.max(position.x, bounds.left), Math.max(bounds.left, bounds.right - width)),
    y: Math.min(Math.max(position.y, bounds.top), Math.max(bounds.top, bounds.bottom - height)),
  };
}

export function dockHome(bounds: DockBounds, width: number, height: number, mobile: boolean): DockPosition {
  return clampDockPosition({ x: mobile ? bounds.right - width : bounds.left, y: bounds.bottom - height }, bounds, width, height);
}

/** Each unread event previews once per mounted account; collapsing never reads it. */
export function newestUnseenToken(tokens: string[], seen: Set<string>): string | null {
  const newest = tokens.find(token => !seen.has(token)) ?? null;
  for (const token of tokens) seen.add(token);
  return newest;
}
