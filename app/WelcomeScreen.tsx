"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element -- Google requires the official, unmodified sign-in asset. */

type WelcomeScreenProps = {
  busy: boolean;
  error: string;
  onGoogle: () => void;
};

const APP_BASE = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");

export function WelcomeScreen({ busy, error, onGoogle }: WelcomeScreenProps) {
  return (
    <main className="welcome-shell">
      <div className="welcome-orbit orbit-one" aria-hidden="true" />
      <div className="welcome-orbit orbit-two" aria-hidden="true" />
      <header className="welcome-nav">
        <a className="welcome-brand" href="/" aria-label="GENESIS — главная">
          <span className="solar-mark"><i /></span>
          <span><strong>GENESIS</strong><small>календарь ясного действия</small></span>
        </a>
        <nav aria-label="Правовая информация">
          <a href="/privacy">Конфиденциальность</a>
          <a href="/terms">Соглашение</a>
          <a href="/support">Поддержка</a>
        </nav>
      </header>

      <section className="welcome-grid">
        <div className="welcome-copy">
          <span className="welcome-kicker">GENESIS · КАЛЕНДАРЬ И МЕНЕДЖЕР ПРОЕКТОВ</span>
          <h1><span>GENESIS</span><em>Календарь задач<br />и проектов</em></h1>
          <p className="welcome-purpose">
            GENESIS — приложение для планирования личных и рабочих задач, проектов,
            подпроектов, повторений и напоминаний. Календарь помогает составлять план дня,
            связывать действия и отмечать выполненное на компьютере или телефоне.
          </p>
          <section className="google-data-purpose" aria-labelledby="google-purpose-title">
            <h2 id="google-purpose-title">Как GENESIS использует Google Calendar и Google Tasks</h2>
            <p>
              Сначала Google передаёт только подтверждённый адрес, имя и изображение профиля для безопасного входа.
              Уже после входа вы сами решаете, подключать ли синхронизацию: GENESIS создаёт отдельный календарь GENESIS,
              а доступ к Google Tasks использует для показа и двустороннего изменения ваших списков и задач.
              Разрешения не применяются для рекламы, профилирования или обучения моделей.
            </p>
          </section>
          <div className="welcome-proof" aria-label="Особенности защиты данных">
            <article>
              <span className="proof-icon proof-device" aria-hidden="true"><i /><b /></span>
              <strong>Ваши задачи — только в Google и на вашем устройстве</strong>
            </article>
            <article>
              <span className="proof-icon proof-cipher" aria-hidden="true"><i /><b /></span>
              <strong>Структура проектов передаётся зашифрованной</strong>
            </article>
            <article>
              <span className="proof-icon proof-private" aria-hidden="true"><i /><b /></span>
              <strong>Личное пространство открывается только после входа</strong>
            </article>
          </div>
        </div>

        <aside className="welcome-auth" aria-labelledby="welcome-auth-title">
          <span className="auth-sun" aria-hidden="true"><i /></span>
          <p className="welcome-kicker">ЛИЧНОЕ ПРОСТРАНСТВО</p>
          <h2 id="welcome-auth-title">Войти в GENESIS</h2>
          <p>Для входа вы будете перенаправлены на официальную страницу Google. На этапе входа GENESIS получает только основные данные профиля. Доступ к Calendar и Tasks запрашивается отдельно, в понятном контексте и только по вашему действию.</p>

          <button className="google-login-primary" type="button" onClick={onGoogle} disabled={busy} aria-label="Войти через Google">
            <img src={`${APP_BASE}/google-signin-light-pill.svg`} alt="" aria-hidden="true" />
          </button>

          <div className="auth-trust-note" role="note">
            <strong>Безопасный вход через Google</strong>
            <span>GENESIS никогда не запрашивает пароль от Google. Авторизация выполняется только на защищённой странице accounts.google.com.</span>
          </div>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <p className="auth-legal">
            Продолжая, вы принимаете <a href="/terms">пользовательское соглашение</a> и подтверждаете ознакомление с <a href="/privacy">политикой конфиденциальности</a>.
          </p>
        </aside>
      </section>

      <footer className="welcome-footer">
        <span>© {new Date().getFullYear()} GENESIS</span>
        <a href="/delete-account">Удаление аккаунта</a>
      </footer>
    </main>
  );
}
