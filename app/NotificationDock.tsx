"use client";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { DialogCloseButton } from "./DialogCloseButton";
import { ExperimentalIcon } from "./ExperimentalIcon";
import { useSharedUpdates } from "./SharedUpdatesProvider";
import { notificationDestination, type SharedTaskDestination } from "./SharedUpdates";
import { SharedInvitationNotices, type SharedInvitationDestination } from "./SharedInvitationNotices";
import { useReminderNotices } from "./ReminderNotices";
import { translateText, type Language } from "./i18n";
import { clampDockPosition, dockHome, newestUnseenToken, NOTIFICATION_PREVIEW_MS, type DockBounds, type DockPosition, type NoticeActivity } from "./notification-dock-model";
import "./notification-dock.css";
const PrivateNotices = lazy(() => import("./SharedSpaceCollaboration").then(module => ({ default: module.SharedPrivateNotices })));
const emptyActivity: NoticeActivity = { count: 0, tokens: [], title: "" };
type Props = { userId: string; language: Language; appBase: string; sharedEnabled: boolean; invitationsEnabled: boolean;
  onOpen: (destination: SharedTaskDestination) => void; onAccepted: (destination: SharedInvitationDestination) => void };

export default function NotificationDock({ userId, language, appBase, sharedEnabled, invitationsEnabled, onOpen, onAccepted }: Props) {
  const { notifications, overview, nextCursor, loadingMore, moreError, error, refresh, loadMore, markRead } = useSharedUpdates();
  const { notes, dismiss } = useReminderNotices(appBase);
  const [privateActivity, setPrivateActivity] = useState(emptyActivity), [invitationActivity, setInvitationActivity] = useState(emptyActivity);
  const [open, setOpen] = useState(false), [position, setPosition] = useState<DockPosition | null>(null);
  const [bounds, setBounds] = useState<DockBounds>({ left: 12, top: 12, right: 372, bottom: 720 });
  const [size, setSize] = useState({ width: 56, height: 56 }), [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState<{ token: string; title: string } | null>(null), [busy, setBusy] = useState(""), [readFailed, setReadFailed] = useState(false);
  const root = useRef<HTMLElement>(null), toggle = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), toast = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>()), suppressClick = useRef(false);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; origin: DockPosition; moved: boolean } | null>(null);
  const t = (text: string) => translateText(text, language);
  const sharedCount = sharedEnabled ? overview ? overview.newTasks + overview.newProjects + overview.newComments : notifications.length : 0;
  const count = sharedCount + notes.length + (sharedEnabled ? privateActivity.count : 0) + (invitationsEnabled ? invitationActivity.count : 0);
  const expanded = open && count > 0;
  const collapse = useCallback(() => { setOpen(false); setPosition(null); setPreview(null); }, []);
  const show = () => { setOpen(true); setPreview(null); };

  useEffect(() => {
    const measure = () => {
      const viewport = window.visualViewport, width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      const isMobile = window.innerWidth <= 1040, content = document.getElementById("main-content")?.getBoundingClientRect();
      const nav = isMobile ? document.querySelector(".mobile-nav")?.getBoundingClientRect() : null;
      setMobile(isMobile);
      setBounds({ left: isMobile ? 12 : Math.max(12, Math.min(content?.left ?? 12, width - 80)), top: 12,
        right: width - 12, bottom: Math.max(80, Math.min(height - 12, nav && nav.height ? nav.top - 12 : height - 12)) });
    };
    measure(); const observer = new ResizeObserver(measure), content = document.getElementById("main-content");
    if (content) observer.observe(content);
    window.addEventListener("resize", measure); window.visualViewport?.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); };
  }, []);
  useLayoutEffect(() => {
    if (!count || !root.current) return;
    const element = root.current;
    const measure = () => {
      const box = element.getBoundingClientRect(); if (!box.width || !box.height) return;
      setSize(current => current.width === box.width && current.height === box.height ? current : { width: box.width, height: box.height });
      setPosition(current => {
        if (!current) return null;
        const next = clampDockPosition(current, bounds, box.width, box.height);
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, bounds, count]);
  useEffect(() => {
    if (count) return;
    const timer = window.setTimeout(collapse, 0); return () => window.clearTimeout(timer);
  }, [count, collapse]);
  useEffect(() => {
    if (!expanded) return;
    panel.current?.focus({ preventScroll: true });
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open], [aria-modal=true]")) { event.preventDefault(); collapse(); requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true })); }
    };
    window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape);
  }, [expanded, collapse]);
  useEffect(() => {
    const tokens = [...notes.map(note => `reminder:${note.id}`), ...notifications.map(item => `shared:${item.id}`), ...privateActivity.tokens, ...invitationActivity.tokens];
    const token = newestUnseenToken(tokens, seen.current);
    if (!token || expanded || mobile) return;
    const shared = notifications.find(item => `shared:${item.id}` === token);
    const title = token.startsWith("reminder:") ? notes.find(note => `reminder:${note.id}` === token)?.title ?? ""
      : shared ? shared.taskTitle || shared.projectTitle : token.startsWith("private") ? privateActivity.title : invitationActivity.title;
    const timer = window.setTimeout(() => setPreview({ token, title }), 0); return () => window.clearTimeout(timer);
  }, [notes, notifications, privateActivity, invitationActivity, expanded, mobile]);
  useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(() => {
      if (toast.current?.contains(document.activeElement)) toggle.current?.focus({ preventScroll: true });
      setPreview(null);
    }, NOTIFICATION_PREVIEW_MS);
    return () => window.clearTimeout(timer);
  }, [preview]);

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (mobile || event.button !== 0 || !root.current) return;
    const box = root.current.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: box.left, y: box.top }, moved: false };
    suppressClick.current = false; event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < 5) return;
    current.moved = true; setPosition(clampDockPosition({ x: current.origin.x + dx, y: current.origin.y + dy }, bounds, size.width, size.height));
  };
  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    suppressClick.current = Boolean(drag.current?.moved); drag.current = null;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (mobile) return;
    if (event.key === "Home") { event.preventDefault(); setPosition(null); return; }
    const directions: Record<string, DockPosition> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const direction = directions[event.key]; if (!direction) return;
    event.preventDefault(); const box = root.current!.getBoundingClientRect(), step = event.shiftKey ? 96 : 24;
    setPosition(clampDockPosition({ x: box.left + direction.x * step, y: box.top + direction.y * step }, bounds, size.width, size.height));
  };
  const read = async (id: string) => {
    if (busy) return; setBusy(id); setReadFailed(false);
    try { await markRead([id]); } catch { setReadFailed(true); } finally { setBusy(""); }
  };
  const home = dockHome(bounds, size.width, size.height, mobile), place = position ? clampDockPosition(position, bounds, size.width, size.height) : home;
  const dragProps = { onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown: moveWithKeyboard };

  return <>
    <aside ref={root} className="notification-dock" data-expanded={expanded} hidden={!count} aria-label={t("Уведомления и сообщения")}
      style={{ left: place.x, top: place.y, maxWidth: bounds.right - bounds.left, maxHeight: Math.min(560, bounds.bottom - bounds.top) }}>
      <button ref={toggle} type="button" className="notification-dock-toggle" hidden={expanded} aria-expanded={expanded} aria-controls="notification-dock-panel" aria-label={`${t("Уведомления и сообщения")}: ${count}`}
        {...dragProps} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } show(); }}>
        <ExperimentalIcon name="mail" /><span className="notification-dock-count" aria-hidden="true">{count > 99 ? "99+" : count}</span>
      </button>
      <div ref={panel} id="notification-dock-panel" className="notification-dock-panel" hidden={!expanded} tabIndex={-1}>
        <header><h2>{t("Непрочитанные")}</h2>{!mobile ? <button type="button" className="notification-drag-handle" aria-label={t("Переместить уведомления")} title={t("Перетащите блок или используйте стрелки и Home")} {...dragProps}><ExperimentalIcon name="move" /></button> : null}
          <DialogCloseButton aria-label={t("Свернуть уведомления")} onClick={() => { collapse(); requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true })); }} /></header>
        <div className="notification-dock-list">
          {readFailed || sharedEnabled && (error || moreError) ? <p role="alert">{t("Не удалось обновить уведомления. Повторите попытку.")} <button type="button" className="secondary-button" onClick={refresh}>{t("Обновить")}</button></p> : null}
          {notes.map(note => <article className="notification-reminder" key={note.id}><ExperimentalIcon name={note.kind === "task" ? "check" : "habits"} /><div><strong>{t(note.kind === "task" ? "Задача" : "Привычка")}</strong><p data-no-translate>{note.title}</p><small data-no-translate>{note.body}</small></div><button type="button" className="notification-read" aria-label={`${t("Убрать напоминание")}: ${note.title}`} onClick={() => dismiss(note.id)}><ExperimentalIcon name="check" /></button></article>)}
          {notifications.map(item => <article className="notification-shared" key={item.id}>
            <button type="button" className="notification-item-open" data-comment-id={item.commentId} onClick={() => {
              collapse(); onOpen(notificationDestination(item)); if (item.action === "project.created") void read(item.id);
            }}><span className="notification-item-heading"><ExperimentalIcon name={item.action === "comment.created" ? "comment" : item.action === "project.created" ? "projects" : "plus"} />{t(item.action === "comment.created" ? "Новый комментарий" : item.action === "project.created" ? "Новый проект" : "Новая задача")}</span>
              <strong data-no-translate>{item.taskTitle || item.projectTitle}</strong><small data-no-translate>{item.actorName} · {item.projectTitle}</small>{item.commentBody ? <span className="notification-comment-body" data-no-translate>{item.commentBody}</span> : null}
              <time dateTime={item.createdAt}>{new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time></button>
            <button type="button" className="notification-read" disabled={Boolean(busy)} aria-label={`${t("Отметить прочитанным")}: ${item.taskTitle || item.projectTitle}`} onClick={() => void read(item.id)}><ExperimentalIcon name="check" /></button>
          </article>)}
          {nextCursor ? <button type="button" className="secondary-button notification-load-more" disabled={loadingMore} onClick={() => void loadMore()}>{t(loadingMore ? "Загрузка…" : "Показать ещё")}</button> : null}
          {invitationsEnabled ? <SharedInvitationNotices userId={userId} english={language === "en"} persistent onActivity={setInvitationActivity} onAccepted={destination => { collapse(); onAccepted(destination); }} /> : null}
          {sharedEnabled ? <Suspense fallback={null}><PrivateNotices userId={userId} language={language} embedded onActivity={setPrivateActivity} onNavigate={collapse} /></Suspense> : null}
        </div>
      </div>
    </aside>
    {preview && !expanded && !mobile && count > 0 ? <div className="notification-preview" ref={toast} role="status"><ExperimentalIcon name="mail" /><div><strong>{t("Новые уведомления")}</strong><p data-no-translate>{preview.title}</p><button type="button" onClick={show}>{t("Показать непрочитанное")}</button></div><DialogCloseButton aria-label={t("Скрыть уведомление")} onClick={() => setPreview(null)} /></div> : null}
  </>;
}
