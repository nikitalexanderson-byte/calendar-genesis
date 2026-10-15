"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadSharedOverview, loadSharedInbox, readSharedInbox, readSharedTaskUpdates, type SharedOverview, type SharedNotification } from "./cloud-sync";
type Updates = { overview: SharedOverview | null; comments: SharedNotification[]; error: boolean;
  notifications: SharedNotification[]; nextCursor: string | null; loadingMore: boolean; moreError: boolean; loadMore: () => Promise<void>;
  refresh: () => void; markRead: (ids: string[], all?: boolean) => Promise<void>;
  markTaskRead: (projectId: string, taskId: string, commentIds: string[], signal?: AbortSignal) => Promise<void> };
const UpdatesContext = createContext<Updates>({ overview: null, comments: [], notifications: [], nextCursor: null, loadingMore: false, moreError: false, loadMore: async () => {}, error: false, refresh: () => {}, markRead: async () => {}, markTaskRead: async () => {} });

export function SharedUpdatesProvider({ userId, enabled, children }: { userId: string; enabled: boolean; children: ReactNode }) {
  const [overview, setOverview] = useState<SharedOverview | null>(null);
  const [notifications, setNotifications] = useState<SharedNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const paging = useRef<AbortController | null>(null), refreshing = useRef<AbortController | null>(null), loaded = useRef(0), controllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const readGeneration = useRef(0);
  useEffect(() => {
    if (!enabled || !userId) return;
    const controller = new AbortController(); controllerRef.current = controller;
    const load = async () => {
      if (refreshing.current && !refreshing.current.signal.aborted || paging.current && !paging.current.signal.aborted || document.visibilityState !== "visible" || !navigator.onLine) return;
      refreshing.current = controller; const generation = readGeneration.current;
      try {
        const [totals, first] = await Promise.all([loadSharedOverview(controller.signal), loadSharedInbox({ unread: true, signal: controller.signal })]);
        let inbox = first; const rows = [...first.notifications];
        // Refresh every loaded page so revoked access and reads on another device cannot leave stale items.
        while (inbox.nextCursor && rows.length < loaded.current && !controller.signal.aborted && generation === readGeneration.current) {
          inbox = await loadSharedInbox({ unread: true, before: inbox.nextCursor, signal: controller.signal });
          rows.push(...inbox.notifications);
        }
        if (controller.signal.aborted || generation !== readGeneration.current) return;
        loaded.current = rows.length; setOverview(totals); setNotifications(rows); setNextCursor(inbox.nextCursor); setError(false); setMoreError(false);
      } catch { if (!controller.signal.aborted) { setError(true); setNotifications([]); setNextCursor(null); } }
      finally { if (refreshing.current === controller) refreshing.current = null; }
    };
    const timer = window.setTimeout(() => { setLoadingMore(false); void load(); }, 0);
    const poll = window.setInterval(() => void load(), 30000);
    const visible = () => void load();
    window.addEventListener("focus", visible); window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible); window.addEventListener("genesis:shared-updates", visible);
    window.addEventListener("genesis:shared-inbox-read", refresh);
    return () => { controller.abort(); window.clearTimeout(timer); window.clearInterval(poll);
      window.removeEventListener("focus", visible); window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible); window.removeEventListener("genesis:shared-updates", visible);
      window.removeEventListener("genesis:shared-inbox-read", refresh); };
  }, [enabled, userId, revision, refresh]);
  const loadMore = useCallback(async () => {
    const controller = controllerRef.current;
    if (!enabled || !nextCursor || !controller || controller.signal.aborted || paging.current && !paging.current.signal.aborted || refreshing.current && !refreshing.current.signal.aborted) return;
    const generation = readGeneration.current; paging.current = controller; setLoadingMore(true); setMoreError(false);
    try {
      const result = await loadSharedInbox({ unread: true, before: nextCursor, signal: controller.signal });
      if (controller.signal.aborted || generation !== readGeneration.current) return;
      setNotifications(current => {
        const rows = [...current, ...result.notifications.filter(item => !current.some(old => old.id === item.id))];
        loaded.current = rows.length; return rows;
      }); setNextCursor(result.nextCursor);
    } catch { if (!controller.signal.aborted) setMoreError(true); }
    finally { if (paging.current === controller) paging.current = null; if (!controller.signal.aborted) setLoadingMore(false); }
  }, [enabled, nextCursor]);
  const markRead = useCallback(async (ids: string[], all = false) => {
    ++readGeneration.current;
    await readSharedInbox(ids, all); refresh();
    setNotifications(items => all ? [] : items.filter(item => !ids.includes(item.id)));
  }, [refresh]);
  const markTaskRead = useCallback(async (projectId: string, taskId: string, commentIds: string[], signal?: AbortSignal) => {
    const generation = ++readGeneration.current;
    try {
      const result = await readSharedTaskUpdates(projectId, taskId, commentIds, signal);
      if (signal?.aborted || generation !== readGeneration.current) return;
      setOverview(result.overview);
      setNotifications(items => items.filter(item => item.projectId !== projectId || item.objectId !== taskId || item.action === "comment.created" && !commentIds.includes(item.commentId ?? "")));
      setError(false); refresh();
    } catch (error) { if (!signal?.aborted) setError(true); throw error; }
  }, [refresh]);
  const comments = useMemo(() => notifications.filter(item => item.action === "comment.created"), [notifications]);
  return <UpdatesContext.Provider value={{ overview: enabled ? overview : null, comments: enabled ? comments : [], notifications: enabled ? notifications : [], nextCursor: enabled ? nextCursor : null, loadingMore, moreError, loadMore, error, refresh, markRead, markTaskRead }}>{children}</UpdatesContext.Provider>;
}


export const useSharedUpdates = () => useContext(UpdatesContext);
