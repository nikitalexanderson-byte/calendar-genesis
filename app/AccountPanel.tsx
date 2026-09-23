"use client";
/* eslint-disable @next/next/no-img-element -- Google profile pictures are remote OAuth assets. */

import { useEffect, useRef, useState } from "react";
import type { CalendarMode } from "./calendar-data";
import type { GenesisCategory, GenesisUser, SyncRouting } from "./cloud-sync";
import { deleteGenesisAccount, disconnectGoogleServices, removeAdditionalGoogleAccount, updateAccountPreferences } from "./cloud-sync";
import { localizeCategoryName, runtimeLocale, translateText, type Language } from "./i18n";
import type { TimeFormat } from "./time-format";
import type { HabitNotificationPermission, HabitNotificationSettings } from "./habit-notifications";
import type { HabitFeedbackSettings } from "./habit-feedback";
import { useDialogAccessibility } from "./use-dialog-accessibility";

type AccountPanelProps = {
  user: GenesisUser;
  onClose: () => void;
  onReconnectGoogle: () => void;
  onConnectAdditionalGoogle: () => void;
  onLanguageChange: (language: Language) => void;
  onUserChange: (user: GenesisUser) => void;
  habitTrackingEnabled: boolean;
  onHabitTrackingChange: (enabled: boolean) => void;
  habitNotificationSettings: HabitNotificationSettings;
  notificationPermission: HabitNotificationPermission;
  onHabitNotificationSettingsChange: (settings: HabitNotificationSettings) => void;
  habitFeedbackSettings: HabitFeedbackSettings;
  onHabitFeedbackSettingsChange: (settings: HabitFeedbackSettings) => void;
  onRequestHabitNotifications: () => Promise<HabitNotificationPermission>;
  hiddenHabitTemplateCount: number;
  onRestoreHabitTemplates: () => void;
  onResetHabitTracking: () => Promise<void>;
  categories: GenesisCategory[];
};

const CALENDAR_MODES: Array<{ id: CalendarMode; label: string; hint: string }> = [
  { id: "sacred", label: "Сакральный", hint: "Месяцы, пяты и дни GENESIS" },
  { id: "lunar", label: "Лунный", hint: "Лунные месяцы и дни" },
  { id: "profane", label: "Григорианский", hint: "Обычные даты, недели и 12 месяцев" },
];

const TIME_FORMATS: Array<{ id: TimeFormat; label: string; example: string }> = [
  { id: "24h", label: "24 часа", example: "13:30" },
  { id: "12h", label: "AM / PM", example: "01:30 PM" },
];

type HabitResetChallenge = {
  left: number;
  right: number;
  operator: "+" | "−" | "×";
  answer: number;
};

function createHabitResetChallenge(): HabitResetChallenge {
  const entropy = new Uint32Array(3);
  window.crypto.getRandomValues(entropy);
  const operator = (["+", "−", "×"] as const)[entropy[0] % 3];
  const first = 2 + (entropy[1] % 11);
  const second = 2 + (entropy[2] % 11);
  if (operator === "−") {
    const left = Math.max(first, second);
    const right = Math.min(first, second);
    return { left, right, operator, answer: left - right };
  }
  return {
    left: first,
    right: second,
    operator,
    answer: operator === "+" ? first + second : first * second,
  };
}

