"use client";
import { DialogCloseButton } from "./DialogCloseButton";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { deleteAdminUser, type AdminStats, type AdminUserStats, loadAdminStats } from "./cloud-sync";
import { runtimeLocale } from "./i18n";
import { useDialogAccessibility } from "./use-dialog-accessibility";
import { AdminAdsPanel } from "./AdminAdsPanel";
import { SubscriptionControl } from "./SubscriptionControl";
import { adminUserCopy as userCopy } from "./admin-user-copy";

const mobileUsersQuery = () => window.matchMedia("(max-width: 760px)");
const subscribeMobileUsers = (listener: () => void) => { const query=mobileUsersQuery();query.addEventListener("change",listener);return()=>query.removeEventListener("change",listener); };
const mobileUsersSnapshot = () => mobileUsersQuery().matches;
const desktopUsersSnapshot = () => false;

function formatActivity(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(runtimeLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function syncStatusLabel(status: string | null, labels: {
  syncOk: string; syncWarning: string; disconnected: string; syncUnknown: string; staleSync: string;
}, lastSyncAt: string | null) {
  const lastSync = lastSyncAt ? Date.parse(lastSyncAt) : NaN;
  if (status === "ok" && Number.isFinite(lastSync) && Date.now() - lastSync > 7 * 86_400_000) return labels.staleSync;
  return status === "ok" ? labels.syncOk : status === "warning" ? labels.syncWarning
    : status === "disconnected" ? labels.disconnected : labels.syncUnknown;
}

const featureNames: Record<string, [string, string]> = {
  "menu.today": ["Сегодня", "Today"],
  "menu.tasks": ["Задачи", "Tasks"],
  "menu.projects": ["Проекты", "Projects"],
  "menu.calendar": ["Календарь", "Calendar"],
  "menu.habits": ["Привычки", "Habits"],
  "menu.sacred": ["Оракул", "Oracle"],
  "menu.settings": ["Настройки", "Settings"],
  "submenu.tasks.tasks": ["Задачи · задачи", "Tasks · tasks"],
  "submenu.tasks.lists": ["Задачи · списки", "Tasks · lists"],
  "submenu.projects.personal": ["Проекты · личные", "Projects · personal"],
  "submenu.projects.shared": ["Проекты · общие", "Projects · shared"],
  "submenu.calendar.month": ["Календарь · месяц", "Calendar · month"],
  "submenu.calendar.year": ["Календарь · год", "Calendar · year"],
  "submenu.habits.habits": ["Привычки · трекер", "Habits · tracker"],
  "submenu.habits.sleep": ["Привычки · сон и настроение", "Habits · sleep and mood"],
  "submenu.sacred.stoicheion": ["Оракул · Стойхейон", "Oracle · Stoicheion"],
  "submenu.sacred.theokyklos": ["Оракул · Теокиклос", "Oracle · Theokyklos"],
  "submenu.settings.appearance": ["Настройки · оформление", "Settings · appearance"],
  "submenu.settings.habits": ["Настройки · привычки", "Settings · habits"],
  "submenu.settings.reminders": ["Настройки · напоминания", "Settings · reminders"],
  "submenu.settings.shared": ["Настройки · общие проекты", "Settings · shared projects"],
  "submenu.settings.region": ["Настройки · регион", "Settings · region"],
  "submenu.settings.account": ["Настройки · аккаунт", "Settings · account"],
  "submenu.settings.links": ["Настройки · ссылки", "Settings · links"],
  "calendar.profane": ["Григорианский календарь", "Gregorian calendar"],
  "calendar.sacred": ["Сакральный календарь", "Sacred calendar"],
  "calendar.lunar": ["Лунный календарь", "Lunar calendar"],
};

type AdminSection = "analytics" | "ads" | "actions";

function adminSectionFromHash(): AdminSection {
  if (typeof window === "undefined") return "analytics";
  const section = window.location.hash.replace(/^#\/?/, "").split(/[?&]/, 1)[0].split("/")[1];
  return section === "ads" || section === "actions" ? section : "analytics";
}

export function AdminPanel() {
  const isEnglish = runtimeLocale().startsWith("en");
  const copy = isEnglish ? {
    loadError: "Could not load statistics.", deleteError: "Could not delete the user.", loading: "Loading anonymized statistics…",
    adminOnly: "Administrators only", title: "GENESIS activity", intro: "Habit titles, notes and history remain encrypted. The panel receives aggregate counts only.",
    users: "users", habits: "habits", tasks: "tasks", projects: "projects", blocked: "blacklisted",
    user: "User", activity: "Last activity", logins: "Logins", google: "Google", moderation: "Moderation", admin: "administrator", aggregate: "encrypted aggregate", open: "open", completed: "completed", events: "events", connected: "Connected", no: "No", lastCheck: "Last check", protected: "Protected", remove: "Delete",
    androidTitle: "Android downloads and sync", androidIntro: "Download requests are attributed only when a user is signed in on this site. Direct and anonymous APK downloads cannot be tied to an account. An app version appears only after that installation contacts the server; it does not prove the app is still installed.",
    trackedDownloads: "account download requests", reportingUsers: "users with an app report", download: "Download", version: "App version", googleServices: "Google services", server: "Server", noDownload: "No attributed request", first: "First", last: "Last", requested: "requested", devices: "installations", lastContact: "Last contact", noReport: "No report yet", authorized: "Authorized", disconnected: "Disconnected", syncOk: "OK", syncWarning: "Needs attention", syncUnknown: "Not checked", staleSync: "Not checked recently", lastSync: "Last sync", calendarSync: "Calendar",
    irreversible: "Irreversible action", deleteTitle: "Delete user?", deleteLead: "The account, encrypted workspace, habits, statistics, tasks and all related server data will be permanently deleted for",
    blacklistAria: "Add user to blacklist", blacklistTitle: "Add to blacklist after deletion", blacklistHelp: "Future sign-in with the same Google ID or email will be blocked. Only irreversible cryptographic fingerprints remain on the server.",
    confirmLabel: "Enter the user's email to confirm", cancel: "Cancel", deleting: "Deleting…", deleteAndBlock: "Delete and block", deleteUser: "Delete user",
  } : {
    loadError: "Не удалось загрузить статистику.", deleteError: "Не удалось удалить пользователя.", loading: "Загружаем обезличенную статистику…",
    adminOnly: "Только для администратора", title: "Активность GENESIS", intro: "Названия, заметки и история привычек остаются зашифрованными. Панель получает только агрегированные количества.",
    users: "пользователей", habits: "привычек", tasks: "задач", projects: "проектов", blocked: "в чёрном списке",
    user: "Пользователь", activity: "Последняя активность", logins: "Входы", google: "Google", moderation: "Модерация", admin: "администратор", aggregate: "зашифрованный агрегат", open: "открыто", completed: "завершено", events: "событий", connected: "Подключён", no: "Нет", lastCheck: "Последняя проверка", protected: "Защищён", remove: "Удалить",
    androidTitle: "Android: загрузки и синхронизация", androidIntro: "Считаются запросы на загрузку из авторизованного аккаунта на сайте. Анонимную или прямую загрузку APK нельзя связать с пользователем. Версия появляется после обращения приложения к серверу и не подтверждает, что оно установлено сейчас.",
    trackedDownloads: "запросов из аккаунтов", reportingUsers: "пользователей с откликом приложения", download: "Загрузка", version: "Версия приложения", googleServices: "Сервисы Google", server: "Сервер", noDownload: "Нет учтённых запросов", first: "Первый", last: "Последний", requested: "запрошена", devices: "установок", lastContact: "Последняя связь", noReport: "Пока нет данных", authorized: "Авторизован", disconnected: "Не подключён", syncOk: "В порядке", syncWarning: "Нужна проверка", syncUnknown: "Не проверено", staleSync: "Давно не проверялось", lastSync: "Последняя синхронизация", calendarSync: "Календарь",
    irreversible: "Необратимое действие", deleteTitle: "Удалить пользователя?", deleteLead: "Будут окончательно удалены аккаунт, зашифрованное пространство, привычки, статистика, задачи и все связанные серверные данные пользователя",
    blacklistAria: "Добавить пользователя в чёрный список", blacklistTitle: "Добавить в чёрный список после удаления", blacklistHelp: "Повторный вход с тем же Google ID или e-mail будет заблокирован. На сервере сохранятся только необратимые криптографические отпечатки.",
    confirmLabel: "Для подтверждения введите e-mail пользователя", cancel: "Отмена", deleting: "Удаляем…", deleteAndBlock: "Удалить и заблокировать", deleteUser: "Удалить пользователя",
  };
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserStats | null>(null);
  const [activityTargetId, setActivityTargetId] = useState<string | null>(null);
  const activityTarget = stats?.users.find(user => user.id === activityTargetId) ?? null;
  const [confirmation, setConfirmation] = useState("");
  const [blacklist, setBlacklist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<AdminSection>(adminSectionFromHash);
  const mobileUsers=useSyncExternalStore(subscribeMobileUsers,mobileUsersSnapshot,desktopUsersSnapshot);
  const [userPage,setUserPage]=useState(1);
  const userPageCount=Math.max(1,Math.ceil((stats?.users.length ?? 0)/10));
  const currentUserPage=Math.min(userPage,userPageCount);
  const visibleUsers=mobileUsers ? stats?.users.slice((currentUserPage-1)*10,currentUserPage*10) ?? [] : stats?.users ?? [];
  const userPagination=mobileUsers&&userPageCount>1 ? <nav className="admin-user-pagination" aria-label={userCopy("pages")} data-no-translate>
    {Array.from({length:userPageCount},(_,index)=>index+1).map(page=><button type="button" key={page} aria-label={`${userCopy("page")} ${page}`} aria-current={currentUserPage===page ? "page" : undefined} onClick={()=>{setUserPage(page);requestAnimationFrame(()=>document.getElementById("admin-users-title")?.scrollIntoView({block:"start"}));}}>{page}</button>)}
  </nav> : null;

  useEffect(() => {
    const followSection = () => setSection(adminSectionFromHash());
    window.addEventListener("hashchange", followSection);
    return () => window.removeEventListener("hashchange", followSection);
  }, []);

  const openSection = (nextSection: AdminSection) => {
    setSection(nextSection);
    window.location.hash = nextSection === "analytics" ? "admin" : `admin/${nextSection}`;
  };

  const refresh = useCallback(async () => {
    setError("");
    try {
      setStats(await loadAdminStats());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.loadError);
    }
  }, [copy.loadError]);

  useEffect(() => {
    let active = true;
    void loadAdminStats()
      .then((nextStats) => { if (active) setStats(nextStats); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, []);

  const closeDeleteDialog = () => {
    if (busy) return;
    setDeleteTarget(null);
    setConfirmation("");
    setBlacklist(false);
  };

  const confirmDeletion = async () => {
    if (!deleteTarget || confirmation.trim().toLowerCase() !== deleteTarget.email.toLowerCase()) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteAdminUser(deleteTarget.id, blacklist);
      setMessage(result.blacklisted
        ? (isEnglish ? `User ${deleteTarget.email} was deleted and blacklisted.` : `Пользователь ${deleteTarget.email} удалён и добавлен в чёрный список.`)
        : (isEnglish ? `User ${deleteTarget.email} was deleted.` : `Пользователь ${deleteTarget.email} удалён.`));
      setDeleteTarget(null);
      setConfirmation("");
      setBlacklist(false);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.deleteError);
    } finally {
      setBusy(false);
    }
  };
  const deleteDialogRef = useDialogAccessibility<HTMLElement>(closeDeleteDialog, Boolean(deleteTarget));
  const closeActivityDialog = () => setActivityTargetId(null);
  const activityDialogRef = useDialogAccessibility<HTMLElement>(closeActivityDialog, Boolean(activityTarget));

  if (!stats && !error) return <section className="admin-view" data-exp-layout="view"><p>{copy.loading}</p></section>;

  return (
    <section className="admin-view" data-exp-layout="view" aria-labelledby="admin-title">
      <header className="projects-header">
        <div><span className="eyebrow">{copy.adminOnly}</span><h1 id="admin-title">{copy.title}</h1><p>{copy.intro}</p></div>
      </header>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {message ? <p className="admin-success" role="status">{message}</p> : null}
      <nav className="admin-section-tabs" aria-label={isEnglish ? "Administration sections" : "Разделы администрирования"}>
        <button type="button" className="secondary-button" aria-current={section === "analytics" ? "page" : undefined} onClick={() => openSection("analytics")}>{isEnglish ? "Analytics" : "Аналитика"}</button>
        <button type="button" className="secondary-button" aria-current={section === "ads" ? "page" : undefined} onClick={() => openSection("ads")}>{isEnglish ? "Advertising" : "Реклама"}</button>
        <button type="button" className="secondary-button" aria-current={section === "actions" ? "page" : undefined} onClick={() => openSection("actions")}>{isEnglish ? "Actions" : "Действия"}</button>
      </nav>
      {section === "ads" ? <AdminAdsPanel /> : null}
      {stats && section === "analytics" ? <>
        <div className="admin-totals">
          <article><strong>{stats.totals.users}</strong><span>{copy.users}</span></article>
          <article><strong>{stats.totals.habits}</strong><span>{copy.habits}</span></article>
          <article><strong>{stats.totals.tasks}</strong><span>{copy.tasks}</span></article>
          <article><strong>{stats.totals.projects}</strong><span>{copy.projects}</span></article>
          <article><strong>{stats.totals.blockedIdentities}</strong><span>{copy.blocked}</span></article>
        </div>
        <div className="admin-information-row admin-download-information">
          <p className="admin-android-note">{copy.androidIntro}</p>
          <div className="admin-android-summary">
            <span><strong>{stats.totals.androidDownloadRequests}</strong><span>{copy.trackedDownloads}</span></span>
            <span><strong>{stats.totals.androidReportingUsers}</strong><span>{copy.reportingUsers}</span></span>
          </div>
        </div>
        <div className="admin-users-heading"><h2 id="admin-users-title" data-no-translate>{userCopy("users")}</h2><span aria-live="polite" data-no-translate>{mobileUsers&&stats.users.length ? `${(currentUserPage-1)*10+1}–${Math.min(currentUserPage*10,stats.users.length)} / ${stats.users.length}` : stats.users.length}</span></div>
        <p className="admin-activity-help" data-no-translate>{userCopy("activityHelp")} {userCopy("deviceHistoryHelp")}</p>
        {userPagination}
        {!stats.users.length ? <p data-no-translate>{userCopy("empty")}</p> : null}
        <div className="admin-table-wrap">
          <table className="admin-table admin-users-table">
            <thead><tr><th>{copy.user}</th><th data-no-translate>{userCopy("plan")}</th><th>{copy.activity}</th><th>{copy.logins}</th><th>{copy.habits}</th><th>{copy.projects}</th><th>{copy.tasks}</th><th>{copy.google}</th><th>{copy.download}</th><th>{copy.version}</th><th>{copy.googleServices}</th><th>{copy.server}</th><th>{copy.moderation}</th></tr></thead>
            <tbody>{visibleUsers.map((user) => (
              <tr key={user.id}>
                <td data-label={copy.user}><strong>{user.email}</strong><small>{user.displayName}{user.isAdmin ? ` · ${copy.admin}` : ""}</small></td>
                <td className="admin-subscription-cell" data-label={userCopy("plan")}><SubscriptionControl user={user} onRefresh={refresh} onSaved={subscriptionPlan=>setStats(current=>current ? {...current,users:current.users.map(item=>item.id===user.id ? {...item,subscriptionPlan} : item)} : current)}/></td>
                <td className="admin-activity-cell" data-label={copy.activity} data-no-translate>
                  <button type="button" className="secondary-button admin-activity-open" aria-haspopup="dialog" aria-label={`${userCopy("activityDetails")}: ${user.email}`} onClick={() => setActivityTargetId(user.id)}>{userCopy("activityDetails")}</button>
                </td>
                <td data-label={copy.logins}>{user.loginCount}</td>
                <td data-label={copy.habits}><strong>{user.habitCount}</strong><small>{copy.aggregate}</small></td>
                <td data-label={copy.projects}>{user.projectCount}</td>
                <td data-label={copy.tasks}>{user.taskCount}<small>{user.openTaskCount} {copy.open} · {user.completedTaskCount} {copy.completed}</small></td>
                <td data-label={copy.google}>{user.calendarConnected ? copy.connected : copy.no}<small>{user.googleSyncedCount} {copy.events}</small></td>
                  <td data-label={copy.download}><strong>{user.androidDownloadCount > 0 ? user.androidDownloadCount : copy.noDownload}</strong>
                    {user.androidDownloadCount > 0 ? <small>{copy.first}: {formatActivity(user.androidFirstDownloadAt)}<br />{copy.last}: {formatActivity(user.androidLastDownloadAt)} · {user.androidLastDownloadVersion} {copy.requested}</small> : null}</td>
                  <td data-label={copy.version}><strong>{user.androidReportedVersion ?? copy.noReport}</strong>
                    <small>{user.androidDeviceCount} {copy.devices} · {copy.lastContact}: {formatActivity(user.androidLastSeenAt)}</small></td>
                  <td data-label={copy.googleServices}><strong>{user.googleAuthConnected ? copy.authorized : copy.disconnected}</strong>
                    <small>{syncStatusLabel(user.androidGoogleSyncStatus, copy, user.androidLastServerSyncAt)} · {copy.lastSync}: {formatActivity(user.androidLastServerSyncAt)}
                      {user.lastGoogleCalendarSyncAt ? <><br />{copy.calendarSync}: {formatActivity(user.lastGoogleCalendarSyncAt)}</> : null}</small></td>
                  <td data-label={copy.server}><strong>{syncStatusLabel(user.androidServerSyncStatus, copy, user.androidLastServerSyncAt)}</strong>
                    <small>{copy.lastSync}: {formatActivity(user.androidLastServerSyncAt)}</small></td>
                <td data-label={copy.moderation}>{user.isAdmin ? <span className="admin-protected">{copy.protected}</span> : <button type="button" className="admin-delete-user" onClick={() => { setDeleteTarget(user); setMessage(""); }}>{copy.remove}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {userPagination}
      </> : null}
      {stats && section === "actions" ? (
        <section className="admin-feature-usage" aria-labelledby="admin-feature-title">
          <h2 id="admin-feature-title">{isEnglish ? "Actions and counts" : "Действия и их количество"}</h2>
          <div className="admin-information-row admin-feature-information">
            <p className="admin-android-note">{isEnglish
              ? "Counts start with the first recorded visit. ‘No recorded visit’ includes older accounts whose earlier activity was not measured. Disabled counts reflect current menu and calendar settings. Only feature identifiers and counts are stored."
              : "Подсчёт начинается с первого зафиксированного открытия. В колонку «Без открытия» входят и старые аккаунты, действия которых раньше не измерялись. «Выключено» показывает текущие настройки меню и календарей. Сохраняются только идентификаторы функций и счётчики."}</p>
            <p className="admin-android-note admin-first-event"><span>{isEnglish ? "First record" : "Первое событие"}</span><strong>{formatActivity(stats.featureUsage?.startedAt ?? null)}</strong></p>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table" data-testid="admin-feature-usage">
              <thead><tr><th>{isEnglish ? "Feature" : "Функция"}</th><th>{isEnglish ? "Users" : "Пользователи"}</th>
                <th>{isEnglish ? "Opens" : "Открытия"}</th><th>Web</th><th>Android</th>
                <th>{isEnglish ? "Disabled" : "Выключено"}</th>
                <th>{isEnglish ? "No recorded visit" : "Без открытия"}</th></tr></thead>
              <tbody>{(stats.featureUsage?.features ?? []).map((feature) => (
                <tr key={feature.id}>
                  <td data-label={isEnglish ? "Feature" : "Функция"}><strong>{featureNames[feature.id]?.[isEnglish ? 1 : 0] ?? feature.id}</strong></td>
                  <td data-label={isEnglish ? "Users" : "Пользователи"}>{feature.usedUsers}</td>
                  <td data-label={isEnglish ? "Opens" : "Открытия"}>{feature.opens}</td>
                  <td data-label="Web">{feature.webOpens}</td>
                  <td data-label="Android">{feature.androidOpens}</td>
                  <td data-label={isEnglish ? "Disabled" : "Выключено"}>{feature.disabledUsers}</td>
                  <td data-label={isEnglish ? "No recorded visit" : "Без открытия"}>
                    {Math.max(0, (stats.featureUsage?.accountCount ?? 0) - feature.usedUsers)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}
      {activityTarget ? <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeActivityDialog(); }}>
        <section ref={activityDialogRef} className="admin-activity-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-activity-title" aria-describedby="admin-activity-user" tabIndex={-1}>
          <header><h2 id="admin-activity-title">{copy.activity}</h2><DialogCloseButton aria-label={isEnglish ? "Close" : "Закрыть"} onClick={closeActivityDialog} /></header>
          <p id="admin-activity-user" data-no-translate>{activityTarget.email}</p>
          <dl className="admin-activity-summary" data-no-translate>
            <div><dt>{userCopy("serverActivity")}</dt><dd><time dateTime={activityTarget.lastSeenAt ?? undefined}>{formatActivity(activityTarget.lastSeenAt)}</time></dd></div>
            <div><dt>{userCopy("newSignIn")}</dt><dd><time dateTime={activityTarget.lastLoginAt ?? undefined}>{formatActivity(activityTarget.lastLoginAt)}</time></dd></div>
            <div><dt>{userCopy("registered")}</dt><dd><time dateTime={activityTarget.createdAt}>{formatActivity(activityTarget.createdAt)}</time></dd></div>
          </dl>
          {(activityTarget.clientActivity ?? []).map(client => <section key={client.kind} className="admin-client-activity" data-no-translate>
            <h3>{userCopy(client.kind)}</h3>
            <dl className="admin-activity-summary">
              <div><dt>{userCopy("serverContact")}</dt><dd><time dateTime={client.lastSeenAt}>{formatActivity(client.lastSeenAt)}</time></dd></div>
              <div><dt>{userCopy("newSignIn")}</dt><dd><time dateTime={client.lastLoginAt ?? undefined}>{formatActivity(client.lastLoginAt)}</time></dd></div>
            </dl>
          </section>)}
        </section>
      </div> : null}
      {deleteTarget ? <div className="modal-backdrop admin-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteDialog(); }}>
        <section ref={deleteDialogRef} className="admin-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title" tabIndex={-1}>
          <header><div><span className="eyebrow">{copy.irreversible}</span><h2 id="admin-delete-title">{copy.deleteTitle}</h2></div><DialogCloseButton type="button" className="modal-close" onClick={closeDeleteDialog} aria-label={isEnglish ? "Close" : "Закрыть"} /></header>
          <p>{copy.deleteLead} <strong>{deleteTarget.email}</strong>.</p>
          <label className="admin-blacklist-choice" htmlFor="admin-blacklist-user"><input id="admin-blacklist-user" type="checkbox" aria-label={copy.blacklistAria} checked={blacklist} onChange={(event) => setBlacklist(event.target.checked)} /><span><strong>{copy.blacklistTitle}</strong><small>{copy.blacklistHelp}</small></span></label>
          <label className="admin-delete-confirm" htmlFor="admin-delete-email"><span>{copy.confirmLabel}</span><input id="admin-delete-email" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={deleteTarget.email} /></label>
          <footer><button type="button" className="secondary-button" disabled={busy} onClick={closeDeleteDialog}>{copy.cancel}</button><button type="button" className="admin-delete-confirm-button" disabled={busy || confirmation.trim().toLowerCase() !== deleteTarget.email.toLowerCase()} onClick={() => void confirmDeletion()}>{busy ? copy.deleting : blacklist ? copy.deleteAndBlock : copy.deleteUser}</button></footer>
        </section>
      </div> : null}
    </section>
  );
}
