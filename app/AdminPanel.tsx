"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteAdminUser, type AdminStats, type AdminUserStats, loadAdminStats } from "./cloud-sync";
import { runtimeLocale } from "./i18n";
import { useDialogAccessibility } from "./use-dialog-accessibility";

function formatActivity(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(runtimeLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminPanel() {
  const isEnglish = runtimeLocale().startsWith("en");
  const copy = isEnglish ? {
    loadError: "Could not load statistics.", deleteError: "Could not delete the user.", loading: "Loading anonymized statistics…",
    adminOnly: "Administrators only", title: "GENESIS activity", intro: "Habit titles, notes and history remain encrypted. The panel receives aggregate counts only.", refresh: "Refresh",
    users: "users", habits: "habits", tasks: "tasks", projects: "projects", blocked: "blacklisted",
    user: "User", activity: "Last activity", logins: "Logins", google: "Google", moderation: "Moderation", admin: "administrator", aggregate: "encrypted aggregate", open: "open", completed: "completed", events: "events", connected: "Connected", no: "No", protected: "Protected", remove: "Delete",
    irreversible: "Irreversible action", deleteTitle: "Delete user?", deleteLead: "The account, encrypted workspace, habits, statistics, tasks and all related server data will be permanently deleted for",
    blacklistAria: "Add user to blacklist", blacklistTitle: "Add to blacklist after deletion", blacklistHelp: "Future sign-in with the same Google ID or email will be blocked. Only irreversible cryptographic fingerprints remain on the server.",
    confirmLabel: "Enter the user's email to confirm", cancel: "Cancel", deleting: "Deleting…", deleteAndBlock: "Delete and block", deleteUser: "Delete user",
  } : {
    loadError: "Не удалось загрузить статистику.", deleteError: "Не удалось удалить пользователя.", loading: "Загружаем обезличенную статистику…",
    adminOnly: "Только для администратора", title: "Активность GENESIS", intro: "Названия, заметки и история привычек остаются зашифрованными. Панель получает только агрегированные количества.", refresh: "Обновить",
    users: "пользователей", habits: "привычек", tasks: "задач", projects: "проектов", blocked: "в чёрном списке",
    user: "Пользователь", activity: "Последняя активность", logins: "Входы", google: "Google", moderation: "Модерация", admin: "администратор", aggregate: "зашифрованный агрегат", open: "открыто", completed: "завершено", events: "событий", connected: "Подключён", no: "Нет", protected: "Защищён", remove: "Удалить",
    irreversible: "Необратимое действие", deleteTitle: "Удалить пользователя?", deleteLead: "Будут окончательно удалены аккаунт, зашифрованное пространство, привычки, статистика, задачи и все связанные серверные данные пользователя",
    blacklistAria: "Добавить пользователя в чёрный список", blacklistTitle: "Добавить в чёрный список после удаления", blacklistHelp: "Повторный вход с тем же Google ID или e-mail будет заблокирован. На сервере сохранятся только необратимые криптографические отпечатки.",
    confirmLabel: "Для подтверждения введите e-mail пользователя", cancel: "Отмена", deleting: "Удаляем…", deleteAndBlock: "Удалить и заблокировать", deleteUser: "Удалить пользователя",
  };
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserStats | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [blacklist, setBlacklist] = useState(false);
  const [busy, setBusy] = useState(false);

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

  if (!stats && !error) return <section className="admin-view"><p>{copy.loading}</p></section>;

  return (
    <section className="admin-view" aria-labelledby="admin-title">
      <header className="projects-header">
        <div><span className="eyebrow">{copy.adminOnly}</span><h1 id="admin-title">{copy.title}</h1><p>{copy.intro}</p></div>
        <button type="button" className="secondary-button" onClick={() => void refresh()}>{copy.refresh}</button>
      </header>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {message ? <p className="admin-success" role="status">{message}</p> : null}
      {stats ? <>
        <div className="admin-totals">
          <article><strong>{stats.totals.users}</strong><span>{copy.users}</span></article>
          <article><strong>{stats.totals.habits}</strong><span>{copy.habits}</span></article>
          <article><strong>{stats.totals.tasks}</strong><span>{copy.tasks}</span></article>
          <article><strong>{stats.totals.projects}</strong><span>{copy.projects}</span></article>
          <article><strong>{stats.totals.blockedIdentities}</strong><span>{copy.blocked}</span></article>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>{copy.user}</th><th>{copy.activity}</th><th>{copy.logins}</th><th>{copy.habits}</th><th>{copy.projects}</th><th>{copy.tasks}</th><th>{copy.google}</th><th>{copy.moderation}</th></tr></thead>
            <tbody>{stats.users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.email}</strong><small>{user.displayName}{user.isAdmin ? ` · ${copy.admin}` : ""}</small></td>
                <td>{formatActivity(user.lastSeenAt)}</td>
                <td>{user.loginCount}</td>
                <td><strong>{user.habitCount}</strong><small>{copy.aggregate}</small></td>
                <td>{user.projectCount}</td>
                <td>{user.taskCount}<small>{user.openTaskCount} {copy.open} · {user.completedTaskCount} {copy.completed}</small></td>
                <td>{user.calendarConnected ? copy.connected : copy.no}<small>{user.googleSyncedCount} {copy.events}</small></td>
                <td>{user.isAdmin ? <span className="admin-protected">{copy.protected}</span> : <button type="button" className="admin-delete-user" onClick={() => { setDeleteTarget(user); setMessage(""); }}>{copy.remove}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </> : null}
      {deleteTarget ? <div className="modal-backdrop admin-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteDialog(); }}>
        <section ref={deleteDialogRef} className="admin-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title" tabIndex={-1}>
          <header><div><span className="eyebrow">{copy.irreversible}</span><h2 id="admin-delete-title">{copy.deleteTitle}</h2></div><button type="button" className="modal-close" onClick={closeDeleteDialog} aria-label={isEnglish ? "Close" : "Закрыть"}>×</button></header>
          <p>{copy.deleteLead} <strong>{deleteTarget.email}</strong>.</p>
          <label className="admin-blacklist-choice" htmlFor="admin-blacklist-user"><input id="admin-blacklist-user" type="checkbox" aria-label={copy.blacklistAria} checked={blacklist} onChange={(event) => setBlacklist(event.target.checked)} /><span><strong>{copy.blacklistTitle}</strong><small>{copy.blacklistHelp}</small></span></label>
          <label className="admin-delete-confirm" htmlFor="admin-delete-email"><span>{copy.confirmLabel}</span><input id="admin-delete-email" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={deleteTarget.email} /></label>
          <footer><button type="button" className="secondary-button" disabled={busy} onClick={closeDeleteDialog}>{copy.cancel}</button><button type="button" className="admin-delete-confirm-button" disabled={busy || confirmation.trim().toLowerCase() !== deleteTarget.email.toLowerCase()} onClick={() => void confirmDeletion()}>{busy ? copy.deleting : blacklist ? copy.deleteAndBlock : copy.deleteUser}</button></footer>
        </section>
      </div> : null}
    </section>
  );
}
