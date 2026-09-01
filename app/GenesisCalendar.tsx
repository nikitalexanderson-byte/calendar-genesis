"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type GenesisCategory,
  type GenesisProject,
  type GenesisTask as Task,
  type GenesisUser,
  type RecurrenceKind,
  isGoogleSyncConfigured,
  loadGenesisWorkspace,
  mergeLocalWorkspace,
  metricsFor,
  observeCloudTasks,
  observeGenesisUser,
  removeCloudTask,
  saveCloudTask,
  saveMetrics,
  saveWorkspaceStructure,
  signInWithGoogle,
  signOutFromGoogle,
} from "./cloud-sync";
import { AccountPanel } from "./AccountPanel";
import { AdminPanel } from "./AdminPanel";
import { currentLegalPage, LegalPage } from "./LegalPage";
import { StoicheionView } from "./StoicheionView";
import { WelcomeScreen } from "./WelcomeScreen";
import {
  MONTHS,
  PYATA_MEANINGS,
  dateKey,
  formatGregorian,
  getDayElement,
  getGregorianDate,
  getMoon,
  getPythagorean,
  getSacredDate,
  getSacredDay,
  getSolarEvent,
  getSolarEvents,
} from "./calendar-data";
import { usePwaInstall } from "./use-pwa-install";

type ViewName = "today" | "calendar" | "projects" | "year" | "stoicheion" | "admin";

type StoredState = {
  tasks: Task[];
  projects: GenesisProject[];
  categories: GenesisCategory[];
};

type SyncStatus =
  | "loading"
  | "local"
  | "setup"
  | "syncing"
  | "synced"
  | "offline"
  | "error";

const LEGACY_STORAGE_KEY = "genesis-calendar-v1";
const USER_STORAGE_PREFIX = "genesis-calendar-v2:";
const LAST_USER_KEY = "genesis-last-user-v2";

const NAVIGATION: Array<{ id: ViewName; label: string; symbol: string }> = [
  { id: "today", label: "Сегодня", symbol: "☉" },
  { id: "projects", label: "Проекты", symbol: "◇" },
  { id: "calendar", label: "Месяц", symbol: "◫" },
  { id: "year", label: "Круг года", symbol: "◎" },
  { id: "stoicheion", label: "Стойхейон", symbol: "ϟ" },
];

const VIEW_NAMES = new Set<ViewName>(["today", "calendar", "projects", "year", "stoicheion", "admin"]);

function viewFromHash(): ViewName {
  if (typeof window === "undefined") return "today";
  const candidate = window.location.hash.replace(/^#\/?/, "").split(/[?&]/, 1)[0] as ViewName;
  return VIEW_NAMES.has(candidate) ? candidate : "today";
}

function readStoredState(key: string): StoredState {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return { tasks: [], projects: [], categories: DEFAULT_CATEGORIES };
    const parsed = JSON.parse(saved) as Partial<StoredState>;
    const storedTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const storedProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
    return {
      tasks: storedTasks.map((task) => {
        const legacy = task as Partial<Task>;
        const legacyYear = legacy.sacredYear ?? new Date().getFullYear();
        const legacyMonth = legacy.monthIndex ?? 0;
        const legacyDay = legacy.day ?? 1;
        return {
          id: legacy.id ?? uid(),
          sacredYear: legacyYear,
          monthIndex: legacyMonth,
          day: legacyDay,
          dueDate: legacy.dueDate || inputDate(getGregorianDate(legacyYear, legacyMonth, legacyDay)),
          title: legacy.title ?? "Без названия",
          description: legacy.description ?? "",
          time: legacy.time ?? "",
          project: legacy.project ?? "",
          projectId: legacy.projectId ?? null,
          categoryId: legacy.categoryId ?? null,
          tags: legacy.tags ?? [],
          dependsOnIds: legacy.dependsOnIds ?? [],
          done: legacy.done ?? false,
          completedAt: legacy.completedAt ?? (legacy.done ? new Date().toISOString() : null),
          reminderMinutes: legacy.reminderMinutes ?? null,
          recurrence: legacy.recurrence ?? "none",
          recurrenceInterval: legacy.recurrenceInterval ?? 1,
          syncToGoogle: true,
          googleEventId: legacy.googleEventId ?? null,
          googleTaskId: legacy.googleTaskId ?? null,
          googleTaskListId: legacy.googleTaskListId ?? null,
          googleReadOnly: legacy.googleReadOnly ?? false,
          updatedAt: typeof legacy.updatedAt === "number" ? legacy.updatedAt : timestamp(),
        };
      }),
      projects: storedProjects.map((project, index) => typeof project === "string" ? {
        id: `legacy-${index}`,
        parentId: null,
        categoryId: null,
        title: project,
        description: "",
        tags: [],
        status: "active" as const,
        position: index,
      } : project),
      categories: Array.isArray(parsed.categories) ? parsed.categories : DEFAULT_CATEGORIES,
    };
  } catch {
    return { tasks: [], projects: [], categories: DEFAULT_CATEGORIES };
  }
}

const DEFAULT_CATEGORIES: GenesisCategory[] = [
  { id: "personal", name: "Личное", color: "#a5543f", position: 0 },
  { id: "work", name: "Работа", color: "#2d6c68", position: 1 },
  { id: "health", name: "Тело и здоровье", color: "#b18b48", position: 2 },
];

const APP_BASE = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");

function apeironLength(sacredYear: number) {
  return (
    Math.round(
      (Date.UTC(sacredYear + 1, 2, 20) - Date.UTC(sacredYear, 2, 20)) /
        86_400_000,
    ) - 360
  );
}

function taskDateKey(sacredYear: number, monthIndex: number, day: number) {
  return `${sacredYear}:${dateKey(monthIndex, day)}`;
}

function uid() {
  return `${timestamp()}-${Math.random().toString(36).slice(2, 8)}`;
}

function timestamp() {
  return Date.now();
}

function flattenProjects(
  projects: GenesisProject[],
  parentId: string | null = null,
  depth = 0,
): Array<{ project: GenesisProject; depth: number }> {
  return projects
    .filter((project) => project.parentId === parentId)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
    .flatMap((project) => [
      { project, depth },
      ...flattenProjects(projects, project.id, depth + 1),
    ]);
}

