/* eslint-disable @next/next/no-img-element -- User-provided board pictures remain native img elements. */
"use client";

import { type ReactNode, type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  searchSharedAffairs, type SharedAffairSearch,
  listSharedLabels, type SharedLabel,
  loadSharedUiState, saveSharedUiState, listSharedInvitations, acceptSharedInvitation,
  rejectSharedInvitation, inviteSharedSpaceMember, type SharedInvitation, type SharedStatus,
  addSharedComment, changeSharedMemberRole, changeSharedSpaceRole,
  createSharedProject, createSharedStatus, createSharedCategory, deleteSharedCategory,
  deleteSharedStatus, deleteSharedTask, updateSharedCategory, updateSharedStatus,
  createSharedTask, listSharedComments, listSharedProjects,
  listArchivedSharedProjects, listSharedSpaces, loadSharedProject, removeSharedMember,
  loadSharedGoogleSettings, setSharedProjectArchived, syncSharedGoogle,
  updateSharedGoogleSettings, updateSharedProject, updateSharedTask, moveSharedTask,
  queuedSharedMutations, discardSharedMutation, sharedDataCameFromOfflineCache,
  type SharedComment, type SharedProject, type SharedProjectSnapshot,
  type SharedSpace, type SharedTask, type SharedGoogleSettings,
} from "./cloud-sync";
import "./shared-projects.css";
import "./shared-projects-layout.css";
import "./shared-collaboration.css";
import { ProjectsHeroMark } from "./ProjectsHeroMark";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { ExperimentalIcon } from "./ExperimentalIcon";
import { ActionNotice, useActionNotice } from "./ActionNotice";
import { ProjectCompletionDialog } from "./ProjectCompletionDialog";
import { useAffairDrag } from "./use-affair-drag";
import { SharedSpaceCover } from "./SharedSpaceCover";
import { SharedSpaceForm } from "./SharedSpaceForm";
import { SharedLabelBadges, SharedLabelPicker, SharedLabelsDialog } from "./SharedLabels";
import { SharedComments } from "./SharedComments";
import { SharedActivity } from "./SharedActivity";
import { SharedGantt } from "./SharedGantt";
import { ganttSchedule, ganttAxisPoint, type GanttScale, type GanttSchedule } from "./shared-gantt";
import { SharedTaskSchedule, emptySharedPlan, taskSharedPlan } from "./SharedTaskSchedule";
import type { TimeFormat } from "./time-format";
type SharedDragItem = { id: string; title: string } & ({ kind: "task"; task: SharedTask } | { kind: "container"; project: SharedProject });
type SharedDropTarget = { projectId: string; statusId: string; position: number; schedule?:GanttSchedule; ganttRow?:string };
import { RecordCalendarChoice } from "./RecordCalendarChoice";
import { type CalendarMode, MONTHS, LUNAR_DECADES, ELEMENTS, formatCalendarDate, formatGregorian, getGregorianDate, getLunarDate, getLunarMonthDates, getSacredDate, getSacredDay, lunarMonthIndex } from "./calendar-data";
import { translateText } from "./i18n";
import { restoredSharedProject } from "./shared-expansion";
import type { SharedInvitationDestination } from "./SharedInvitationNotices";

type Props = { userId: string; language: string; enabledCalendars: CalendarMode[]; experimentalTheme?: boolean; timeFormat?: TimeFormat;
  destination?: SharedInvitationDestination;
  calendarMode: CalendarMode; taskCalendarMode: CalendarMode;
  onCalendarModeChange: (mode: CalendarMode) => Promise<void> };

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

