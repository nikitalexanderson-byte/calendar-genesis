"use client";
import { Component, type ReactNode, type ErrorInfo } from "react";

export function DeferredViewFallback({ label }: { label: string }) {
  return <section className="deferred-view-loading" role="status" aria-live="polite"><span aria-hidden="true"><i /></span><strong>{label}</strong></section>;
}

export function DeferredDialogFallback({ label }: { label: string }) {
  return <div className="modal-backdrop deferred-dialog-backdrop" role="status" aria-live="polite"><div><span aria-hidden="true"><i /></span><strong>{label}</strong></div></div>;
}

export function DeferredHabitFallback({ label }: { label: string }) {
  return <section className="deferred-habit-loading" role="status" aria-live="polite"><span aria-hidden="true"><i /></span><strong>{label}</strong></section>;
}

export class ViewErrorBoundary extends Component<{
  children: ReactNode;
  resetKey: string;
}, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GENESIS view rendering failed", error, info);
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (this.state.hasError && previous.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="view-error-state" role="alert">
        <span aria-hidden="true">◇</span>
        <div>
          <strong>Раздел не удалось отобразить</strong>
          <p>Остальные разделы продолжают работать. Обновите данные страницы и повторите открытие.</p>
        </div>
        <button type="button" onClick={() => window.location.reload()}>Обновить страницу</button>
      </section>
    );
  }
}
