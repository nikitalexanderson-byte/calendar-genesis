"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element -- Google requires the official, unmodified sign-in asset. */

import { LANGUAGES, LANGUAGE_LABELS, type Language } from "./i18n";

type WelcomeScreenProps = {
  nativeAndroidApkUrl: string | null;
  busy: boolean;
  error: string;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onGoogle: () => void;
};

const APP_BASE = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");
const FLAG_COUNTRIES: Record<Language, string> = {
  ru: "ru", en: "gb", el: "gr", de: "de", fr: "fr", es: "es", it: "it", pt: "pt",
  pl: "pl", sr: "rs", uk: "ua", zh: "cn", tr: "tr", ja: "jp",
};
const WELCOME_TITLES: Partial<Record<Language, string>> = {
  el: "Ημερολόγιο εργασιών και έργων", de: "Aufgaben- und Projektkalender",
  fr: "Calendrier des tâches et des projets", es: "Calendario de tareas y proyectos",
  it: "Calendario di attività e progetti", pt: "Calendário de tarefas e projetos",
  pl: "Kalendarz zadań i projektów", sr: "Календар задатака и пројеката",
  uk: "Календар завдань і проєктів", zh: "任务与项目日历",
  tr: "Görev ve Proje Takvimi", ja: "タスクとプロジェクトのカレンダー",
};

