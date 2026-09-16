"use client";
/* eslint-disable @next/next/no-img-element -- Google profile pictures are remote OAuth assets. */

import { useState } from "react";
import type { CalendarMode } from "./calendar-data";
import type { GenesisCategory, GenesisUser, SyncRouting } from "./cloud-sync";
import { deleteGenesisAccount, disconnectGoogleServices, removeAdditionalGoogleAccount, updateAccountPreferences } from "./cloud-sync";
import { runtimeLocale, translateText, type Language } from "./i18n";

type AccountPanelProps = {
  user: GenesisUser;
  onClose: () => void;
  onReconnectGoogle: () => void;
  onConnectAdditionalGoogle: () => void;
  onLanguageChange: (language: Language) => void;
  onUserChange: (user: GenesisUser) => void;
  categories: GenesisCategory[];
};

const CALENDAR_MODES: Array<{ id: CalendarMode; label: string; hint: string }> = [
  { id: "sacred", label: "Сакральный", hint: "Месяцы, пяты и дни GENESIS" },
  { id: "lunar", label: "Лунный", hint: "Лунные месяцы и дни" },
  { id: "profane", label: "Профанский", hint: "Обычные даты, недели и 12 месяцев" },
];

export function AccountPanel({ user, onClose, onReconnectGoogle, onConnectAdditionalGoogle, onLanguageChange, onUserChange, categories }: AccountPanelProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [routing, setRouting] = useState<SyncRouting>(() => user.syncRouting ?? {
    mode: "fixed",
    defaultAccountIds: [user.uid],
    categoryAccountIds: {},
  });

  const changeDivinationPreference = async (disabled: boolean) => {
    setPreferenceBusy(true);
    setMessage("");
    try {
      const result = await updateAccountPreferences({ stoicheionDivinationDisabled: disabled });
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

  const changeCalendarMode = async (calendarMode: CalendarMode) => {
    setPreferenceBusy(true);
    setMessage("");
    try {
      const result = await updateAccountPreferences({ calendarMode });
      onUserChange(result.user);
      setMessage(`Основной календарь переключён: ${CALENDAR_MODES.find((item) => item.id === calendarMode)?.label.toLocaleLowerCase(runtimeLocale())}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось переключить календарь.");
    } finally {
      setPreferenceBusy(false);
    }
  };

  const changeTaskCalendarMode = async (taskCalendarMode: CalendarMode) => {
    setPreferenceBusy(true);
    setMessage("");
    try {
      const result = await updateAccountPreferences({ taskCalendarMode });
      onUserChange(result.user);
      setMessage(`Календарь постановки задач переключён: ${CALENDAR_MODES.find((item) => item.id === taskCalendarMode)?.label.toLocaleLowerCase(runtimeLocale())}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось переключить календарь постановки задач.");
    } finally {
      setPreferenceBusy(false);
    }
  };

  const changeLanguage = async (language: Language) => {
    if (user.language === language) return;
    setPreferenceBusy(true);
    setMessage("");
    try {
      const result = await updateAccountPreferences({ language });
      onUserChange(result.user);
      onLanguageChange(language);
      setMessage(language === "en" ? "Language changed to English." : "Язык переключён на русский.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось переключить язык.");
    } finally {
      setPreferenceBusy(false);
    }
  };

  const saveRouting = async () => {
    setPreferenceBusy(true);
    setMessage("");
    try {
      const result = await updateAccountPreferences({ syncRouting: routing });
      onUserChange(result.user);
      setRouting(result.user.syncRouting);
      setMessage("Маршрутизация задач по Google-аккаунтам сохранена.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить маршрутизацию.");
    } finally {
      setPreferenceBusy(false);
    }
  };

  const removeAdditionalAccount = async (accountId: string) => {
    if (!window.confirm(translateText("Отключить дополнительный Google-аккаунт от пространства GENESIS? Уже созданные события и задачи останутся в Google.", undefined, true))) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await removeAdditionalGoogleAccount(accountId);
      onUserChange(result.user);
      setRouting((current) => ({
        ...current,
        defaultAccountIds: current.defaultAccountIds.filter((id) => id !== accountId),
        categoryAccountIds: Object.fromEntries(Object.entries(current.categoryAccountIds).map(([categoryId, ids]) => [categoryId, ids.filter((id) => id !== accountId)])),
      }));
      setMessage("Дополнительный Google-аккаунт отключён.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отключить дополнительный аккаунт.");
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    if (!window.confirm(translateText("Удалить аккаунт GENESIS и данные с сервера? Разрешения Google будут отозваны. События и списки задач останутся в вашем Google-аккаунте.", undefined, true))) return;
    setBusy(true);
    try {
      await deleteGenesisAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить аккаунт.");
      setBusy(false);
    }
  };

  const disconnectServices = async () => {
    if (!window.confirm(translateText("Отключить Google Calendar и Google Tasks? GENESIS отзовёт разрешения Google. Ваши события, списки и задачи останутся в Google.", undefined, true))) return;
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

        <section className="account-preferences language-preference" aria-labelledby="language-title">
          <div>
            <span className="eyebrow">Язык</span>
            <h3 id="language-title">Интерфейс и справочные тексты</h3>
            <p>Выбор сохраняется в аккаунте и применяется на всех ваших устройствах.</p>
          </div>
          <div className="language-choice" role="radiogroup" aria-label="Язык интерфейса">
            <button type="button" role="radio" aria-checked={user.language !== "en"} className={user.language !== "en" ? "active" : ""} disabled={preferenceBusy} onClick={() => void changeLanguage("ru")}>
              <span className="language-flag" aria-hidden="true">🇷🇺</span><strong>Русский</strong>
            </button>
            <button type="button" role="radio" aria-checked={user.language === "en"} className={user.language === "en" ? "active" : ""} disabled={preferenceBusy} onClick={() => void changeLanguage("en")}>
              <span className="language-flag" aria-hidden="true">🇺🇸</span><strong>English</strong>
            </button>
          </div>
        </section>

        <section className="account-preferences calendar-mode-preference" aria-labelledby="calendar-mode-title">
          <div>
            <span className="eyebrow">Основной календарь</span>
            <h3 id="calendar-mode-title">Полное отображение и система дат</h3>
            <p>Выбор полностью переключает разделы «Месяц» и «Круг года». Сакральный календарь используется по умолчанию; систему постановки задач можно выбрать отдельно для любого режима.</p>
          </div>
          <div className="calendar-mode-segment" role="radiogroup" aria-label="Система дат">
            {CALENDAR_MODES.map((mode) => (
              <button
                type="button"
                role="radio"
                aria-checked={(user.calendarMode ?? "sacred") === mode.id}
                className={(user.calendarMode ?? "sacred") === mode.id ? "active" : ""}
                disabled={preferenceBusy}
                onClick={() => void changeCalendarMode(mode.id)}
                key={mode.id}
              >
                <strong>{mode.label}</strong>
                <small>{mode.hint}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="account-preferences task-calendar-mode-preference" aria-labelledby="task-calendar-mode-title">
          <div>
            <span className="eyebrow">Календарь задач</span>
            <h3 id="task-calendar-mode-title">По какой системе выставлять даты</h3>
            <p>Основной календарь не изменится; выбор дат, повторений и календарные подписи новых задач будут работать по выбранной системе.</p>
          </div>
          <div className="calendar-mode-segment" role="radiogroup" aria-label="Календарь постановки задач">
            {CALENDAR_MODES.map((mode) => (
              <button
                type="button"
                role="radio"
                aria-checked={(user.taskCalendarMode ?? "sacred") === mode.id}
                className={(user.taskCalendarMode ?? "sacred") === mode.id ? "active" : ""}
                disabled={preferenceBusy}
                onClick={() => void changeTaskCalendarMode(mode.id)}
                key={mode.id}
              >
                <strong>{mode.label}</strong>
                <small>{mode.hint}</small>
              </button>
            ))}
          </div>
        </section>

        {user.multiAccountEnabled ? (
          <section className="account-preferences multi-account-preference" aria-labelledby="multi-account-title">
            <div className="multi-account-heading">
              <div>
                <span className="eyebrow">Закрытая функция администратора</span>
                <h3 id="multi-account-title">Несколько Google-аккаунтов</h3>
                <p>Основной аккаунт владеет пространством GENESIS. Вход через любой подключённый дополнительный аккаунт открывает это же пространство.</p>
              </div>
              <button type="button" className="primary-button" onClick={onConnectAdditionalGoogle}>＋ Подключить аккаунт</button>
            </div>
            <div className="google-account-list">
              {(user.googleAccounts ?? []).map((account, index) => (
                <article key={account.id}>
                  {account.photoURL ? <img src={account.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="account-avatar-fallback" aria-hidden="true">{account.email.slice(0, 1).toUpperCase()}</span>}
                  <div><strong>{account.displayName || account.email}</strong><small>{account.email}</small></div>
                  <em>{account.isPrimary ? "Основной" : `Дополнительный ${index}`}</em>
                  {!account.isPrimary ? <button type="button" className="text-button" disabled={busy} onClick={() => void removeAdditionalAccount(account.id)}>Отключить</button> : null}
                </article>
              ))}
            </div>

            {(user.googleAccounts ?? []).length > 1 ? (
              <div className="sync-routing-editor">
                <fieldset className="sync-routing-modes">
                  <legend>Как выбирать аккаунты для новых задач</legend>
                  <label><input type="radio" checked={routing.mode === "fixed"} onChange={() => setRouting((current) => ({ ...current, mode: "fixed" }))} /> Заранее выбранные</label>
                  <label><input type="radio" checked={routing.mode === "choose"} onChange={() => setRouting((current) => ({ ...current, mode: "choose" }))} /> По выбору при создании</label>
                  <label><input type="radio" checked={routing.mode === "category"} onChange={() => setRouting((current) => ({ ...current, mode: "category" }))} /> По категории проекта</label>
                </fieldset>

                <fieldset className="sync-account-checks">
                  <legend>{routing.mode === "fixed" ? "Синхронизировать новые задачи" : "Аккаунты по умолчанию"}</legend>
                  {(user.googleAccounts ?? []).map((account) => (
                    <label key={account.id}>
                      <input
                        type="checkbox"
                        checked={routing.defaultAccountIds.includes(account.id)}
                        onChange={(event) => setRouting((current) => ({
                          ...current,
                          defaultAccountIds: event.target.checked
                            ? Array.from(new Set([...current.defaultAccountIds, account.id]))
                            : current.defaultAccountIds.filter((id) => id !== account.id),
                        }))}
                      />
                      <span>{account.email}{account.isPrimary ? " · основной" : ""}</span>
                    </label>
                  ))}
                </fieldset>

                {routing.mode === "category" ? (
                  <div className="category-routing-grid">
                    <strong>Категории и аккаунты</strong>
                    {categories.map((category) => (
                      <fieldset key={category.id}>
                        <legend><i style={{ backgroundColor: category.color }} /><span data-no-translate>{category.name}</span></legend>
                        {(user.googleAccounts ?? []).map((account) => {
                          const selected = routing.categoryAccountIds[category.id] ?? [];
                          return (
                            <label key={account.id}><input type="checkbox" checked={selected.includes(account.id)} onChange={(event) => setRouting((current) => ({
                              ...current,
                              categoryAccountIds: {
                                ...current.categoryAccountIds,
                                [category.id]: event.target.checked
                                  ? Array.from(new Set([...(current.categoryAccountIds[category.id] ?? []), account.id]))
                                  : (current.categoryAccountIds[category.id] ?? []).filter((id) => id !== account.id),
                              },
                            }))} />{account.email}</label>
                          );
                        })}
                      </fieldset>
                    ))}
                  </div>
                ) : null}
                <button type="button" className="primary-button" disabled={preferenceBusy || routing.defaultAccountIds.length === 0} onClick={() => void saveRouting()}>Сохранить маршрутизацию</button>
              </div>
            ) : null}
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
