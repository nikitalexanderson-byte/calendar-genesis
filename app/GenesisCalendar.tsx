"use client";

import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
  type TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type GoogleTaskList,
  type GenesisCategory,
  type GenesisProject,
  type GenesisTask as Task,
  type GenesisUser,
  type RecurrenceKind,
  type TaskListProjectLink,
  type TaskOrigin,
  createGoogleTaskList,
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
import { TimeClockPicker } from "./TimeClockPicker";
import { MoonPhaseIcon } from "./MoonPhaseIcon";
import { RecurrenceBuilder } from "./RecurrenceBuilder";
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
import {
  type AutomaticSolarLocation,
  type DeviceLocation,
  formatDeviceSolarTime,
  getAutomaticSolarLocation,
  getSunriseSunset,
} from "./solar-times";
import { usePwaInstall } from "./use-pwa-install";
import {
  buildRecurrenceDates,
  DEFAULT_RECURRENCE_CONFIG,
  normalizeRecurrenceConfig,
  type RecurrenceConfig,
  type RecurrenceMode,
  type RecurrencePattern,
} from "./task-recurrence";

type ViewName = "today" | "calendar" | "projects" | "year" | "all-tasks" | "stoicheion" | "admin";

type StoredState = {
  tasks: Task[];
  projects: GenesisProject[];
  categories: GenesisCategory[];
  taskLists: GoogleTaskList[];
  taskListLinks: TaskListProjectLink[];
};

type SyncStatus =
  | "loading"
  | "local"
  | "setup"
  | "syncing"
  | "synced"
  | "offline"
  | "error";

type ProjectDragItem = {
  kind: "task" | "task-list";
  id: string;
  title: string;
};

type ProjectTouchDrag = {
  item: ProjectDragItem;
  startX: number;
  startY: number;
  active: boolean;
  timer: number;
};

type TaskListDraft = {
  id: string;
  title: string;
  dueDate: string;
};

type DayDetailsOrigin = "calendar" | "year";
type SolarLocationStatus = "loading" | "ready";

const LEGACY_STORAGE_KEY = "genesis-calendar-v1";
const USER_STORAGE_PREFIX = "genesis-calendar-v2:";
const LAST_USER_KEY = "genesis-last-user-v2";

const NAVIGATION: Array<{ id: ViewName; label: string; symbol: string }> = [
  { id: "today", label: "Сегодня", symbol: "☉" },
  { id: "all-tasks", label: "Задачи", symbol: "☰" },
  { id: "projects", label: "Проекты", symbol: "◇" },
  { id: "calendar", label: "Месяц", symbol: "◫" },
  { id: "year", label: "Круг года", symbol: "◎" },
  { id: "stoicheion", label: "Стойхейон", symbol: "ϟ" },
];

const TASK_INBOX_PROJECT_ID = "__genesis_inbox__";
const CREATE_NEW_TASK_LIST_ID = "__create_new_task_list__";
const TASK_LIST_EXPLANATION = "Список задач — это группа смежных задач, которую можно помещать в проекты и/или подпроекты.";

const SOLAR_EVENT_COPY: Record<NonNullable<ReturnType<typeof getSolarEvent>>["id"], { force: string; greekPractice: string }> = {
  "spring-equinox": {
    force: "Сила равновесия света и тьмы помогает выровнять внутренний ритм, обновить намерения и выбрать направление нового цикла.",
    greekPractice: "У древних греков не было единого для всех полисов праздника равноденствия. Солнечные точки отмечали в сезонных календарях-парапегмах для земледелия, мореплавания и общественных дел, а весеннее обновление сопровождали обрядами, дарами богам и общими празднествами.",
  },
  "summer-solstice": {
    force: "Это вершина годового света — время ясности, полноты действия и направления накопленной силы к главной цели.",
    greekPractice: "Летнее солнцестояние служило важной календарной опорой. В Афинах первый лунный месяц после него открывал новый гражданский год; летний праздничный круг включал Панафинеи с процессией, подношениями, музыкой и состязаниями в честь Афины.",
  },
  "autumn-equinox": {
    force: "Сила второго равновесия помогает собрать плоды сделанного, отпустить лишнее и спокойно войти во внутреннюю половину года.",
    greekPractice: "Осенний сезон в греческом мире связывали со сбором урожая и мистериями Деметры и Персефоны. В Аттике совершали процессии, подношения и ночные обряды, осмысляя нисхождение, сохранение зерна и возвращение жизни.",
  },
  "winter-solstice": {
    force: "В самой длинной ночи начинается возвращение света — это сила тишины, сохранения семени и первого шага к возрождению.",
    greekPractice: "Зимнюю часть года древние греки отмечали местными праздниками света, плодородия и Диониса. В Элевсине проходили зимние Галоа в честь Деметры и Диониса, с дарами, общими трапезами и обрядами надежды на будущий рост.",
  },
};

const VIEW_NAMES = new Set<ViewName>(["today", "calendar", "projects", "year", "all-tasks", "stoicheion", "admin"]);

