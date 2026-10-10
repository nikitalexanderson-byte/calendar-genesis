"use client";

import { useEffect, useRef, useState } from "react";
import { acceptSharedInvitation, listSharedInvitations, type SharedInvitation } from "./cloud-sync";
import "./shared-invitation-notices.css";

export type SharedInvitationDestination = { spaceId: string; projectId: string };

/** Mounted per account so a late response cannot appear in another account. */
export function SharedInvitationNotices({userId, english, onAccepted}: {
  userId: string; english: boolean; onAccepted: (destination: SharedInvitationDestination) => void;
}) {
  const storageKey = `genesis-hidden-invitations:${userId}`;
  const hidden = useRef(new Set<string>());
  const alive = useRef(false);
  const [invitations, setInvitations] = useState<SharedInvitation[]>([]);
  const [pending, setPending] = useState("");
  const [errorId, setErrorId] = useState("");
  const accepting = useRef(false);

  useEffect(() => {
    alive.current = true;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(saved)) hidden.current = new Set(saved.filter((id): id is string => typeof id === "string").slice(-1000));
    } catch { /* Notices still work when storage is unavailable. */ }
    const controller = new AbortController();
    let loading = false;
    const refresh = async () => {
      if (loading || document.visibilityState !== "visible" || !navigator.onLine) return;
      loading = true;
      try {
        const items = await listSharedInvitations(controller.signal);
        if (alive.current) setInvitations(items.filter(item => !hidden.current.has(item.id)));
      } catch { /* Retain current invitations until the next successful refresh. */ }
      finally { loading = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive.current = false; controller.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [storageKey]);

  const hide = (id: string) => {
    hidden.current.add(id);
    try { localStorage.setItem(storageKey, JSON.stringify([...hidden.current].slice(-1000))); } catch { /* Hide for this session. */ }
    setInvitations(items => items.filter(item => item.id !== id));
  };
  const accept = async (id: string) => {
    if (accepting.current) return;
    accepting.current = true; setPending(id); setErrorId("");
    try {
      const destination = await acceptSharedInvitation(id);
      if (!alive.current) return;
      hide(id); onAccepted(destination);
    } catch { if (alive.current) setErrorId(id); }
    finally { accepting.current = false; if (alive.current) setPending(""); }
  };

  if (!invitations.length) return null;
  return <aside className="shared-invitation-notices" aria-label={english ? "Workspace invitations" : "Приглашения в пространства"} aria-live="polite" aria-relevant="additions">
    {invitations.map(invitation => <section className="shared-invitation-notice" key={invitation.id}>
      <header><h2>{english ? "Workspace invitation" : "Приглашение в пространство"}</h2>
        <button type="button" className="shared-invitation-close" disabled={pending===invitation.id} onClick={() => hide(invitation.id)} aria-label={english ? "Hide invitation" : "Скрыть приглашение"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button></header>
      <strong className="shared-invitation-title" data-no-translate>{invitation.spaceTitle}</strong>
      <p><span data-no-translate>{invitation.inviterName}</span> · {english ? "invites you to join" : "приглашает присоединиться"}</p>
      {invitation.projectTitle ? <p data-no-translate>{invitation.projectTitle}</p> : null}
      {errorId===invitation.id ? <p role="alert">{english ? "Could not accept the invitation. Try again." : "Не удалось принять приглашение. Повторите попытку."}</p> : null}
      <button type="button" className="primary-button" disabled={Boolean(pending)} onClick={() => void accept(invitation.id)}>{pending===invitation.id ? (english ? "Accepting…" : "Принимаем…") : (english ? "Accept" : "Принять")}</button>
    </section>)}
  </aside>;
}
