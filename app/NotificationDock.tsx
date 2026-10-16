"use client";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { AccountLayout } from "./ui-visibility";
import { DialogCloseButton } from "./DialogCloseButton";
import { ExperimentalIcon } from "./ExperimentalIcon";
import { useSharedUpdates } from "./SharedUpdatesProvider";
import { type SharedTaskDestination } from "./SharedUpdates";
import { SharedNotificationPreferencesDialog } from "./SharedNotificationPreferences";
import { loadSharedPushDelivery, resolveSharedNotification } from "./cloud-sync";
import { sharedNotificationLabel } from "./notification-settings-model";
import { formatCalendarDateValue, type CalendarMode } from "./calendar-data";
import { calendarContext } from "./calendar-context";
import { privateDeviceAccessBlocked } from "./local-sign-out";
import { SharedInvitationNotices, type SharedInvitationDestination } from "./SharedInvitationNotices";
import { useReminderNotices } from "./ReminderNotices";
import { translateText, type Language } from "./i18n";
import { clampDockPosition, clampDockSize, dockHome, dockSavedPosition, dockPositionToLayout, newestUnseenToken, NOTIFICATION_PREVIEW_MS, type DockBounds, type DockPosition, type DockSize, type NoticeActivity } from "./notification-dock-model";
import "./notification-dock.css";
const PrivateNotices = lazy(() => import("./SharedSpaceCollaboration").then(module => ({ default: module.SharedPrivateNotices })));
const emptyActivity: NoticeActivity = { count: 0, tokens: [], title: "" };
type Props = { userId: string; language: Language; mode:CalendarMode; appBase: string; sharedEnabled: boolean; invitationsEnabled: boolean;
  layout: AccountLayout; onLayoutChange: (patch: Partial<AccountLayout>) => void; headerTarget: HTMLElement | null;
  onOpen: (destination: SharedTaskDestination) => void; onAccepted: (destination: SharedInvitationDestination) => void };

