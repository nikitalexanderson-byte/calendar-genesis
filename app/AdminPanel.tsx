"use client";

import { useEffect, useState } from "react";
import { type AdminStats, loadAdminStats } from "./cloud-sync";
import { runtimeLocale } from "./i18n";

export function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAdminStats().then(setStats).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <section className="admin-view"><p className="auth-error">{error}</p></section>;
  if (!stats) return <section className="admin-view"><p>Загружаем обезличенную статистику…</p></section>;

  return (
    <section className="admin-view" aria-labelledby="admin-title">
      <header className="projects-header">
        <div><span className="eyebrow">Только для администратора</span><h1 id="admin-title">Активность GENESIS</h1><p>Здесь нет названий, заметок или содержимого задач.</p></div>
      </header>
      <div className="admin-totals">
        <article><strong>{stats.totals.users}</strong><span>пользователей</span></article>
        <article><strong>{stats.totals.projects}</strong><span>проектов</span></article>
        <article><strong>{stats.totals.tasks}</strong><span>задач</span></article>
        <article><strong>{stats.totals.completedTasks}</strong><span>завершено</span></article>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Пользователь</th><th>Последняя активность</th><th>Входы</th><th>Проекты</th><th>Задачи</th><th>Выполнено</th><th>Google</th></tr></thead>
          <tbody>{stats.users.map((user) => (
            <tr key={user.email}>
              <td><strong>{user.email}</strong><small>{user.displayName}</small></td>
              <td>{user.lastSeenAt ? new Intl.DateTimeFormat(runtimeLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(user.lastSeenAt)) : "—"}</td>
              <td>{user.loginCount}</td>
              <td>{user.projectCount}</td>
              <td>{user.taskCount}<small>{user.openTaskCount} открыто</small></td>
              <td>{user.completedTaskCount}</td>
              <td>{user.calendarConnected ? "Подключён" : "Нет"}<small>{user.googleSyncedCount} событий</small></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
