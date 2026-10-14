/* eslint-disable @next/next/no-img-element -- User-provided board pictures remain native img elements. */
"use client";

import { type ReactNode, type CSSProperties, type FormEvent, lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MobileDisclosure } from "./MobileDisclosure";
import {
  searchSharedAffairs, type SharedAffairSearch,
  listSharedLabels, type SharedLabel,
  listSharedProjectCategories,
  loadSharedUiState, saveSharedUiState, listSharedInvitations, acceptSharedInvitation,
  rejectSharedInvitation, inviteSharedSpaceMember, type SharedInvitation, type SharedStatus,
  addSharedComment, changeSharedMemberRole,
  createSharedProject, createSharedStatus,
  deleteSharedStatus, deleteSharedTask, updateSharedStatus,
  createSharedTask, listSharedComments, listSharedProjects,
  listArchivedSharedProjects, listSharedSpaces, loadSharedProject, removeSharedMember,
  loadSharedGoogleSettings, setSharedProjectArchived, syncSharedGoogle,
  updateSharedGoogleSettings, updateSharedProject, updateSharedTask, moveSharedTask,
  approveSharedTask,
  queuedSharedMutations, discardSharedMutation, sharedDataCameFromOfflineCache,
  type SharedComment, type SharedProject, type SharedProjectSnapshot,
  type SharedSpace, type SharedTask, type SharedGoogleSettings,
} from "./cloud-sync";
import "./shared-projects.css";
import "./shared-projects-layout.css";
import "./shared-collaboration.css";
import { ProjectsHeroMark } from "./ProjectsHeroMark";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { SharedWorkspaceIdentity } from "./SharedWorkspaceIdentity";
import { SharedProjectCategories } from "./SharedProjectCategories";
import { ExperimentalIcon } from "./ExperimentalIcon";
import { ActionNotice, useActionNotice } from "./ActionNotice";
import { ProjectCompletionDialog } from "./ProjectCompletionDialog";
import { useAffairDrag } from "./use-affair-drag";
import { SharedSpaceCover } from "./SharedSpaceCover";
import { SharedSpaceForm } from "./SharedSpaceForm";
import { SharedTeamPermissions } from "./SharedTeamPermissions";
import { SharedTaskApprovalChoice } from "./SharedTaskApprovalChoice";
import { EntryTypeChoice, entryTypeLabel, entryTypeTitlePlaceholder, type EntryType } from "./EntryTypeChoice";
import { SharedLabelBadges, SharedLabelPicker, SharedLabelsDialog } from "./SharedLabels";
import { SharedProjectLabels } from "./SharedProjectLabels";
import { SharedComments } from "./SharedComments";
import { SharedActivity } from "./SharedActivity";
import { SharedTaskImage } from "./SharedTaskImage";
import { SharedTaskAttachmentsInput, SharedTaskAttachmentList, taskFileError, type TaskFileDraft } from "./SharedTaskAttachments";
import { SharedWorkspaceSummary } from "./SharedUpdates";
import { initialSharedPlace, recordSharedPlace, sharedPlaceFromUrl } from "./shared-navigation";
import { SharedGantt } from "./SharedGantt";
import { boardDisplay, boardTaskGroups } from "./shared-board-display";
import { SharedBoardTaskTitle } from "./SharedBoardTaskTitle";
import { dateSerial, serialDate, ganttSchedule, ganttAxisPoint, ganttTaskGroups, ganttUnscheduledSchedule, type GanttScale, type GanttSchedule, type GanttTaskDates, type GanttReturnTarget } from "./shared-gantt";
import { SharedTaskSchedule, emptySharedPlan, taskSharedPlan } from "./SharedTaskSchedule";
import { formatTimeValue, type TimeFormat } from "./time-format";
type SharedDragItem = { id: string; title: string } & ({ kind: "task"; task: SharedTask } | { kind: "container"; project: SharedProject });
type SharedDropTarget = GanttReturnTarget & { schedule?:GanttSchedule; ganttRow?:string; calendarDate?:string };
import { RecordCalendarChoice } from "./RecordCalendarChoice";
import { type CalendarMode, MONTHS, LUNAR_DECADES, ELEMENTS, formatCalendarDate, formatGregorian, getGregorianDate, getLunarDate, getLunarMonthDates, getSacredDate, getSacredDay, lunarMonthIndex } from "./calendar-data";
import { translateText } from "./i18n";
import { restoredSharedProject, sharedProjectTree } from "./shared-expansion";
import { formatTaskCount } from "./task-count-i18n";
import { InboxToolbar, InboxRestore, InboxResizeBoundary } from "./InboxToolbar";
import type { InboxPosition } from "./ui-visibility";

import { SharedTaskReview } from "./SharedTaskReview";
import { SharedReviewSettings } from "./SharedReviewSettings";
import { SharedTrash, SharedTrashConfirmation } from "./SharedTrash";
import { trashSharedProject } from "./cloud-sync";
const sharedMindmapsEnabled = process.env.NEXT_PUBLIC_GENESIS_MINDMAPS === "true";
const SharedMindmaps = lazy(() => import("./SharedMindmaps"));
const SharedSpaceCollaboration = lazy(() => import("./SharedSpaceCollaboration"));
const compactQuery = () => window.matchMedia("(max-width: 1099px)");
const subscribeCompact = (listener: () => void) => { const query = compactQuery(); query.addEventListener("change", listener); return () => query.removeEventListener("change", listener); };
const compactSnapshot = () => compactQuery().matches;
const serverCompactSnapshot = () => false;
import type { SharedInvitationDestination } from "./SharedInvitationNotices";

type Props = { userId: string; language: string; enabledCalendars: CalendarMode[]; experimentalTheme?: boolean; timeFormat?: TimeFormat;
  inboxWidth: number; onInboxWidth: (width: number) => void; inboxPosition: InboxPosition; inboxHidden: boolean; inboxCompact: boolean; onInboxPosition: (position: InboxPosition) => void; onInboxHidden: (hidden: boolean) => void; onInboxCompact: (compact: boolean) => void;
  destination?: SharedInvitationDestination;
  categoriesExpanded: boolean; onCategoriesExpanded: (expanded: boolean) => void;
  categoriesView: "cards" | "list"; onCategoriesView: (view: "cards" | "list") => void;
  calendarMode: CalendarMode; taskCalendarMode: CalendarMode;
  onCalendarModeChange: (mode: CalendarMode) => Promise<void> };

