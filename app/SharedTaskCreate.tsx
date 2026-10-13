"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { SharedTaskAttachmentsInput, taskFileError, type TaskFileDraft } from "./SharedTaskAttachments";
import "./shared-updates.css";
import { type CalendarMode, calendarDateValue } from "./calendar-data";
import { sharedProjectTree } from "./shared-expansion";
import { formatTaskCount } from "./task-count-i18n";
import { SharedTaskApprovalChoice } from "./SharedTaskApprovalChoice";
import { EntryTypeChoice, type EntryType } from "./EntryTypeChoice";
import { SharedTaskSchedule, emptySharedPlan } from "./SharedTaskSchedule";
import type { TimeFormat } from "./time-format";
import {
  createSharedTask, listSharedProjects, listSharedSpaces, loadSharedProject,
  type SharedProject, type SharedProjectSnapshot, type SharedSpace, type SharedTask,
} from "./cloud-sync";

type Props = { language: string; enabledCalendars: CalendarMode[];
  initialSpaceId?: string; initialProjectId?: string; initialStatusId?: string;
  initialEntryType?: EntryType; onEntryTypeChange?: (value:EntryType)=>void;
  timeFormat?:TimeFormat;
  initialTitle?: string; fixedSpaceId?: string; mindmapSource?: {mapId:string;nodeId:string};
  onSaved?: (task: SharedTask) => Promise<void>; onCreated?: (pending: boolean) => void };

