"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  createSharedStatus, deleteSharedStatus, listSharedProjects, listSharedSpaces,
  listSharedTaskLists, loadSharedProject, updateSharedStatus,
  type SharedProject, type SharedProjectSnapshot, type SharedSpace, type SharedStatus, type SharedTaskList,
} from "./cloud-sync";
import { type CalendarMode } from "./calendar-data";
import { SharedTaskCreate } from "./SharedTaskCreate";
import "./shared-task-lists.css";

type Props = { language: string; enabledCalendars: CalendarMode[]; onOpenProject: () => void; embeddedCreate?: boolean; onCreated?: () => void };
type Modal = "create" | "edit" | "delete" | "task" | null;

export function SharedTaskLists({ language, enabledCalendars, onOpenProject, embeddedCreate = false, onCreated }: Props) {
  const en = language === "en";
  const [lists, setLists] = useState<SharedTaskList[]>([]);
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<SharedTaskList | null>(null);
  const [destinationId, setDestinationId] = useState("");
  const [deleteStatuses, setDeleteStatuses] = useState<SharedStatus[]>([]);
  const [snapshot, setSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [openedId, setOpenedId] = useState("");
  const [modal, setModal] = useState<Modal>(embeddedCreate ? "create" : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef("");

  const refresh = useCallback(async () => {
    const [nextLists, nextSpaces] = await Promise.all([listSharedTaskLists(), listSharedSpaces()]);
    setLists(nextLists); setSpaces(nextSpaces);
    setSpaceId((current) => nextSpaces.some((item) => item.id === current) ? current : nextSpaces[0]?.id ?? "");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh().catch((error) => setMessage(String(error))); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (!spaceId) return;
    let live = true;
    void listSharedProjects(spaceId).then((rows) => {
      if (!live) return;
      const writable = rows.filter((item) => !item.isInbox && ["owner", "manager", "member"].includes(item.role));
      setProjects(writable);
      setProjectId((current) => writable.some((item) => item.id === current) ? current : writable[0]?.id ?? "");
    }).catch((error) => { if (live) setMessage(String(error)); });
    return () => { live = false; };
  }, [spaceId]);
  useEffect(() => {
    if (!openedId) return;
    const row = lists.find((item) => item.id === openedId);
    if (!row) return;
    let live = true;
    void loadSharedProject(row.projectId).then((value) => { if (live) setSnapshot(value); })
      .catch((error) => { if (live) setMessage(String(error)); });
    return () => { live = false; };
  }, [openedId, lists]);
  useEffect(() => {
    if (!embeddedCreate && modal && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [modal, embeddedCreate]);

  const close = () => { dialog.current?.close(); setModal(null); setTarget(null); if (embeddedCreate) onCreated?.(); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      if (modal === "create") {
        if (!projectId || !title.trim()) return;
        if (!requestId.current) requestId.current = crypto.randomUUID();
        await createSharedStatus(projectId, title.trim(), false, requestId.current);
        requestId.current = "";
        setMessage(en ? "Team task list created." : "Общий список задач создан.");
      } else if (modal === "edit" && target) {
        await updateSharedStatus(target.projectId, target.id, title.trim(), target.revision);
        setMessage(en ? "Task list updated." : "Список задач изменён.");
      } else if (modal === "delete" && target && destinationId) {
        await deleteSharedStatus(target.projectId, target.id, destinationId, target.revision);
        setOpenedId("");
        setMessage(en ? "Task list removed. Its tasks moved to the selected list."
          : "Список удалён. Его задачи перенесены в выбранный список.");
      } else return;
      await refresh(); close(); setTitle("");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const openEdit = (row: SharedTaskList) => { setTarget(row); setTitle(row.title); setModal("edit"); };
  const openDelete = async (row: SharedTaskList) => {
    try {
      const project = await loadSharedProject(row.projectId);
      const destination = project.statuses.find((item) => item.id !== row.id);
      if (!destination) throw new Error(en ? "Create another task list before removing this one."
        : "Перед удалением создайте другой список задач.");
      setDeleteStatuses(project.statuses.filter((item) => item.id !== row.id));
      setDestinationId(destination.id); setTarget(row); setModal("delete");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const modalContent = <>
{modal === "task" && target ? <><header><h3>{en ? "Add team task" : "Добавить общую задачу"}</h3>
        <button type="button" className="shared-task-list-icon-close" onClick={close} aria-label={en ? "Close" : "Закрыть"}>×</button></header>
        <SharedTaskCreate language={language} enabledCalendars={enabledCalendars}
          initialSpaceId={target.spaceId} initialProjectId={target.projectId} initialStatusId={target.id}
          onCreated={(pending) => { close(); setMessage(pending
            ? en ? "Task saved on this device and waiting for the connection."
              : "Задача сохранена на устройстве и ожидает подключения к сети."
            : en ? "Team task created." : "Общая задача создана."); void refresh().catch((error) => setMessage(String(error))); }} /></>
        : <form onSubmit={(event) => void submit(event)}>
          <header><h3>{modal === "create" ? en ? "New team task list" : "Новый общий список задач"
            : modal === "edit" ? en ? "Rename task list" : "Переименовать список"
              : en ? "Remove task list" : "Удалить список задач"}</h3>
            <button type="button" className="shared-task-list-icon-close" onClick={close} aria-label={en ? "Close" : "Закрыть"}>×</button></header>
          {modal === "create" ? <><label>{en ? "Workspace" : "Пространство"}<select value={spaceId}
            onChange={(event) => { requestId.current = ""; setSpaceId(event.target.value); setProjects([]); setProjectId(""); }}>
            {spaces.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label>{en ? "Project" : "Проект"}<select value={projectId} onChange={(event) => { requestId.current = ""; setProjectId(event.target.value); }}>
              {projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            {!projects.length ? <p>{en ? "No writable project in this workspace." : "В этом пространстве нет доступного для записи проекта."}</p> : null}</> : null}
          {modal !== "delete" ? <label>{en ? "List name" : "Название списка"}<input value={title}
            onChange={(event) => { requestId.current = ""; setTitle(event.target.value); }} maxLength={80} required /></label> : <>
            <p>{en ? "Tasks in this list will move to another list in the same project."
              : "Задачи из этого списка перейдут в другой список того же проекта."}</p>
            <label>{en ? "Move tasks to" : "Перенести задачи в"}<select value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}>
              {deleteStatuses.map((item) =>
                  <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></>}
          <button type="submit" className="primary-button" disabled={busy || modal === "create" && !projectId ||
            modal !== "delete" && !title.trim() || modal === "delete" && !destinationId}>
            {busy ? en ? "Saving…" : "Сохраняем…" : modal === "delete"
              ? en ? "Remove list" : "Удалить список" : en ? "Save list" : "Сохранить список"}</button>
        </form>}
  </>;
  if (embeddedCreate) return <section className="shared-task-lists">{message ? <p role="status">{message}</p> : null}{modalContent}</section>;

  return <section className="shared-task-lists" aria-label={en ? "Team task lists" : "Общие списки задач"}>
    <header><div><h3>{en ? "Team task lists" : "Общие списки задач"}</h3>
      <p>{en ? "Saved in GENESIS and visible to project members. Each list is also a board column."
        : "Хранятся в GENESIS и доступны участникам проекта. Каждый список также является колонкой доски."}</p></div>
      <button type="button" className="primary-button" onClick={() => { setTitle(""); setModal("create"); }}>
        {en ? "Create team list" : "Создать общий список"}</button></header>
    {message ? <p role="status" className="shared-task-lists-message">{message}</p> : null}
    {!spaces.length ? <p>{en ? "Create a shared workspace first." : "Сначала создайте общее пространство."}</p> : null}
    <div className="shared-task-lists-grid">{lists.map((row) => <article key={row.id}>
      <button type="button" className="shared-task-lists-title" aria-expanded={openedId === row.id}
        onClick={() => { setSnapshot(null); setOpenedId((current) => current === row.id ? "" : row.id); }}>{row.title}</button>
      <small>{row.spaceTitle} / {row.projectTitle} · {row.taskCount} {en ? "tasks" : "задач"}</small>
      {openedId === row.id ? <div className="shared-task-lists-body">
        {(snapshot?.project.id === row.projectId ? snapshot.tasks.filter((task) => task.statusId === row.id) : [])
          .map((task) => <p key={task.id}>{task.title}{task.dueDate ? ` · ${task.dueDate}` : ""}</p>)}
        {snapshot?.project.id === row.projectId && !snapshot.tasks.some((task) => task.statusId === row.id)
          ? <p>{en ? "This list is empty." : "Список пока пуст."}</p> : null}
        <div className="shared-task-lists-actions">
          {["owner", "manager", "member"].includes(row.role) ? <button type="button" onClick={() => { setTarget(row); setModal("task"); }}>
            {en ? "Add task" : "Добавить задачу"}</button> : null}
          <button type="button" onClick={onOpenProject}>{en ? "Open project" : "Открыть проект"}</button>
          {["owner", "manager"].includes(row.role) ? <>
            <button type="button" onClick={() => openEdit(row)}>{en ? "Rename" : "Переименовать"}</button>
            <button type="button" onClick={() => void openDelete(row)}>{en ? "Remove" : "Удалить"}</button>
          </> : null}
        </div>
      </div> : null}
    </article>)}</div>
    <dialog ref={dialog} className="shared-task-lists-dialog" onClose={() => { setModal(null); setTarget(null); }}>
      {modalContent}
    </dialog>
  </section>;
}
