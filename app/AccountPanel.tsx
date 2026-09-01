"use client";

import { useState } from "react";
import type { GenesisUser } from "./cloud-sync";
import { deleteGenesisAccount } from "./cloud-sync";

type AccountPanelProps = {
  user: GenesisUser;
  onClose: () => void;
};

export function AccountPanel({ user, onClose }: AccountPanelProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const removeAccount = async () => {
    if (!window.confirm("Удалить аккаунт GENESIS, зашифрованную структуру и статистику? События в вашем Google Calendar останутся у вас.")) return;
    setBusy(true);
    try {
      await deleteGenesisAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить аккаунт.");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <span className="eyebrow">Личный кабинет</span>
        <h2 id="account-title">{user.displayName || "Аккаунт GENESIS"}</h2>
        <p className="account-email">{user.email}</p>

        <div className="account-security-grid">
          <article><span>Google Calendar</span><strong>{user.calendarConnected ? "Подключён" : "Нужно подключить"}</strong><small>Задачи и напоминания хранятся в календаре GENESIS.</small></article>
          <article><span>Структура проектов</span><strong>Зашифрована</strong><small>AES-GCM до отправки на сервер.</small></article>
          <article><span>Офлайн-копия</span><strong>На устройстве</strong><small>Доступна без сети после входа на этом устройстве.</small></article>
        </div>

        <section className="account-oauth-note" aria-label="Безопасность входа">
          <h3>Безопасный вход</h3>
          <p>Авторизация выполняется только через официальный OAuth Google. GENESIS не получает, не запрашивает и не хранит пароль от вашего аккаунта Google.</p>
        </section>

        {message ? <p className="account-message" role="status">{message}</p> : null}

        <div className="account-danger">
          <div><strong>Удаление аккаунта</strong><small>Удалит профиль, зашифрованную структуру и статистику с сервера GENESIS.</small></div>
          <button type="button" onClick={() => void removeAccount()} disabled={busy}>Удалить</button>
        </div>
      </section>
    </div>
  );
}
