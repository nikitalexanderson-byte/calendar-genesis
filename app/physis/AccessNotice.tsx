import { useState } from 'react';
import { signInWithGoogle } from '../cloud-sync';
import type { PhysisAccessStatus } from './access-check';
import './access.css';

export function PhysisAccessNotice({ status, retry, language }: { status: PhysisAccessStatus; retry: () => void; language: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const en = language === 'en';
  return <section className="physis-access-notice" aria-labelledby="physis-access-title">
    <h1 id="physis-access-title">{en ? 'Physis' : 'Фюзис'}</h1>
    <p role="status">{status === 'reauth'
      ? en ? 'Confirm your Google sign-in to open Physis. Your current session was created before this section became available.' : 'Подтвердите вход через Google, чтобы открыть Фюзис. Ваша текущая сессия создана до подключения раздела.'
      : status === 'checking' ? en ? 'Checking access…' : 'Проверяем доступ…'
      : status === 'error' ? en ? 'Could not check access. Check your connection and try again.' : 'Не удалось проверить доступ. Проверьте соединение и повторите попытку.'
      : en ? 'Physis is unavailable for this session.' : 'Фюзис недоступен для этой сессии.'}</p>
    <div className="physis-access-actions">{status === 'reauth' ? <button type="button" disabled={busy} onClick={() => {
      setBusy(true); setError('');
      void signInWithGoogle().catch(() => { setBusy(false); setError(en ? 'Could not start Google sign-in. Please try again.' : 'Не удалось открыть вход Google. Повторите попытку.'); });
    }}>{busy ? en ? 'Opening Google…' : 'Открываем Google…' : en ? 'Confirm Google sign-in' : 'Подтвердить вход Google'}</button> : null}
    {status !== 'checking' ? <button type="button" className="secondary-button" onClick={retry}>{en ? 'Check again' : 'Проверить снова'}</button> : null}</div>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