export function WelcomeScreen({ nativeAndroidApkUrl, busy, error, language, onLanguageChange, onGoogle }: WelcomeScreenProps) {
  const copy = language === "en" ? {
    home: "GENESIS — home",
    tagline: "calendar of clear action",
    legalNav: "Legal information",
    privacy: "Privacy",
    terms: "Terms",
    support: "Support",
    kicker: "GENESIS · CALENDAR AND PROJECT MANAGER",
    title: <>Task and project<br />calendar</>,
    purpose: <>GENESIS is an app for planning personal and work tasks, projects, subprojects, recurrences, and reminders. The calendar helps you build a daily plan, connect actions, and mark work complete on a computer or phone.</>,
    googlePurposeTitle: "How GENESIS uses Google Calendar and Google Tasks",
    googlePurpose: <>Google first provides only your verified email address, name, and profile image for secure sign-in. After signing in, you decide whether to connect synchronization: GENESIS creates a separate GENESIS calendar and uses Google Tasks access to display and synchronize changes to your lists and tasks. Permissions are not used for advertising, profiling, or model training.</>,
    dataProtection: "Data protection features",
    tasksPrivate: "Your tasks stay only in Google and on your device",
    encrypted: "Project structure is transmitted encrypted",
    signedInOnly: "Your private workspace opens only after sign-in",
    privateSpace: "PRIVATE WORKSPACE",
    signInTitle: "Sign in to GENESIS",
    signInDescription: "You will be redirected to the official Google page. During sign-in, GENESIS receives only basic profile information. Calendar and Tasks access is requested separately, in context, and only when you choose to connect it.",
    chooseLanguage: "Choose a language",
    languageGroup: "Registration and interface language",
    russian: "Russian",
    googleLabel: "Sign in with Google",
    secureSignIn: "Secure Google sign-in",
    passwordNote: "GENESIS never asks for your Google password. Authentication takes place only on the secure accounts.google.com page.",
    downloadNative: "Native Android app",
    downloadNativeNote: "GENESIS 2.4.4 · native APK",
    androidMigration: "Replacing the old TWA? Its signing key is different: uninstall the TWA before installing this app. Unsynced local TWA data will be lost; your website and Google data will return after sign-in.",
    androidInstallCaution: "On some devices Play Protect may block a direct APK download until the developer is verified. Do not disable Play Protect. The previous TWA cannot be updated in place with this differently signed app.",
    agreement: <>By continuing, you accept the <a href="/terms">Terms of Service</a> and acknowledge the <a href="/privacy">Privacy Policy</a>.</>,
    deleteAccount: "Delete account",
  } : {
    home: "GENESIS — главная",
    tagline: "календарь ясного действия",
    legalNav: "Правовая информация",
    privacy: "Конфиденциальность",
    terms: "Соглашение",
    support: "Поддержка",
    kicker: "GENESIS · КАЛЕНДАРЬ И МЕНЕДЖЕР ПРОЕКТОВ",
    title: <>Календарь задач<br />и проектов</>,
    purpose: <>GENESIS — приложение для планирования личных и рабочих задач, проектов, подпроектов, повторений и напоминаний. Календарь помогает составлять план дня, связывать действия и отмечать выполненное на компьютере или телефоне.</>,
    googlePurposeTitle: "Как GENESIS использует Google Calendar и Google Tasks",
    googlePurpose: <>Сначала Google передаёт только подтверждённый адрес, имя и изображение профиля для безопасного входа. Уже после входа вы сами решаете, подключать ли синхронизацию: GENESIS создаёт отдельный календарь GENESIS, а доступ к Google Tasks использует для показа и двустороннего изменения ваших списков и задач. Разрешения не применяются для рекламы, профилирования или обучения моделей.</>,
    dataProtection: "Особенности защиты данных",
    tasksPrivate: "Ваши задачи — только в Google и на вашем устройстве",
    encrypted: "Структура проектов передаётся зашифрованной",
    signedInOnly: "Личное пространство открывается только после входа",
    privateSpace: "ЛИЧНОЕ ПРОСТРАНСТВО",
    signInTitle: "Войти в GENESIS",
    signInDescription: "Для входа вы будете перенаправлены на официальную страницу Google. На этапе входа GENESIS получает только основные данные профиля. Доступ к Calendar и Tasks запрашивается отдельно, в понятном контексте и только по вашему действию.",
    chooseLanguage: "Выбор языка",
    languageGroup: "Язык регистрации и интерфейса",
    russian: "Русский",
    googleLabel: "Войти через Google",
    secureSignIn: "Безопасный вход через Google",
    passwordNote: "GENESIS никогда не запрашивает пароль от Google. Авторизация выполняется только на защищённой странице accounts.google.com.",
    downloadNative: "Нативное Android-приложение",
    downloadNativeNote: "GENESIS 2.4.4 · нативный APK",
    androidMigration: "Заменяете старую TWA? У неё другая подпись: перед установкой удалите TWA. Несинхронизированные локальные данные TWA будут потеряны; данные сайта и Google вернутся после входа.",
    androidInstallCaution: "На некоторых устройствах Play Защита может блокировать APK, загруженный напрямую, до проверки разработчика. Не отключайте Play Защиту. Прежняя TWA не обновится этим приложением из-за другой подписи.",
    agreement: <>Продолжая, вы принимаете <a href="/terms">пользовательское соглашение</a> и подтверждаете ознакомление с <a href="/privacy">политикой конфиденциальности</a>.</>,
    deleteAccount: "Удаление аккаунта",
  };

  return (
    <main className="welcome-shell">
      <div className="welcome-orbit orbit-one" aria-hidden="true" />
      <div className="welcome-orbit orbit-two" aria-hidden="true" />
      <header className="welcome-nav">
        <a className="welcome-brand" href="/" aria-label={copy.home}>
          <span className="solar-mark"><i /></span>
          <span><strong>GENESIS</strong><small>{copy.tagline}</small></span>
        </a>
        <nav aria-label={copy.legalNav}>
          <a href="/privacy">{copy.privacy}</a>
          <a href="/terms">{copy.terms}</a>
          <a href="/support">{copy.support}</a>
        </nav>
      </header>

      <section className="welcome-grid">
        <div className="welcome-copy">
          <span className="welcome-kicker">{copy.kicker}</span>
          <h1><span>GENESIS</span><em data-no-translate>{WELCOME_TITLES[language] ?? copy.title}</em></h1>
          <p className="welcome-purpose">{copy.purpose}</p>
          <section className="google-data-purpose" aria-labelledby="google-purpose-title">
            <h2 id="google-purpose-title">{copy.googlePurposeTitle}</h2>
            <p>{copy.googlePurpose}</p>
          </section>
          <div className="welcome-proof" aria-label={copy.dataProtection}>
            <article>
              <span className="proof-icon proof-device" aria-hidden="true"><i /><b /></span>
              <strong>{copy.tasksPrivate}</strong>
            </article>
            <article>
              <span className="proof-icon proof-cipher" aria-hidden="true"><i /><b /></span>
              <strong>{copy.encrypted}</strong>
            </article>
            <article>
              <span className="proof-icon proof-private" aria-hidden="true"><i /><b /></span>
              <strong>{copy.signedInOnly}</strong>
            </article>
          </div>
        </div>

        <aside className="welcome-auth" aria-labelledby="welcome-auth-title">
          <span className="auth-sun" aria-hidden="true"><i /></span>
          <p className="welcome-kicker">{copy.privateSpace}</p>
          <h2 id="welcome-auth-title">{copy.signInTitle}</h2>
          <p>{copy.signInDescription}</p>

          <div className="welcome-language-picker">
            <span>{copy.chooseLanguage}</span>
            <div className="language-choice welcome-language-flags" role="radiogroup" aria-label={copy.languageGroup}>
              {LANGUAGES.map((code) => (
                <button key={code} type="button" role="radio" aria-checked={language === code}
                  className={language === code ? "active" : ""} onClick={() => onLanguageChange(code)}
                  aria-label={LANGUAGE_LABELS[code].name} title={LANGUAGE_LABELS[code].name} data-no-translate>
                  <span className="language-flag" aria-hidden="true">
                    <img src={`${APP_BASE}/language-flags/${FLAG_COUNTRIES[code]}.svg`} alt="" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button className="google-login-primary" type="button" onClick={onGoogle} disabled={busy} aria-label={copy.googleLabel}>
            <img src={`${APP_BASE}/google-signin-light-pill.svg`} alt="" aria-hidden="true" data-genesis-preserve="google-signin-pill" />
          </button>

          {nativeAndroidApkUrl ? (
            <>
              <a className="android-download-button android-native-download-button" href={nativeAndroidApkUrl} download="GENESIS-Android-Native-2.4.4.apk">
                <span className="android-download-mark" aria-hidden="true"><svg className="ux-android-robot" viewBox="0 0 24 24" fill="none"><path d="M5.5 9h13v8.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V9ZM5.5 9a6.5 6.5 0 0 1 13 0M4 11v5M20 11v5M9 19.5V22M15 19.5V22M7 3 5.5 1M17 3 18.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9.3" cy="7" r=".8" fill="currentColor"/><circle cx="14.7" cy="7" r=".8" fill="currentColor"/></svg></span>
                <span><strong>{copy.downloadNative}</strong><small>{copy.downloadNativeNote}</small></span>
              </a>
              <p className="android-migration-note">{copy.androidMigration}</p>
              <p className="android-migration-note">{copy.androidInstallCaution}</p>
            </>
          ) : null}

          <div className="auth-trust-note" role="note">
            <strong>{copy.secureSignIn}</strong>
            <span>{copy.passwordNote}</span>
          </div>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <p className="auth-legal">{copy.agreement}</p>
        </aside>
      </section>

      <footer className="welcome-footer">
        <span>© {new Date().getFullYear()} GENESIS</span>
        <a href="/delete-account">{copy.deleteAccount}</a>
      </footer>
    </main>
  );
}
