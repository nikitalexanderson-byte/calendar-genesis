"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { loadSharedOverview, loadSharedInbox, readSharedInbox, readSharedTaskUpdates, type SharedOverview, type SharedNotification } from "./cloud-sync";
type Updates = { overview: SharedOverview | null; comments: SharedNotification[]; error: boolean;
  refresh: () => void; markRead: (ids: string[], all?: boolean) => Promise<void>;
  markTaskRead: (projectId: string, taskId: string, commentIds: string[], signal?: AbortSignal) => Promise<void> };
const UpdatesContext = createContext<Updates>({ overview: null, comments: [], error: false, refresh: () => {}, markRead: async () => {}, markTaskRead: async () => {} });

export function SharedUpdatesProvider({ userId, enabled, children }: { userId: string; enabled: boolean; children: ReactNode }) {
  const [overview, setOverview] = useState<SharedOverview | null>(null);
  const [comments, setComments] = useState<SharedNotification[]>([]);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const readGeneration = useRef(0);
  useEffect(() => {
    if (!enabled || !userId) return;
    const controller = new AbortController(); let pending = false;
    const load = async () => {
      if (pending || document.visibilityState !== "visible" || !navigator.onLine) return;
      pending = true;
      try {
        const [totals, inbox] = await Promise.all([loadSharedOverview(controller.signal), loadSharedInbox({ unread: true, signal: controller.signal })]);
        if (controller.signal.aborted) return;
        setOverview(totals); setComments(inbox.notifications.filter(item => item.action === "comment.created")); setError(false);
      } catch { if (!controller.signal.aborted) { setError(true); setComments([]); } }
      finally { pending = false; }
    };
    const timer = window.setTimeout(() => void load(), 0);
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
  const markRead = useCallback(async (ids: string[], all = false) => {
    await readSharedInbox(ids, all); refresh();
    setComments(items => all ? [] : items.filter(item => !ids.includes(item.id)));
  }, [refresh]);
  const markTaskRead = useCallback(async (projectId: string, taskId: string, commentIds: string[], signal?: AbortSignal) => {
    const generation = ++readGeneration.current;
    try {
      const result = await readSharedTaskUpdates(projectId, taskId, commentIds, signal);
      if (signal?.aborted || generation !== readGeneration.current) return;
      setOverview(result.overview);
      setComments(items => items.filter(item => item.projectId !== projectId || item.objectId !== taskId || !commentIds.includes(item.commentId ?? "")));
      setError(false); refresh();
    } catch (error) { if (!signal?.aborted) setError(true); throw error; }
  }, [refresh]);
  return <UpdatesContext.Provider value={{ overview: enabled ? overview : null, comments: enabled ? comments : [], error, refresh, markRead, markTaskRead }}>{children}</UpdatesContext.Provider>;
}


export const useSharedUpdates = () => useContext(UpdatesContext);
