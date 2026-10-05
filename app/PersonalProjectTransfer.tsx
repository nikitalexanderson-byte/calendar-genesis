"use client";

import { useEffect, useMemo, useState } from "react";
import {
  importSharedProject, listSharedSpaces, type GenesisCategory, type GenesisProject,
  type GenesisTask, type SharedProjectImport, type SharedSpace,
} from "./cloud-sync";
import { useDialogAccessibility } from "./use-dialog-accessibility";
import "./personal-task-transfer.css";

type Props = {
  root: GenesisProject;
  projects: GenesisProject[];
  tasks: GenesisTask[];
  categories: GenesisCategory[];
  linkedListCount: number;
  language: string;
  onClose: () => void;
  onMoved: (projectIds: string[], taskIds: string[]) => Promise<void>;
};

function moveRestriction(task: GenesisTask): boolean {
  return task.title !== task.title.trim().replace(/\s+/gu, " ")
    || task.description !== task.description.trim()
    || task.createdIn !== "genesis" || Boolean(task.googleEventId || task.googleTaskId
      || task.googleTaskListId || task.googleAccountId || task.googleReadOnly
      || task.syncAccountIds.length || Object.keys(task.googleLinks ?? {}).length)
    || Boolean(task.time || task.endDate && task.endDate !== task.dueDate
      || task.reminders.length || task.tags.length || task.dependsOnIds.length
      || task.priority !== 5 || task.calendarNote || task.calendarMode !== "profane"
      || task.recurrence !== "none" || task.recurrenceMode !== "none"
      || task.recurrencePattern !== "none" || task.recurrenceSeriesId
      || task.done && task.completedAt || task.yandexLocation || task.yandexTelemostUrl
      || task.yandexAttendees?.length || task.yandexOptionalAttendees?.length
      || task.yandexReminders?.length || task.yandexEntryType === "meeting");
}

function treeFor(root: GenesisProject, all: GenesisProject[]): GenesisProject[] {
  const result: GenesisProject[] = [];
  const visit = (project: GenesisProject) => {
    result.push(project);
    all.filter((item) => item.parentId === project.id).forEach(visit);
  };
  visit(root);
  return result;
}

