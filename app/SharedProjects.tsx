/* eslint-disable @next/next/no-img-element -- User-provided board pictures remain native img elements. */
"use client";

import { type ReactNode, type FormEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  searchSharedAffairs, type SharedAffairSearch,
  loadSharedUiState, saveSharedUiState, listSharedInvitations, acceptSharedInvitation,
  rejectSharedInvitation, inviteSharedSpaceMember, type SharedInvitation, type SharedStatus,
  addSharedComment, changeSharedMemberRole, changeSharedSpaceRole,
  createSharedProject, createSharedStatus, createSharedCategory, deleteSharedCategory,
  deleteSharedStatus, deleteSharedTask, updateSharedCategory, updateSharedStatus,
  createSharedSpace, createSharedTask, listSharedComments, listSharedProjects,
  listArchivedSharedProjects, listSharedSpaces, loadSharedProject, removeSharedMember,
  loadSharedGoogleSettings, setSharedProjectArchived, syncSharedGoogle,
  updateSharedGoogleSettings, updateSharedProject, updateSharedTask, moveSharedTask,
  queuedSharedMutations, discardSharedMutation, sharedDataCameFromOfflineCache,
  type SharedComment, type SharedProject, type SharedProjectSnapshot,
  type SharedSpace, type SharedTask, type SharedGoogleSettings,
} from "./cloud-sync";
import "./shared-projects.css";
import "./shared-projects-layout.css";
import { ProjectsHeroMark } from "./ProjectsHeroMark";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { ActionNotice, useActionNotice } from "./ActionNotice";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { type CalendarMode, MONTHS, LUNAR_DECADES, ELEMENTS, formatCalendarDate, formatGregorian, getGregorianDate, getLunarDate, getLunarMonthDates, getSacredDate, getSacredDay, lunarMonthIndex } from "./calendar-data";
import { translateText } from "./i18n";

type Props = { userId: string; language: string; enabledCalendars: CalendarMode[] };