function viewFromHash(): ViewName {
  if (typeof window === "undefined") return "today";
  const candidate = window.location.hash.replace(/^#\/?/, "").split(/[?&]/, 1)[0] as ViewName;
  return VIEW_NAMES.has(candidate) ? candidate : "today";
}

function readStoredState(key: string): StoredState {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return { tasks: [], projects: [], categories: DEFAULT_CATEGORIES, taskLists: [], taskListLinks: [] };
    const parsed = JSON.parse(saved) as Partial<StoredState>;
    const storedTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const storedProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
    return {
      tasks: storedTasks.map((task) => {
        const legacy = task as Partial<Task>;
        const legacyYear = legacy.sacredYear ?? new Date().getFullYear();
        const legacyMonth = legacy.monthIndex ?? 0;
        const legacyDay = legacy.day ?? 1;
        const dueDate = legacy.dueDate || inputDate(getGregorianDate(legacyYear, legacyMonth, legacyDay));
        const recurrenceMode: RecurrenceMode = ["none", "genesis", "classic", "lunar"].includes(legacy.recurrenceMode ?? "")
          ? legacy.recurrenceMode as RecurrenceMode
          : legacy.recurrence && legacy.recurrence !== "none" ? "classic" : "none";
        const recurrencePattern: RecurrencePattern = ["none", "pyata-days", "month-days", "weekdays", "lunar-days"].includes(legacy.recurrencePattern ?? "")
          ? legacy.recurrencePattern as RecurrencePattern
          : recurrenceMode === "classic" ? "weekdays" : recurrenceMode === "lunar" ? "lunar-days" : recurrenceMode === "genesis" ? "pyata-days" : "none";
        return {
          id: legacy.id ?? uid(),
          sacredYear: legacyYear,
          monthIndex: legacyMonth,
          day: legacyDay,
          dueDate,
          endDate: legacy.endDate || dueDate,
          title: legacy.title ?? "Без названия",
          description: legacy.description ?? "",
          time: legacy.time ?? "",
          project: legacy.project ?? "",
          projectId: legacy.projectId ?? null,
          categoryId: legacy.categoryId ?? null,
          tags: legacy.tags ?? [],
          dependsOnIds: legacy.dependsOnIds ?? [],
          priority: legacy.priority ?? 5,
          done: legacy.done ?? false,
          completedAt: legacy.completedAt ?? (legacy.done ? new Date().toISOString() : null),
          reminderMinutes: legacy.reminderMinutes ?? null,
          recurrence: legacy.recurrence ?? "none",
          recurrenceInterval: legacy.recurrenceInterval ?? 1,
          recurrenceMode,
          recurrencePattern,
          recurrenceDays: Array.isArray(legacy.recurrenceDays) ? legacy.recurrenceDays.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 30) : [],
          recurrenceSeriesId: typeof legacy.recurrenceSeriesId === "string" && legacy.recurrenceSeriesId ? legacy.recurrenceSeriesId : null,
          syncToGoogle: legacy.syncToGoogle ?? true,
          createdIn: legacy.createdIn ?? (legacy.googleTaskId
            ? "google-tasks"
            : legacy.id?.startsWith("google-event-")
              ? "google-calendar"
              : "genesis"),
          googleEventId: legacy.googleEventId ?? null,
          googleTaskId: legacy.googleTaskId ?? null,
          googleTaskListId: legacy.googleTaskListId ?? null,
          googleTaskListTitle: legacy.googleTaskListTitle ?? "",
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
      taskLists: Array.isArray(parsed.taskLists) ? parsed.taskLists : [],
      taskListLinks: Array.isArray(parsed.taskListLinks) ? parsed.taskListLinks : [],
    };
  } catch {
    return { tasks: [], projects: [], categories: DEFAULT_CATEGORIES, taskLists: [], taskListLinks: [] };
  }
}

const DEFAULT_CATEGORIES: GenesisCategory[] = [
  { id: "personal", name: "Личное", color: "#a5543f", position: 0 },
  { id: "work", name: "Работа", color: "#2d6c68", position: 1 },
  { id: "health", name: "Тело и здоровье", color: "#b18b48", position: 2 },
];

const APP_BASE = (process.env.NEXT_PUBLIC_GENESIS_BASE_PATH?.trim() || "").replace(/\/$/, "");

function DependencyPicker({ tasks, excludeId, value, onChange, disabled = false }: {
  tasks: Task[];
  excludeId?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks
      .filter((task) => !task.done && task.id !== excludeId)
      .forEach((task) => {
        const key = task.project.trim() || "Без проекта";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, excludeId]);

  const toggle = (taskId: string) => {
    if (disabled) return;
    onChange(value.includes(taskId) ? value.filter((id) => id !== taskId) : [...value, taskId]);
  };

  if (!groups.length) {
    return <p className="dependency-picker-empty">Нет доступных задач</p>;
  }

  return (
    <div className="dependency-picker" role="group" aria-label="Зависит от">
      {groups.map(([project, items]) => (
        <div className="dependency-picker-group" key={project}>
          <span className="dependency-picker-group-title">{project}</span>
          {items.map((task) => (
            <label key={task.id} className="dependency-picker-item">
              <input
                type="checkbox"
                checked={value.includes(task.id)}
                disabled={disabled}
                onChange={() => toggle(task.id)}
              />
              <span>{task.title}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

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

function shiftRangeEndDate(startDate: string, endDate: string, nextStartDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate || startDate}T12:00:00`);
  const nextEnd = new Date(`${nextStartDate}T12:00:00`);
  if ([start, end, nextEnd].some((date) => Number.isNaN(date.getTime()))) return nextStartDate;
  const durationDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  nextEnd.setDate(nextEnd.getDate() + durationDays);
  return inputDate(nextEnd);
}

function buildTaskSeries(task: Task, rawConfig: RecurrenceConfig) {
  const config = normalizeRecurrenceConfig(rawConfig);
  if (!config.enabled) {
    return [{
      ...task,
      recurrence: "none" as const,
      recurrenceInterval: 1,
      recurrenceMode: "none" as const,
      recurrencePattern: "none" as const,
      recurrenceDays: [],
      recurrenceSeriesId: null,
    }];
  }

  const dates = buildRecurrenceDates(task.dueDate, config);
  const seriesId = `series-${uid()}`;
  return dates.map((dueDate, index): Task => {
    const date = new Date(`${dueDate}T12:00:00`);
    const sacred = getSacredDate(date);
    return {
      ...task,
      id: index === 0 ? task.id : uid(),
      sacredYear: sacred.sacredYear,
      monthIndex: sacred.monthIndex,
      day: sacred.day,
      dueDate,
      endDate: shiftRangeEndDate(task.dueDate, task.endDate, dueDate),
      recurrence: "none",
      recurrenceInterval: config.interval,
      recurrenceMode: config.mode,
      recurrencePattern: config.pattern,
      recurrenceDays: [...config.days],
      recurrenceSeriesId: seriesId,
      googleEventId: null,
      googleTaskId: null,
      updatedAt: timestamp() + index,
    };
  });
}

function taskRangeLabel(task: Task) {
  const start = formatGregorian(new Date(`${task.dueDate}T12:00:00`), true);
  const endDate = task.endDate || task.dueDate;
  const end = endDate === task.dueDate
    ? ""
    : ` — ${formatGregorian(new Date(`${endDate}T12:00:00`), true)}`;
  return `${start}${end}${task.time ? ` · ${task.time}` : ""}`;
}

function romanDay(monthIndex: number, day: number) {
  return monthIndex === 12 ? String(day) : ["I", "II", "III", "IIII", "V"][(day - 1) % 5];
}

function monthArtUrl(monthIndex: number) {
  return `${APP_BASE}/month-art-v4/month-${String(monthIndex + 1).padStart(2, "0")}.webp`;
}

function taskOriginMeta(origin: TaskOrigin) {
  if (origin === "google-calendar") return { label: "Создано в Google Calendar", className: "calendar" };
  if (origin === "google-tasks") return { label: "Создано в Google Tasks", className: "tasks" };
  return { label: "Создано в GENESIS", className: "local" };
}

function DeviceClock() {
  const [clock, setClock] = useState<{ now: Date; timezone: string } | null>(null);

  useEffect(() => {
    const update = () => setClock({
      now: new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    update();
    const interval = window.setInterval(update, 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <time className="device-clock" dateTime={clock?.now.toISOString()} aria-label={clock ? `Время устройства: ${clock.now.toLocaleTimeString("ru-RU")}` : "Время устройства синхронизируется"}>
      <strong>{clock ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(clock.now) : "--:--:--"}</strong>
      <small>{clock ? `время устройства · ${clock.timezone}` : "синхронизация времени"}</small>
    </time>
  );
}

export function GenesisCalendar() {
  const initial = useMemo(() => getSacredDate(new Date()), []);
  const [today, setToday] = useState(() => new Date());
  const [view, setView] = useState<ViewName>("today");
  const [sacredYear, setSacredYear] = useState(initial.sacredYear);
  const [monthIndex, setMonthIndex] = useState(initial.monthIndex);
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [dayDetailsOpen, setDayDetailsOpen] = useState(false);
  const [dayDetailsOrigin, setDayDetailsOrigin] = useState<DayDetailsOrigin>("calendar");
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [solarLocationSource, setSolarLocationSource] = useState<AutomaticSolarLocation["source"] | null>(null);
  const [solarLocationStatus, setSolarLocationStatus] = useState<SolarLocationStatus>("loading");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<GenesisProject[]>([]);
  const [categories, setCategories] = useState<GenesisCategory[]>(DEFAULT_CATEGORIES);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [taskListLinks, setTaskListLinks] = useState<TaskListProjectLink[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [authResolved, setAuthResolved] = useState(!isGoogleSyncConfigured);
  const [cloudUser, setCloudUser] = useState<GenesisUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [legalPage] = useState<ReturnType<typeof currentLegalPage>>(() => currentLegalPage());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskEndDate, setTaskEndDate] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskProject, setTaskProject] = useState("");
  const [taskTaskListId, setTaskTaskListId] = useState("");
  const [taskNewListTitle, setTaskNewListTitle] = useState("");
  const [taskTags, setTaskTags] = useState("");
  const [taskReminder, setTaskReminder] = useState("30");
  const [taskRecurrenceConfig, setTaskRecurrenceConfig] = useState<RecurrenceConfig>(DEFAULT_RECURRENCE_CONFIG);
  const [taskDependsOn, setTaskDependsOn] = useState<string[]>([]);
  const [taskPriority, setTaskPriority] = useState("5");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectParent, setNewProjectParent] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState(DEFAULT_CATEGORIES[0].id);
  const [newProjectTags, setNewProjectTags] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [newTaskListTitle, setNewTaskListTitle] = useState("");
  const [newTaskListProject, setNewTaskListProject] = useState("");
  const [newTaskListDrafts, setNewTaskListDrafts] = useState<TaskListDraft[]>([
    { id: "initial-task-list-draft", title: "", dueDate: "" },
  ]);
  const [taskListBatchTitles, setTaskListBatchTitles] = useState<Record<string, string>>({});
  const [taskListBatchDates, setTaskListBatchDates] = useState<Record<string, string>>({});
  const [taskListDropTargetId, setTaskListDropTargetId] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingCategoryTitle, setEditingCategoryTitle] = useState("");
  const [editingCategoryColor, setEditingCategoryColor] = useState("#2d6c68");
  const [tagSearch, setTagSearch] = useState("");
  const [allTasksSearch, setAllTasksSearch] = useState("");
  const [allTasksStatusFilter, setAllTasksStatusFilter] = useState<"all" | "active" | "done">("all");
  const [editingProject, setEditingProject] = useState<GenesisProject | null>(null);
  const [editingProjectTags, setEditingProjectTags] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingTaskTags, setEditingTaskTags] = useState("");
  const [projectDragItem, setProjectDragItem] = useState<ProjectDragItem | null>(null);
  const [projectDropTargetId, setProjectDropTargetId] = useState("");
  const [projectTouchPoint, setProjectTouchPoint] = useState<{ x: number; y: number } | null>(null);
  const [projectMoveAnnouncement, setProjectMoveAnnouncement] = useState("");
  const tasksRef = useRef<Task[]>([]);
  const projectsRef = useRef<GenesisProject[]>([]);
  const categoriesRef = useRef<GenesisCategory[]>(DEFAULT_CATEGORIES);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const projectTouchDragRef = useRef<ProjectTouchDrag | null>(null);
  const projectPointerDragRef = useRef<{
    item: ProjectDragItem;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const suppressProjectItemClickRef = useRef(false);
  const { canInstall, install, isStandalone } = usePwaInstall();

  const deviceTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    const synchronizeSolarLocation = async () => {
      const location = await getAutomaticSolarLocation(deviceTimeZone, controller.signal);
      if (controller.signal.aborted) return;
      setDeviceLocation(location);
      setSolarLocationSource(location.source);
      setSolarLocationStatus("ready");
    };

    void synchronizeSolarLocation();
    return () => controller.abort();
  }, [deviceTimeZone]);

  useEffect(() => () => {
    const drag = projectTouchDragRef.current;
    if (drag) window.clearTimeout(drag.timer);
    document.documentElement.classList.remove("project-drag-active");
  }, []);

  useEffect(() => {
    const updateDeviceDate = () => setToday(new Date());
    const interval = window.setInterval(updateDeviceDate, 60_000);
    window.addEventListener("focus", updateDeviceDate);
    document.addEventListener("visibilitychange", updateDeviceDate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", updateDeviceDate);
      document.removeEventListener("visibilitychange", updateDeviceDate);
    };
  }, []);

  const todayInfo = useMemo(() => getSacredDate(today), [today]);
  const selectedDate = useMemo(
    () => getGregorianDate(sacredYear, monthIndex, selectedDay),
    [sacredYear, monthIndex, selectedDay],
  );
  const todayDateValue = inputDate(today);
  const selectedDateValue = inputDate(selectedDate);
  const newTaskDueDate = taskDueDate || (view === "today" || view === "all-tasks" ? todayDateValue : selectedDateValue);
  const newTaskEndDate = taskEndDate || newTaskDueDate;
  const selectedMonth = MONTHS[monthIndex];
  const selectedSacredDay = getSacredDay(monthIndex, selectedDay);
  const selectedMoon = getMoon(selectedDate);
  const selectedElement = getDayElement(monthIndex, selectedDay);
  const selectedPythagorean = getPythagorean(monthIndex, selectedDay);
  const selectedSolarEvent = getSolarEvent(sacredYear, monthIndex, selectedDay);
  const selectedDayKey = taskDateKey(sacredYear, monthIndex, selectedDay);
  const selectedDayTasks = tasks
    .filter((task) => taskDateKey(task.sacredYear, task.monthIndex, task.day) === selectedDayKey)
    .sort((a, b) => a.time.localeCompare(b.time));
  const selectedSunriseSunset = deviceLocation ? getSunriseSunset(selectedDate, deviceLocation) : null;
  const selectedSunrise = selectedSunriseSunset
    ? formatDeviceSolarTime(selectedSunriseSunset.sunrise, deviceTimeZone)
    : solarLocationStatus === "ready" ? "нет" : "…";
  const selectedSunset = selectedSunriseSunset
    ? formatDeviceSolarTime(selectedSunriseSunset.sunset, deviceTimeZone)
    : solarLocationStatus === "ready" ? "нет" : "…";
  const solarEvents = useMemo(() => getSolarEvents(sacredYear), [sacredYear]);
  const todayKey = taskDateKey(
    todayInfo.sacredYear,
    todayInfo.monthIndex,
    todayInfo.day,
  );
  const linkedProjectId = (taskListId: string | null) => (
    taskListId ? taskListLinks.find((link) => link.taskListId === taskListId)?.projectId ?? null : null
  );
  const resolvedTaskProjectId = (task: Task) => (
    task.projectId === TASK_INBOX_PROJECT_ID ? null : task.projectId ?? linkedProjectId(task.googleTaskListId)
  );
  const resolvedTaskProject = (task: Task) => {
    const projectId = resolvedTaskProjectId(task);
    return projects.find((project) => project.id === projectId) ?? null;
  };
  const resolvedTaskProjectTitle = (task: Task) => resolvedTaskProject(task)?.title ?? task.project;

  const navigateTo = (nextView: ViewName, replace = false) => {
    setAccountMenuOpen(false);
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
      setAccountMenuOpen(false);
      setAccountOpen(false);
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
    if (!dayDetailsOpen) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDayDetailsOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [dayDetailsOpen]);

  useEffect(() => {
    const initialState = isGoogleSyncConfigured
      ? { tasks: [], projects: [], categories: DEFAULT_CATEGORIES, taskLists: [], taskListLinks: [] }
      : readStoredState(LEGACY_STORAGE_KEY);

    const timer = window.setTimeout(() => {
      tasksRef.current = initialState.tasks;
      projectsRef.current = initialState.projects;
      categoriesRef.current = initialState.categories;
      setTasks(initialState.tasks);
      setProjects(initialState.projects);
      setCategories(initialState.categories);
      setTaskLists(initialState.taskLists);
      setTaskListLinks(initialState.taskListLinks);
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
    localStorage.setItem(key, JSON.stringify({ tasks, projects, categories, taskLists, taskListLinks }));
  }, [hydrated, cloudUser, tasks, projects, categories, taskLists, taskListLinks]);

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
      setTaskLists(local.taskLists);
      setTaskListLinks(local.taskListLinks);
      setNewProjectCategory(local.categories[0]?.id ?? "");

      setSyncStatus("syncing");
      void mergeLocalWorkspace(user.uid, {
        tasks: local.tasks,
        projects: local.projects,
        categories: local.categories,
        taskListLinks: local.taskListLinks,
      })
        .then(async () => {
          if (!active) return;
          const workspace = await loadGenesisWorkspace();
          if (!active) return;
          const nextProjects = workspace.hasRemoteStructure ? workspace.projects : local.projects;
          const nextCategories = workspace.hasRemoteStructure ? workspace.categories : local.categories;
          const nextTaskListLinks = workspace.hasRemoteStructure ? workspace.taskListLinks : local.taskListLinks;
          const nextTasksById = new Map(workspace.tasks.map((task) => [task.id, task]));
          local.tasks.forEach((task) => {
            const remoteTask = nextTasksById.get(task.id);
            if (!remoteTask || (!task.googleTaskId && task.updatedAt > remoteTask.updatedAt)) {
              nextTasksById.set(task.id, task);
            }
          });
          const nextTasks = Array.from(nextTasksById.values());
          tasksRef.current = nextTasks;
          projectsRef.current = nextProjects;
          categoriesRef.current = nextCategories;
          setTasks(nextTasks);
          setProjects(nextProjects);
          setCategories(nextCategories);
          setTaskLists(workspace.taskLists);
          setTaskListLinks(nextTaskListLinks);
          setNewProjectCategory(nextCategories[0]?.id ?? "");
          setSyncError(workspace.syncWarning ?? "");
          setSyncStatus(workspace.syncWarning ? "offline" : "synced");
          stopTasks = observeCloudTasks(
            user.uid,
            (cloudTasks, cloudTaskLists, fromCache, warning) => {
              if (!active) return;
              tasksRef.current = cloudTasks;
              setTasks(cloudTasks);
              setTaskLists(cloudTaskLists);
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
          setTaskLists(local.taskLists);
          setTaskListLinks(local.taskListLinks);
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

  const saveTaskSeries = (series: Task[]) => {
    if (!cloudUser || !series.length) return;
    setSyncStatus("syncing");
    void (async () => {
      const savedTasks: Task[] = [];
      const batchSize = 8;
      for (let index = 0; index < series.length; index += batchSize) {
        const batch = series.slice(index, index + batchSize);
        savedTasks.push(...await Promise.all(batch.map((task) => saveCloudTask(cloudUser.uid, task))));
      }
      const savedById = new Map(savedTasks.map((task) => [task.id, task]));
      setTasks((current) => current.map((task) => savedById.has(task.id) ? { ...task, ...savedById.get(task.id)! } : task));
      setSyncStatus("synced");
    })().catch((error: Error) => {
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

  const taskForList = (title: string, dueDateValue: string, taskList: GoogleTaskList, projectId = ""): Task => {
    const dueDate = new Date(`${dueDateValue}T12:00:00`);
    const sacred = getSacredDate(dueDate);
    const selectedProject = projects.find((project) => project.id === projectId);
    return {
      id: uid(),
      sacredYear: sacred.sacredYear,
      monthIndex: sacred.monthIndex,
      day: sacred.day,
      dueDate: dueDateValue,
      endDate: dueDateValue,
      title: title.trim(),
      description: "",
      time: "",
      project: selectedProject?.title ?? "",
      projectId: selectedProject?.id ?? null,
      categoryId: selectedProject?.categoryId ?? null,
      tags: [],
      dependsOnIds: [],
      priority: 5,
      done: false,
      completedAt: null,
      reminderMinutes: null,
      recurrence: "none",
      recurrenceInterval: 1,
      recurrenceMode: "none",
      recurrencePattern: "none",
      recurrenceDays: [],
      recurrenceSeriesId: null,
      syncToGoogle: true,
      createdIn: "genesis",
      googleEventId: null,
      googleTaskId: null,
      googleTaskListId: taskList.id,
      googleTaskListTitle: taskList.title,
      googleReadOnly: false,
      updatedAt: timestamp(),
    };
  };

  const appendTasksToList = (titles: string[], dueDateValue: string, taskList: GoogleTaskList, projectId = "") => {
    const nextTasks = titles
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => taskForList(title, dueDateValue, taskList, projectId));
    if (!nextTasks.length) return;
    setTasks((current) => [...current, ...nextTasks]);
    nextTasks.forEach(saveTask);
  };

  const addTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    if (newTaskDueDate < todayDateValue) {
      setSyncError("Срок новой задачи не может быть в прошлом.");
      setSyncStatus("error");
      return;
    }
    if (newTaskEndDate < newTaskDueDate) {
      setSyncError("Срок выполнения не может быть раньше даты начала.");
      setSyncStatus("error");
      return;
    }

    const dueDate = new Date(`${newTaskDueDate}T12:00:00`);
    if (Number.isNaN(dueDate.getTime())) return;
    const sacred = getSacredDate(dueDate);

    const tags = taskTags
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 6);
    const selectedProject = projects.find((item) => item.id === taskProject);
    let selectedTaskList = taskLists.find((item) => item.id === taskTaskListId);
    if (taskTaskListId === CREATE_NEW_TASK_LIST_ID) {
      const listTitle = taskNewListTitle.trim();
      if (!cloudUser || !listTitle) {
        setSyncError("Укажите название нового списка задач.");
        setSyncStatus("error");
        return;
      }
      setSyncStatus("syncing");
      try {
        const result = await createGoogleTaskList(listTitle);
        selectedTaskList = result.taskList;
        setTaskLists((current) => [...current.filter((item) => item.id !== result.taskList.id), result.taskList]);
        const nextLinks = [
          ...taskListLinks.filter((link) => link.taskListId !== result.taskList.id),
          { taskListId: result.taskList.id, projectId: selectedProject?.id ?? null },
        ];
        setTaskListLinks(nextLinks);
        persistStructure(projects, categories, nextLinks);
        setTaskTaskListId(result.taskList.id);
        setTaskNewListTitle("");
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Не удалось создать список Google Tasks");
        setSyncStatus(navigator.onLine ? "error" : "offline");
        return;
      }
    }

    const task: Task = {
      id: uid(),
      sacredYear: sacred.sacredYear,
      monthIndex: sacred.monthIndex,
      day: sacred.day,
      dueDate: newTaskDueDate,
      endDate: newTaskEndDate,
      title,
      description: taskDescription.trim(),
      time: taskTime,
      project: selectedProject?.title ?? "",
      projectId: selectedProject?.id ?? null,
      categoryId: selectedProject?.categoryId ?? null,
      tags,
      dependsOnIds: taskDependsOn,
      priority: Math.min(10, Math.max(1, Number(taskPriority) || 5)),
      done: false,
      completedAt: null,
      reminderMinutes: taskReminder ? Number(taskReminder) : null,
      recurrence: "none",
      recurrenceInterval: taskRecurrenceConfig.enabled ? taskRecurrenceConfig.interval : 1,
      recurrenceMode: taskRecurrenceConfig.enabled ? taskRecurrenceConfig.mode : "none",
      recurrencePattern: taskRecurrenceConfig.enabled ? taskRecurrenceConfig.pattern : "none",
      recurrenceDays: taskRecurrenceConfig.enabled ? [...taskRecurrenceConfig.days] : [],
      recurrenceSeriesId: null,
      syncToGoogle: true,
      createdIn: "genesis",
      googleEventId: null,
      googleTaskId: null,
      googleTaskListId: selectedTaskList?.id ?? null,
      googleTaskListTitle: selectedTaskList?.title ?? "",
      googleReadOnly: false,
      updatedAt: timestamp(),
    };

    const taskSeries = buildTaskSeries(task, taskRecurrenceConfig);
    setTasks((current) => [...current, ...taskSeries]);
    if (taskSeries.length === 1) saveTask(taskSeries[0]);
    else saveTaskSeries(taskSeries);

    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
    setTaskEndDate("");
    setTaskTime("");
    setTaskTags("");
    setTaskDependsOn([]);
    setTaskPriority("5");
    setTaskRecurrenceConfig(DEFAULT_RECURRENCE_CONFIG);
  };

  const openTaskEditor = (task: Task) => {
    setEditingTask({ ...task, tags: [...task.tags], dependsOnIds: [...task.dependsOnIds] });
    setEditingTaskTags(task.tags.join(", "));
  };

  const persistTaskChange = (original: Task, nextTask: Task) => {
    setTasks((current) => current.map((task) => task.id === nextTask.id ? nextTask : task));
    const destinationChanged = original.googleTaskListId !== nextTask.googleTaskListId;
    const hasRemoteSource = Boolean(original.googleTaskId || original.googleEventId);
    if (!cloudUser || !destinationChanged || !hasRemoteSource) {
      saveTask(nextTask);
      return;
    }

    const recreatedTask: Task = {
      ...nextTask,
      googleEventId: null,
      googleTaskId: null,
      updatedAt: timestamp(),
    };
    setSyncStatus("syncing");
    void removeCloudTask(cloudUser.uid, original)
      .then(() => saveCloudTask(cloudUser.uid, recreatedTask))
      .then((saved) => {
        setTasks((current) => current.map((task) => task.id === saved.id ? { ...task, ...saved } : task));
        setSyncStatus("synced");
      })
      .catch((error: Error) => {
        setSyncError(error.message);
        setSyncStatus(navigator.onLine ? "error" : "offline");
      });
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
    if ((editingTask.endDate || editingTask.dueDate) < editingTask.dueDate) {
      setSyncError("Срок выполнения не может быть раньше даты начала.");
      setSyncStatus("error");
      return;
    }
    const dueDate = new Date(`${editingTask.dueDate}T12:00:00`);
    if (Number.isNaN(dueDate.getTime())) return;
    const sacred = getSacredDate(dueDate);
    const selectedProject = projects.find((project) => project.id === editingTask.projectId);
    const selectedTaskList = taskLists.find((taskList) => taskList.id === editingTask.googleTaskListId);
    const keepInInbox = editingTask.projectId === TASK_INBOX_PROJECT_ID;
    const nextTask: Task = {
      ...editingTask,
      title,
      description: editingTask.description.trim(),
      sacredYear: sacred.sacredYear,
      monthIndex: sacred.monthIndex,
      day: sacred.day,
      project: selectedProject?.title ?? "",
      projectId: keepInInbox ? TASK_INBOX_PROJECT_ID : selectedProject?.id ?? null,
      categoryId: selectedProject?.categoryId ?? null,
      tags: editingTaskTags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10),
      googleTaskListId: selectedTaskList?.id ?? null,
      googleTaskListTitle: selectedTaskList?.title ?? "",
      updatedAt: timestamp(),
    };
    persistTaskChange(original, nextTask);
    setEditingTask(null);
  };

  const moveTaskToTaskList = (task: Task, taskListId: string) => {
    if (task.googleTaskListId === taskListId) return;
    const taskList = taskLists.find((item) => item.id === taskListId);
    if (!taskList) return;
    const nextTask: Task = {
      ...task,
      time: "",
      reminderMinutes: null,
      recurrence: "none",
      recurrenceInterval: 1,
      recurrenceMode: "none",
      recurrencePattern: "none",
      recurrenceDays: [],
      recurrenceSeriesId: null,
      googleTaskListId: taskList.id,
      googleTaskListTitle: taskList.title,
      updatedAt: timestamp(),
    };
    persistTaskChange(task, nextTask);
    setProjectMoveAnnouncement(`Задача «${task.title}» перемещена в список «${taskList.title}».`);
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
            endDate: shiftRangeEndDate(currentTask.dueDate, currentTask.endDate, nextDateValue),
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

  const persistStructure = (
    nextProjects: GenesisProject[],
    nextCategories: GenesisCategory[],
    nextTaskListLinks: TaskListProjectLink[] = taskListLinks,
  ) => {
    if (!cloudUser) return;
    setSyncStatus("syncing");
    void saveWorkspaceStructure(nextProjects, nextCategories, nextTaskListLinks, metricsFor(tasks, nextProjects))
      .then(() => setSyncStatus("synced"))
      .catch((error: Error) => {
        setSyncError(error.message);
        setSyncStatus(navigator.onLine ? "error" : "offline");
      });
  };

  const addGoogleTaskList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTaskListTitle.trim();
    if (!title || !cloudUser) return;
    setSyncStatus("syncing");
    try {
      const { taskList } = await createGoogleTaskList(title);
      setTaskLists((current) => [...current.filter((item) => item.id !== taskList.id), taskList]);
      const nextLinks = [
        ...taskListLinks.filter((link) => link.taskListId !== taskList.id),
        { taskListId: taskList.id, projectId: newTaskListProject || null },
      ];
      setTaskListLinks(nextLinks);
      persistStructure(projects, categories, nextLinks);
      const draftedTasks = newTaskListDrafts
        .filter((draft) => draft.title.trim())
        .map((draft) => taskForList(draft.title, draft.dueDate || todayDateValue, taskList, newTaskListProject));
      if (draftedTasks.length) {
        setTasks((current) => [...current, ...draftedTasks]);
        draftedTasks.forEach(saveTask);
      }
      setNewTaskListTitle("");
      setNewTaskListDrafts([{ id: uid(), title: "", dueDate: "" }]);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось создать список Google Tasks");
      setSyncStatus(navigator.onLine ? "error" : "offline");
    }
  };

  const addTasksToExistingList = (event: FormEvent<HTMLFormElement>, taskList: GoogleTaskList) => {
    event.preventDefault();
    const titles = (taskListBatchTitles[taskList.id] ?? "").split(/\r?\n/);
    const projectId = taskListLinks.find((link) => link.taskListId === taskList.id)?.projectId ?? "";
    appendTasksToList(titles, taskListBatchDates[taskList.id] || todayDateValue, taskList, projectId ?? "");
    setTaskListBatchTitles((current) => ({ ...current, [taskList.id]: "" }));
  };

  const updateNewTaskListDraft = (id: string, patch: Partial<Omit<TaskListDraft, "id">>) => {
    setNewTaskListDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));
  };

  const linkTaskListToProject = (taskListId: string, projectId: string) => {
    const nextLinks = [
      ...taskListLinks.filter((link) => link.taskListId !== taskListId),
      { taskListId, projectId: projectId || null },
    ];
    setTaskListLinks(nextLinks);
    persistStructure(projects, categories, nextLinks);
  };

  const projectDropTargetAt = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-project-drop-id]");
    return element?.dataset.projectDropId ?? "";
  };

  const resetProjectDrag = () => {
    document.documentElement.classList.remove("project-drag-active");
    setProjectDragItem(null);
    setProjectTouchPoint(null);
    setProjectDropTargetId("");
  };

  const moveProjectItemToProject = (item: ProjectDragItem, projectId: string) => {
    const moveToInbox = projectId === TASK_INBOX_PROJECT_ID;
    const project = moveToInbox ? null : projects.find((candidate) => candidate.id === projectId);
    if (!moveToInbox && !project) return;

    if (item.kind === "task") {
      const task = tasks.find((candidate) => candidate.id === item.id);
      if (!task || (moveToInbox ? task.projectId === TASK_INBOX_PROJECT_ID : resolvedTaskProjectId(task) === project?.id)) return;
      const nextTask: Task = {
        ...task,
        project: project?.title ?? "",
        projectId: project?.id ?? TASK_INBOX_PROJECT_ID,
        categoryId: project?.categoryId ?? null,
        updatedAt: timestamp(),
      };
      setTasks((current) => current.map((candidate) => candidate.id === nextTask.id ? nextTask : candidate));
      saveTask(nextTask);
      setProjectMoveAnnouncement(moveToInbox
        ? `Задача «${item.title}» возвращена в хаос-бокс.`
        : `Задача «${item.title}» перемещена в проект «${project?.title}».`);
      return;
    }

    const currentProjectId = taskListLinks.find((link) => link.taskListId === item.id)?.projectId ?? null;
    if (currentProjectId === (project?.id ?? null)) return;
    linkTaskListToProject(item.id, project?.id ?? "");
    setProjectMoveAnnouncement(moveToInbox
      ? `Список «${item.title}» возвращён в хаос-бокс.`
      : `Список «${item.title}» перемещён в проект «${project?.title}».`);
  };

  const beginProjectPointerDrag = (event: PointerEvent<HTMLElement>, item: ProjectDragItem) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    projectPointerDragRef.current = {
      item,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  };

  const moveProjectPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = projectPointerDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
      drag.active = true;
      document.documentElement.classList.add("project-drag-active");
      setProjectDragItem(drag.item);
    }
    if (!drag.active) return;
    event.preventDefault();
    setProjectTouchPoint({ x: event.clientX, y: event.clientY });
    setProjectDropTargetId(projectDropTargetAt(event.clientX, event.clientY));
  };

  const finishProjectPointerDrag = (event: PointerEvent<HTMLElement>, cancelled = false) => {
    const drag = projectPointerDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    projectPointerDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.active) return;
    event.preventDefault();
    const projectId = cancelled ? "" : projectDropTargetAt(event.clientX, event.clientY);
    if (projectId) moveProjectItemToProject(drag.item, projectId);
    suppressProjectItemClickRef.current = true;
    window.setTimeout(() => {
      suppressProjectItemClickRef.current = false;
    }, 350);
    resetProjectDrag();
  };

  const beginProjectTouchDrag = (event: TouchEvent<HTMLElement>, item: ProjectDragItem) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const previous = projectTouchDragRef.current;
    if (previous) window.clearTimeout(previous.timer);
    const drag = {
      item,
      startX: touch.clientX,
      startY: touch.clientY,
      active: false,
      timer: 0,
    };
    drag.timer = window.setTimeout(() => {
      if (projectTouchDragRef.current !== drag) return;
      drag.active = true;
      document.documentElement.classList.add("project-drag-active");
      setProjectDragItem(drag.item);
      setProjectTouchPoint({ x: drag.startX, y: drag.startY });
      setProjectDropTargetId(projectDropTargetAt(drag.startX, drag.startY));
    }, 180);
    projectTouchDragRef.current = drag;
  };

  const moveProjectTouchDrag = (event: TouchEvent<HTMLElement>) => {
    const drag = projectTouchDragRef.current;
    const touch = event.touches[0];
    if (!drag || !touch) return;
    if (!drag.active && Math.hypot(touch.clientX - drag.startX, touch.clientY - drag.startY) > 6) {
      window.clearTimeout(drag.timer);
      drag.active = true;
      document.documentElement.classList.add("project-drag-active");
      setProjectDragItem(drag.item);
    }
    if (!drag.active) return;
    event.preventDefault();
    if (touch.clientY < 88) window.scrollBy({ top: -16, behavior: "auto" });
    if (touch.clientY > window.innerHeight - 88) window.scrollBy({ top: 16, behavior: "auto" });
    setProjectTouchPoint({ x: touch.clientX, y: touch.clientY });
    setProjectDropTargetId(projectDropTargetAt(touch.clientX, touch.clientY));
  };

  const finishProjectTouchDrag = (event: TouchEvent<HTMLElement>, cancelled = false) => {
    const drag = projectTouchDragRef.current;
    if (!drag) return;
    window.clearTimeout(drag.timer);
    projectTouchDragRef.current = null;
    if (!drag.active) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    const projectId = cancelled || !touch ? "" : projectDropTargetAt(touch.clientX, touch.clientY);
    if (projectId) moveProjectItemToProject(drag.item, projectId);
    suppressProjectItemClickRef.current = true;
    window.setTimeout(() => {
      suppressProjectItemClickRef.current = false;
    }, 350);
    resetProjectDrag();
  };

  const projectDragProps = (item: ProjectDragItem) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => beginProjectPointerDrag(event, item),
    onPointerMove: moveProjectPointerDrag,
    onPointerUp: (event: PointerEvent<HTMLElement>) => finishProjectPointerDrag(event),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => finishProjectPointerDrag(event, true),
    onTouchStart: (event: TouchEvent<HTMLElement>) => beginProjectTouchDrag(event, item),
    onTouchMove: moveProjectTouchDrag,
    onTouchEnd: (event: TouchEvent<HTMLElement>) => finishProjectTouchDrag(event),
    onTouchCancel: (event: TouchEvent<HTMLElement>) => finishProjectTouchDrag(event, true),
  });

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
    const nextTaskListLinks = taskListLinks.map((link) => (
      link.projectId && removed.has(link.projectId) ? { ...link, projectId: null } : link
    ));
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
    setTaskProject((current) => removed.has(current) ? "" : current);
    setNewTaskListProject((current) => removed.has(current) ? "" : current);
    setTaskListLinks(nextTaskListLinks);
    persistStructure(nextProjects, categories, nextTaskListLinks);
  };

  const exportCalendar = () => {
    if (!tasks.length) return;
    const events = tasks.map((task) => {
      const startDate = new Date(`${task.dueDate}T12:00:00`);
      const rangeEndDate = new Date(`${task.endDate || task.dueDate}T12:00:00`);
      const timed = Boolean(task.time);
      const start = timed
        ? `DTSTART:${icsDate(startDate, task.time)}`
        : `DTSTART;VALUE=DATE:${task.dueDate.replaceAll("-", "")}`;
      let end: string;
      if (timed) {
        const [hours = 0, minutes = 0] = task.time.split(":").map(Number);
        startDate.setHours(hours, minutes, 0, 0);
        rangeEndDate.setHours(hours, minutes, 0, 0);
        if (rangeEndDate <= startDate) rangeEndDate.setHours(rangeEndDate.getHours() + 1);
        const endTime = `${String(rangeEndDate.getHours()).padStart(2, "0")}:${String(rangeEndDate.getMinutes()).padStart(2, "0")}`;
        end = `DTEND:${icsDate(rangeEndDate, endTime)}`;
      } else {
        rangeEndDate.setDate(rangeEndDate.getDate() + 1);
        end = `DTEND;VALUE=DATE:${inputDate(rangeEndDate).replaceAll("-", "")}`;
      }
      return [
        "BEGIN:VEVENT",
        `UID:${task.id}@genesis-calendar`,
        start,
        end,
        `SUMMARY:${escapeIcs(task.title)}`,
        `DESCRIPTION:${escapeIcs([resolvedTaskProjectTitle(task), ...task.tags.map((tag) => `#${tag}`)].filter(Boolean).join(" · "))}`,
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
    setDayDetailsOrigin("calendar");
    setDayDetailsOpen(true);
    navigateTo("calendar");
  };

  const renderTaskListCreateForm = (context: "today" | "all-tasks" | "projects") => (
    <div className="task-list-create-block">
      <p>{TASK_LIST_EXPLANATION}</p>
      {cloudUser?.googleTasksImportReady ? (
        <>
          {taskLists.length ? (
            <section className="task-list-workspace" aria-label="Существующие списки задач">
              <header>
                <div>
                  <span className="eyebrow">Рабочий стол</span>
                  <h3>Существующие списки</h3>
                </div>
                <small>Перетаскивайте задачи между колонками или выбирайте список в меню задачи.</small>
              </header>
              <div className="task-list-board">
                {taskLists.map((taskList) => {
                  const projectId = taskListLinks.find((link) => link.taskListId === taskList.id)?.projectId ?? "";
                  const listTasks = tasks.filter((task) => task.googleTaskListId === taskList.id);
                  return (
                    <section
                      className={`task-list-column${taskListDropTargetId === taskList.id ? " drop-target" : ""}`}
                      key={taskList.id}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setTaskListDropTargetId(taskList.id);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTaskListDropTargetId("");
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const taskId = event.dataTransfer.getData("text/genesis-task-id");
                        const task = tasks.find((item) => item.id === taskId);
                        if (task) moveTaskToTaskList(task, taskList.id);
                        setTaskListDropTargetId("");
                      }}
                    >
                      <header>
                        <div><strong>{taskList.title}</strong><small>{listTasks.length} задач</small></div>
                        <label>
                          <span>Проект списка</span>
                          <select value={projectId} onChange={(event) => linkTaskListToProject(taskList.id, event.target.value)}>
                            <option value="">Без проекта</option>
                            {flattenProjects(projects).map(({ project, depth }) => (
                              <option value={project.id} key={project.id}>{"— ".repeat(depth)}{project.title}</option>
                            ))}
                          </select>
                        </label>
                      </header>
                      <div className="task-list-column-items">
                        {listTasks.map((task) => (
                          <article
                            className={task.done ? "done" : ""}
                            key={task.id}
                          >
                            <button
                              type="button"
                              className="task-list-board-drag"
                              draggable
                              aria-label={`Перетащить задачу «${task.title}» в другой список`}
                              onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/genesis-task-id", task.id);
                              }}
                              onDragEnd={() => setTaskListDropTargetId("")}
                            >⋮⋮</button>
                            <button type="button" className="task-check" onClick={() => toggleTask(task.id)} aria-label={task.done ? `Вернуть задачу «${task.title}»` : `Завершить задачу «${task.title}»`}>{task.done ? "✓" : ""}</button>
                            <button type="button" className="task-list-item-open" onClick={() => openTaskEditor(task)}>
                              <strong>{task.title}</strong>
                              <small>{taskRangeLabel(task)}</small>
                            </button>
                            <label className="task-list-move-select">
                              <span className="sr-only">Переместить задачу «{task.title}»</span>
                              <select value={task.googleTaskListId ?? ""} onChange={(event) => moveTaskToTaskList(task, event.target.value)} aria-label={`Список для задачи «${task.title}»`}>
                                {taskLists.map((destination) => <option value={destination.id} key={destination.id}>{destination.title}</option>)}
                              </select>
                            </label>
                            <button type="button" className="task-list-item-delete" onClick={() => deleteTask(task.id)} aria-label={`Удалить задачу «${task.title}»`}>×</button>
                          </article>
                        ))}
                        {!listTasks.length ? <p>Перетащите сюда задачу или добавьте несколько ниже.</p> : null}
                      </div>
                      <form className="task-list-batch-form" onSubmit={(event) => addTasksToExistingList(event, taskList)}>
                        <label htmlFor={`${context}-${taskList.id}-batch-tasks`}>Несколько новых задач</label>
                        <textarea
                          id={`${context}-${taskList.id}-batch-tasks`}
                          rows={3}
                          value={taskListBatchTitles[taskList.id] ?? ""}
                          onChange={(event) => setTaskListBatchTitles((current) => ({ ...current, [taskList.id]: event.target.value }))}
                          placeholder={"Каждая задача с новой строки\nНапример: собрать материалы"}
                        />
                        <div>
                          <input
                            type="date"
                            min={todayDateValue}
                            value={taskListBatchDates[taskList.id] || todayDateValue}
                            onChange={(event) => setTaskListBatchDates((current) => ({ ...current, [taskList.id]: event.target.value }))}
                            aria-label={`Срок новых задач в списке «${taskList.title}»`}
                          />
                          <button type="submit" className="primary-button" disabled={!taskListBatchTitles[taskList.id]?.trim()}>Добавить все</button>
                        </div>
                      </form>
                    </section>
                  );
                })}
              </div>
            </section>
          ) : null}
          <form className="task-list-new-form" onSubmit={addGoogleTaskList} aria-label="Создание списка задач">
            <label htmlFor={`${context}-new-task-list-title`}>Название списка</label>
            <input
              id={`${context}-new-task-list-title`}
              value={newTaskListTitle}
              onChange={(event) => setNewTaskListTitle(event.target.value)}
              placeholder="Например, подготовка запуска"
            />
            <label htmlFor={`${context}-new-task-list-project`}>Проект или подпроект</label>
            <select id={`${context}-new-task-list-project`} value={newTaskListProject} onChange={(event) => setNewTaskListProject(event.target.value)}>
              <option value="">Без проекта — в хаос-бокс</option>
              {flattenProjects(projects).map(({ project, depth }) => (
                <option value={project.id} key={project.id}>{"— ".repeat(depth)}{project.title}</option>
              ))}
            </select>
            <fieldset className="task-list-drafts">
              <legend>Задачи внутри нового списка</legend>
              <p>Можно создать пустой список или сразу подготовить несколько задач.</p>
              {newTaskListDrafts.map((draft, index) => (
                <div className="task-list-draft-row" key={draft.id}>
                  <input value={draft.title} onChange={(event) => updateNewTaskListDraft(draft.id, { title: event.target.value })} placeholder={`Задача ${index + 1}`} aria-label={`Название задачи ${index + 1}`} />
                  <input type="date" min={todayDateValue} value={draft.dueDate || todayDateValue} onChange={(event) => updateNewTaskListDraft(draft.id, { dueDate: event.target.value })} aria-label={`Срок задачи ${index + 1}`} />
                  <button type="button" onClick={() => setNewTaskListDrafts((current) => current.length === 1 ? [{ ...current[0], title: "", dueDate: "" }] : current.filter((item) => item.id !== draft.id))} aria-label={`Удалить задачу ${index + 1}`}>×</button>
                </div>
              ))}
              <button type="button" className="text-button task-list-add-draft" onClick={() => setNewTaskListDrafts((current) => [...current, { id: uid(), title: "", dueDate: "" }])}>＋ Ещё задача</button>
            </fieldset>
            <button type="submit" className="primary-button" disabled={!newTaskListTitle.trim()}>Создать список</button>
          </form>
        </>
      ) : (
        <button type="button" className="primary-button" onClick={() => void handleGoogleSignIn()}>Подключить Google Tasks</button>
      )}
    </div>
  );

  const renderTaskCreateForm = (context: "today" | "all-tasks") => {
    const selectedTaskList = taskLists.find((taskList) => taskList.id === taskTaskListId);
    const createsTaskList = taskTaskListId === CREATE_NEW_TASK_LIST_ID;
    const dueDateIsPast = newTaskDueDate < todayDateValue;
    const rangeIsInvalid = newTaskEndDate < newTaskDueDate;
    return (
      <form className="task-form" onSubmit={addTask} aria-label="Создание задачи">
        {dueDateIsPast ? (
          <p className="past-date-notice" role="status">Выберите сегодняшний или будущий срок для новой задачи.</p>
        ) : null}
        <label>
          <span>Новая задача</span>
          <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Что важно совершить?" />
        </label>
        <label>
          <span>Дополнительная информация</span>
          <textarea rows={3} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Подробности, ожидаемый результат и заметки" />
        </label>
        <div className="task-form-section task-form-schedule" aria-label="Сроки задачи">
          <label>
            <span>Начало</span>
            <input type="date" min={todayDateValue} value={newTaskDueDate} onChange={(event) => {
              const nextDate = event.target.value;
              setTaskDueDate(nextDate);
              setTaskEndDate((current) => !current || current < nextDate ? nextDate : current);
            }} required />
          </label>
          <label>
            <span>Срок выполнения</span>
            <input type="date" min={newTaskDueDate} value={newTaskEndDate} onChange={(event) => setTaskEndDate(event.target.value)} required />
          </label>
          <label htmlFor={`${context}-new-task-time-hour`}>
            <span>Время</span>
            <TimeClockPicker id={`${context}-new-task-time-hour`} value={taskTime} disabled={Boolean(taskTaskListId)} onChange={setTaskTime} />
          </label>
        </div>
        <div className="task-form-section task-form-destination" aria-label="Контекст задачи">
          <label>
            <span>Проект или подпроект</span>
            <select value={taskProject} onChange={(event) => setTaskProject(event.target.value)}>
              <option value="">Без проекта</option>
              {flattenProjects(projects).filter(({ project }) => project.status === "active").map(({ project, depth }) => (
                <option value={project.id} key={project.id}>{"— ".repeat(depth)}{project.title}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Куда добавить задачу</span>
            <select value={taskTaskListId} onChange={(event) => {
              const nextTaskListId = event.target.value;
              setTaskTaskListId(nextTaskListId);
              if (nextTaskListId !== CREATE_NEW_TASK_LIST_ID) setTaskNewListTitle("");
              if (nextTaskListId) {
                setTaskTime("");
                setTaskReminder("");
                setTaskRecurrenceConfig(DEFAULT_RECURRENCE_CONFIG);
              }
            }}>
              <option value="">Google Calendar</option>
              {taskLists.map((taskList) => <option value={taskList.id} key={taskList.id}>Google Tasks · {taskList.title}</option>)}
              <option value={CREATE_NEW_TASK_LIST_ID}>＋ Начать новый список задач</option>
            </select>
          </label>
        </div>
        {createsTaskList ? (
          <label className="task-form-new-list">
            <span>Название нового списка</span>
            <input value={taskNewListTitle} onChange={(event) => setTaskNewListTitle(event.target.value)} placeholder="Например, подготовка события" required />
          </label>
        ) : null}
        <RecurrenceBuilder
          value={taskRecurrenceConfig}
          onChange={setTaskRecurrenceConfig}
          startDate={newTaskDueDate}
          disabled={Boolean(taskTaskListId)}
        />
        <div className="task-form-section task-form-settings" aria-label="Настройки задачи">
          <label>
            <span>Напомнить</span>
            <select value={taskReminder} onChange={(event) => setTaskReminder(event.target.value)} disabled={Boolean(taskTaskListId)}>
              <option value="">Без напоминания</option>
              <option value="10">За 10 минут</option>
              <option value="30">За 30 минут</option>
              <option value="60">За 1 час</option>
              <option value="1440">За 1 день</option>
            </select>
          </label>
          <label>
            <span>Приоритет</span>
            <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Теги</span>
            <input value={taskTags} onChange={(event) => setTaskTags(event.target.value)} placeholder="ритуал, работа, дом" />
          </label>
        </div>
        {tasks.length ? (
          <div className="task-form-field task-form-row-full">
            <span>Зависит от</span>
            <DependencyPicker tasks={tasks} value={taskDependsOn} onChange={setTaskDependsOn} />
          </div>
        ) : null}
        <div className="sync-checkbox sync-always-on">
          <span aria-hidden="true">✓</span>
          <span>{createsTaskList
            ? `Сначала будет создан список «${taskNewListTitle.trim() || "без названия"}», затем задача появится внутри него`
            : selectedTaskList
            ? `Срок завершения попадёт в список «${selectedTaskList.title}» Google Tasks, начало сохранится в данных GENESIS`
            : taskRecurrenceConfig.enabled
            ? `${taskRecurrenceConfig.mode === "classic" ? "Классическая недельная серия" : taskRecurrenceConfig.mode === "lunar" ? "Лунная серия" : "Серия GENESIS"} будет рассчитана до конца сакрального года и синхронизирована с Google Calendar`
            : "Задача будет синхронизирована с Google Calendar в часовом поясе этого устройства"}</span>
        </div>
        <button type="submit" className="add-task-button" disabled={!taskTitle.trim() || !newTaskDueDate || !newTaskEndDate || dueDateIsPast || rangeIsInvalid || (createsTaskList && !taskNewListTitle.trim())}>
          <span aria-hidden="true">＋</span> Добавить задачу
        </button>
      </form>
    );
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
    const solarCopy = solarEvent ? SOLAR_EVENT_COPY[solarEvent.id] : null;
    const isNewMoonDay = moon.event.toLocaleLowerCase("ru-RU").includes("новолуние");

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
              <DeviceClock />
            </div>
          </div>
          <div className="hero-number" aria-hidden="true">
            <span>{romanDay(info.monthIndex, info.day)}</span>
            <small>{info.monthIndex === 12 ? "вне времени" : `${day.pyata} пята`}</small>
          </div>
        </section>

        <section className="today-create-panel" aria-labelledby="today-create-title">
          <div>
            <span className="eyebrow">Быстрое действие</span>
            <h2 id="today-create-title">Создать для сегодняшнего дня</h2>
          </div>
          <div className="today-create-options">
            <details className="all-tasks-create">
              <summary><span aria-hidden="true">＋</span> Новая задача</summary>
              {renderTaskCreateForm("today")}
            </details>
            <details className="task-list-create">
              <summary><span aria-hidden="true">☷</span> Новый список задач</summary>
              {renderTaskListCreateForm("today")}
            </details>
          </div>
        </section>

        {moon.event || solarEvent ? (
          <section className="today-event-notices" aria-label="Особая сила сегодняшнего дня" aria-live="polite">
            {moon.event ? (
              <article className="today-event-notice moon-practice-notice">
                <span aria-hidden="true"><MoonPhaseIcon phaseStep={moon.phaseStep} size={34} /></span>
                <div>
                  <span className="eyebrow">{isNewMoonDay ? "Новолуние" : "Полнолуние"}</span>
                  <h2>Сегодня {isNewMoonDay ? "новолуние" : "полнолуние"}</h2>
                  <p>Это время хорошо подходит для аскезы, включая голодание на воде, если у вас нет к этому противопоказаний. При сомнениях заранее посоветуйтесь с врачом.</p>
                </div>
              </article>
            ) : null}
            {solarEvent && solarCopy ? (
              <article className="today-event-notice solar-practice-notice">
                <span className="solar-notice-symbol" aria-hidden="true">{solarEvent.symbol}</span>
                <div>
                  <span className="eyebrow">Солнечная точка года</span>
                  <h2>Сегодня {solarEvent.name.toLocaleLowerCase("ru-RU")}</h2>
                  <p><strong>Сила дня.</strong> {solarCopy.force}</p>
                  <p><strong>Древняя Греция.</strong> {solarCopy.greekPractice}</p>
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

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
              <MoonPhaseIcon phaseStep={moon.phaseStep} size={50} />
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
          "--month-art": `url("${monthArtUrl(monthIndex)}")`,
        } as CSSProperties}
      >
        <header className="calendar-header">
          <span className="calendar-month-art" aria-hidden="true" />
          <div>
            <span className="eyebrow">{selectedMonth.season} · {selectedMonth.roman} месяц</span>
            <h1>{selectedMonth.name}</h1>
            <p className="calendar-title">{selectedMonth.title}</p>
            <p>{selectedMonth.description}</p>
            <div className={`calendar-solar-control status-${solarLocationStatus}`} aria-live="polite">
              <div>
                <span aria-hidden="true">☀</span>
                <strong>{solarLocationStatus === "ready"
                  ? "Рассвет и закат · время устройства"
                  : "Синхронизируем рассвет и закат…"}</strong>
              </div>
              <small>{solarLocationStatus === "ready"
                ? `${solarLocationSource === "network"
                  ? "Регион приблизительно определён по сети"
                  : solarLocationSource === "timezone-network"
                  ? "Регион определён по часовому поясу через сеть"
                  : "Расчёт выполнен по часовому поясу устройства"} · ${deviceTimeZone}`
                : "Определяем регион автоматически, без запроса геопозиции"}</small>
            </div>
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
                  {row.map((dayNumber) => {
                    const gregorian = getGregorianDate(sacredYear, monthIndex, dayNumber);
                    const moon = getMoon(gregorian);
                    const sacredDay = getSacredDay(monthIndex, dayNumber);
                    const key = taskDateKey(sacredYear, monthIndex, dayNumber);
                    const taskCount = tasks.filter(
                      (task) => taskDateKey(task.sacredYear, task.monthIndex, task.day) === key,
                    ).length;
                    const isToday = key === todayKey;
                    const isSelected = dayNumber === selectedDay;
                    const solarEvent = getSolarEvent(sacredYear, monthIndex, dayNumber);
                    const sunriseSunset = deviceLocation ? getSunriseSunset(gregorian, deviceLocation) : null;
                    const solarTimePlaceholder = solarLocationStatus === "ready" ? "нет" : "…";
                    const sunrise = sunriseSunset ? formatDeviceSolarTime(sunriseSunset.sunrise, deviceTimeZone) : solarTimePlaceholder;
                    const sunset = sunriseSunset ? formatDeviceSolarTime(sunriseSunset.sunset, deviceTimeZone) : solarTimePlaceholder;
                    return (
                      <article
                        key={dayNumber}
                        className={`calendar-day${isSelected ? " selected" : ""}${isToday ? " today" : ""}${solarEvent ? " solar-day" : ""}${taskCount ? " has-tasks" : ""}`}
                      >
                        <button
                          type="button"
                          className="calendar-day-open"
                          onClick={() => {
                            setSelectedDay(dayNumber);
                            setDayDetailsOrigin("calendar");
                            setDayDetailsOpen(true);
                          }}
                          aria-pressed={isSelected}
                          aria-label={`${formatGregorian(gregorian, true)} — ${sacredDay.name}${solarEvent ? ` — ${solarEvent.name}` : ""}${taskCount ? ` — ${taskCount} задач` : ""}`}
                        />
                        <span className="calendar-gregorian">{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(gregorian)}</span>
                        <strong>{romanDay(monthIndex, dayNumber)}</strong>
                        {solarEvent ? <span className="calendar-solar-mark" title={solarEvent.name}><b aria-hidden="true">{solarEvent.symbol}</b><em>{solarEvent.shortName}</em></span> : null}
                        <span className="calendar-moon" title={`${moon.epithet}: ${moon.phase}`}><MoonPhaseIcon phaseStep={moon.phaseStep} size={16} /> {moon.day}</span>
                        <span
                          className="calendar-sun-times"
                          aria-label={`Рассвет ${sunrise}, закат ${sunset}`}
                          title={sunriseSunset
                            ? "Рассвет и закат по времени устройства"
                            : solarLocationStatus === "ready"
                            ? "В этот день солнце не пересекает линию горизонта"
                            : "Синхронизируем время рассвета и заката"}
                        >
                          <span><i aria-hidden="true">↗</i>{sunrise}</span>
                          <span><i aria-hidden="true">↘</i>{sunset}</span>
                        </span>
                        <small>{sacredDay.name.split("(")[0].trim()}</small>
                        {taskCount ? (
                          <button
                            type="button"
                            className="calendar-day-task-count"
                            onClick={() => {
                              setSelectedDay(dayNumber);
                              setDayDetailsOrigin("calendar");
                              setDayDetailsOpen(true);
                            }}
                            aria-label={`Открыть день и показать задачи: ${taskCount}`}
                            aria-haspopup="dialog"
                          >
                            {taskCount}
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

      </div>
    );
  };

  const renderProjects = () => {
    const searchTerms = tagSearch
      .toLocaleLowerCase("ru-RU")
      .split(/[\s,;#]+/)
      .map((term) => term.trim())
      .filter(Boolean);
    const tagsMatch = (tags: string[]) => !searchTerms.length || searchTerms.every((term) => (
      tags.some((tag) => tag.toLocaleLowerCase("ru-RU").includes(term))
    ));
    const matchingTaggedProjects = projects.filter((project) => searchTerms.length > 0 && tagsMatch(project.tags));
    const matchingProjectIds = new Set(matchingTaggedProjects.map((project) => project.id));
    if (searchTerms.length) {
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
    const projectRows = flattenProjects(projects).filter(({ project }) => !searchTerms.length || matchingProjectIds.has(project.id));
    const inboxTasks = tasks.filter((task) => !resolvedTaskProjectId(task) && !task.project);
    const inboxTaskLists = taskLists.filter((taskList) => !linkedProjectId(taskList.id));
    const activeProjects = projects.filter((project) => project.status === "active").length;
    const rootProjects = projects.filter((project) => !project.parentId).length;
    const completedProjects = projects.filter((project) => project.status === "completed").length;

    return (
      <div className="projects-view">
        <header className="projects-header">
          <div>
            <span className="eyebrow">Система порядка</span>
            <h1>Проекты и направления</h1>
            <p>Разделяйте большие замыслы на подпроекты и конкретные действия. Связи, повторения и сроки остаются видимыми в плане дня.</p>
          </div>
          <div className="projects-summary" aria-label="Сводка проектов">
            <span><strong>{activeProjects}</strong> активных</span>
            <span><strong>{rootProjects}</strong> основных</span>
            <span><strong>{completedProjects}</strong> завершено</span>
          </div>
        </header>

        <label className="tag-search">
          <span aria-hidden="true">⌕</span>
          <input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Поиск проектов по тегам — например, #работа" />
          {tagSearch ? <button type="button" onClick={() => setTagSearch("")} aria-label="Очистить поиск">×</button> : null}
        </label>

        {searchTerms.length ? (
          <section className="tag-search-results" aria-live="polite" aria-label="Результаты поиска проектов по тегам">
            <header>
              <strong>Проекты по тегам</strong>
              <span>{matchingTaggedProjects.length} проектов</span>
            </header>
            <div>
              {matchingTaggedProjects.map((project) => (
                <button type="button" key={`project-${project.id}`} onClick={() => openProjectEditor(project)}>
                  <span>Проект</span><strong>{project.title}</strong><small>{project.tags.map((tag) => `#${tag}`).join(" ")}</small>
                </button>
              ))}
              {!matchingTaggedProjects.length ? <p>Проектов с такими тегами нет.</p> : null}
            </div>
          </section>
        ) : null}

        <div className="projects-layout">
          <section className="project-tree-panel" aria-labelledby="project-tree-title">
            <div className="section-heading compact-heading">
              <div>
                <span className="eyebrow">Иерархия</span>
                <h2 id="project-tree-title">Дерево проектов</h2>
              </div>
              <span className="ornament" aria-hidden="true">◎</span>
            </div>

            <div className="project-tree-workspace">
              <section
                className={`inbox-card${projectDropTargetId === TASK_INBOX_PROJECT_ID ? " drop-target" : ""}`}
                data-project-drop-id={TASK_INBOX_PROJECT_ID}
                aria-labelledby="project-inbox-title"
              >
                <span className="eyebrow">Несортированное · зона возврата</span>
                <h2 id="project-inbox-title">Хаос-бокс</h2>
                <p>{projectDragItem ? "Отпустите здесь, чтобы убрать элемент из проекта." : "Возьмите пальцем любую плашку задачи или списка и перенесите в нужный проект. Обратно в хаос-бокс она переносится так же."}</p>
                <strong>{inboxTasks.length + inboxTaskLists.length}</strong>
                <div className="inbox-card-items">
                  {inboxTaskLists.map((taskList) => {
                    const item: ProjectDragItem = { kind: "task-list", id: taskList.id, title: taskList.title };
                    const taskCount = tasks.filter((task) => task.googleTaskListId === taskList.id).length;
                    return (
                      <article className="inbox-list-item project-draggable-item" key={taskList.id} aria-label={`Перетащить список «${taskList.title}»`} {...projectDragProps(item)}>
                        <span className="project-drag-handle" aria-hidden="true">⋮⋮</span>
                        <span><strong>{taskList.title}</strong><small>Список · {taskCount} задач</small></span>
                      </article>
                    );
                  })}
                  {inboxTasks.map((task) => {
                    const item: ProjectDragItem = { kind: "task", id: task.id, title: task.title };
                    return (
                      <article className={`project-draggable-item${task.done ? " done" : ""}`} key={task.id} aria-label={`Перетащить задачу «${task.title}»`} {...projectDragProps(item)}>
                        <span className="project-drag-handle" aria-hidden="true">⋮⋮</span>
                        <button type="button" onClick={() => {
                          if (!suppressProjectItemClickRef.current) openTaskEditor(task);
                        }}>
                          <strong>{task.title}</strong>
                          <small>{taskRangeLabel(task)}</small>
                        </button>
                      </article>
                    );
                  })}
                  {!inboxTaskLists.length && !inboxTasks.length ? <p>Все задачи и списки уже распределены по проектам.</p> : null}
                </div>
              </section>

              <div className="project-tree-main">
                <div className="project-tree">
              {projectRows.length ? projectRows.map(({ project, depth }) => {
                const category = categories.find((item) => item.id === project.categoryId);
                const projectTasks = tasks.filter((task) => resolvedTaskProjectId(task) === project.id);
                const projectTaskLists = taskLists.filter((taskList) => (
                  taskListLinks.some((link) => link.taskListId === taskList.id && link.projectId === project.id)
                ));
                const finished = projectTasks.filter((task) => task.done).length;
                return (
                  <article
                    className={`project-row${project.status === "completed" ? " completed" : ""}${projectDropTargetId === project.id ? " drop-target" : ""}`}
                    key={project.id}
                    data-project-drop-id={project.id}
                    style={{ "--project-depth": depth, "--project-color": category?.color ?? "#8d7750" } as CSSProperties}
                  >
                    <button type="button" className="project-status" onClick={() => toggleProject(project.id)} aria-label={project.status === "completed" ? `Вернуть проект «${project.title}»` : `Завершить проект «${project.title}»`}>
                      {project.status === "completed" ? "✓" : ""}
                    </button>
                    <button type="button" className="project-open" onClick={() => setTaskProject(project.id)}>
                      <span>{depth ? "↳" : "◇"}</span>
                      <div>
                        <strong>{project.title}</strong>
                        <small>{category?.name ?? "Без категории"} · {finished}/{projectTasks.length} действий{projectTaskLists.length ? ` · ${projectTaskLists.length} списков Google Tasks` : ""}</small>
                        {project.description ? <p>{project.description}</p> : null}
                        {project.tags.length ? <em>{project.tags.map((tag) => `#${tag}`).join("  ")}</em> : null}
                      </div>
                    </button>
                    <button type="button" className="project-edit" onClick={() => openProjectEditor(project)} aria-label={`Редактировать проект «${project.title}»`}>✎</button>
                    <button type="button" className="project-delete" onClick={() => deleteProject(project.id)} aria-label={`Удалить проект «${project.title}»`}>×</button>
                    <div className="project-drop-field">
                      <div className="project-drop-heading">
                        <span>Пространство проекта</span>
                        <small>{projectDragItem ? "Отпустите здесь" : "Перетаскивайте за всю плашку"}</small>
                      </div>
                      <div className="project-assigned-items">
                        {projectTaskLists.map((taskList) => {
                          const item: ProjectDragItem = { kind: "task-list", id: taskList.id, title: taskList.title };
                          const taskCount = tasks.filter((task) => task.googleTaskListId === taskList.id).length;
                          return (
                            <div className="project-assigned-list project-draggable-item" key={taskList.id} aria-label={`Перетащить список «${taskList.title}»`} {...projectDragProps(item)}>
                              <span className="project-drag-handle" aria-hidden="true">⋮⋮</span>
                              <span><strong>{taskList.title}</strong><small>Список · {taskCount} задач</small></span>
                            </div>
                          );
                        })}
                        {projectTasks.map((task) => {
                          const item: ProjectDragItem = { kind: "task", id: task.id, title: task.title };
                          return (
                            <article
                              className={`project-assigned-task project-draggable-item${task.done ? " done" : ""}`}
                              key={task.id}
                              aria-label={`Перетащить задачу «${task.title}»`}
                              {...projectDragProps(item)}
                            >
                              <span className="project-drag-handle" aria-hidden="true">⋮⋮</span>
                              <button type="button" className="project-assigned-task-open" onClick={() => {
                                if (!suppressProjectItemClickRef.current) openTaskEditor(task);
                              }}><strong>{task.title}</strong><small>{taskRangeLabel(task)}</small></button>
                            </article>
                          );
                        })}
                        {!projectTaskLists.length && !projectTasks.length ? (
                          <p>Пока пусто — перенесите сюда элемент из «Несортированного» или «Списков задач».</p>
                        ) : null}
                      </div>
                    </div>
                    <i className="project-progress" style={{ "--project-progress": `${projectTasks.length ? Math.round((finished / projectTasks.length) * 100) : 0}%` } as CSSProperties} />
                  </article>
                );
              }) : (
                <div className="task-empty compact-empty">
                  <span aria-hidden="true">{searchTerms.length ? "⌕" : "◇"}</span>
                  <strong>{searchTerms.length ? "По этим тегам ничего не найдено" : "Создайте первый проект"}</strong>
                  <p>{searchTerms.length ? "Попробуйте другой тег или очистите строку поиска." : "Большая цель становится управляемой, когда у неё есть структура."}</p>
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
              </div>
            </div>
          </section>

        </div>

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
        <p className="sr-only" aria-live="polite">{projectMoveAnnouncement}</p>
        {projectTouchPoint && projectDragItem ? (
          <div className="project-drag-preview" style={{ left: projectTouchPoint.x, top: projectTouchPoint.y }}>
            <span>{projectDragItem.kind === "task" ? "Задача" : "Список"}</span>
            <strong>{projectDragItem.title}</strong>
          </div>
        ) : null}
      </div>
    );
  };

  const renderAllTasks = () => {
    const searchTerms = allTasksSearch
      .toLocaleLowerCase("ru-RU")
      .split(/[\s,;#]+/)
      .map((term) => term.trim())
      .filter(Boolean);
    const taskMatches = (task: Task) => {
      if (allTasksStatusFilter === "active" && task.done) return false;
      if (allTasksStatusFilter === "done" && !task.done) return false;
      if (!searchTerms.length) return true;
      const haystack = [task.title, resolvedTaskProjectTitle(task), task.googleTaskListTitle, ...task.tags]
        .join(" ")
        .toLocaleLowerCase("ru-RU");
      return searchTerms.every((term) => haystack.includes(term));
    };
    const sortedTasks = [...tasks]
      .sort((a, b) => `${a.dueDate}T${a.time || "00:00"}`.localeCompare(`${b.dueDate}T${b.time || "00:00"}`))
      .filter(taskMatches);
    const activeCount = tasks.filter((task) => !task.done).length;
    const doneCount = tasks.filter((task) => task.done).length;

    return (
      <div className="all-tasks-view">
        <header className="all-tasks-header">
          <div>
            <span className="eyebrow">Полный обзор</span>
            <h1>Задачи</h1>
            <p>Каждая задача из GENESIS, Google Calendar и Google Tasks в одном списке — со сроками, проектами, тегами, приоритетом и связями.</p>
          </div>
          <div className="all-tasks-summary" aria-label="Сводка задач">
            <span><strong>{tasks.length}</strong> всего</span>
            <span><strong>{activeCount}</strong> активных</span>
            <span><strong>{doneCount}</strong> завершено</span>
          </div>
        </header>

        <div className="all-tasks-create-grid">
          <details className="all-tasks-create" open>
            <summary><span aria-hidden="true">＋</span> Добавить задачу</summary>
            {renderTaskCreateForm("all-tasks")}
          </details>
          <details className="task-list-create">
            <summary><span aria-hidden="true">☷</span> Создать список задач</summary>
            {renderTaskListCreateForm("all-tasks")}
          </details>
        </div>

        <div className="all-tasks-toolbar">
          <label className="tag-search">
            <span aria-hidden="true">⌕</span>
            <input value={allTasksSearch} onChange={(event) => setAllTasksSearch(event.target.value)} placeholder="Поиск задач по названию, проекту или тегу" />
            {allTasksSearch ? <button type="button" onClick={() => setAllTasksSearch("")} aria-label="Очистить поиск">×</button> : null}
          </label>
          <div className="all-tasks-status-filter" role="group" aria-label="Фильтр по статусу">
            <button type="button" className={allTasksStatusFilter === "all" ? "active" : ""} onClick={() => setAllTasksStatusFilter("all")}>Все</button>
            <button type="button" className={allTasksStatusFilter === "active" ? "active" : ""} onClick={() => setAllTasksStatusFilter("active")}>Активные</button>
            <button type="button" className={allTasksStatusFilter === "done" ? "active" : ""} onClick={() => setAllTasksStatusFilter("done")}>Завершённые</button>
          </div>
          <span className="all-tasks-sync" title={syncError || undefined}><i className={`sync-dot sync-${syncStatus}`} /> {syncLabel}</span>
        </div>

        <div className="all-tasks-list" aria-live="polite">
          {sortedTasks.length ? sortedTasks.map((task) => {
            const project = resolvedTaskProject(task);
            const category = categories.find((item) => item.id === (task.categoryId ?? project?.categoryId));
            const isOverdue = !task.done && (task.endDate || task.dueDate) < todayDateValue;
            const source = taskOriginMeta(task.createdIn);
            const dependencyNames = task.dependsOnIds
              .map((dependencyId) => tasks.find((item) => item.id === dependencyId)?.title)
              .filter((title): title is string => Boolean(title));
            return (
              <article className={`all-task-row${task.done ? " done" : ""}${isOverdue ? " past" : ""}`} key={task.id}>
                <button type="button" className="task-check" onClick={() => toggleTask(task.id)} aria-label={task.done ? `Вернуть задачу «${task.title}»` : `Завершить задачу «${task.title}»`}>
                  {task.done ? "✓" : ""}
                </button>
                <div className="all-task-body">
                  <div className="all-task-title-row">
                    <strong>{task.title}</strong>
                    <span className="all-task-priority" title="Приоритет">⚑{task.priority}</span>
                  </div>
                  <div className="all-task-meta">
                    <span>{taskRangeLabel(task)}</span>
                    <span>{resolvedTaskProjectTitle(task) || "Без проекта"}</span>
                    {task.googleTaskListTitle ? <span>Список: {task.googleTaskListTitle}</span> : null}
                    {category ? <span className="all-task-category" style={{ "--project-color": category.color } as CSSProperties}>{category.name}</span> : null}
                    <span className={`all-task-source source-${source.className}`}>{source.label}</span>
                  </div>
                  {task.tags.length ? <div className="task-tags">{task.tags.map((tag) => <i key={tag}>#{tag}</i>)}</div> : null}
                  {dependencyNames.length ? <div className="task-dependency">↳ после: {dependencyNames.join(", ")}</div> : null}
                </div>
                <div className="all-task-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => openTaskEditor(task)}
                    title="Редактировать задачу"
                    aria-label={`Редактировать задачу «${task.title}»`}
                  >✎</button>
                  <button type="button" className="task-delete" onClick={() => deleteTask(task.id)} aria-label={`Удалить задачу «${task.title}»`}>×</button>
                </div>
              </article>
            );
          }) : (
            <div className="task-empty">
              <span aria-hidden="true">☰</span>
              <strong>{searchTerms.length || allTasksStatusFilter !== "all" ? "Ничего не найдено" : "Задач пока нет"}</strong>
              <p>{searchTerms.length || allTasksStatusFilter !== "all" ? "Попробуйте другой запрос или фильтр." : "Добавьте задачу в плане дня, и она появится здесь."}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderYear = () => (
    <div className="year-view">
      <header className="projects-header year-header">
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
        {solarEvents.map((event) => {
          const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(event.date);
          const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(event.date);
          return (
            <button
              type="button"
              key={event.id}
              onClick={() => {
                setMonthIndex(event.monthIndex);
                setSelectedDay(event.day);
                setDayDetailsOrigin("year");
                setDayDetailsOpen(true);
              }}
            >
              <span className="solar-glyph" aria-hidden="true"><i>{event.symbol}</i></span>
              <span>
                <small>{event.kind === "equinox" ? "Равноденствие" : "Солнцестояние"}</small>
                <em>{weekday}</em>
                <strong>{date}</strong>
              </span>
            </button>
          );
        })}
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
            setDayDetailsOrigin("year");
            setDayDetailsOpen(true);
          };
          const openMonth = () => {
            setMonthIndex(month.index);
            setSelectedDay(isCurrent ? todayInfo.day : 1);
            setDayDetailsOrigin("calendar");
            setDayDetailsOpen(false);
            navigateTo("calendar");
          };
          return (
            <article
              className={`year-month${month.index === 12 ? " apeiron" : ""}${isCurrent ? " current" : ""}`}
              key={month.name}
              aria-labelledby={`year-month-${month.index}`}
              style={{
                "--month-accent": month.color,
                "--month-art": `url("${monthArtUrl(month.index)}")`,
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
                  onClick={openMonth}
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
        <article className="year-description-card" aria-labelledby="year-description-title">
          <span className="eyebrow">Ритм GENESIS</span>
          <h2 id="year-description-title">Солнечно-лунный календарь</h2>
          <p>Год GENESIS начинается в день весеннего равноденствия и раскрывается через двенадцать месяцев. Каждый месяц несёт собственный образ, цвет, стихию и смысл — не просто отрезок времени, а отдельную ступень годового пути.</p>
          <p>В каждом месяце ровно 30 дней. Вместо привычных недель время собрано в шесть пят: коротких пятидневных ритмов, где нечётные и чётные пяты сменяют друг друга. Так солнечная мера года соединяется с живым лунным дыханием.</p>
          <dl>
            <div><dt>12</dt><dd>символических месяцев</dd></div>
            <div><dt>30</dt><dd>дней в каждом месяце</dd></div>
            <div><dt>6</dt><dd>пят вместо недель</dd></div>
            <div><dt>4</dt><dd>солнечных праздника года</dd></div>
          </dl>
          <p>Равноденствия и солнцестояния образуют четыре праздничные опоры. После завершения двенадцатого месяца наступает Апейрон — несколько дней вне обычного счёта, пространство тишины перед новым весенним началом.</p>
        </article>
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
          <span className="month-rail-title">Месяцы года</span>
          <div className="month-rail-grid">
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
                <i aria-hidden="true">{month.symbol}</i>
                <small>{month.name}</small>
              </button>
            ))}
          </div>
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

        <div className={`workspace workspace-full${view === "today" ? " today-workspace" : ""}`} id="main-content">
          <div className="content-column">
            {view === "today" ? renderToday() : null}
            {view === "calendar" ? renderCalendar() : null}
            {view === "projects" ? renderProjects() : null}
            {view === "year" ? renderYear() : null}
            {view === "all-tasks" ? renderAllTasks() : null}
            {view === "stoicheion" ? <StoicheionView /> : null}
            {view === "admin" && cloudUser?.isAdmin ? <AdminPanel /> : null}
            <footer className="genesis-page-footer" aria-label="Ссылки проекта">
              <a href="https://t.me/genesisbasilea" target="_blank" rel="noreferrer">
                <span aria-hidden="true">✦</span>
                <span><strong>Академия Генезис</strong><small>Открыть Telegram</small></span>
              </a>
              <a href="https://donate.stream/genesiscalendar" target="_blank" rel="noreferrer">
                <span aria-hidden="true">♡</span>
                <span><strong>Поддержать проект</strong><small>Donate.Stream</small></span>
              </a>
            </footer>
          </div>
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Мобильная навигация">
        {navigation.map((item) => (
          <button type="button" key={item.id} data-nav-id={item.id} className={view === item.id ? "active" : ""} onClick={() => activateNavigation(item.id)}>
            <span aria-hidden="true">{item.symbol}</span>{item.label}
          </button>
        ))}
      </nav>
      {dayDetailsOpen ? (
        <div className="modal-backdrop day-details-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setDayDetailsOpen(false); }}>
          <section className={`selected-day-card day-details-modal${selectedSolarEvent ? " solar-selected-day" : ""}`} role="dialog" aria-modal="true" aria-labelledby="selected-day-title" aria-describedby="selected-day-description">
            <button type="button" className="modal-close" onClick={() => setDayDetailsOpen(false)} aria-label="Закрыть сведения о дне">×</button>
            <div className="selected-day-symbol" aria-hidden="true">{selectedSolarEvent?.symbol ?? selectedElement.symbol}</div>
            <div className="selected-day-copy">
              <span className="eyebrow">{formatGregorian(selectedDate, true)} · {selectedMoon.epithet}</span>
              <h2 id="selected-day-title">{selectedSacredDay.name}</h2>
              <p id="selected-day-description">{selectedSacredDay.description}</p>
              {selectedSolarEvent ? <strong className="selected-solar-event">{selectedSolarEvent.name} · День Солнца</strong> : null}
            </div>
            <dl className="selected-day-facts">
              {selectedSolarEvent ? <div className="solar-fact"><dt>Солнечная точка</dt><dd>{selectedSolarEvent.name}</dd></div> : null}
              <div><dt>Стихия</dt><dd>{selectedElement.name}</dd></div>
              <div><dt>Пята</dt><dd>{selectedSacredDay.pyataTitle || "Апейрон"}</dd></div>
              <div><dt>Число</dt><dd>{selectedPythagorean?.name || "Безграничное"}</dd></div>
            </dl>
            {selectedDayTasks.length ? (
              <section className="day-details-tasks" aria-labelledby="day-details-tasks-title">
                <header>
                  <span className="eyebrow">План дня</span>
                  <h3 id="day-details-tasks-title">Задачи · {selectedDayTasks.length}</h3>
                </header>
                <div className="day-details-task-list">
                  {selectedDayTasks.map((task) => {
                    const projectTitle = resolvedTaskProjectTitle(task);
                    return (
                      <article className={task.done ? "done" : ""} key={task.id}>
                        <button
                          type="button"
                          className="task-check"
                          onClick={() => toggleTask(task.id)}
                          aria-label={task.done ? `Вернуть задачу «${task.title}»` : `Завершить задачу «${task.title}»`}
                        >
                          {task.done ? "✓" : ""}
                        </button>
                        <button type="button" className="day-details-task-open" onClick={() => {
                          setDayDetailsOpen(false);
                          openTaskEditor(task);
                        }}>
                          <span><time>{task.time || "Весь день"}</time>{task.priority ? <em>Приоритет {task.priority}</em> : null}</span>
                          <strong>{task.title}</strong>
                          {task.description || projectTitle || task.googleTaskListTitle ? (
                            <small>{task.description || projectTitle || task.googleTaskListTitle}</small>
                          ) : null}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
            <details className="day-details-celestial">
              <summary>
                <span><i aria-hidden="true">☾</i> Луна и Солнце</span>
                <small>Фаза Луны, рассвет и закат</small>
              </summary>
              <div className="day-details-celestial-grid">
                <article className="day-details-moon">
                  <MoonPhaseIcon phaseStep={selectedMoon.phaseStep} size={44} />
                  <div>
                    <span className="eyebrow">Луна · {selectedMoon.day} день</span>
                    <strong>{selectedMoon.epithet}</strong>
                    <p>{selectedMoon.phase} · освещённость {selectedMoon.illumination}%</p>
                    <small>{selectedMoon.direction}{selectedMoon.event ? ` · ${selectedMoon.event}` : ""}</small>
                  </div>
                </article>
                <article className="day-details-sun">
                  <span aria-hidden="true">☀</span>
                  <div>
                    <span className="eyebrow">Солнце · время устройства</span>
                    <dl>
                      <div><dt>Рассвет</dt><dd>{selectedSunrise}</dd></div>
                      <div><dt>Закат</dt><dd>{selectedSunset}</dd></div>
                    </dl>
                    <small>{selectedSunriseSunset
                      ? `${deviceTimeZone} · автоматический расчёт для региона устройства`
                      : solarLocationStatus === "ready"
                      ? "В этот день солнце не пересекает линию горизонта"
                      : "Синхронизируем данные о Солнце…"}</small>
                  </div>
                </article>
              </div>
            </details>
            {dayDetailsOrigin === "year" ? (
              <div className="day-details-actions">
                <button type="button" className="primary-button" onClick={() => {
                  setDayDetailsOrigin("calendar");
                  setDayDetailsOpen(false);
                  navigateTo("calendar");
                }}>
                  Открыть месяц «{selectedMonth.name}» <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
      {editingTask ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingTask(null); }}>
          <form className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="task-editor-title" onSubmit={saveTaskEdit}>
            <button type="button" className="modal-close" onClick={() => setEditingTask(null)} aria-label="Закрыть">×</button>
            <span className="eyebrow">Редактирование задачи</span>
            <h2 id="task-editor-title">Задача и её контекст</h2>
            <p className="editor-source-note">
              {taskOriginMeta(editingTask.createdIn).label}.
              {editingTask.googleTaskListTitle ? ` Список Google Tasks: «${editingTask.googleTaskListTitle}».` : " Изменения синхронизируются с Google Calendar."}
            </p>
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
                <span>Начало</span>
                <input type="date" min={editingTask.dueDate < todayDateValue ? editingTask.dueDate : todayDateValue} value={editingTask.dueDate} onChange={(event) => setEditingTask((current) => current ? {
                  ...current,
                  dueDate: event.target.value,
                  endDate: current.endDate < event.target.value ? event.target.value : current.endDate,
                } : current)} required />
              </label>
              <label>
                <span>Срок выполнения</span>
                <input type="date" min={editingTask.dueDate} value={editingTask.endDate || editingTask.dueDate} onChange={(event) => setEditingTask((current) => current ? { ...current, endDate: event.target.value } : current)} required />
              </label>
              <label htmlFor="edit-task-time-hour">
                <span>Время</span>
                <TimeClockPicker
                  id="edit-task-time-hour"
                  value={editingTask.time}
                  disabled={Boolean(editingTask.googleTaskId)}
                  onChange={(value) => setEditingTask((current) => current ? { ...current, time: value } : current)}
                />
              </label>
              <label>
                <span>Проект</span>
                <select value={editingTask.projectId ?? ""} onChange={(event) => setEditingTask((current) => current ? { ...current, projectId: event.target.value || null } : current)}>
                  <option value="">{editingTask.googleTaskListId && linkedProjectId(editingTask.googleTaskListId) ? "По проекту списка Google Tasks" : "Без проекта"}</option>
                  <option value={TASK_INBOX_PROJECT_ID}>Хаос-бокс — без проекта</option>
                  {flattenProjects(projects).map(({ project, depth }) => <option key={project.id} value={project.id}>{"— ".repeat(depth)}{project.title}</option>)}
                </select>
              </label>
              <label>
                <span>Календарь или список задач</span>
                <select value={editingTask.googleTaskListId ?? ""} onChange={(event) => {
                  const nextListId = event.target.value;
                  setEditingTask((current) => current ? {
                    ...current,
                    googleTaskListId: nextListId || null,
                    time: nextListId ? "" : current.time,
                    reminderMinutes: nextListId ? null : current.reminderMinutes,
                    recurrence: nextListId ? "none" : current.recurrence,
                    recurrenceInterval: nextListId ? 1 : current.recurrenceInterval,
                    recurrenceMode: nextListId ? "none" : current.recurrenceMode,
                    recurrencePattern: nextListId ? "none" : current.recurrencePattern,
                    recurrenceDays: nextListId ? [] : current.recurrenceDays,
                    recurrenceSeriesId: nextListId ? null : current.recurrenceSeriesId,
                  } : current);
                }}>
                  <option value="">Google Calendar</option>
                  {taskLists.map((taskList) => <option value={taskList.id} key={taskList.id}>Список · {taskList.title}</option>)}
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
              <label>
                <span>Приоритет</span>
                <select value={editingTask.priority} onChange={(event) => setEditingTask((current) => current ? { ...current, priority: Number(event.target.value) } : current)}>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Теги через запятую</span>
              <input value={editingTaskTags} onChange={(event) => setEditingTaskTags(event.target.value)} placeholder="работа, дом, ритуал" />
            </label>
            {tasks.length ? (
              <div className="task-form-field task-form-row-full">
                <span>Зависит от</span>
                <DependencyPicker
                  tasks={tasks}
                  excludeId={editingTask.id}
                  value={editingTask.dependsOnIds}
                  onChange={(ids) => setEditingTask((current) => current ? { ...current, dependsOnIds: ids } : current)}
                />
              </div>
            ) : null}
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
