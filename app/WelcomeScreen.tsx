"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element -- Google requires the official, unmodified sign-in asset. */

import type { Language } from "./i18n";

type WelcomeScreenProps = {
  androidApkUrl: string | null;
  busy: boolean;
  error: string;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onGoogle: () => void;
};

const APP_BASE = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");

export function WelcomeScreen({ androidApkUrl, busy, error, language, onLanguageChange, onGoogle }: WelcomeScreenProps) {
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
    chooseLanguage: "Choose language",
    languageGroup: "Registration and interface language",
    russian: "Russian",
    googleLabel: "Sign in with Google",
    secureSignIn: "Secure Google sign-in",
    passwordNote: "GENESIS never asks for your Google password. Authentication takes place only on the secure accounts.google.com page.",
    downloadApp: "Download the phone app",
    downloadAppNote: "Android · APK · test version 1.2.2",
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
    chooseLanguage: "Выберите язык",
    languageGroup: "Язык регистрации и интерфейса",
    russian: "Русский",
    googleLabel: "Войти через Google",
    secureSignIn: "Безопасный вход через Google",
    passwordNote: "GENESIS никогда не запрашивает пароль от Google. Авторизация выполняется только на защищённой странице accounts.google.com.",
    downloadApp: "Скачать приложение для телефона",
    downloadAppNote: "Android · APK · тестовая версия 1.2.2",
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
          <h1><span>GENESIS</span><em>{copy.title}</em></h1>
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
            <div className="language-choice" role="radiogroup" aria-label={copy.languageGroup}>
              <button type="button" role="radio" aria-checked={language === "ru"} className={language === "ru" ? "active" : ""} onClick={() => onLanguageChange("ru")}>
                <span className="language-flag" aria-hidden="true">🇷🇺</span><strong>{copy.russian}</strong>
              </button>
              <button type="button" role="radio" aria-checked={language === "en"} className={language === "en" ? "active" : ""} onClick={() => onLanguageChange("en")}>
                <span className="language-flag" aria-hidden="true">🇺🇸</span><strong>English</strong>
              </button>
            </div>
          </div>

          <button className="google-login-primary" type="button" onClick={onGoogle} disabled={busy} aria-label={copy.googleLabel}>
            <img src={`${APP_BASE}/google-signin-light-pill.svg`} alt="" aria-hidden="true" />
          </button>

          {androidApkUrl ? (
            <a className="android-download-button" href={androidApkUrl} download>
              <span className="android-download-mark" aria-hidden="true"><i /></span>
              <span><strong>{copy.downloadApp}</strong><small>{copy.downloadAppNote}</small></span>
            </a>
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