const splitTags = (value: string) => [...new Set(value.split(/[,;\s]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean))];

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sharedCalendarPeriod(anchor: Date, mode: CalendarMode, english: boolean) {
  if (mode === "sacred") {
    const sacred = getSacredDate(anchor);
    const start = getGregorianDate(sacred.sacredYear, sacred.monthIndex, 1);
    const next = sacred.monthIndex === 12
      ? getGregorianDate(sacred.sacredYear + 1, 0, 1)
      : getGregorianDate(sacred.sacredYear, sacred.monthIndex + 1, 1);
    const dates: Date[] = [];
    for (const date = new Date(start); date < next; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
    const previous = new Date(start); previous.setDate(previous.getDate() - 1);
    return { dates, previous, next, title: `${translateText(MONTHS[sacred.monthIndex].name, english ? "en" : "ru")} · ${sacred.sacredYear}–${sacred.sacredYear + 1}` };
  }
  if (mode === "lunar") {
    const index = lunarMonthIndex(anchor);
    const dates = getLunarMonthDates(index);
    const previousDates = getLunarMonthDates(index - 1);
    const nextDates = getLunarMonthDates(index + 1);
    const lunar = getLunarDate(dates[Math.floor(dates.length / 2)] ?? anchor);
    return { dates, previous: previousDates[0] ?? anchor, next: nextDates[0] ?? anchor,
      title: `${translateText(lunar.month.name, english ? "en" : "ru")} · ${lunar.year.sacredYear}–${lunar.year.sacredYear + 1}` };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1, 12);
  const previous = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1, 12);
  const dates: Date[] = [];
  for (const date = new Date(start); date < next; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
  return { dates, previous, next,
    title: new Intl.DateTimeFormat(english ? "en-US" : "ru-RU", { month: "long", year: "numeric" }).format(start) };
}

export function SharedProjects({ userId, language, enabledCalendars }: Props) {
  const english = language === "en";
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<SharedProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const projectIdRef = useRef(projectId);
  const spaceIdRef = useRef(spaceId);
  const [viewOverride, setViewOverride] = useState<"list" | "board" | "calendar" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [calendarDay, setCalendarDay] = useState(() => localDateKey(new Date()));
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("profane");
  const [snapshot, setSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [teamSnapshot, setTeamSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [uiReadySpace, setUiReadySpace] = useState("");
  const [invitations, setInvitations] = useState<SharedInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [createKind, setCreateKind] = useState<"project" | "task-list">("project");
  const [parentBoardId, setParentBoardId] = useState("");
  const [editingBoard, setEditingBoard] = useState<SharedStatus | null>(null);
  const [boardImage, setBoardImage] = useState("");
  const [completedPulse, setCompletedPulse] = useState(false);
  const { notice, announce } = useActionNotice();
  const uiSaveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [inboxPreview, setInboxPreview] = useState<SharedProjectSnapshot | null>(null);
  const [googleSettings, setGoogleSettings] = useState<SharedGoogleSettings | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleStatus, setGoogleStatus] = useState("");
  const [taskId, setTaskId] = useState("");
  const [comments, setComments] = useState<SharedComment[]>([]);
  const [spaceTitle, setSpaceTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SharedAffairSearch>({ projects: [], tasks: [] });
  const [searchBusy, setSearchBusy] = useState(false);
  const [projectTags, setProjectTags] = useState("");
  const [newTaskTags, setNewTaskTags] = useState("");
  const [editTaskTags, setEditTaskTags] = useState("");
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
  const [commentBody, setCommentBody] = useState("");
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskCategoryId, setEditTaskCategoryId] = useState("");
  const [editTaskRevision, setEditTaskRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [pendingCreates, setPendingCreates] = useState<Awaited<ReturnType<typeof queuedSharedMutations>>>([]);
  const [busy, setBusy] = useState(false);
  const pointerDrag = useRef<{ task: SharedTask; pointerId: number } | null>(null);
  const dropTargetRef = useRef<{ projectId: string; statusId: string; position: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ taskId: string; title: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ projectId: string; statusId: string; position: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const taskDetailRef = useRef<HTMLElement>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const [createModal, setCreateModal] = useState<"space" | "project" | "task" | "status" | "category" | "invite" | "join" | "settings" | "team" | "board" | null>(null);

  useEffect(() => {
    if (!spaceId) return;
    let live = true;
    void loadSharedUiState(spaceId).then((state) => {
      if (!live) return;
      setExpandedIds(state.expandedIds); setUiReadySpace(spaceId);
      setProjectId(state.expandedIds.at(-1) ?? "");
    }).catch((error: unknown) => {
      if (!live) return;
      setExpandedIds([]); setUiReadySpace(spaceId);
      setMessage(english ? "Could not load your saved layout. Try opening the workspace again."
        : "Не удалось загрузить сохранённый вид. Откройте пространство повторно.");
      console.error(error instanceof Error ? error.message : "Shared layout load failed");
    });
    return () => { live = false; };
  }, [spaceId, english]);

  const persistExpansion = (next: string[]) => {
    setExpandedIds(next);
    const target = spaceId;
    uiSaveQueue.current = uiSaveQueue.current.catch(() => undefined).then(() => saveSharedUiState(target, next))
      .catch(() => setMessage(english ? "Your layout was not saved. Check your connection."
        : "Положение разделов не сохранено. Проверьте подключение."));
  };
  const openJoin = () => {
    setCreateModal("join"); setInvitationsLoading(true);
    void listSharedInvitations().then(setInvitations).catch((error: unknown) => setMessage(String(error)))
      .finally(() => setInvitationsLoading(false));
  };

  useEffect(() => {
    if (!searchQuery.trim() || !spaceId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchBusy(true);
      void searchSharedAffairs(spaceId, searchQuery, controller.signal).then(setSearchResults)
        .catch((error: unknown) => { if (!controller.signal.aborted) setMessage(String(error)); })
        .finally(() => { if (!controller.signal.aborted) setSearchBusy(false); });
    }, 150);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [spaceId, searchQuery]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { spaceIdRef.current = spaceId; }, [spaceId]);
  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => { window.removeEventListener("offline", onOffline); window.removeEventListener("online", onOnline); };
  }, []);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (!projectId) { setPendingCreates([]); return; }
      void queuedSharedMutations(projectId).then((items) => { if (live) setPendingCreates(items); })
        .catch(() => { if (live) setPendingCreates([]); });
    };
    refresh();
    window.addEventListener("genesis-shared-offline-change", refresh);
    return () => { live = false; window.removeEventListener("genesis-shared-offline-change", refresh); };
  }, [projectId]);
  useEffect(() => {
    const stored = window.localStorage.getItem("genesis-shared-calendar-mode");
    if ((stored === "profane" || stored === "sacred" || stored === "lunar") && enabledCalendars.includes(stored)) {
      const timer = window.setTimeout(() => setCalendarMode(stored), 0);
      return () => window.clearTimeout(timer);
    }
  }, [enabledCalendars]);
  useEffect(() => {
    if (!enabledCalendars.includes(calendarMode)) {
      const timer = window.setTimeout(() => setCalendarMode(enabledCalendars[0] ?? "profane"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [calendarMode, enabledCalendars]);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) return;
    if (createModal && !dialog.open) dialog.showModal();
    if (!createModal && dialog.open) dialog.close();
  }, [createModal]);

  const refreshSpaces = useCallback(async () => {
    const items = await listSharedSpaces();
    if (sharedDataCameFromOfflineCache()) setOffline(true);
    setSpaces(items);
    setSpaceId((current) => items.some((item) => item.id === current) ? current : "");
  }, []);
  const refreshProjects = useCallback(async (id: string) => {
    const [items, archived] = await Promise.all([listSharedProjects(id), listArchivedSharedProjects(id)]);
    if (spaceIdRef.current !== id) return;
    setProjects((current) => JSON.stringify(current) === JSON.stringify(items) ? current : items);
    setArchivedProjects((current) => JSON.stringify(current) === JSON.stringify(archived) ? current : archived);
    if (!items.length) setSnapshot(null);
    setProjectId((current) => items.some((item) => item.id === current) ? current : "");
  }, []);
  const refreshProject = useCallback(async (id: string) => {
    const result = await loadSharedProject(id);
    if (projectIdRef.current !== id) return;
    if (sharedDataCameFromOfflineCache()) setOffline(true);
    setSnapshot((current) => JSON.stringify(current) === JSON.stringify(result) ? current : result);
    if (result.project.isInbox) setInboxPreview(result);
    setTaskId((current) => result.tasks.some((task) => task.id === current) ? current : "");
    if (!result.tasks.length) setComments([]);
  }, []);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      void refreshSpaces().catch((error: unknown) => {
        if (live) setMessage(error instanceof Error ? error.message : String(error));
      }).finally(() => { if (live) setLoading(false); });
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
    if (!projectId) return;
    let live = true;
    const initial = window.setTimeout(() => {
      setGoogleSettings(null); setGoogleStatus("");
      void loadSharedGoogleSettings(projectId).then((settings) => {
        if (live) setGoogleSettings(settings);
      }).catch((error: unknown) => {
        if (live) setGoogleStatus(error instanceof Error ? error.message : String(error));
      });
    }, 0);
    return () => { live = false; window.clearTimeout(initial); };
  }, [projectId]);
  useEffect(() => {
    if (!projectId || !googleSettings?.tasksEnabled && !googleSettings?.calendarEnabled) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void syncSharedGoogle(projectId).catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [projectId, googleSettings?.tasksEnabled, googleSettings?.calendarEnabled]);
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
    catch (error) { setMessage(error instanceof Error && error.message === "INVITEE_ACCOUNT_UNSUPPORTED"
      ? (english ? "This account cannot use shared projects." : "Этот аккаунт не может использовать общие проекты.")
      : error instanceof Error && error.message === "INVITEE_ACCOUNT_NOT_FOUND"
        ? (english ? "No GENESIS account was found for this email." : "Аккаунт GENESIS с такой почтой не найден.")
        : error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const changeGoogle = (field: "tasksEnabled" | "calendarEnabled", enabled: boolean) => {
    if (!googleSettings || !projectId || googleBusy) return;
    const target = projectId;
    setGoogleBusy(true); setGoogleStatus("");
    void updateSharedGoogleSettings(target, {
      tasksEnabled: field === "tasksEnabled" ? enabled : googleSettings.tasksEnabled,
      calendarEnabled: field === "calendarEnabled" ? enabled : googleSettings.calendarEnabled,
    }).then(async (settings) => {
      if (projectIdRef.current !== target) return;
      setGoogleSettings(settings);
      if (enabled) {
        const result = await syncSharedGoogle(target);
        setGoogleStatus(english ? `Google copies updated: ${result.synced}.` : `Копии Google обновлены: ${result.synced}.`);
      } else setGoogleStatus(english ? "Sync is off. Existing Google copies remain in your account."
        : "Синхронизация выключена. Созданные копии остаются в вашем Google-аккаунте.");
    }).catch((error: unknown) => {
      if (projectIdRef.current === target) setGoogleStatus(error instanceof Error ? error.message : String(error));
    })
      .finally(() => setGoogleBusy(false));
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
      await createSharedProject(spaceId, {
        title: projectTitle, description: projectDescription, tags: splitTags(projectTags), layout: createKind === "task-list" ? "list" : projectLayout,
        parentId: parentId || null, boardStatusId: parentBoardId || null, kind: createKind,
      });
      setProjectTitle(""); setProjectDescription(""); setProjectTags(""); setParentId("");
      await refreshProjects(spaceId);
      setProjectId(""); setSnapshot(null);
      setParentBoardId(""); setCreateKind("project");
      setCreateModal(null);
      setMessage(createKind === "task-list" ? (english ? "Task list created." : "Список задач создан.")
        : (english ? "Project created." : "Проект создан."));
    });
  };
  const submitTask = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot) return;
    void run(async () => {
      const created = await createSharedTask(snapshot.project.id, {
        title: newTaskTitle.trim(), description: newTaskDescription.trim(), tags: splitTags(newTaskTags),
        dueDate: newTaskDueDate || null,
        statusId: newTaskStatusId || snapshot.statuses[0].id,
        categoryId: newTaskCategoryId || null,
        assigneeId: newTaskAssigneeId || null,
      });
      setNewTaskTitle(""); setNewTaskDescription(""); setNewTaskTags(""); setNewTaskDueDate("");
      setNewTaskStatusId(""); setNewTaskCategoryId(""); setNewTaskAssigneeId("");
      if (!created.pending) await refreshProject(snapshot.project.id);
      setCreateModal(null);
      setMessage(created.pending
        ? (english ? "Task saved on this device. It will reach the team when the connection returns."
          : "Задача сохранена на устройстве и появится у команды после подключения к сети.")
        : (english ? "Task saved for the team." : "Задача сохранена для команды."));
    });
  };
  const moveTaskTo = (task: SharedTask, destinationProjectId: string, statusId = "", position = 0) => {
    if (!snapshot || busy) return;
    void run(async () => {
      const destination = destinationProjectId === snapshot.project.id
        ? snapshot : await loadSharedProject(destinationProjectId);
      const resolvedStatus = statusId || destination.statuses.find((item) => !item.isDone)?.id
        || destination.statuses[0]?.id;
      if (!resolvedStatus) throw new Error(english ? "The destination has no task list." : "В месте назначения нет списка задач.");
      const moved = await moveSharedTask(snapshot.project.id, task.id, {
        destinationProjectId, statusId: resolvedStatus, expectedRevision: task.revision,
        position: statusId ? position : destination.tasks.filter((item) => item.statusId === resolvedStatus).length,
      });
      if (moved.pending) {
        setMessage(english ? "Move saved on this device and waiting for the connection."
          : "Перенос сохранён на устройстве и ожидает подключения к сети.");
        return;
      }
      if (destinationProjectId !== snapshot.project.id) {
        setTaskId(task.id); setProjectId(destinationProjectId);
        await refreshProjects(spaceId);
        await refreshProject(destinationProjectId);
      } else await refreshProject(snapshot.project.id);
      setMessage(english ? "Task moved." : "Задача перемещена.");
    });
  };
  const moveTask = (task: SharedTask, statusId: string) => {
    if (!snapshot || task.statusId === statusId) return;
    moveTaskTo(task, snapshot.project.id, statusId,
      snapshot.tasks.filter((item) => item.statusId === statusId).length);
  };
  const dragStart = (event: ReactPointerEvent<HTMLButtonElement>, task: SharedTask) => {
    if (!snapshot?.project.canOrganizeTasks || busy) return;
    pointerDrag.current = { task, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragPreview({ taskId: task.id, title: task.title, x: event.clientX, y: event.clientY });
    event.preventDefault();
  };
  const dragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId || !snapshot) return;
    setDragPreview({ taskId: drag.task.id, title: drag.task.title, x: event.clientX, y: event.clientY });
    const below = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const column = below?.closest<HTMLElement>("[data-shared-drop-status]");
    if (column) {
      const statusId = column.dataset.sharedDropStatus ?? "";
      const hovered = below?.closest<HTMLElement>("[data-shared-task-id]");
      const tasks = snapshot.tasks.filter((task) => task.statusId === statusId && task.id !== drag.task.id);
      const index = hovered ? tasks.findIndex((task) => task.id === hovered.dataset.sharedTaskId) : -1;
      const before = hovered && event.clientY < hovered.getBoundingClientRect().top + hovered.getBoundingClientRect().height / 2;
      const target = { projectId: snapshot.project.id, statusId,
        position: index < 0 ? tasks.length : index + (before ? 0 : 1) };
      dropTargetRef.current = target;
      setDropTarget(target);
      return;
    }
    const project = below?.closest<HTMLElement>("[data-shared-drop-project]");
    const target = project ? { projectId: project.dataset.sharedDropProject ?? "", statusId: "", position: 0 } : null;
    dropTargetRef.current = target;
    setDropTarget(target);
  };
  const dragEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pointerDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragPreview(null);
    const target = dropTargetRef.current;
    dropTargetRef.current = null;
    setDropTarget(null);
    if (target?.projectId && (target.projectId !== drag.task.projectId
        || target.statusId && (target.statusId !== drag.task.statusId || target.position !== drag.task.position))) {
      moveTaskTo(drag.task, target.projectId, target.statusId, target.position);
    }
  };
  const dragCancel = () => { pointerDrag.current = null; dropTargetRef.current = null; setDragPreview(null); setDropTarget(null); };
  const assignTask = (task: SharedTask, assigneeId: string) => {
    if (!snapshot) return;
    void run(async () => {
      const changed = await updateSharedTask(snapshot.project.id, task.id, {
        assigneeId: assigneeId || null, expectedRevision: task.revision,
      });
      if (changed.pending) setMessage(english ? "Change saved on this device."
        : "Изменение сохранено на устройстве и ожидает подключения к сети.");
      else await refreshProject(snapshot.project.id);
    });
  };
  const submitInvite = (event: FormEvent) => {
    event.preventDefault(); if (!spaceId) return;
    void run(async () => {
      await inviteSharedSpaceMember(spaceId, inviteEmail, inviteRole === "viewer" ? "guest" : "member");
      setInviteEmail(""); setCreateModal(null);
      setMessage(english ? "Invitation is available in the recipient's GENESIS account." : "Приглашение появится в личном кабинете получателя GENESIS.");
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
        title: editTaskTitle.trim(), description: editTaskDescription.trim(), tags: splitTags(editTaskTags),
        dueDate: editTaskDueDate || null, categoryId: editTaskCategoryId || null,
        expectedRevision: editTaskRevision,
      });
      setEditTaskRevision(changed.revision);
      if (!changed.pending) await refreshProject(snapshot.project.id);
      setMessage(changed.pending
        ? (english ? "Change saved on this device and waiting for the connection."
          : "Изменение сохранено на устройстве и ожидает подключения к сети.")
        : (english ? "Task saved." : "Задача сохранена."));
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
        description: String(fields.get("description") ?? ""), tags: splitTags(String(fields.get("tags") ?? "")),
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
    if (!snapshot) return;
    void run(async () => {
      const current = snapshot.project;
      await setSharedProjectArchived(current.id, true);
      setCompletedPulse(true); setMessage(english ? "Project completed" : "Проект завершён");
      announce(english ? "Project completed" : "Проект завершён");
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      setCompletedPulse(false);
      persistExpansion(expandedIds.filter((id) => id !== current.id));
      setSnapshot(null); setTaskId("");
      await refreshProjects(current.spaceId);
      setMessage(english ? "Project completed" : "Проект завершён");
    });
  };
  const restoreProject = (id: string) => {
    if (!spaceId) return;
    void run(async () => {
      await setSharedProjectArchived(id, false);
      await refreshProjects(spaceId);
      setProjectId(id);
      persistExpansion([...new Set([...expandedIds, id])]);
      setMessage(english ? "Project restored." : "Проект восстановлен.");
    });
  };
  const setMemberRole = (memberId: string, role: string) => {
    if (!teamSnapshot) return;
    void run(async () => {
      await changeSharedMemberRole(teamSnapshot.project.id, memberId, role);
      setTeamSnapshot(await loadSharedProject(teamSnapshot.project.id));
    });
  };
  const setSpaceRole = (memberId: string, role: string) => {
    if (!teamSnapshot) return;
    void run(async () => {
      await changeSharedSpaceRole(teamSnapshot.project.spaceId, memberId, role);
      setTeamSnapshot(await loadSharedProject(teamSnapshot.project.id));
      await refreshProjects(teamSnapshot.project.spaceId);
    });
  };
  const setOrganizerAccess = (memberId: string, role: string, enabled: boolean) => {
    if (!teamSnapshot) return;
    void run(async () => {
      await changeSharedSpaceRole(teamSnapshot.project.spaceId, memberId, role, enabled);
      setTeamSnapshot(await loadSharedProject(teamSnapshot.project.id));
    });
  };
  const removeMember = (memberId: string) => {
    if (!teamSnapshot || !window.confirm(english ? "Remove this participant?" : "Удалить этого участника?")) return;
    void run(async () => {
      await removeSharedMember(teamSnapshot.project.id, memberId);
      setTeamSnapshot(await loadSharedProject(teamSnapshot.project.id));
    });
  };
  const roleLabel = (role: string) => ({
    owner: english ? "Owner" : "Владелец", manager: english ? "Manager" : "Менеджер",
    member: english ? "Member" : "Участник", commenter: english ? "Commenter" : "Комментатор",
    viewer: english ? "Viewer" : "Читатель", admin: english ? "Admin" : "Администратор",
    guest: english ? "Guest" : "Гость",
  })[role as "owner" | "manager" | "member" | "commenter" | "viewer" | "admin" | "guest"] ?? role;
  const selectedTask = snapshot?.tasks.find((task) => task.id === taskId);
  const selectProject = (project: SharedProject) => {
    const expanded = expandedIds.includes(project.id);
    const collapse = expanded && projectId === project.id;
    const next = collapse ? expandedIds.filter((id) => id !== project.id) : [...new Set([...expandedIds, project.id])];
    persistExpansion(next);
    setProjectId(collapse ? "" : project.id);
    setSnapshot(null); setTaskId(""); setComments([]); setViewOverride(null);
  };
  const renderProjectTree = (parent: string | null, ancestors = new Set<string>()): ReactNode => {
    return projects.filter((project) => !project.isInbox && !ancestors.has(project.id) && (project.parentId === parent
      || parent === null && project.parentId && !projects.some((item) => item.id === project.parentId)))
      .map((project) => <div key={project.id} className="shared-tree-branch">
        <button type="button" className="shared-projects-project-link" aria-expanded={expandedIds.includes(project.id)}
          data-shared-drop-project={project.id} aria-current={projectId === project.id ? "page" : undefined}
          onClick={() => selectProject(project)}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={expandedIds.includes(project.id) ? "is-expanded" : ""}><path d="m7 4 6 6-6 6"/></svg>
          <span>{project.title}<small>{project.kind === "task-list" ? (english ? "Task list" : "Список задач") : project.layout === "board" ? (english ? "Boards" : "Доски") : (english ? "Project" : "Проект")} · {project.taskCount ?? 0}</small></span>
        </button>
        {expandedIds.includes(project.id) ? <div className="shared-tree-children">{renderProjectTree(project.id, new Set([...ancestors, project.id]))}</div> : null}
      </div>);
  };
  const openBoardSettings = (status: SharedStatus) => {
    setEditingBoard(status); setBoardImage(status.imageUrl ?? ""); setCreateModal("board");
  };
  const placeContainer = (child: SharedProject, statusId: string) => void run(async () => {
    await updateSharedProject(child.id, { title: child.title, description: child.description, tags: child.tags,
      layout: child.layout, parentId: projectId, boardStatusId: statusId || null, expectedRevision: child.revision });
    await refreshProjects(spaceId);
  });
  const inboxProject = projects.find((project) => Boolean(project.isInbox));
  const inboxProjectId = inboxProject?.id;
  useEffect(() => {
    if (!inboxProjectId || uiReadySpace !== spaceId) return;
    const timer = window.setTimeout(() => setInboxExpanded(expandedIds.includes(inboxProjectId)), 0);
    return () => window.clearTimeout(timer);
  }, [expandedIds, inboxProjectId, uiReadySpace, spaceId]);
  useEffect(() => {
    if (!inboxExpanded || !inboxProjectId) return;
    let live = true;
    const refresh = () => void loadSharedProject(inboxProjectId).then((result) => {
      if (live) setInboxPreview(result);
    }).catch((error: unknown) => {
      if (live) setMessage(error instanceof Error ? error.message : String(error));
    });
    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [inboxExpanded, inboxProjectId]);
  const activeView = viewOverride ?? snapshot?.project.layout ?? "list";
  const calendarPeriod = sharedCalendarPeriod(calendarMonth, calendarMode, english);
  const calendarOffset = calendarPeriod.dates.length ? (calendarPeriod.dates[0].getDay() + 6) % 7 : 0;
  const calendarDays = [
    ...Array.from({ length: calendarOffset }, () => null),
    ...calendarPeriod.dates,
  ];
  const calendarTasks = snapshot?.tasks.filter((task) => task.dueDate === calendarDay) ?? [];
  const openTask = (task: SharedTask) => {
    setTaskId(task.id); setComments([]);
    setEditTaskTitle(task.title); setEditTaskDescription(task.description); setEditTaskTags((task.tags ?? []).join(", "));
    setEditTaskDueDate(task.dueDate ?? ""); setEditTaskCategoryId(task.categoryId ?? "");
    setEditTaskRevision(task.revision);
  };
  const canWrite = snapshot && ["owner", "manager", "member"].includes(snapshot.project.role);
  const canComment = snapshot && ["owner", "manager", "member", "commenter"].includes(snapshot.project.role);
  const canInvite = snapshot && ["owner", "manager"].includes(snapshot.project.role);
  const renderCalendarDate = (date: Date) => {
    const key = localDateKey(date);
    const count = snapshot?.tasks.filter((task) => task.dueDate === key).length ?? 0;
    const dayNumber = calendarMode === "sacred" ? getSacredDate(date).day
      : calendarMode === "lunar" ? getLunarDate(date).day : date.getDate();
    return <button key={key} type="button" className="shared-projects-calendar-date"
      aria-current={key === calendarDay ? "date" : undefined}
      aria-label={`${formatCalendarDate(date, calendarMode, true)}${count ? english ? ` · ${count} tasks` : ` · задач: ${count}` : ""}`}
      onClick={() => setCalendarDay(key)}>
      <span>{dayNumber}</span>
      {calendarMode !== "profane" ? <time dateTime={key}>{formatGregorian(date)}</time> : null}
      {count ? <small>{count}</small> : null}
    </button>;
  };

  return <div className="shared-projects" data-exp-layout="view">
    <WorkspaceHeader title={english ? "Affairs · shared" : "Дела · общие"}
      mark={<ProjectsHeroMark shared />} description={english
        ? "Plan together while keeping personal tasks, habits and calendars private."
        : "Планируйте вместе. Личные задачи, привычки и календарь остаются вашими."} />
    <ActionNotice message={notice}/>
    {message ? <p className="shared-projects-message" role="status">{message}</p> : null}
    {offline ? <p className="shared-projects-offline-status" role="status">{english
      ? "Offline: showing the last protected team snapshot. Changes may be out of date."
      : "Нет связи: показана последняя защищённая копия команды. Данные могут устареть."}</p> : null}
    {pendingCreates.length ? <section className="shared-projects-pending" aria-label={english ? "Pending team tasks" : "Задачи в очереди отправки"}>
      <strong>{english ? "Waiting to send" : "Ожидают отправки"} · {pendingCreates.length}</strong>
      {pendingCreates.map((item) => <div className="shared-projects-pending-item" key={item.requestId}>
        <p>{item.kind === "move" ? (english ? "Move" : "Перенос")
          : item.kind === "update" ? (english ? "Edit" : "Изменение")
            : (english ? "New task" : "Новая задача")}: {item.title}{item.error
          ? ` · ${english ? "Needs attention" : "Нужна проверка"}: ${item.error}` : ""}</p>
        {item.error && item.draft ? <details><summary>{english ? "View saved draft" : "Посмотреть сохранённый черновик"}</summary>
          <pre>{item.draft}</pre><button type="button" onClick={() => {
            if (!window.confirm(english
              ? "Remove this local draft? This will not undo any change already on the server."
              : "Удалить этот локальный черновик? Уже внесённые на сервере изменения останутся.")) return;
            void discardSharedMutation(item.requestId).catch((error) => setMessage(String(error)));
          }}>{english ? "Remove local draft" : "Удалить локальный черновик"}</button></details> : null}
      </div>)}
    </section> : null}
    {loading ? <p role="status">{english ? "Loading projects…" : "Загружаем проекты…"}</p> : null}

    {spaceId ? <label className="tag-search"><span aria-hidden="true">⌕</span><input aria-label={english ? "Find tasks and projects by title or tag" : "Поиск задач и проектов по названию или #тегу"} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchBusy(Boolean(event.target.value.trim())); setSearchResults({ projects: [], tasks: [] }); }} placeholder={english ? "Find tasks and projects by title or #tag" : "Поиск задач и проектов по названию или #тегу"} /></label> : null}
    {searchQuery.trim() ? <section className="tag-search-results" aria-label="Результаты поиска дел" aria-live="polite" aria-busy={searchBusy}>
      <header><strong>{english ? "Search results" : "Результаты поиска"}</strong><span>{searchResults.projects.length} проектов · {searchResults.tasks.length} задач</span></header>
      <div>{searchResults.projects.filter((project) => !project.isInbox).map((project) => <button type="button" key={project.id} onClick={() => { setSearchQuery(""); setProjectId(project.id); setSnapshot(null); }}><span>Проект</span><strong>{project.title}</strong><small>{project.tags?.map((tag) => `#${tag}`).join(" ")}</small></button>)}
        {searchResults.tasks.map((task) => <button type="button" key={task.id} onClick={() => void run(async () => {
          const result = await loadSharedProject(task.projectId);
          const found = result.tasks.find((item) => item.id === task.id);
          setSearchQuery(""); setProjectId(task.projectId); setSnapshot(result); setViewOverride("list");
          if (found) openTask(found);
        })}><span>Задача · {task.projectTitle}</span><strong>{task.title}</strong><small>{task.tags.map((tag) => `#${tag}`).join(" ")}</small></button>)}</div>
      {!searchBusy && !searchResults.projects.length && !searchResults.tasks.length ? <p>{english ? "No matches" : "Совпадений нет"}</p> : null}
    </section> : null}
    {!spaceId ? <section className="shared-space-entry" aria-label={english ? "Shared workspaces" : "Общие пространства"}>
      {loading ? <p role="status">{english ? "Loading…" : "Загрузка…"}</p> : <>
        {spaces.length ? <div className="shared-space-list">{spaces.map((space) => <button type="button" key={space.id}
          onClick={() => { setSpaceId(space.id); setProjectId(""); setSnapshot(null); }}>
          <strong>{space.title}</strong><span>{roleLabel(space.role)}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
        </button>)}</div> : null}
        <div className="shared-space-entry-actions">
          <button type="button" className="primary-button" onClick={() => setCreateModal("space")}>{english ? "Create workspace" : "Создать пространство"}</button>
          <button type="button" className="secondary-button" onClick={openJoin}>{english ? "Join workspace" : "Присоединиться к пространству"}</button>
        </div>
      </>}
    </section> : null}
    <div className="shared-projects-shell" hidden={!spaceId}>
    <aside className="shared-projects-sidebar" aria-label={english ? "Shared project navigation" : "Навигация по общим проектам"}>
      <button type="button" className="secondary-button" onClick={() => { setSpaceId(""); setProjectId(""); setSnapshot(null); }}>{english ? "All workspaces" : "Все пространства"}</button>
      <label className="shared-projects-space-picker">{english ? "Workspace" : "Пространство"}<select value={spaceId} onChange={(event) => { setSpaceId(event.target.value); setSnapshot(null); setProjectId(""); setTaskId(""); setComments([]); }} disabled={!spaces.length}>
        {!spaces.length ? <option value="">{english ? "No workspaces" : "Нет пространств"}</option> : null}
        {spaces.map((space) => <option key={space.id} value={space.id}>{space.title}</option>)}
      </select></label>
      {inboxProject ? <section className="shared-projects-inbox-card"
        data-shared-drop-project={inboxProject.id}
        data-drop-active={dropTarget?.projectId === inboxProject.id && !dropTarget.statusId || undefined}
        aria-label={english ? "Shared inbox" : "Хаос-бокс"}>
        <div className="shared-projects-inbox-heading"><div>
          <h2>{english ? "Shared inbox" : "Хаос-бокс"}</h2>
          <p>{english ? "Unsorted tasks in this workspace" : "Задачи без проекта в этом пространстве"}</p>
        </div><strong>{inboxProject.taskCount ?? 0}</strong></div>
        <button type="button" className="shared-projects-inbox-toggle" aria-expanded={inboxExpanded}
          onClick={() => { const open = !inboxExpanded; setInboxExpanded(open);
            persistExpansion(open ? [...new Set([...expandedIds, inboxProject.id])] : expandedIds.filter((id) => id !== inboxProject.id)); }}>
          {inboxExpanded ? (english ? "Collapse" : "Свернуть") : (english ? "Open" : "Открыть")}
        </button>
        {inboxExpanded ? <div className="shared-projects-inbox-items">
          {!inboxPreview ? <p role="status">{english ? "Loading tasks…" : "Загружаем задачи…"}</p>
            : inboxPreview.tasks.length ? inboxPreview.tasks.map((task) => <button key={task.id} type="button"
              onClick={() => { setProjectId(inboxProject.id); setSnapshot(inboxPreview); setViewOverride(null); openTask(task); }}>
              <strong>{task.title}</strong>{task.tags?.length ? <em>{task.tags.map((tag) => `#${tag}`).join(" ")}</em> : null}<small>{task.dueDate ? formatCalendarDate(new Date(`${task.dueDate}T12:00:00`), calendarMode)
                : (english ? "No due date" : "Без срока")}</small>
            </button>) : <p>{english ? "No unsorted tasks yet." : "Задач без проекта пока нет."}</p>}
          {["owner", "manager", "member"].includes(inboxProject.role) ? <button type="button"
            className="shared-projects-inbox-create" disabled={busy} onClick={() => void run(async () => {
              const inbox = await loadSharedProject(inboxProject.id);
              setProjectId(inboxProject.id); setSnapshot(inbox); setInboxPreview(inbox); setViewOverride(null);
              setNewTaskStatusId(inbox.statuses[0]?.id ?? "");
              setNewTaskCategoryId(""); setNewTaskAssigneeId(""); setCreateModal("task");
            })}>{english ? "Create task" : "Создать задачу"}</button> : null}
        </div> : null}
      </section> : null}
      <nav className="shared-projects-project-nav" aria-label={english ? "Projects in workspace" : "Проекты пространства"}>
        <h2>{english ? "Projects" : "Проекты"}</h2>
        {uiReadySpace === spaceId ? renderProjectTree(null) : <p role="status">{english ? "Loading your layout…" : "Загружаем ваш вид…"}</p>}
      </nav>

    <button type="button" className="shared-projects-open-modal" onClick={() => setCreateModal("space")}>
      {spaces.length ? (english ? "Create another workspace" : "Создать ещё пространство") : (english ? "Create a workspace" : "Создать пространство")}
    </button>
    {spaceId ? <button type="button" className="shared-projects-open-modal" onClick={() => { setCreateKind("project"); setParentId(""); setParentBoardId(""); setCreateModal("project"); }}>
      {english ? "Create a shared project" : "Создать общий проект"}
    </button> : null}
    {spaceId && ["owner", "admin"].includes(spaces.find((space) => space.id === spaceId)?.role ?? "") ? <button type="button" className="secondary-button" onClick={() => void run(async () => {
      if (inboxProject) { setTeamSnapshot(await loadSharedProject(inboxProject.id)); }
      setCreateModal("team");
    })}>{english ? "Team and invitations" : "Команда и приглашения"}</button> : null}
    {archivedProjects.length ? <details className="shared-projects-create">
      <summary>{english ? "Completed projects" : "Завершённые"} · {archivedProjects.length}</summary>
      <div className="shared-projects-members">{archivedProjects.map((project) => <div key={project.id} className="shared-projects-member">
        <span>{project.title}</span>
        {project.role === "owner" ? <button type="button" disabled={busy} onClick={() => restoreProject(project.id)}>{english ? "Restore" : "Восстановить"}</button> : null}
      </div>)}</div>
    </details> : null}
    </aside>

    <main className="shared-projects-main">

    {snapshot && snapshot.project.id === projectId ? <>
      <header className="shared-projects-context">
        <div>
          <h2>{snapshot.project.isInbox ? (english ? "Team tasks" : "Задачи команды") : snapshot.project.title}</h2>
          {!snapshot.project.isInbox && snapshot.project.role === "owner" ? <button type="button" className={`project-complete-action${completedPulse ? " is-completing" : ""}`} disabled={busy} onClick={archiveProject} aria-label={english ? `Complete project “${snapshot.project.title}”` : `Завершить проект «${snapshot.project.title}»`}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/></svg><span className="completion-action-label">{english ? "Complete" : "Завершить"}</span></button> : null}
          {!snapshot.project.isInbox && snapshot.project.description ? <p>{snapshot.project.description}</p> : null}
        </div>
        <div className="shared-projects-meta"><span>{english ? "Your role" : "Ваша роль"}: {roleLabel(snapshot.project.role)}</span><span>{snapshot.members.length} {english ? "members" : "участников"}</span></div>
      </header>
      <div className="shared-context-actions">
        {canInvite && !snapshot.project.isInbox ? <button type="button" className="secondary-button" onClick={() => setCreateModal("settings")}>{english ? "Project settings" : "Настройки проекта"}</button> : null}
        <button type="button" className="secondary-button" onClick={() => { setTeamSnapshot(snapshot); setCreateModal("team"); }}>{english ? "Team" : "Команда"}</button>
      </div>
      <section className="shared-projects-planning" aria-label={english ? "Tasks and views" : "Задачи и виды проекта"}>
        <h3>{english ? "Tasks" : "Задачи проекта"}</h3>
      {canWrite ? <div className="shared-projects-create-actions">
        <button type="button" className="shared-projects-open-modal" onClick={() => {
          setNewTaskStatusId(snapshot.statuses[0]?.id ?? "");
          setNewTaskCategoryId(""); setNewTaskAssigneeId(""); setCreateModal("task");
        }}>
          {english ? "Create task" : "Создать задачу"}
        </button>
      </div> : null}
      <div className="shared-projects-view-switch" role="group" aria-label={english ? "Project view" : "Вид проекта"}>
        {(["list", "board", "calendar"] as const).map((item) => <button key={item} type="button"
          aria-pressed={activeView === item} onClick={() => setViewOverride(item)}>{item === "list"
            ? (english ? "List" : "Список") : item === "board" ? (english ? "Boards" : "Доски")
              : (english ? "Calendar" : "Календарь")}</button>)}
      </div>
      <p className="shared-projects-calendar-mode-label">{english ? "Calendar for project view and task dates" : "Календарь проекта и дат задач"}</p>
      <div className="shared-projects-calendar-mode" role="group" aria-label={english ? "Calendar for project view and task dates" : "Календарь проекта и дат задач"}>
        {(["profane", "sacred", "lunar"] as const).filter((mode) => enabledCalendars.includes(mode)).map((mode) => <button key={mode} type="button"
          aria-pressed={calendarMode === mode} onClick={() => {
            setCalendarMode(mode);
            setCalendarMonth(new Date(`${calendarDay}T12:00:00`));
            window.localStorage.setItem("genesis-shared-calendar-mode", mode);
          }}>{mode === "profane" ? (english ? "Gregorian" : "Григорианский")
            : mode === "sacred" ? (english ? "Sacred" : "Сакральный") : (english ? "Lunar" : "Лунный")}</button>)}
      </div>
      {activeView === "board" ? <p className="shared-projects-board-hint">{english
        ? "Swipe across the board to view all statuses."
        : "Проведите по доске, чтобы увидеть все статусы."}</p> : null}
      </section>
      <div className={`shared-projects-workspace${selectedTask ? " shared-projects-workspace-with-detail" : ""}`}>
      {activeView === "calendar" ? <section className="shared-projects-calendar" aria-label={english ? "Project calendar" : "Календарь проекта"}>
        {snapshot.tasks.length >= 500 ? <p role="status">{english ? "This project has at least 500 tasks. The calendar may omit later tasks until full loading is available." : "В проекте не менее 500 задач. Календарь может не показывать задачи за пределами загруженной части."}</p> : null}
        <div className="shared-projects-calendar-head">
          <button type="button" aria-label={english ? "Previous month" : "Предыдущий месяц"} onClick={() => { setCalendarMonth(calendarPeriod.previous); setCalendarDay(localDateKey(calendarPeriod.previous)); }}>←</button>
          <h2>{calendarPeriod.title}</h2>
          <button type="button" aria-label={english ? "Next month" : "Следующий месяц"} onClick={() => { setCalendarMonth(calendarPeriod.next); setCalendarDay(localDateKey(calendarPeriod.next)); }}>→</button>
        </div>
        {calendarMode === "profane" ? <div className="shared-projects-calendar-grid">
          {(english ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]).map((day) => <span key={day} className="shared-projects-calendar-weekday">{day}</span>)}
          {calendarDays.map((date, index) => {
            if (!date) return <span key={`space-${index}`} aria-hidden="true" />;
            return renderCalendarDate(date);
          })}
        </div> : calendarMode === "sacred" ? <div className="shared-projects-calendar-cycles mode-sacred">
          {getSacredDate(calendarPeriod.dates[0]).monthIndex !== 12 ? <div className="shared-projects-calendar-elements" aria-hidden="true">
            {ELEMENTS.map((element) => <span key={element.name}>{translateText(element.name, english ? "en" : "ru")}</span>)}
          </div> : null}
          {Array.from(new Set(calendarPeriod.dates.map((date) => {
            const sacred = getSacredDate(date);
            return getSacredDay(sacred.monthIndex, sacred.day).pyata;
          }))).map((pyata) => {
            const dates = calendarPeriod.dates.filter((date) => {
              const sacred = getSacredDate(date);
              return getSacredDay(sacred.monthIndex, sacred.day).pyata === pyata;
            });
            const sacred = getSacredDate(dates[0]);
            const firstDay = getSacredDay(sacred.monthIndex, sacred.day);
            return <section className="shared-projects-calendar-cycle" key={pyata} aria-label={pyata ? `${english ? "Quinta" : "Пята"} ${pyata}` : english ? "Apeiron" : "Апейрон"}>
              <header><strong>{pyata ? `${english ? "Quinta" : "Пята"} ${pyata}` : english ? "Outside time" : "Вне времени"}</strong>
                <span>{translateText(firstDay.pyataTitle || "Апейрон", english ? "en" : "ru")}</span></header>
              <div className="shared-projects-cycle-days">{dates.map(renderCalendarDate)}</div>
            </section>;
          })}
        </div> : <div className="shared-projects-calendar-cycles mode-lunar">
          {LUNAR_DECADES.map((decade) => <section className="shared-projects-calendar-cycle" key={decade.id}
            aria-label={translateText(decade.name, english ? "en" : "ru")}>
            <header><strong>{translateText(decade.name, english ? "en" : "ru")}</strong><span>{translateText(decade.range, english ? "en" : "ru")}</span></header>
            <div className="shared-projects-cycle-days">{calendarPeriod.dates.filter((date) => getLunarDate(date).decade.id === decade.id).map(renderCalendarDate)}</div>
          </section>)}
        </div>}
        <div className="shared-projects-calendar-agenda">
          <h3>{formatCalendarDate(new Date(`${calendarDay}T12:00:00`), calendarMode, true)}</h3>
          {calendarTasks.length ? calendarTasks.map((task) => <button key={task.id} type="button" onClick={() => openTask(task)}>
            <strong>{task.title}</strong><span>{statusLabel(snapshot.statuses.find((status) => status.id === task.statusId)?.title ?? "")}</span>
          </button>) : <p>{english ? "No team tasks due this day." : "На этот день нет общих задач со сроком."}</p>}
        </div>
        {snapshot.tasks.some((task) => !task.dueDate) ? <details className="shared-projects-calendar-undated"><summary>{english ? "Without a due date" : "Без срока"}</summary>
          {snapshot.tasks.filter((task) => !task.dueDate).map((task) => <button key={task.id} type="button" onClick={() => openTask(task)}>{task.title}</button>)}
        </details> : null}
      </section> : <div className={activeView === "board" ? "shared-projects-board" : "shared-projects-list"}>
        {snapshot.statuses.map((status) => <section key={status.id} className="shared-projects-column"
          data-shared-drop-status={status.id}
          data-drop-active={dropTarget?.statusId === status.id || undefined}
          aria-label={status.title}>
          <header className="shared-board-header" style={{ borderColor: status.color ?? "#2d6c68" }}>
            <h2>{statusLabel(status.title)} <small>{snapshot.tasks.filter((task) => task.statusId === status.id).length}</small></h2>
            {canInvite ? <button type="button" className="shared-board-settings" aria-label={english ? `Settings for ${status.title}` : `Настройки доски «${status.title}»`} onClick={() => openBoardSettings(status)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2"/><circle cx="12" cy="12" r="5"/></svg>
            </button> : null}
          </header>
          {status.imageUrl ? <img className="shared-board-image" src={status.imageUrl} alt={status.title} /> : null}
          {projects.filter((child) => child.parentId === snapshot.project.id && (child.boardStatusId === status.id
            || !child.boardStatusId && status.id === snapshot.statuses[0]?.id)).map((child) => <article className="shared-board-container" key={child.id}>
            <button type="button" onClick={() => { setProjectId(child.id); setSnapshot(null); persistExpansion([...new Set([...expandedIds, child.id])]); }}>
              <small>{child.kind === "task-list" ? (english ? "Task list" : "Список задач") : (english ? "Project" : "Проект")}</small>
              <strong>{child.title}</strong><span>{child.taskCount ?? 0} {english ? "tasks" : "задач"}</span>
            </button>
            {["owner", "manager"].includes(child.role) ? <label>{english ? "Boards" : "Доски"}<select value={child.boardStatusId ?? snapshot.statuses[0]?.id} onChange={(event) => placeContainer(child, event.target.value)}>
              {snapshot.statuses.map((board) => <option key={board.id} value={board.id}>{statusLabel(board.title)}</option>)}
            </select></label> : null}
          </article>)}
          {canWrite ? <div className="shared-board-add-containers">
            {(["project", "task-list"] as const).map((kind) => <button type="button" key={kind} onClick={() => {
              setCreateKind(kind); setParentId(snapshot.project.id); setParentBoardId(status.id); setCreateModal("project");
            }}>{kind === "project" ? (english ? "Add project" : "Добавить проект") : (english ? "Add task list" : "Добавить список задач")}</button>)}
          </div> : null}
          {snapshot.tasks.filter((task) => task.statusId === status.id).map((task) => <article key={task.id}
            className="shared-projects-task" data-shared-task-id={task.id}
            data-dragging={dragPreview?.taskId === task.id || undefined}>
            {snapshot.project.canOrganizeTasks ? <button type="button" className="shared-projects-drag-handle"
              aria-label={english ? `Drag ${task.title} to another list or project` : `Перетащить задачу «${task.title}» в другой список или проект`}
              onPointerDown={(event) => dragStart(event, task)} onPointerMove={dragMove}
              onPointerUp={dragEnd} onPointerCancel={dragCancel}>
              <svg viewBox="0 0 20 24" width="17" height="20" fill="currentColor" aria-hidden="true">
                <circle cx="6" cy="5" r="1.6"/><circle cx="14" cy="5" r="1.6"/>
                <circle cx="6" cy="12" r="1.6"/><circle cx="14" cy="12" r="1.6"/>
                <circle cx="6" cy="19" r="1.6"/><circle cx="14" cy="19" r="1.6"/>
              </svg>
            </button> : null}
            <button type="button" className="shared-projects-task-open" onClick={() => openTask(task)} aria-pressed={taskId === task.id}>
              <strong>{task.title}</strong>{task.tags?.length ? <em>{task.tags.map((tag) => `#${tag}`).join(" ")}</em> : null}<small>{task.dueDate ? formatCalendarDate(new Date(`${task.dueDate}T12:00:00`), calendarMode) : (english ? "No due date" : "Без срока")}</small>
            </button>
            {snapshot.categories.find((category) => category.id === task.categoryId) ? <small className="shared-projects-category-tag">
              <i style={{ background: snapshot.categories.find((category) => category.id === task.categoryId)?.color }} />
              {snapshot.categories.find((category) => category.id === task.categoryId)?.title}</small> : null}
            {task.completedBy ? <small>{english ? "Completed by" : "Выполнил(а)"}: {snapshot.members.find((member) => member.userId === task.completedBy)?.displayName ?? (english ? "Former member" : "Бывший участник")}</small> : null}
            {activeView !== "board" && snapshot.project.canOrganizeTasks ? <label>{english ? "Move to" : "Статус"}<select value={task.statusId} disabled={busy} onChange={(event) => moveTask(task, event.target.value)}>
              {snapshot.statuses.map((item) => <option key={item.id} value={item.id}>{statusLabel(item.title)}</option>)}
            </select></label> : null}
          </article>)}
          {!snapshot.tasks.some((task) => task.statusId === status.id) ? <p className="shared-projects-column-empty">
            {english ? "No tasks here yet" : "Здесь пока нет задач"}</p> : null}
          {canWrite ? <button type="button" className="shared-projects-column-add" onClick={() => {
            setNewTaskStatusId(status.id); setNewTaskCategoryId(""); setNewTaskAssigneeId(""); setCreateModal("task");
          }}>{english ? "+ Add task" : "+ Добавить задачу"}</button> : null}
        </section>)}
        {activeView === "board" && canWrite && snapshot.statuses.length < 30 ? <button type="button"
          className="shared-projects-add-column" onClick={() => setCreateModal("status")}>
          {english ? "+ Add list" : "+ Добавить список"}</button> : null}
      </div>}
      {selectedTask ? <section ref={taskDetailRef} className="shared-projects-detail" aria-label={english ? "Task details" : "Карточка задачи"}>
        <button type="button" className="shared-projects-close" onClick={() => { setTaskId(""); setComments([]); }} aria-label={english ? "Close task" : "Закрыть задачу"}>×</button>
        <h2>{selectedTask.title}</h2>
        {snapshot.project.canOrganizeTasks ? <button type="button" className="shared-projects-archive" disabled={busy} onClick={() => {
          if (!window.confirm(english ? "Delete this team task?" : "Удалить эту общую задачу?")) return;
          void run(async () => {
            await deleteSharedTask(snapshot.project.id, selectedTask.id, selectedTask.revision);
            setTaskId(""); setComments([]); await refreshProject(snapshot.project.id); await refreshProjects(spaceId);
            setMessage(english ? "Task deleted." : "Задача удалена.");
          });
        }}>{english ? "Delete task" : "Удалить задачу"}</button> : null}
        {snapshot.project.canOrganizeTasks ? <div className="shared-projects-detail-move">
          <label>{english ? "Task list" : "Список задач"}<select value={selectedTask.statusId} disabled={busy}
            onChange={(event) => moveTask(selectedTask, event.target.value)}>
            {snapshot.statuses.map((status) => <option key={status.id} value={status.id}>{statusLabel(status.title)}</option>)}
          </select></label>
          <label>{english ? "Project or inbox" : "Проект или хаос-бокс"}<select value={snapshot.project.id} disabled={busy}
            onChange={(event) => moveTaskTo(selectedTask, event.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>
              {project.isInbox ? (english ? "Shared inbox" : "Хаос-бокс") : project.title}</option>)}
          </select></label>
        </div> : null}
        {canWrite ? <form onSubmit={submitTaskEdit}>
          <label>{english ? "Name" : "Название"}<input value={editTaskTitle} onChange={(event) => setEditTaskTitle(event.target.value)} maxLength={160} required /></label>
          <label>{english ? "Tags" : "Теги"}<input value={editTaskTags} onChange={(event) => setEditTaskTags(event.target.value)} placeholder="работа, запуск" /></label>
          <label>{english ? "Description" : "Описание"}<textarea value={editTaskDescription} onChange={(event) => setEditTaskDescription(event.target.value)} maxLength={20000} /></label>
          <div className="shared-projects-date-field"><span>{english ? "Due date" : "Срок"}</span>
            {editTaskDueDate ? <><CalendarDatePicker mode={calendarMode} value={editTaskDueDate} onChange={setEditTaskDueDate} ariaLabel={english ? "Task due date" : "Срок задачи"} />
              <button type="button" onClick={() => setEditTaskDueDate("")}>{english ? "Clear" : "Убрать срок"}</button></>
              : <button type="button" onClick={() => setEditTaskDueDate(localDateKey(new Date()))}>{english ? "Set due date" : "Установить срок"}</button>}</div>
          <label>{english ? "Category" : "Категория"}<select value={editTaskCategoryId} onChange={(event) => setEditTaskCategoryId(event.target.value)}>
            <option value="">{english ? "No category" : "Без категории"}</option>
            {snapshot.categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select></label>
          {selectedTask.revision !== editTaskRevision ? <p role="status">{english ? "This task changed elsewhere. Your draft is kept. Reload its fields before saving." : "Задача изменилась у другого участника. Черновик сохранён; обновите поля перед сохранением."}
            <button type="button" onClick={() => { setEditTaskTitle(selectedTask.title); setEditTaskDescription(selectedTask.description); setEditTaskTags((selectedTask.tags ?? []).join(", ")); setEditTaskDueDate(selectedTask.dueDate ?? ""); setEditTaskCategoryId(selectedTask.categoryId ?? ""); setEditTaskRevision(selectedTask.revision); }}>{english ? "Reload fields" : "Обновить поля"}</button></p> : null}
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
      <p className="shared-projects-privacy">{english
        ? "Only invited members can see this project. Shared tasks are stored by GENESIS."
        : "Проект видят только приглашённые участники. Общие задачи хранятся в GENESIS."}</p>
      <details className="shared-projects-google" aria-label={english ? "My Google copies" : "Мои копии в Google"}>
        <summary>{english ? "My Google copies" : "Мои копии в Google"}
          {(googleSettings?.tasksEnabled || googleSettings?.calendarEnabled) ? <span>{english ? "On" : "Включено"}</span> : null}</summary>
        <p>{english ? "Only you can enable copies in your Google account. The team task stays in GENESIS."
          : "Только вы можете включить копии в своём Google-аккаунте. Общая задача остаётся в GENESIS."}</p>
        <p>{english ? "Copies include the project name and each task's title, due date and status. Descriptions and member details stay in GENESIS."
          : "В копию попадают название проекта, название, срок и статус задачи. Описание и сведения об участниках остаются в GENESIS."}</p>
        {googleSettings ? <div className="shared-projects-google-options">
          <label><input type="checkbox" checked={googleSettings.tasksEnabled}
            disabled={googleBusy || !googleSettings.tasksAvailable && !googleSettings.tasksEnabled}
            onChange={(event) => changeGoogle("tasksEnabled", event.target.checked)} />
            {english ? "Copy to my Google Tasks" : "Копировать в мои Google Tasks"}</label>
          <label><input type="checkbox" checked={googleSettings.calendarEnabled}
            disabled={googleBusy || !googleSettings.calendarAvailable && !googleSettings.calendarEnabled}
            onChange={(event) => changeGoogle("calendarEnabled", event.target.checked)} />
            {english ? "Show in my Google Calendar" : "Показывать в моём Google Calendar"}</label>
          {(!googleSettings.tasksAvailable || !googleSettings.calendarAvailable) ? <small>{english
            ? "Connect the corresponding Google service in your account settings to enable its copy."
            : "Для включения копии подключите соответствующий сервис Google в настройках аккаунта."}</small> : null}
          {(googleSettings.tasksEnabled || googleSettings.calendarEnabled) ? <button type="button" disabled={googleBusy}
            onClick={() => { setGoogleBusy(true); void syncSharedGoogle(snapshot.project.id).then((result) =>
              setGoogleStatus(english ? `Google copies updated: ${result.synced}.` : `Копии Google обновлены: ${result.synced}.`))
              .catch((error: unknown) => setGoogleStatus(error instanceof Error ? error.message : String(error)))
              .finally(() => setGoogleBusy(false)); }}>
            {english ? "Update copies now" : "Обновить копии сейчас"}</button> : null}
        </div> : <p>{english ? "Loading Google options…" : "Загружаем настройки Google…"}</p>}
        {googleStatus ? <p role="status">{googleStatus}</p> : null}
      </details>

    </> : !loading ? <section className="shared-projects-empty">
      <h2>{!spaces.length ? (english ? "Your team starts here" : "Начните общую работу") :
        (english ? "Choose or create a project" : "Выберите или создайте проект")}</h2>
      <p>{!spaces.length ? (english ? "Create a workspace, then invite people and add a project." : "Создайте пространство, затем добавьте проект и пригласите участников.") :
        (english ? "Projects in this workspace appear on the left." : "Проекты этого пространства появятся слева.")}</p>
    </section> : null}
    </main>
    </div>
    {dragPreview ? <div className="shared-projects-drag-preview" aria-hidden="true"
      style={{ left: dragPreview.x + 14, top: dragPreview.y + 14 }}>{dragPreview.title}</div> : null}
    <dialog ref={createDialogRef} className="shared-projects-modal" aria-labelledby="shared-projects-modal-title"
      onClose={() => setCreateModal(null)}>
      {createModal ? <>
        <header><h2 id="shared-projects-modal-title">{({
          space: english ? "New workspace" : "Новое пространство",
          project: createKind === "task-list" ? (english ? "New task list" : "Новый список задач") : (english ? "New shared project" : "Новый общий проект"),
          task: english ? "New team task" : "Новая задача команды",
          status: english ? "New board" : "Новая доска",
          category: english ? "New category" : "Новая категория",
          invite: english ? "Invite to workspace" : "Пригласить в пространство",
          join: english ? "Workspace invitations" : "Приглашения в пространства",
          settings: english ? "Project settings" : "Настройки проекта",
          team: english ? "Team" : "Команда",
          board: english ? "Board settings" : "Настройки доски",
        })[createModal]}</h2>
          <button type="button" className="shared-projects-close" onClick={() => setCreateModal(null)}
            aria-label={english ? "Close" : "Закрыть"}>×</button>
        </header>
        {createModal === "task" ? <div className="task-composer-tabs" role="group" aria-label={english ? "Create type" : "Тип дела"}>
          <button type="button" aria-pressed="true">{english ? "Task" : "Задача"}</button>
          <button type="button" onClick={() => {
            setCreateKind("task-list"); setProjectTitle(""); setProjectDescription(""); setProjectTags("");
            setParentId(snapshot?.project.id ?? ""); setParentBoardId(newTaskStatusId); setCreateModal("project");
          }}>{english ? "Task list" : "Список задач"}</button>
        </div> : null}
        {createModal === "join" ? <div className="shared-invitations">
          {invitationsLoading ? <p role="status">{english ? "Loading invitations…" : "Загружаем приглашения…"}</p>
            : !invitations.length ? <p>{english ? "No invitations yet." : "Приглашений пока нет."}</p>
              : invitations.map((invitation) => <article key={invitation.id}><h3>{invitation.spaceTitle}</h3>
                <p>{invitation.inviterName}{invitation.projectTitle ? ` · ${invitation.projectTitle}` : ""}</p>
                <div><button type="button" className="primary-button" disabled={busy} onClick={() => void run(async () => {
                  const result = await acceptSharedInvitation(invitation.id); await refreshSpaces();
                  setSpaceId(result.spaceId); setCreateModal(null);
                })}>{english ? "Join" : "Присоединиться"}</button>
                <button type="button" className="secondary-button" disabled={busy} onClick={() => void run(async () => {
                  await rejectSharedInvitation(invitation.id); setInvitations(await listSharedInvitations());
                })}>{english ? "Decline" : "Отклонить"}</button></div></article>)}
        </div> : null}
        {createModal === "settings" && snapshot ? <>      {canInvite && !snapshot.project.isInbox ? <section className="shared-modal-section">
        <h3>{english ? "Project settings" : "Настройки проекта"}</h3>
        <form key={`${snapshot.project.id}:${snapshot.project.revision}`} onSubmit={submitProjectEdit}>
          <label>{english ? "Name" : "Название"}<input name="title" defaultValue={snapshot.project.title} maxLength={160} required /></label>
          <label>{english ? "Description" : "Описание"}<textarea name="description" defaultValue={snapshot.project.description} maxLength={5000} /></label>
          <label>{english ? "Tags" : "Теги"}<input name="tags" defaultValue={(snapshot.project.tags ?? []).join(", ")} placeholder="работа, развитие" /></label>
          <label>{english ? "Layout" : "Вид"}<select name="layout" defaultValue={snapshot.project.layout}><option value="list">{english ? "Project tree" : "Дерево проектов"}</option><option value="board">{english ? "Boards" : "Доски"}</option></select></label>
          <label>{english ? "Parent project" : "Родительский проект"}<select name="parentId" defaultValue={snapshot.project.parentId ?? ""}>
            <option value="">{english ? "Top level" : "Верхний уровень"}</option>
            {projects.filter((project) => project.id !== snapshot.project.id && !project.isInbox).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select></label>
          <button type="submit" disabled={busy}>{english ? "Save project" : "Сохранить проект"}</button>
        </form>
        {snapshot.project.role === "owner" ? <button type="button" className="shared-projects-archive" disabled={busy} onClick={archiveProject}>{english ? "Complete project" : "Завершить проект"}</button> : null}
      </section> : null}
      {canInvite ? <section className="shared-modal-section">
        <h3>{english ? "Project categories" : "Категории проекта"}</h3>
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
      </section> : null}
</> : null}
        {createModal === "team" && teamSnapshot ? <>      <section className="shared-modal-section">
        <h3>{english ? "Participants and roles" : "Участники и роли"}</h3>
        <div className="shared-projects-members">{teamSnapshot.members.map((member) => <div key={member.userId} className="shared-projects-member">
          <span>{member.displayName}</span>
          {teamSnapshot.project.spaceRole === "owner" ? <label>{english ? "Workspace access" : "Доступ к пространству"}<select value={member.spaceRole} disabled={busy} onChange={(event) => setSpaceRole(member.userId, event.target.value)}>
            {["owner", "admin", "member", "guest"].map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </select></label> : <span>{roleLabel(member.spaceRole)}</span>}
          {teamSnapshot.project.spaceRole === "owner" && member.spaceRole !== "owner" && member.spaceRole !== "admin" ?
            <label className="shared-projects-organizer-toggle"><input type="checkbox" checked={Boolean(member.canOrganizeTasks)} disabled={busy}
              onChange={(event) => setOrganizerAccess(member.userId, member.spaceRole, event.target.checked)} />
              {english ? "Can organize tasks" : "Может распределять задачи"}</label> : null}
          {teamSnapshot.project.role === "owner" && !teamSnapshot.project.isInbox ? <>
            <label>{english ? "Role" : "Роль"}<select value={member.role} disabled={busy} onChange={(event) => setMemberRole(member.userId, event.target.value)}>
              {["owner", "manager", "member", "commenter", "viewer"].map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select></label>
            <button type="button" disabled={busy || (member.role === "owner" && teamSnapshot.members.filter((item) => item.role === "owner").length === 1)} onClick={() => removeMember(member.userId)}>{english ? "Remove" : "Удалить"}</button>
          </> : <span>{roleLabel(member.role)}</span>}
        </div>)}</div>
      </section>

          {["owner", "admin"].includes(spaces.find((space) => space.id === spaceId)?.role ?? "") ? <button type="button" className="primary-button" onClick={() => setCreateModal("invite")}>{english ? "Invite to workspace" : "Пригласить в пространство"}</button> : null}
        </> : null}
        {createModal === "board" && editingBoard && snapshot ? <form onSubmit={(event) => {
          event.preventDefault(); const fields = new FormData(event.currentTarget); const current = editingBoard;
          void run(async () => { await updateSharedStatus(snapshot.project.id, current.id, String(fields.get("title")), current.revision,
            { color: String(fields.get("color")), imageUrl: boardImage, isDone: fields.get("isDone") === "on" });
            await refreshProject(snapshot.project.id); setCreateModal(null); });
        }}>
          <label>{english ? "Board name" : "Название доски"}<input name="title" defaultValue={statusLabel(editingBoard.title)} required maxLength={80}/></label>
          <label>{english ? "Color" : "Цвет"}<input name="color" type="color" defaultValue={editingBoard.color ?? "#2d6c68"}/></label>
          <label className="shared-projects-checkbox"><input name="isDone" type="checkbox" defaultChecked={Boolean(editingBoard.isDone)}/>{english ? "Tasks here are completed" : "Задачи в этой доске завершены"}</label>
          <label>{english ? "Image URL" : "Ссылка на изображение"}<input type={boardImage.startsWith("data:") ? "text" : "url"} value={boardImage.startsWith("data:") ? "" : boardImage} onChange={(event) => setBoardImage(event.target.value)} placeholder="https://…"/></label>
          <label>{english ? "Upload image (up to 500 KB)" : "Загрузить изображение (до 500 КБ)"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
            const file = event.target.files?.[0]; if (!file) return;
            if (file.size > 500000 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
              setMessage(english ? "Choose PNG, JPG or WebP up to 500 KB." : "Выберите PNG, JPG или WebP до 500 КБ."); return;
            }
            const reader = new FileReader(); reader.onload = () => setBoardImage(String(reader.result)); reader.readAsDataURL(file);
          }}/></label>
          {boardImage ? <><img className="shared-board-image" src={boardImage} alt={english ? "Board preview" : "Изображение доски"}/><button type="button" onClick={() => setBoardImage("")}>{english ? "Remove image" : "Убрать изображение"}</button></> : null}
          <button type="submit" className="primary-button" disabled={busy}>{english ? "Save board" : "Сохранить доску"}</button>
          <details><summary>{english ? "Delete board" : "Удалить доску"}</summary>
            <label>{english ? "Move its contents to" : "Переместить содержимое в"}<select value={statusDestinations[editingBoard.id] ?? snapshot.statuses.find((item) => item.id !== editingBoard.id)?.id ?? ""}
              onChange={(event) => setStatusDestinations((current) => ({ ...current, [editingBoard.id]: event.target.value }))}>
              {snapshot.statuses.filter((item) => item.id !== editingBoard.id).map((item) => <option key={item.id} value={item.id}>{statusLabel(item.title)}</option>)}
            </select></label>
            <button type="button" disabled={busy || snapshot.statuses.length < 2} onClick={() => {
              removeStatus(editingBoard.id, editingBoard.revision, statusDestinations[editingBoard.id] ?? snapshot.statuses.find((item) => item.id !== editingBoard.id)?.id ?? "");
              setCreateModal(null);
            }}>{english ? "Delete and move contents" : "Удалить и перенести содержимое"}</button>
          </details>
        </form> : null}
        {createModal === "space" ? <form onSubmit={submitSpace}>
          <p>{english ? "A workspace brings your collaborators together." : "Пространство объединяет участников команды."}</p>
          <label>{english ? "Name" : "Название"}<input value={spaceTitle} maxLength={160} required onChange={(event) => setSpaceTitle(event.target.value)} /></label>
          <button type="submit" className="primary-button" disabled={busy}>{english ? "Create workspace" : "Создать пространство"}</button>
        </form> : null}
        {createModal === "project" ? <form onSubmit={submitProject}>
          <label>{english ? "Name" : "Название"}<input value={projectTitle} maxLength={160} required onChange={(event) => setProjectTitle(event.target.value)} /></label>
          <label>{english ? "Description" : "Описание"}<textarea value={projectDescription} maxLength={5000} onChange={(event) => setProjectDescription(event.target.value)} /></label>
          <label>{english ? "Tags" : "Теги"}<input value={projectTags} onChange={(event) => setProjectTags(event.target.value)} placeholder="работа, развитие" /></label>
          {createKind === "project" ? <label>{english ? "Layout" : "Вид"}<select value={projectLayout} onChange={(event) => setProjectLayout(event.target.value as "list" | "board")}>
            <option value="list">{english ? "Project tree" : "Дерево проектов"}</option><option value="board">{english ? "Boards" : "Доски"}</option>
          </select></label> : null}
          <label>{english ? "Parent project" : "Родительский проект"}<select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">{english ? "Top level" : "Верхний уровень"}</option>
            {projects.filter((project) => !project.isInbox).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select></label>
          <button type="submit" className="primary-button" disabled={busy}>{createKind === "task-list" ? (english ? "Create task list" : "Создать список задач") : (english ? "Create project" : "Создать проект")}</button>
        </form> : null}
        {createModal === "task" && snapshot ? <form onSubmit={submitTask}>
          <label>{english ? "Name" : "Название"}<input maxLength={160} required value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} /></label>
          <p>{english ? "Project" : "Проект"}: <strong>{snapshot.project.title}</strong></p>
          <div className="shared-projects-date-field"><span>{english ? "Due date" : "Срок"}</span>
            {newTaskDueDate ? <><CalendarDatePicker mode={calendarMode} value={newTaskDueDate} onChange={setNewTaskDueDate} ariaLabel={english ? "Task due date" : "Срок задачи"} />
              <button type="button" onClick={() => setNewTaskDueDate("")}>{english ? "Clear" : "Убрать срок"}</button></>
              : <button type="button" onClick={() => setNewTaskDueDate(localDateKey(new Date()))}>{english ? "Set due date" : "Установить срок"}</button>}</div>
          <details className="task-advanced-fields"><summary>{english ? "Details and settings" : "Подробности и настройки"}</summary>
          <label>{english ? "Description" : "Описание"}<textarea maxLength={20000} value={newTaskDescription} onChange={(event) => setNewTaskDescription(event.target.value)} /></label>
          <label>{english ? "Tags" : "Теги"}<input value={newTaskTags} onChange={(event) => setNewTaskTags(event.target.value)} placeholder="работа, запуск" /></label>
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
          </details>
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
            <option value="member">{english ? "Member — can edit" : "Участник — может редактировать"}</option>
            <option value="viewer">{english ? "Guest — can view" : "Гость — может просматривать"}</option>
          </select></label>
          <button type="submit" className="primary-button" disabled={busy}>{english ? "Create invitation" : "Создать приглашение"}</button>
        </form> : null}
      </> : null}
    </dialog>
  </div>;
}