const splitTags = (value: string) => [...new Set(value.split(/[,;\s]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean))];

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sharedCalendarPeriod(anchor: Date, mode: CalendarMode, english: boolean, language: string) {
  if (mode === "sacred") {
    const sacred = getSacredDate(anchor);
    const start = getGregorianDate(sacred.sacredYear, sacred.monthIndex, 1);
    const next = sacred.monthIndex === 12
      ? getGregorianDate(sacred.sacredYear + 1, 0, 1)
      : getGregorianDate(sacred.sacredYear, sacred.monthIndex + 1, 1);
    const dates: Date[] = [];
    for (const date = new Date(start); date < next; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
    const previous = new Date(start); previous.setDate(previous.getDate() - 1);
    return { dates, previous, next, title: `${translateText(MONTHS[sacred.monthIndex].name, language as import("./i18n").Language)} · ${sacred.sacredYear}–${sacred.sacredYear + 1}` };
  }
  if (mode === "lunar") {
    const index = lunarMonthIndex(anchor);
    const dates = getLunarMonthDates(index);
    const previousDates = getLunarMonthDates(index - 1);
    const nextDates = getLunarMonthDates(index + 1);
    const lunar = getLunarDate(dates[Math.floor(dates.length / 2)] ?? anchor);
    return { dates, previous: previousDates[0] ?? anchor, next: nextDates[0] ?? anchor,
      title: `${translateText(lunar.month.name, language as import("./i18n").Language)} · ${lunar.year.sacredYear}–${lunar.year.sacredYear + 1}` };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1, 12);
  const previous = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1, 12);
  const dates: Date[] = [];
  for (const date = new Date(start); date < next; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
  return { dates, previous, next,
    title: new Intl.DateTimeFormat(english ? "en-US" : "ru-RU", { month: "long", year: "numeric" }).format(start) };
}

export function SharedProjects({ userId, language, enabledCalendars, calendarMode, taskCalendarMode, onCalendarModeChange, experimentalTheme = false, timeFormat = "24h", destination, inboxWidth, onInboxWidth, inboxPosition, inboxHidden, inboxCompact, onInboxPosition, onInboxHidden, onInboxCompact, categoriesExpanded, onCategoriesExpanded, categoriesView, onCategoriesView }: Props) {
  const english = language === "en";
  const [initialPlace] = useState(() => (typeof window === "undefined" ? null : sharedPlaceFromUrl(new URL(window.location.href))) ?? (destination ? { spaceId: destination.spaceId, projectId: destination.projectId || "", taskId: "", view: null } : initialSharedPlace(userId)));
  const [requestedTaskId, setRequestedTaskId] = useState(initialPlace.taskId);
  const [commentId, setCommentId] = useState(initialPlace.commentId ?? "");
  const [locatedTaskId, setLocatedTaskId] = useState("");
  const locatedTaskApplied = useRef("");
  const initialRoute = useRef(true);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashTarget,setTrashTarget]=useState<{kind:"task";task:SharedTask;context:SharedProjectSnapshot}|{kind:"project";project:SharedProject}|null>(null);
  const [mapsOpen, setMapsOpen] = useState(() => typeof window !== "undefined" && Boolean(new URL(location.href).searchParams.get("mindmap")));
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const spacesRequest = useRef(0);
  const [spaceId, setSpaceId] = useState(initialPlace.spaceId);
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<SharedProject[]>([]);
  const [projectId, setProjectId] = useState(initialPlace.projectId);
  const projectIdRef = useRef(projectId);
  const spaceIdRef = useRef(spaceId);
  const [viewOverride, setViewOverride] = useState<"list" | "board" | "calendar" | "gantt" | null>(initialPlace.view);
  const [ganttDay, setGanttDay] = useState<string>();
  const [ganttReturnTarget, setGanttReturnTarget] = useState<GanttReturnTarget | null>(null);
  const [labels,setLabels] = useState<SharedLabel[]>([]);
  const [labelsOpen,setLabelsOpen] = useState(false);
  const [projectLabelIds,setProjectLabelIds] = useState<string[]>([]);
  const [editProjectLabelIds,setEditProjectLabelIds] = useState<string[]>([]);
  const [newTaskLabelIds,setNewTaskLabelIds] = useState<string[]>([]);
  const [editTaskLabelIds,setEditTaskLabelIds] = useState<string[]>([]);
  const [newPlan,setNewPlan] = useState(emptySharedPlan);
  const [editPlan,setEditPlan] = useState(emptySharedPlan);
  const [newTaskContext,setNewTaskContext] = useState<SharedProjectSnapshot|null>(null);
  const [newApprovalRequired, setNewApprovalRequired] = useState(false);
  const [newApproverIds, setNewApproverIds] = useState<string[]>([]);
  const [editApprovalRequired, setEditApprovalRequired] = useState(false);
  const [editApproverIds, setEditApproverIds] = useState<string[]>([]);
  const [approvalConfigChanged, setApprovalConfigChanged] = useState(false);
  const [newEntryType,setNewEntryType] = useState<EntryType>("task");
  const [editEntryType,setEditEntryType] = useState<EntryType>("task");
  const [activityKey,setActivityKey] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12); });
  const [calendarDay, setCalendarDay] = useState(() => localDateKey(new Date()));
  const [calendarAgendaProjectId, setCalendarAgendaProjectId] = useState<string | null>(null);
  const [calendarTaskPicker, setCalendarTaskPicker] = useState(false);
  const calendarAgendaRef = useRef<HTMLDialogElement>(null);
  const [snapshot, setSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [teamSnapshot, setTeamSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [uiReadySpace, setUiReadySpace] = useState("");
  const [invitations, setInvitations] = useState<SharedInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [createKind, setCreateKind] = useState<"project" | "task-list">("project");
  const [projectCategories, setProjectCategories] = useState<{ spaceId: string; items: import("./cloud-sync").SharedCategory[] }>({ spaceId: "", items: [] });
  const [projectCategoryId, setProjectCategoryId] = useState("");
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
  const isCompact = useSyncExternalStore(subscribeCompact, compactSnapshot, serverCompactSnapshot);
  const [taskSection, setTaskSection] = useState<"task" | "comments">("task");
  const [taskSnapshot, setTaskSnapshot] = useState<SharedProjectSnapshot | null>(null);
  const [comments, setComments] = useState<SharedComment[]>([]);
  const [editingSpaceId, setEditingSpaceId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SharedAffairSearch>({ projects: [], tasks: [] });
  const [searchBusy, setSearchBusy] = useState(false);
  const [projectTags, setProjectTags] = useState<string[]>([]);
  const [newTaskTags, setNewTaskTags] = useState("");
  const [editTaskTags, setEditTaskTags] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLayout, setProjectLayout] = useState<"list" | "board">("list");
  const [parentId, setParentId] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskFiles, setNewTaskFiles] = useState<TaskFileDraft[]>([]);
  const [newTaskImageReading, setNewTaskImageReading] = useState(false);
  const [editTaskFiles, setEditTaskFiles] = useState<TaskFileDraft[]>([]);
  const [removedTaskFileIds, setRemovedTaskFileIds] = useState<string[]>([]);
  const [editTaskFilesReading, setEditTaskFilesReading] = useState(false);
  const [newTaskCalendarMode, setNewTaskCalendarMode] = useState<CalendarMode>(taskCalendarMode);
  const [newTaskDestination, setNewTaskDestination] = useState<{ projectId: string; statusId?: string; title: string; isInbox: boolean } | null>(null);
  const [newTaskRootProjectId, setNewTaskRootProjectId] = useState("");
  const [editTaskCalendarMode, setEditTaskCalendarMode] = useState<CalendarMode>(taskCalendarMode);
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
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
  const [createModal, setCreateModal] = useState<"space" | "space-settings" | "project" | "task" | "status" | "invite" | "join" | "settings" | "team" | "board" | null>(null);
  const [boardTitleEdit, setBoardTitleEdit] = useState<{ id: string; title: string } | null>(null);
  const cancelledBoardTitleRef = useRef(false);
  const inboxProject = projects.find((project) => project.spaceId === spaceId && Boolean(project.isInbox));
  const inboxProjectId = inboxProject?.id;
  const taskProjectId = taskSnapshot?.project.id;
  const selectedTask = taskSnapshot?.tasks.find((task) => task.id === taskId);
  const taskOpen = Boolean(selectedTask);
  const closeTask = () => { setTaskId(""); setTaskSnapshot(null); setComments([]); setCommentId(""); };

  useEffect(() => {
    if (!spaceId) return;
    let live = true;
    void Promise.all([loadSharedUiState(spaceId), listSharedProjects(spaceId)]).then(([state, items]) => {
      if (!live) return;
      setExpandedIds(state.expandedIds); setUiReadySpace(spaceId);
      setProjectId(current => items.some(item => item.id === current) ? current : restoredSharedProject(items, state.expandedIds));
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
    const request = ++spacesRequest.current;
    const items = await listSharedSpaces();
    if (request !== spacesRequest.current) return;
    if (sharedDataCameFromOfflineCache()) setOffline(true);
    setSpaces((current) => JSON.stringify(current) === JSON.stringify(items) ? current : items);
    setSpaceId((current) => items.some((item) => item.id === current) ? current : "");
  }, []);
  const refreshProjects = useCallback(async (id: string) => {
    const [items, archived, spaceLabels, categories] = await Promise.all([listSharedProjects(id), listArchivedSharedProjects(id), listSharedLabels(id), listSharedProjectCategories(id)]);
    if (spaceIdRef.current !== id) return;
    setProjects((current) => JSON.stringify(current) === JSON.stringify(items) ? current : items);
    setArchivedProjects((current) => JSON.stringify(current) === JSON.stringify(archived) ? current : archived);
    setLabels(spaceLabels);
    setProjectCategories({ spaceId: id, items: categories });
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
    let pending = false;
    const refresh = async () => {
      if (pending || !navigator.onLine || document.visibilityState !== "visible") return;
      pending = true;
      try { await refreshSpaces(); } catch { /* Keep the current list while the connection recovers. */ }
      finally { pending = false; }
    };
    const timer = window.setTimeout(() => {
      void refreshSpaces().catch((error: unknown) => {
        if (live) setMessage(error instanceof Error ? error.message : String(error));
      }).finally(() => { if (live) setLoading(false); });
    }, 0);
    const poll = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false; window.clearTimeout(timer); window.clearInterval(poll);
      window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
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
        : taskFileError(error, english)); }
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
        title: projectTitle, description: projectDescription, tags: projectTags, layout: createKind === "task-list" ? "list" : projectLayout,
        parentId: parentId || null, boardStatusId: parentBoardId || null, kind: createKind,
        labelIds: projectLabelIds,
        categoryId: createKind === "project" ? projectCategoryId || null : null,
      });
      setProjectTitle(""); setProjectDescription(""); setProjectTags([]); setParentId(""); setProjectLabelIds([]); setProjectCategoryId("");
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
    if (!newTaskDestination || !newTaskTitle.trim() || newTaskImageReading) return;
    const destinationProjectId = newTaskDestination.projectId || inboxProject?.id;
    if (!destinationProjectId) return;
    void run(async () => {
      const destination = await loadSharedProject(destinationProjectId);
      if (newApprovalRequired && !newApproverIds.length) throw new Error(english ? "Select at least one participant." : "Выберите хотя бы одного участника.");
      const statusId = (newApprovalRequired ? undefined : newTaskDestination.statusId) ?? destination.statuses.find((status) => !status.isDone)?.id ?? destination.statuses[0]?.id;
      if (!statusId) throw new Error(english ? "Reload the workspace to create a task." : "Откройте пространство повторно, чтобы создать задачу.");
      const created = await createSharedTask(destination.project.id, {
        ...(newTaskFiles.length ? { attachments: newTaskFiles.map(({ name, data }) => ({ name, data })) } : {}),
        title: newTaskTitle.trim(), description: newTaskDescription.trim(), tags: splitTags(newTaskTags),
        dueDate: newTaskDueDate || null,
        labelIds: newTaskLabelIds, startDate:newPlan.startDate||null, startTime:newPlan.startTime||null, endTime:newPlan.endTime||null, dependsOnIds:newPlan.dependsOnIds,
        statusId, categoryId: null, assigneeId: null,
        approvalRequired: newApprovalRequired, approverIds: newApproverIds,
        entryType: newEntryType,
      });
      setNewTaskTitle(""); setNewTaskDescription(""); setNewTaskFiles([]); setNewTaskTags(""); setNewTaskDueDate("");
      window.dispatchEvent(new Event("genesis:shared-updates"));
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
  const moveTaskTo = (task: SharedTask, destinationProjectId: string, statusId = "", position = 0, schedule?:GanttTaskDates, nextView?:"list"|"board") => {
    if (busy) return;
    void run(async () => {
      const destination = destinationProjectId === snapshot?.project.id
        ? snapshot : await loadSharedProject(destinationProjectId);
      const resolvedStatus = statusId || destination.statuses.find((item) => !item.isDone)?.id
        || destination.statuses[0]?.id;
      if (!resolvedStatus) throw new Error(english ? "The destination has no task list." : "В месте назначения нет списка задач.");
      const moved = await moveSharedTask(task.projectId, task.id, {
        ...schedule,
        destinationProjectId, statusId: resolvedStatus, expectedRevision: task.revision,
        position: statusId ? position : destination.tasks.filter((item) => item.statusId === resolvedStatus).length,
      });
      if (moved.pending) {
        if (nextView) setViewOverride(nextView);
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
      if (nextView) setViewOverride(nextView);
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
  const returnGanttTask = (task:SharedTask, destination:GanttReturnTarget) => {
    const schedule = destination.unschedule ?? ganttUnscheduledSchedule(task, "days");
    if (destination.projectId !== task.projectId || destination.statusId && destination.statusId !== task.statusId) {
      moveTaskTo(task,destination.projectId,destination.statusId,destination.position,schedule,destination.view);
      return;
    }
    if (busy) return;
    void run(async () => {
      const changed = await updateSharedTask(task.projectId,task.id,{...schedule,expectedRevision:task.revision});
      setSnapshot(current => current?.project.id === task.projectId ? {...current,tasks:current.tasks.map(item=>item.id===task.id ? {...item,...changed,...schedule} : item)} : current);
      if (destination.view) setViewOverride(destination.view);
      if (!changed.pending) { await refreshProject(task.projectId); await refreshProjects(spaceId); }
      else setMessage(english ? "Schedule saved on this device and waiting for connection." : "Сроки сохранены на устройстве и ожидают подключения к сети.");
    });
  };
  const resolveSharedDrop = (x:number, y:number, item:SharedDragItem):SharedDropTarget | null => {
    if (busy) return null;
    const below = document.elementFromPoint(x, y);
    const unscheduled = below?.closest<HTMLElement>("[data-gantt-unscheduled]");
    const returnView = below?.closest<HTMLElement>("[data-shared-drop-view]")?.dataset.sharedDropView;
    if (snapshot && item.kind === "task" && (unscheduled || returnView === "list" || returnView === "board")
      && (snapshot.project.permissions?.editTasks ?? ["owner","manager","member"].includes(snapshot.project.role))) {
      return {projectId:snapshot.project.id,statusId:"",position:0,
        unschedule:ganttUnscheduledSchedule(item.task,unscheduled?.dataset.ganttUnscheduled as GanttScale || "days"),
        ...(returnView === "list" || returnView === "board" ? {view:returnView} : {})};
    }
    const axis=below?.closest<HTMLElement>("[data-gantt-axis]");
    if(axis&&snapshot&&item.kind==="task"&&(snapshot.project.permissions?.editTasks ?? ["owner","manager","member"].includes(snapshot.project.role))&&snapshot.project.canOrganizeTasks){
      const start=Number(axis.dataset.ganttStart),end=Number(axis.dataset.ganttEnd),scale=axis.dataset.ganttScale as GanttScale;
      const periods=JSON.parse(axis.closest<HTMLElement>('[data-gantt-periods]')?.dataset.ganttPeriods||'[]');
      const schedule=ganttSchedule(item.task,Math.max(start,Math.min(end-(scale==="day" ? 1/96 : 1),ganttAxisPoint(periods,x-axis.getBoundingClientRect().left))),scale);
      return {projectId:snapshot.project.id,statusId:"",position:0,schedule,ganttRow:axis.closest<HTMLElement>('[data-gantt-task]')?.dataset.ganttTask};
    }
    const calendarDate = below?.closest<HTMLElement>("[data-shared-calendar-date]")?.dataset.sharedCalendarDate;
    if (calendarDate && snapshot && item.kind === "task" && snapshot.project.canOrganizeTasks
      && (snapshot.project.permissions?.editTasks ?? ["owner", "manager", "member"].includes(snapshot.project.role))) {
      return { projectId: snapshot.project.id, statusId: "", position: 0, calendarDate,
        schedule: ganttSchedule(item.task, dateSerial(calendarDate), "days") };
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
  };
  const applySharedDrop = (item:SharedDragItem, destination:SharedDropTarget) => {
    if (!destination.projectId || busy) return;
    if (item.kind === "task") {
      if (destination.unschedule) { returnGanttTask(item.task,destination); return; }
      if(destination.schedule){
        if (destination.calendarDate) setCalendarDay(destination.calendarDate);
        scheduleTask(item.task,destination.schedule);return;
      }
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
  };
  const resolveGanttReturn = (x:number,y:number,task:SharedTask):GanttReturnTarget | null => {
    const target = resolveSharedDrop(x,y,{id:task.id,title:task.title,kind:"task",task});
    if (!target || target.schedule) return null;
    if ((target.projectId !== task.projectId || target.statusId && target.statusId !== task.statusId)
      && !snapshot?.project.canOrganizeTasks) return null;
    return target;
  };
  const sharedDrag = useAffairDrag<SharedDragItem, SharedDropTarget>(resolveSharedDrop,applySharedDrop);
  const dragPreview = sharedDrag.preview;
  const dropTarget:SharedDropTarget | null = sharedDrag.target ?? ganttReturnTarget;
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
    if (!taskProjectId || !taskId || editTaskFilesReading) return;
    void run(async () => {
      const changed = await updateSharedTask(taskProjectId, taskId, {
        ...(editTaskFiles.length ? { attachments: editTaskFiles.map(({ name, data }) => ({ name, data })) } : {}),
        ...(removedTaskFileIds.length ? { removeAttachmentIds: removedTaskFileIds } : {}),
        title: editTaskTitle.trim(), description: editTaskDescription.trim(), tags: splitTags(editTaskTags),
        dueDate: editTaskDueDate || null, categoryId: editTaskCategoryId || null,
        labelIds:editTaskLabelIds,startDate:editPlan.startDate||null,startTime:editPlan.startTime||null,endTime:editPlan.endTime||null,dependsOnIds:editPlan.dependsOnIds,
        expectedRevision: editTaskRevision,
        entryType: editEntryType,
        ...(approvalConfigChanged ? { approvalRequired: editApprovalRequired, approverIds: editApproverIds } : {}),
      });
      setEditTaskRevision(changed.revision);
      setEditTaskFiles([]); setRemovedTaskFileIds([]);
      setApprovalConfigChanged(false);
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
  const submitProjectEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snapshot) return;
    const fields = new FormData(event.currentTarget);
    const current = snapshot.project;
    void run(async () => {
      await updateSharedProject(current.id, {
        title: String(fields.get("title") ?? ""),
        description: String(fields.get("description") ?? ""), tags: JSON.parse(String(fields.get("tags") ?? "[]")),
        layout: String(fields.get("layout")) as "list" | "board",
        parentId: String(fields.get("parentId") ?? "") || null,
        expectedRevision: current.revision,
        labelIds: editProjectLabelIds,
        categoryId: String(fields.get("categoryId") ?? "") || null,
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
  const activeView = viewOverride ?? (isCompact ? "list" : snapshot?.project.layout ?? "list");
  const calendarPeriod = sharedCalendarPeriod(calendarMonth, calendarMode, english, language);
  const calendarOffset = calendarPeriod.dates.length ? (calendarPeriod.dates[0].getDay() + 6) % 7 : 0;
  const calendarDays = [
    ...Array.from({ length: calendarOffset }, () => null),
    ...calendarPeriod.dates,
  ];
  const { active: activeCalendarTasks, completed: completedCalendarTasks } = ganttTaskGroups(snapshot?.tasks ?? [], snapshot?.statuses ?? []);
  const completedCalendarIds = new Set(completedCalendarTasks.map(task => task.id));
  const calendarTasks = activeCalendarTasks.filter(task => task.dueDate === calendarDay);
  const completedDayTasks = completedCalendarTasks.filter(task => task.dueDate === calendarDay);
  const calendarTaskChoices = activeCalendarTasks.filter(task => task.dueDate !== calendarDay);
  const undatedCalendarTasks = activeCalendarTasks.filter(task => !task.dueDate);
  const calendarAgendaOpen = Boolean(snapshot && activeView === "calendar" && calendarAgendaProjectId === snapshot.project.id);
  useEffect(() => {
    const dialog = calendarAgendaRef.current;
    if (!dialog) return;
    if (calendarAgendaOpen && !dialog.open) dialog.showModal();
    if (!calendarAgendaOpen && dialog.open) dialog.close();
  }, [calendarAgendaOpen]);
  const openTask = useCallback((task: SharedTask, context = snapshot) => {
    if (!context || context.project.id !== task.projectId) return;
    setMessage("");
    setTaskSnapshot(context);
    setTaskSection("task");
    setCommentId("");
    setTaskId(task.id); setComments([]);
    setEditTaskCalendarMode(taskCalendarMode);
    setEditTaskFiles([]); setRemovedTaskFileIds([]);
    setEditTaskTitle(task.title); setEditTaskDescription(task.description); setEditTaskTags((task.tags ?? []).join(", "));
    setEditTaskDueDate(task.dueDate ?? ""); setEditTaskCategoryId(task.categoryId ?? "");
    setEditTaskRevision(task.revision);
    setEditTaskLabelIds(task.labelIds||[]);setEditPlan(taskSharedPlan(task));
    setEditEntryType(task.entryType ?? "task");
    setEditApprovalRequired(Boolean(task.approvalRequired)); setEditApproverIds((task.approvals ?? []).flatMap(item => item.userId ? [item.userId] : [])); setApprovalConfigChanged(false);
  }, [snapshot, taskCalendarMode, setMessage, setTaskSnapshot, setTaskId, setComments, setEditTaskCalendarMode, setEditTaskTitle, setEditTaskDescription, setEditTaskTags, setEditTaskDueDate, setEditTaskCategoryId, setEditTaskRevision, setEditTaskLabelIds, setEditPlan, setEditTaskFiles, setRemovedTaskFileIds]);
  useEffect(() => {
    const restore = () => {
      if (!window.location.hash.startsWith("#projects")) return;
      const place = sharedPlaceFromUrl(new URL(window.location.href)); if (!place) return;
      setSpaceId(place.spaceId); setProjectId(place.projectId); setViewOverride(place.view);
      setRequestedTaskId(place.taskId); setTaskId(""); setTaskSnapshot(null); setComments([]);
      setCommentId(place.commentId ?? "");
      locatedTaskApplied.current = "";
    };
    window.addEventListener("popstate", restore); window.addEventListener("genesis:shared-route", restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("genesis:shared-route", restore); };
  }, []);
  useEffect(() => {
    if (!requestedTaskId || !projectId || uiReadySpace !== spaceId) return;
    let live = true;
    void loadSharedProject(projectId).then(result => {
      if (!live) return;
      const task = result.tasks.find(item => item.id === requestedTaskId);
      const place = sharedPlaceFromUrl(new URL(window.location.href));
      if (task && place?.taskAction === "locate") {
        setSnapshot(result); setViewOverride(result.project.layout); setLocatedTaskId(task.id);
        setExpandedIds(ids => [...new Set([...ids, projectId])]);
      } else if (task) {
        openTask(task, result);
        if (place?.taskAction === "comments") { setTaskSection("comments"); setCommentId(place.commentId ?? ""); }
      }
      else setMessage(english ? "This task is no longer available." : "Эта задача больше недоступна.");
      setRequestedTaskId("");
    }).catch(() => { if (live) { setMessage(english ? "Could not open the task. Check your access and connection." : "Не удалось открыть задачу. Проверьте доступ и подключение."); setRequestedTaskId(""); } });
    return () => { live = false; };
  }, [requestedTaskId, projectId, spaceId, uiReadySpace, openTask, english]);
  useEffect(() => {
    if (!locatedTaskId || !snapshot || locatedTaskApplied.current === locatedTaskId) return;
    const frame = window.requestAnimationFrame(() => {
      const row = Array.from(document.querySelectorAll<HTMLElement>("[data-shared-task-id]")).find(item => item.dataset.sharedTaskId === locatedTaskId);
      if(row)locatedTaskApplied.current = locatedTaskId;
      row?.scrollIntoView({ block: "center", behavior: "auto" }); row?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [locatedTaskId, snapshot]);
  useEffect(() => {
    if (loading || requestedTaskId || (spaceId && uiReadySpace !== spaceId)) return;
    if (!window.location.hash.startsWith("#projects")) return;
    recordSharedPlace(userId, { spaceId, projectId: taskId ? taskSnapshot?.project.id ?? projectId : projectId, taskId, view: viewOverride,
      ...(taskId && taskSection === "comments" ? { taskAction: "comments", ...(commentId ? { commentId } : {}) } : {}) }, initialRoute.current);
    initialRoute.current = false;
  }, [userId, spaceId, projectId, taskId, taskSnapshot?.project.id, viewOverride, loading, requestedTaskId, uiReadySpace, taskSection, commentId]);
  const canWrite = snapshot && (snapshot.project.permissions?.editTasks ?? ["owner", "manager", "member"].includes(snapshot.project.role));
  const canInvite = snapshot && (snapshot.project.permissions?.inviteMembers ?? ["owner", "manager"].includes(snapshot.project.role));
  const canManage = snapshot && (snapshot.project.permissions?.manageProjects ?? ["owner", "manager"].includes(snapshot.project.role));
  const canEditTask = taskSnapshot && (taskSnapshot.project.permissions?.editTasks ?? ["owner", "manager", "member"].includes(taskSnapshot.project.role));
  const canCommentTask = taskSnapshot && (taskSnapshot.project.permissions?.comment ?? ["owner", "manager", "member", "commenter"].includes(taskSnapshot.project.role));
  const selectedSpace=spaces.find(space=>space.id===spaceId);
  const confirmTask = (task: SharedTask) => {
    if (busy) return;
    void run(async () => {
      const result = await approveSharedTask(task.projectId, task.id);
      setEditTaskRevision(result.revision);
      await refreshTaskProject(task.projectId); await refreshProject(task.projectId); await refreshProjects(spaceId);
      if (task.projectId === inboxProjectId) setInboxPreview(await loadSharedProject(task.projectId));
      window.dispatchEvent(new Event("genesis:shared-updates"));
      setMessage(result.completedAt ? (english ? "Task completed." : "Задача завершена.") : (english ? "Your confirmation is saved. Waiting for the other participants." : "Ваше подтверждение сохранено. Ожидаем остальных участников."));
    });
  };
  const removeTask = (task:SharedTask,context:SharedProjectSnapshot) => {
    if(!busy&&context.project.canOrganizeTasks)setTrashTarget({kind:"task",task,context});
  };
  const renderTaskActions = (task: SharedTask, context: SharedProjectSnapshot) => <div className="shared-task-actions" onPointerDown={event => event.stopPropagation()}>
    {(context.project.permissions?.editTasks ?? ["owner", "manager", "member"].includes(context.project.role)) ? <button type="button" disabled={busy || task.pending}
      title={translateText("Редактировать задачу")} aria-label={`${translateText("Редактировать задачу")} «${task.title}»`}
      onClick={() => openTask(task, context)}><ExperimentalIcon name="edit" /></button> : null}
    {context.project.canOrganizeTasks ? <button type="button" className="shared-task-delete-icon" disabled={busy || task.pending}
      title={translateText("Удалить задачу")} aria-label={`${translateText("Удалить задачу")} «${task.title}»`}
      onClick={() => removeTask(task, context)}><ExperimentalIcon name="close" /></button> : null}
  </div>;
  const renderBoardTask = (task: SharedTask, status: SharedStatus) => {
    if (!snapshot) return null;
    return <article key={task.id}
            className={`shared-projects-task shared-affair-draggable${locatedTaskId === task.id ? " task-location-highlight" : ""}`} data-shared-task-id={task.id}
            {...sharedDrag.props({ id: task.id, title: task.title, kind: "task", task }, !busy && Boolean(snapshot.project.canOrganizeTasks))}>

            <div className="shared-task-card-title">
            <input type="checkbox" className="shared-task-complete" checked={Boolean(status.isDone) || Boolean(task.approvalRequired && task.approvals?.some(item => item.userId === userId && item.approvedAt))} disabled={busy||task.pending||(task.approvalRequired && !status.isDone ? !task.approvals?.some(item => item.userId === userId && !item.approvedAt) : !snapshot.project.canOrganizeTasks||!snapshot.statuses.some(item=>Boolean(item.isDone)!==Boolean(status.isDone)))}
              data-no-translate aria-label={`${translateText(status.isDone ? "Вернуть в работу задачу" : "Выполнить задачу",language as import("./i18n").Language)} «${task.title}»`}
              onChange={()=>{if(task.approvalRequired && !status.isDone){confirmTask(task);return;}const target=snapshot.statuses.find(item=>Boolean(item.isDone)!==Boolean(status.isDone));if(target)moveTask(task,target.id);}}/>
            <SharedBoardTaskTitle key={`${task.id}:${boardDisplay(status).titleLines}`} title={task.title} lines={activeView === "board" ? boardDisplay(status).titleLines : 0} english={english} selected={taskId === task.id} onOpen={() => openTask(task)}>{task.tags?.length ? <em>{task.tags.map((tag) => `#${tag}`).join(" ")}</em> : null}<small>{task.dueDate ? formatCalendarDate(new Date(`${task.dueDate}T12:00:00`), calendarMode) : (english ? "No due date" : "Без срока")}</small>
            </SharedBoardTaskTitle>
            </div><SharedLabelBadges labels={labels} ids={task.labelIds}/>
            {task.entryType && task.entryType !== "task" ? <small className="entry-type-badge">{entryTypeLabel(task.entryType,english)}</small> : null}
            {task.approvalRequired ? <small className="shared-task-approval-progress">{english ? "Confirmations" : "Подтверждения"}: {task.approvals?.filter(item => item.approvedAt).length ?? 0}/{task.approvals?.length ?? 0}</small> : null}
            {task.completedBy ? <small>{english ? "Completed by" : "Выполнил(а)"}: {snapshot.members.find((member) => member.userId === task.completedBy)?.displayName ?? (english ? "Former member" : "Бывший участник")}</small> : null}
            <SharedTaskReview task={task} userId={userId} onChanged={async()=>{await refreshProject(task.projectId);}}/>
            <div className="shared-task-card-controls">
            {activeView !== "board" && snapshot.project.canOrganizeTasks ? <select aria-label={english ? "Status" : "Статус"} value={task.statusId} disabled={busy} onChange={(event) => moveTask(task, event.target.value)}>
              {snapshot.statuses.map((item) => <option key={item.id} value={item.id}>{statusLabel(item.title)}</option>)}
            </select> : null}
            {renderTaskActions(task, snapshot)}
            </div>
          </article>;
  };
  const canManageLabels=selectedSpace && (selectedSpace.permissions?.manageProjects ?? ["owner","admin"].includes(selectedSpace.role));
  const projectCategorySection = <SharedProjectCategories key={spaceId} spaceId={spaceId}
    categories={projectCategories.spaceId === spaceId ? projectCategories.items : []} projects={projects}
    canManage={Boolean(canManageLabels)} english={english}
    expanded={categoriesExpanded} onExpanded={onCategoriesExpanded}
    view={categoriesView} onView={onCategoriesView}
    onChanged={async () => { await refreshProjects(spaceId); if (snapshot) await refreshProject(snapshot.project.id); }}
    onOpen={project => { setProjectId(project.id); setSnapshot(null); persistExpansion([...new Set([...expandedIds, project.id])]); }} />;
  const taskDestinationIds = new Set(newTaskRootProjectId ? [newTaskRootProjectId] : []);
  for (let count = -1; count !== taskDestinationIds.size;) {
    count = taskDestinationIds.size;
    projects.forEach(project => { if (project.parentId && taskDestinationIds.has(project.parentId)) taskDestinationIds.add(project.id); });
  }
  const taskDestinationProjects = sharedProjectTree(projects.filter(project => taskDestinationIds.has(project.id)));
  const openCreateTask = (project: SharedProject, status?: SharedStatus, kind: "task" | "task-list" | "meeting" | "event" = "task", chooseProject = false) => {
    setNewTaskFiles([]);
    setNewApprovalRequired(false); setNewApproverIds([]);
    setNewEntryType(kind === "meeting" || kind === "event" ? kind : "task");
    setNewTaskRootProjectId(chooseProject ? project.id : "");
    setNewTaskDestination({ projectId: project.id, statusId: status?.id,
      title: project.isInbox ? `${english ? "Workspace inbox" : "Хаос-бокс пространства"}: ${selectedSpace?.title ?? ""}` : status ? `${project.title} · ${statusLabel(status.title)}` : project.title, isInbox: Boolean(project.isInbox) });
    setNewTaskCalendarMode(taskCalendarMode);
    setNewPlan(emptySharedPlan());setNewTaskLabelIds([]);setNewTaskDueDate("");setNewTaskTitle("");setNewTaskDescription("");setNewTaskTags("");
    setNewTaskContext(null);void loadSharedProject(project.id).then(setNewTaskContext).catch(()=>undefined);
    setProjectTitle(""); setProjectDescription(""); setProjectTags([]); setProjectLabelIds([]); setProjectCategoryId("");
    setCreateKind("task-list"); setParentId(project.isInbox ? "" : project.id); setParentBoardId(status?.id ?? "");
    setCreateModal(kind === "task-list" ? "project" : "task");
  };
  const renderCalendarDate = (date: Date) => {
    const key = localDateKey(date);
    const isToday = key === localDateKey(new Date());
    const dayTasks = activeCalendarTasks.filter(task => task.dueDate === key);
    const count = dayTasks.length;
    const dayNumber = calendarMode === "sacred" ? getSacredDate(date).day
      : calendarMode === "lunar" ? getLunarDate(date).day : date.getDate();
    return <button key={key} type="button" className="shared-projects-calendar-date"
      data-shared-calendar-date={key} data-drop-active={dropTarget?.calendarDate === key || undefined}
      data-has-tasks={count > 0 || undefined} data-weekend={calendarMode === "profane" && [0, 6].includes(date.getDay()) || undefined}
      data-selected={key === calendarDay || undefined} aria-current={isToday ? "date" : undefined}
      data-calendar-date={key}
      aria-haspopup="dialog"
      aria-label={`${formatCalendarDate(date, calendarMode, true)}${isToday ? english ? " · Today" : " · Сегодня" : ""}${count ? english ? ` · ${count} tasks` : ` · задач: ${count}` : ""}`}
      onClick={() => { setCalendarDay(key); setCalendarTaskPicker(false); setCalendarAgendaProjectId(snapshot?.project.id ?? null); }}>
      {isToday ? <span className="shared-calendar-today-pill"><span>{dayNumber}</span><span>{english ? "Today" : "Сегодня"}</span></span> : <span>{dayNumber}</span>}
      {calendarMode !== "profane" ? <time dateTime={key}>{formatGregorian(date)}</time> : null}
      {count > 0 && count <= 3 ? <span className="shared-calendar-date-tasks" aria-hidden="true">
        {dayTasks.map(task => <span className="shared-calendar-date-task" key={task.id} title={task.title} data-no-translate>{task.title}</span>)}
      </span> : null}
      {count ? <small className="shared-calendar-task-count">{count}</small> : null}
    </button>;
  };
  const renderCalendarTask = (task: SharedTask) => snapshot ? <article key={task.id} className={`shared-calendar-task${completedCalendarIds.has(task.id) ? " is-completed" : ""}`}
    style={{ "--shared-task-status-color": snapshot.statuses.find(status => status.id === task.statusId)?.color ?? "#2d6c68" } as CSSProperties}
    {...sharedDrag.props({ id: task.id, title: task.title, kind: "task", task }, !completedCalendarIds.has(task.id) && !busy && Boolean(snapshot.project.canOrganizeTasks) && Boolean(canWrite))}>
    <button type="button" className="shared-calendar-task-open" data-affair-drag-surface onClick={() => openTask(task)}>
      <strong data-no-translate>{task.title}</strong>
      {task.entryType && task.entryType !== "task" ? <span className="entry-type-badge">{entryTypeLabel(task.entryType,english)}</span> : null}
      <span className="shared-calendar-task-status">{statusLabel(snapshot.statuses.find((status) => status.id === task.statusId)?.title ?? "")}</span>
      {task.startTime ? <span>{formatTimeValue(task.startTime, timeFormat)}{task.endTime ? ` — ${formatTimeValue(task.endTime, timeFormat)}` : ""}</span> : null}
    </button>
    {renderTaskActions(task, snapshot)}
  </article> : null;

  if (sharedMindmapsEnabled && mapsOpen && selectedSpace && uiReadySpace === spaceId) return <Suspense fallback={<p role="status">Открываем зашифрованные карты…</p>}><SharedSpaceCollaboration key={spaceId} userId={userId} spaceId={spaceId} language={language}/><SharedMindmaps
    userId={userId} space={selectedSpace} projects={projects} projectId={projectId} language={language} enabledCalendars={enabledCalendars} timeFormat={timeFormat}
    onClose={() => { setMapsOpen(false); const url=new URL(location.href); url.searchParams.delete("mindmap"); history.replaceState(history.state,"",url); }}
    onTask={(task,context)=>{setMapsOpen(false);openTask(task,context);}}
    onProject={(id,calendar)=>{setMapsOpen(false);setProjectId(id);setSnapshot(null);setViewOverride(calendar?"calendar":null);}}/></Suspense>;
  return <div className="shared-projects" data-exp-layout="view">
    <WorkspaceHeader title={english ? "Affairs · shared" : "Дела · общие"}
      overviewLabel={english ? "Workspace overview" : "Обзор пространства"}
      context={selectedSpace ? <SharedWorkspaceIdentity key={spaceId} title={selectedSpace.title}
        owner={selectedSpace.ownerName ?? visibleInbox?.members.filter(member => member.spaceRole === "owner").map(member => member.displayName).join(", ") ?? ""}
        members={selectedSpace.memberCount ?? visibleInbox?.members.length}
        description={selectedSpace.description} english={english} /> : undefined}
      mark={<ProjectsHeroMark shared />} description={english
        ? "Plan together while keeping personal tasks, habits and calendars private."
        : "Планируйте вместе. Личные задачи, привычки и календарь остаются вашими."}>
      <SharedWorkspaceSummary userId={userId} english={english} onOpen={place => {
        void refreshSpaces();
        recordSharedPlace(userId, { ...place, taskId: place.taskId || "", view: null });
        window.dispatchEvent(new Event("genesis:shared-route"));
      }} />
    </WorkspaceHeader>
    {spaces.length ? <section className="shared-workspace-toolbar" aria-label={english ? "Workspace controls" : "Управление пространством"}>
      <div className="shared-workspace-toolbar-group" role="group" aria-label={english ? "Workspace" : "Пространство"}>
      <select aria-label={english ? "Current workspace" : "Текущее пространство"} value={spaceId} onChange={event => {
        setSpaceId(event.target.value); setProjects([]); setProjectId(""); setSnapshot(null); closeTask();
      }}><option value="">{english ? "Choose a workspace" : "Выберите пространство"}</option>
        {spaces.map(space => <option key={space.id} value={space.id}>{space.title}</option>)}
      </select>
      <MobileDisclosure label={english ? "Workspace controls" : "Управление пространством"} className="shared-mobile-tools"><div className="shared-workspace-tools">
      {["owner", "admin"].includes(selectedSpace?.role ?? "") ? <button type="button" className="secondary-button" title={english ? "Workspace settings" : "Настройки пространства"} aria-label={english ? "Workspace settings" : "Настройки пространства"}
        onClick={() => { setEditingSpaceId(spaceId); setCreateModal("space-settings"); }}><ExperimentalIcon name="gear" /></button> : null}
      {canManageLabels ? <button type="button" className="secondary-button" title={english ? "Labels" : "Метки"} aria-label={english ? "Labels" : "Метки"} onClick={() => setLabelsOpen(true)}><ExperimentalIcon name="tag" /></button> : null}
      {spaceId ? <button type="button" className="secondary-button" disabled={busy || !inboxProject} title={english ? "Team and invitations" : "Команда и приглашения"} aria-label={english ? "Team and invitations" : "Команда и приглашения"}
        onClick={() => void run(async () => { if (inboxProject) setTeamSnapshot(await loadSharedProject(inboxProject.id)); setCreateModal("team"); })}><ExperimentalIcon name="team" /></button> : null}
      <button type="button" className="secondary-button" title={english ? "All workspaces" : "Все пространства"} aria-label={english ? "All workspaces" : "Все пространства"}
        onClick={() => { setSpaceId(""); setProjectId(""); setSnapshot(null); closeTask(); }}><ExperimentalIcon name="spaces" /></button>
      <button type="button" className="secondary-button" title={english ? "Create workspace" : "Создать пространство"} aria-label={english ? "Create workspace" : "Создать пространство"} onClick={() => setCreateModal("space")}><ExperimentalIcon name="space-plus" /></button>
      </div></MobileDisclosure></div>
    {spaceId ? <label className="tag-search personal-affairs-search shared-workspace-search"><span aria-hidden="true">{experimentalTheme ? <ExperimentalIcon name="search" /> : "⌕"}</span><input type="search" aria-label={english ? "Find tasks and projects by title or tag" : "Поиск задач и проектов по названию или #тегу"} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchBusy(Boolean(event.target.value.trim())); setSearchResults({ projects: [], tasks: [] }); }} placeholder={english ? "Find tasks and projects by title or #tag" : "Поиск задач и проектов по названию или #тегу"} /></label> : null}
      {spaceId ? <div className="shared-project-toolbar-group" role="group" aria-label={english ? "Projects in workspace" : "Проекты пространства"}>
        {projects.some(project => !project.isInbox) ? <select value={projectId} aria-label={english ? "Current project" : "Текущий проект"} onChange={event => {
          setProjectId(event.target.value); setSnapshot(null); closeTask(); setViewOverride(null);
          if (event.target.value) persistExpansion([...new Set([...expandedIds, event.target.value])]);
        }}><option value="">{english ? "Choose a project" : "Выберите проект"}</option>
          {sharedProjectTree(projects).map(({ project, depth }) => <option value={project.id} key={project.id}>
            {depth ? `${"\u00a0\u00a0".repeat(depth)}↳ ` : ""}{project.title} · {formatTaskCount(project.taskCount ?? 0, language as import("./i18n").Language)}
          </option>)}
        </select> : null}
        {selectedSpace && (selectedSpace.permissions?.createProjects ?? selectedSpace.role !== "guest") ? <button type="button"
          className={projects.some(project => !project.isInbox) ? "secondary-button" : "primary-button shared-create-first-project"}
          title={english ? "Create project" : "Создать проект"}
          aria-label={projects.some(project => !project.isInbox) ? english ? "Create project" : "Создать проект" : english ? "Create your first project" : "Создать первый проект"}
          onClick={() => { setCreateKind("project"); setParentId(""); setParentBoardId(""); setCreateModal("project"); }}><ExperimentalIcon name="project-plus" />
          {!projects.some(project => !project.isInbox) ? english ? "Create your first project" : "Создать первый проект" : null}</button> : null}
      </div> : null}
      {selectedSpace ? <button type="button" className="secondary-button shared-trash-open" aria-label="Корзина" title="Корзина" onClick={()=>setTrashOpen(true)}><ExperimentalIcon name="delete"/></button> : null}
      {sharedMindmapsEnabled && selectedSpace ? <button type="button" className="primary-button shared-mindmaps-open" onClick={()=>{closeTask();setSearchQuery("");setMapsOpen(true);}}><ExperimentalIcon name="map-mode"/><span>Майндмепы</span></button> : null}
    </section> : null}
    {trashOpen && selectedSpace ? <SharedTrash spaceId={spaceId} onClose={()=>setTrashOpen(false)} onChanged={async()=>{await refreshProjects(spaceId);if(projectId)await refreshProject(projectId);}}/> : null}
    {trashTarget ? <SharedTrashConfirmation title={trashTarget.kind==="task"?trashTarget.task.title:trashTarget.project.title} onClose={()=>setTrashTarget(null)} onConfirm={async days=>{
      if(trashTarget.kind==="task") {const {task,context}=trashTarget;await deleteSharedTask(context.project.id,task.id,task.revision,days);if(taskId===task.id)closeTask();await refreshProject(context.project.id);if(context.project.isInbox)setInboxPreview(await loadSharedProject(context.project.id));}
      else {await trashSharedProject(trashTarget.project,days);setProjectId("");setSnapshot(null);setCreateModal(null);closeTask();}
      await refreshProjects(spaceId);window.dispatchEvent(new Event("genesis:shared-updates"));
    }}/> : null}
    {selectedSpace ? <Suspense fallback={null}><SharedSpaceCollaboration key={spaceId} userId={userId} spaceId={spaceId} language={language}/></Suspense> : null}
    <ActionNotice message={notice}/>
    {projectToComplete ? <ProjectCompletionDialog fileRetentionWarning title={projectToComplete.title} onCancel={() => setProjectToComplete(null)} onConfirm={confirmProjectCompletion} /> : null}
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

    {searchQuery.trim() ? <section className="tag-search-results" aria-label="Результаты поиска дел" aria-live="polite" aria-busy={searchBusy}>
      <header><strong>{english ? "Search results" : "Результаты поиска"}</strong><span>{searchResults.projects.length} проектов · {searchResults.tasks.length} задач</span></header>
      <div>{searchResults.projects.filter((project) => !project.isInbox).map((project) => <button type="button" key={project.id} onClick={() => { setSearchQuery(""); setProjectId(project.id); setSnapshot(null); }}><span>Проект</span><strong>{project.title}</strong><small>{project.tags?.map((tag) => `#${tag}`).join(" ")}</small></button>)}
        {searchResults.tasks.map((task) => <button type="button" key={task.id} onClick={() => void run(async () => {
          const result = await loadSharedProject(task.projectId);
          const found = result.tasks.find((item) => item.id === task.id);
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
    {spaceId && inboxHidden ? <InboxRestore english={english} onRestore={() => onInboxHidden(false)} /> : null}
    <div className="shared-projects-shell" hidden={!spaceId} data-inbox-workspace data-inbox-position={inboxPosition} data-inbox-hidden={inboxHidden}>
    <aside className="shared-projects-sidebar" hidden={inboxHidden} data-inbox-compact={inboxCompact} id="shared-projects-sidebar" aria-label={english ? "Workspace inbox" : "Хаос-бокс пространства"}>
      {inboxProject ? <section className="inbox-card shared-projects-inbox-card"
        data-shared-drop-project={inboxProject.id}
        data-drop-active={dropTarget?.projectId === inboxProject.id && !dropTarget.statusId || undefined}
        aria-label={english ? "Shared inbox" : "Хаос-бокс"}>
          <InboxToolbar title={english ? "Inbox" : "Хаос-бокс"} scopeLabel={english ? "this workspace" : "этого пространства"} count={visibleInbox?.tasks.length ?? inboxProject.taskCount ?? 0}
            english={english} position={inboxPosition} compact={inboxCompact} onCompact={onInboxCompact} onPosition={onInboxPosition} onHide={() => onInboxHidden(true)} />
          <p>{english ? "New tasks start here. Open a task or drag it to a board to organize it." : "Новые задачи появляются здесь. Откройте задачу или перетащите её на доску, чтобы распределить."}</p>
        <div className="shared-projects-inbox-items">
          {!visibleInbox ? <p role="status">{english ? "Loading tasks…" : "Загружаем задачи…"}</p>
            : visibleInbox.tasks.length ? visibleInbox.tasks.map((task) => <article key={task.id} data-shared-task-id={task.id} className={`shared-inbox-task shared-affair-draggable${locatedTaskId === task.id ? " task-location-highlight" : ""}`}
              {...sharedDrag.props({ id: task.id, title: task.title, kind: "task", task }, !busy && Boolean(visibleInbox.project.canOrganizeTasks))}>
              <button type="button" data-affair-drag-surface
              onClick={() => openTask(task, visibleInbox)}>
              <strong title={task.title}>{task.title}</strong>{task.tags?.length ? <em>{task.tags.map((tag) => `#${tag}`).join(" ")}</em> : null}<small>{task.dueDate ? formatCalendarDate(new Date(`${task.dueDate}T12:00:00`), calendarMode)
                : (english ? "No due date" : "Без срока")}</small>
            </button>{renderTaskActions(task, visibleInbox)}</article>) : <p>{english ? "No unsorted tasks yet." : "Задач без проекта пока нет."}</p>}

        </div>
      </section> : null}
    </aside>

    {!inboxHidden ? <InboxResizeBoundary position={inboxPosition} width={inboxWidth} onWidth={onInboxWidth} /> : null}
    <main className="shared-projects-main">

    {snapshot && snapshot.project.id === projectId ? <>
      <div className="shared-project-workspace">
      <header className="shared-projects-context" data-shared-drop-project={snapshot.project.id} data-drop-active={dropTarget?.projectId === snapshot.project.id && !dropTarget.statusId || undefined}>
        <div className="shared-project-heading">
          {!snapshot.project.isInbox && snapshot.project.role === "owner" ? <button type="button" className={`project-complete-action${completedPulse ? " is-completing" : ""}`} disabled={busy} onClick={archiveProject} title={translateText("Завершить проект")} aria-label={`${translateText("Завершить проект")} «${snapshot.project.title}»`}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></svg></button> : null}
          <h2>{snapshot.project.isInbox ? (english ? "Team tasks" : "Задачи команды") : snapshot.project.title}</h2>
        </div>
      <div className="shared-context-actions">
        {(canManage || canInvite) && !snapshot.project.isInbox ? <button type="button" className="secondary-button shared-project-settings-icon" title={english ? "Project settings" : "Настройки проекта"} aria-label={english ? "Project settings" : "Настройки проекта"} onClick={() => {setEditProjectLabelIds(snapshot.project.labelIds||[]);setCreateModal("settings");}}><ExperimentalIcon name="gear" /></button> : null}
      </div>
        <div className="shared-project-details">
          {!snapshot.project.isInbox && snapshot.project.description ? <p>{snapshot.project.description}</p> : null}
          <SharedLabelBadges labels={labels} ids={snapshot.project.labelIds}/>
        </div>
      </header>
      {projects.some(project => project.parentId === snapshot.project.id) ? <nav className="shared-current-subprojects" aria-label={english ? "Subprojects" : "Подпроекты"}>{renderProjectTree(snapshot.project.id)}</nav> : null}
      <section className="shared-projects-task-panel" aria-labelledby="shared-projects-tasks-title">
      <section className="shared-projects-planning" aria-label={english ? "Tasks and views" : "Задачи и виды проекта"}>
        <h3 id="shared-projects-tasks-title">{english ? "Tasks" : "Задачи"}</h3>
      <div className="shared-planning-controls">
      <div className="shared-planning-view">
      <p className="shared-projects-calendar-mode-label">{english ? "Project view" : "Вид проекта"}</p>
      <div className="shared-projects-view-switch" role="group" aria-label={english ? "Project view" : "Вид проекта"}>
        {(["list", "board", "calendar", "gantt"] as const).map((item) => <button key={item} type="button"
          data-shared-drop-view={item === "list" || item === "board" ? item : undefined}
          data-drop-active={dropTarget?.view === item || undefined}
          aria-pressed={activeView === item} onClick={() => {setGanttDay(undefined);setViewOverride(item);}}>{item === "list"
            ? (english ? "List" : "Список") : item === "board" ? (english ? "Boards" : "Доски")
              : item === "gantt" ? (english ? "Gantt" : "Гант") : (english ? "Calendar" : "Календарь")}</button>)}
      </div>
      </div>
      {canWrite && !snapshot.project.isInbox ? <div className="shared-projects-create-actions">
        <button type="button" className="shared-projects-open-modal primary-button" aria-label={english ? "Create task" : "Создать задачу"} title={english ? "Create task" : "Создать задачу"} onClick={() => openCreateTask(snapshot.project, undefined, "task", true)}>
          <ExperimentalIcon name="plus" /><span className="shared-create-full">{english ? "Create task" : "Создать задачу"}</span><span className="shared-create-short">{english ? "Task" : "Задача"}</span>
        </button>
      </div> : null}
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
      {activeView === "gantt" ? <SharedGantt snapshot={snapshot} english={english} calendarMode={calendarMode} timeFormat={timeFormat} initialDay={ganttDay} onOpen={openTask} onCreate={schedule=>{openCreateTask(snapshot.project);setNewPlan({startDate:schedule.startDate,startTime:schedule.startTime||"",endTime:schedule.endTime||"",dependsOnIds:[]});setNewTaskDueDate(schedule.dueDate);}} onSchedule={scheduleTask} onReturn={returnGanttTask} resolveReturn={resolveGanttReturn} onReturnTarget={setGanttReturnTarget} busy={busy} externalDrop={sharedDrag.target?.schedule} externalDropRow={sharedDrag.target?.ganttRow}/> : activeView === "calendar" ? <section className="shared-projects-calendar" aria-label={english ? "Project calendar" : "Календарь проекта"}>
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
            {ELEMENTS.map((element) => <span key={element.name}>{translateText(element.name, language as import("./i18n").Language)}</span>)}
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
                <span>{translateText(firstDay.pyataTitle || "Апейрон", language as import("./i18n").Language)}</span></header>
              <div className="shared-projects-cycle-days">{dates.map(renderCalendarDate)}</div>
            </section>;
          })}
        </div> : <div className="shared-projects-calendar-cycles mode-lunar">
          {LUNAR_DECADES.map((decade) => <section className="shared-projects-calendar-cycle" key={decade.id}
            aria-label={translateText(decade.name, language as import("./i18n").Language)}>
            <header><strong>{translateText(decade.name, language as import("./i18n").Language)}</strong><span>{translateText(decade.range, language as import("./i18n").Language)}</span></header>
            <div className="shared-projects-cycle-days">{calendarPeriod.dates.filter((date) => getLunarDate(date).decade.id === decade.id).map(renderCalendarDate)}</div>
          </section>)}
        </div>}
        {undatedCalendarTasks.length ? <details className="shared-projects-calendar-undated">
          <summary><ExperimentalIcon name="chevron" /><span>{english ? "Tasks without a due date" : "Задачи без срока"}</span><small>{undatedCalendarTasks.length}</small></summary>
          <p>{english ? "Drag a task onto a calendar date to schedule it." : "Перетащите задачу на дату календаря, чтобы назначить срок."}</p>
          <div className="shared-calendar-task-list">{undatedCalendarTasks.map(renderCalendarTask)}</div>
        </details> : null}
        {completedCalendarTasks.length ? <details className="shared-projects-calendar-undated shared-calendar-completed">
          <summary><ExperimentalIcon name="chevron" /><span>{english ? "Completed tasks" : "Выполненные задачи"}</span><small>{completedCalendarTasks.length}</small></summary>
          <div className="shared-calendar-task-list">{completedCalendarTasks.map(renderCalendarTask)}</div>
        </details> : null}
      </section> : <div className={activeView === "board" ? "shared-projects-board" : "shared-projects-list"}>
        {snapshot.statuses.map((status) => {
          const group = activeView === "board" ? boardTaskGroups(snapshot.tasks, status) : {recent:snapshot.tasks.filter(task => task.statusId === status.id),older:[]};
          return <section key={status.id} className="shared-projects-column"
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
            <small className="shared-board-task-count" aria-label={english ? "Task count" : "Количество задач"} data-no-translate>{formatTaskCount(snapshot.tasks.filter((task) => task.statusId === status.id).length, language as import("./i18n").Language)}</small>
          {canWrite || canManage ? <div className="shared-board-create-actions" role="group" aria-label={statusLabel(status.title)}>
            {canWrite ? <><div className="shared-board-create-events">{(["meeting", "event"] as const).map(type => <button type="button" className={`shared-board-create-${type}`} key={type} aria-label={`${english ? "Create" : "Создать"}: ${entryTypeLabel(type,english)}`} onClick={() => openCreateTask(snapshot.project,status,type)}><ExperimentalIcon name={type}/><span className="shared-create-tooltip" role="tooltip">{entryTypeLabel(type,english)}</span></button>)}</div>
            <div className="shared-board-create-work">
            <button type="button" className="shared-board-create-task" onClick={() => openCreateTask(snapshot.project, status)}
              aria-label={english ? "Create task" : "Создать задачу"} aria-describedby={`shared-create-task-${status.id}`}>
              <ExperimentalIcon name="task" /><span id={`shared-create-task-${status.id}`} className="shared-create-tooltip" role="tooltip">{english ? "Create task" : "Создать задачу"}</span>
            </button>
            {(["task-list", "project"] as const).map((kind) => <button type="button" className={`shared-board-create-${kind}`} key={kind}
              aria-label={kind === "project" ? (english ? "Create project" : "Создать проект") : (english ? "Create list" : "Создать список")}
              aria-describedby={`shared-create-${kind}-${status.id}`} onClick={() => {
              if (kind === "task-list") { openCreateTask(snapshot.project, status, "task-list"); return; }
              setCreateKind(kind); setParentId(snapshot.project.id); setParentBoardId(status.id); setCreateModal("project");
            }}><ExperimentalIcon name={kind === "project" ? "project-plus" : "list"} />
              <span id={`shared-create-${kind}-${status.id}`} className="shared-create-tooltip" role="tooltip">{kind === "project" ? (english ? "Create project" : "Создать проект") : (english ? "Create list" : "Создать список")}</span></button>)}
            </div></> : null}
            {canManage ? <button type="button" className="shared-board-settings" disabled={busy} aria-label={english ? `Settings for ${status.title}` : `Настройки доски «${status.title}»`} title={english ? "Board settings" : "Настройки доски"} onClick={() => openBoardSettings(status)}><ExperimentalIcon name="gear" /></button> : null}
          </div> : null}
          </header>
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
          {group.recent.map(task => renderBoardTask(task, status))}
          {group.older.length ? <details className="shared-board-older-tasks" open={group.older.some(task => task.id === locatedTaskId) || undefined}>
            <summary><ExperimentalIcon name="chevron" /><span>{english ? "Older tasks" : "Предыдущие задачи"}</span><small>{group.older.length}</small></summary>
            <div>{group.older.map(task => renderBoardTask(task, status))}</div>
          </details> : null}
          {!snapshot.tasks.some((task) => task.statusId === status.id) ? <p className="shared-projects-column-empty">
            {english ? "No tasks here yet" : "Здесь пока нет задач"}</p> : null}
        </section>;})}
        {activeView === "board" && (snapshot.project.canCreateBoards ?? canManage) && snapshot.statuses.length < 30 ? <button type="button"
          className="shared-projects-add-column" onClick={() => setCreateModal("status")}>
          <ExperimentalIcon name="plus" />{english ? "Add board" : "Добавить доску"}</button> : null}
      </div>}

      </div>
      </section>
      </div>
      {projectCategorySection}
      <details className="shared-projects-google" aria-label={english ? "My Google copies" : "Мои копии в Google"}>
        <summary><ExperimentalIcon name="chevron" /><span>{english ? "My Google copies" : "Мои копии в Google"}</span>
          {(googleSettings?.tasksEnabled || googleSettings?.calendarEnabled) ? <span>{english ? "On" : "Включено"}</span> : null}</summary>
        <p>{english ? "Only you can enable copies in your Google account. The team task stays in GENESIS."
          : "Только вы можете включить копии в своём Google-аккаунте. Общая задача остаётся в GENESIS."}</p>
        <p>{english ? "Google Tasks copies include a link to the task in GENESIS. Photos and descriptions remain accessible in GENESIS to task participants."
          : "В Google Tasks добавляется ссылка на задачу GENESIS. Фото и описание доступны в GENESIS участникам задачи."}</p>
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
      <SharedActivity key={snapshot.project.id} projectId={snapshot.project.id} english={english} refreshKey={activityKey}/>

    </> : !loading ? <section className="shared-projects-empty">
      <h2>{!spaces.length ? (english ? "Your team starts here" : "Начните общую работу") :
        (english ? "Choose or create a project" : "Выберите или создайте проект")}</h2>
      <p>{!spaces.length ? (english ? "Create a workspace, then invite people and add a project." : "Создайте пространство, затем добавьте проект и пригласите участников.") :
        (english ? "Choose a project or create one in the toolbar above." : "Выберите проект или создайте новый в строке сверху.")}</p>
      {inboxProject && (visibleInbox?.project.permissions?.editTasks ?? ["owner", "manager", "member"].includes(inboxProject.role)) ? <button type="button" className="primary-button"
        onClick={() => openCreateTask(inboxProject)}><ExperimentalIcon name="plus" />{english ? "Create task" : "Создать задачу"}</button> : null}
    </section> : null}
    {!snapshot && spaceId ? projectCategorySection : null}
    {archivedProjects.length ? <details className="shared-projects-create">
      <summary>{english ? "Completed projects" : "Завершённые"} · {archivedProjects.length}</summary>
      <div className="shared-projects-members">{archivedProjects.map(project => <div key={project.id} className="shared-projects-member"><span>{project.title}</span>
        {project.role === "owner" ? <button type="button" className="project-complete-action" disabled={busy} title={english ? "Restore" : "Вернуть"} aria-label={english ? `Restore project “${project.title}”` : `Вернуть проект «${project.title}»`} onClick={() => restoreProject(project.id)}><svg className="project-restore-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.7 7.3M4 4v6h6"/></svg></button> : null}
      </div>)}</div>
    </details> : null}
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
        <div className="shared-task-sections" role="group" aria-label={english ? "Task details" : "Карточка задачи"}>
          <button type="button" aria-pressed={taskSection === "task"} aria-controls="shared-task-fields" onClick={() => setTaskSection("task")}>{english ? "Task" : "Задача"}</button>
          <button type="button" aria-pressed={taskSection === "comments"} aria-controls="shared-task-discussion" onClick={() => setTaskSection("comments")}>{english ? "Comments" : "Комментарии"} · {comments.length}</button>
        </div>
        <div id="shared-task-fields" hidden={taskSection !== "task"}>
        <SharedTaskReview task={selectedTask} userId={userId} onChanged={async()=>{await refreshTaskProject(selectedTask.projectId);await refreshProject(selectedTask.projectId);}}/>
        {selectedTask.approvalRequired ? <section className="shared-task-approval-status">
          <h3>{english ? "Completion confirmations" : "Подтверждения выполнения"}</h3>
          <ul>{selectedTask.approvals?.map((item, index) => <li key={item.userId ?? index}><span data-no-translate>{item.displayName || (english ? "Former participant" : "Бывший участник")}</span><span>{item.approvedAt ? (english ? "Confirmed" : "Подтверждено") : (english ? "Pending" : "Ожидается")}</span></li>)}</ul>
          {selectedTask.approvals?.some(item => item.userId === userId && !item.approvedAt) ? <button className="primary-button" type="button" disabled={busy || selectedTask.pending} onClick={() => confirmTask(selectedTask)}>{english ? "Confirm completion" : "Подтвердить выполнение"}</button> : null}
        </section> : null}
        <div className="shared-task-quick-fields">
        {taskSnapshot.project.canOrganizeTasks ? <div className="shared-projects-detail-move">
          {!taskSnapshot.project.isInbox ? <label>{english ? "Board" : "Доска"}<select value={selectedTask.statusId} disabled={busy}
            onChange={(event) => moveTask(selectedTask, event.target.value)}>
            {taskSnapshot.statuses.map((status) => <option key={status.id} value={status.id}>{statusLabel(status.title)}</option>)}
          </select></label> : null}

        </div> : null}

        {canEditTask ? <label>{english ? "Assigned to" : "Исполнитель"}<select value={selectedTask.assigneeId ?? ""} disabled={busy} onChange={(event) => assignTask(selectedTask, event.target.value)}>
          <option value="">{english ? "Unassigned" : "Не назначен"}</option>
          {taskSnapshot.members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
        </select></label> : null}
        </div>
        {canEditTask ? <form onSubmit={submitTaskEdit}>
          <label>{english ? "Name" : "Название"}<textarea rows={2} value={editTaskTitle} onChange={(event) => setEditTaskTitle(event.target.value)} maxLength={160} placeholder={entryTypeTitlePlaceholder(editEntryType)} required /></label>
          <label>{english ? "Description" : "Описание"}<textarea value={editTaskDescription} onChange={(event) => setEditTaskDescription(event.target.value)} maxLength={20000} /></label>
          <details className="task-advanced-fields shared-record-calendar"><summary>{english ? "Calendar" : "Календарь"}</summary>
          <RecordCalendarChoice value={editTaskCalendarMode} onChange={setEditTaskCalendarMode} language={language} />
          </details>
          <SharedTaskSchedule compact plan={editPlan} onChange={setEditPlan} dueDate={editTaskDueDate} onDueDate={setEditTaskDueDate} mode={editTaskCalendarMode} timeFormat={timeFormat} english={english} tasks={taskSnapshot.tasks} taskId={selectedTask.id}/>
          <details className="task-advanced-fields"><summary>{english ? "Details and settings" : "Подробности и настройки"}</summary>

          <EntryTypeChoice value={editEntryType} types={["task","meeting","event"]} english={english} disabled={busy} onChange={setEditEntryType}/>
          <label>{english ? "Tags" : "Теги"}<input value={editTaskTags} onChange={(event) => setEditTaskTags(event.target.value)} placeholder="работа, запуск" /></label>
          <SharedTaskAttachmentsInput key={selectedTask.id} value={editTaskFiles} onChange={setEditTaskFiles}
            onReadingChange={setEditTaskFilesReading} english={english} disabled={busy || selectedTask.revision !== editTaskRevision}
            existing={(selectedTask.attachments ?? []).filter(file => !removedTaskFileIds.includes(file.id))}
            onRemoveExisting={id => setRemovedTaskFileIds(current => [...current, id])} />
          <SharedLabelPicker labels={labels} value={editTaskLabelIds} onChange={setEditTaskLabelIds} english={english} onManage={canManageLabels ? ()=>setLabelsOpen(true) : undefined}/>
          {(selectedTask.createdBy === userId || taskSnapshot.project.permissions?.manageProjects) ? <SharedTaskApprovalChoice enabled={editApprovalRequired} ids={editApproverIds} members={taskSnapshot.members} english={english}
            disabled={busy || Boolean(selectedTask.completedAt) || selectedTask.revision !== editTaskRevision}
            onEnabled={value => { setEditApprovalRequired(value); setApprovalConfigChanged(true); }} onIds={ids => { setEditApproverIds(ids); setApprovalConfigChanged(true); }} /> : null}
          </details>
          {selectedTask.revision !== editTaskRevision ? <p role="status">{english ? "This task changed elsewhere. Your draft is kept. Reload its fields before saving." : "Задача изменилась у другого участника. Черновик сохранён; обновите поля перед сохранением."}
            <button type="button" onClick={() => openTask(selectedTask, taskSnapshot)}>{english ? "Reload fields" : "Обновить поля"}</button></p> : null}
          <button type="submit" className="primary-button shared-task-save" disabled={busy || editTaskFilesReading || selectedTask.revision !== editTaskRevision || editApprovalRequired && !editApproverIds.length}>{english ? "Save task" : "Сохранить задачу"}</button>
        </form> : selectedTask.description ? <p>{selectedTask.description}</p> : null}

          {taskSnapshot.project.canOrganizeTasks ? <details className="task-advanced-fields"><summary>{english ? "Project or inbox" : "Проект или хаос-бокс"}</summary>
          <label>{english ? "Project or inbox" : "Проект или хаос-бокс"}<select value={taskSnapshot.project.id} disabled={busy}
            onChange={(event) => moveTaskTo(selectedTask, event.target.value)}>
            {projects.filter(project => project.isInbox).map(project => <option key={project.id} value={project.id}>
              {english ? "Shared inbox" : "Хаос-бокс"} · {formatTaskCount(project.taskCount ?? 0, language as import("./i18n").Language)}</option>)}
            {sharedProjectTree(projects).map(({ project, depth }) => <option key={project.id} value={project.id}>
              {depth ? `${"\u00a0\u00a0".repeat(depth)}↳ ` : ""}{project.title} · {formatTaskCount(project.taskCount ?? 0, language as import("./i18n").Language)}</option>)}
          </select></label>
          </details> : null}
        {selectedTask.imageUrl ? <SharedTaskImage key={selectedTask.id} src={selectedTask.imageUrl} english={english} /> : null}
        <SharedTaskAttachmentList files={selectedTask.attachments ?? []} english={english} />
        </div>
        <div id="shared-task-discussion" hidden={taskSection !== "comments"}>
        <SharedComments key={`comments-${selectedTask.id}`} comments={comments} members={taskSnapshot.members} english={english} canComment={Boolean(canCommentTask)} busy={busy} onSubmit={submitComment} highlightedId={commentId} active={taskSection === "comments"}/>
        <SharedActivity key={`activity-${selectedTask.id}`} projectId={taskSnapshot.project.id} taskId={selectedTask.id} english={english} refreshKey={activityKey}/>
        </div>
        {taskSection === "task" && taskSnapshot.project.canOrganizeTasks ? <footer className="shared-task-delete-footer"><button type="button" className="danger-button shared-task-delete-button" disabled={busy || selectedTask.pending} onClick={() => removeTask(selectedTask, taskSnapshot)}><ExperimentalIcon name="close" />{english ? "Delete task" : "Удалить задачу"}</button></footer> : null}
      </> : null}
    </dialog>
    <dialog ref={calendarAgendaRef} className="shared-projects-modal shared-calendar-day-modal" aria-labelledby="shared-calendar-day-title"
      onClose={() => setCalendarAgendaProjectId(null)}>
      {calendarAgendaOpen ? <>
        <header><h2 id="shared-calendar-day-title">{formatCalendarDate(new Date(`${calendarDay}T12:00:00`), calendarMode, true)}</h2>
          <button type="button" className="shared-projects-close" aria-label={english ? "Close" : "Закрыть"} onClick={() => setCalendarAgendaProjectId(null)}><ExperimentalIcon name="close" /></button>
        </header>
        <div className="shared-calendar-day-actions">
          {canWrite && snapshot ? <button type="button" className="primary-button" disabled={busy} onClick={() => { setCalendarAgendaProjectId(null); openCreateTask(snapshot.project, undefined, "task", true); setNewTaskDueDate(calendarDay); setNewPlan({ ...emptySharedPlan(), startDate: calendarDay }); }}><ExperimentalIcon name="plus" />{english ? "Create task" : "Создать задачу"}</button> : null}
          {snapshot?.project.canOrganizeTasks ? <button type="button" className="secondary-button" disabled={busy} aria-expanded={calendarTaskPicker} aria-controls="shared-calendar-task-choices" onClick={() => setCalendarTaskPicker(value => !value)}>{translateText("Выбрать задачу", language as import("./i18n").Language)}</button> : null}
          <button type="button" className="secondary-button shared-calendar-timeline-button" onClick={() => { setCalendarAgendaProjectId(null); setGanttDay(calendarDay); setViewOverride("gantt"); }}>{english ? "Daily timeline" : "Таймлайн дня"}</button>
          <span data-no-translate>{formatTaskCount(calendarTasks.length + completedDayTasks.length, language as import("./i18n").Language)}</span>
        </div>
        {calendarTaskPicker ? <div id="shared-calendar-task-choices" className="shared-calendar-task-choices">
          {calendarTaskChoices.map(task => <button type="button" className="secondary-button" key={task.id} disabled={busy} data-no-translate onClick={() => {
            const duration = task.startDate && task.dueDate ? Math.max(0, dateSerial(task.dueDate) - dateSerial(task.startDate)) : 0;
            setCalendarTaskPicker(false); scheduleTask(task, { startDate: serialDate(dateSerial(calendarDay) - duration), dueDate: calendarDay, startTime: task.startTime ?? null, endTime: task.endTime ?? null });
          }}>{task.title}</button>)}
          {!calendarTaskChoices.length ? <p>{english ? "No tasks here yet" : "Здесь пока нет задач"}</p> : null}
        </div> : null}
        {calendarTasks.length ? <div className="shared-calendar-task-list">{calendarTasks.map(renderCalendarTask)}</div>
          : <p className="shared-calendar-day-empty">{english ? "No active tasks due this day." : "На этот день нет активных задач со сроком."}</p>}
        {completedDayTasks.length ? <section><h3>{english ? "Completed tasks" : "Выполненные задачи"}</h3><div className="shared-calendar-task-list">{completedDayTasks.map(renderCalendarTask)}</div></section> : null}
      </> : null}
    </dialog>
    <dialog ref={createDialogRef} className="shared-projects-modal" aria-labelledby="shared-projects-modal-title"
      onPointerDown={(event) => { if (window.innerWidth > 760 && event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.currentTarget.close(); } }}
      onClose={() => { setCreateModal(null); setNewTaskDestination(null); setNewTaskRootProjectId(""); }}>
      {createModal ? <>
        <header><h2 id="shared-projects-modal-title">{({
          space: english ? "New workspace" : "Новое пространство",
          "space-settings": english ? "Workspace settings" : "Настройки пространства",
          project: createKind === "task-list" ? (english ? "New task list" : "Новый список задач") : (english ? "New shared project" : "Новый общий проект"),
          task: english ? "New team task" : "Новая задача команды",
          status: english ? "New board" : "Новая доска",
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
        {newTaskDestination && (createModal === "task" || createModal === "project" && createKind === "task-list") ? <div className="task-composer-tabs" role="group" aria-label={english ? "Create type" : "Тип дела"}>
          <button type="button" aria-pressed={createModal === "task" && newEntryType === "task"} onClick={() => { setNewEntryType("task"); setCreateModal("task"); }}>{english ? "Task" : "Задача"}</button>
          <button type="button" onClick={() => {
            setCreateKind("task-list"); setCreateModal("project");
          }} aria-pressed={createModal === "project"}>{english ? "Task list" : "Список задач"}</button>
          {(["meeting", "event"] as const).map(type => <button type="button" key={type} aria-pressed={createModal === "task" && newEntryType === type} onClick={() => { setNewEntryType(type); setCreateModal("task"); }}>{entryTypeLabel(type, english)}</button>)}
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
        {createModal === "settings" && snapshot ? <><SharedReviewSettings projectId={snapshot.project.id}/>{canManage ? <button type="button" className="danger-button" onClick={()=>{setCreateModal(null);setTrashTarget({kind:"project",project:snapshot.project});}}>Удалить проект</button> : null}      {canInvite && !snapshot.project.isInbox ? <section className="shared-modal-section">
        <h3>{english ? "Project settings" : "Настройки проекта"}</h3>
        <form key={`${snapshot.project.id}:${snapshot.project.revision}`} onSubmit={submitProjectEdit}>
          <label>{english ? "Name" : "Название"}<input name="title" defaultValue={snapshot.project.title} maxLength={160} required /></label>
          <label>{english ? "Description" : "Описание"}<textarea name="description" defaultValue={snapshot.project.description} maxLength={5000} /></label>
          <SharedProjectLabels name="tags" defaultValue={snapshot.project.tags ?? []}/>
          <SharedLabelPicker labels={labels} value={editProjectLabelIds} onChange={setEditProjectLabelIds} english={english} onManage={canManageLabels ? ()=>setLabelsOpen(true) : undefined}/>
          {snapshot.project.kind !== "task-list" ? <label>{english ? "Category" : "Категория"}<select name="categoryId" defaultValue={snapshot.project.categoryId ?? ""}>
            <option value="">{english ? "No category" : "Без категории"}</option>
            {projectCategories.items.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select></label> : null}
          <label>{english ? "Layout" : "Вид"}<select name="layout" defaultValue={snapshot.project.layout}><option value="list">{english ? "Project tree" : "Дерево проектов"}</option><option value="board">{english ? "Boards" : "Доски"}</option></select></label>
          <label>{english ? "Parent project" : "Родительский проект"}<select name="parentId" defaultValue={snapshot.project.parentId ?? ""}>
            <option value="">{english ? "Top level" : "Верхний уровень"}</option>
            {sharedProjectTree(projects.filter(project => project.id !== snapshot.project.id)).map(({ project, depth }) => <option key={project.id} value={project.id}>{depth ? `${"\u00a0\u00a0".repeat(depth)}↳ ` : ""}{project.title} · {formatTaskCount(project.taskCount ?? 0, language as import("./i18n").Language)}</option>)}
          </select></label>
          <button type="submit" disabled={busy}>{english ? "Save project" : "Сохранить проект"}</button>
        </form>
        {snapshot.project.role === "owner" ? <button type="button" className="shared-projects-archive" disabled={busy} onClick={archiveProject}>{english ? "Complete project" : "Завершить проект"}</button> : null}
      </section> : null}

</> : null}
        {createModal === "team" && teamSnapshot ? <>
          {["owner", "admin"].includes(teamSnapshot.project.spaceRole ?? "") ? <SharedTeamPermissions key={teamSnapshot.project.spaceId} spaceId={teamSnapshot.project.spaceId} english={english} onChanged={async () => { setTeamSnapshot(await loadSharedProject(teamSnapshot.project.id)); await refreshSpaces(); await refreshProjects(teamSnapshot.project.spaceId); if (projectId) await refreshProject(projectId); }} /> : null}
          <section className="shared-modal-section">
        <h3>{english ? "Participants and roles" : "Участники и роли"}</h3>
        <div className="shared-team-members">{teamSnapshot.members.map((member) => <article key={member.userId} className="shared-team-member">
          <header className="shared-team-member-identity"><ExperimentalIcon name="team" /><div><h4>{member.displayName}</h4><span>{roleLabel(member.spaceRole)}</span></div></header>
          <div className="shared-team-member-controls">
          {teamSnapshot.project.role === "owner" && !teamSnapshot.project.isInbox ? <>
            <label>{english ? "Role" : "Роль"}<select value={member.role} disabled={busy} onChange={(event) => setMemberRole(member.userId, event.target.value)}>
              {["owner", "manager", "member", "commenter", "viewer"].map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select></label>
            <button type="button" disabled={busy || (member.role === "owner" && teamSnapshot.members.filter((item) => item.role === "owner").length === 1)} onClick={() => removeMember(member.userId)}>{english ? "Remove" : "Удалить"}</button>
          </> : !teamSnapshot.project.isInbox ? <p>{english ? "Project role" : "Роль в проекте"}: {roleLabel(member.role)}</p> : null}
          </div>
        </article>)}</div>
      </section>

          {["owner", "admin"].includes(spaces.find((space) => space.id === spaceId)?.role ?? "") ? <button type="button" className="primary-button" onClick={() => setCreateModal("invite")}>{english ? "Invite to workspace" : "Пригласить в пространство"}</button> : null}
        </> : null}
        {createModal === "board" && editingBoard && snapshot ? <form onSubmit={(event) => {
          event.preventDefault(); const fields = new FormData(event.currentTarget); const current = editingBoard;
          void run(async () => { await updateSharedStatus(snapshot.project.id, current.id, String(fields.get("title")), current.revision,
            { color: String(fields.get("color")), imageUrl: boardImage, isDone: fields.get("isDone") === "on", taskTitleLines: Number(fields.get("taskTitleLines")), visibleTaskCount: Number(fields.get("visibleTaskCount")) });
            await refreshProject(snapshot.project.id); setCreateModal(null); });
        }}>
          <label>{english ? "Board name" : "Название доски"}<input name="title" defaultValue={statusLabel(editingBoard.title)} required maxLength={80}/></label>
          <label>{english ? "Color" : "Цвет"}<input name="color" type="color" defaultValue={editingBoard.color ?? "#2d6c68"}/></label>
          <label className="shared-projects-checkbox"><input name="isDone" type="checkbox" defaultChecked={Boolean(editingBoard.isDone)}/>{english ? "Tasks here are completed" : "Задачи в этой доске завершены"}</label>
          <fieldset className="shared-board-display-settings"><legend>{english ? "Task display" : "Отображение задач"}</legend>
            <label>{english ? "Task title length" : "Длина названия задачи"}<select name="taskTitleLines" defaultValue={boardDisplay(editingBoard).titleLines}>
              <option value="0">{english ? "Full title" : "Полное название"}</option>
              {[1,2,3].map(lines => <option key={lines} value={lines}>{english ? `${lines} lines` : `${lines} ${lines === 1 ? "строка" : "строки"}`}</option>)}
            </select></label>
            <label>{english ? "Recent tasks shown" : "Последних задач на доске"}<input name="visibleTaskCount" type="number" min="0" max="1000" step="1" required defaultValue={boardDisplay(editingBoard).visibleCount}/></label>
            <p>{english ? "0 shows all tasks. Older tasks stay in an expandable list. You can expand shortened titles on each card." : "0 — показывать все задачи. Предыдущие задачи остаются в раскрываемом списке. Сокращённое название можно развернуть в карточке."}</p>
          </fieldset>
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
          <details className="shared-board-delete"><summary><ExperimentalIcon name="close" />{english ? "Delete board" : "Удалить доску"}</summary>
            <label>{english ? "Move its contents to" : "Переместить содержимое в"}<select value={statusDestinations[editingBoard.id] ?? snapshot.statuses.find((item) => item.id !== editingBoard.id)?.id ?? ""}
              onChange={(event) => setStatusDestinations((current) => ({ ...current, [editingBoard.id]: event.target.value }))}>
              {snapshot.statuses.filter((item) => item.id !== editingBoard.id).map((item) => <option key={item.id} value={item.id}>{statusLabel(item.title)}</option>)}
            </select></label>
            <button type="button" className="shared-board-delete-confirm" disabled={busy || snapshot.statuses.length < 2} onClick={() => {
              removeStatus(editingBoard.id, editingBoard.revision, statusDestinations[editingBoard.id] ?? snapshot.statuses.find((item) => item.id !== editingBoard.id)?.id ?? "");
              setCreateModal(null);
            }}><ExperimentalIcon name="close" />{english ? "Delete and move contents" : "Удалить и перенести содержимое"}</button>
          </details>
        </form> : null}
        {createModal === "space" || createModal === "space-settings" ? <SharedSpaceForm key={createModal === "space" ? "new-space" : editingSpaceId}
          language={language} spaceId={createModal === "space-settings" ? editingSpaceId : undefined}
          onSaved={(space) => { spacesRequest.current++; setSpaces(current => current.some(item => item.id === space.id) ? current.map(item => item.id === space.id ? { ...item, ...space } : item) : [...current, space]); void refreshSpaces().catch(() => undefined); setSpaceId(space.id); setCreateModal(null); setMessage(english ? "Workspace saved." : "Пространство сохранено."); }}
          onDeleted={(id) => { setSpaces((current) => current.filter((space) => space.id !== id));
            if (spaceId === id) { setSpaceId(""); setProjectId(""); setSnapshot(null); setInboxPreview(null); setProjects([]); }
            setCreateModal(null); }} /> : null}
        {createModal === "project" ? <form onSubmit={submitProject}>
          <label>{english ? "Name" : "Название"}<input value={projectTitle} maxLength={160} required onChange={(event) => setProjectTitle(event.target.value)} /></label>
          <label>{english ? "Description" : "Описание"}<textarea value={projectDescription} maxLength={5000} onChange={(event) => setProjectDescription(event.target.value)} /></label>
          <SharedProjectLabels value={projectTags} onChange={setProjectTags}/>
          <SharedLabelPicker labels={labels} value={projectLabelIds} onChange={setProjectLabelIds} english={english} onManage={canManageLabels ? ()=>setLabelsOpen(true) : undefined}/>
          {createKind === "project" ? <label>{english ? "Category" : "Категория"}<select value={projectCategoryId} onChange={event => setProjectCategoryId(event.target.value)}>
            <option value="">{english ? "No category" : "Без категории"}</option>
            {projectCategories.items.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select></label> : null}
          {createKind === "project" ? <label>{english ? "Layout" : "Вид"}<select value={projectLayout} onChange={(event) => setProjectLayout(event.target.value as "list" | "board")}>
            <option value="list">{english ? "Project tree" : "Дерево проектов"}</option><option value="board">{english ? "Boards" : "Доски"}</option>
          </select></label> : null}
          <label>{english ? "Parent project" : "Родительский проект"}<select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">{english ? "Top level" : "Верхний уровень"}</option>
            {sharedProjectTree(projects).map(({ project, depth }) => <option key={project.id} value={project.id}>{depth ? `${"\u00a0\u00a0".repeat(depth)}↳ ` : ""}{project.title} · {formatTaskCount(project.taskCount ?? 0, language as import("./i18n").Language)}</option>)}
          </select></label>
          <button type="submit" className="primary-button" disabled={busy}>{createKind === "task-list" ? (english ? "Create task list" : "Создать список задач") : (english ? "Create project" : "Создать проект")}</button>
        </form> : null}
        {createModal === "task" && newTaskDestination ? <form className="shared-task-composer" onSubmit={submitTask}>
          <section className="shared-task-form-section">
          <label>{english ? "Name" : "Название"}<textarea rows={2} maxLength={160} required value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder={entryTypeTitlePlaceholder(newEntryType)} /></label>
          {newTaskRootProjectId ? <label>{english ? "Project or subproject" : "Проект или подпроект"}<select value={newTaskDestination.projectId}
            onChange={event => {
              const target = projects.find(project => project.id === event.target.value);
              setNewTaskDestination({ projectId: target?.id ?? "", title: target?.title ?? "", isInbox: !target });
              setNewTaskContext(null); setNewPlan(current => ({ ...current, dependsOnIds: [] }));
              setNewApproverIds([]);
              const contextId = target?.id ?? inboxProject?.id;
              if (contextId) void loadSharedProject(contextId).then(setNewTaskContext).catch(() => undefined);
            }}>
            <option value="">{english ? "Workspace inbox (no project)" : "Хаос-бокс пространства (без проекта)"}</option>
            {taskDestinationProjects.filter(({ project }) => project.kind !== "task-list" && (project.permissions?.editTasks ?? ["owner", "manager", "member"].includes(project.role)))
              .map(({ project, depth }) => <option value={project.id} key={project.id}>{depth ? `${"\u00a0\u00a0".repeat(depth)}↳ ` : ""}{project.title}</option>)}
          </select></label> : <p className="shared-task-destination">{english ? "Create in" : "Место создания"}: <strong>{newTaskDestination.title}</strong></p>}
          </section>
          <details className="task-advanced-fields"><summary>{english ? "Dates and planning" : "Даты и планирование"}{newTaskDueDate ? ` · ${formatCalendarDate(new Date(`${newTaskDueDate}T12:00:00`), newTaskCalendarMode)}` : ""}</summary>
          <RecordCalendarChoice value={newTaskCalendarMode} onChange={setNewTaskCalendarMode} language={language} />
          <SharedTaskSchedule plan={newPlan} onChange={setNewPlan} dueDate={newTaskDueDate} onDueDate={setNewTaskDueDate} mode={newTaskCalendarMode} timeFormat={timeFormat} english={english} tasks={newTaskContext && newTaskContext.project.id===(newTaskDestination.projectId || inboxProject?.id) ? newTaskContext.tasks : []}/>
          </details>
          <details className="task-advanced-fields"><summary>{english ? "Details and settings" : "Подробности и настройки"}</summary>
          <SharedTaskApprovalChoice enabled={newApprovalRequired} ids={newApproverIds} members={newTaskContext && newTaskContext.project.id === (newTaskDestination.projectId || inboxProject?.id) ? newTaskContext.members : []}
            english={english} disabled={busy || !newTaskContext} onEnabled={setNewApprovalRequired} onIds={setNewApproverIds} />
          <section className="shared-task-form-section"><h3>{english ? "Attachment" : "Вложение"}</h3>
          <SharedTaskAttachmentsInput value={newTaskFiles} onChange={setNewTaskFiles} onReadingChange={setNewTaskImageReading} english={english} disabled={busy} />
          </section>
          <label>{english ? "Description" : "Описание"}<textarea maxLength={20000} value={newTaskDescription} onChange={(event) => setNewTaskDescription(event.target.value)} /></label>
          <label>{english ? "Tags" : "Теги"}<input value={newTaskTags} onChange={(event) => setNewTaskTags(event.target.value)} placeholder="работа, запуск" /></label>
          <SharedLabelPicker labels={labels} value={newTaskLabelIds} onChange={setNewTaskLabelIds} english={english} onManage={canManageLabels ? ()=>setLabelsOpen(true) : undefined}/>
          </details>
          <button type="submit" className="primary-button" disabled={busy || newTaskImageReading || !newTaskTitle.trim() || !newTaskDestination.projectId && !inboxProject || newApprovalRequired && !newApproverIds.length}>{english ? "Create task" : "Создать задачу"}</button>
        </form> : null}
        {createModal === "status" ? <form onSubmit={submitStatus}>
          <label>{english ? "Name" : "Название"}<input value={newStatusTitle} maxLength={80} required onChange={(event) => setNewStatusTitle(event.target.value)} /></label>
          <label className="shared-projects-checkbox"><input type="checkbox" checked={newStatusDone} onChange={(event) => setNewStatusDone(event.target.checked)} />{english ? "Completion list" : "Список завершённых задач"}</label>
          <button type="submit" className="primary-button" disabled={busy}>{english ? "Create board" : "Создать доску"}</button>
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
