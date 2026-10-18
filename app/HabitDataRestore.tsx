import { useId, useRef, useState } from "react";
import { previewHabitRestore, type HabitRestoreChoice, type HabitRestorePreview, type HabitRestoreRequest } from "./habit-backup-restore";
import { habitDisplayText } from "./habit-display-text";
import { translateText, type Language } from "./i18n";
import type { HabitWorkspace } from "./habits";
import type { TimeFormat } from "./time-format";

export function HabitDataRestore({ workspace, language, scope, timeFormat = "24h", timeZone, onRestore }: { workspace: HabitWorkspace; language: Language; scope: string;
  timeFormat?: TimeFormat; timeZone?: string;
  onRestore: (request: HabitRestoreRequest, scope: string) => Promise<void> }) {
  const id = useId(), lock = useRef(false), generation = useRef(0), t = (source: string) => translateText(source, language);
  const [lastFile, setLastFile] = useState<File | undefined>(undefined);
  const [preview, setPreview] = useState<HabitRestorePreview | null>(null), [choices, setChoices] = useState<Record<string, HabitRestoreChoice>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const read = async (file?: File) => {
    const token = ++generation.current;
    setPreview(null); setChoices({}); setError(""); setMessage("");
    if (!file) return;
    setLastFile(file);
    setBusy(true);
    try {
      if (file.size > 64 * 1024 * 1024) throw Error("HABIT_BACKUP_TOO_LARGE");
      const result = await previewHabitRestore(workspace, await file.text());
      if (generation.current === token) setPreview(result);
    } catch { if (generation.current === token) setError("Копия недействительна, повреждена или имеет неподдерживаемую версию."); }
    finally { if (generation.current === token) setBusy(false); }
  };
  const apply = async () => {
    if (!preview || lock.current || busy) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await onRestore({ preview, choices }, scope);
      setPreview(null); setChoices({}); setMessage("Восстановление завершено.");
    } catch (error) {
      setError(error instanceof Error && error.message === "HABIT_RESTORE_STALE"
        ? "Данные изменились. Проверьте копию заново." : "Не удалось восстановить. Проверьте синхронизацию и повторите.");
    } finally { lock.current = false; setBusy(false); }
  };
  const unresolved = preview?.habits.some(row => row.kind === "conflict" && !choices[row.id]);
  const selected = preview?.habits.some(row => row.kind === "new" || row.kind === "conflict" && choices[row.id] === "copy");
  return <section className="habit-data-restore" aria-labelledby={`${id}-title`} aria-busy={busy}>
    <h3 id={`${id}-title`}>{t("Восстановить из JSON")}</h3>
    <p>{t("Сначала проверьте копию. До применения данные не меняются.")}</p>
    <label className="habit-backup-file" htmlFor={`${id}-file`}>{t("Выберите резервную копию JSON")}
      <input id={`${id}-file`} type="file" accept="application/json,.json" disabled={busy}
        onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void read(file); }} /></label>
    {preview ? <div className="habit-restore-preview">
      <p>{t("Копия проверена")} · <time dateTime={preview.backup.createdAt}>{new Date(preview.backup.createdAt).toLocaleString(language, { timeZone, hour12: timeFormat === "12h" })}</time></p>
      <p>{t(preview.empty ? "В пустом пространстве восстановится сохранённый журнал наград без повторного начисления."
        : "В заполненном пространстве сохранятся текущие XP, Лавры, квесты и достижения. История из копии не начисляет награды.")}</p>
      <p>{t("Активные привычки восстановятся на паузе. Подключения Google не переносятся.")}</p>
      <ul className="habit-restore-rows">{preview.habits.map(row => <li key={row.id}>
        <strong data-no-translate>{habitDisplayText(preview.backup.data.habits.find(habit => habit.id === row.id)!, language).title}</strong>
        <span>{t(({ new: "Новая привычка", same: "Без изменений", conflict: "Конфликт", restored: "Уже восстановлено" } as const)[row.kind])}</span>
        <span>{t("Записи")}: {new Intl.NumberFormat(language).format(row.records)}</span>
        {row.kind === "conflict" ? <><div className="habit-restore-comparison">
          <p>{t("Текущая привычка")}: <span data-no-translate>{habitDisplayText(workspace.habits.find(habit => habit.id === row.id)!, language).title}</span> · {t("Записи")}: {new Intl.NumberFormat(language).format(row.currentRecords)}</p>
          <p>{(row.changes.length ? row.changes : ["Настройки"]).map(change => t(change)).join(" · ")}</p></div><label>{t("Выберите действие")}<select disabled={busy} value={choices[row.id] ?? ""}
          onChange={event => setChoices(current => ({ ...current, [row.id]: event.target.value as HabitRestoreChoice }))}>
          <option value="" disabled>{t("Выберите действие")}</option><option value="keep">{t("Оставить текущую")}</option>
          <option value="copy">{t("Восстановить отдельной копией")}</option></select></label></> : null}
      </li>)}</ul>
      <div className="habit-data-actions"><button type="button" disabled={busy || unresolved || !selected} onClick={() => void apply()}>{t(busy ? "Сохранение…" : "Применить восстановление")}</button>
        <button type="button" disabled={busy} onClick={() => { generation.current++; setPreview(null); setChoices({}); }}>{t("Отмена")}</button></div>
    </div> : null}
    {busy ? <p role="status">{t("Загружаем данные…")}</p> : null}
    {error ? <><p role="alert">{t(error)}</p>{lastFile ? <div className="habit-data-actions"><button type="button" disabled={busy} onClick={() => void read(lastFile)}>{t("Обновить")}</button></div> : null}</> : null}{message ? <p role="status">{t(message)}</p> : null}
  </section>;
}
