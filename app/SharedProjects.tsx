"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
import "./shared-projects-layout.css";
import { ProjectsHeroMark } from "./ProjectsHeroMark";

type Props = { userId: string; language: string };

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function SharedProjects({ userId, language }: Props) {
  const english = language === "en";
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<SharedProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [viewOverride, setViewOverride] = useState<"list" | "board" | "calendar" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [calendarDay, setCalendarDay] = useState(() => localDateKey(new Date()));
  const [snapshot, setSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [taskId, setTaskId] = useState("");
  const [comments, setComments] = useState<SharedComment[]>([]);
  const [spaceTitle, setSpaceTitle] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLayout, setProjectLayout] = useState<"list" | "board">("list");
  const [parentId, setParentId] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskStatusId, setNewTaskStatusId] = useState("");
  const [newTaskCategoryId, setNewTaskCategoryId] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
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
  const taskDetailRef = useRef<HTMLElement>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const [createModal, setCreateModal] = useState<"space" | "project" | "task" | "status" | "category" | "invite" | null>(null);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) return;
    if (createModal && !dialog.open) dialog.showModal();
    if (!createModal && dialog.open) dialog.close();
  }, [createModal]);

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
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void refreshProjects(spaceId).catch(() => undefined);
    }, 5000);
    return () => { window.clearTimeout(timer); window.clearInterval(poll); };
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
  useEffect(() => {
    if (!taskId || !window.matchMedia("(max-width: 700px)").matches) return;
    window.requestAnimationFrame(() => taskDetailRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    }));
  }, [taskId]);

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
      setCreateModal(null);
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
      setCreateModal(null);
      setMessage(english ? "Project created." : "Проект создан.");
    });
  };
  const submitTask = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot) return;
    void run(async () => {
      await createSharedTask(snapshot.project.id, {
        title: newTaskTitle.trim(), description: newTaskDescription.trim(),
        dueDate: newTaskDueDate || null,
        statusId: newTaskStatusId || snapshot.statuses[0].id,
        categoryId: newTaskCategoryId || null,
        assigneeId: newTaskAssigneeId || null,
      });
      setNewTaskTitle(""); setNewTaskDescription(""); setNewTaskDueDate("");
      setNewTaskStatusId(""); setNewTaskCategoryId(""); setNewTaskAssigneeId("");
      await refreshProject(snapshot.project.id);
      setCreateModal(null);
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
      setCreateModal(null);
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
      setCreateModal(null);
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
      setCreateModal(null);
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
  const inboxProject = projects.find((project) => Boolean(project.isInbox));
  const activeView = viewOverride ?? snapshot?.project.layout ?? "list";
  const calendarOffset = (calendarMonth.getDay() + 6) % 7;
  const calendarDays = Array.from({ length: Math.ceil((calendarOffset + new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()) / 7) * 7 },
    (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1 - calendarOffset, 12));
  const calendarTasks = snapshot?.tasks.filter((task) => task.dueDate === calendarDay) ?? [];
  const openTask = (task: SharedTask) => {
    setTaskId(task.id); setComments([]);
    setEditTaskTitle(task.title); setEditTaskDescription(task.description);
    setEditTaskDueDate(task.dueDate ?? ""); setEditTaskCategoryId(task.categoryId ?? "");
    setEditTaskRevision(task.revision);
  };
  const canWrite = snapshot && ["owner", "manager", "member"].includes(snapshot.project.role);
  const canComment = snapshot && ["owner", "manager", "member", "commenter"].includes(snapshot.project.role);
  const canInvite = snapshot && ["owner", "manager"].includes(snapshot.project.role);

  return <div className="shared-projects" data-exp-layout="view">
    <header className="shared-projects-hero" data-exp-ui="panel">
      <ProjectsHeroMark shared />
      <div>
        <span className="eyebrow">GENESIS · {english ? "Together" : "Вместе"}</span>
        <h1>{english ? "Projects - shared" : "Проекты - общие"}</h1>
        <p>{english
          ? "Plan together while keeping personal tasks, habits and calendars private."
          : "Планируйте вместе. Личные задачи, привычки и календарь остаются вашими."}</p>
      </div>
    </header>
    {inboxProject ? <section className="shared-projects-inbox-card" aria-labelledby="shared-projects-inbox-title">
      <div>
        <span className="eyebrow">{english ? "Unsorted team tasks" : "Общие задачи без проекта"}</span>
        <h2 id="shared-projects-inbox-title">{english ? "Shared inbox" : "Хаос-бокс"}</h2>
        <p>{english ? "Keep new tasks here, then place them in a team project." : "Собирайте новые задачи здесь, затем распределяйте их по проектам команды."}</p>
        <button type="button" onClick={() => { setProjectId(inboxProject.id); setSnapshot(null); setTaskId(""); }}
          disabled={projectId === inboxProject.id}>{english ? "Open shared inbox" : "Открыть хаос-бокс"}</button>
      </div>
      <strong aria-label={english ? `${inboxProject.taskCount ?? 0} tasks` : `Задач: ${inboxProject.taskCount ?? 0}`}>{inboxProject.taskCount ?? 0}</strong>
    </section> : null}
    <p className="shared-projects-privacy">{english
      ? "Project content is visible to invited members and processed on the GENESIS server."
      : "Содержимое общего проекта видно приглашённым участникам и обрабатывается сервером GENESIS."}</p>
    {message ? <p className="shared-projects-message" role="status">{message}</p> : null}
    {loading ? <p role="status">{english ? "Loading projects…" : "Загружаем проекты…"}</p> : null}

    <div className="shared-projects-shell">
    <aside className="shared-projects-sidebar" aria-label={english ? "Shared project navigation" : "Навигация по общим проектам"}>
      <label className="shared-projects-space-picker">{english ? "Workspace" : "Пространство"}<select value={spaceId} onChange={(event) => { setSpaceId(event.target.value); setSnapshot(null); setProjectId(""); setTaskId(""); setComments([]); }} disabled={!spaces.length}>
        {!spaces.length ? <option value="">{english ? "No workspaces" : "Нет пространств"}</option> : null}
        {spaces.map((space) => <option key={space.id} value={space.id}>{space.title}</option>)}
      </select></label>
      {projects.length ? <nav className="shared-projects-project-nav" aria-label={english ? "Projects in workspace" : "Проекты пространства"}>
        <h2>{english ? "Team projects" : "Проекты команды"}</h2>
        {projects.map((project) => <button key={project.id} type="button" className="shared-projects-project-link"
          aria-current={projectId === project.id ? "page" : undefined}
          onClick={() => { setProjectId(project.id); setSnapshot(null); setTaskId(""); setComments([]); setViewOverride(null); }}>
          <span>{project.isInbox && english ? "Shared inbox" : project.title}</span>
        </button>)}
      </nav> : null}

    <button type="button" className="shared-projects-open-modal" onClick={() => setCreateModal("space")}>
      {spaces.length ? (english ? "Create another workspace" : "Создать ещё пространство") : (english ? "Create a workspace" : "Создать пространство")}
    </button>
    {spaceId ? <button type="button" className="shared-projects-open-modal" onClick={() => setCreateModal("project")}>
      {english ? "Create a shared project" : "Создать общий проект"}
    </button> : null}
    {archivedProjects.length ? <details className="shared-projects-create">
      <summary>{english ? "Archived projects" : "Архив проектов"} · {archivedProjects.length}</summary>
      <div className="shared-projects-members">{archivedProjects.map((project) => <div key={project.id} className="shared-projects-member">
        <span>{project.title}</span>
        {project.role === "owner" ? <button type="button" disabled={busy} onClick={() => restoreProject(project.id)}>{english ? "Restore" : "Восстановить"}</button> : null}
      </div>)}</div>
    </details> : null}
    <details className="shared-projects-invite-accept" open={Boolean(inviteToken)}>
      <summary>{english ? "Join by invitation" : "Вступить по приглашению"}</summary>
      <form onSubmit={acceptInvite}>
        <label>{english ? "Invitation token" : "Код приглашения"}<input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder={english ? "Paste an invitation token" : "Вставьте код приглашения"} /></label>
        <button type="submit" disabled={busy || !inviteToken.trim()}>{english ? "Join project" : "Вступить в проект"}</button>
      </form>
    </details>
    </aside>

    <main className="shared-projects-main">

    {snapshot ? <>
      <header className="shared-projects-context">
        <div>
          <h2>{snapshot.project.isInbox ? (english ? "Team tasks" : "Задачи команды") : snapshot.project.title}</h2>
          {!snapshot.project.isInbox && snapshot.project.description ? <p>{snapshot.project.description}</p> : null}
        </div>
        <div className="shared-projects-meta"><span>{english ? "Your role" : "Ваша роль"}: {roleLabel(snapshot.project.role)}</span><span>{snapshot.members.length} {english ? "members" : "участников"}</span></div>
      </header>
      <details className="shared-projects-management">
        <summary>{english ? "Project and team settings" : "Проект и команда"}</summary>
        <div className="shared-projects-management-content">
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
        <button type="button" disabled={busy || snapshot.categories.length >= 50} onClick={() => setCreateModal("category")}>
          {english ? "Create category" : "Создать категорию"}
        </button>
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
        <button type="button" disabled={busy} onClick={() => setCreateModal("invite")}>
          {english ? "Create invitation" : "Создать приглашение"}
        </button>
        {inviteLink ? <label>{english ? "Private invitation link" : "Личная ссылка приглашения"}<input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /></label> : null}
      </details> : null}
        </div>
      </details>
      <section className="shared-projects-planning" aria-label={english ? "Tasks and views" : "Задачи и виды проекта"}>
        <h3>{english ? "Tasks" : "Задачи проекта"}</h3>
      {canWrite ? <div className="shared-projects-create-actions">
        <button type="button" className="shared-projects-open-modal" onClick={() => {
          setNewTaskStatusId(snapshot.statuses[0]?.id ?? "");
          setNewTaskCategoryId(""); setNewTaskAssigneeId(""); setCreateModal("task");
        }}>
          {english ? "Create team task" : "Создать задачу команды"}
        </button>
        <button type="button" className="shared-projects-open-modal" disabled={busy || snapshot.statuses.length >= 20}
          onClick={() => setCreateModal("status")}>
          {english ? "Create task list" : "Создать список задач"}
        </button>
      </div> : null}
      <div className="shared-projects-view-switch" role="group" aria-label={english ? "Project view" : "Вид проекта"}>
        {(["list", "board", "calendar"] as const).map((item) => <button key={item} type="button"
          aria-pressed={activeView === item} onClick={() => setViewOverride(item)}>{item === "list"
            ? (english ? "List" : "Список") : item === "board" ? (english ? "Board" : "Доска")
              : (english ? "Calendar" : "Календарь")}</button>)}
      </div>
      {activeView === "board" ? <p className="shared-projects-board-hint">{english
        ? "Swipe across the board to view all statuses."
        : "Проведите по доске, чтобы увидеть все статусы."}</p> : null}
      </section>
      <div className={`shared-projects-workspace${selectedTask ? " shared-projects-workspace-with-detail" : ""}`}>
      {activeView === "calendar" ? <section className="shared-projects-calendar" aria-label={english ? "Project calendar" : "Календарь проекта"}>
        {snapshot.tasks.length >= 500 ? <p role="status">{english ? "This project has at least 500 tasks. The calendar may omit later tasks until full loading is available." : "В проекте не менее 500 задач. Календарь может не показывать задачи за пределами загруженной части."}</p> : null}
        <div className="shared-projects-calendar-head">
          <button type="button" aria-label={english ? "Previous month" : "Предыдущий месяц"} onClick={() => { const target = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1, 12); setCalendarMonth(target); setCalendarDay(localDateKey(target)); }}>←</button>
          <h2>{new Intl.DateTimeFormat(english ? "en-US" : "ru-RU", { month: "long", year: "numeric" }).format(calendarMonth)}</h2>
          <button type="button" aria-label={english ? "Next month" : "Следующий месяц"} onClick={() => { const target = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1, 12); setCalendarMonth(target); setCalendarDay(localDateKey(target)); }}>→</button>
        </div>
        <div className="shared-projects-calendar-grid">
          {(english ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]).map((day) => <span key={day} className="shared-projects-calendar-weekday">{day}</span>)}
          {calendarDays.map((date) => {
            const key = localDateKey(date);
            const count = snapshot.tasks.filter((task) => task.dueDate === key).length;
            return <button key={key} type="button" className="shared-projects-calendar-date"
              data-outside={date.getMonth() !== calendarMonth.getMonth() || undefined}
              aria-current={key === calendarDay ? "date" : undefined}
              aria-label={`${new Intl.DateTimeFormat(english ? "en-US" : "ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date)}${count ? english ? ` · ${count} tasks` : ` · задач: ${count}` : ""}`}
              onClick={() => { setCalendarDay(key); if (date.getMonth() !== calendarMonth.getMonth()) setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12)); }}>
              <span>{date.getDate()}</span>{count ? <small>{count}</small> : null}
            </button>;
          })}
        </div>
        <div className="shared-projects-calendar-agenda">
          <h3>{new Intl.DateTimeFormat(english ? "en-US" : "ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${calendarDay}T12:00:00`))}</h3>
          {calendarTasks.length ? calendarTasks.map((task) => <button key={task.id} type="button" onClick={() => openTask(task)}>
            <strong>{task.title}</strong><span>{statusLabel(snapshot.statuses.find((status) => status.id === task.statusId)?.title ?? "")}</span>
          </button>) : <p>{english ? "No team tasks due this day." : "На этот день нет общих задач со сроком."}</p>}
        </div>
        {snapshot.tasks.some((task) => !task.dueDate) ? <details className="shared-projects-calendar-undated"><summary>{english ? "Without a due date" : "Без срока"}</summary>
          {snapshot.tasks.filter((task) => !task.dueDate).map((task) => <button key={task.id} type="button" onClick={() => openTask(task)}>{task.title}</button>)}
        </details> : null}
      </section> : <div className={activeView === "board" ? "shared-projects-board" : "shared-projects-list"}>
        {snapshot.statuses.map((status) => <section key={status.id} className="shared-projects-column" aria-label={status.title}>
          <h2>{statusLabel(status.title)} <small>{snapshot.tasks.filter((task) => task.statusId === status.id).length}</small></h2>
          {snapshot.tasks.filter((task) => task.statusId === status.id).map((task) => <article key={task.id} className="shared-projects-task">
            <button type="button" className="shared-projects-task-open" onClick={() => openTask(task)} aria-pressed={taskId === task.id}>
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
      </div>}
      {selectedTask ? <section ref={taskDetailRef} className="shared-projects-detail" aria-label={english ? "Task details" : "Карточка задачи"}>
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
      </div>
    </> : !loading ? <section className="shared-projects-empty">
      <h2>{!spaces.length ? (english ? "Your team starts here" : "Начните общую работу") :
        (english ? "Choose or create a project" : "Выберите или создайте проект")}</h2>
      <p>{!spaces.length ? (english ? "Create a workspace, then invite people and add a project." : "Создайте пространство, затем добавьте проект и пригласите участников.") :
        (english ? "Projects in this workspace appear on the left." : "Проекты этого пространства появятся слева.")}</p>
    </section> : null}
    </main>
    </div>
    <dialog ref={createDialogRef} className="shared-projects-modal" aria-labelledby="shared-projects-modal-title"
      onClose={() => setCreateModal(null)}>
      {createModal ? <>
        <header><h2 id="shared-projects-modal-title">{({
          space: english ? "New workspace" : "Новое пространство",
          project: english ? "New shared project" : "Новый общий проект",
          task: english ? "New team task" : "Новая задача команды",
          status: english ? "New task list / board column" : "Новый список задач / колонка доски",
          category: english ? "New category" : "Новая категория",
          invite: english ? "Invite a participant" : "Пригласить участника",
        })[createModal]}</h2>
          <button type="button" className="shared-projects-close" onClick={() => setCreateModal(null)}
            aria-label={english ? "Close" : "Закрыть"}>×</button>
        </header>
        {createModal === "space" ? <form onSubmit={submitSpace}>
          <p>{english ? "A workspace brings your collaborators together." : "Пространство объединяет участников команды."}</p>
          <label>{english ? "Name" : "Название"}<input value={spaceTitle} maxLength={160} required onChange={(event) => setSpaceTitle(event.target.value)} /></label>
          <button type="submit" className="primary-button" disabled={busy}>{english ? "Create workspace" : "Создать пространство"}</button>
        </form> : null}
        {createModal === "project" ? <form onSubmit={submitProject}>
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
        </form> : null}
        {createModal === "task" && snapshot ? <form onSubmit={submitTask}>
          <label>{english ? "Name" : "Название"}<input maxLength={160} required value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} /></label>
          <label>{english ? "Description" : "Описание"}<textarea maxLength={20000} value={newTaskDescription} onChange={(event) => setNewTaskDescription(event.target.value)} /></label>
          <label>{english ? "Due date" : "Срок"}<input type="date" value={newTaskDueDate} onChange={(event) => setNewTaskDueDate(event.target.value)} /></label>
          <label>{english ? "Task list / status" : "Список задач / статус"}<select value={newTaskStatusId || snapshot.statuses[0]?.id || ""} onChange={(event) => setNewTaskStatusId(event.target.value)}>
            {snapshot.statuses.map((status) => <option key={status.id} value={status.id}>{statusLabel(status.title)}</option>)}
          </select></label>
          <label>{english ? "Category" : "Категория"}<select value={newTaskCategoryId} onChange={(event) => setNewTaskCategoryId(event.target.value)}>
            <option value="">{english ? "No category" : "Без категории"}</option>
            {snapshot.categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select></label>
          <label>{english ? "Assigned to" : "Исполнитель"}<select value={newTaskAssigneeId} onChange={(event) => setNewTaskAssigneeId(event.target.value)}>
            <option value="">{english ? "Unassigned" : "Не назначен"}</option>
            {snapshot.members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
          </select></label>
          <button type="submit" className="primary-button" disabled={busy || !snapshot.statuses.length}>{english ? "Create task" : "Создать задачу"}</button>
        </form> : null}
        {createModal === "status" ? <form onSubmit={submitStatus}>
          <label>{english ? "Name" : "Название"}<input value={newStatusTitle} maxLength={80} required onChange={(event) => setNewStatusTitle(event.target.value)} /></label>
          <label className="shared-projects-checkbox"><input type="checkbox" checked={newStatusDone} onChange={(event) => setNewStatusDone(event.target.checked)} />{english ? "Completion list" : "Список завершённых задач"}</label>
          <button type="submit" className="primary-button" disabled={busy}>{english ? "Create list" : "Создать список"}</button>
        </form> : null}
        {createModal === "category" ? <form onSubmit={submitCategory}>
          <label>{english ? "Name" : "Название"}<input value={newCategoryTitle} maxLength={80} required onChange={(event) => setNewCategoryTitle(event.target.value)} /></label>
          <label>{english ? "Color" : "Цвет"}<input type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} /></label>
          <button type="submit" className="primary-button" disabled={busy}>{english ? "Create category" : "Создать категорию"}</button>
        </form> : null}
        {createModal === "invite" ? <form onSubmit={submitInvite}>
          <label>Email<input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label>
          <label>{english ? "Role" : "Роль"}<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
            <option value="manager">{english ? "Manager" : "Менеджер"}</option><option value="member">{english ? "Member" : "Участник"}</option>
            <option value="commenter">{english ? "Commenter" : "Комментатор"}</option><option value="viewer">{english ? "Viewer" : "Читатель"}</option>
          </select></label>
          <button type="submit" className="primary-button" disabled={busy}>{english ? "Create invitation" : "Создать приглашение"}</button>
        </form> : null}
      </> : null}
    </dialog>
  </div>;
}
