import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { habitLifecycleState, type HabitLifecycleAction, type HabitLifecycleCommand, type HabitLifecycleStatus } from "./habit-lifecycle";
import { habitCompletionCount } from "./habit-laurel-retention";
import { habitEconomyHistory } from "./habit-history";
import { translateText, type Language } from "./i18n";
import { useDialogAccessibility } from "./use-dialog-accessibility";
import { ExperimentalIcon } from "./ExperimentalIcon";
import type { Habit, HabitWorkspace } from "./habits";
import "./habit-lifecycle.css";

const labels: Record<HabitLifecycleStatus, string> = { active: "Активные", paused: "Пауза", archived: "Архив", deleted: "Удалённые" };
type Props = { workspace: HabitWorkspace; language: Language; requestedDelete?: string; onAdd: () => void; onEdit: (habit: Habit) => void;
  onKey: (habit: Habit) => void; details: (habit: Habit) => ReactNode;
  onCommand?: (command: HabitLifecycleCommand) => Promise<void> };

export function HabitLifecycleLibrary({ workspace, language, requestedDelete, onAdd, onEdit, onKey, details, onCommand }: Props) {
  const t = (text: string) => translateText(text, language), id = useId();
  const requested = workspace.habits.find(habit => habit.id === requestedDelete);
  const [filter, setFilter] = useState<HabitLifecycleStatus>(() => requested ? habitLifecycleState(requested).status : "active");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [pending, setPending] = useState<HabitLifecycleCommand | null>(() => requested && habitLifecycleState(requested).status !== "deleted" ? {
    id: `habit-lifecycle:${crypto.randomUUID()}`, habitId: requested.id, action: "delete", at: new Date().toISOString(),
    heads: habitLifecycleState(requested).heads.map(row => row.id),
  } : null);
  const close = () => { if (!busy) setPending(null); };
  const dialogRef = useDialogAccessibility<HTMLElement>(close, Boolean(pending));
  const economy = habitEconomyHistory(workspace);
  const pendingHabit = workspace.habits.find(habit => habit.id === pending?.habitId);
  const retained = pendingHabit && habitCompletionCount(economy.habitCompletions, pendingHabit.id) >= 50;
  const counts = Object.fromEntries(Object.keys(labels).map(status => [status,
    workspace.habits.filter(habit => habitLifecycleState(habit).status === status).length]));
  const rows = workspace.habits.filter(habit => habitLifecycleState(habit).status === filter)
    .sort((a, b) => Number(b.isKeyHabit) - Number(a.isKeyHabit) || b.priority - a.priority || a.title.localeCompare(b.title));
  const save = async (command: HabitLifecycleCommand) => {
    if (!onCommand || busy) return;
    setBusy(true); setMessage("");
    try { await onCommand(command); setPending(null); setMessage(t("Состояние сохранено.")); }
    catch { setMessage(t("Не удалось сохранить. Проверьте синхронизацию и повторите.")); }
    finally { setBusy(false); }
  };
  const act = (habit: Habit, action: HabitLifecycleAction, selectedId?: string) => {
    const command: HabitLifecycleCommand = { id: `habit-lifecycle:${crypto.randomUUID()}`, habitId: habit.id,
      at: new Date().toISOString(), action, heads: habitLifecycleState(habit).heads.map(row => row.id), ...(selectedId ? { selectedId } : {}) };
    if (action === "delete") { setMessage(""); setPending(command); } else void save(command);
  };
  return <section className="habit-library habit-lifecycle-library" aria-labelledby={`${id}-title`}>
    <header><h2 id={`${id}-title`}>{t("Ядро привычек")}</h2><button type="button" className="primary-button" onClick={onAdd}><ExperimentalIcon name="plus" />{t("Добавить")}</button></header>
    <p className="habit-library-rule">{t("Пауза выключает расписание и напоминания. Архив сохраняет историю и награды.")}</p>
    <div className="habit-lifecycle-filters" role="group" aria-label={t("Состояние привычки")}>
      {(Object.keys(labels) as HabitLifecycleStatus[]).map(status => <button type="button" key={status}
        aria-pressed={filter === status} onClick={() => setFilter(status)}>{t(labels[status])} <span>{counts[status]}</span></button>)}
    </div>
    <p className="habit-lifecycle-message" role="status">{message}</p>
    {rows.length ? <div className="habit-lifecycle-rows">{rows.map(habit => {
      const state = habitLifecycleState(habit);
      return <article key={habit.id} className={`${!habit.active ? "paused" : ""}${habit.isKeyHabit ? " key-habit" : ""}`}
        data-habit-id={habit.id} style={{ "--habit-color": habit.color } as CSSProperties}>
        <i /><div><span><b className="habit-emoji" aria-hidden="true">{habit.emoji}</b><strong data-no-translate>{habit.title}</strong>
          {habit.isKeyHabit ? <mark>{t("Главная")}</mark> : null}<em>{t("Приоритет")} {habit.priority}</em></span>
          <small>{details(habit)} · {t("Выполнено дней")} {habitCompletionCount(economy.habitCompletions, habit.id)}/50</small></div>
        <div className="habit-library-actions" aria-busy={busy}>
          {state.conflict ? <div className="habit-lifecycle-conflict"><p>{t("Есть изменения с другого устройства. Выберите состояние.")}</p>
            {state.heads.map(head => <button type="button" key={head.id} disabled={busy || !onCommand}
              onClick={() => act(habit, "resolve", head.id)}>{t(labels[head.status])} · <time>{new Date(head.at).toLocaleString(language)}</time></button>)}</div> : <>
            {filter === "active" || filter === "paused" ? <>
              <button type="button" disabled={busy} onClick={() => onKey(habit)}>{t(habit.isKeyHabit ? "Убрать фокус" : "Сделать главной")}</button>
              <button type="button" disabled={busy} onClick={() => onEdit(habit)}>{t("Изменить")}</button>
              <button type="button" disabled={busy || !onCommand} onClick={() => act(habit, habit.active ? "pause" : "resume")}>{t(habit.active ? "Пауза" : "Включить")}</button>
              <button type="button" disabled={busy || !onCommand} onClick={() => act(habit, "archive")}>{t("В архив")}</button>
            </> : <button type="button" disabled={busy || !onCommand} onClick={() => act(habit, "restore")}>{t("Восстановить")}</button>}
            {filter !== "deleted" ? <button type="button" className="danger" disabled={busy || !onCommand} onClick={() => act(habit, "delete")}>{t("Удалить")}</button> : null}
          </>}
        </div>
      </article>;
    })}</div> : <div className="habit-library-empty"><p>{t("Ничего не найдено")}</p></div>}
    {filter === "archived" || filter === "deleted" ? <p>{t("Восстановление вернёт привычку на паузу. Награды и прежний штраф не изменятся.")}</p> : null}
    {pending && pendingHabit ? <div className="modal-backdrop habit-editor-backdrop">
      <section ref={dialogRef} className="habit-editor habit-lifecycle-confirm" data-exp-ui="dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-delete`} tabIndex={-1}>
        <h2 id={`${id}-delete`}>{t("Удалить привычку")}</h2><strong data-no-translate>{pendingHabit.title}</strong>
        <p>{t(retained ? "Рубеж 50 дней достигнут: Лавры сохранятся. История останется доступной для восстановления."
          : "Удаление до 50 уникальных дней выполнения обнуляет весь баланс Лавров. История останется доступной для восстановления.")}</p>
        {message ? <p role="alert">{message}</p> : null}
        <footer><button type="button" disabled={busy} onClick={close}>{t("Отмена")}</button>
          <button type="button" className="danger" disabled={busy || !onCommand} onClick={() => void save(pending)}>{t(busy ? "Сохранение…" : "Удалить")}</button></footer>
      </section>
    </div> : null}
  </section>;
}