export function AccountPanel({ user, onClose, onReconnectGoogle, onConnectAdditionalGoogle, onLanguageChange, onUserChange, habitTrackingEnabled, onHabitTrackingChange, habitNotificationSettings, notificationPermission, onHabitNotificationSettingsChange, habitFeedbackSettings, onHabitFeedbackSettingsChange, onRequestHabitNotifications, hiddenHabitTemplateCount, onRestoreHabitTemplates, onResetHabitTracking, categories }: AccountPanelProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [habitResetChallenge, setHabitResetChallenge] = useState<HabitResetChallenge | null>(null);
  const [habitResetAnswer, setHabitResetAnswer] = useState("");
  const [habitResetBusy, setHabitResetBusy] = useState(false);
  const [habitResetError, setHabitResetError] = useState("");
  const habitResetInputRef = useRef<HTMLInputElement>(null);
  const [routing, setRouting] = useState<SyncRouting>(() => user.syncRouting ?? {
    mode: "fixed",
    defaultAccountIds: [user.uid],
    categoryAccountIds: {},
  });

  useEffect(() => {
    if (!habitResetChallenge) return;
    const frame = window.requestAnimationFrame(() => habitResetInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [habitResetChallenge]);

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
      const calendarLabel = CALENDAR_MODES.find((item) => item.id === calendarMode)?.label ?? "";
      setMessage(user.language === "en"
        ? `Primary calendar changed to ${translateText(calendarLabel, "en").toLocaleLowerCase(runtimeLocale())}.`
        : `Основной календарь переключён: ${calendarLabel.toLocaleLowerCase(runtimeLocale())}.`);
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
      const calendarLabel = CALENDAR_MODES.find((item) => item.id === taskCalendarMode)?.label ?? "";
      setMessage(user.language === "en"
        ? `Task scheduling calendar changed to ${translateText(calendarLabel, "en").toLocaleLowerCase(runtimeLocale())}.`
        : `Календарь постановки задач переключён: ${calendarLabel.toLocaleLowerCase(runtimeLocale())}.`);
    } catch (error) {
      setMessage(error instanceof Error
        ? translateText(error.message, user.language, true)
        : user.language === "en" ? "Could not change the task scheduling calendar." : "Не удалось переключить календарь постановки задач.");
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

  const changeTimeFormat = async (timeFormat: TimeFormat) => {
    if ((user.timeFormat ?? "24h") === timeFormat) return;
    setPreferenceBusy(true);
    setMessage("");
    try {
      const result = await updateAccountPreferences({ timeFormat });
      onUserChange(result.user);
      setMessage(timeFormat === "12h" ? "Включён формат времени AM / PM." : "Включён 24-часовой формат времени.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось переключить формат времени.");
    } finally {
      setPreferenceBusy(false);
    }
  };

  const toggleHabitNotifications = async (enabled: boolean) => {
    if (!enabled) {
      onHabitNotificationSettingsChange({ ...habitNotificationSettings, enabled: false });
      setMessage(user.language === "en" ? "Habit notifications are disabled on this device." : "Уведомления привычек отключены на этом устройстве.");
      return;
    }
    setNotificationBusy(true);
    setMessage("");
    try {
      const permission = await onRequestHabitNotifications();
      if (permission === "granted") {
        onHabitNotificationSettingsChange({ ...habitNotificationSettings, enabled: true });
        setMessage(user.language === "en" ? "Smart habit notifications are enabled." : "Умные уведомления привычек включены.");
      } else if (permission === "unsupported") {
        setMessage(user.language === "en" ? "This browser does not support device notifications." : "Этот браузер не поддерживает уведомления устройства.");
      } else {
        setMessage(user.language === "en" ? "Notification permission was not granted. You can allow it in the browser settings." : "Разрешение на уведомления не выдано. Его можно включить в настройках браузера.");
      }
    } finally {
      setNotificationBusy(false);
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
    if (!window.confirm(translateText("Безвозвратно удалить аккаунт GENESIS и все относящиеся к нему данные с сервера? Будут удалены профиль, зашифрованное пространство, привычки, статистика, расклады и привязки аккаунтов. Разрешения Google будут отозваны. Уже созданные события и списки задач останутся в вашем Google-аккаунте.", undefined, true))) return;
    setBusy(true);
    try {
      await deleteGenesisAccount(user.uid);
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

  const openHabitReset = () => {
    setHabitResetChallenge(createHabitResetChallenge());
    setHabitResetAnswer("");
    setHabitResetError("");
  };

  const closeHabitReset = () => {
    if (habitResetBusy) return;
    setHabitResetChallenge(null);
    setHabitResetAnswer("");
    setHabitResetError("");
  };

  const confirmHabitReset = async () => {
    if (!habitResetChallenge || habitResetAnswer.trim() === "" || Number(habitResetAnswer) !== habitResetChallenge.answer) return;
    setHabitResetBusy(true);
    setHabitResetError("");
    try {
      await onResetHabitTracking();
      setHabitResetChallenge(null);
      setHabitResetAnswer("");
      setMessage(user.language === "en"
        ? "All habit tracking data and statistics have been reset."
        : "Все привычки и их статистика обнулены.");
    } catch (error) {
      setHabitResetError(error instanceof Error
        ? error.message
        : user.language === "en" ? "Habit data could not be reset." : "Не удалось обнулить данные привычек.");
    } finally {
      setHabitResetBusy(false);
    }
  };

  const accountDialogRef = useDialogAccessibility<HTMLElement>(onClose);
  const habitResetDialogRef = useDialogAccessibility<HTMLFormElement>(closeHabitReset, Boolean(habitResetChallenge));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={accountDialogRef} className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title" tabIndex={-1}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <span className="eyebrow">Личный кабинет</span>
        <h2 id="account-title">{user.displayName || "Аккаунт GENESIS"}</h2>
        <p className="account-email">{user.email}</p>

        <div className="account-security-grid">
          <article><span>Google-сервисы</span><strong>{user.calendarConnected && user.googleTasksImportReady ? "Подключены" : "По желанию"}</strong><small>Calendar и Tasks подключаются отдельным согласием после входа.</small></article>
          <article><span>Личные данные</span><strong>Зашифрованы</strong><small>AES-GCM в браузере; ключ хранится на сервере отдельно и зашифрован для автоматического входа.</small></article>
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

        <section className="account-preferences time-format-preference" aria-labelledby="time-format-title">
          <div>
            <span className="eyebrow">Формат времени</span>
            <h3 id="time-format-title">Отображение часов</h3>
            <p>Настройка применяется к часам раздела «Сегодня», выбору времени задач и точным напоминаниям.</p>
          </div>
          <div className="language-choice time-format-choice" role="radiogroup" aria-label="Формат времени">
            {TIME_FORMATS.map((format) => (
              <button
                type="button"
                role="radio"
                aria-checked={(user.timeFormat ?? "24h") === format.id}
                className={(user.timeFormat ?? "24h") === format.id ? "active" : ""}
                disabled={preferenceBusy}
                onClick={() => void changeTimeFormat(format.id)}
                key={format.id}
              >
                <strong>{format.label}</strong>
                <small>{format.example}</small>
              </button>
            ))}
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

        <section className="account-preferences multi-account-preference" aria-labelledby="multi-account-title">
            <div className="multi-account-heading">
              <div>
                <span className="eyebrow">Доступно всем пользователям</span>
                <h3 id="multi-account-title">Несколько Google-аккаунтов</h3>
                <p>Объедините личный, рабочий и другие Google-аккаунты в одном пространстве GENESIS и сами решайте, в какие Calendar и Google Tasks отправлять новые задачи.</p>
              </div>
              <button type="button" className="primary-button" onClick={onConnectAdditionalGoogle}>＋ Подключить аккаунт</button>
            </div>
            <div className="multi-account-benefits">
              <strong>Что даёт подключение</strong>
              <ul>
                <li><b>Один кабинет.</b> Вход через любой связанный Google-аккаунт открывает те же проекты, категории и настройки GENESIS.</li>
                <li><b>Раздельные календари.</b> GENESIS синхронизирует задачу с выбранным аккаунтом или сразу с несколькими аккаунтами.</li>
                <li><b>Удобная маршрутизация.</b> Можно задать постоянные аккаунты, выбирать их при создании каждой задачи или распределять автоматически по категории проекта.</li>
                <li><b>Безопасное отключение.</b> При удалении связи уже созданные события, списки и задачи остаются в соответствующем Google-аккаунте.</li>
              </ul>
              <small>Подключение проходит через официальный OAuth Google с отдельным разрешением Calendar и Tasks. GENESIS не получает пароль дополнительного аккаунта.</small>
              <small>Если Google-аккаунт уже создал собственное отдельное пространство GENESIS, его нельзя присоединить автоматически: это защищает существующие проекты и задачи от случайного объединения.</small>
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
                  <label><input type="radio" aria-label="Заранее выбранные" checked={routing.mode === "fixed"} onChange={() => setRouting((current) => ({ ...current, mode: "fixed" }))} /><span><strong>Заранее выбранные</strong><small>Каждая новая задача отправляется в отмеченные ниже аккаунты.</small></span></label>
                  <label><input type="radio" aria-label="По выбору при создании" checked={routing.mode === "choose"} onChange={() => setRouting((current) => ({ ...current, mode: "choose" }))} /><span><strong>По выбору при создании</strong><small>В форме задачи появляется выбор одного или нескольких аккаунтов.</small></span></label>
                  <label><input type="radio" aria-label="По категории проекта" checked={routing.mode === "category"} onChange={() => setRouting((current) => ({ ...current, mode: "category" }))} /><span><strong>По категории проекта</strong><small>Аккаунты выбираются автоматически по правилам категорий; ниже задаются аккаунты по умолчанию.</small></span></label>
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
                        <legend><i style={{ backgroundColor: category.color }} /><span data-no-translate>{localizeCategoryName(category, user.language)}</span></legend>
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

        <section className="account-preferences" aria-labelledby="account-habits-title">
          <div>
            <span className="eyebrow">{user.language === "en" ? "Daily practice" : "Ежедневная практика"}</span>
            <h3 id="account-habits-title">{user.language === "en" ? "Habit tracking" : "Трекинг привычек"}</h3>
          </div>
          <label className="account-switch-row">
            <span>
              <strong>{user.language === "en" ? "Enable habit tracker" : "Включить трекер привычек"}</strong>
              <small>{user.language === "en" ? "Shows today's habits, the Habits page, mood and progress. Existing encrypted records remain saved when disabled." : "Показывает привычки дня, страницу «Привычки», настроение и прогресс. При отключении зашифрованные записи сохраняются."}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={habitTrackingEnabled}
              onChange={(event) => onHabitTrackingChange(event.target.checked)}
              aria-label={user.language === "en" ? "Enable habit tracking" : "Включить трекинг привычек"}
            />
            <i aria-hidden="true" />
          </label>
          <p className="account-preference-status" aria-live="polite">
            {habitTrackingEnabled ? (user.language === "en" ? "Habit tracking is enabled" : "Трекинг привычек включён") : (user.language === "en" ? "Habit tracking is hidden" : "Трекинг привычек скрыт")}
          </p>
          <div className="account-template-restore">
            <div>
              <strong>{user.language === "en" ? "Starter habit suggestions" : "Стартовые привычки"}</strong>
              <small>{hiddenHabitTemplateCount
                ? (user.language === "en" ? `${hiddenHabitTemplateCount} suggestion(s) hidden` : `Скрыто предложений: ${hiddenHabitTemplateCount}`)
                : (user.language === "en" ? "All standard suggestions are available" : "Все стандартные предложения доступны")}</small>
            </div>
            <button type="button" className="secondary-button" disabled={!hiddenHabitTemplateCount} onClick={onRestoreHabitTemplates}>{user.language === "en" ? "Restore standard habits" : "Восстановить стандартные привычки"}</button>
          </div>
          <div className="account-habit-reset">
            <div>
              <strong>{user.language === "en" ? "Reset habit tracking" : "Обнуление трекера"}</strong>
              <small>{user.language === "en"
                ? "Permanently deletes habits, sleep, mood, abstinence, statistics, XP and laurels. Account and calendar settings stay unchanged."
                : "Безвозвратно удалит привычки, сон, настроение, воздержание, статистику, XP и лавры. Настройки аккаунта и календаря сохранятся."}</small>
            </div>
            <button type="button" onClick={openHabitReset}>{user.language === "en" ? "Reset all habits" : "Обнулить все привычки"}</button>
          </div>
        </section>

        <section className="account-preferences habit-notification-preference" aria-labelledby="habit-notification-title">
          <div>
            <span className="eyebrow">{user.language === "en" ? "On-device motivation" : "Мотивация на устройстве"}</span>
            <h3 id="habit-notification-title">{user.language === "en" ? "Habit notifications" : "Уведомления привычек"}</h3>
            <p>{user.language === "en"
              ? "GENESIS combines nearby reminders, respects quiet hours and reduces motivational messages after repeated ignoring."
              : "GENESIS объединяет близкие напоминания, соблюдает тихие часы и снижает частоту мотивационных сообщений после повторных пропусков."}</p>
          </div>
          <label className="account-switch-row">
            <span>
              <strong>{user.language === "en" ? "Enable notifications on this device" : "Включить уведомления на этом устройстве"}</strong>
              <small>{user.language === "en" ? "Permission is requested only after this switch is enabled." : "Разрешение браузера запрашивается только после включения этого переключателя."}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={habitNotificationSettings.enabled && notificationPermission === "granted"}
              disabled={notificationBusy || notificationPermission === "unsupported"}
              onChange={(event) => void toggleHabitNotifications(event.target.checked)}
              aria-label={user.language === "en" ? "Enable habit notifications" : "Включить уведомления привычек"}
            />
            <i aria-hidden="true" />
          </label>
          <p className="account-preference-status" aria-live="polite">{notificationPermission === "unsupported"
            ? (user.language === "en" ? "Notifications are not supported" : "Уведомления не поддерживаются")
            : notificationPermission === "denied"
              ? (user.language === "en" ? "Permission is blocked in the browser" : "Разрешение заблокировано в браузере")
              : habitNotificationSettings.enabled && notificationPermission === "granted"
                ? (user.language === "en" ? "Notifications are enabled" : "Уведомления включены")
                : (user.language === "en" ? "Notifications are disabled" : "Уведомления отключены")}</p>
          <fieldset className="habit-notification-settings" disabled={!habitNotificationSettings.enabled || notificationPermission !== "granted"}>
            <legend>{user.language === "en" ? "Notification behavior" : "Поведение уведомлений"}</legend>
            <div className="habit-notification-tone" role="radiogroup" aria-label={user.language === "en" ? "Notification tone" : "Тон уведомлений"}>
              {([
                ["calm", user.language === "en" ? "Calm" : "Спокойный"],
                ["heroic", user.language === "en" ? "Heroic" : "Героический"],
                ["ironic", user.language === "en" ? "With irony" : "С иронией"],
              ] as const).map(([tone, label]) => <button type="button" role="radio" aria-checked={habitNotificationSettings.tone === tone} className={habitNotificationSettings.tone === tone ? "active" : ""} onClick={() => onHabitNotificationSettingsChange({ ...habitNotificationSettings, tone })} key={tone}>{label}</button>)}
            </div>
            <div className="habit-notification-times">
              <label><span>{user.language === "en" ? "Daily goal reminder" : "Напоминание о дневной цели"}</span><input type="time" value={habitNotificationSettings.dailyGoalTime} onChange={(event) => onHabitNotificationSettingsChange({ ...habitNotificationSettings, dailyGoalTime: event.target.value })} /></label>
              <label><span>{user.language === "en" ? "Quiet hours start" : "Начало тихих часов"}</span><input type="time" value={habitNotificationSettings.quietHoursStart} onChange={(event) => onHabitNotificationSettingsChange({ ...habitNotificationSettings, quietHoursStart: event.target.value })} /></label>
              <label><span>{user.language === "en" ? "Quiet hours end" : "Конец тихих часов"}</span><input type="time" value={habitNotificationSettings.quietHoursEnd} onChange={(event) => onHabitNotificationSettingsChange({ ...habitNotificationSettings, quietHoursEnd: event.target.value })} /></label>
            </div>
            <label className="account-switch-row compact">
              <span><strong>{user.language === "en" ? "Daily goal and streak reminders" : "Напоминания о цели и серии"}</strong><small>{user.language === "en" ? "Shown only while the goal is still achievable; they never shame or deduct progress." : "Показываются только пока цель достижима; не стыдят и не отнимают прогресс."}</small></span>
              <input type="checkbox" role="switch" aria-label={user.language === "en" ? "Daily goal and streak reminders" : "Напоминания о цели и серии"} checked={habitNotificationSettings.motivational} onChange={(event) => onHabitNotificationSettingsChange({ ...habitNotificationSettings, motivational: event.target.checked })} />
              <i aria-hidden="true" />
            </label>
          </fieldset>
          <small className="habit-notification-privacy">{user.language === "en"
            ? "Notification analytics contain no habit titles and remain only on this device. Notification settings are stored inside your encrypted workspace."
            : "Аналитика уведомлений не содержит названий привычек и остаётся только на этом устройстве. Настройки уведомлений хранятся внутри зашифрованного пространства."}</small>
        </section>

        <section className="account-preferences habit-feedback-preference" aria-labelledby="habit-feedback-title">
          <div>
            <span className="eyebrow">{user.language === "en" ? "Feedback and accessibility" : "Отклик и доступность"}</span>
            <h3 id="habit-feedback-title">{user.language === "en" ? "Completion feedback" : "Отклик на выполнение"}</h3>
            <p>{user.language === "en"
              ? "Choose how GENESIS confirms a completed habit. System reduced-motion preferences always take priority."
              : "Выберите, как GENESIS подтверждает выполнение привычки. Системное ограничение движения всегда имеет приоритет."}</p>
          </div>
          <fieldset className="habit-feedback-settings" disabled={!habitTrackingEnabled}>
            <legend className="sr-only">{user.language === "en" ? "Habit feedback settings" : "Настройки отклика привычек"}</legend>
            <label className="account-switch-row compact">
              <span><strong>{user.language === "en" ? "Short animations" : "Короткие анимации"}</strong><small>{user.language === "en" ? "Smooth checkbox, card and progress feedback; disabled automatically when reduced motion is requested." : "Плавный отклик галочки, карточки и прогресса; автоматически отключается при системном ограничении движения."}</small></span>
              <input type="checkbox" role="switch" checked={habitFeedbackSettings.animations} onChange={(event) => onHabitFeedbackSettingsChange({ ...habitFeedbackSettings, animations: event.target.checked })} aria-label={user.language === "en" ? "Short completion animations" : "Короткие анимации выполнения"} />
              <i aria-hidden="true" />
            </label>
            <label className="account-switch-row compact">
              <span><strong>{user.language === "en" ? "Completion sound" : "Звук выполнения"}</strong><small>{user.language === "en" ? "A brief local tone. Off by default and never downloaded from a server." : "Короткий локальный сигнал. По умолчанию выключен и не загружается с сервера."}</small></span>
              <input type="checkbox" role="switch" checked={habitFeedbackSettings.sound} onChange={(event) => onHabitFeedbackSettingsChange({ ...habitFeedbackSettings, sound: event.target.checked })} aria-label={user.language === "en" ? "Completion sound" : "Звук выполнения"} />
              <i aria-hidden="true" />
            </label>
            <label className="account-switch-row compact">
              <span><strong>{user.language === "en" ? "Haptic feedback" : "Тактильный отклик"}</strong><small>{user.language === "en" ? "A light vibration on supported mobile devices. Off by default." : "Лёгкая вибрация на поддерживаемых мобильных устройствах. По умолчанию выключена."}</small></span>
              <input type="checkbox" role="switch" checked={habitFeedbackSettings.haptics} onChange={(event) => onHabitFeedbackSettingsChange({ ...habitFeedbackSettings, haptics: event.target.checked })} aria-label={user.language === "en" ? "Haptic feedback" : "Тактильный отклик"} />
              <i aria-hidden="true" />
            </label>
            <label className="account-switch-row compact">
              <span><strong>{user.language === "en" ? "Achievement notices" : "Уведомления о достижениях"}</strong><small>{user.language === "en" ? "Include a newly unlocked achievement in the completion notice." : "Показывать новое достижение в уведомлении о выполнении."}</small></span>
              <input type="checkbox" role="switch" checked={habitFeedbackSettings.achievementPopups} onChange={(event) => onHabitFeedbackSettingsChange({ ...habitFeedbackSettings, achievementPopups: event.target.checked })} aria-label={user.language === "en" ? "Achievement notices" : "Уведомления о достижениях"} />
              <i aria-hidden="true" />
            </label>
            <label className="account-switch-row compact">
              <span><strong>{user.language === "en" ? "Trials" : "Испытания"}</strong><small>{user.language === "en" ? "Create and show daily, weekly and epic trials. Existing progress is preserved while disabled." : "Создавать и показывать ежедневные, недельные и эпические испытания. При отключении прежний прогресс сохраняется."}</small></span>
              <input type="checkbox" role="switch" checked={habitFeedbackSettings.questsEnabled} onChange={(event) => onHabitFeedbackSettingsChange({ ...habitFeedbackSettings, questsEnabled: event.target.checked })} aria-label={user.language === "en" ? "Habit trials" : "Испытания привычек"} />
              <i aria-hidden="true" />
            </label>
            <label className="account-switch-row compact">
              <span><strong>{user.language === "en" ? "Gamification widgets" : "Игровые блоки"}</strong><small>{user.language === "en" ? "Show ranks, Laurels, streak rewards and achievements. Habit tracking continues normally when hidden." : "Показывать ранги, Лавры, награды серии и достижения. Без них трекинг продолжает работать как обычно."}</small></span>
              <input type="checkbox" role="switch" checked={habitFeedbackSettings.gamificationWidgets} onChange={(event) => onHabitFeedbackSettingsChange({ ...habitFeedbackSettings, gamificationWidgets: event.target.checked })} aria-label={user.language === "en" ? "Gamification widgets" : "Игровые блоки"} />
              <i aria-hidden="true" />
            </label>
          </fieldset>
          {!habitTrackingEnabled ? <p className="account-preference-status" role="status">{user.language === "en" ? "Enable habit tracking to change these settings" : "Включите трекинг привычек, чтобы изменить эти настройки"}</p> : null}
        </section>

        <section className="account-preferences account-e2ee" aria-labelledby="account-e2ee-title">
          <div>
            <span className="eyebrow">Encrypted workspace</span>
            <h3 id="account-e2ee-title">{user.language === "en" ? "Encrypted personal data" : "Шифрование личных данных"}</h3>
          </div>
          <p>{user.language === "en" ? "Projects and tracker data are encrypted before storage. After Google sign-in, an authenticated GENESIS session unlocks them automatically on every device—no recovery code is required." : "Проекты и данные трекеров шифруются перед сохранением. После входа через Google защищённая сессия GENESIS автоматически открывает их на любом устройстве — код восстановления не нужен."}</p>
        </section>

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
          <div><strong>Удаление аккаунта</strong><small>Безвозвратно удалит только ваш профиль и все связанные с ним данные с сервера GENESIS, локальные копии на этом устройстве и отзовёт разрешения Google.</small></div>
          <button type="button" onClick={() => void removeAccount()} disabled={busy}>Удалить</button>
        </div>
      </section>
      {habitResetChallenge ? (
        <div className="habit-reset-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeHabitReset(); }}>
          <form
            ref={habitResetDialogRef}
            className="habit-reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="habit-reset-title"
            aria-describedby="habit-reset-description"
            tabIndex={-1}
            onSubmit={(event) => {
              event.preventDefault();
              void confirmHabitReset();
            }}
          >
            <span className="habit-reset-mark" aria-hidden="true">!</span>
            <div className="habit-reset-copy">
              <span className="eyebrow">{user.language === "en" ? "Irreversible action" : "Необратимое действие"}</span>
              <h3 id="habit-reset-title">{user.language === "en" ? "Reset all habit data?" : "Обнулить все привычки?"}</h3>
              <p id="habit-reset-description">{user.language === "en"
                ? "Every tracker, record, statistic, rank progress, XP and laurel will be deleted from this encrypted workspace. This cannot be undone."
                : "Все трекеры, записи, статистика, прогресс рангов, XP и лавры будут удалены из зашифрованного пространства. Отменить это действие невозможно."}</p>
            </div>
            <label className="habit-reset-captcha">
              <span>{user.language === "en" ? "Solve to confirm" : "Решите пример для подтверждения"}</span>
              <strong>{habitResetChallenge.left} {habitResetChallenge.operator} {habitResetChallenge.right} = ?</strong>
              <input
                ref={habitResetInputRef}
                type="number"
                inputMode="numeric"
                value={habitResetAnswer}
                disabled={habitResetBusy}
                onChange={(event) => {
                  setHabitResetAnswer(event.target.value);
                  setHabitResetError("");
                }}
                aria-label={user.language === "en" ? "Answer to the arithmetic challenge" : "Ответ на арифметический пример"}
                aria-invalid={habitResetAnswer.trim() !== "" && Number(habitResetAnswer) !== habitResetChallenge.answer}
              />
              <small>{habitResetAnswer.trim() === "" || Number(habitResetAnswer) !== habitResetChallenge.answer
                ? (user.language === "en" ? "The delete button unlocks after the correct answer." : "Кнопка удаления станет доступна после верного ответа.")
                : (user.language === "en" ? "Answer accepted. Check the action once more." : "Ответ верный. Ещё раз проверьте действие.")}</small>
            </label>
            {habitResetError ? <p className="habit-reset-error" role="alert">{habitResetError}</p> : null}
            <div className="habit-reset-actions">
              <button type="button" className="secondary-button" disabled={habitResetBusy} onClick={closeHabitReset}>{user.language === "en" ? "Cancel" : "Отменить"}</button>
              <button
                type="submit"
                className="habit-reset-confirm"
                disabled={habitResetBusy || habitResetAnswer.trim() === "" || Number(habitResetAnswer) !== habitResetChallenge.answer}
              >
                {habitResetBusy
                  ? (user.language === "en" ? "Resetting…" : "Обнуляем…")
                  : (user.language === "en" ? "Confirm reset" : "Подтвердить удаление")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