export default function NotificationDock({ userId, language, mode, appBase, sharedEnabled, invitationsEnabled, layout, onLayoutChange, headerTarget, onOpen, onAccepted }: Props) {
  const { notifications, overview, nextCursor, loadingMore, moreError, error, refresh, loadMore, markRead,markUnread,unreadOnly,setUnreadOnly,loading } = useSharedUpdates();
  const { notes, dismiss } = useReminderNotices(appBase);
  const [privateActivity, setPrivateActivity] = useState(emptyActivity), [invitationActivity, setInvitationActivity] = useState(emptyActivity);
  const [open, setOpen] = useState(false), [position, setPosition] = useState<DockPosition | null>(null);
  const [manual,setManual]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[linkError,setLinkError]=useState(false);
  const [bounds, setBounds] = useState<DockBounds>({ left: 12, top: 12, right: 372, bottom: 720 });
  const [size, setSize] = useState({ width: 56, height: 56 }), [mobile, setMobile] = useState(false);
  const [panelSize,setPanelSize]=useState<DockSize>({width:360,height:560});
  const [dragPreview,setDragPreview]=useState<DockPosition|null>(null);
  const docked = layout.notificationDockPinned && Boolean(headerTarget);
  const [preview, setPreview] = useState<{ token: string; title: string } | null>(null), [busy, setBusy] = useState(""), [readFailed, setReadFailed] = useState(false);
  const root = useRef<HTMLElement>(null), toggle = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), toast = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>()), suppressClick = useRef(false);
  const openDestination=useRef(onOpen),actionController=useRef<AbortController|null>(null),alive=useRef(false);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; origin: DockPosition; moved: boolean; end?: DockPosition } | null>(null);
  const resize = useRef<{pointerId:number;startX:number;startY:number;origin:DockPosition;size:DockSize}|null>(null);
  const t = (text: string) => translateText(text, language);
  const sharedCount = sharedEnabled ? overview ? overview.newTasks + overview.newProjects + overview.newComments+(overview.newNotifications??0) : notifications.filter(item=>!item.isRead).length : 0;
  const count = sharedCount + notes.length + (sharedEnabled ? privateActivity.count : 0) + (invitationsEnabled ? invitationActivity.count : 0);
  const expanded = open && (count > 0||manual);
  const collapse = useCallback(() => { actionController.current?.abort();setOpen(false);setManual(false);setUnreadOnly(true); setPosition(null); setPreview(null); }, [setUnreadOnly]);
  const show = () => { setOpen(true); setPreview(null); };
  useEffect(()=>{openDestination.current=onOpen;},[onOpen]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;actionController.current?.abort();};},[]);
  useEffect(()=>{if(!linkError)return;const timer=window.setTimeout(()=>setLinkError(false),5000);return()=>window.clearTimeout(timer);},[linkError]);

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
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true); window.visualViewport?.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); window.visualViewport?.removeEventListener("resize", measure); };
  }, []);
  useLayoutEffect(() => {
    if ((!count&&!manual) || !root.current) return;
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
  }, [expanded, bounds, count,manual]);
  useEffect(() => {
    if (count||manual) return;
    const timer = window.setTimeout(collapse, 0); return () => window.clearTimeout(timer);
  }, [count, collapse,manual]);
  useEffect(()=>{const showHistory=()=>{setManual(true);setUnreadOnly(false);setOpen(true);setPreview(null);};window.addEventListener("genesis:notification-inbox-open",showHistory);return()=>window.removeEventListener("genesis:notification-inbox-open",showHistory);},[setUnreadOnly]);
  useEffect(()=>{
    if(!userId||!sharedEnabled)return;const url=new URL(window.location.href),id=url.searchParams.get("notice");if(!id||!/^[-a-f0-9]{36}$/.test(id))return;
    const abort=new AbortController();void loadSharedPushDelivery(id,abort.signal).then(result=>{if(abort.signal.aborted||privateDeviceAccessBlocked())return;url.searchParams.delete("notice");window.history.replaceState(window.history.state,"",url);if(result.message.count===1)openDestination.current(result.destination);else{setManual(true);setUnreadOnly(true);setOpen(true);}}).catch(()=>{if(!abort.signal.aborted)setLinkError(true);});return()=>abort.abort();
  },[userId,sharedEnabled,setUnreadOnly]);
  useEffect(() => {
    if (!expanded) return;
    panel.current?.focus({ preventScroll: true });
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open], [aria-modal=true]")) { event.preventDefault(); collapse(); requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true })); }
    };
    window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape);
  }, [expanded, collapse]);
  useEffect(() => {
    const tokens = [...notes.map(note => `reminder:${note.id}`), ...notifications.filter(item=>!item.isRead&&item.previewAllowed!==false).map(item => `shared:${item.id}`), ...privateActivity.tokens, ...invitationActivity.tokens];
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

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (mobile || event.button !== 0 || !root.current || (event.currentTarget.tagName==="HEADER" && event.target instanceof Element && event.target.closest("button,a,input,select,textarea"))) return;
    if(event.currentTarget.tagName==="HEADER")event.preventDefault();
    const box = docked && event.currentTarget === toggle.current ? event.currentTarget.getBoundingClientRect() : root.current.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: box.left, y: box.top }, moved: false };
    suppressClick.current = false; event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < 5) return;
    current.moved = true;
    current.end = clampDockPosition({ x: current.origin.x + dx, y: current.origin.y + dy }, bounds, docked ? 56 : size.width, docked ? 56 : size.height);
    if(docked) setDragPreview(current.end); else setPosition(current.end);
  };
  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    suppressClick.current = Boolean(current.moved); drag.current = null;
    if(current.moved && current.end && event.type !== "pointercancel") {
      const target = headerTarget?.closest(".topbar")?.getBoundingClientRect();
      const pin = Boolean(target && event.clientX >= target.left && event.clientX <= target.right
        && event.clientY >= target.top && event.clientY <= target.bottom);
      onLayoutChange({ notificationDockPinned: pin, ...(pin ? {} : dockPositionToLayout(current.end,bounds)) });
    }
    setPosition(null);setDragPreview(null);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const moveWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (mobile || event.target!==event.currentTarget) return;
    if (event.key === "Home") { event.preventDefault(); setPosition(null); onLayoutChange({notificationDockPinned:false,notificationDockX:-1,notificationDockY:-1}); return; }
    const directions: Record<string, DockPosition> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const direction = directions[event.key]; if (!direction) return;
    event.preventDefault(); const box = docked ? toggle.current!.getBoundingClientRect() : root.current!.getBoundingClientRect(), step = event.shiftKey ? 96 : 24;
    const next = clampDockPosition({ x: box.left + direction.x * step, y: box.top + direction.y * step }, bounds, docked ? 56 : size.width, docked ? 56 : size.height);
    onLayoutChange({notificationDockPinned:false,...dockPositionToLayout(next,bounds)});setPosition(null);
  };
  const resizeTo=(next:DockSize,origin:DockPosition)=>{const constrained=clampDockSize(next,bounds);setPanelSize(constrained);if(!docked)setPosition(clampDockPosition(origin,bounds,constrained.width,constrained.height));};
  const startResize=(event:PointerEvent<HTMLButtonElement>)=>{
    if(mobile||event.button!==0||!root.current)return;event.preventDefault();const box=root.current.getBoundingClientRect();
    resize.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,origin:{x:box.left,y:box.top},size:{width:box.width,height:box.height}};event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize=(event:PointerEvent<HTMLButtonElement>)=>{const current=resize.current;if(!current||current.pointerId!==event.pointerId)return;resizeTo({width:current.size.width+event.clientX-current.startX,height:current.size.height+event.clientY-current.startY},current.origin);};
  const endResize=(event:PointerEvent<HTMLButtonElement>)=>{if(resize.current?.pointerId!==event.pointerId)return;resize.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);};
  const resizeWithKeyboard=(event:KeyboardEvent<HTMLButtonElement>)=>{
    const delta=event.shiftKey?96:24,direction=({ArrowLeft:{width:-delta,height:0},ArrowRight:{width:delta,height:0},ArrowUp:{width:0,height:-delta},ArrowDown:{width:0,height:delta}} as Record<string,DockSize>)[event.key];
    if(!direction||!root.current)return;event.preventDefault();const box=root.current.getBoundingClientRect();resizeTo({width:box.width+direction.width,height:box.height+direction.height},{x:box.left,y:box.top});
  };
  const read = async (id: string,unread=false) => {
    if (busy) return; setBusy(id); setReadFailed(false);
    try { if(unread)await markUnread([id]);else await markRead([id]); } catch { setReadFailed(true); } finally { setBusy(""); }
  };
  const openItem=async(id:string)=>{if(busy)return;const abort=new AbortController();actionController.current=abort;setBusy(id);setReadFailed(false);try{const destination=await resolveSharedNotification(id,abort.signal);if(!alive.current||abort.signal.aborted||privateDeviceAccessBlocked())return;collapse();openDestination.current(destination);if(!destination.taskId)await markRead([id]);}catch{if(alive.current&&!abort.signal.aborted)setReadFailed(true);}finally{if(alive.current)setBusy("");}};
  const anchor = docked ? headerTarget?.getBoundingClientRect() : null;
  const panelBounds = anchor ? {...bounds,top:Math.min(bounds.bottom,Math.max(bounds.top,anchor.bottom+8))} : bounds;
  const dimensions=expanded?clampDockSize(mobile?{width:360,height:560}:panelSize,panelBounds):null;
  const home = mobile ? dockHome(bounds,56,56) : dockSavedPosition(layout.notificationDockX,layout.notificationDockY,bounds);
  const place = anchor ? clampDockPosition({x:anchor.right-(dimensions?.width??56),y:anchor.bottom+8},panelBounds,dimensions?.width??56,dimensions?.height??56)
    : clampDockPosition(position ?? home,bounds,dimensions?.width??56,dimensions?.height??56);
  const dragProps = { onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown: moveWithKeyboard };
  const toggleButton = <button ref={toggle} type="button" className={`notification-dock-toggle${docked?" is-pinned icon-button ux-action-button":""}`} hidden={!count&&!manual || !docked&&expanded} aria-expanded={expanded} aria-controls="notification-dock-panel" aria-label={`${t("Уведомления и сообщения")}: ${count}`}
    {...dragProps} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if(expanded)collapse();else show(); }}>
    <ExperimentalIcon name="mail" /><span className="notification-dock-count" aria-hidden="true">{count > 99 ? "99+" : count}</span>
  </button>;

  return <>
    {docked && headerTarget ? createPortal(toggleButton,headerTarget) : null}
    {dragPreview ? <div className="notification-dock-drag-preview" aria-hidden="true" style={{left:dragPreview.x,top:dragPreview.y}}><ExperimentalIcon name="mail"/></div> : null}
    <aside ref={root} className="notification-dock" data-expanded={expanded} data-pinned={docked} hidden={!count&&!manual || docked&&!expanded} aria-label={t("Уведомления и сообщения")}
      style={{ left: place.x, top: place.y, width:dimensions?.width, height:dimensions?.height, maxWidth: bounds.right - bounds.left, maxHeight:expanded?dimensions?.height:bounds.bottom-bounds.top }}>
      {!docked ? toggleButton : null}
      <div ref={panel} id="notification-dock-panel" className="notification-dock-panel" hidden={!expanded} tabIndex={-1}>
        <header className="notification-dock-header" tabIndex={mobile?undefined:0} aria-label={mobile?undefined:t("Переместить уведомления")} title={mobile?undefined:t("Перетащите блок или используйте стрелки и Home")} {...dragProps}><h2>{t(unreadOnly?"Непрочитанные":"Уведомления")}</h2>
          <div className="notification-dock-header-actions"><button type="button" className="notification-drag-handle" aria-label={t(docked?"Открепить от верхней панели":"Закрепить на верхней панели")} title={t(docked?"Открепить от верхней панели":"Закрепить на верхней панели")} onClick={() => {
            onLayoutChange({notificationDockPinned:!docked,...(docked?dockPositionToLayout(place,bounds):{})});setPosition(null);
          }}><ExperimentalIcon name="map-pin"/></button>
          {sharedEnabled?<button type="button" className="notification-drag-handle" aria-label={t("Настройки уведомлений")} title={t("Настройки уведомлений")} onClick={()=>setSettingsOpen(true)}><ExperimentalIcon name="settings"/></button>:null}
          <DialogCloseButton aria-label={t("Свернуть уведомления")} onClick={() => { collapse(); requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true })); }} /></div></header>
        <div className="notification-dock-list">
          {sharedEnabled?<div className="notification-inbox-filter" role="group" aria-label={t("Фильтр обновлений")}><button type="button" className="secondary-button" aria-pressed={unreadOnly} disabled={Boolean(busy)} onClick={()=>setUnreadOnly(true)}>{t("Непрочитанные")}</button><button type="button" className="secondary-button" aria-pressed={!unreadOnly} disabled={Boolean(busy)} onClick={()=>{setManual(true);setUnreadOnly(false);}}>{t("Все")}</button></div>:null}
          {readFailed || sharedEnabled && (error || moreError) ? <p role="alert">{t("Не удалось обновить уведомления. Повторите попытку.")} <button type="button" className="secondary-button" onClick={refresh}>{t("Обновить")}</button></p> : null}
          {notes.map(note => <article className="notification-reminder" key={note.id}><ExperimentalIcon name={note.kind === "task" ? "check" : "habits"} /><div><strong>{t(note.kind === "task" ? "Задача" : "Привычка")}</strong><p data-no-translate>{note.title}</p><small data-no-translate>{note.body}</small></div><button type="button" className="notification-read" aria-label={`${t("Убрать напоминание")}: ${note.title}`} onClick={() => dismiss(note.id)}><ExperimentalIcon name="check" /></button></article>)}
          {notifications.map(item => <article className="notification-shared" key={item.id}>
            <button type="button" className="notification-item-open" disabled={Boolean(busy)} data-comment-id={item.commentId} onClick={()=>void openItem(item.id)}><span className="notification-item-heading"><ExperimentalIcon name={item.commentId ? "comment" : item.action === "project.created" ? "projects" : "plus"} />{sharedNotificationLabel(item)}</span>
              <strong data-no-translate>{item.taskTitle || item.projectTitle}</strong><small data-no-translate>{item.actorName} · {item.projectTitle}</small>{item.commentBody ? <span className="notification-comment-body" data-no-translate>{item.commentBody}</span> : null}
              {item.dueDate&&(item.kind==="dueSoon"||item.kind==="overdue")?<small data-no-translate>{translateText(formatCalendarDateValue(item.dueDate,mode,false,calendarContext({timeZone:item.timeZone,gregorianYearStart:item.gregorianYearStart})),language,true)}</small>:null}
              <time dateTime={item.createdAt}>{new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short",...(item.timeZone?{timeZone:item.timeZone}:{}),...(item.timeFormat?{hour12:item.timeFormat==="12h"}:{}) }).format(new Date(item.createdAt))}</time></button>
            <button type="button" className="notification-read" disabled={Boolean(busy)} aria-label={`${t(item.isRead?"Отметить непрочитанным":"Отметить прочитанным")}: ${item.taskTitle || item.projectTitle}`} onClick={() => void read(item.id,Boolean(item.isRead))}><ExperimentalIcon name={item.isRead?"mail":"check"} /></button>
          </article>)}
          {loading?<p role="status">{t("Загрузка…")}</p>:sharedEnabled&&!notifications.length&&!error?<p>{t("Здесь пока нет обновлений.")}</p>:null}
          {nextCursor ? <button type="button" className="secondary-button notification-load-more" disabled={loadingMore} onClick={() => void loadMore()}>{t(loadingMore ? "Загрузка…" : "Показать ещё")}</button> : null}
          {invitationsEnabled ? <SharedInvitationNotices userId={userId} english={language === "en"} persistent onActivity={setInvitationActivity} onAccepted={destination => { collapse(); onAccepted(destination); }} /> : null}
          {sharedEnabled ? <Suspense fallback={null}><PrivateNotices userId={userId} language={language} embedded onActivity={setPrivateActivity} onNavigate={collapse} /></Suspense> : null}
        </div>
        {!mobile?<button type="button" className="notification-resize-handle" aria-label={t("Изменить размер уведомлений")} title={t("Потяните угол или используйте стрелки")} onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onKeyDown={resizeWithKeyboard}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 13 13 4M9 13l4-4"/></svg></button>:null}
      </div>
    </aside>
    {settingsOpen?<SharedNotificationPreferencesDialog userId={userId} onClose={()=>setSettingsOpen(false)}/>:null}
    {linkError?<div className="notification-link-error" role="alert"><p>{t("Уведомление больше недоступно. Проверьте доступ и подключение.")}</p><DialogCloseButton aria-label={t("Закрыть")} onClick={()=>setLinkError(false)}/></div>:null}
    {preview && !expanded && !mobile && count > 0 ? <div className="notification-preview" ref={toast} role="status"><ExperimentalIcon name="mail" /><div><strong>{t("Новые уведомления")}</strong><p data-no-translate>{preview.title}</p><button type="button" onClick={show}>{t("Показать непрочитанное")}</button></div><DialogCloseButton aria-label={t("Скрыть уведомление")} onClick={() => setPreview(null)} /></div> : null}
  </>;
}
