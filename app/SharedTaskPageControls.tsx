"use client";
import { runtimeLocale, translateText as t } from "./i18n";
import type { SharedTaskPage } from "./cloud-sync";

export function SharedTaskPageControls({page, loaded, busy, onMore, onRefresh, error}: {
  page?: Omit<SharedTaskPage,"tasks"> | null; loaded: number; busy: boolean; onMore: () => void; onRefresh: () => void; error?: string;
}) {
  if (!page && !error) return <p role="status">{t("Загрузка…")}</p>;
  return <div className="shared-detail-actions shared-task-page-controls" aria-live="polite">
    {page ? <span>{t("Показано: {loaded} из {total}").replace("{loaded}",loaded.toLocaleString(runtimeLocale())).replace("{total}",page.total.toLocaleString(runtimeLocale()))}</span> : null}
    {page?.hasMore ? <button type="button" disabled={busy} onClick={onMore}>{t("Показать ещё")}</button> : null}
    {error ? <><p role="alert">{error}</p><button type="button" disabled={busy} onClick={onRefresh}>{t("Обновить")}</button></> : null}
  </div>;
}