export function PersonalProjectTransfer({ root, projects, tasks, categories, linkedListCount,
  language, onClose, onMoved }: Props) {
  const english = language === "en";
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useDialogAccessibility<HTMLElement>(onClose);
  const tree = useMemo(() => treeFor(root, projects), [root, projects]);
  const projectIds = useMemo(() => new Set(tree.map((project) => project.id)), [tree]);
  const projectTasks = useMemo(() => tasks.filter((task) => task.projectId && projectIds.has(task.projectId)),
    [tasks, projectIds]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const unsupported = projectTasks.filter(moveRestriction).length;
  const missingCategories = projectTasks.filter((task) => task.categoryId && !categoryById.has(task.categoryId)).length;
  const canMove = linkedListCount === 0 && unsupported === 0 && missingCategories === 0
    && tree.every((project) => project.status === "active" && project.tags.length === 0);

  useEffect(() => {
    let active = true;
    void listSharedSpaces().then((found) => {
      if (!active) return;
      const writable = found.filter((space) => ["owner", "admin", "member"].includes(space.role));
      setSpaces(writable);
      setSpaceId(writable[0]?.id ?? "");
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, []);

  const publish = async (mode: "copy" | "move") => {
    if (!spaceId || busy || !consent || mode === "move" && !canMove) return;
    setBusy(true);
    setError("");
    try {
      const categoryEntries = tree.flatMap((project) => {
        const ids = new Set([project.categoryId,
          ...projectTasks.filter((task) => task.projectId === project.id).map((task) => task.categoryId)]
          .filter((id): id is string => Boolean(id)));
        return [...ids].flatMap((id) => {
          const category = categoryById.get(id);
          return category ? [{ sourceId: id, projectSourceId: project.id, title: category.name,
            color: /^#[0-9a-f]{6}$/i.test(category.color) ? category.color : "#8d7750" }] : [];
        });
      });
      const transferKey = `genesis-project-import:${root.id}:${mode}`;
      const transferId = sessionStorage.getItem(transferKey) || crypto.randomUUID();
      sessionStorage.setItem(transferKey, transferId);
      const payload: SharedProjectImport = {
        transferId, mode,
        projects: tree.map((project) => ({
          sourceId: project.id, parentSourceId: project.id === root.id ? null : project.parentId,
          title: project.title, description: project.description, layout: "list",
        })),
        categories: categoryEntries,
        tasks: projectTasks.map((task) => ({
          sourceId: task.id, projectSourceId: task.projectId!, categorySourceId: task.categoryId,
          title: task.title.trim().replace(/\s+/gu, " "), description: task.description.trim(),
          dueDate: task.dueDate || null, done: task.done,
        })),
      };
      const receipt = await importSharedProject(spaceId, payload);
      if (receipt.mode !== mode || receipt.rootProjectId !== receipt.projectIds[root.id]
        || Object.keys(receipt.projectIds).length !== tree.length
        || Object.keys(receipt.taskIds).length !== projectTasks.length) {
        throw new Error(english ? "The server did not confirm the complete project."
          : "Сервер не подтвердил полный перенос проекта.");
      }
      if (mode === "move") await onMoved(tree.map((project) => project.id), projectTasks.map((task) => task.id));
      sessionStorage.removeItem(transferKey);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section ref={dialogRef} className="editor-modal personal-task-transfer" role="dialog" aria-modal="true"
      aria-labelledby="personal-project-transfer-title" tabIndex={-1}>
      <button type="button" className="modal-close" onClick={onClose} disabled={busy}
        aria-label={english ? "Close" : "Закрыть"}>×</button>
      <span className="eyebrow">{english ? "Private → shared" : "Личное → общее"}</span>
      <h2 id="personal-project-transfer-title">{english ? "Share a project" : "Переместить проект в общие"}</h2>
      <p>{english ? "Review the entire tree before project members can see it."
        : "Проверьте состав проекта: участники увидят все перечисленные данные."}</p>
      <label><span>{english ? "Shared space" : "Общее пространство"}</span>
        <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} disabled={busy}>
          {spaces.map((space) => <option key={space.id} value={space.id}>{space.title}</option>)}
        </select></label>
      {!spaces.length ? <p>{english ? "Create a shared space first." : "Сначала создайте общее пространство."}</p> : null}
      <div className="personal-task-transfer-preview">
        <strong data-no-translate>{root.title}</strong>
        <p>{english ? `${tree.length} projects, ${categoryEntriesCount(tree, projectTasks)} categories, ${projectTasks.length} tasks`
          : `${tree.length} проектов, ${categoryEntriesCount(tree, projectTasks)} категорий, ${projectTasks.length} задач`}</p>
        {tree.map((project) => <p key={project.id} data-no-translate>{project.id === root.id ? "◇" : "↳"} {project.title}</p>)}
        <details><summary>{english ? "Review every shared task" : "Просмотреть все передаваемые задачи"}</summary>
          {projectTasks.map((task) => <p key={task.id} data-no-translate>
            <strong>{task.title}</strong>{task.description ? ` — ${task.description}` : ""}
            {task.dueDate ? ` · ${task.dueDate}` : ""}{task.done ? " · ✓" : ""}
          </p>)}
        </details>
      </div>
      <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}
        disabled={busy} /> {english
          ? "I agree that members of this shared space can access the listed projects and tasks by role."
          : "Согласен открыть перечисленные проекты и задачи участникам общего пространства согласно их ролям."}</label>
      {!canMove ? <p role="status">{english
        ? `Moving is unavailable: ${unsupported} tasks have fields absent from shared projects; linked lists: ${linkedListCount}. You can copy the visible basic fields.`
        : `Перемещение недоступно: у ${unsupported} задач есть поля, которых пока нет в общих проектах; связанных списков: ${linkedListCount}. Можно скопировать основные поля.`}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="editor-actions">
        <button type="button" className="text-button" onClick={onClose} disabled={busy}>{english ? "Cancel" : "Отмена"}</button>
        <button type="button" className="text-button" onClick={() => void publish("copy")}
          disabled={busy || !spaceId || !consent}>{english ? "Copy" : "Скопировать"}</button>
        <button type="button" className="primary-button" onClick={() => void publish("move")}
          disabled={busy || !spaceId || !canMove || !consent}>{english ? "Move project" : "Переместить проект"}</button>
      </div>
    </section>
  </div>;
}

function categoryEntriesCount(tree: GenesisProject[], tasks: GenesisTask[]): number {
  return tree.reduce((count, project) => count + new Set([project.categoryId,
    ...tasks.filter((task) => task.projectId === project.id).map((task) => task.categoryId)]
    .filter(Boolean)).size, 0);
}
