"use client";

import { useState } from "react";
import type { GenesisUser } from "./cloud-sync";
import { deleteGenesisAccount, disconnectGoogleServices, updateAccountPreferences } from "./cloud-sync";

type AccountPanelProps = {
  user: GenesisUser;
  onClose: () => void;
  onReconnectGoogle: () => void;
  onUserChange: (user: GenesisUser) => void;
};

export function AccountPanel({ user, onClose, onReconnectGoogle, onUserChange }: AccountPanelProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);

  const changeDivinationPreference = async (disabled: boolean) => {
    setPreferenceBusy(true);
    setMessage("");
    try {
      const result = await updateAccountPreferences(disabled);
      onUserChange(result.user);
      setMessage(disabled
        ? "Гадания отключены. В Стойхейоне остались только карты и их значения."
        : "Гадания снова доступны в Стойхейоне.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить настройку гаданий.");
    } finally {
      setPreferenceBusy(false);
    }
  };

  const removeAccount = async () => {
    if (!window.confirm("Удалить аккаунт GENESIS и данные с сервера? Разрешения Google будут отозваны. События и списки задач останутся в вашем Google-аккаунте.")) return;
    setBusy(true);
    try {
      await deleteGenesisAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить аккаунт.");
      setBusy(false);
    }
  };

  const disconnectServices = async () => {
    if (!window.confirm("Отключить Google Calendar и Google Tasks? GENESIS отзовёт разрешения Google. Ваши события, списки и задачи останутся в Google.")) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await disconnectGoogleServices();
      onUserChange(result.user);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отключить Google Calendar и Tasks.");
    } finally {
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
          <article><span>Google-сервисы</span><strong>{user.calendarConnected && user.googleTasksImportReady ? "Подключены" : "По желанию"}</strong><small>Calendar и Tasks подключаются отдельным согласием после входа.</small></article>
          <article><span>Структура проектов</span><strong>Зашифрована</strong><small>AES-GCM до отправки на сервер.</small></article>
          <article><span>Офлайн-копия</span><strong>На устройстве</strong><small>Доступна без сети после входа на этом устройстве.</small></article>
        </div>

        {!user.googleTasksImportReady ? (
          <section className="account-sync-upgrade" aria-label="Синхронизация Google Tasks">
            <div>
              <strong>Подключите Google Calendar и Google Tasks</strong>
              <small>После вашего подтверждения GENESIS создаст отдельный календарь и сможет показывать и изменять списки Google Tasks. Доступ нужен только для функций синхронизации.</small>
            </div>
            <button type="button" onClick={onReconnectGoogle}>Подключить</button>
          </section>
        ) : null}

        <section className="account-preferences" aria-labelledby="account-preferences-title">
          <div>
            <span className="eyebrow">Самоограничение</span>
            <h3 id="account-preferences-title">Гадания в Стойхейоне</h3>
          </div>
          <label className="account-switch-row">
            <span>
              <strong>Запретить себе гадания</strong>
              <small>Скрывает карту дня и расклад девяти карт на всех устройствах. Каталог 24 буквенных карт и их значения останутся доступны.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={Boolean(user.stoicheionDivinationDisabled)}
              disabled={preferenceBusy}
              onChange={(event) => void changeDivinationPreference(event.target.checked)}
              aria-label="Запретить себе гадания по картам"
            />
            <i aria-hidden="true" />
          </label>
          <p className="account-preference-status" aria-live="polite">
            {user.stoicheionDivinationDisabled ? "Гадания выключены" : "Гадания доступны"}
          </p>
        </section>

        <section className="account-oauth-note" aria-label="Безопасность входа">
          <h3>Безопасный вход</h3>
          <p>Авторизация выполняется только через официальный OAuth Google. GENESIS не получает, не запрашивает и не хранит пароль. Токены доступа шифруются на сервере, а при удалении аккаунта разрешение отзывается у Google.</p>
          <p><a href="/privacy">Подробнее об использовании данных Google</a></p>
          <button type="button" className="text-button" onClick={onReconnectGoogle}>Обновить разрешения Calendar и Tasks</button>
          {user.calendarConnected || user.googleTasksImportReady ? (
            <button type="button" className="text-button" onClick={() => void disconnectServices()} disabled={busy}>Отключить Calendar и Tasks</button>
          ) : null}
        </section>

        {message ? <p className="account-message" role="status">{message}</p> : null}

        <div className="account-danger">
          <div><strong>Удаление аккаунта</strong><small>Удалит профиль и данные с сервера GENESIS, а также отзовёт выданные приложению разрешения Google.</small></div>
          <button type="button" onClick={() => void removeAccount()} disabled={busy}>Удалить</button>
        </div>
      </section>
    </div>
  );
}