function projectIsDescendant(projects: GenesisProject[], candidateId: string, ancestorId: string) {
  let current = projects.find((project) => project.id === candidateId);
  const visited = new Set<string>();
  while (current?.parentId && !visited.has(current.id)) {
    if (current.parentId === ancestorId) return true;
    visited.add(current.id);
    current = projects.find((project) => project.id === current?.parentId);
  }
  return false;
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDate(date: Date, time: string) {
  const [hours = "00", minutes = "00"] = time.split(":");
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${hours}${minutes}00`;
}

function inputDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function nextOccurrenceDate(dueDate: string, recurrence: RecurrenceKind, interval: number) {
  if (recurrence === "none") return null;
  const next = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(next.getTime())) return null;
  const step = Math.max(1, interval);

  if (recurrence === "weekdays") {
    let remaining = step;
    while (remaining > 0) {
      next.setDate(next.getDate() + 1);
      if (next.getDay() !== 0 && next.getDay() !== 6) remaining -= 1;
    }
  } else if (recurrence === "daily") {
    next.setDate(next.getDate() + step);
  } else if (recurrence === "weekly") {
    next.setDate(next.getDate() + step * 7);
  } else if (recurrence === "monthly") {
    next.setMonth(next.getMonth() + step);
  } else {
    next.setFullYear(next.getFullYear() + step);
  }
  return next;
}

function romanDay(monthIndex: number, day: number) {
  return monthIndex === 12 ? String(day) : ["I", "II", "III", "IIII", "V"][(day - 1) % 5];
}

export function GenesisCalendar() {
  const initial = useMemo(() => getSacredDate(new Date()), []);
  const [today] = useState(() => new Date());
  const [view, setView] = useState<ViewName>("today");
  const [sacredYear, setSacredYear] = useState(initial.sacredYear);
  const [monthIndex, setMonthIndex] = useState(initial.monthIndex);
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<GenesisProject[]>([]);
  const [categories, setCategories] = useState<GenesisCategory[]>(DEFAULT_CATEGORIES);
  const [hydrated, setHydrated] = useState(false);
  const [authResolved, setAuthResolved] = useState(!isGoogleSyncConfigured);
  const [cloudUser, setCloudUser] = useState<GenesisUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [legalPage] = useState<ReturnType<typeof currentLegalPage>>(() => currentLegalPage());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskProject, setTaskProject] = useState("");
  const [taskTags, setTaskTags] = useState("");
  const [taskReminder, setTaskReminder] = useState("30");
  const [taskRecurrence, setTaskRecurrence] = useState<RecurrenceKind>("none");
  const [taskRecurrenceInterval, setTaskRecurrenceInterval] = useState("1");
  const [taskDependsOn, setTaskDependsOn] = useState<string[]>([]);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectParent, setNewProjectParent] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState(DEFAULT_CATEGORIES[0].id);
  const [newProjectTags, setNewProjectTags] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingCategoryTitle, setEditingCategoryTitle] = useState("");
  const [editingCategoryColor, setEditingCategoryColor] = useState("#2d6c68");
  const [tagSearch, setTagSearch] = useState("");
  const [editingProject, setEditingProject] = useState<GenesisProject | null>(null);
  const [editingProjectTags, setEditingProjectTags] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingTaskTags, setEditingTaskTags] = useState("");
  const [planManagerOpen, setPlanManagerOpen] = useState(false);
  const [openDayTaskPopover, setOpenDayTaskPopover] = useState("");
  const tasksRef = useRef<Task[]>([]);
  const projectsRef = useRef<GenesisProject[]>([]);
  const categoriesRef = useRef<GenesisCategory[]>(DEFAULT_CATEGORIES);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const { canInstall, install, isStandalone } = usePwaInstall();

  const todayInfo = useMemo(() => getSacredDate(today), [today]);
  const selectedDate = useMemo(
    () => getGregorianDate(sacredYear, monthIndex, selectedDay),
    [sacredYear, monthIndex, selectedDay],
  );
  const todayDateValue = inputDate(today);
  const selectedDateValue = inputDate(selectedDate);
  const selectedDateIsPast = selectedDateValue < todayDateValue;
  const selectedMonth = MONTHS[monthIndex];
  const selectedSacredDay = getSacredDay(monthIndex, selectedDay);
  const selectedMoon = getMoon(selectedDate);
  const selectedElement = getDayElement(monthIndex, selectedDay);
  const selectedPythagorean = getPythagorean(monthIndex, selectedDay);
  const selectedKey = taskDateKey(sacredYear, monthIndex, selectedDay);
  const selectedSolarEvent = getSolarEvent(sacredYear, monthIndex, selectedDay);
  const solarEvents = useMemo(() => getSolarEvents(sacredYear), [sacredYear]);
  const dayTasks = tasks
    .filter(
      (task) =>
        taskDateKey(task.sacredYear, task.monthIndex, task.day) === selectedKey,
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  const todayKey = taskDateKey(
    todayInfo.sacredYear,
    todayInfo.monthIndex,
    todayInfo.day,
  );

  const navigateTo = (nextView: ViewName, replace = false) => {
    setOpenDayTaskPopover("");
    setAccountMenuOpen(false);
    setPlanManagerOpen(false);
    setView(nextView);
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = nextView;
    const state = { ...(window.history.state ?? {}), genesisView: nextView };
    if (replace || view === nextView) {
      window.history.replaceState(state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    } else {
      window.history.pushState(state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      document.querySelector<HTMLElement>(".app-stage")?.scrollTo({ top: 0, behavior: "auto" });
      document.querySelector<HTMLElement>(".workspace")?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  useEffect(() => {
    const initialView = viewFromHash();
    const initialFrame = window.requestAnimationFrame(() => setView(initialView));
    const initialUrl = new URL(window.location.href);
    initialUrl.hash = initialView;
    window.history.replaceState(
      { ...(window.history.state ?? {}), genesisView: initialView },
      "",
      `${initialUrl.pathname}${initialUrl.search}${initialUrl.hash}`,
    );
    const handlePopState = () => {
      setOpenDayTaskPopover("");
      setAccountMenuOpen(false);
      setAccountOpen(false);
      setPlanManagerOpen(false);
      setView(viewFromHash());
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    const initialState = isGoogleSyncConfigured
      ? { tasks: [], projects: [], categories: DEFAULT_CATEGORIES }
      : readStoredState(LEGACY_STORAGE_KEY);

    const timer = window.setTimeout(() => {
      tasksRef.current = initialState.tasks;
      projectsRef.current = initialState.projects;
      categoriesRef.current = initialState.categories;
      setTasks(initialState.tasks);
      setProjects(initialState.projects);
      setCategories(initialState.categories);
      setNewProjectCategory(initialState.categories[0]?.id ?? "");
      setHydrated(true);
      setSyncStatus(isGoogleSyncConfigured ? "loading" : "setup");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || (isGoogleSyncConfigured && !cloudUser)) return;
    tasksRef.current = tasks;
    projectsRef.current = projects;
    categoriesRef.current = categories;
    const key = cloudUser ? `${USER_STORAGE_PREFIX}${cloudUser.uid}` : LEGACY_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify({ tasks, projects, categories }));
  }, [hydrated, cloudUser, tasks, projects, categories]);

  useEffect(() => {
    if (!hydrated || !isGoogleSyncConfigured) return;

    let active = true;
    let stopTasks: (() => void) | undefined;
    let loadedUserId = "";
    const stopUser = observeGenesisUser((user) => {
      setAuthResolved(true);
      setCloudUser(user);
      setSyncError("");

      if (!user) {
        stopTasks?.();
        stopTasks = undefined;
        loadedUserId = "";
        setSyncStatus("local");
        return;
      }
      localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
      if (loadedUserId === user.uid) return;
      stopTasks?.();
      stopTasks = undefined;
      loadedUserId = user.uid;

      const userKey = `${USER_STORAGE_PREFIX}${user.uid}`;
      const local = readStoredState(localStorage.getItem(userKey) ? userKey : LEGACY_STORAGE_KEY);
      tasksRef.current = local.tasks;
      projectsRef.current = local.projects;
      categoriesRef.current = local.categories;
      setTasks(local.tasks);
      setProjects(local.projects);
      setCategories(local.categories);
      setNewProjectCategory(local.categories[0]?.id ?? "");

      setSyncStatus("syncing");
      void mergeLocalWorkspace(user.uid, {
        tasks: local.tasks,
        projects: local.projects,
        categories: local.categories,
      })
        .then(async () => {
          if (!active) return;
          const workspace = await loadGenesisWorkspace();
          if (!active) return;
          const nextProjects = workspace.hasRemoteStructure ? workspace.projects : local.projects;
          const nextCategories = workspace.hasRemoteStructure ? workspace.categories : local.categories;
          const nextTasks = workspace.syncWarning ? local.tasks : workspace.tasks;
          tasksRef.current = nextTasks;
          projectsRef.current = nextProjects;
          categoriesRef.current = nextCategories;
          setTasks(nextTasks);
          setProjects(nextProjects);
          setCategories(nextCategories);
          setNewProjectCategory(nextCategories[0]?.id ?? "");
          setSyncError(workspace.syncWarning ?? "");
          setSyncStatus(workspace.syncWarning ? "offline" : "synced");
          stopTasks = observeCloudTasks(
            user.uid,
            (cloudTasks, fromCache, warning) => {
              if (!active) return;
              tasksRef.current = cloudTasks;
              setTasks(cloudTasks);
              setSyncError(warning ?? "");
              setSyncStatus(warning ? "error" : fromCache ? "offline" : "synced");
            },
            (error) => {
              if (!active) return;
              setSyncError(error.message);
              setSyncStatus("error");
            },
          );
        })
        .catch((error: Error) => {
          if (!active) return;
          setSyncError(error.message);
          setSyncStatus(navigator.onLine ? "error" : "offline");
        });
    }, (error) => {
      if (!active) return;
      setSyncError(error.message);
      try {
        const cached = JSON.parse(localStorage.getItem(LAST_USER_KEY) || "null") as GenesisUser | null;
        if (cached?.uid) {
          const local = readStoredState(`${USER_STORAGE_PREFIX}${cached.uid}`);
          tasksRef.current = local.tasks;
          projectsRef.current = local.projects;
          categoriesRef.current = local.categories;
          setTasks(local.tasks);
          setProjects(local.projects);
          setCategories(local.categories);
          setNewProjectCategory(local.categories[0]?.id ?? "");
          setCloudUser(cached);
          setAuthResolved(true);
          setSyncStatus("offline");
          return;
        }
        setAuthResolved(true);
        setSyncStatus("error");
      } catch {
        setAuthResolved(true);
        setSyncStatus("error");
      }
    });

    return () => {
      active = false;
      stopTasks?.();
      stopUser();
    };
  }, [hydrated]);

  const saveTask = (task: Task) => {
    if (!cloudUser) return;
    setSyncStatus("syncing");
    void saveCloudTask(cloudUser.uid, task)
      .then((saved) => {
        setTasks((current) => current.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
        setSyncStatus("synced");
      })
      .catch((error: Error) => {
        setSyncError(error.message);
        setSyncStatus(navigator.onLine ? "error" : "offline");
      });
  };

  const handleGoogleSignIn = async () => {
    setSyncError("");
    setSyncStatus("syncing");
    try {
      await signInWithGoogle();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось войти");
      setSyncStatus("error");
    }
  };

  const handleGoogleSignOut = async () => {
    setAccountMenuOpen(false);
    try {
      await signOutFromGoogle();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось выйти");
      setSyncStatus("error");
    }
  };

  useEffect(() => {
    if (!hydrated || !cloudUser || !navigator.onLine) return;
    const timer = window.setTimeout(() => {
      void saveMetrics(metricsFor(tasks, projects)).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [hydrated, cloudUser, tasks, projects]);

  const selectToday = () => {
    setSacredYear(todayInfo.sacredYear);
    setMonthIndex(todayInfo.monthIndex);
    setSelectedDay(todayInfo.day);
    navigateTo("today");
  };

  const activateNavigation = (nextView: ViewName) => {
    if (nextView === "today") {
      selectToday();
      return;
    }
    navigateTo(nextView);
  };

  const selectMonth = (nextIndex: number) => {
    const normalized = (nextIndex + 13) % 13;
    setMonthIndex(normalized);
    setSelectedDay(1);
    setOpenDayTaskPopover("");
  };

  const changeSacredYear = (nextYear: number) => {
    setSacredYear(nextYear);
    setOpenDayTaskPopover("");
    if (monthIndex === 12) {
      setSelectedDay((day) => Math.min(day, apeironLength(nextYear)));
    }
  };

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    if (selectedDateIsPast) {
      setSyncError("Новые задачи нельзя добавлять задним числом. Выберите сегодняшний или будущий день.");
      setSyncStatus("error");
      return;
    }

    const project = taskProject.trim();
    const tags = taskTags
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 6);
    const selectedProject = projects.find((item) => item.title === project);

    const task: Task = {
      id: uid(),
      sacredYear,
      monthIndex,
      day: selectedDay,
      dueDate: inputDate(selectedDate),
      title,
      description: "",
      time: taskTime,
      project,
      projectId: selectedProject?.id ?? null,
      categoryId: selectedProject?.categoryId ?? null,
      tags,
      dependsOnIds: taskDependsOn,
      done: false,
      completedAt: null,
      reminderMinutes: taskReminder ? Number(taskReminder) : null,
      recurrence: taskRecurrence,
      recurrenceInterval: Math.max(1, Number(taskRecurrenceInterval) || 1),
      syncToGoogle: true,
      googleEventId: null,
      googleTaskId: null,
      googleTaskListId: null,
      googleReadOnly: false,
      updatedAt: timestamp(),
    };

    setTasks((current) => [...current, task]);
    saveTask(task);

    setTaskTitle("");
    setTaskTime("");
    setTaskTags("");
    setTaskDependsOn([]);
  };

  const openTaskEditor = (task: Task) => {
    setEditingTask({ ...task, tags: [...task.tags], dependsOnIds: [...task.dependsOnIds] });
    setEditingTaskTags(task.tags.join(", "));
  };

  const saveTaskEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTask) return;
    const original = tasks.find((task) => task.id === editingTask.id);
    const title = editingTask.title.trim();
    if (!original || !title) return;
    if (editingTask.dueDate < todayDateValue && editingTask.dueDate !== original.dueDate) {
      setSyncError("Нельзя переносить задачу на дату в прошлом.");
      setSyncStatus("error");
      return;
    }
    const dueDate = new Date(`${editingTask.dueDate}T12:00:00`);
    if (Number.isNaN(dueDate.getTime())) return;
    const sacred = getSacredDate(dueDate);
    const selectedProject = editingTask.googleTaskId
      ? null
      : projects.find((project) => project.id === editingTask.projectId);
    const nextTask: Task = {
      ...editingTask,
      title,
      description: editingTask.description.trim(),
      sacredYear: sacred.sacredYear,
      monthIndex: sacred.monthIndex,
      day: sacred.day,
      project: editingTask.googleTaskId ? editingTask.project : (selectedProject?.title ?? ""),
      projectId: editingTask.googleTaskId ? editingTask.projectId : (selectedProject?.id ?? null),
      categoryId: editingTask.googleTaskId ? editingTask.categoryId : (selectedProject?.categoryId ?? null),
      tags: editingTaskTags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10),
      updatedAt: timestamp(),
    };
    setTasks((current) => current.map((task) => task.id === nextTask.id ? nextTask : task));
    saveTask(nextTask);
    setEditingTask(null);
  };

  const toggleTask = (id: string) => {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return;
    const unfinishedDependencies = currentTask.dependsOnIds.filter((dependencyId) => tasks.some((task) => task.id === dependencyId && !task.done));
    if (!currentTask.done && unfinishedDependencies.length) {
      setSyncError(`Сначала завершите связанные задачи: ${unfinishedDependencies.length}`);
      setSyncStatus("error");
      return;
    }
    const nextTask = {
      ...currentTask,
      done: !currentTask.done,
      completedAt: currentTask.done ? null : new Date().toISOString(),
      updatedAt: timestamp(),
    };
    const nextDate = !currentTask.done
      ? nextOccurrenceDate(currentTask.dueDate, currentTask.recurrence, currentTask.recurrenceInterval)
      : null;
    const nextDateValue = nextDate ? inputDate(nextDate) : "";
    const alreadyQueued = nextDateValue !== "" && tasks.some((task) => (
      task.id !== currentTask.id &&
      task.dueDate === nextDateValue &&
      task.title === currentTask.title &&
      task.projectId === currentTask.projectId &&
      !task.done
    ));
    const nextOccurrence = nextDate && !alreadyQueued
      ? (() => {
          const sacred = getSacredDate(nextDate);
          return {
            ...currentTask,
            id: uid(),
            sacredYear: sacred.sacredYear,
            monthIndex: sacred.monthIndex,
            day: sacred.day,
            dueDate: nextDateValue,
            done: false,
            completedAt: null,
            googleEventId: null,
            updatedAt: timestamp(),
          };
        })()
      : null;
    setTasks((current) =>
      [
        ...current.map((task) => (task.id === id ? nextTask : task)),
        ...(nextOccurrence ? [nextOccurrence] : []),
      ],
    );
    saveTask(nextTask);
    if (nextOccurrence) saveTask(nextOccurrence);
  };

  const deleteTask = (id: string) => {
    const taskToDelete = tasks.find((task) => task.id === id);
    setTasks((current) => current.filter((task) => task.id !== id));
    if (cloudUser && taskToDelete) {
      setSyncStatus("syncing");
      void removeCloudTask(cloudUser.uid, taskToDelete)
        .then(() => setSyncStatus("synced"))
        .catch((error: Error) => {
          setSyncError(error.message);
          setSyncStatus(navigator.onLine ? "error" : "offline");
        });
    }
  };

  const persistStructure = (nextProjects: GenesisProject[], nextCategories: GenesisCategory[]) => {
    if (!cloudUser) return;
    setSyncStatus("syncing");
    void saveWorkspaceStructure(nextProjects, nextCategories, metricsFor(tasks, nextProjects))
      .then(() => setSyncStatus("synced"))
      .catch((error: Error) => {
        setSyncError(error.message);
        setSyncStatus(navigator.onLine ? "error" : "offline");
      });
  };

  const addProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newProjectTitle.trim();
    if (!title) return;
    const tags = newProjectTags
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 10);
    const project: GenesisProject = {
      id: uid(),
      parentId: newProjectParent || null,
      categoryId: newProjectCategory || null,
      title,
      description: newProjectDescription.trim(),
      tags,
      status: "active",
      position: projects.length,
    };
    const nextProjects = [...projects, project];
    setProjects(nextProjects);
    persistStructure(nextProjects, categories);
    setNewProjectTitle("");
    setNewProjectDescription("");
    setNewProjectTags("");
  };

  const openProjectEditor = (project: GenesisProject) => {
    setEditingProject({ ...project, tags: [...project.tags] });
    setEditingProjectTags(project.tags.join(", "));
  };

  const saveProjectEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProject) return;
    const currentProject = projects.find((project) => project.id === editingProject.id);
    const title = editingProject.title.trim();
    if (!currentProject || !title) return;
    const parentId = editingProject.parentId === editingProject.id ? null : editingProject.parentId;
    const nextProject: GenesisProject = {
      ...editingProject,
      title,
      description: editingProject.description.trim(),
      parentId,
      tags: editingProjectTags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10),
    };
    const nextProjects = projects.map((project) => project.id === nextProject.id ? nextProject : project);
    const renamedTasks = currentProject.title === title ? [] : tasks
      .filter((task) => task.projectId === nextProject.id)
      .map((task) => ({ ...task, project: title, updatedAt: timestamp() }));
    if (renamedTasks.length) {
      const renamedById = new Map(renamedTasks.map((task) => [task.id, task]));
      setTasks((current) => current.map((task) => renamedById.get(task.id) ?? task));
      renamedTasks.forEach(saveTask);
    }
    setProjects(nextProjects);
    persistStructure(nextProjects, categories);
    setEditingProject(null);
  };

  const addCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCategoryTitle.trim();
    if (!name) return;
    const palette = ["#2d6c68", "#a5543f", "#b18b48", "#665c88", "#54718a"];
    const category: GenesisCategory = {
      id: uid(),
      name,
      color: palette[categories.length % palette.length],
      position: categories.length,
    };
    const nextCategories = [...categories, category];
    setCategories(nextCategories);
    persistStructure(projects, nextCategories);
    setNewCategoryTitle("");
  };

  const beginCategoryEdit = (category: GenesisCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryTitle(category.name);
    setEditingCategoryColor(category.color);
  };

  const saveCategoryEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = editingCategoryTitle.trim();
    if (!editingCategoryId || !name) return;
    const nextCategories = categories.map((category) => category.id === editingCategoryId
      ? { ...category, name, color: editingCategoryColor }
      : category);
    setCategories(nextCategories);
    persistStructure(projects, nextCategories);
    setEditingCategoryId("");
  };

  const deleteCategory = (id: string) => {
    const category = categories.find((item) => item.id === id);
    if (!category || !window.confirm(`Удалить категорию «${category.name}»? Проекты и задачи останутся, но будут перенесены в раздел «Без категории».`)) return;
    const nextCategories = categories.filter((item) => item.id !== id);
    const nextProjects = projects.map((project) => project.categoryId === id ? { ...project, categoryId: null } : project);
    const changedTasks = tasks.filter((task) => task.categoryId === id).map((task) => ({
      ...task,
      categoryId: null,
      updatedAt: timestamp(),
    }));
    if (changedTasks.length) {
      const changedById = new Map(changedTasks.map((task) => [task.id, task]));
      setTasks((current) => current.map((task) => changedById.get(task.id) ?? task));
      changedTasks.forEach(saveTask);
    }
    setCategories(nextCategories);
    setProjects(nextProjects);
    setNewProjectCategory((current) => current === id ? (nextCategories[0]?.id ?? "") : current);
    if (editingCategoryId === id) setEditingCategoryId("");
    persistStructure(nextProjects, nextCategories);
  };

  const toggleProject = (id: string) => {
    const current = projects.find((project) => project.id === id);
    if (!current) return;
    const next: GenesisProject = {
      ...current,
      status: current.status === "completed" ? "active" : "completed",
    };
    const nextProjects = projects.map((project) => (project.id === id ? next : project));
    setProjects(nextProjects);
    persistStructure(nextProjects, categories);
  };

  const deleteProject = (id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project || !window.confirm(`Удалить проект «${project.title}» и все его подпроекты? Задачи останутся, но перейдут в раздел без проекта.`)) return;
    const removed = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      projects.forEach((item) => {
        if (item.parentId && removed.has(item.parentId) && !removed.has(item.id)) {
          removed.add(item.id);
          changed = true;
        }
      });
    }
    const nextProjects = projects.filter((item) => !removed.has(item.id));
    const changedTasks = tasks.filter((task) => task.projectId && removed.has(task.projectId)).map((task) => ({
      ...task,
      project: "",
      projectId: null,
      categoryId: null,
      updatedAt: timestamp(),
    }));
    if (changedTasks.length) {
      const changedById = new Map(changedTasks.map((task) => [task.id, task]));
      setTasks((current) => current.map((task) => changedById.get(task.id) ?? task));
      changedTasks.forEach(saveTask);
    }
    setProjects(nextProjects);
    persistStructure(nextProjects, categories);
  };

  const exportCalendar = () => {
    if (!tasks.length) return;
    const events = tasks.map((task) => {
      const date = getGregorianDate(task.sacredYear, task.monthIndex, task.day);
      const start = icsDate(date, task.time || "09:00");
      const endDate = new Date(date);
      const [hours = 9, minutes = 0] = (task.time || "09:00")
        .split(":")
        .map(Number);
      endDate.setHours(hours + 1, minutes, 0, 0);
      const end = icsDate(endDate, `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`);
      return [
        "BEGIN:VEVENT",
        `UID:${task.id}@genesis-calendar`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeIcs(task.title)}`,
        `DESCRIPTION:${escapeIcs([task.project, ...task.tags.map((tag) => `#${tag}`)].filter(Boolean).join(" · "))}`,
        "END:VEVENT",
      ].join("\r\n");
    });
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//GENESIS//Sacred Calendar//RU",
      "CALSCALE:GREGORIAN",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/calendar;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "genesis-calendar.ics";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openSelectedInCalendar = () => {
    navigateTo("calendar");
  };

  const renderToday = () => {
    const info = todayInfo;
    const month = MONTHS[info.monthIndex];
    const day = getSacredDay(info.monthIndex, info.day);
    const gregorian = getGregorianDate(info.sacredYear, info.monthIndex, info.day);
    const moon = getMoon(gregorian);
    const element = getDayElement(info.monthIndex, info.day);
    const pythagorean = getPythagorean(info.monthIndex, info.day);
    const solarEvent = getSolarEvent(info.sacredYear, info.monthIndex, info.day);
    const nearbyDays = Array.from({ length: 5 }, (_, index) => {
      const offset = index - 2;
      const date = new Date(gregorian);
      date.setDate(date.getDate() + offset);
      const sacred = getSacredDate(date);
      return { date, sacred, active: offset === 0 };
    });

    return (
      <div className="today-view">
        <section className="hero-card" aria-labelledby="today-title">
          <div className="hero-copy">
            <div className="eyebrow-row">
              <span className="eyebrow">{month.season} · {month.roman} месяц</span>
              {solarEvent ? <span className="event-badge solar-event-badge"><b aria-hidden="true">{solarEvent.symbol}</b> {solarEvent.name}</span> : null}
            </div>
            <p className="hero-month">{month.name}</p>
            <h1 id="today-title">{day.name}</h1>
            <p className="hero-description">{day.description}</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={openSelectedInCalendar}>
                Открыть день <span aria-hidden="true">↗</span>
              </button>
              <span className="hero-date">{formatGregorian(gregorian, true)}</span>
            </div>
          </div>
          <div className="hero-number" aria-hidden="true">
            <span>{romanDay(info.monthIndex, info.day)}</span>
            <small>{info.monthIndex === 12 ? "вне времени" : `${day.pyata} пята`}</small>
          </div>
        </section>

        <div className="today-lower-grid">
          <section className="meaning-panel" aria-labelledby="rhythm-title">
            <div className="section-heading compact-heading">
              <div>
                <span className="eyebrow">Смысл дня</span>
                <h2 id="rhythm-title">Три ритма в одной точке</h2>
              </div>
              <span className="ornament" aria-hidden="true">✣</span>
            </div>
            <div className="meaning-grid">
              <article className="meaning-card">
                <span className="meaning-symbol" aria-hidden="true">{month.symbol}</span>
                <span className="meaning-label">Пята {day.pyata || "Ω"}</span>
                <strong>{day.pyataTitle || "Чистый эфир"}</strong>
                <p>{info.monthIndex === 12 ? "Законы обычного цикла приостановлены" : PYATA_MEANINGS[day.pyata - 1]}</p>
              </article>
              <article className="meaning-card">
                <span className="meaning-symbol alchemical" aria-hidden="true">{element.symbol}</span>
                <span className="meaning-label">Стихия</span>
                <strong>{element.name}</strong>
                <p>{element.meaning}</p>
              </article>
              <article className="meaning-card">
                <span className="meaning-symbol" aria-hidden="true">{pythagorean?.roman ?? "∞"}</span>
                <span className="meaning-label">Пифагорейский смысл</span>
                <strong>{pythagorean?.name ?? "Апейрон"}</strong>
                <p>{pythagorean?.meaning ?? "Безграничное · Пространство первообразов"}</p>
              </article>
            </div>
          </section>

          <section className="moon-panel" aria-labelledby="moon-title">
            <div className="moon-visual" aria-hidden="true">
              <span>{moon.icon}</span>
              <i style={{ "--moon-light": `${moon.illumination}%` } as CSSProperties} />
            </div>
            <div className="moon-copy">
              <span className="eyebrow">{moon.direction} · {moon.day} день</span>
              <h2 id="moon-title">{moon.epithet}</h2>
              <p>{moon.phase} · освещённость {moon.illumination}%</p>
              {moon.event ? <span className="moon-event">{moon.event}</span> : null}
            </div>
          </section>
        </div>

        <section className="five-day-strip" aria-labelledby="five-days-title">
          <div className="section-heading strip-heading">
            <div>
              <span className="eyebrow">Навигация</span>
              <h2 id="five-days-title">Ближайшие дни</h2>
            </div>
            <button type="button" className="text-button" onClick={() => navigateTo("calendar")}>Весь месяц →</button>
          </div>
          <div className="strip-days">
            {nearbyDays.map(({ date, sacred, active }) => {
              const nearbyMonth = MONTHS[sacred.monthIndex];
              const nearbyDay = getSacredDay(sacred.monthIndex, sacred.day);
              return (
                <button
                  type="button"
                  key={date.toISOString()}
                  className={`strip-day${active ? " active" : ""}`}
                  onClick={() => {
                    setSacredYear(sacred.sacredYear);
                    setMonthIndex(sacred.monthIndex);
                    setSelectedDay(sacred.day);
                    navigateTo("calendar");
                  }}
                  aria-label={`${formatGregorian(date, true)} — ${nearbyDay.name}`}
                >
                  <span>{new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date)}</span>
                  <strong>{romanDay(sacred.monthIndex, sacred.day)}</strong>
                  <small>{nearbyMonth.name}</small>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  };

  const renderCalendar = () => {
    const dayCount = monthIndex === 12 ? apeironLength(sacredYear) : 30;
    const days = Array.from({ length: dayCount }, (_, index) => index + 1);
    const rows = Array.from({ length: Math.ceil(dayCount / 5) }, (_, row) =>
      days.slice(row * 5, row * 5 + 5),
    );

    return (
      <div
        className="calendar-view"
        style={{
          "--month-accent": selectedMonth.color,
          "--month-art": `url("${APP_BASE}/month-art-v3/month-${String(monthIndex + 1).padStart(2, "0")}.webp")`,
        } as CSSProperties}
      >
        <header className="calendar-header">
          <span className="calendar-month-art" aria-hidden="true" />
          <div>
            <span className="eyebrow">{selectedMonth.season} · {selectedMonth.roman} месяц</span>
            <h1>{selectedMonth.name}</h1>
            <p className="calendar-title">{selectedMonth.title}</p>
            <p>{selectedMonth.description}</p>
          </div>
          <div className="month-switcher" aria-label="Переключение месяцев">
            <button type="button" onClick={() => selectMonth(monthIndex - 1)} aria-label="Предыдущий месяц">←</button>
            <span aria-hidden="true">{selectedMonth.symbol}</span>
            <button type="button" onClick={() => selectMonth(monthIndex + 1)} aria-label="Следующий месяц">→</button>
          </div>
        </header>

        <section className="month-calendar" aria-label={`Календарь месяца ${selectedMonth.name}`}>
          {rows.map((row, rowIndex) => {
            const firstDay = getSacredDay(monthIndex, row[0]);
            return (
              <div className="pyata-row" key={`${monthIndex}-${rowIndex}`}>
                <div className="pyata-row-label">
                  <span>Пята {monthIndex === 12 ? "Ω" : rowIndex + 1}</span>
                  <strong>{monthIndex === 12 ? "Вне времени" : firstDay.pyataTitle}</strong>
                  <small>{monthIndex === 12 ? "Чистый эфир" : PYATA_MEANINGS[rowIndex]}</small>
                </div>
                <div className="pyata-days">
                  {row.map((dayNumber, dayColumn) => {
                    const gregorian = getGregorianDate(sacredYear, monthIndex, dayNumber);
                    const moon = getMoon(gregorian);
                    const sacredDay = getSacredDay(monthIndex, dayNumber);
                    const key = taskDateKey(sacredYear, monthIndex, dayNumber);
                    const cellTasks = tasks
                      .filter((task) => taskDateKey(task.sacredYear, task.monthIndex, task.day) === key)
                      .sort((a, b) => a.time.localeCompare(b.time));
                    const taskCount = cellTasks.length;
                    const isToday = key === todayKey;
                    const isSelected = dayNumber === selectedDay;
                    const solarEvent = getSolarEvent(sacredYear, monthIndex, dayNumber);
                    const popoverOpen = openDayTaskPopover === key;
                    const popoverAlignment = dayColumn < 2 ? "align-left" : dayColumn > 2 ? "align-right" : "align-center";
                    return (
                      <article
                        key={dayNumber}
                        className={`calendar-day${isSelected ? " selected" : ""}${isToday ? " today" : ""}${solarEvent ? " solar-day" : ""}${taskCount ? " has-tasks" : ""}${popoverOpen ? " popover-open" : ""}`}
                      >
                        <button
                          type="button"
                          className="calendar-day-open"
                          onClick={() => {
                            setSelectedDay(dayNumber);
                            setOpenDayTaskPopover("");
                          }}
                          aria-pressed={isSelected}
                          aria-label={`${formatGregorian(gregorian, true)} — ${sacredDay.name}${solarEvent ? ` — ${solarEvent.name}` : ""}${taskCount ? ` — ${taskCount} задач` : ""}`}
                        />
                        <span className="calendar-gregorian">{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(gregorian)}</span>
                        <strong>{romanDay(monthIndex, dayNumber)}</strong>
                        {solarEvent ? <span className="calendar-solar-mark" title={solarEvent.name}><b aria-hidden="true">{solarEvent.symbol}</b><em>{solarEvent.shortName}</em></span> : null}
                        <span className="calendar-moon" title={`${moon.epithet}: ${moon.phase}`}>{moon.icon} {moon.day}</span>
                        <small>{sacredDay.name.split("(")[0].trim()}</small>
                        {taskCount ? (
                          <div className="calendar-day-task-preview" aria-hidden="true">
                            {cellTasks.slice(0, 2).map((task) => (
                              <span className={task.done ? "done" : ""} key={task.id}>{task.time || "Весь день"} · {task.title}</span>
                            ))}
                          </div>
                        ) : null}
                        {taskCount ? (
                          <button
                            type="button"
                            className="calendar-day-task-count"
                            onClick={() => {
                              setSelectedDay(dayNumber);
                              setOpenDayTaskPopover((current) => current === key ? "" : key);
                            }}
                            aria-label={`Показать задачи: ${taskCount}`}
                            aria-expanded={popoverOpen}
                            aria-haspopup="dialog"
                          >
                            {taskCount}
                          </button>
                        ) : null}
                        {popoverOpen ? (
                          <div className={`calendar-task-popover ${popoverAlignment}`} role="dialog" aria-label={`Задачи на ${formatGregorian(gregorian, true)}`}>
                            <header>
                              <strong>Задачи · {taskCount}</strong>
                              <button type="button" onClick={() => setOpenDayTaskPopover("")} aria-label="Закрыть список задач">×</button>
                            </header>
                            <ul>
                              {cellTasks.slice(0, 6).map((task) => (
                                <li className={task.done ? "done" : ""} key={task.id}>
                                  <button type="button" onClick={() => {
                                    setOpenDayTaskPopover("");
                                    openTaskEditor(task);
                                  }}>
                                    <time>{task.time || "Весь день"}</time>
                                    <span>{task.title}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                            {taskCount > 6 ? <small>Ещё {taskCount - 6}</small> : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        <section className={`selected-day-card${selectedSolarEvent ? " solar-selected-day" : ""}`} aria-labelledby="selected-day-title">
          <div className="selected-day-symbol" aria-hidden="true">{selectedSolarEvent?.symbol ?? selectedElement.symbol}</div>
          <div className="selected-day-copy">
            <span className="eyebrow">{formatGregorian(selectedDate, true)} · {selectedMoon.epithet}</span>
            <h2 id="selected-day-title">{selectedSacredDay.name}</h2>
            <p>{selectedSacredDay.description}</p>
            {selectedSolarEvent ? <strong className="selected-solar-event">{selectedSolarEvent.name} · День Солнца</strong> : null}
          </div>
          <dl className="selected-day-facts">
            {selectedSolarEvent ? <div className="solar-fact"><dt>Солнечная точка</dt><dd>{selectedSolarEvent.name}</dd></div> : null}
            <div><dt>Стихия</dt><dd>{selectedElement.name}</dd></div>
            <div><dt>Пята</dt><dd>{selectedSacredDay.pyataTitle || "Апейрон"}</dd></div>
            <div><dt>Число</dt><dd>{selectedPythagorean?.name || "Безграничное"}</dd></div>
          </dl>
        </section>
      </div>
    );
  };

  const renderProjects = () => {
    const search = tagSearch.trim().replace(/^#/, "").toLocaleLowerCase("ru-RU");
    const taskMatchesTag = (task: Task) => !search || task.tags.some((tag) => tag.toLocaleLowerCase("ru-RU").includes(search));
    const matchingProjectIds = new Set(projects.filter((project) => (
      !search || project.tags.some((tag) => tag.toLocaleLowerCase("ru-RU").includes(search)) ||
      tasks.some((task) => task.projectId === project.id && taskMatchesTag(task))
    )).map((project) => project.id));
    if (search) {
      let changed = true;
      while (changed) {
        changed = false;
        projects.forEach((project) => {
          if (matchingProjectIds.has(project.id) && project.parentId && !matchingProjectIds.has(project.parentId)) {
            matchingProjectIds.add(project.parentId);
            changed = true;
          }
        });
      }
    }
    const projectRows = flattenProjects(projects).filter(({ project }) => !search || matchingProjectIds.has(project.id));
    const inboxTasks = tasks.filter((task) => !task.projectId && !task.project && taskMatchesTag(task));
    const activeTasks = tasks.filter((task) => !task.done);
    const completedTasks = tasks.filter((task) => task.done);

    return (
      <div className="projects-view">
        <header className="projects-header">
          <div>
            <span className="eyebrow">Система порядка</span>
            <h1>Проекты и направления</h1>
            <p>Разделяйте большие замыслы на подпроекты и конкретные действия. Связи, повторения и сроки остаются видимыми в плане дня.</p>
          </div>
          <div className="projects-summary" aria-label="Сводка задач">
            <span><strong>{projects.filter((project) => project.status === "active").length}</strong> проектов</span>
            <span><strong>{activeTasks.length}</strong> действий</span>
            <span><strong>{completedTasks.length}</strong> завершено</span>
          </div>
        </header>

        <label className="tag-search">
          <span aria-hidden="true">⌕</span>
          <input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Поиск по тегам — например, #работа" />
          {tagSearch ? <button type="button" onClick={() => setTagSearch("")} aria-label="Очистить поиск">×</button> : null}
        </label>

        <section className="category-strip" aria-label="Категории жизни">
          {categories.map((category) => {
            const projectCount = projects.filter((project) => project.categoryId === category.id).length;
            const isEditing = editingCategoryId === category.id;
            return (
              <article className={isEditing ? "editing" : ""} key={category.id} style={{ "--category-color": category.color } as CSSProperties}>
                {isEditing ? (
                  <form className="category-edit-form" onSubmit={saveCategoryEdit}>
                    <input type="color" value={editingCategoryColor} onChange={(event) => setEditingCategoryColor(event.target.value)} aria-label="Цвет категории" />
                    <input value={editingCategoryTitle} onChange={(event) => setEditingCategoryTitle(event.target.value)} aria-label="Название категории" />
                    <button type="submit" aria-label="Сохранить категорию">✓</button>
                    <button type="button" onClick={() => setEditingCategoryId("")} aria-label="Отменить редактирование">×</button>
                  </form>
                ) : (
                  <>
                    <i aria-hidden="true" />
                    <strong>{category.name}</strong>
                    <span>{projectCount} проектов</span>
                    <div className="category-actions">
                      <button type="button" onClick={() => beginCategoryEdit(category)} aria-label={`Редактировать категорию «${category.name}»`}>✎</button>
                      <button type="button" onClick={() => deleteCategory(category.id)} aria-label={`Удалить категорию «${category.name}»`}>×</button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
          <form className="quick-category-form" onSubmit={addCategory}>
            <label className="sr-only" htmlFor="new-category">Новая категория</label>
            <input id="new-category" value={newCategoryTitle} onChange={(event) => setNewCategoryTitle(event.target.value)} placeholder="＋ категория" />
          </form>
        </section>

        <div className="projects-layout">
          <section className="project-tree-panel" aria-labelledby="project-tree-title">
            <div className="section-heading compact-heading">
              <div>
                <span className="eyebrow">Иерархия</span>
                <h2 id="project-tree-title">Дерево проектов</h2>
              </div>
              <span className="ornament" aria-hidden="true">◎</span>
            </div>

            <div className="project-tree">
              {projectRows.length ? projectRows.map(({ project, depth }) => {
                const category = categories.find((item) => item.id === project.categoryId);
                const projectTasks = tasks.filter((task) => task.projectId === project.id);
                const finished = projectTasks.filter((task) => task.done).length;
                return (
                  <article
                    className={`project-row${project.status === "completed" ? " completed" : ""}`}
                    key={project.id}
                    style={{ "--project-depth": depth, "--project-color": category?.color ?? "#8d7750" } as CSSProperties}
                  >
                    <button type="button" className="project-status" onClick={() => toggleProject(project.id)} aria-label={project.status === "completed" ? `Вернуть проект «${project.title}»` : `Завершить проект «${project.title}»`}>
                      {project.status === "completed" ? "✓" : ""}
                    </button>
                    <button type="button" className="project-open" onClick={() => setTaskProject(project.title)}>
                      <span>{depth ? "↳" : "◇"}</span>
                      <div>
                        <strong>{project.title}</strong>
                        <small>{category?.name ?? "Без категории"} · {finished}/{projectTasks.length} действий</small>
                        {project.description ? <p>{project.description}</p> : null}
                        {project.tags.length ? <em>{project.tags.map((tag) => `#${tag}`).join("  ")}</em> : null}
                      </div>
                    </button>
                    <button type="button" className="project-edit" onClick={() => openProjectEditor(project)} aria-label={`Редактировать проект «${project.title}»`}>✎</button>
                    <button type="button" className="project-delete" onClick={() => deleteProject(project.id)} aria-label={`Удалить проект «${project.title}»`}>×</button>
                    <i className="project-progress" style={{ "--project-progress": `${projectTasks.length ? Math.round((finished / projectTasks.length) * 100) : 0}%` } as CSSProperties} />
                  </article>
                );
              }) : (
                <div className="task-empty compact-empty">
                  <span aria-hidden="true">{search ? "⌕" : "◇"}</span>
                  <strong>{search ? "По этому тегу ничего не найдено" : "Создайте первый проект"}</strong>
                  <p>{search ? "Попробуйте другой тег или очистите строку поиска." : "Большая цель становится управляемой, когда у неё есть структура."}</p>
                </div>
              )}
            </div>

            <form className="project-form" onSubmit={addProject}>
              <label>
                <span>Новый проект или подпроект</span>
                <input value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} placeholder="Название результата" />
              </label>
              <label>
                <span>Описание проекта</span>
                <textarea value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} placeholder="Цель, ожидаемый результат и важные детали" rows={3} />
              </label>
              <div className="project-form-grid">
                <label>
                  <span>Категория</span>
                  <select value={newProjectCategory} onChange={(event) => setNewProjectCategory(event.target.value)}>
                    <option value="">Без категории</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label>
                  <span>Родительский проект</span>
                  <select value={newProjectParent} onChange={(event) => setNewProjectParent(event.target.value)}>
                    <option value="">Нет — верхний уровень</option>
                    {projectRows.map(({ project, depth }) => <option key={project.id} value={project.id}>{"— ".repeat(depth)}{project.title}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span>Теги проекта</span>
                <input value={newProjectTags} onChange={(event) => setNewProjectTags(event.target.value)} placeholder="стратегия, дом, развитие" />
              </label>
              <button type="submit" className="add-task-button" disabled={!newProjectTitle.trim()}><span aria-hidden="true">＋</span> Создать проект</button>
            </form>
          </section>

          <aside className="project-side-stack">
            <section className="inbox-card">
              <span className="eyebrow">Входящие</span>
              <h2>Хаос-бокс</h2>
              <p>Неразобранные действия, которым ещё не назначен проект.</p>
              <strong>{inboxTasks.length}</strong>
              {inboxTasks.slice(0, 5).map((task) => <button type="button" key={task.id} onClick={() => openTaskEditor(task)}>{task.title}</button>)}
            </section>
            <section className="daily-plan-card">
              <span className="eyebrow">План на день</span>
              <h2>{formatGregorian(selectedDate, true)}</h2>
              <div><strong>{dayTasks.filter((task) => !task.done).length}</strong><span>осталось</span></div>
              <div><strong>{dayTasks.filter((task) => task.done).length}</strong><span>завершено</span></div>
              <button type="button" className="primary-button" onClick={() => setPlanManagerOpen(true)}>Открыть план</button>
            </section>
          </aside>
        </div>
      </div>
    );
  };

  const renderYear = () => (
    <div className="year-view">
      <header className="year-header">
        <div>
          <span className="eyebrow">360 + {apeironLength(sacredYear)} дней</span>
          <h1>Круг года {sacredYear}–{sacredYear + 1}</h1>
          <p>Двенадцать упорядоченных месяцев и короткий период Апейрона — пространство между завершением и новым началом.</p>
        </div>
        <div className="year-switcher">
          <button type="button" onClick={() => changeSacredYear(sacredYear - 1)} aria-label="Предыдущий год">←</button>
          <strong>{sacredYear}</strong>
          <button type="button" onClick={() => changeSacredYear(sacredYear + 1)} aria-label="Следующий год">→</button>
        </div>
      </header>
      <section className="solar-year-strip" aria-label="Солнцестояния и равноденствия года">
        {solarEvents.map((event) => (
          <button
            type="button"
            key={event.id}
            onClick={() => {
              setMonthIndex(event.monthIndex);
              setSelectedDay(event.day);
              navigateTo("calendar");
            }}
          >
            <span className="solar-glyph" aria-hidden="true"><i>{event.symbol}</i></span>
            <span><small>{event.kind === "equinox" ? "Равноденствие" : "Солнцестояние"}</small><strong>{formatGregorian(event.date, true)}</strong></span>
          </button>
        ))}
      </section>
      <section className="year-grid" aria-label="Все месяцы года">
        {MONTHS.map((month) => {
          const availableDays = month.index === 12 ? apeironLength(sacredYear) : 30;
          const pyatas = Array.from(
            { length: Math.ceil(availableDays / 5) },
            (_, pyataIndex) => Array.from(
              { length: Math.min(5, availableDays - pyataIndex * 5) },
              (__, dayIndex) => pyataIndex * 5 + dayIndex + 1,
            ),
          );
          const monthTaskCount = tasks.filter(
            (task) => task.sacredYear === sacredYear && task.monthIndex === month.index,
          ).length;
          const isCurrent = sacredYear === todayInfo.sacredYear && month.index === todayInfo.monthIndex;
          const openDay = (day: number) => {
            setMonthIndex(month.index);
            setSelectedDay(day);
            navigateTo("calendar");
          };
          return (
            <article
              className={`year-month${month.index === 12 ? " apeiron" : ""}${isCurrent ? " current" : ""}`}
              key={month.name}
              aria-labelledby={`year-month-${month.index}`}
              style={{
                "--month-accent": month.color,
                "--month-art": `url("${APP_BASE}/month-art-v3/month-${String(month.index + 1).padStart(2, "0")}.webp")`,
              } as CSSProperties}
            >
              <span className="year-month-top"><i>{month.roman}</i><b>{month.symbol}</b></span>
              <strong id={`year-month-${month.index}`}>{month.name}</strong>
              <small>{month.title}</small>
              <div className="mini-pyatas">
                {pyatas.map((days, pyataIndex) => (
                  <div
                    className={`mini-pyata ${(pyataIndex + 1) % 2 === 0 ? "even" : "odd"}`}
                    key={`${month.index}-${pyataIndex}`}
                  >
                    <span className="mini-pyata-label">
                      <b>{pyataIndex + 1}</b>
                      <small>{(pyataIndex + 1) % 2 === 0 ? "чётная" : "нечётная"}</small>
                    </span>
                    <span className="mini-pyata-days">
                      {days.map((dayNumber) => {
                        const key = taskDateKey(sacredYear, month.index, dayNumber);
                        const taskCount = tasks.filter(
                          (task) => taskDateKey(task.sacredYear, task.monthIndex, task.day) === key,
                        ).length;
                        const hasTask = taskCount > 0;
                        const todayDot = key === todayKey;
                        const solarDot = Boolean(getSolarEvent(sacredYear, month.index, dayNumber));
                        const sacredDay = getSacredDay(month.index, dayNumber);
                        return (
                          <button
                            type="button"
                            className={`mini-day${hasTask ? " has-task" : ""}${todayDot ? " today" : ""}${solarDot ? " solar" : ""}`}
                            key={dayNumber}
                            onClick={() => openDay(dayNumber)}
                            aria-label={`${month.name}, день ${dayNumber}: ${sacredDay.name}${taskCount ? `, задач: ${taskCount}` : ""}`}
                            title={`${sacredDay.name} · открыть день`}
                          >
                            <span className="mini-day-number">{(["I", "II", "III", "IIII", "V"] as const)[(dayNumber - 1) % 5]}</span>
                            {taskCount ? <span className="mini-day-task-count" aria-hidden="true">{taskCount}</span> : null}
                          </button>
                        );
                      })}
                    </span>
                  </div>
                ))}
              </div>
              <footer className="year-month-footer">
                <span className="year-month-meta">
                  <em>{month.season}</em>
                  {monthTaskCount ? <i>{monthTaskCount} задач</i> : null}
                </span>
                <button
                  type="button"
                  className="year-open-button"
                  onClick={() => openDay(isCurrent ? todayInfo.day : 1)}
                  onPointerMove={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
                    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
                  }}
                  onPointerLeave={(event) => {
                    event.currentTarget.style.removeProperty("--pointer-x");
                    event.currentTarget.style.removeProperty("--pointer-y");
                  }}
                >
                  <span>Открыть месяц</span>
                  <i aria-hidden="true" />
                </button>
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );

  const syncLabel =
    syncStatus === "loading"
      ? "Загрузка данных"
      : syncStatus === "syncing"
        ? "Синхронизация…"
        : syncStatus === "synced"
          ? "Синхронизировано с Google"
          : syncStatus === "offline"
            ? "Офлайн · изменения в очереди"
            : syncStatus === "error"
              ? "Ошибка синхронизации"
              : syncStatus === "setup"
                ? "Google-синхронизация готовится"
                : "Сохранено на устройстве";

  const navigation = cloudUser?.isAdmin
    ? [...NAVIGATION, { id: "admin" as const, label: "Админ", symbol: "Σ" }]
    : NAVIGATION;

  if (legalPage) {
    return <LegalPage page={legalPage} />;
  }

  if (isGoogleSyncConfigured && !authResolved) {
    return (
      <main className="auth-loading" role="status" aria-live="polite">
        <span className="auth-sun"><i /></span>
        <strong>GENESIS</strong>
        <p>Открываем личное пространство…</p>
      </main>
    );
  }

  if (isGoogleSyncConfigured && !cloudUser) {
    return (
      <WelcomeScreen
        busy={syncStatus === "syncing"}
        error={syncError}
        onGoogle={() => void handleGoogleSignIn()}
      />
    );
  }

  return (
    <main
      className="genesis-app"
      style={{ "--genesis-hero-image": `url("${APP_BASE}/genesis-hero.png")` } as CSSProperties}
    >
      <a className="skip-link" href="#main-content">К основному содержанию</a>
      <aside className="app-sidebar" aria-label="Основная навигация">
        <button className="brand-mark" type="button" onClick={selectToday} aria-label="GENESIS — на главную">
          <span
            className="brand-icon"
            style={{ backgroundImage: `url("${APP_BASE}/icons/icon-192.png")` }}
            aria-hidden="true"
          />
          <strong>GENESIS</strong>
          <small>ἡμερολόγιον</small>
        </button>
        <nav className="main-nav">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => activateNavigation(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <span aria-hidden="true">{item.symbol}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="month-rail" aria-label="Месяцы">
          {MONTHS.map((month) => (
            <button
              type="button"
              key={month.name}
              className={monthIndex === month.index ? "active" : ""}
              onClick={() => {
                setMonthIndex(month.index);
                setSelectedDay(1);
                navigateTo("calendar");
              }}
              title={month.name}
              aria-label={month.name}
              style={{ "--month-accent": month.color } as CSSProperties}
            >
              {month.symbol}
              {month.index === 12 ? <small>{month.name}</small> : null}
            </button>
          ))}
        </div>
        <div className={`sidebar-foot sync-${syncStatus}`}>
          <span className="sync-dot" aria-hidden="true" />
          <span>
            {cloudUser ? "Google-синхронизация" : "Локальное хранение"}
            <br />
            {cloudUser?.email ?? (isStandalone ? "Приложение установлено" : "Веб-приложение")}
          </span>
        </div>
      </aside>

      <section className="app-stage">
        <header className="topbar">
          <div>
            <span className="topbar-kicker">Сакральный календарь</span>
            <strong>{MONTHS[todayInfo.monthIndex].name} · {romanDay(todayInfo.monthIndex, todayInfo.day)}</strong>
          </div>
          <div className="topbar-actions">
            {!isStandalone && canInstall ? (
              <button type="button" className="icon-button ux-action-button" data-tooltip="Установить приложение" title="Установить GENESIS" aria-label="Установить GENESIS" onClick={() => void install()}>
                <span className="ux-install-icon" aria-hidden="true" />
              </button>
            ) : null}
            {cloudUser ? (
              <div className="account-chip" ref={accountMenuRef}>
                <button
                  type="button"
                  className="account-open"
                  onClick={() => setAccountMenuOpen((current) => !current)}
                  aria-label="Открыть меню аккаунта"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                >
                  <span
                    className="account-avatar"
                    style={cloudUser.photoURL ? { backgroundImage: `url(${cloudUser.photoURL})` } : undefined}
                    aria-hidden="true"
                  >
                    {cloudUser.photoURL ? "" : "G"}
                  </span>
                  <span>
                    <strong>{cloudUser.displayName || "Google"}</strong>
                    <small>{cloudUser.calendarConnected ? "Google Calendar подключён" : "личный кабинет"}</small>
                  </span>
                </button>
                {accountMenuOpen ? (
                  <div className="account-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => {
                      setAccountMenuOpen(false);
                      setAccountOpen(true);
                    }}>
                      <span aria-hidden="true">○</span>
                      Личная страница
                    </button>
                    <button type="button" role="menuitem" className="account-menu-signout" onClick={() => void handleGoogleSignOut()}>
                      <span aria-hidden="true">↗</span>
                      Выйти из аккаунта
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                className="google-button"
                onClick={() => void handleGoogleSignIn()}
                disabled={!isGoogleSyncConfigured || syncStatus === "syncing"}
                title={!isGoogleSyncConfigured ? "Сервер GENESIS подключается" : "Войти и синхронизировать задачи"}
              >
                <span aria-hidden="true">G</span> Войти через Google
              </button>
            )}
            <button type="button" className="ghost-button" onClick={selectToday}>К сегодняшнему дню</button>
            <button type="button" className="icon-button ux-action-button" data-tooltip={tasks.length ? "Экспортировать календарь .ics" : "Добавьте задачу для экспорта"} title={tasks.length ? "Экспортировать календарь .ics" : "Добавьте задачу для экспорта"} onClick={exportCalendar} disabled={!tasks.length} aria-label="Экспортировать задачи в календарь .ics">
              <span className="ux-calendar-icon" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={`workspace${view === "admin" || view === "stoicheion" ? " workspace-full" : ""}${view === "today" ? " today-workspace" : ""}`} id="main-content">
          <div className="content-column">
            {view === "today" ? renderToday() : null}
            {view === "calendar" ? renderCalendar() : null}
            {view === "projects" ? renderProjects() : null}
            {view === "year" ? renderYear() : null}
            {view === "stoicheion" ? <StoicheionView /> : null}
            {view === "admin" && cloudUser?.isAdmin ? <AdminPanel /> : null}
          </div>

          {view !== "admin" && view !== "stoicheion" ? <aside className="planner-panel" aria-labelledby="planner-title">
            <div className="planner-date">
              <span className="eyebrow">План дня</span>
              <button type="button" onClick={openSelectedInCalendar}>
                <strong>{selectedDay}</strong>
                <span>{selectedMonth.name}<br />{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(selectedDate)}</span>
              </button>
            </div>
            <div className="planner-heading">
              <div>
                <h2 id="planner-title">Задачи</h2>
                <p>{dayTasks.length ? `${dayTasks.filter((task) => !task.done).length} осталось` : "День свободен"}</p>
              </div>
              <span>{dayTasks.length}</span>
            </div>

            <div className="task-list" aria-live="polite">
              {dayTasks.length ? dayTasks.map((task) => (
                <article className={`task-item${task.done ? " done" : ""}`} key={task.id}>
                  <button type="button" className="task-check" onClick={() => toggleTask(task.id)} aria-label={task.done ? `Вернуть задачу «${task.title}»` : `Завершить задачу «${task.title}»`}>
                    {task.done ? "✓" : ""}
                  </button>
                  <button type="button" className="task-open" onClick={() => openTaskEditor(task)}>
                    <span className="task-meta">{task.time || "В течение дня"}{task.project ? ` · ${task.project}` : ""}{task.recurrence !== "none" ? " · ↻" : ""}{task.reminderMinutes !== null ? ` · ⏰ ${task.reminderMinutes} мин` : ""}</span>
                    <strong>{task.title}</strong>
                    {task.tags.length ? <span className="task-tags">{task.tags.map((tag) => <i key={tag}>#{tag}</i>)}</span> : null}
                    {task.dependsOnIds.length ? <span className="task-dependency">↳ после: {task.dependsOnIds.map((dependencyId) => tasks.find((item) => item.id === dependencyId)?.title).filter(Boolean).join(", ") || `${task.dependsOnIds.length} связанных задач`}</span> : null}
                  </button>
                  <button type="button" className="task-delete" onClick={() => deleteTask(task.id)} aria-label={`Удалить задачу «${task.title}»`}>×</button>
                </article>
              )) : (
                <div className="task-empty">
                  <span aria-hidden="true">◇</span>
                  <strong>Пространство свободно</strong>
                  <p>Добавьте действие, которое поддержит смысл выбранного дня.</p>
                </div>
              )}
            </div>

            <form className="task-form" onSubmit={addTask}>
              {selectedDateIsPast ? (
                <p className="past-date-notice" role="status">На прошедшую дату можно просматривать и редактировать задачи, но добавлять новые нельзя.</p>
              ) : null}
              <label>
                <span>Новая задача</span>
                <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Что важно совершить?" />
              </label>
              <div className="task-form-row">
                <label>
                  <span>Время</span>
                  <input type="time" value={taskTime} onChange={(event) => setTaskTime(event.target.value)} />
                </label>
                <label>
                  <span>Проект</span>
                  <input list="project-list" value={taskProject} onChange={(event) => setTaskProject(event.target.value)} placeholder="Без проекта" />
                  <datalist id="project-list">{projects.filter((project) => project.status === "active").map((project) => <option value={project.title} key={project.id} />)}</datalist>
                </label>
              </div>
              <div className="task-form-row">
                <label>
                  <span>Повторение</span>
                  <select value={taskRecurrence} onChange={(event) => setTaskRecurrence(event.target.value as RecurrenceKind)}>
                    <option value="none">Не повторять</option>
                    <option value="daily">Каждый день</option>
                    <option value="weekdays">По будням</option>
                    <option value="weekly">Каждую неделю</option>
                    <option value="monthly">Каждый месяц</option>
                    <option value="yearly">Каждый год</option>
                  </select>
                </label>
                <label>
                  <span>Напомнить</span>
                  <select value={taskReminder} onChange={(event) => setTaskReminder(event.target.value)}>
                    <option value="">Без напоминания</option>
                    <option value="10">За 10 минут</option>
                    <option value="30">За 30 минут</option>
                    <option value="60">За 1 час</option>
                    <option value="1440">За 1 день</option>
                  </select>
                </label>
              </div>
              {taskRecurrence !== "none" || tasks.length ? (
                <div className="task-form-row">
                  {taskRecurrence !== "none" ? (
                    <label>
                      <span>Интервал</span>
                      <input type="number" min="1" max="99" value={taskRecurrenceInterval} onChange={(event) => setTaskRecurrenceInterval(event.target.value)} />
                    </label>
                  ) : <span />}
                  {tasks.length ? (
                    <label>
                      <span>Зависит от</span>
                      <select multiple value={taskDependsOn} onChange={(event) => setTaskDependsOn(Array.from(event.target.selectedOptions, (option) => option.value))}>
                        {tasks.filter((task) => !task.done).slice(0, 100).map((task) => <option key={task.id} value={task.id}>{task.project ? `${task.project} · ` : ""}{task.title}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
              ) : null}
              <label>
                <span>Теги</span>
                <input value={taskTags} onChange={(event) => setTaskTags(event.target.value)} placeholder="ритуал, работа, дом" />
              </label>
              <div className="sync-checkbox sync-always-on">
                <span aria-hidden="true">✓</span>
                <span>Задача будет сохранена локально и синхронизирована с Google Calendar</span>
              </div>
              <button type="submit" className="add-task-button" disabled={!taskTitle.trim() || selectedDateIsPast}>
                <span aria-hidden="true">＋</span> Добавить задачу
              </button>
            </form>
            <div className="planner-foot">
              <span title={syncError || undefined}><i className={`sync-dot sync-${syncStatus}`} /> {syncLabel}</span>
              <button type="button" className="planner-export-button ux-action-button" data-tooltip={tasks.length ? "Экспортировать календарь .ics" : "Добавьте задачу для экспорта"} title={tasks.length ? "Экспортировать календарь .ics" : "Добавьте задачу для экспорта"} onClick={exportCalendar} disabled={!tasks.length} aria-label="Экспортировать задачи в календарь .ics">
                <span className="ux-calendar-icon" aria-hidden="true" />
              </button>
            </div>
          </aside> : null}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Мобильная навигация">
        {navigation.map((item) => (
          <button type="button" key={item.id} data-nav-id={item.id} className={view === item.id ? "active" : ""} onClick={() => activateNavigation(item.id)}>
            <span aria-hidden="true">{item.symbol}</span>{item.label}
          </button>
        ))}
      </nav>
      {planManagerOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPlanManagerOpen(false); }}>
          <section className="editor-modal plan-manager-modal" role="dialog" aria-modal="true" aria-labelledby="plan-manager-title">
            <button type="button" className="modal-close" onClick={() => setPlanManagerOpen(false)} aria-label="Закрыть">×</button>
            <span className="eyebrow">План на день</span>
            <h2 id="plan-manager-title">{formatGregorian(selectedDate, true)}</h2>
            <label className="plan-date-picker">
              <span>Выбрать день</span>
              <input type="date" value={selectedDateValue} onChange={(event) => {
                const date = new Date(`${event.target.value}T12:00:00`);
                if (Number.isNaN(date.getTime())) return;
                const sacred = getSacredDate(date);
                setSacredYear(sacred.sacredYear);
                setMonthIndex(sacred.monthIndex);
                setSelectedDay(sacred.day);
              }} />
            </label>
            <div className="plan-manager-grid">
              <section>
                <header><strong>Дела и задачи</strong><span>{dayTasks.length}</span></header>
                <div className="plan-manager-list">
                  {dayTasks.length ? dayTasks.map((task) => (
                    <article key={task.id} className={task.done ? "done" : ""}>
                      <button type="button" className="task-check" onClick={() => toggleTask(task.id)}>{task.done ? "✓" : ""}</button>
                      <button type="button" onClick={() => { setPlanManagerOpen(false); openTaskEditor(task); }}><strong>{task.title}</strong><small>{task.time || "В течение дня"}{task.project ? ` · ${task.project}` : ""}</small></button>
                    </article>
                  )) : <p>На этот день задач пока нет.</p>}
                </div>
              </section>
              <section>
                <header><strong>Проекты и планы</strong><span>{projects.length}</span></header>
                <div className="plan-manager-list">
                  {flattenProjects(projects).map(({ project, depth }) => (
                    <button type="button" key={project.id} style={{ "--project-depth": depth } as CSSProperties} onClick={() => { setPlanManagerOpen(false); openProjectEditor(project); }}>
                      <strong>{project.title}</strong><small>{project.description || "Открыть и отредактировать проект"}</small>
                    </button>
                  ))}
                </div>
              </section>
            </div>
            <div className="editor-actions">
              <button type="button" className="text-button" onClick={() => setPlanManagerOpen(false)}>Закрыть</button>
              <button type="button" className="primary-button" onClick={() => { setPlanManagerOpen(false); navigateTo("projects"); }}>Все проекты и новые задачи</button>
            </div>
          </section>
        </div>
      ) : null}
      {editingTask ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingTask(null); }}>
          <form className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="task-editor-title" onSubmit={saveTaskEdit}>
            <button type="button" className="modal-close" onClick={() => setEditingTask(null)} aria-label="Закрыть">×</button>
            <span className="eyebrow">Редактирование задачи</span>
            <h2 id="task-editor-title">Задача и её контекст</h2>
            {editingTask.googleTaskId ? <p className="editor-source-note">Задача синхронизирована с Google Tasks. Изменения появятся и в Google Calendar.</p> : null}
            <label>
              <span>Название</span>
              <input value={editingTask.title} onChange={(event) => setEditingTask((current) => current ? { ...current, title: event.target.value } : current)} required />
            </label>
            <label>
              <span>Описание</span>
              <textarea rows={4} value={editingTask.description} onChange={(event) => setEditingTask((current) => current ? { ...current, description: event.target.value } : current)} placeholder="Подробности, результат и заметки" />
            </label>
            <div className="editor-grid">
              <label>
                <span>Дата</span>
                <input type="date" min={editingTask.dueDate < todayDateValue ? editingTask.dueDate : todayDateValue} value={editingTask.dueDate} onChange={(event) => setEditingTask((current) => current ? { ...current, dueDate: event.target.value } : current)} required />
              </label>
              <label>
                <span>Время</span>
                <input type="time" value={editingTask.time} onChange={(event) => setEditingTask((current) => current ? { ...current, time: event.target.value } : current)} disabled={Boolean(editingTask.googleTaskId)} />
              </label>
              <label>
                <span>Проект</span>
                <select value={editingTask.projectId ?? ""} onChange={(event) => setEditingTask((current) => current ? { ...current, projectId: event.target.value || null } : current)} disabled={Boolean(editingTask.googleTaskId)}>
                  <option value="">Без проекта</option>
                  {flattenProjects(projects).map(({ project, depth }) => <option key={project.id} value={project.id}>{"— ".repeat(depth)}{project.title}</option>)}
                </select>
              </label>
              <label>
                <span>Напоминание</span>
                <select value={editingTask.reminderMinutes ?? ""} onChange={(event) => setEditingTask((current) => current ? { ...current, reminderMinutes: event.target.value ? Number(event.target.value) : null } : current)} disabled={Boolean(editingTask.googleTaskId)}>
                  <option value="">Без напоминания</option>
                  <option value="10">За 10 минут</option>
                  <option value="30">За 30 минут</option>
                  <option value="60">За 1 час</option>
                  <option value="1440">За 1 день</option>
                </select>
              </label>
            </div>
            <label>
              <span>Теги через запятую</span>
              <input value={editingTaskTags} onChange={(event) => setEditingTaskTags(event.target.value)} placeholder="работа, дом, ритуал" disabled={Boolean(editingTask.googleTaskId)} />
            </label>
            <div className="editor-actions">
              <button type="button" className="text-button" onClick={() => setEditingTask(null)}>Отмена</button>
              <button type="submit" className="primary-button" disabled={!editingTask.title.trim()}>Сохранить задачу</button>
            </div>
          </form>
        </div>
      ) : null}
      {editingProject ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingProject(null); }}>
          <form className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="project-editor-title" onSubmit={saveProjectEdit}>
            <button type="button" className="modal-close" onClick={() => setEditingProject(null)} aria-label="Закрыть">×</button>
            <span className="eyebrow">Редактирование проекта</span>
            <h2 id="project-editor-title">Название и описание</h2>
            <label>
              <span>Название проекта</span>
              <input value={editingProject.title} onChange={(event) => setEditingProject((current) => current ? { ...current, title: event.target.value } : current)} required />
            </label>
            <label>
              <span>Описание проекта</span>
              <textarea rows={5} value={editingProject.description} onChange={(event) => setEditingProject((current) => current ? { ...current, description: event.target.value } : current)} placeholder="Цель, критерий завершения и важные детали" />
            </label>
            <div className="editor-grid">
              <label>
                <span>Категория</span>
                <select value={editingProject.categoryId ?? ""} onChange={(event) => setEditingProject((current) => current ? { ...current, categoryId: event.target.value || null } : current)}>
                  <option value="">Без категории</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                <span>Родительский проект</span>
                <select value={editingProject.parentId ?? ""} onChange={(event) => setEditingProject((current) => current ? { ...current, parentId: event.target.value || null } : current)}>
                  <option value="">Нет — верхний уровень</option>
                  {flattenProjects(projects).filter(({ project }) => project.id !== editingProject.id && !projectIsDescendant(projects, project.id, editingProject.id)).map(({ project, depth }) => <option key={project.id} value={project.id}>{"— ".repeat(depth)}{project.title}</option>)}
                </select>
              </label>
            </div>
            <label>
              <span>Теги через запятую</span>
              <input value={editingProjectTags} onChange={(event) => setEditingProjectTags(event.target.value)} placeholder="стратегия, развитие, дом" />
            </label>
            <div className="editor-actions">
              <button type="button" className="text-button" onClick={() => setEditingProject(null)}>Отмена</button>
              <button type="submit" className="primary-button" disabled={!editingProject.title.trim()}>Сохранить проект</button>
            </div>
          </form>
        </div>
      ) : null}
      {accountOpen && cloudUser ? (
        <AccountPanel
          user={cloudUser}
          onClose={() => setAccountOpen(false)}
          onReconnectGoogle={() => {
            setAccountOpen(false);
            void handleGoogleSignIn();
          }}
        />
      ) : null}
    </main>
  );
}