export function SharedProjects({ userId, language, enabledCalendars, calendarMode, taskCalendarMode, onCalendarModeChange, experimentalTheme = false, timeFormat = "24h", destination }: Props) {
  const english = language === "en";
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [spaceId, setSpaceId] = useState(destination?.spaceId ?? "");
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<SharedProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const projectIdRef = useRef(projectId);
  const spaceIdRef = useRef(spaceId);
  const [viewOverride, setViewOverride] = useState<"list" | "board" | "calendar" | "gantt" | null>(null);
  const [ganttDay, setGanttDay] = useState<string>();
  const [labels,setLabels] = useState<SharedLabel[]>([]);
  const [labelsOpen,setLabelsOpen] = useState(false);
  const [projectLabelIds,setProjectLabelIds] = useState<string[]>([]);
  const [editProjectLabelIds,setEditProjectLabelIds] = useState<string[]>([]);
  const [newTaskLabelIds,setNewTaskLabelIds] = useState<string[]>([]);
  const [editTaskLabelIds,setEditTaskLabelIds] = useState<string[]>([]);
  const [newPlan,setNewPlan] = useState(emptySharedPlan);
  const [editPlan,setEditPlan] = useState(emptySharedPlan);
  const [newTaskContext,setNewTaskContext] = useState<SharedProjectSnapshot|null>(null);
  const [activityKey,setActivityKey] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [calendarDay, setCalendarDay] = useState(() => localDateKey(new Date()));
  const [snapshot, setSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [teamSnapshot, setTeamSnapshot] = useState<SharedProjectSnapshot | null>(null);
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
  const [taskSnapshot, setTaskSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [comments, setComments] = useState<SharedComment[]>([]);
  const [editingSpaceId, setEditingSpaceId] = useState("");
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
  const [newTaskCalendarMode, setNewTaskCalendarMode] = useState<CalendarMode>(taskCalendarMode);
  const [newTaskDestination, setNewTaskDestination] = useState<{ projectId: string; statusId?: string; title: string; isInbox: boolean } | null>(null);
  const [editTaskCalendarMode, setEditTaskCalendarMode] = useState<CalendarMode>(taskCalendarMode);
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#2d6c68");
  const [newStatusTitle, setNewStatusTitle] = useState("");
  const [newStatusDone, setNewStatusDone] = useState(false);
  const [statusDestinations, setStatusDestinations] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskCategoryId, setEditTaskCategoryId] = useState("");
  const [editTaskRevision, setEditTaskRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [pendingCreates, setPendingCreates] = useState<Awaited<ReturnType<typeof queuedSharedMutations>>>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const taskDialogRef = useRef<HTMLDialogElement>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const [createModal, setCreateModal] = useState<"space" | "space-settings" | "project" | "task" | "status" | "category" | "invite" | "join" | "settings" | "team" | "board" | null>(null);
  const [boardTitleEdit, setBoardTitleEdit] = useState<{ id: string; title: string } | null>(null);
  const cancelledBoardTitleRef = useRef(false);
  const inboxProject = projects.find((project) => Boolean(project.isInbox));
  const inboxProjectId = inboxProject?.id;
  const taskProjectId = taskSnapshot?.project.id;
  const selectedTask = taskSnapshot?.tasks.find((task) => task.id === taskId);
  const taskOpen = Boolean(selectedTask);
  const closeTask = () => { setTaskId(""); setTaskSnapshot(null); setComments([]); };

  useEffect(() => {
    if (!spaceId) return;
    let live = true;
    void Promise.all([loadSharedUiState(spaceId), listSharedProjects(spaceId)]).then(([state, items]) => {
      if (!live) return;
      setExpandedIds(state.expandedIds); setUiReadySpace(spaceId);
      const invitedProject=destination?.spaceId===spaceId && items.find(item=>item.id===destination.projectId);
      setProjectId(invitedProject ? invitedProject.id : restoredSharedProject(items, state.expandedIds));
    }).catch((error: unknown) => {
      if (!live) return;
      setExpandedIds([]); setUiReadySpace(spaceId);
      setMessage(english ? "Could not load your saved layout. Try opening the workspace again."
        : "Не удалось загрузить сохранённый вид. Откройте пространство повторно.");
      console.error(error instanceof Error ? error.message : "Shared layout load failed");
    });
    return () => { live = false; };
  }, [spaceId, english, destination]);

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
      const ids = [...new Set([projectId, inboxProjectId].filter((id): id is string => Boolean(id)))];
      if (!ids.length) { setPendingCreates([]); return; }
      void Promise.all(ids.map(queuedSharedMutations)).then((items) => { if (live) setPendingCreates(items.flat()); })
        .catch(() => { if (live) setPendingCreates([]); });
    };
    refresh();
    window.addEventListener("genesis-shared-offline-change", refresh);
    return () => { live = false; window.removeEventListener("genesis-shared-offline-change", refresh); };
  }, [projectId, inboxProjectId]);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) return;
    if (createModal && !dialog.open) dialog.showModal();
    if (!createModal && dialog.open) dialog.close();
  }, [createModal]);
  useEffect(() => {
    const dialog = taskDialogRef.current;
    if (!dialog) return;
    if (taskOpen && !dialog.open) dialog.showModal();
    if (!taskOpen && dialog.open) dialog.close();
  }, [taskOpen]);

  const refreshSpaces = useCallback(async () => {
    const items = await listSharedSpaces();
    if (sharedDataCameFromOfflineCache()) setOffline(true);
    setSpaces(items);
    setSpaceId((current) => items.some((item) => item.id === current) ? current : "");
  }, []);
  const refreshProjects = useCallback(async (id: string) => {
    const [items, archived, spaceLabels] = await Promise.all([listSharedProjects(id), listArchivedSharedProjects(id), listSharedLabels(id)]);
    if (spaceIdRef.current !== id) return;
    setProjects((current) => JSON.stringify(current) === JSON.stringify(items) ? current : items);
    setArchivedProjects((current) => JSON.stringify(current) === JSON.stringify(archived) ? current : archived);
    setLabels(spaceLabels);
    if (!items.length) setSnapshot(null);
    setProjectId((current) => items.some((item) => item.id === current) ? current : "");
  }, []);
  const refreshProject = useCallback(async (id: string) => {
    const result = await loadSharedProject(id);
    if (projectIdRef.current !== id) return;
    if (sharedDataCameFromOfflineCache()) setOffline(true);
    setSnapshot((current) => JSON.stringify(current) === JSON.stringify(result) ? current : result);
    if (result.project.isInbox) setInboxPreview(result);
  }, [setInboxPreview]);
  const refreshTaskProject = async (id: string) => {
    const result = await loadSharedProject(id);
    setTaskSnapshot((current) => current?.project.id === id ? result : current);
  };

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
    if (!taskProjectId || !taskId) return;
    let live = true;
    void listSharedComments(taskProjectId, taskId).then((items) => { if (live) setComments(items); })
      .catch((error: unknown) => { if (live) setMessage(error instanceof Error ? error.message : String(error)); });
    return () => { live = false; };
  }, [taskProjectId, taskId]);
  useEffect(() => {
    if (!taskProjectId || !taskId) return;
    let live = true;
    const refresh = () => {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      void loadSharedProject(taskProjectId).then((result) => {
        if (live) setTaskSnapshot(result);
      }).catch(() => undefined);
      void listSharedComments(taskProjectId,taskId).then(items=>{if(live)setComments(items);}).catch(()=>undefined);
    };
    const timer = window.setInterval(refresh, 5_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [taskProjectId, taskId]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try { await action(); setActivityKey(value=>value+1); }
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
  const submitProject = (event: FormEvent) => {
    event.preventDefault();
    if (!spaceId) return;
    void run(async () => {
      await createSharedProject(spaceId, {
        title: projectTitle, description: projectDescription, tags: splitTags(projectTags), layout: createKind === "task-list" ? "list" : projectLayout,
        parentId: parentId || null, boardStatusId: parentBoardId || null, kind: createKind,
        labelIds: projectLabelIds,
      });
      setProjectTitle(""); setProjectDescription(""); setProjectTags(""); setParentId(""); setProjectLabelIds([]);
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
    if (!newTaskDestination || !newTaskTitle.trim()) return;
    void run(async () => {
      const destination = await loadSharedProject(newTaskDestination.projectId);
      const statusId = newTaskDestination.statusId ?? destination.statuses.find((status) => !status.isDone)?.id ?? destination.statuses[0]?.id;
      if (!statusId) throw new Error(english ? "Reload the workspace to create a task." : "Откройте пространство повторно, чтобы создать задачу.");
      const created = await createSharedTask(destination.project.id, {
        title: newTaskTitle.trim(), description: newTaskDescription.trim(), tags: splitTags(newTaskTags),
        dueDate: newTaskDueDate || null,
        labelIds: newTaskLabelIds, startDate:newPlan.startDate||null, startTime:newPlan.startTime||null, endTime:newPlan.endTime||null, dependsOnIds:newPlan.dependsOnIds,
        statusId, categoryId: null, assigneeId: null,
      });
      setNewTaskTitle(""); setNewTaskDescription(""); setNewTaskTags(""); setNewTaskDueDate("");
      if (!created.pending) {
        if (newTaskDestination.isInbox) setInboxPreview(await loadSharedProject(destination.project.id));
        if (projectId === destination.project.id) await refreshProject(projectId);
        await refreshProjects(spaceId);
      }
      setCreateModal(null);
      setMessage(created.pending
        ? (english ? "Task saved on this device. It will reach the team when the connection returns."
          : "Задача сохранена на устройстве и появится у команды после подключения к сети.")
        : newTaskDestination.isInbox
          ? (english ? "Task added to the shared inbox." : "Задача добавлена в хаос-бокс.")
          : (english ? "Task added to the project." : "Задача добавлена в проект."));
    });
  };
  const moveTaskTo = (task: SharedTask, destinationProjectId: string, statusId = "", position = 0) => {
    if (busy) return;
    void run(async () => {
      const destination = destinationProjectId === snapshot?.project.id
        ? snapshot : await loadSharedProject(destinationProjectId);
      const resolvedStatus = statusId || destination.statuses.find((item) => !item.isDone)?.id
        || destination.statuses[0]?.id;
      if (!resolvedStatus) throw new Error(english ? "The destination has no task list." : "В месте назначения нет списка задач.");
      const moved = await moveSharedTask(task.projectId, task.id, {
        destinationProjectId, statusId: resolvedStatus, expectedRevision: task.revision,
        position: statusId ? position : destination.tasks.filter((item) => item.statusId === resolvedStatus).length,
      });
      if (moved.pending) {
        setMessage(english ? "Move saved on this device and waiting for the connection."
          : "Перенос сохранён на устройстве и ожидает подключения к сети.");
        return;
      }
      if (projectId) await refreshProject(projectId);
      await refreshProjects(spaceId);
      if (taskId === task.id) {
        const result = await loadSharedProject(destinationProjectId);
        setTaskSnapshot((current) => current?.tasks.some((item) => item.id === task.id) ? result : current);
        setEditTaskRevision(moved.revision); setEditTaskCategoryId(result.tasks.find((item) => item.id === task.id)?.categoryId ?? "");
      }
      const inbox = projects.find((project) => project.isInbox);
      if (inbox) setInboxPreview(await loadSharedProject(inbox.id));
      setMessage(english ? "Task moved." : "Задача перемещена.");
    });
  };
  const moveTask = (task: SharedTask, statusId: string) => {
    const context = task.projectId === snapshot?.project.id ? snapshot : taskSnapshot;
    if (!context || task.statusId === statusId) return;
    moveTaskTo(task, task.projectId, statusId,
      context.tasks.filter((item) => item.statusId === statusId).length);
  };
  const scheduleTask=(task:SharedTask,schedule:GanttSchedule)=>{
    if(busy||!snapshot)return;
    const target=snapshot;
    void run(async()=>{
      const changed=task.projectId===target.project.id
        ? await updateSharedTask(task.projectId,task.id,{...schedule,expectedRevision:task.revision})
        : await moveSharedTask(task.projectId,task.id,{...schedule,destinationProjectId:target.project.id,statusId:target.statuses.find(status=>!status.isDone)?.id||target.statuses[0].id,expectedRevision:task.revision,position:target.tasks.length});
      setSnapshot(current=>current?.project.id===target.project.id ? {...current,tasks:[...current.tasks.filter(item=>item.id!==task.id),{...task,...changed,...schedule,projectId:target.project.id}]} : current);
      if(changed.pending)setMessage(english ? "Schedule saved on this device and waiting for connection." : "Сроки сохранены на устройстве и ожидают подключения к сети.");
      else {await refreshProject(target.project.id);await refreshProjects(spaceId);}
    });
  };
  const sharedDrag = useAffairDrag<SharedDragItem, SharedDropTarget>((x, y, item) => {
    if (busy) return null;
    const below = document.elementFromPoint(x, y);
    const axis=below?.closest<HTMLElement>("[data-gantt-axis]");
    if(axis&&snapshot&&item.kind==="task"&&(snapshot.project.permissions?.editTasks ?? ["owner","manager","member"].includes(snapshot.project.role))&&snapshot.project.canOrganizeTasks){
      const start=Number(axis.dataset.ganttStart),end=Number(axis.dataset.ganttEnd),scale=axis.dataset.ganttScale as GanttScale;
      const periods=JSON.parse(axis.closest<HTMLElement>('[data-gantt-periods]')?.dataset.ganttPeriods||'[]');
      const schedule=ganttSchedule(item.task,Math.max(start,Math.min(end-(scale==="day" ? 1/96 : 1),ganttAxisPoint(periods,x-axis.getBoundingClientRect().left))),scale);
      return {projectId:snapshot.project.id,statusId:"",position:0,schedule,ganttRow:axis.closest<HTMLElement>('[data-gantt-task]')?.dataset.ganttTask};
    }
    const column = below?.closest<HTMLElement>("[data-shared-drop-status]");
    if (column && snapshot) {
      const statusId = column.dataset.sharedDropStatus ?? "";
      const hovered = below?.closest<HTMLElement>("[data-shared-task-id]");
      const tasks = snapshot.tasks.filter((task) => task.statusId === statusId && task.id !== item.id);
      const index = hovered ? tasks.findIndex((task) => task.id === hovered.dataset.sharedTaskId) : -1;
      const before = hovered && y < hovered.getBoundingClientRect().top + hovered.getBoundingClientRect().height / 2;
      return { projectId: snapshot.project.id, statusId, position: index < 0 ? tasks.length : index + (before ? 0 : 1) };
    }
    const project = below?.closest<HTMLElement>("[data-shared-drop-project]");
    return project ? { projectId: project.dataset.sharedDropProject ?? "", statusId: "", position: 0 } : null;
  }, (item, destination) => {
    if (!destination.projectId || busy) return;
    if (item.kind === "task") {
      if(destination.schedule){scheduleTask(item.task,destination.schedule);return;}
      if (destination.projectId !== item.task.projectId || destination.statusId && (destination.statusId !== item.task.statusId || destination.position !== item.task.position))
        moveTaskTo(item.task, destination.projectId, destination.statusId, destination.position);
    } else {
      const child = item.project;
      let parent = projects.find((project) => project.id === destination.projectId);
      const visited = new Set<string>();
      while (parent && !visited.has(parent.id)) {
        if (parent.id === child.id) return;
        visited.add(parent.id); parent = projects.find((project) => project.id === parent?.parentId);
      }
      void run(async () => {
        await updateSharedProject(child.id, { title: child.title, description: child.description, tags: child.tags,
          layout: child.layout, parentId: destination.projectId, boardStatusId: destination.statusId || null, expectedRevision: child.revision });
        await refreshProjects(spaceId);
      });
    }
  });
  const dragPreview = sharedDrag.preview;
  const dropTarget = sharedDrag.target;
  const assignTask = (task: SharedTask, assigneeId: string) => {
    void run(async () => {
      const changed = await updateSharedTask(task.projectId, task.id, {
        assigneeId: assigneeId || null, expectedRevision: task.revision,
      });
      if (changed.pending) setMessage(english ? "Change saved on this device."
        : "Изменение сохранено на устройстве и ожидает подключения к сети.");
      else {
        setEditTaskRevision(changed.revision);
        await refreshTaskProject(task.projectId);
        await refreshProject(task.projectId);
      }
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
  const submitComment = async (body:string,mentionIds:string[]) => {
    if (!taskProjectId || !taskId || busy) throw new Error("COMMENT_NOT_READY");
    setBusy(true);setMessage("");
    try { await addSharedComment(taskProjectId, taskId, body,mentionIds);setComments(await listSharedComments(taskProjectId,taskId));setActivityKey(value=>value+1); }
    catch(error){setMessage(english ? "Could not send the comment. Your draft is kept." : "Не удалось отправить комментарий. Черновик сохранён.");throw error;}
    finally{setBusy(false);}
  };
  const submitTaskEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!taskProjectId || !taskId) return;
    void run(async () => {
      const changed = await updateSharedTask(taskProjectId, taskId, {
        title: editTaskTitle.trim(), description: editTaskDescription.trim(), tags: splitTags(editTaskTags),
        dueDate: editTaskDueDate || null, categoryId: editTaskCategoryId || null,
        labelIds:editTaskLabelIds,startDate:editPlan.startDate||null,startTime:editPlan.startTime||null,endTime:editPlan.endTime||null,dependsOnIds:editPlan.dependsOnIds,
        expectedRevision: editTaskRevision,
      });
      setEditTaskRevision(changed.revision);
      if (!changed.pending) {
        await refreshTaskProject(taskProjectId);
        await refreshProject(taskProjectId);
        if (taskProjectId === inboxProjectId) setInboxPreview(await loadSharedProject(taskProjectId));
      }
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
      await refreshProjects(spaceId);
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
      await refreshProjects(spaceId);
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
        labelIds: editProjectLabelIds,
      });
      await refreshProjects(current.spaceId);
      await refreshProject(current.id);
      setMessage(english ? "Project updated." : "Проект обновлён.");
    });
  };
  const archiveProject = () => {
    if (!snapshot) return;
    setProjectToComplete(snapshot.project);
  };
  const [projectToComplete, setProjectToComplete] = useState<SharedProject | null>(null);
  const confirmProjectCompletion = () => {
    const current = projectToComplete;
    if (!current || busy) return;
    setProjectToComplete(null);
    void run(async () => {
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
        <button type="button" className="shared-projects-project-link shared-affair-draggable" data-affair-drag-surface
          {...sharedDrag.props({ id: project.id, title: project.title, kind: "container", project }, !busy && ["owner", "manager"].includes(project.role))} aria-expanded={expandedIds.includes(project.id)}
          data-shared-drop-project={project.id} aria-current={projectId === project.id ? "page" : undefined}
          onClick={() => selectProject(project)}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={expandedIds.includes(project.id) ? "is-expanded" : ""}><path d="m7 4 6 6-6 6"/></svg>
          <span>{project.title}<SharedLabelBadges labels={labels} ids={project.labelIds}/><small>{project.layout === "board"
            ? `${english ? "Boards" : "Доски"} · ${project.id === snapshot?.project.id ? snapshot.statuses.length : project.boardCount ?? 0}`
            : `${english ? "Tasks" : "Задачи"} · ${project.taskCount ?? 0}`}</small></span>
        </button>
        {expandedIds.includes(project.id) ? <div className="shared-tree-children">{renderProjectTree(project.id, new Set([...ancestors, project.id]))}</div> : null}
      </div>);
  };
  const openBoardSettings = (status: SharedStatus) => {
    setEditingBoard(status); setBoardImage(status.imageUrl ?? ""); setCreateModal("board");
  };
  const saveBoard = (status: SharedStatus, values: { title?: string; color?: string }) => {
    if (!snapshot || busy) return;
    const target = snapshot.project.id;
    void run(async () => {
      await updateSharedStatus(target, status.id, values.title ?? status.title, status.revision,
        values.color ? { color: values.color } : undefined);
      await refreshProject(target);
    });
  };
  const saveBoardTitle = (status: SharedStatus) => {
    const edit = boardTitleEdit;
    setBoardTitleEdit(null);
    if (cancelledBoardTitleRef.current || edit?.id !== status.id) return;
    const title = edit.title.trim();
    if (title && title !== statusLabel(status.title)) saveBoard(status, { title });
  };
  const placeContainer = (child: SharedProject, statusId: string) => void run(async () => {
    await updateSharedProject(child.id, { title: child.title, description: child.description, tags: child.tags,
      layout: child.layout, parentId: projectId, boardStatusId: statusId || null, expectedRevision: child.revision });
    await refreshProjects(spaceId);
  });
  useEffect(() => {
    if (!inboxProjectId) return;
    let live = true;
    const refresh = () => void loadSharedProject(inboxProjectId).then((result) => {
      if (live) setInboxPreview(result);
    }).catch((error: unknown) => {
      if (live) setMessage(error instanceof Error ? error.message : String(error));
    });
    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [inboxProjectId]);
  const visibleInbox = inboxPreview?.project.id === inboxProjectId ? inboxPreview : null;
  const activeView = viewOverride ?? snapshot?.project.layout ?? "list";
  const calendarPeriod = sharedCalendarPeriod(calendarMonth, calendarMode, english);
  const calendarOffset = calendarPeriod.dates.length ? (calendarPeriod.dates[0].getDay() + 6) % 7 : 0;
  const calendarDays = [
    ...Array.from({ length: calendarOffset }, () => null),
    ...calendarPeriod.dates,
  ];
  const calendarTasks = snapshot?.tasks.filter((task) => task.dueDate === calendarDay) ?? [];
  const openTask = (task: SharedTask, context = snapshot) => {
    if (!context || context.project.id !== task.projectId) return;
    setMessage("");
    setTaskSnapshot(context);
    setTaskId(task.id); setComments([]);
    setEditTaskCalendarMode(taskCalendarMode);
    setEditTaskTitle(task.title); setEditTaskDescription(task.description); setEditTaskTags((task.tags ?? []).join(", "));
    setEditTaskDueDate(task.dueDate ?? ""); setEditTaskCategoryId(task.categoryId ?? "");
    setEditTaskRevision(task.revision);
    setEditTaskLabelIds(task.labelIds||[]);setEditPlan(taskSharedPlan(task));
  };
  const canWrite = snapshot && (snapshot.project.permissions?.editTasks ?? ["owner", "manager", "member"].includes(snapshot.project.role));
  const canInvite = snapshot && (snapshot.project.permissions?.inviteMembers ?? ["owner", "manager"].includes(snapshot.project.role));
  const canManage = snapshot && (snapshot.project.permissions?.manageProjects ?? ["owner", "manager"].includes(snapshot.project.role));
  const canEditTask = taskSnapshot && (taskSnapshot.project.permissions?.editTasks ?? ["owner", "manager", "member"].includes(taskSnapshot.project.role));
  const canCommentTask = taskSnapshot && (taskSnapshot.project.permissions?.comment ?? ["owner", "manager", "member", "commenter"].includes(taskSnapshot.project.role));
  const canCreateTask = inboxProject && (inboxProject.permissions?.editTasks ?? ["owner", "manager", "member"].includes(inboxProject.role));
  const selectedSpace=spaces.find(space=>space.id===spaceId);
  const canManageLabels=selectedSpace && (selectedSpace.permissions?.manageProjects ?? ["owner","admin"].includes(selectedSpace.role));
  const openCreateTask = (project: SharedProject, status?: SharedStatus) => {
    setNewTaskDestination({ projectId: project.id, statusId: status?.id,
      title: status ? `${project.title} · ${statusLabel(status.title)}` : project.title, isInbox: Boolean(project.isInbox) });
    setNewTaskCalendarMode(taskCalendarMode);
    setNewPlan(emptySharedPlan());setNewTaskLabelIds([]);setNewTaskDueDate("");setNewTaskTitle("");setNewTaskDescription("");setNewTaskTags("");
    setNewTaskContext(null);void loadSharedProject(project.id).then(setNewTaskContext).catch(()=>undefined);
    setCreateModal("task");
  };
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
    {projectToComplete ? <ProjectCompletionDialog title={projectToComplete.title} onCancel={() => setProjectToComplete(null)} onConfirm={confirmProjectCompletion} /> : null}
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

    {spaceId ? <label className="tag-search"><span aria-hidden="true">{experimentalTheme ? <ExperimentalIcon name="search" /> : "⌕"}</span><input aria-label={english ? "Find tasks and projects by title or tag" : "Поиск задач и проектов по названию или #тегу"} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchBusy(Boolean(event.target.value.trim())); setSearchResults({ projects: [], tasks: [] }); }} placeholder={english ? "Find tasks and projects by title or #tag" : "Поиск задач и проектов по названию или #тегу"} /></label> : null}
    {searchQuery.trim() ? <section className="tag-search-results" aria-label="Результаты поиска дел" aria-live="polite" aria-busy={searchBusy}>
      <header><strong>{english ? "Search results" : "Результаты поиска"}</strong><span>{searchResults.projects.length} проектов · {searchResults.tasks.length} задач</span></header>
      <div>{searchResults.projects.filter((project) => !project.isInbox).map((project) => <button type="button" key={project.id} onClick={() => { setSearchQuery(""); setProjectId(project.id); setSnapshot(null); }}><span>Проект</span><strong>{project.title}</strong><small>{project.tags?.map((tag) => `#${tag}`).join(" ")}</small></button>)}
        {searchResults.tasks.map((task) => <button type="button" key={task.id} onClick={() => void run(async () => {
          const result = await loadSharedProject(task.projectId);
          const found = result.tasks.find((item) => item.id === task.id);
          setSearchQuery("");
          if (!result.project.isInbox) { setProjectId(task.projectId); setSnapshot(result); setViewOverride("list"); }
          if (found) openTask(found, result);
        })}><span>Задача · {task.projectTitle}</span><strong>{task.title}</strong><small>{task.tags.map((tag) => `#${tag}`).join(" ")}</small></button>)}</div>
      {!searchBusy && !searchResults.projects.length && !searchResults.tasks.length ? <p>{english ? "No matches" : "Совпадений нет"}</p> : null}
    </section> : null}
    {!spaceId ? <section className="shared-space-entry" aria-label={english ? "Shared workspaces" : "Общие пространства"}>
      {loading ? <p role="status">{english ? "Loading…" : "Загрузка…"}</p> : <>
        {spaces.length ? <div className="shared-space-list">{spaces.map((space) => <article className={`shared-space-card${space.coverUrl ? " has-cover" : ""}`} key={space.id}><button type="button" className="shared-space-open"
          onClick={() => { setSpaceId(space.id); setProjectId(""); setSnapshot(null); }}>
          {space.coverUrl ? <SharedSpaceCover src={space.coverUrl} position={space.coverPosition}/> : null}
          <span className="shared-space-caption"><strong>{space.title}</strong>{space.description ? <span className="shared-space-description">{space.description}</span> : null}<small>{roleLabel(space.role)}</small></span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
        </button>
          {["owner", "admin"].includes(space.role) ? <button type="button" className="shared-space-edit secondary-button"
            aria-label={english ? `Edit workspace “${space.title}”` : `Редактировать пространство «${space.title}»`}
            onClick={() => { setEditingSpaceId(space.id); setCreateModal("space-settings"); }}>{english ? "Settings" : "Настройки"}</button> : null}
        </article>)}</div> : null}
        <div className="shared-space-entry-actions">
          <button type="button" className="primary-button" onClick={() => setCreateModal("space")}>{english ? "Create workspace" : "Создать пространство"}</button>
          <button type="button" className="secondary-button" onClick={openJoin}>{english ? "Join workspace" : "Присоединиться к пространству"}</button>
        </div>
      </>}
    </section> : null}
    <div className="shared-projects-shell" hidden={!spaceId}>
    <aside className="shared-projects-sidebar" aria-label={english ? "Shared project navigation" : "Навигация по общим проектам"}>
      {inboxProject ? <section className="inbox-card shared-projects-inbox-card"
        data-shared-drop-project={inboxProject.id}
        data-drop-active={dropTarget?.projectId === inboxProject.id && !dropTarget.statusId || undefined}
        aria-label={english ? "Shared inbox" : "Хаос-бокс"}>
          <header className="shared-inbox-header workspace-inbox-header"><h2>{english ? "Shared inbox" : "Хаос-бокс"}</h2><small aria-label={english ? "Task count" : "Количество задач"}>{visibleInbox?.tasks.length ?? inboxProject.taskCount ?? 0}</small></header>
          <p>{english ? "New tasks start here. Open a task or drag it to a board to organize it." : "Новые задачи появляются здесь. Откройте задачу или перетащите её на доску, чтобы распределить."}</p>
          {canCreateTask ? <button type="button" className="primary-button shared-inbox-create workspace-inbox-create" onClick={() => openCreateTask(inboxProject)}><ExperimentalIcon name="plus" />{english ? "Create task" : "Создать задачу"}</button> : null}
        <div className="shared-projects-inbox-items">
          {!visibleInbox ? <p role="status">{english ? "Loading tasks…" : "Загружаем задачи…"}</p>
            : visibleInbox.tasks.length ? visibleInbox.tasks.map((task) => <article key={task.id} className="shared-inbox-task shared-affair-draggable"
              {...sharedDrag.props({ id: task.id, title: task.title, kind: "task", task }, !busy && Boolean(visibleInbox.project.canOrganizeTasks))}>
              <button type="button" data-affair-drag-surface
              onClick={() => openTask(task, visibleInbox)}>
              <strong>{task.title}</strong>{task.tags?.length ? <em>{task.tags.map((tag) => `#${tag}`).join(" ")}</em> : null}<small>{task.dueDate ? formatCalendarDate(new Date(`${task.dueDate}T12:00:00`), calendarMode)
                : (english ? "No due date" : "Без срока")}</small>
            </button></article>) : <p>{english ? "No unsorted tasks yet." : "Задач без проекта пока нет."}</p>}

        </div>
      </section> : null}
      <nav className="shared-projects-project-nav" aria-label={english ? "Projects in workspace" : "Проекты пространства"}>
        <h2>{english ? "Projects" : "Проекты"}</h2>
        <button type="button" className="secondary-button shared-project-create" onClick={() => { setCreateKind("project"); setParentId(""); setParentBoardId(""); setCreateModal("project"); }}>
          <ExperimentalIcon name="plus" />{english ? "Create project" : "Создать проект"}
        </button>
        {uiReadySpace === spaceId ? renderProjectTree(null) : <p role="status">{english ? "Loading your layout…" : "Загружаем ваш вид…"}</p>}
        {archivedProjects.length ? <details className="shared-projects-create">
          <summary>{english ? "Completed projects" : "Завершённые"} · {archivedProjects.length}</summary>
          <div className="shared-projects-members">{archivedProjects.map((project) => <div key={project.id} className="shared-projects-member">
            <span>{project.title}</span>
            {project.role === "owner" ? <button type="button" className="project-complete-action" disabled={busy} title={english ? "Restore" : "Вернуть"} aria-label={english ? `Restore project “${project.title}”` : `Вернуть проект «${project.title}»`} onClick={() => restoreProject(project.id)}><svg className="project-restore-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.7 7.3M4 4v6h6"/></svg></button> : null}
          </div>)}</div>
        </details> : null}
      </nav>
      <section className="shared-workspace-controls" aria-label={english ? "Workspaces" : "Пространства"}>
        <h2>{english ? "Workspaces" : "Пространства"}</h2>
        <div className="shared-workspace-current">
        <label className="shared-projects-space-picker">{english ? "Current workspace" : "Текущее пространство"}<select value={spaceId} onChange={(event) => { setSpaceId(event.target.value); setSnapshot(null); setProjectId(""); setTaskId(""); setComments([]); }} disabled={!spaces.length}>
          {!spaces.length ? <option value="">{english ? "No workspaces" : "Нет пространств"}</option> : null}
          {spaces.map((space) => <option key={space.id} value={space.id}>{space.title}</option>)}
        </select></label>
        {["owner", "admin"].includes(spaces.find((space) => space.id === spaceId)?.role ?? "") ?
          <button type="button" className="secondary-button" onClick={() => { setEditingSpaceId(spaceId); setCreateModal("space-settings"); }}>{english ? "Settings" : "Настройки"}</button> : null}
        {canManageLabels ? <button type="button" className="secondary-button" onClick={()=>setLabelsOpen(true)}>{english ? "Labels" : "Метки"}</button> : null}
        {["owner", "admin"].includes(spaces.find((space) => space.id === spaceId)?.role ?? "") ?
          <button type="button" className="secondary-button" onClick={() => void run(async () => {
            if (inboxProject) { setTeamSnapshot(await loadSharedProject(inboxProject.id)); }
            setCreateModal("team");
          })}>{english ? "Team and invitations" : "Команда и приглашения"}</button>
        : null}
        </div>
        <div className="shared-workspace-all">
        <button type="button" className="secondary-button" onClick={() => { setSpaceId(""); setProjectId(""); setSnapshot(null); }}>{english ? "All workspaces" : "Все пространства"}</button>
        <button type="button" className="shared-projects-open-modal" onClick={() => setCreateModal("space")}>
          {experimentalTheme ? <ExperimentalIcon name="plus" /> : null}{english ? "Create a workspace" : "Создать пространство"}
        </button>
        </div>
      </section>
    </aside>

    <main className="shared-projects-main">

    {snapshot && snapshot.project.id === projectId ? <>
      <header className="shared-projects-context">
        <div className="shared-project-heading">
          {!snapshot.project.isInbox && snapshot.project.role === "owner" ? <button type="button" className={`project-complete-action${completedPulse ? " is-completing" : ""}`} disabled={busy} onClick={archiveProject} title={english ? "Complete project" : "Завершить проект"} aria-label={english ? `Complete project “${snapshot.project.title}”` : `Завершить проект «${snapshot.project.title}»`}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></svg></button> : null}
          <h2>{snapshot.project.isInbox ? (english ? "Team tasks" : "Задачи команды") : snapshot.project.title}</h2>
        </div>
      <div className="shared-context-actions">
        {(canManage || canInvite) && !snapshot.project.isInbox ? <button type="button" className="secondary-button" onClick={() => {setEditProjectLabelIds(snapshot.project.labelIds||[]);setCreateModal("settings");}}>{english ? "Project settings" : "Настройки проекта"}</button> : null}
        <button type="button" className="secondary-button" onClick={() => { setTeamSnapshot(snapshot); setCreateModal("team"); }}>{english ? "Team" : "Команда"}</button>
      </div>
        <div className="shared-project-details">
          {!snapshot.project.isInbox && snapshot.project.description ? <p>{snapshot.project.description}</p> : null}
          <SharedLabelBadges labels={labels} ids={snapshot.project.labelIds}/>
        </div>
        <div className="shared-projects-meta"><span>{english ? "Your role" : "Ваша роль"}: {roleLabel(snapshot.project.role)}</span><span>{snapshot.members.length} {english ? "members" : "участников"}</span></div>
      </header>
      <section className="shared-projects-task-panel" aria-labelledby="shared-projects-tasks-title">
      <section className="shared-projects-planning" aria-label={english ? "Tasks and views" : "Задачи и виды проекта"}>
        <h3 id="shared-projects-tasks-title">{english ? "Tasks" : "Задачи проекта"}</h3>
      {canWrite ? <div className="shared-projects-create-actions">
        <button type="button" className="shared-projects-open-modal primary-button" onClick={() => openCreateTask(snapshot.project)}>
          <ExperimentalIcon name="plus" />{english ? "Create task" : "Создать задачу"}
        </button>
      </div> : null}
      <div className="shared-planning-controls">
      <div className="shared-planning-view">
      <p className="shared-projects-calendar-mode-label">{english ? "Project view" : "Вид проекта"}</p>
      <div className="shared-projects-view-switch" role="group" aria-label={english ? "Project view" : "Вид проекта"}>
        {(["list", "board", "calendar", "gantt"] as const).map((item) => <button key={item} type="button"
          aria-pressed={activeView === item} onClick={() => {setGanttDay(undefined);setViewOverride(item);}}>{item === "list"
            ? (english ? "List" : "Список") : item === "board" ? (english ? "Boards" : "Доски")
              : item === "gantt" ? (english ? "Gantt" : "Гант") : (english ? "Calendar" : "Календарь")}</button>)}
      </div>
      </div>
      {!experimentalTheme ? <div className="shared-planning-dates">
      <p className="shared-projects-calendar-mode-label">{english ? "Calendar for project view and task dates" : "Календарь проекта и дат задач"}</p>
      <div className="shared-projects-calendar-mode display-calendar-choice" role="group" aria-label={english ? "Calendar for project view and task dates" : "Календарь проекта и дат задач"}>
        {(["profane", "sacred", "lunar"] as const).filter((mode) => enabledCalendars.includes(mode)).map((mode) => <button key={mode} type="button"
          aria-pressed={calendarMode === mode} onClick={() => {
            void onCalendarModeChange(mode);
            setCalendarMonth(new Date(`${calendarDay}T12:00:00`));
          }}>{mode === "profane" ? (english ? "Gregorian" : "Григорианский")
            : mode === "sacred" ? (english ? "Sacred" : "Сакральный") : (english ? "Lunar" : "Лунный")}</button>)}
      </div>
      </div> : null}
      </div>
      {activeView === "board" ? <p className="shared-projects-board-hint">{english
        ? "Swipe across the board to view all statuses."
        : "Проведите по доске, чтобы увидеть все статусы."}</p> : null}
      </section>
      <div className="shared-projects-workspace">
      {activeView === "gantt" ? <SharedGantt snapshot={snapshot} english={english} calendarMode={calendarMode} timeFormat={timeFormat} initialDay={ganttDay} onOpen={openTask} onCreate={schedule=>{openCreateTask(snapshot.project);setNewPlan({startDate:schedule.startDate,startTime:schedule.startTime||"",endTime:schedule.endTime||"",dependsOnIds:[]});setNewTaskDueDate(schedule.dueDate);}} onSchedule={scheduleTask} busy={busy} externalDrop={dropTarget?.schedule} externalDropRow={dropTarget?.ganttRow}/> : activeView === "calendar" ? <section className="shared-projects-calendar" aria-label={english ? "Project calendar" : "Календарь проекта"}>
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
          <button type="button" onClick={()=>{setGanttDay(calendarDay);setViewOverride("gantt");}}>{english ? "Daily timeline" : "Таймлайн дня"}</button>
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
          style={{ "--shared-board-color": status.color ?? "#2d6c68" } as CSSProperties}
          data-drop-active={dropTarget?.statusId === status.id || undefined}
          aria-label={status.title}>
          <header className="shared-board-header" style={{ borderColor: status.color ?? "#2d6c68" }}>
            <h2>{canManage ? boardTitleEdit?.id === status.id ? <input className="shared-board-title-input"
              aria-label={english ? "Board name" : "Название доски"} maxLength={80} value={boardTitleEdit.title}
              ref={(element) => { if (element && document.activeElement !== element) { element.focus(); element.select(); } }}
              onChange={(event) => setBoardTitleEdit({ id: status.id, title: event.target.value })}
              onBlur={() => saveBoardTitle(status)} onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                if (event.key === "Escape") { cancelledBoardTitleRef.current = true; setBoardTitleEdit(null); }
              }} /> : <button type="button" className="shared-board-title" disabled={busy}
                title={statusLabel(status.title)}
                aria-label={english ? `Rename board ${status.title}` : `Переименовать доску «${status.title}»`}
                onClick={() => { cancelledBoardTitleRef.current = false; setBoardTitleEdit({ id: status.id, title: statusLabel(status.title) }); }}>{statusLabel(status.title)}</button>
              : statusLabel(status.title)}</h2>
            {canManage ? <div className="shared-board-tools">
              <button type="button" className="shared-board-settings" aria-label={english ? `Settings for ${status.title}` : `Настройки доски «${status.title}»`} onClick={() => openBoardSettings(status)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
            </div> : null}
            <small className="shared-board-task-count" aria-label={english ? "Task count" : "Количество задач"}>{snapshot.tasks.filter((task) => task.statusId === status.id).length}</small>
          </header>
          {canWrite ? <div className="shared-board-create-actions" role="group" aria-label={english ? `Create in ${status.title}` : `Создать в доске «${status.title}»`}>
            <button type="button" className="shared-board-create-task" onClick={() => openCreateTask(snapshot.project, status)}>
              <span>{english ? "Create" : "Создать"}</span> <span>{english ? "task" : "задачу"}</span>
            </button>
            {(["task-list", "project"] as const).map((kind) => <button type="button" className={`shared-board-create-${kind}`} key={kind} onClick={() => {
              setCreateKind(kind); setParentId(snapshot.project.id); setParentBoardId(status.id); setCreateModal("project");
            }}><span>{english ? "Create" : "Создать"}</span> <span>{kind === "project" ? (english ? "project" : "проект") : (english ? "list" : "список")}</span></button>)}
          </div> : null}
          {status.imageUrl ? <img className="shared-board-image" src={status.imageUrl} alt={status.title} /> : null}
          {projects.filter((child) => child.parentId === snapshot.project.id && (child.boardStatusId === status.id
            || !child.boardStatusId && status.id === snapshot.statuses[0]?.id)).map((child) => <article className={`shared-board-container shared-affair-draggable shared-kind-${child.kind ?? "project"}`} key={child.id}
            {...sharedDrag.props({ id: child.id, title: child.title, kind: "container", project: child }, !busy && ["owner", "manager"].includes(child.role))}>
            <button type="button" data-affair-drag-surface onClick={() => { setProjectId(child.id); setSnapshot(null); persistExpansion([...new Set([...expandedIds, child.id])]); }}>
              <small>{child.kind === "task-list" ? (english ? "Task list" : "Список задач") : (english ? "Project" : "Проект")}</small>
              <strong>{child.title}</strong><span>{child.taskCount ?? 0} {english ? "tasks" : "задач"}</span>
              <SharedLabelBadges labels={labels} ids={child.labelIds}/>
            </button>
            {["owner", "manager"].includes(child.role) ? <label>{english ? "Boards" : "Доски"}<select value={child.boardStatusId ?? snapshot.statuses[0]?.id} onChange={(event) => placeContainer(child, event.target.value)}>
              {snapshot.statuses.map((board) => <option key={board.id} value={board.id}>{statusLabel(board.title)}</option>)}
            </select></label> : null}
          </article>)}
          {snapshot.tasks.filter((task) => task.statusId === status.id).map((task) => <article key={task.id}
            className="shared-projects-task shared-affair-draggable" data-shared-task-id={task.id}
            {...sharedDrag.props({ id: task.id, title: task.title, kind: "task", task }, !busy && Boolean(snapshot.project.canOrganizeTasks))}>

            <div className="shared-task-card-title">
            <input type="checkbox" className="shared-task-complete" checked={Boolean(status.isDone)} disabled={busy||!snapshot.project.canOrganizeTasks||!snapshot.statuses.some(item=>Boolean(item.isDone)!==Boolean(status.isDone))}
              aria-label={english ? `${status.isDone ? "Reopen" : "Complete"} task ${task.title}` : `${status.isDone ? "Вернуть в работу" : "Закрыть"} задачу «${task.title}»`}
              onChange={()=>{const target=snapshot.statuses.find(item=>Boolean(item.isDone)!==Boolean(status.isDone));if(target)moveTask(task,target.id);}}/>
            <button type="button" className="shared-projects-task-open" data-affair-drag-surface onClick={() => openTask(task)} aria-pressed={taskId === task.id}>
              <strong>{task.title}</strong>{task.tags?.length ? <em>{task.tags.map((tag) => `#${tag}`).join(" ")}</em> : null}<small>{task.dueDate ? formatCalendarDate(new Date(`${task.dueDate}T12:00:00`), calendarMode) : (english ? "No due date" : "Без срока")}</small>
            </button>
            </div><SharedLabelBadges labels={labels} ids={task.labelIds}/>
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
        </section>)}
        {activeView === "board" && (snapshot.project.canCreateBoards ?? canManage) && snapshot.statuses.length < 30 ? <button type="button"
          className="shared-projects-add-column" onClick={() => setCreateModal("status")}>
          <ExperimentalIcon name="plus" />{english ? "Add board" : "Добавить доску"}</button> : null}
      </div>}

      </div>
      </section>
      <SharedActivity key={snapshot.project.id} projectId={snapshot.project.id} english={english} refreshKey={activityKey}/>
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
        (english ? "Select a project or create a new one in the workspace navigation." : "Выберите проект или создайте новый в панели пространства.")}</p>
    </section> : null}
    </main>
    </div>
    {labelsOpen && spaceId ? <SharedLabelsDialog spaceId={spaceId} labels={labels} english={english} onClose={()=>setLabelsOpen(false)} onChanged={()=>refreshProjects(spaceId)}/> : null}
    {dragPreview ? <div className="shared-projects-drag-preview" aria-hidden="true"
      style={{ left: dragPreview.x + 14, top: dragPreview.y + 14 }}>{dragPreview.item.title}</div> : null}
    <dialog ref={taskDialogRef} className="shared-projects-modal shared-task-modal" aria-labelledby="shared-task-title"
      onPointerDown={(event) => { if (window.innerWidth > 760 && event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.currentTarget.close(); } }}
      onClose={closeTask} onCancel={(event) => { if (busy) event.preventDefault(); }}>
      {selectedTask && taskSnapshot ? <>
        <header><h2 id="shared-task-title">{selectedTask.title}</h2><button type="button" className="shared-projects-close" disabled={busy} onClick={closeTask} aria-label={english ? "Close task" : "Закрыть задачу"}><ExperimentalIcon name="close" /></button></header>
        {message ? <p className="shared-task-feedback" role="status">{message}</p> : null}
        {taskSnapshot.project.canOrganizeTasks ? <button type="button" className="shared-projects-archive" disabled={busy} onClick={() => {
          if (!window.confirm(english ? "Delete this team task?" : "Удалить эту общую задачу?")) return;
          void run(async () => {
            await deleteSharedTask(taskSnapshot.project.id, selectedTask.id, selectedTask.revision);
            closeTask(); await refreshProject(taskSnapshot.project.id); await refreshProjects(spaceId);
            if (taskSnapshot.project.isInbox) setInboxPreview(await loadSharedProject(taskSnapshot.project.id));
            setMessage(english ? "Task deleted." : "Задача удалена.");
          });
        }}>{english ? "Delete task" : "Удалить задачу"}</button> : null}
        {taskSnapshot.project.canOrganizeTasks ? <div className="shared-projects-detail-move">
          {!taskSnapshot.project.isInbox ? <label>{english ? "Board" : "Доска"}<select value={selectedTask.statusId} disabled={busy}
            onChange={(event) => moveTask(selectedTask, event.target.value)}>
            {taskSnapshot.statuses.map((status) => <option key={status.id} value={status.id}>{statusLabel(status.title)}</option>)}
          </select></label> : null}
          <label>{english ? "Project or inbox" : "Проект или хаос-бокс"}<select value={taskSnapshot.project.id} disabled={busy}
            onChange={(event) => moveTaskTo(selectedTask, event.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>
              {project.isInbox ? (english ? "Shared inbox" : "Хаос-бокс") : project.title}</option>)}
          </select></label>
        </div> : null}
        {canEditTask ? <form onSubmit={submitTaskEdit}>
          <RecordCalendarChoice value={editTaskCalendarMode} onChange={setEditTaskCalendarMode} language={language} />
          <label>{english ? "Name" : "Название"}<input value={editTaskTitle} onChange={(event) => setEditTaskTitle(event.target.value)} maxLength={160} required /></label>
          <label>{english ? "Tags" : "Теги"}<input value={editTaskTags} onChange={(event) => setEditTaskTags(event.target.value)} placeholder="работа, запуск" /></label>
          <label>{english ? "Description" : "Описание"}<textarea value={editTaskDescription} onChange={(event) => setEditTaskDescription(event.target.value)} maxLength={20000} /></label>
          <SharedTaskSchedule plan={editPlan} onChange={setEditPlan} dueDate={editTaskDueDate} onDueDate={setEditTaskDueDate} mode={editTaskCalendarMode} timeFormat={timeFormat} english={english} tasks={taskSnapshot.tasks} taskId={selectedTask.id}/>
          <SharedLabelPicker labels={labels} value={editTaskLabelIds} onChange={setEditTaskLabelIds} english={english} onManage={canManageLabels ? ()=>setLabelsOpen(true) : undefined}/>
          <label>{english ? "Category" : "Категория"}<select value={editTaskCategoryId} onChange={(event) => setEditTaskCategoryId(event.target.value)}>
            <option value="">{english ? "No category" : "Без категории"}</option>
            {taskSnapshot.categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select></label>
          {selectedTask.revision !== editTaskRevision ? <p role="status">{english ? "This task changed elsewhere. Your draft is kept. Reload its fields before saving." : "Задача изменилась у другого участника. Черновик сохранён; обновите поля перед сохранением."}
            <button type="button" onClick={() => { setEditTaskTitle(selectedTask.title); setEditTaskDescription(selectedTask.description); setEditTaskTags((selectedTask.tags ?? []).join(", ")); setEditTaskDueDate(selectedTask.dueDate ?? ""); setEditTaskCategoryId(selectedTask.categoryId ?? ""); setEditTaskRevision(selectedTask.revision);setEditTaskLabelIds(selectedTask.labelIds||[]);setEditPlan(taskSharedPlan(selectedTask)); }}>{english ? "Reload fields" : "Обновить поля"}</button></p> : null}
          <button type="submit" className="primary-button" disabled={busy || selectedTask.revision !== editTaskRevision}>{english ? "Save task" : "Сохранить задачу"}</button>
        </form> : selectedTask.description ? <p>{selectedTask.description}</p> : null}
        {canEditTask ? <label>{english ? "Assigned to" : "Исполнитель"}<select value={selectedTask.assigneeId ?? ""} disabled={busy} onChange={(event) => assignTask(selectedTask, event.target.value)}>
          <option value="">{english ? "Unassigned" : "Не назначен"}</option>
          {taskSnapshot.members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
        </select></label> : null}
        <SharedComments key={`comments-${selectedTask.id}`} comments={comments} members={taskSnapshot.members} english={english} canComment={Boolean(canCommentTask)} busy={busy} onSubmit={submitComment}/>
        <SharedActivity key={`activity-${selectedTask.id}`} projectId={taskSnapshot.project.id} taskId={selectedTask.id} english={english} refreshKey={activityKey}/>
      </> : null}
    </dialog>
    <dialog ref={createDialogRef} className="shared-projects-modal" aria-labelledby="shared-projects-modal-title"
      onPointerDown={(event) => { if (window.innerWidth > 760 && event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.currentTarget.close(); } }}
      onClose={() => setCreateModal(null)}>
      {createModal ? <>
        <header><h2 id="shared-projects-modal-title">{({
          space: english ? "New workspace" : "Новое пространство",
          "space-settings": english ? "Workspace settings" : "Настройки пространства",
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
            aria-label={english ? "Close" : "Закрыть"}><ExperimentalIcon name="close" /></button>
        </header>
        {message ? <p className="shared-task-feedback" role="status">{message}</p> : null}
        {createModal === "task" ? <div className="task-composer-tabs" role="group" aria-label={english ? "Create type" : "Тип дела"}>
          <button type="button" aria-pressed="true">{english ? "Task" : "Задача"}</button>
          <button type="button" onClick={() => {
            setCreateKind("task-list"); setProjectTitle(""); setProjectDescription(""); setProjectTags("");
            setParentId(newTaskDestination?.isInbox ? "" : newTaskDestination?.projectId ?? ""); setParentBoardId(newTaskDestination?.statusId ?? ""); setCreateModal("project");
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
          <SharedLabelPicker labels={labels} value={editProjectLabelIds} onChange={setEditProjectLabelIds} english={english} onManage={canManageLabels ? ()=>setLabelsOpen(true) : undefined}/>
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
          <SharedActivity key={editingBoard.id} projectId={snapshot.project.id} boardId={editingBoard.id} english={english} refreshKey={activityKey}/>
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
        {createModal === "space" || createModal === "space-settings" ? <SharedSpaceForm key={createModal === "space" ? "new-space" : editingSpaceId}
          language={language} spaceId={createModal === "space-settings" ? editingSpaceId : undefined}
          onSaved={(space) => { void refreshSpaces(); setSpaceId(space.id); setCreateModal(null); setMessage(english ? "Workspace saved." : "Пространство сохранено."); }}
          onDeleted={(id) => { setSpaces((current) => current.filter((space) => space.id !== id));
            if (spaceId === id) { setSpaceId(""); setProjectId(""); setSnapshot(null); setInboxPreview(null); setProjects([]); }
            setCreateModal(null); }} /> : null}
        {createModal === "project" ? <form onSubmit={submitProject}>
          <label>{english ? "Name" : "Название"}<input value={projectTitle} maxLength={160} required onChange={(event) => setProjectTitle(event.target.value)} /></label>
          <label>{english ? "Description" : "Описание"}<textarea value={projectDescription} maxLength={5000} onChange={(event) => setProjectDescription(event.target.value)} /></label>
          <label>{english ? "Tags" : "Теги"}<input value={projectTags} onChange={(event) => setProjectTags(event.target.value)} placeholder="работа, развитие" /></label>
          <SharedLabelPicker labels={labels} value={projectLabelIds} onChange={setProjectLabelIds} english={english} onManage={canManageLabels ? ()=>setLabelsOpen(true) : undefined}/>
          {createKind === "project" ? <label>{english ? "Layout" : "Вид"}<select value={projectLayout} onChange={(event) => setProjectLayout(event.target.value as "list" | "board")}>
            <option value="list">{english ? "Project tree" : "Дерево проектов"}</option><option value="board">{english ? "Boards" : "Доски"}</option>
          </select></label> : null}
          <label>{english ? "Parent project" : "Родительский проект"}<select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">{english ? "Top level" : "Верхний уровень"}</option>
            {projects.filter((project) => !project.isInbox).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select></label>
          <button type="submit" className="primary-button" disabled={busy}>{createKind === "task-list" ? (english ? "Create task list" : "Создать список задач") : (english ? "Create project" : "Создать проект")}</button>
        </form> : null}
        {createModal === "task" && newTaskDestination ? <form onSubmit={submitTask}>
          <RecordCalendarChoice value={newTaskCalendarMode} onChange={setNewTaskCalendarMode} language={language} />
          <label>{english ? "Name" : "Название"}<input maxLength={160} required value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} /></label>
          <p className="shared-task-destination">{english ? "Create in" : "Место создания"}: <strong>{newTaskDestination.title}</strong></p>
          <SharedTaskSchedule plan={newPlan} onChange={setNewPlan} dueDate={newTaskDueDate} onDueDate={setNewTaskDueDate} mode={newTaskCalendarMode} timeFormat={timeFormat} english={english} tasks={newTaskContext?.project.id===newTaskDestination.projectId ? newTaskContext.tasks : []}/>
          <SharedLabelPicker labels={labels} value={newTaskLabelIds} onChange={setNewTaskLabelIds} english={english} onManage={canManageLabels ? ()=>setLabelsOpen(true) : undefined}/>
          <details className="task-advanced-fields"><summary>{english ? "Details and settings" : "Подробности и настройки"}</summary>
          <label>{english ? "Description" : "Описание"}<textarea maxLength={20000} value={newTaskDescription} onChange={(event) => setNewTaskDescription(event.target.value)} /></label>
          <label>{english ? "Tags" : "Теги"}<input value={newTaskTags} onChange={(event) => setNewTaskTags(event.target.value)} placeholder="работа, запуск" /></label>
          </details>
          <button type="submit" className="primary-button" disabled={busy || !newTaskTitle.trim()}>{english ? "Create task" : "Создать задачу"}</button>
        </form> : null}
        {createModal === "status" ? <form onSubmit={submitStatus}>
          <label>{english ? "Name" : "Название"}<input value={newStatusTitle} maxLength={80} required onChange={(event) => setNewStatusTitle(event.target.value)} /></label>
          <label className="shared-projects-checkbox"><input type="checkbox" checked={newStatusDone} onChange={(event) => setNewStatusDone(event.target.checked)} />{english ? "Completion list" : "Список завершённых задач"}</label>
          <button type="submit" className="primary-button" disabled={busy}>{english ? "Create board" : "Создать доску"}</button>
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
