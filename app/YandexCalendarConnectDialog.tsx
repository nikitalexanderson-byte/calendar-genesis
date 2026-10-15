"use client";
import { DialogCloseButton } from "./DialogCloseButton";

import { useState } from "react";
import { connectYandexCalendar, type GenesisUser } from "./cloud-sync";
import { translateText } from "./i18n";
import { useDialogAccessibility } from "./use-dialog-accessibility";

type Props = {
  user: GenesisUser;
  onClose: () => void;
  onConnected: (user: GenesisUser) => void;
};

export function YandexCalendarConnectDialog({ user, onClose, onConnected }: Props) {
  const t = (copy: string) => translateText(copy, user.language);
  const [login, setLogin] = useState(user.email ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useDialogAccessibility<HTMLElement>(busy ? () => undefined : onClose);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await connectYandexCalendar(login.trim(), appPassword);
      setAppPassword("");
      onConnected(result.user);
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "Не удалось подключить Яндекс.Календарь."));
    } finally {
      setBusy(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="yandex-connect-dialog" role="dialog" aria-modal="true" aria-labelledby="yandex-connect-title" aria-describedby="yandex-connect-description" tabIndex={-1}>
      <DialogCloseButton type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label={t("Закрыть")} />
      <span className="eyebrow">Яндекс ID</span>
      <h2 id="yandex-connect-title">{t("Подключить Яндекс.Календарь")}</h2>
      <p id="yandex-connect-description">{t("В Яндекс ID откройте «Пароли приложений» → «Календарь». Название можно придумать, а сам пароль выдаёт Яндекс. Скопируйте его сюда.")}</p>
      <p><a href="https://id.yandex.ru/security/app-passwords" target="_blank" rel="noopener noreferrer">{t("Открыть создание пароля Календаря в Яндекс ID")}</a></p>
      <form className="yandex-calendar-form" onSubmit={(event) => { event.preventDefault(); void connect(); }}>
        <label>{t("Логин Яндекса")}<input type="text" value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required maxLength={254} /></label>
        <label>{t("Пароль приложения «Календарь»")}<input type="password" value={appPassword} onChange={(event) => setAppPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={256} /></label>
        {error ? <p className="yandex-connect-error" role="alert">{error}</p> : null}
        <div className="yandex-connect-actions">
          <button type="button" className="text-button" onClick={onClose} disabled={busy}>{t("Позже")}</button>
          <button type="submit" className="primary-button" disabled={busy}>{t("Подключить")}</button>
        </div>
      </form>
      <small>{t("Пароль приложения сохраняется на сервере GENESIS в зашифрованном виде. Яндекс может активировать новый пароль через 2–3 часа.")}</small>
    </section>
  </div>;
}
