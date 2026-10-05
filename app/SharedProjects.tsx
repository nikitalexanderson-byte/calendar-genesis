"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  acceptSharedInvitation, addSharedComment, changeSharedMemberRole, changeSharedSpaceRole,
  createSharedProject, createSharedStatus, createSharedCategory, deleteSharedCategory,
  deleteSharedStatus, updateSharedCategory, updateSharedStatus,
  createSharedSpace, createSharedTask, inviteSharedMember, listSharedComments, listSharedProjects,
  listArchivedSharedProjects, listSharedSpaces, loadSharedProject, removeSharedMember,
  setSharedProjectArchived, updateSharedProject, updateSharedTask,
  type SharedComment, type SharedProject, type SharedProjectSnapshot,
  type SharedSpace, type SharedTask,
} from "./cloud-sync";
import "./shared-projects.css";

type Props = { userId: string; language: string };

export function SharedProjects({ userId, language }: Props) {
  const english = language === "en";
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<SharedProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [snapshot, setSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [taskId, setTaskId] = useState("");
  const [comments, setComments] = useState<SharedComment[]>([]);
  const [spaceTitle, setSpaceTitle] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLayout, setProjectLayout] = useState<"list" | "board">("list");
  const [parentId, setParentId] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategoryId, setNewTaskCategoryId] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#2d6c68");
  const [newStatusTitle, setNewStatusTitle] = useState("");
  const [newStatusDone, setNewStatusDone] = useState(false);
  const [statusDestinations, setStatusDestinations] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskCategoryId, setEditTaskCategoryId] = useState("");
  const [editTaskRevision, setEditTaskRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshSpaces = useCallback(async () => {
    const items = await listSharedSpaces();
    setSpaces(items);
    setSpaceId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
  }, []);
  const refreshProjects = useCallback(async (id: string) => {
    const [items, archived] = await Promise.all([listSharedProjects(id), listArchivedSharedProjects(id)]);
    setProjects(items);
    setArchivedProjects(archived);
    if (!items.length) setSnapshot(null);
    setProjectId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
  }, []);
  const refreshProject = useCallback(async (id: string) => {
    const result = await loadSharedProject(id);
    setSnapshot(result);
    setTaskId((current) => result.tasks.some((task) => task.id === current) ? current : "");
    if (!result.tasks.length) setComments([]);
  }, []);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      void refreshSpaces().catch((error: unknown) => {
        if (live) setMessage(error instanceof Error ? error.message : String(error));
      }).finally(() => { if (live) setLoading(false); });
      const token = new URLSearchParams(window.location.search).get("shared_invite");
      if (token && /^[a-f0-9]{64}$/.test(token)) setInviteToken(token);
    }, 0);
    return () => { live = false; window.clearTimeout(timer); };
  }, [refreshSpaces, userId]);
  useEffect(() => {
    if (!spaceId) return;
    const timer = window.setTimeout(() => {
      void refreshProjects(spaceId).catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [spaceId, refreshProjects]);
  useEffect(() => {
    if (!projectId) return;
    const initial = window.setTimeout(() => {
      void refreshProject(projectId).catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)));
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void refreshProject(projectId).catch(() => undefined);
      }
    }, 5000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [projectId, refreshProject]);
  useEffect(() => {
    if (!projectId || !taskId) return;
    void listSharedComments(projectId, taskId).then(setComments)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [projectId, taskId]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const submitSpace = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const space = await createSharedSpace(spaceTitle);
      setSpaceTitle("");
      await refreshSpaces();
      setSpaceId(space.id);
      setMessage(english ? "Workspace created." : "Пространство создано.");
    });
  };
  const submitProject = (event: FormEvent) => {
    event.preventDefault();
    if (!spaceId) return;
    void run(async () => {
      const project = await createSharedProject(spaceId, {
        title: projectTitle, description: projectDescription, layout: projectLayout,
        parentId: parentId || null,
      });
      setProjectTitle(""); setProjectDescription(""); setParentId("");
      await refreshProjects(spaceId);
      setProjectId(project.id);
      setMessage(english ? "Project created." : "Проект создан.");
    });
  };
  const submitTask = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot) return;
    void run(async () => {
      await createSharedTask(snapshot.project.id, {
        title: newTaskTitle, statusId: snapshot.statuses[0].id,
        categoryId: newTaskCategoryId || null,
      });
      setNewTaskTitle("");
      await refreshProject(snapshot.project.id);
      setMessage(english ? "Task saved for the team." : "Задача сохранена для команды.");
    });
  };
  const moveTask = (task: SharedTask, statusId: string) => {
    if (!snapshot || task.statusId === statusId) return;
    void run(async () => {
      await updateSharedTask(snapshot.project.id, task.id, { statusId, expectedRevision: task.revision });
      await refreshProject(snapshot.project.id);
    });
  };
  const assignTask = (task: SharedTask, assigneeId: string) => {
    if (!snapshot) return;
    void run(async () => {
      await updateSharedTask(snapshot.project.id, task.id, {
        assigneeId: assigneeId || null, expectedRevision: task.revision,
      });
      await refreshProject(snapshot.project.id);
    });
  };
  const submitInvite = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot) return;
    void run(async () => {
      const invitation = await inviteSharedMember(snapshot.project.id, inviteEmail, inviteRole);
      const url = new URL(window.location.href);
      url.searchParams.set("shared_invite", invitation.token);
      setInviteLink(url.toString());
      setMessage(english ? "Invitation link ready. Share it privately with the named person." : "Ссылка готова. Передайте её указанному человеку лично.");
    });
  };
  const acceptInvite = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const accepted = await acceptSharedInvitation(inviteToken.trim());
      setInviteToken("");
      const url = new URL(window.location.href);
      url.searchParams.delete("shared_invite");
      window.history.replaceState(null, "", url);
      await refreshSpaces();
      setSpaceId(accepted.spaceId);
      await refreshProjects(accepted.spaceId);
      setProjectId(accepted.projectId);
      setMessage(english ? "Invitation accepted." : "Приглашение принято.");
    });
  };
  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !taskId) return;
    void run(async () => {
      await addSharedComment(snapshot.project.id, taskId, commentBody);
      setCommentBody("");
      setComments(await listSharedComments(snapshot.project.id, taskId));
    });
  };
  const submitTaskEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snapshot || !taskId) return;
    void run(async () => {
      const changed = await updateSharedTask(snapshot.project.id, taskId, {
        title: editTaskTitle.trim(), description: editTaskDescription.trim(),
        dueDate: editTaskDueDate || null, categoryId: editTaskCategoryId || null,
        expectedRevision: editTaskRevision,
      });
      setEditTaskRevision(changed.revision);
      await refreshProject(snapshot.project.id);
      setMessage(english ? "Task saved." : "Задача сохранена.");
    });
  };
  const submitStatus = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snapshot) return;
    void run(async () => {
      await createSharedStatus(snapshot.project.id, newStatusTitle.trim(), newStatusDone);
      setNewStatusTitle(""); setNewStatusDone(false);
      await refreshProject(snapshot.project.id);
    });
  };
  const renameStatus = (event: FormEvent<HTMLFormElement>, statusId: string, revision: number) => {
    event.preventDefault();
    if (!snapshot) return;
    const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    void run(async () => {
      await updateSharedStatus(snapshot.project.id, statusId, title, revision);
      await refreshProject(snapshot.project.id);
    });
  };
  const removeStatus = (statusId: string, revision: number, destinationId: string) => {
    if (!snapshot || !destinationId || !window.confirm(english
      ? "Remove this status and move its tasks to the selected status?"
      : "Удалить статус и перенести его задачи в выбранный статус?")) return;
    void run(async () => {
      await deleteSharedStatus(snapshot.project.id, statusId, destinationId, revision);
      await refreshProject(snapshot.project.id);
    });
  };
  const statusLabel = (title: string) => english ? ({
    "К выполнению": "To do", "В работе": "In progress", "Готово": "Done",
  })[title] ?? title : title;
  const submitCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snapshot) return;
    void run(async () => {
      await createSharedCategory(snapshot.project.id, newCategoryTitle.trim(), newCategoryColor);
      setNewCategoryTitle("");
      await refreshProject(snapshot.project.id);
    });
  };
  const renameCategory = (event: FormEvent<HTMLFormElement>, categoryId: string, revision: number) => {
    event.preventDefault();
    if (!snapshot) return;
    const fields = new FormData(event.currentTarget);
    void run(async () => {
      await updateSharedCategory(snapshot.project.id, categoryId,
        String(fields.get("title") ?? "").trim(), String(fields.get("color") ?? ""), revision);
      await refreshProject(snapshot.project.id);
    });
  };
  const removeCategory = (categoryId: string, revision: number) => {
    if (!snapshot || !window.confirm(english
      ? "Delete this category? Tasks will remain without a category."
      : "Удалить категорию? Задачи останутся без категории.")) return;
    void run(async () => {
      await deleteSharedCategory(snapshot.project.id, categoryId, revision);
      await refreshProject(snapshot.project.id);
      if (newTaskCategoryId === categoryId) setNewTaskCategoryId("");
      if (editTaskCategoryId === categoryId) setEditTaskCategoryId("");
    });
  };
  const submitProjectEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snapshot) return;
    const fields = new FormData(event.currentTarget);
    const current = snapshot.project;
    void run(async () => {
      await updateSharedProject(current.id, {
        title: String(fields.get("title") ?? ""),
        description: String(fields.get("description") ?? ""),
        layout: String(fields.get("layout")) as "list" | "board",
        parentId: String(fields.get("parentId") ?? "") || null,
        expectedRevision: current.revision,
      });
      await refreshProjects(current.spaceId);
      await refreshProject(current.id);
      setMessage(english ? "Project updated." : "Проект обновлён.");
    });
  };
  const archiveProject = () => {
    if (!snapshot || !window.confirm(english ? "Archive this project? Its tasks will be kept." : "Архивировать проект? Его задачи сохранятся.")) return;
    void run(async () => {
      const current = snapshot.project;
      await setSharedProjectArchived(current.id, true);
      setSnapshot(null); setTaskId("");
      await refreshProjects(current.spaceId);
      setMessage(english ? "Project archived. You can restore it below." : "Проект в архиве. Его можно восстановить ниже.");
    });
  };
  const restoreProject = (id: string) => {
    if (!spaceId) return;
    void run(async () => {
      await setSharedProjectArchived(id, false);
      await refreshProjects(spaceId);
      setProjectId(id);
      setMessage(english ? "Project restored." : "Проект восстановлен.");
    });
  };
  const setMemberRole = (memberId: string, role: string) => {
    if (!snapshot) return;
    void run(async () => {
      await changeSharedMemberRole(snapshot.project.id, memberId, role);
      await refreshProject(snapshot.project.id);
    });
  };
  const setSpaceRole = (memberId: string, role: string) => {
    if (!snapshot) return;
    void run(async () => {
      await changeSharedSpaceRole(snapshot.project.spaceId, memberId, role);
      await refreshProject(snapshot.project.id);
      await refreshProjects(snapshot.project.spaceId);
    });
  };
  const removeMember = (memberId: string) => {
    if (!snapshot || !window.confirm(english ? "Remove this participant?" : "Удалить этого участника?")) return;
    void run(async () => {
      await removeSharedMember(snapshot.project.id, memberId);
      await refreshProject(snapshot.project.id);
    });
  };
  const roleLabel = (role: string) => ({
    owner: english ? "Owner" : "Владелец", manager: english ? "Manager" : "Менеджер",
    member: english ? "Member" : "Участник", commenter: english ? "Commenter" : "Комментатор",
    viewer: english ? "Viewer" : "Читатель", admin: english ? "Admin" : "Администратор",
    guest: english ? "Guest" : "Гость",
  })[role as "owner" | "manager" | "member" | "commenter" | "viewer" | "admin" | "guest"] ?? role;
  const selectedTask = snapshot?.tasks.find((task) => task.id === taskId);
  const canWrite = snapshot && ["owner", "manager", "member"].includes(snapshot.project.role);
  const canComment = snapshot && ["owner", "manager", "member", "commenter"].includes(snapshot.project.role);
  const canInvite = snapshot && ["owner", "manager"].includes(snapshot.project.role);

  return <div className="shared-projects" data-exp-layout="view">
    <header className="shared-projects-hero" data-exp-ui="panel">
      <span className="shared-projects-mark" aria-hidden="true"><i /><i /><i /></span>
      <div>
        <span className="eyebrow">GENESIS · {english ? "Together" : "Вместе"}</span>
        <h1>{snapshot?.project.isInbox && english ? "Shared inbox" : snapshot?.project.title ?? (english ? "Shared projects" : "Общие проекты")}</h1>
        <p>{snapshot?.project.isInbox && english ? "Team tasks without a separate project" : snapshot?.project.description || (english
          ? "Plan together while keeping personal tasks, habits and calendars private."
          : "Планируйте вместе. Личные задачи, привычки и календарь остаются вашими.")}</p>
      </div>
    </header>
    <p className="shared-projects-privacy">{english
      ? "Project content is visible to invited members and processed on the GENESIS server."
      : "Содержимое общего проекта видно приглашённым участникам и обрабатывается сервером GENESIS."}</p>
    {message ? <p className="shared-projects-message" role="status">{message}</p> : null}
    {loading ? <p role="status">{english ? "Loading projects…" : "Загружаем проекты…"}</p> : null}

    <form className="shared-projects-invite-accept" onSubmit={acceptInvite}>
      <label>{english ? "Invitation token" : "Код приглашения"}<input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder={english ? "Paste an invitation token" : "Вставьте код приглашения"} /></label>
      <button type="submit" disabled={busy || !inviteToken.trim()}>{english ? "Join project" : "Вступить в проект"}</button>
    </form>

    <div className="shared-projects-toolbar">
      <label>{english ? "Workspace" : "Пространство"}<select value={spaceId} onChange={(event) => { setSpaceId(event.target.value); setSnapshot(null); setProjectId(""); setTaskId(""); setComments([]); }} disabled={!spaces.length}>
        {!spaces.length ? <option value="">{english ? "No workspaces" : "Нет пространств"}</option> : null}
        {spaces.map((space) => <option key={space.id} value={space.id}>{space.title}</option>)}
      </select></label>
      <label>{english ? "Project" : "Проект"}<select value={projectId} onChange={(event) => { setProjectId(event.target.value); setSnapshot(null); setTaskId(""); setComments([]); }} disabled={!projects.length}>
        {!projects.length ? <option value="">{english ? "No projects" : "Нет проектов"}</option> : null}
        {projects.map((project) => <option key={project.id} value={project.id}>{project.isInbox && english ? "Shared inbox" : project.title}</option>)}
      </select></label>
    </div>

    <details className="shared-projects-create" open={!spaces.length}>
      <summary>{spaces.length ? (english ? "Create another workspace" : "Создать ещё пространство") : (english ? "Start with a workspace" : "Начните с пространства")}</summary>
      <form onSubmit={submitSpace}>
      <p>{english ? "A workspace brings your collaborators together. Create a project after this step." : "Пространство объединяет команду. После него создайте проект."}</p>
      <label>{english ? "Name" : "Название"}<input value={spaceTitle} maxLength={160} required onChange={(event) => setSpaceTitle(event.target.value)} /></label>
      <button type="submit" className="primary-button" disabled={busy}>{english ? "Create workspace" : "Создать пространство"}</button>
      </form>
    </details>

    {spaceId ? <details className="shared-projects-create" open={!projects.length}>
      <summary>{english ? "Create a shared project" : "Создать общий проект"}</summary>
      <form onSubmit={submitProject}>
        <label>{english ? "Name" : "Название"}<input value={projectTitle} maxLength={160} required onChange={(event) => setProjectTitle(event.target.value)} /></label>
        <label>{english ? "Description" : "Описание"}<textarea value={projectDescription} maxLength={5000} onChange={(event) => setProjectDescription(event.target.value)} /></label>
        <label>{english ? "Layout" : "Вид"}<select value={projectLayout} onChange={(event) => setProjectLayout(event.target.value as "list" | "board")}>
          <option value="list">{english ? "Task container" : "Контейнер задач"}</option><option value="board">{english ? "Board" : "Доска"}</option>
        </select></label>
        <label>{english ? "Parent project" : "Родительский проект"}<select value={parentId} onChange={(event) => setParentId(event.target.value)}>
          <option value="">{english ? "Top level" : "Верхний уровень"}</option>
          {projects.filter((project) => !project.isInbox).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select></label>
        <button type="submit" className="primary-button" disabled={busy}>{english ? "Create project" : "Создать проект"}</button>
      </form>
    </details> : null}
    {archivedProjects.length ? <details className="shared-projects-create">
      <summary>{english ? "Archived projects" : "Архив проектов"} · {archivedProjects.length}</summary>
      <div className="shared-projects-members">{archivedProjects.map((project) => <div key={project.id} className="shared-projects-member">
        <span>{project.title}</span>
        {project.role === "owner" ? <button type="button" disabled={busy} onClick={() => restoreProject(project.id)}>{english ? "Restore" : "Восстановить"}</button> : null}
      </div>)}</div>
    </details> : null}

    {snapshot ? <>
      <div className="shared-projects-meta"><span>{english ? "Your role" : "Ваша роль"}: {roleLabel(snapshot.project.role)}</span><span>{snapshot.members.length} {english ? "members" : "участников"}</span></div>
      {canInvite && !snapshot.project.isInbox ? <details className="shared-projects-create">
        <summary>{english ? "Project settings" : "Настройки проекта"}</summary>
        <form key={`${snapshot.project.id}:${snapshot.project.revision}`} onSubmit={submitProjectEdit}>
          <label>{english ? "Name" : "Название"}<input name="title" defaultValue={snapshot.project.title} maxLength={160} required /></label>
          <label>{english ? "Description" : "Описание"}<textarea name="description" defaultValue={snapshot.project.description} maxLength={5000} /></label>
          <label>{english ? "Layout" : "Вид"}<select name="layout" defaultValue={snapshot.project.layout}><option value="list">{english ? "Task container" : "Контейнер задач"}</option><option value="board">{english ? "Board" : "Доска"}</option></select></label>
          <label>{english ? "Parent project" : "Родительский проект"}<select name="parentId" defaultValue={snapshot.project.parentId ?? ""}>
            <option value="">{english ? "Top level" : "Верхний уровень"}</option>
            {projects.filter((project) => project.id !== snapshot.project.id && !project.isInbox).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select></label>
          <button type="submit" disabled={busy}>{english ? "Save project" : "Сохранить проект"}</button>
        </form>
        {snapshot.project.role === "owner" ? <button type="button" className="shared-projects-archive" disabled={busy} onClick={archiveProject}>{english ? "Archive project" : "Архивировать проект"}</button> : null}
      </details> : null}
      {canInvite ? <details className="shared-projects-create">
        <summary>{english ? "Board statuses" : "Статусы доски"}</summary>
        <div className="shared-projects-members">{snapshot.statuses.map((status) => {
          const destinations = snapshot.statuses.filter((item) => item.id !== status.id);
          const destinationId = destinations.some((item) => item.id === statusDestinations[status.id])
            ? statusDestinations[status.id] : destinations[0]?.id ?? "";
          const isLastDone = Boolean(status.isDone) && snapshot.statuses.filter((item) => item.isDone).length === 1;
          return <div key={status.id} className="shared-projects-status-settings">
            <form onSubmit={(event) => renameStatus(event, status.id, status.revision)}>
              <label>{english ? "Status name" : "Название статуса"}<input name="title" key={`${status.id}:${status.revision}`} defaultValue={statusLabel(status.title)} maxLength={80} required /></label>
              <button type="submit" disabled={busy}>{english ? "Rename" : "Переименовать"}</button>
            </form>
            <small>{status.isDone ? (english ? "Completed" : "Завершено") : (english ? "Active" : "В работе")}</small>
            <label>{english ? "Move tasks to" : "Перенести задачи в"}<select value={destinationId} disabled={busy || !destinations.length} onChange={(event) => setStatusDestinations((current) => ({ ...current, [status.id]: event.target.value }))}>
              {destinations.map((item) => <option key={item.id} value={item.id}>{statusLabel(item.title)}</option>)}
            </select></label>
            <button type="button" disabled={busy || !destinationId || isLastDone} onClick={() => removeStatus(status.id, status.revision, destinationId)}>{english ? "Delete status" : "Удалить статус"}</button>
          </div>;
        })}</div>
        <form onSubmit={submitStatus}>
          <label>{english ? "New status" : "Новый статус"}<input value={newStatusTitle} maxLength={80} required onChange={(event) => setNewStatusTitle(event.target.value)} /></label>
          <label className="shared-projects-checkbox"><input type="checkbox" checked={newStatusDone} onChange={(event) => setNewStatusDone(event.target.checked)} />{english ? "Completion status" : "Статус завершения"}</label>
          <button type="submit" disabled={busy}>{english ? "Add status" : "Добавить статус"}</button>
        </form>
      </details> : null}
      {canInvite ? <details className="shared-projects-create">
        <summary>{english ? "Project categories" : "Категории проекта"}</summary>
        <div className="shared-projects-members">{snapshot.categories.map((category) => <div key={category.id} className="shared-projects-status-settings">
          <form onSubmit={(event) => renameCategory(event, category.id, category.revision)}>
            <label>{english ? "Category name" : "Название категории"}<input name="title" key={`${category.id}:${category.revision}`} defaultValue={category.title} maxLength={80} required /></label>
            <label>{english ? "Color" : "Цвет"}<input name="color" type="color" defaultValue={category.color} /></label>
            <button type="submit" disabled={busy}>{english ? "Save" : "Сохранить"}</button>
          </form>
          <button type="button" disabled={busy} onClick={() => removeCategory(category.id, category.revision)}>{english ? "Delete" : "Удалить"}</button>
        </div>)}</div>
        <form onSubmit={submitCategory}>
          <label>{english ? "New category" : "Новая категория"}<input value={newCategoryTitle} maxLength={80} required onChange={(event) => setNewCategoryTitle(event.target.value)} /></label>
          <label>{english ? "Color" : "Цвет"}<input type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} /></label>
          <button type="submit" disabled={busy || snapshot.categories.length >= 50}>{english ? "Add category" : "Добавить категорию"}</button>
        </form>
      </details> : null}
      <details className="shared-projects-invite">
        <summary>{english ? "Participants and roles" : "Участники и роли"}</summary>
        <div className="shared-projects-members">{snapshot.members.map((member) => <div key={member.userId} className="shared-projects-member">
          <span>{member.displayName}</span>
          {snapshot.project.spaceRole === "owner" ? <label>{english ? "Workspace access" : "Доступ к пространству"}<select value={member.spaceRole} disabled={busy} onChange={(event) => setSpaceRole(member.userId, event.target.value)}>
            {["owner", "admin", "member", "guest"].map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </select></label> : <span>{roleLabel(member.spaceRole)}</span>}
          {snapshot.project.role === "owner" && !snapshot.project.isInbox ? <>
            <label>{english ? "Role" : "Роль"}<select value={member.role} disabled={busy} onChange={(event) => setMemberRole(member.userId, event.target.value)}>
              {["owner", "manager", "member", "commenter", "viewer"].map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select></label>
            <button type="button" disabled={busy || (member.role === "owner" && snapshot.members.filter((item) => item.role === "owner").length === 1)} onClick={() => removeMember(member.userId)}>{english ? "Remove" : "Удалить"}</button>
          </> : <span>{roleLabel(member.role)}</span>}
        </div>)}</div>
      </details>
      {canInvite ? <details className="shared-projects-invite">
        <summary>{english ? "Invite a participant" : "Пригласить участника"}</summary>
        <form onSubmit={submitInvite}>
          <label>Email<input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label>
          <label>{english ? "Role" : "Роль"}<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
            <option value="manager">{english ? "Manager" : "Менеджер"}</option><option value="member">{english ? "Member" : "Участник"}</option>
            <option value="commenter">{english ? "Commenter" : "Комментатор"}</option><option value="viewer">{english ? "Viewer" : "Читатель"}</option>
          </select></label>
          <button type="submit" disabled={busy}>{english ? "Create invitation" : "Создать приглашение"}</button>
        </form>
        {inviteLink ? <label>{english ? "Private invitation link" : "Личная ссылка приглашения"}<input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /></label> : null}
      </details> : null}
      {canWrite ? <form className="shared-projects-create-task" onSubmit={submitTask}>
        <label>{english ? "New team task" : "Новая задача команды"}<input maxLength={160} required value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} /></label>
        <label>{english ? "Category" : "Категория"}<select value={newTaskCategoryId} onChange={(event) => setNewTaskCategoryId(event.target.value)}>
          <option value="">{english ? "No category" : "Без категории"}</option>
          {snapshot.categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
        </select></label>
        <button type="submit" disabled={busy}>{english ? "Add task" : "Добавить задачу"}</button>
      </form> : null}
      {snapshot.project.layout === "board" ? <p className="shared-projects-board-hint">{english
        ? "Swipe across the board to view all statuses."
        : "Проведите по доске, чтобы увидеть все статусы."}</p> : null}
      <div className={snapshot.project.layout === "board" ? "shared-projects-board" : "shared-projects-list"}>
        {snapshot.statuses.map((status) => <section key={status.id} className="shared-projects-column" aria-label={status.title}>
          <h2>{statusLabel(status.title)} <small>{snapshot.tasks.filter((task) => task.statusId === status.id).length}</small></h2>
          {snapshot.tasks.filter((task) => task.statusId === status.id).map((task) => <article key={task.id} className="shared-projects-task">
            <button type="button" className="shared-projects-task-open" onClick={() => {
              setTaskId(task.id); setComments([]);
              setEditTaskTitle(task.title); setEditTaskDescription(task.description);
              setEditTaskDueDate(task.dueDate ?? ""); setEditTaskCategoryId(task.categoryId ?? "");
              setEditTaskRevision(task.revision);
            }} aria-pressed={taskId === task.id}>
              <strong>{task.title}</strong><small>{task.dueDate || (english ? "No due date" : "Без срока")}</small>
            </button>
            {snapshot.categories.find((category) => category.id === task.categoryId) ? <small className="shared-projects-category-tag">
              <i style={{ background: snapshot.categories.find((category) => category.id === task.categoryId)?.color }} />
              {snapshot.categories.find((category) => category.id === task.categoryId)?.title}</small> : null}
            {task.completedBy ? <small>{english ? "Completed by" : "Выполнил(а)"}: {snapshot.members.find((member) => member.userId === task.completedBy)?.displayName ?? (english ? "Former member" : "Бывший участник")}</small> : null}
            {canWrite ? <label>{english ? "Move to" : "Статус"}<select value={task.statusId} disabled={busy} onChange={(event) => moveTask(task, event.target.value)}>
              {snapshot.statuses.map((item) => <option key={item.id} value={item.id}>{statusLabel(item.title)}</option>)}
            </select></label> : null}
          </article>)}
        </section>)}
      </div>
      {selectedTask ? <section className="shared-projects-detail" aria-label={english ? "Task details" : "Карточка задачи"}>
        <button type="button" className="shared-projects-close" onClick={() => { setTaskId(""); setComments([]); }} aria-label={english ? "Close task" : "Закрыть задачу"}>×</button>
        <h2>{selectedTask.title}</h2>
        {canWrite ? <form onSubmit={submitTaskEdit}>
          <label>{english ? "Name" : "Название"}<input value={editTaskTitle} onChange={(event) => setEditTaskTitle(event.target.value)} maxLength={160} required /></label>
          <label>{english ? "Description" : "Описание"}<textarea value={editTaskDescription} onChange={(event) => setEditTaskDescription(event.target.value)} maxLength={20000} /></label>
          <label>{english ? "Due date" : "Срок"}<input type="date" value={editTaskDueDate} onChange={(event) => setEditTaskDueDate(event.target.value)} /></label>
          <label>{english ? "Category" : "Категория"}<select value={editTaskCategoryId} onChange={(event) => setEditTaskCategoryId(event.target.value)}>
            <option value="">{english ? "No category" : "Без категории"}</option>
            {snapshot.categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select></label>
          {selectedTask.revision !== editTaskRevision ? <p role="status">{english ? "This task changed elsewhere. Your draft is kept. Reload its fields before saving." : "Задача изменилась у другого участника. Черновик сохранён; обновите поля перед сохранением."}
            <button type="button" onClick={() => { setEditTaskTitle(selectedTask.title); setEditTaskDescription(selectedTask.description); setEditTaskDueDate(selectedTask.dueDate ?? ""); setEditTaskCategoryId(selectedTask.categoryId ?? ""); setEditTaskRevision(selectedTask.revision); }}>{english ? "Reload fields" : "Обновить поля"}</button></p> : null}
          <button type="submit" disabled={busy || selectedTask.revision !== editTaskRevision}>{english ? "Save task" : "Сохранить задачу"}</button>
        </form> : selectedTask.description ? <p>{selectedTask.description}</p> : null}
        {canWrite ? <label>{english ? "Assigned to" : "Исполнитель"}<select value={selectedTask.assigneeId ?? ""} disabled={busy} onChange={(event) => assignTask(selectedTask, event.target.value)}>
          <option value="">{english ? "Unassigned" : "Не назначен"}</option>
          {snapshot.members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
        </select></label> : null}
        <h3>{english ? "Discussion" : "Обсуждение"}</h3>
        {comments.map((comment) => <p key={comment.id}><strong>{comment.authorName}</strong> · {comment.body}</p>)}
        {canComment ? <form onSubmit={submitComment}><label>{english ? "Comment" : "Комментарий"}<textarea value={commentBody} maxLength={5000} required onChange={(event) => setCommentBody(event.target.value)} /></label>
          <button type="submit" disabled={busy}>{english ? "Send" : "Отправить"}</button></form> : null}
      </section> : null}
    </> : null}
  </div>;
}
