import { useId, useState } from "react";
import { buildHabitHistoryCsv, createHabitBackup } from "./habit-backup";
import { translateText, type Language } from "./i18n";
import { ExperimentalIcon } from "./ExperimentalIcon";
import type { HabitWorkspace } from "./habits";
import "./habit-data-export.css";

function downloadFile(body: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function HabitDataExport({ workspace, language }: { workspace: HabitWorkspace; language: Language }) {
  const t = (text: string) => translateText(text, language), id = useId();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const save = async (format: "csv" | "json") => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const now = new Date().toISOString();
      if (format === "csv") downloadFile(buildHabitHistoryCsv(workspace, { label: t }), `GENESIS-habits-history-${now.slice(0, 10)}.csv`, "text/csv;charset=utf-8");
      else downloadFile(`${JSON.stringify(await createHabitBackup(workspace, now), null, 2)}\n`, `GENESIS-habits-backup-${now.slice(0, 10)}.json`, "application/json;charset=utf-8");
    } catch { setError(t("Не удалось создать файл. Повторите попытку.")); }
    finally { setBusy(false); }
  };
  return <details className="habit-data-export">
    <summary><ExperimentalIcon name="file" /><span>{t("Данные привычек")}</span><svg className="disclosure-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" /></svg></summary>
    <div aria-labelledby={`${id}-description`} aria-busy={busy}>
      <p id={`${id}-description`}>{t("Включает всю историю, независимо от выбранного периода отчёта.")} {t("Подключения Google не переносятся.")}</p>
      <div className="habit-data-actions">
        <button type="button" disabled={busy} onClick={() => void save("csv")}><ExperimentalIcon name="file" />{t("Экспорт всей истории CSV")}</button>
        <button type="button" disabled={busy} onClick={() => void save("json")}><ExperimentalIcon name="archive" />{t("Резервная копия JSON")}</button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  </details>;
}