export function SharedTaskCreate({ language, enabledCalendars,
  initialSpaceId, initialProjectId, initialStatusId, initialEntryType="task", onEntryTypeChange, timeFormat="24h", initialTitle="", fixedSpaceId, mindmapSource, onSaved, onCreated }: Props) {
  const english = language === "en";
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [spaceId, setSpaceId] = useState("");
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [snapshot, setSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<TaskFileDraft[]>([]);
  const [imageReading, setImageReading] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [statusId, setStatusId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [entryType,setEntryType] = useState<EntryType>(initialEntryType);
  const [plan,setPlan] = useState(emptySharedPlan);
  useEffect(()=>{const timer=window.setTimeout(()=>setEntryType(initialEntryType),0);return()=>window.clearTimeout(timer);},[initialEntryType]);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("profane");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    void listSharedSpaces().then((items) => {
      if (!live) return;
      setSpaces(fixedSpaceId ? items.filter(space => space.id === fixedSpaceId) : items);
      setSpaceId((current) => items.some((item) => item.id === current) ? current
        : items.find((item) => item.id === initialSpaceId)?.id ?? items[0]?.id ?? "");
    }).catch((error: unknown) => { if (live) setMessage(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (live) setLoadingSpaces(false); });
    const stored = window.localStorage.getItem("genesis-shared-calendar-mode");
    const timer = (stored === "profane" || stored === "sacred" || stored === "lunar") && enabledCalendars.includes(stored)
      ? window.setTimeout(() => setCalendarMode(stored), 0) : 0;
    return () => { live = false; if (timer) window.clearTimeout(timer); };
  }, [enabledCalendars, initialSpaceId, fixedSpaceId]);
  useEffect(() => {
    if (!enabledCalendars.includes(calendarMode)) {
      const timer = window.setTimeout(() => setCalendarMode(enabledCalendars[0] ?? "profane"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [calendarMode, enabledCalendars]);
  useEffect(() => {
    if (!spaceId) return;
    let live = true;
    const timer = window.setTimeout(() => { if (live) setLoadingProjects(true); }, 0);
    void listSharedProjects(spaceId).then((items) => {
      if (!live) return;
      const writable = items.filter((item) => ["owner", "manager", "member"].includes(item.role));
      setProjects(writable);
      setProjectId((current) => writable.some((item) => item.id === current) ? current
        : writable.find((item) => item.id === initialProjectId)?.id
          ?? writable.find((item) => item.isInbox)?.id ?? writable[0]?.id ?? "");
    }).catch((error: unknown) => { if (live) setMessage(error instanceof Error ? error.message : String(error)); })
      .finally(() => { window.clearTimeout(timer); if (live) setLoadingProjects(false); });
    return () => { live = false; window.clearTimeout(timer); };
  }, [spaceId, initialProjectId]);
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void loadSharedProject(projectId).then((result) => {
      if (!live) return;
      setSnapshot(result);
      setStatusId(result.statuses.find((item) => item.id === initialStatusId)?.id ?? result.statuses[0]?.id ?? "");
      setCategoryId(""); setAssigneeId("");
      setApproverIds([]); setApprovalRequired(false);
    }).catch((error: unknown) => { if (live) setMessage(error instanceof Error ? error.message : String(error)); });
    return () => { live = false; };
  }, [projectId, initialStatusId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snapshot || snapshot.project.id !== projectId || !title.trim() || !statusId || busy || imageReading || approvalRequired && !approverIds.length) return;
    setBusy(true); setMessage("");
    try {
      const created = await createSharedTask(snapshot.project.id, {
        ...(mindmapSource ? {mindmapSource} : {}),
        title: title.trim(), description: description.trim(), tags: [...new Set(tags.split(/[,;\s]+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean))], dueDate: dueDate || null,
        approvalRequired, approverIds,
        entryType,
        startDate:plan.startDate||null,startTime:plan.startTime||null,endTime:plan.endTime||null,dependsOnIds:plan.dependsOnIds,
        statusId: approvalRequired ? snapshot.statuses.find(status => !status.isDone)?.id ?? statusId : statusId, categoryId: categoryId || null, assigneeId: assigneeId || null,
        ...(files.length ? { attachments: files.map(({ name, data }) => ({ name, data })) } : {}),
      });
      setTitle(""); setDescription(""); setTags(""); setDueDate(""); setFiles([]);
      await onSaved?.(created);
      onCreated?.(Boolean(created.pending));
      setMessage(created.pending
        ? (english ? "Task saved on this device and waiting for the connection."
          : "Задача сохранена на устройстве и ожидает подключения к сети.")
        : (english ? "Team task created." : "Общая задача создана."));
    } catch (error) {
      setMessage(taskFileError(error, english));
    } finally { setBusy(false); }
  };

  return <form className="task-form shared-task-create" onSubmit={(event) => void submit(event)}
    aria-label={english ? "Create shared task" : "Создание общей задачи"}>
    {loadingSpaces ? <p role="status">{english ? "Loading workspaces…" : "Загружаем пространства…"}</p>
      : !spaces.length ? <p role="status">{english
      ? "There is no shared workspace whose inbox can receive a task. Create one in Shared projects first."
      : "Нет доступного общего пространства, в хаос-бокс которого можно отправить задачу. Сначала создайте пространство в общих проектах."}</p> : <>
      <EntryTypeChoice value={entryType} types={["task","meeting","event"]} english={english} disabled={busy} onChange={value=>{setEntryType(value);onEntryTypeChange?.(value);}} />
      <label>{english ? "Name" : "Название"}<input value={title} maxLength={160} required
        onChange={(event) => setTitle(event.target.value)} /></label>
      <SharedTaskAttachmentsInput value={files} onChange={setFiles} onReadingChange={setImageReading} english={english} disabled={busy} />
      <label>{english ? "Workspace" : "Пространство"}<select value={spaceId} onChange={(event) => {
        setSpaceId(event.target.value); setProjects([]); setProjectId(""); setSnapshot(null);
      }}>{spaces.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {loadingProjects ? <p role="status">{english ? "Loading projects…" : "Загружаем проекты…"}</p>
        : projects.length ? <label>{english ? "Project or shared inbox" : "Проект или общий хаос-бокс"}
        <select value={projectId} onChange={(event) => { setProjectId(event.target.value); setSnapshot(null); }}>
          {projects.filter(item => item.isInbox).map(item => <option key={item.id} value={item.id}>
            {english ? "Shared inbox" : "Хаос-бокс пространства"} · {formatTaskCount(item.taskCount ?? 0, language as import("./i18n").Language)}</option>)}
          {sharedProjectTree(projects).map(({ project, depth }) => <option key={project.id} value={project.id}>
            {depth ? `${"\u00a0\u00a0".repeat(depth)}↳ ` : ""}{project.title} · {formatTaskCount(project.taskCount ?? 0, language as import("./i18n").Language)}</option>)}</select></label>
        : <p role="status">{english ? "No project in this workspace allows you to add tasks." : "В этом пространстве нет проекта, в который вы можете добавить задачу."}</p>}
      <div className="shared-projects-date-field"><span>{english ? "Due date" : "Срок"}</span>
        {dueDate ? <><CalendarDatePicker mode={calendarMode} value={dueDate} onChange={setDueDate}
          ariaLabel={english ? "Team task due date" : "Срок общей задачи"} />
          <button type="button" onClick={() => setDueDate("")}>{english ? "Clear" : "Убрать срок"}</button></>
          : <button type="button" onClick={() => setDueDate(calendarDateValue(new Date()))}>
            {english ? "Set due date" : "Установить срок"}</button>}</div>
      {entryType !== "task" ? <SharedTaskSchedule plan={plan} onChange={setPlan} dueDate={dueDate} onDueDate={setDueDate} mode={calendarMode} timeFormat={timeFormat} english={english} tasks={snapshot?.tasks ?? []}/> : null}
      <details className="task-advanced-fields"><summary>{english ? "Details and settings" : "Подробности и настройки"}</summary>
      <label>{english ? "Tags" : "Теги"}<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="работа, запуск" /></label>
      <label>{english ? "Description" : "Описание"}<textarea value={description} maxLength={20000}
        onChange={(event) => setDescription(event.target.value)} /></label>
      {snapshot ? <>
        <label>{english ? "Task list" : "Список задач"}<select value={statusId} onChange={(event) => setStatusId(event.target.value)}>
          {snapshot.statuses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>{english ? "Category" : "Категория"}<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">{english ? "No category" : "Без категории"}</option>
          {snapshot.categories.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>{english ? "Assigned to" : "Исполнитель"}<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
          <option value="">{english ? "Unassigned" : "Не назначен"}</option>
          {snapshot.members.map((item) => <option key={item.userId} value={item.userId}>{item.displayName}</option>)}</select></label>
      </> : null}
      <p>{english ? "The task is saved on GENESIS for members of this project. Each person enables their own Google copy separately."
        : "Задача сохраняется на сервере GENESIS для участников проекта. Каждый сам включает свою копию в Google."}</p>
      </details>
      <SharedTaskApprovalChoice enabled={approvalRequired} ids={approverIds} members={snapshot?.members ?? []} english={english} disabled={busy || !snapshot} onEnabled={setApprovalRequired} onIds={setApproverIds} />
      <button type="submit" className="add-task-button" disabled={busy || imageReading || !snapshot || !statusId || !title.trim() || approvalRequired && !approverIds.length}>
        {english ? "Create team task" : "Создать общую задачу"}</button>
    </>}
    {message ? <p role="status">{message}</p> : null}
  </form>;
}
