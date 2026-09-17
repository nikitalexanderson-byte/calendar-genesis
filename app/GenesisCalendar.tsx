"use client";
/* eslint-disable @next/next/no-img-element -- Google requires the official, unmodified sign-in asset. */

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
  type GeminiPlan,
  type GoogleTaskList,
  type GenesisCategory,
  type GenesisProject,
  type GenesisTask as Task,
  type GenesisUser,
  type RecurrenceKind,
  type TaskListProjectLink,
  type TaskOrigin,
  connectAdditionalGoogleAccount,
  connectGoogleServices,
  consumeGoogleAuthError,
  createGoogleTaskList,
  removeGoogleTaskList,
  isGoogleSyncConfigured,
  loadGeminiStatus,
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
  updateAccountPreferences,
  updateGoogleTaskList,
} from "./cloud-sync";
import { AccountPanel } from "./AccountPanel";
import { AdminPanel } from "./AdminPanel";
import { GeminiAssistant } from "./GeminiAssistant";
import { LocalVoiceAssistant } from "./LocalVoiceAssistant";
import { currentLegalPage, LegalPage } from "./LegalPage";
import { StoicheionView } from "./StoicheionView";
import { TimeClockPicker } from "./TimeClockPicker";
import { CalendarDatePicker } from "./CalendarDatePicker";
import { TaskReminderPicker } from "./TaskReminderPicker";
import { CronusSickleIcon } from "./CronusSickleIcon";
import { MoonPhaseIcon } from "./MoonPhaseIcon";
import { RecurrenceBuilder } from "./RecurrenceBuilder";
import { WelcomeScreen } from "./WelcomeScreen";
import {
  MONTHS,
  LUNAR_DECADES,
  PYATA_MEANINGS,
  type CalendarMode,
  calendarDateNote,
  dateKey,
  formatGregorian,
  formatCalendarDate,
  getDayElement,
  getGregorianDate,
  getLunarDate,
  getLunarMonthDefinition,
  getLunarMonthDates,
  getLunarMonthStart,
  getLunarYear,
  getLunarYearForDate,
  getMoon,
  getPythagorean,
  getSacredDate,
  getSacredDay,
  getSolarEvent,
  getSolarEvents,
  lunarMonthIndex,
  normalizeCalendarDateNote,
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
  LANGUAGE_LOGIN_PENDING_KEY,
  browserLanguage,
  normalizeLanguage,
  runtimeLocale,
  storeLanguage,
  translateText,
  type Language,
  useDocumentLanguage,
} from "./i18n";
import {
  buildRecurrenceDates,
  alignRecurrenceConfigWithCalendar,
  DEFAULT_RECURRENCE_CONFIG,
  MAX_RECURRENCE_OCCURRENCES,
  recurrenceConfigFromTask,
  recurrenceDatesForTask,
  resolveRecurrenceConfig,
  type RecurrenceConfig,
  type RecurrenceMode,
  type RecurrencePattern,
} from "./task-recurrence";
import { legacyReminderMinutes, normalizeTaskReminders, type TaskReminder } from "./task-reminders";

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

type AlternativeYearMonth = {
  id: string;
  title: string;
  subtitle: string;
  ordinal: string;
  symbol: string;
  dates: Date[];
  accentMonth: (typeof MONTHS)[number];
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

const CALENDAR_MODE_META: Record<CalendarMode, { label: string }> = {
  sacred: { label: "Сакральный календарь" },
  lunar: { label: "Лунный календарь" },
  profane: { label: "Григорианский календарь" },
};

const PROFANE_WEEKDAY_PATRONS = [
  { weekday: "Воскресенье", patronage: "День Аполлона" },
  { weekday: "Понедельник", patronage: "День Луны — Селены, Гекаты и Артемиды" },
  { weekday: "Вторник", patronage: "День Ареса" },
  { weekday: "Среда", patronage: "День Гермеса" },
  { weekday: "Четверг", patronage: "День Зевса и Геры" },
  { weekday: "Пятница", patronage: "День Афродиты, Гестии и Диониса" },
  { weekday: "Суббота", patronage: "День Кроноса, Посейдона и Аида" },
] as const;

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
        const recurrencePattern: RecurrencePattern = ["none", "daily", "weekdays", "monthly", "yearly", "pyata-days", "month-days", "lunar-days"].includes(legacy.recurrencePattern ?? "")
          ? legacy.recurrencePattern as RecurrencePattern
          : recurrenceMode === "classic"
            ? legacy.recurrence === "daily" || legacy.recurrence === "monthly" || legacy.recurrence === "yearly" ? legacy.recurrence : "weekdays"
            : recurrenceMode === "lunar" ? "lunar-days" : recurrenceMode === "genesis" ? "pyata-days" : "none";
        const calendarMode: CalendarMode = ["profane", "sacred", "lunar"].includes(legacy.calendarMode ?? "")
          ? legacy.calendarMode as CalendarMode
          : "profane";
        const reminders = normalizeTaskReminders(legacy.reminders, legacy.reminderMinutes);
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
          reminders,
          reminderMinutes: legacyReminderMinutes(reminders),
          recurrence: legacy.recurrence ?? "none",
          recurrenceInterval: legacy.recurrenceInterval ?? 1,
          recurrenceMode,
          recurrencePattern,
          recurrenceDays: Array.isArray(legacy.recurrenceDays) ? legacy.recurrenceDays.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 30) : [],
          recurrenceStartDate: typeof legacy.recurrenceStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(legacy.recurrenceStartDate) ? legacy.recurrenceStartDate : null,
          recurrenceEndDate: typeof legacy.recurrenceEndDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(legacy.recurrenceEndDate) ? legacy.recurrenceEndDate : null,
          recurrenceMonths: Array.isArray(legacy.recurrenceMonths) ? legacy.recurrenceMonths.map(Number).filter((month) => Number.isInteger(month) && month >= 1 && month <= 72) : [],
          recurrencePyatas: Array.isArray(legacy.recurrencePyatas) ? legacy.recurrencePyatas.map(Number).filter((pyata) => Number.isInteger(pyata) && pyata >= 1 && pyata <= 6) : [],
          recurrenceSeriesId: typeof legacy.recurrenceSeriesId === "string" && legacy.recurrenceSeriesId ? legacy.recurrenceSeriesId : null,
          calendarMode,
          calendarNote: normalizeCalendarDateNote(legacy.calendarNote ?? "", calendarMode),
          syncToGoogle: legacy.syncToGoogle ?? true,
          syncAccountIds: Array.isArray(legacy.syncAccountIds) ? legacy.syncAccountIds : [],
          googleLinks: legacy.googleLinks ?? {},
          googleAccountId: legacy.googleAccountId ?? null,
          googleAccountEmail: legacy.googleAccountEmail ?? "",
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
              <span data-no-translate>{task.title}</span>
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

function profaneMonthDates(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => new Date(year, month, index + 1, 12));
}

function profaneMonthName(date: Date, short = false) {
  return new Intl.DateTimeFormat(runtimeLocale(), { month: short ? "short" : "long" })
    .format(date)
    .replace(/\.$/u, "");
}

function formatDateRange(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat(runtimeLocale(), { day: "numeric", month: "short", year: "numeric" });
  return `${formatter.format(start)} — ${formatter.format(end)}`;
}

function datesTaskCount(tasksByDate: Map<string, Task[]>, dates: Date[]) {
  return dates.reduce((count, date) => count + (tasksByDate.get(inputDate(date))?.length ?? 0), 0);
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
  const config = resolveRecurrenceConfig(task.dueDate, rawConfig);
  if (!config.enabled) {
    return [{
      ...task,
      recurrence: "none" as const,
      recurrenceInterval: 1,
      recurrenceMode: "none" as const,
      recurrencePattern: "none" as const,
      recurrenceDays: [],
      recurrenceStartDate: null,
      recurrenceEndDate: null,
      recurrenceMonths: [],
      recurrencePyatas: [],
      recurrenceSeriesId: null,
    }];
  }

  const dates = buildRecurrenceDates(task.dueDate, config);
  if (!task.googleTaskListId) {
    const dueDate = dates[0] ?? task.dueDate;
    const date = new Date(`${dueDate}T12:00:00`);
    const sacred = getSacredDate(date);
    return [{
      ...task,
      sacredYear: sacred.sacredYear,
      monthIndex: sacred.monthIndex,
      day: sacred.day,
      dueDate,
      endDate: shiftRangeEndDate(task.dueDate, task.endDate, dueDate),
      recurrence: "none" as const,
      recurrenceInterval: config.interval,
      recurrenceMode: config.mode,
      recurrencePattern: config.pattern,
      recurrenceDays: [...config.days],
      recurrenceStartDate: config.rangeStart || dueDate,
      recurrenceEndDate: config.rangeEnd,
      recurrenceMonths: [...config.months],
      recurrencePyatas: [...config.pyatas],
      recurrenceSeriesId: null,
      calendarNote: calendarDateNote(date, task.calendarMode),
    }];
  }
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
      recurrenceStartDate: config.rangeStart || task.dueDate,
      recurrenceEndDate: config.rangeEnd,
      recurrenceMonths: [...config.months],
      recurrencePyatas: [...config.pyatas],
      recurrenceSeriesId: seriesId,
      calendarNote: calendarDateNote(date, task.calendarMode),
      googleEventId: null,
      googleTaskId: null,
      googleLinks: {},
      updatedAt: timestamp() + index,
    };
  });
}

function taskRangeLabel(task: Task, mode: CalendarMode = "sacred") {
  const recurrenceDates = recurrenceDatesForTask(task);
  const firstDate = recurrenceDates[0] ?? task.dueDate;
  const lastDate = recurrenceDates.at(-1) ?? task.dueDate;
  const start = formatCalendarDate(new Date(`${firstDate}T12:00:00`), mode, true);
  if (recurrenceDates.length > 1) {
    const finish = formatCalendarDate(new Date(`${lastDate}T12:00:00`), mode, true);
    return `${start} — ${finish} · ${recurrenceDates.length} повторений${task.time ? ` · ${task.time}` : ""}`;
  }
  const endDate = task.endDate || task.dueDate;
  const end = endDate === task.dueDate
    ? ""
    : ` — ${formatCalendarDate(new Date(`${endDate}T12:00:00`), mode, true)}`;
  return `${start}${end}${task.time ? ` · ${task.time}` : ""}`;
}

function romanDay(monthIndex: number, day: number) {
  return monthIndex === 12 ? String(day) : ["I", "II", "III", "IIII", "V"][(day - 1) % 5];
}

function monthArtUrl(monthIndex: number) {
  return `${APP_BASE}/month-art-v4/month-${String(monthIndex + 1).padStart(2, "0")}.webp`;
}

function dayArtUrl(monthIndex: number, day: number) {
  const monthPart = String(monthIndex + 1).padStart(2, "0");
  const dayPart = String(day).padStart(2, "0");
  return `${APP_BASE}/day-art-v1/month-${monthPart}/day-${dayPart}.webp`;
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
    <time className="device-clock" dateTime={clock?.now.toISOString()} aria-label={clock ? `Время устройства: ${clock.now.toLocaleTimeString(runtimeLocale())}` : "Время устройства синхронизируется"}>
      <strong>{clock ? new Intl.DateTimeFormat(runtimeLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(clock.now) : "--:--:--"}</strong>
      <small>{clock ? `время устройства · ${clock.timezone}` : "синхронизация времени"}</small>
    </time>
  );
}

export function GenesisCalendar() {
  const initial = useMemo(() => getSacredDate(new Date()), []);
  const [language, setLanguage] = useState<Language>(browserLanguage);
  const [today, setToday] = useState(() => new Date());
  const [view, setView] = useState<ViewName>("today");
  const [sacredYear, setSacredYear] = useState(initial.sacredYear);
  const [monthIndex, setMonthIndex] = useState(initial.monthIndex);
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [dayDetailsOpen, setDayDetailsOpen] = useState(false);
  const [dayTaskCreatorOpen, setDayTaskCreatorOpen] = useState(false);
  const [dayDetailsOrigin, setDayDetailsOrigin] = useState<DayDetailsOrigin>("calendar");
  const [openDayTaskPopover, setOpenDayTaskPopover] = useState("");
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
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  const [voiceLaunchAnimating, setVoiceLaunchAnimating] = useState(false);
  const [geminiOpen, setGeminiOpen] = useState(false);
  const [geminiAvailable, setGeminiAvailable] = useState(false);
  const [legalPage] = useState<ReturnType<typeof currentLegalPage>>(() => currentLegalPage());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const [authError, setAuthError] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskEndDate, setTaskEndDate] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskProject, setTaskProject] = useState("");
  const [taskTaskListId, setTaskTaskListId] = useState("");
  const [taskNewListTitle, setTaskNewListTitle] = useState("");
  const [taskNewListAccountId, setTaskNewListAccountId] = useState("");
  const [taskTags, setTaskTags] = useState("");
  const [taskReminders, setTaskReminders] = useState<TaskReminder[]>([{ kind: "relative", minutes: 30 }]);
  const [taskRecurrenceConfig, setTaskRecurrenceConfig] = useState<RecurrenceConfig>(DEFAULT_RECURRENCE_CONFIG);
  const [taskDependsOn, setTaskDependsOn] = useState<string[]>([]);
  const [taskPriority, setTaskPriority] = useState("5");
  const [taskSyncAccountIds, setTaskSyncAccountIds] = useState<string[] | null>(null);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectParent, setNewProjectParent] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState(DEFAULT_CATEGORIES[0].id);
  const [newProjectTags, setNewProjectTags] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [newTaskListTitle, setNewTaskListTitle] = useState("");
  const [newTaskListProject, setNewTaskListProject] = useState("");
  const [newTaskListAccountId, setNewTaskListAccountId] = useState("");
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
  const [editingTaskList, setEditingTaskList] = useState<GoogleTaskList | null>(null);
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
  const { androidApkUrl, canInstall, install, isStandalone } = usePwaInstall();
  useDocumentLanguage(language);

  useEffect(() => {
    const timer = window.setTimeout(() => setAuthError(consumeGoogleAuthError()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!voiceLaunchAnimating) return;
    const timer = window.setTimeout(() => {
      setVoiceLaunchAnimating(false);
      setVoiceAssistantOpen(true);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [voiceLaunchAnimating]);

  const openVoiceAssistant = () => {
    if (voiceLaunchAnimating) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVoiceAssistantOpen(true);
      return;
    }
    setVoiceLaunchAnimating(true);
  };

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
  const activeCalendarMode: CalendarMode = cloudUser?.calendarMode ?? "sacred";
  const activeTaskCalendarMode: CalendarMode = cloudUser?.taskCalendarMode ?? "sacred";
  const googleAccounts = cloudUser?.googleAccounts ?? [];
  const defaultSyncAccountIds = cloudUser?.syncRouting?.defaultAccountIds?.length
    ? cloudUser.syncRouting.defaultAccountIds
    : cloudUser ? [cloudUser.uid] : [];
  const effectiveTaskSyncAccountIds = taskSyncAccountIds ?? defaultSyncAccountIds;
  const syncAccountIdsForTask = (categoryId: string | null, taskList?: GoogleTaskList) => {
    if (taskList?.accountId) return [taskList.accountId];
    if (cloudUser?.syncRouting?.mode === "category" && categoryId) {
      const mapped = cloudUser.syncRouting.categoryAccountIds[categoryId] ?? [];
      if (mapped.length) return mapped;
    }
    return cloudUser?.syncRouting?.mode === "choose" ? effectiveTaskSyncAccountIds : defaultSyncAccountIds;
  };
  const selectedDate = useMemo(
    () => getGregorianDate(sacredYear, monthIndex, selectedDay),
    [sacredYear, monthIndex, selectedDay],
  );
  const selectedLunarYear = useMemo(() => getLunarYearForDate(selectedDate), [selectedDate]);
  const selectedLunarMonthIndex = lunarMonthIndex(selectedDate);
  const selectedLunarMonthOrdinal = selectedLunarMonthIndex - selectedLunarYear.startMonthIndex + 1;
  const todayDateValue = inputDate(today);
  const selectedDateValue = inputDate(selectedDate);
  const newTaskDueDate = taskDueDate || (view === "today" || view === "all-tasks" ? todayDateValue : selectedDateValue);
  const newTaskEndDate = taskEndDate || newTaskDueDate;
  const selectedMonth = MONTHS[monthIndex];
  const selectedSacredDay = getSacredDay(monthIndex, selectedDay);
  const selectedMoon = getMoon(selectedDate);
  const selectedLunarDate = getLunarDate(selectedDate);
  const selectedWeekdayPatron = PROFANE_WEEKDAY_PATRONS[selectedDate.getDay()];
  const selectedElement = getDayElement(monthIndex, selectedDay);
  const selectedPythagorean = getPythagorean(monthIndex, selectedDay);
  const selectedSolarEvent = getSolarEvent(sacredYear, monthIndex, selectedDay);
  const selectedDisplayMonthName = activeCalendarMode === "sacred"
    ? selectedMonth.name
    : activeCalendarMode === "profane"
      ? profaneMonthName(selectedDate)
      : getLunarMonthDefinition(selectedLunarMonthOrdinal).name;
  const tasksByDate = useMemo(() => {
    const occurrences = new Map<string, Task[]>();
    tasks.forEach((task) => {
      recurrenceDatesForTask(task).forEach((dateValue) => {
        const current = occurrences.get(dateValue);
        if (current) current.push(task);
        else occurrences.set(dateValue, [task]);
      });
    });
    return occurrences;
  }, [tasks]);
  const selectedDayTasks = [...(tasksByDate.get(selectedDateValue) ?? [])]
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
  const taskListsForWorkspace = taskLists.filter((taskList) => (
    !taskList.isDefault
    || tasks.some((task) => task.googleTaskListId === taskList.id)
    || Boolean(linkedProjectId(taskList.id))
  ));
  const resolvedTaskProjectId = (task: Task) => (
    task.projectId === TASK_INBOX_PROJECT_ID ? null : task.projectId ?? linkedProjectId(task.googleTaskListId)
  );
  const resolvedTaskProject = (task: Task) => {
    const projectId = resolvedTaskProjectId(task);
    return projects.find((project) => project.id === projectId) ?? null;
  };
  const resolvedTaskProjectTitle = (task: Task) => resolvedTaskProject(task)?.title ?? task.project;

  const selectCalendarDate = (date: Date) => {
    const sacred = getSacredDate(date);
    setSacredYear(sacred.sacredYear);
    setMonthIndex(sacred.monthIndex);
    setSelectedDay(sacred.day);
    setOpenDayTaskPopover("");
  };

  const openCalendarDate = (date: Date, origin: DayDetailsOrigin) => {
    selectCalendarDate(date);
    setDayDetailsOrigin(origin);
    setDayDetailsOpen(true);
  };

  const beginSelectedDayTask = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate(selectedDateValue);
    setTaskEndDate(selectedDateValue);
    setTaskTime("");
    setTaskTags("");
    setTaskDependsOn([]);
    setTaskPriority("5");
    setTaskSyncAccountIds(null);
    setTaskRecurrenceConfig(alignRecurrenceConfigWithCalendar(DEFAULT_RECURRENCE_CONFIG, activeTaskCalendarMode, selectedDateValue));
    setDayDetailsOpen(false);
    setDayTaskCreatorOpen(true);
  };

  const closeSelectedDayTaskCreator = () => {
    setDayTaskCreatorOpen(false);
    setDayDetailsOpen(true);
  };

  const navigateTo = (nextView: ViewName, replace = false) => {
    setOpenDayTaskPopover("");
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
    if (!dayDetailsOpen && !dayTaskCreatorOpen) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (dayTaskCreatorOpen) {
        setDayTaskCreatorOpen(false);
        setDayDetailsOpen(true);
      } else {
        setDayDetailsOpen(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [dayDetailsOpen, dayTaskCreatorOpen]);

  useEffect(() => {
    if (!openDayTaskPopover) return;
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".calendar-day-task-control")) {
        setOpenDayTaskPopover("");
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenDayTaskPopover("");
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [openDayTaskPopover]);

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
      setSyncError("");

      if (!user) {
        setCloudUser(null);
        stopTasks?.();
        stopTasks = undefined;
        loadedUserId = "";
        setSyncStatus("local");
        return;
      }
      const serverLanguage = normalizeLanguage(user.language);
      const pendingLanguageValue = localStorage.getItem(LANGUAGE_LOGIN_PENDING_KEY);
      const pendingLanguage = pendingLanguageValue === "ru" || pendingLanguageValue === "en" ? pendingLanguageValue : null;
      const effectiveLanguage = pendingLanguage ?? serverLanguage;
      const effectiveUser = { ...user, language: effectiveLanguage };
      setLanguage(effectiveLanguage);
      storeLanguage(effectiveLanguage);
      setCloudUser(effectiveUser);
      localStorage.setItem(LAST_USER_KEY, JSON.stringify(effectiveUser));
      if (pendingLanguage) {
        localStorage.removeItem(LANGUAGE_LOGIN_PENDING_KEY);
        if (pendingLanguage !== serverLanguage) {
          void updateAccountPreferences({ language: pendingLanguage })
            .then((result) => {
              if (!active) return;
              setCloudUser(result.user);
              localStorage.setItem(LAST_USER_KEY, JSON.stringify(result.user));
            })
            .catch((error: Error) => {
              if (!active) return;
              setSyncError(error.message);
            });
        }
      }
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
          setSyncStatus(workspace.user.calendarConnected ? (workspace.syncWarning ? "offline" : "synced") : "local");
          if (workspace.user.calendarConnected) {
            stopTasks = observeCloudTasks(
              user.uid,
              (cloudTasks, cloudTaskLists, fromCache, warning) => {
                if (!active) return;
                const visibleTasks = warning
                  ? Array.from(new Map([...tasksRef.current, ...cloudTasks].map((task) => [task.id, task])).values())
                  : cloudTasks;
                tasksRef.current = visibleTasks;
                setTasks(visibleTasks);
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
          }
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
          const cachedLanguage = normalizeLanguage(cached.language);
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
          setLanguage(cachedLanguage);
          storeLanguage(cachedLanguage);
          setCloudUser({ ...cached, language: cachedLanguage });
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
    if (!cloudUser?.calendarConnected) return;
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
    if (!cloudUser?.calendarConnected || !series.length) return;
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
    setAuthError("");
    setSyncError("");
    setSyncStatus("syncing");
    storeLanguage(language);
    localStorage.setItem(LANGUAGE_LOGIN_PENDING_KEY, language);
    try {
      await signInWithGoogle();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось войти");
      setSyncStatus("error");
    }
  };

  const selectLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    storeLanguage(nextLanguage);
  };

  const handleGoogleConnect = async () => {
    setAuthError("");
    setSyncError("");
    setSyncStatus("syncing");
    try {
      await connectGoogleServices();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось подключить Google Calendar и Tasks");
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

  useEffect(() => {
    if (!cloudUser || !isGoogleSyncConfigured) return;
    let active = true;
    void loadGeminiStatus()
      .then((status) => {
        if (active) setGeminiAvailable(status.available);
      })
      .catch(() => {
        if (active) setGeminiAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [cloudUser]);

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
    let nextYear = sacredYear;
    let normalized = nextIndex;
    if (normalized < 0) {
      nextYear -= 1;
      normalized = 12;
    } else if (normalized > 12) {
      nextYear += 1;
      normalized = 0;
    }
    setSacredYear(nextYear);
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
      reminders: [],
      reminderMinutes: null,
      recurrence: "none",
      recurrenceInterval: 1,
      recurrenceMode: "none",
      recurrencePattern: "none",
      recurrenceDays: [],
      recurrenceStartDate: null,
      recurrenceEndDate: null,
      recurrenceMonths: [],
      recurrencePyatas: [],
      recurrenceSeriesId: null,
      calendarMode: activeTaskCalendarMode,
      calendarNote: calendarDateNote(dueDate, activeTaskCalendarMode),
      syncToGoogle: true,
      syncAccountIds: taskList.accountId ? [taskList.accountId] : defaultSyncAccountIds,
      googleLinks: {},
      googleAccountId: taskList.accountId ?? null,
      googleAccountEmail: taskList.accountEmail ?? "",
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
    const recurrenceDates = taskRecurrenceConfig.enabled
      ? buildRecurrenceDates(newTaskDueDate, taskRecurrenceConfig)
      : [newTaskDueDate];
    if (taskRecurrenceConfig.enabled && recurrenceDates.length === 0) {
      setSyncError("В выбранном периоде нет дат, подходящих под правило повторения.");
      setSyncStatus("error");
      return;
    }
    if (recurrenceDates.length > MAX_RECURRENCE_OCCURRENCES) {
      setSyncError(`Серия может содержать не более ${MAX_RECURRENCE_OCCURRENCES} повторений. Сократите период или выберите меньше дат.`);
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
        const result = await createGoogleTaskList(listTitle, taskNewListAccountId || effectiveTaskSyncAccountIds[0] || defaultSyncAccountIds[0]);
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
        setTaskNewListAccountId("");
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
      reminders: taskReminders,
      reminderMinutes: legacyReminderMinutes(taskReminders),
      recurrence: "none",
      recurrenceInterval: taskRecurrenceConfig.enabled ? taskRecurrenceConfig.interval : 1,
      recurrenceMode: taskRecurrenceConfig.enabled ? taskRecurrenceConfig.mode : "none",
      recurrencePattern: taskRecurrenceConfig.enabled ? taskRecurrenceConfig.pattern : "none",
      recurrenceDays: taskRecurrenceConfig.enabled ? [...taskRecurrenceConfig.days] : [],
      recurrenceStartDate: taskRecurrenceConfig.enabled ? taskRecurrenceConfig.rangeStart || newTaskDueDate : null,
      recurrenceEndDate: taskRecurrenceConfig.enabled ? taskRecurrenceConfig.rangeEnd || null : null,
      recurrenceMonths: taskRecurrenceConfig.enabled ? [...taskRecurrenceConfig.months] : [],
      recurrencePyatas: taskRecurrenceConfig.enabled ? [...taskRecurrenceConfig.pyatas] : [],
      recurrenceSeriesId: null,
      calendarMode: activeTaskCalendarMode,
      calendarNote: calendarDateNote(dueDate, activeTaskCalendarMode),
      syncToGoogle: true,
      syncAccountIds: syncAccountIdsForTask(selectedProject?.categoryId ?? null, selectedTaskList),
      googleLinks: {},
      googleAccountId: selectedTaskList?.accountId ?? null,
      googleAccountEmail: selectedTaskList?.accountEmail ?? "",
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
    setTaskReminders([{ kind: "relative", minutes: 30 }]);
    setTaskDependsOn([]);
    setTaskPriority("5");
    setTaskSyncAccountIds(null);
    setTaskRecurrenceConfig(alignRecurrenceConfigWithCalendar(DEFAULT_RECURRENCE_CONFIG, activeTaskCalendarMode, todayDateValue));
    if (dayTaskCreatorOpen) {
      setDayTaskCreatorOpen(false);
      setDayDetailsOpen(true);
    }
  };

  const openTaskEditor = (task: Task) => {
    setEditingTask({ ...task, tags: [...task.tags], dependsOnIds: [...task.dependsOnIds], reminders: [...task.reminders] });
    setEditingTaskTags(task.tags.join(", "));
  };

  const persistTaskChange = (original: Task, nextTask: Task) => {
    setTasks((current) => current.map((task) => task.id === nextTask.id ? nextTask : task));
    const destinationChanged = original.googleTaskListId !== nextTask.googleTaskListId;
    const hasRemoteSource = Boolean(original.googleTaskId || original.googleEventId || Object.keys(original.googleLinks ?? {}).length);
    if (!cloudUser?.calendarConnected || !destinationChanged || !hasRemoteSource) {
      saveTask(nextTask);
      return;
    }

    const recreatedTask: Task = {
      ...nextTask,
      googleEventId: null,
      googleTaskId: null,
      googleLinks: {},
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
    const recurrenceConfig = recurrenceConfigFromTask(editingTask);
    const taskDraft = !editingTask.googleTaskListId && !editingTask.recurrenceSeriesId && recurrenceConfig.enabled
      ? buildTaskSeries(editingTask, recurrenceConfig)[0] ?? editingTask
      : editingTask;
    const title = taskDraft.title.trim();
    if (!original || !title) return;
    if (taskDraft.dueDate < todayDateValue && taskDraft.dueDate !== original.dueDate) {
      setSyncError("Нельзя переносить задачу на дату в прошлом.");
      setSyncStatus("error");
      return;
    }
    if ((taskDraft.endDate || taskDraft.dueDate) < taskDraft.dueDate) {
      setSyncError("Срок выполнения не может быть раньше даты начала.");
      setSyncStatus("error");
      return;
    }
    const dueDate = new Date(`${taskDraft.dueDate}T12:00:00`);
    if (Number.isNaN(dueDate.getTime())) return;
    const sacred = getSacredDate(dueDate);
    const selectedProject = projects.find((project) => project.id === taskDraft.projectId);
    const selectedTaskList = taskLists.find((taskList) => taskList.id === taskDraft.googleTaskListId);
    const keepInInbox = taskDraft.projectId === TASK_INBOX_PROJECT_ID;
    const nextTask: Task = {
      ...taskDraft,
      title,
      description: taskDraft.description.trim(),
      sacredYear: sacred.sacredYear,
      monthIndex: sacred.monthIndex,
      day: sacred.day,
      project: selectedProject?.title ?? "",
      projectId: keepInInbox ? TASK_INBOX_PROJECT_ID : selectedProject?.id ?? null,
      categoryId: selectedProject?.categoryId ?? null,
      calendarMode: activeTaskCalendarMode,
      calendarNote: calendarDateNote(dueDate, activeTaskCalendarMode),
      tags: editingTaskTags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10),
      googleTaskListId: selectedTaskList?.id ?? null,
      googleTaskListTitle: selectedTaskList?.title ?? "",
      googleAccountId: selectedTaskList?.accountId ?? taskDraft.googleAccountId,
      googleAccountEmail: selectedTaskList?.accountEmail ?? taskDraft.googleAccountEmail,
      syncAccountIds: selectedTaskList?.accountId ? [selectedTaskList.accountId] : taskDraft.syncAccountIds,
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
      reminders: [],
      reminderMinutes: null,
      recurrence: "none",
      recurrenceInterval: 1,
      recurrenceMode: "none",
      recurrencePattern: "none",
      recurrenceDays: [],
      recurrenceStartDate: null,
      recurrenceEndDate: null,
      recurrenceMonths: [],
      recurrencePyatas: [],
      recurrenceSeriesId: null,
      googleTaskListId: taskList.id,
      googleTaskListTitle: taskList.title,
      googleAccountId: taskList.accountId ?? null,
      googleAccountEmail: taskList.accountEmail ?? "",
      syncAccountIds: taskList.accountId ? [taskList.accountId] : task.syncAccountIds,
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
            calendarNote: calendarDateNote(nextDate, currentTask.calendarMode),
            done: false,
            completedAt: null,
            googleEventId: null,
            googleTaskId: null,
            googleLinks: {},
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
    if (cloudUser?.calendarConnected && taskToDelete) {
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
      const { taskList } = await createGoogleTaskList(title, newTaskListAccountId || defaultSyncAccountIds[0]);
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
      setNewTaskListAccountId("");
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

  const saveTaskListEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTaskList) return;
    const title = editingTaskList.title.trim();
    if (!title) return;
    setSyncStatus("syncing");
    try {
      const { taskList } = await updateGoogleTaskList(editingTaskList.id, title, editingTaskList.accountId);
      setTaskLists((current) => current.map((item) => item.id === taskList.id
        ? { ...taskList, isDefault: item.isDefault || taskList.isDefault }
        : item));
      setTasks((current) => current.map((task) => task.googleTaskListId === taskList.id
        ? { ...task, googleTaskListTitle: taskList.title }
        : task));
      setEditingTaskList(null);
      setSyncStatus("synced");
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось переименовать список Google Tasks");
      setSyncStatus(navigator.onLine ? "error" : "offline");
    }
  };

  const deleteTaskList = async (taskList: GoogleTaskList) => {
    if (taskList.isDefault) {
      setSyncError("Основной список Google Tasks нельзя удалить. Пока он пуст и не привязан к проекту, GENESIS скрывает его автоматически.");
      return;
    }
    const listTaskCount = tasks.filter((task) => task.googleTaskListId === taskList.id).length;
    const taskCountLabel = listTaskCount === 1 ? "1 задачей" : `${listTaskCount} задачами`;
    if (!window.confirm(translateText(`Удалить список «${taskList.title}» вместе с ${taskCountLabel}? Он будет удалён из Google Tasks. Это действие нельзя отменить.`, undefined, true))) return;
    setSyncStatus("syncing");
    try {
      await removeGoogleTaskList(taskList.id, taskList.accountId);
      const nextTasks = tasks.filter((task) => task.googleTaskListId !== taskList.id);
      const nextLinks = taskListLinks.filter((link) => link.taskListId !== taskList.id);
      setTasks(nextTasks);
      setTaskLists((current) => current.filter((item) => item.id !== taskList.id));
      setTaskListLinks(nextLinks);
      setTaskTaskListId((current) => current === taskList.id ? "" : current);
      setTaskListBatchTitles((current) => {
        const next = { ...current };
        delete next[taskList.id];
        return next;
      });
      setTaskListBatchDates((current) => {
        const next = { ...current };
        delete next[taskList.id];
        return next;
      });
      if (editingTask?.googleTaskListId === taskList.id) setEditingTask(null);
      if (editingTaskList?.id === taskList.id) setEditingTaskList(null);
      persistStructure(projects, categories, nextLinks);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось удалить список Google Tasks");
      setSyncStatus(navigator.onLine ? "error" : "offline");
    }
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

  const applyAssistantPlan = async (plan: GeminiPlan): Promise<string> => {
    const nameKey = (value: string) => value.trim().toLocaleLowerCase(runtimeLocale());
    const isValidDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T12:00:00`);
      return !Number.isNaN(parsed.getTime()) && inputDate(parsed) === value;
    };

    const preparedTasks = plan.tasks.map((task) => {
      const startDate = task.startDate || todayDateValue;
      const dueDate = task.dueDate || startDate;
      if (!isValidDate(startDate) || !isValidDate(dueDate)) {
        throw new Error(language === "en" ? `The assistant returned an invalid date for “${task.title}”.` : `Помощник указал некорректную дату для задачи «${task.title}».`);
      }
      if (startDate < todayDateValue) {
        throw new Error(language === "en" ? `The start date for “${task.title}” is in the past.` : `Дата начала задачи «${task.title}» находится в прошлом.`);
      }
      if (dueDate < startDate) {
        throw new Error(language === "en" ? `The deadline for “${task.title}” is before its start date.` : `Срок задачи «${task.title}» раньше даты начала.`);
      }
      return { ...task, startDate, dueDate };
    });

    const categoryByName = new Map(categories.map((category) => [nameKey(category.name), category]));
    const existingProjectByName = new Map(projects.map((project) => [nameKey(project.title), project]));
    const newProjectPlanByName = new Map(plan.projects.map((project) => [nameKey(project.title), project]));
    for (const projectPlan of plan.projects) {
      if (projectPlan.category && !categoryByName.has(nameKey(projectPlan.category))) {
        throw new Error(language === "en" ? `Category “${projectPlan.category}” was not found.` : `Категория «${projectPlan.category}» не найдена.`);
      }
      if (projectPlan.parentProject
        && !existingProjectByName.has(nameKey(projectPlan.parentProject))
        && !newProjectPlanByName.has(nameKey(projectPlan.parentProject))) {
        throw new Error(language === "en" ? `Parent project “${projectPlan.parentProject}” was not found.` : `Родительский проект «${projectPlan.parentProject}» не найден.`);
      }
    }
    for (const projectPlan of plan.projects) {
      const path = new Set<string>();
      let cursor = nameKey(projectPlan.title);
      while (cursor && newProjectPlanByName.has(cursor)) {
        if (path.has(cursor)) {
          throw new Error(language === "en" ? "The assistant proposed a circular project hierarchy." : "Помощник предложил циклическую иерархию проектов.");
        }
        path.add(cursor);
        cursor = nameKey(newProjectPlanByName.get(cursor)?.parentProject ?? "");
      }
    }
    const provisionalProjects: GenesisProject[] = [];
    for (const projectPlan of plan.projects) {
      const key = nameKey(projectPlan.title);
      if (!key || existingProjectByName.has(key) || provisionalProjects.some((project) => nameKey(project.title) === key)) continue;
      provisionalProjects.push({
        id: uid(),
        parentId: null,
        categoryId: categoryByName.get(nameKey(projectPlan.category))?.id ?? null,
        title: projectPlan.title.trim(),
        description: projectPlan.description.trim(),
        tags: projectPlan.tags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10),
        status: "active",
        position: projects.length + provisionalProjects.length,
      });
    }
    const allProjectByName = new Map([...projects, ...provisionalProjects].map((project) => [nameKey(project.title), project]));
    const createdProjects = provisionalProjects.map((project) => {
      const source = newProjectPlanByName.get(nameKey(project.title));
      const parent = source?.parentProject ? allProjectByName.get(nameKey(source.parentProject)) : null;
      return { ...project, parentId: parent && parent.id !== project.id ? parent.id : null };
    });
    const nextProjects = [...projects, ...createdProjects];
    const projectByName = new Map(nextProjects.map((project) => [nameKey(project.title), project]));

    for (const task of preparedTasks) {
      if (task.project && !projectByName.has(nameKey(task.project))) {
        throw new Error(language === "en" ? `Project “${task.project}” was not found.` : `Проект «${task.project}» не найден.`);
      }
    }

    const plannedListByName = new Map(plan.taskLists.map((taskList) => [nameKey(taskList.title), taskList]));
    const knownListNames = new Set([...taskLists.map((taskList) => nameKey(taskList.title)), ...plannedListByName.keys()]);
    for (const task of preparedTasks) {
      if (task.taskList && !knownListNames.has(nameKey(task.taskList))) {
        throw new Error(language === "en" ? `Google Tasks list “${task.taskList}” was not found.` : `Список Google Tasks «${task.taskList}» не найден.`);
      }
    }
    for (const taskList of plan.taskLists) {
      if (taskList.project && !projectByName.has(nameKey(taskList.project))) {
        throw new Error(language === "en" ? `Project “${taskList.project}” was not found.` : `Проект «${taskList.project}» не найден.`);
      }
      if (taskList.accountEmail && !googleAccounts.some((account) => nameKey(account.email) === nameKey(taskList.accountEmail))) {
        throw new Error(language === "en" ? `Google account “${taskList.accountEmail}” is not connected.` : `Google-аккаунт «${taskList.accountEmail}» не подключён.`);
      }
    }
    const needsNewTaskLists = plan.taskLists.some((planned) => !taskLists.some((existing) => nameKey(existing.title) === nameKey(planned.title)));
    if (needsNewTaskLists && !cloudUser?.calendarConnected) {
      throw new Error(language === "en" ? "Connect Google Calendar and Tasks before creating a task list." : "Подключите Google Calendar и Tasks перед созданием списка задач.");
    }

    setSyncStatus("syncing");
    let nextTaskLists = [...taskLists];
    let nextTaskListLinks = [...taskListLinks];
    let createdTaskListCount = 0;
    for (const taskListPlan of plan.taskLists) {
      let taskList = nextTaskLists.find((item) => nameKey(item.title) === nameKey(taskListPlan.title));
      if (!taskList) {
        const accountId = googleAccounts.find((account) => nameKey(account.email) === nameKey(taskListPlan.accountEmail))?.id
          || defaultSyncAccountIds[0];
        const result = await createGoogleTaskList(taskListPlan.title.trim(), accountId);
        taskList = result.taskList;
        nextTaskLists = [...nextTaskLists.filter((item) => item.id !== taskList?.id), taskList];
        createdTaskListCount += 1;
      }
      const currentProjectId = nextTaskListLinks.find((link) => link.taskListId === taskList.id)?.projectId ?? null;
      const projectId = taskListPlan.project ? projectByName.get(nameKey(taskListPlan.project))?.id ?? null : currentProjectId;
      nextTaskListLinks = [
        ...nextTaskListLinks.filter((link) => link.taskListId !== taskList.id),
        { taskListId: taskList.id, projectId },
      ];
    }

    const taskListByName = new Map(nextTaskLists.map((taskList) => [nameKey(taskList.title), taskList]));
    const createdTasks: Task[] = preparedTasks.map((taskPlan) => {
      const start = new Date(`${taskPlan.startDate}T12:00:00`);
      const sacred = getSacredDate(start);
      const project = taskPlan.project ? projectByName.get(nameKey(taskPlan.project)) ?? null : null;
      const taskList = taskPlan.taskList ? taskListByName.get(nameKey(taskPlan.taskList)) : undefined;
      return {
        id: uid(),
        sacredYear: sacred.sacredYear,
        monthIndex: sacred.monthIndex,
        day: sacred.day,
        dueDate: taskPlan.startDate,
        endDate: taskPlan.dueDate,
        title: taskPlan.title.trim(),
        description: taskPlan.description.trim(),
        time: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(taskPlan.time) ? taskPlan.time : "",
        project: project?.title ?? "",
        projectId: project?.id ?? null,
        categoryId: project?.categoryId ?? null,
        tags: taskPlan.tags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 6),
        dependsOnIds: [],
        priority: Math.min(10, Math.max(1, Number(taskPlan.priority) || 5)),
        done: false,
        completedAt: null,
        reminders: taskPlan.reminderMinutes > 0 ? [{ kind: "relative" as const, minutes: Math.min(40_320, taskPlan.reminderMinutes) }] : [],
        reminderMinutes: taskPlan.reminderMinutes > 0 ? Math.min(40_320, taskPlan.reminderMinutes) : null,
        recurrence: "none",
        recurrenceInterval: 1,
        recurrenceMode: "none",
        recurrencePattern: "none",
        recurrenceDays: [],
        recurrenceStartDate: null,
        recurrenceEndDate: null,
        recurrenceMonths: [],
        recurrencePyatas: [],
        recurrenceSeriesId: null,
        calendarMode: activeTaskCalendarMode,
        calendarNote: calendarDateNote(start, activeTaskCalendarMode),
        syncToGoogle: true,
        syncAccountIds: syncAccountIdsForTask(project?.categoryId ?? null, taskList),
        googleLinks: {},
        googleAccountId: taskList?.accountId ?? null,
        googleAccountEmail: taskList?.accountEmail ?? "",
        createdIn: "genesis",
        googleEventId: null,
        googleTaskId: null,
        googleTaskListId: taskList?.id ?? null,
        googleTaskListTitle: taskList?.title ?? "",
        googleReadOnly: false,
        updatedAt: timestamp(),
      };
    });

    setProjects(nextProjects);
    setTaskLists(nextTaskLists);
    setTaskListLinks(nextTaskListLinks);
    if (createdTasks.length) {
      setTasks((current) => [...current, ...createdTasks]);
      if (createdTasks.length === 1) saveTask(createdTasks[0]);
      else saveTaskSeries(createdTasks);
    }
    if (createdProjects.length || plan.taskLists.length) {
      persistStructure(nextProjects, categories, nextTaskListLinks);
    } else if (!createdTasks.length) {
      setSyncStatus("synced");
    }

    if (createdTasks.length) navigateTo("all-tasks");
    else if (createdProjects.length || plan.taskLists.length) navigateTo("projects");

    return language === "en"
      ? `Created: ${createdProjects.length} projects, ${createdTaskListCount} task lists, ${createdTasks.length} tasks.`
      : `Создано: проектов — ${createdProjects.length}, списков — ${createdTaskListCount}, задач — ${createdTasks.length}.`;
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
    if (!category || !window.confirm(translateText(`Удалить категорию «${category.name}»? Проекты и задачи останутся, но будут перенесены в раздел «Без категории».`, undefined, true))) return;
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
    if (!project || !window.confirm(translateText(`Удалить проект «${project.title}» и все его подпроекты? Задачи останутся, но перейдут в раздел без проекта.`, undefined, true))) return;
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
          {taskListsForWorkspace.length ? (
            <section className="task-list-workspace" aria-label="Существующие списки задач">
              <header>
                <div>
                  <span className="eyebrow">Рабочий стол</span>
                  <h3>Существующие списки</h3>
                </div>
                <small>Перетаскивайте задачи между колонками или выбирайте список в меню задачи.</small>
              </header>
              <div className="task-list-board">
                {taskListsForWorkspace.map((taskList) => {
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
                        <div className="task-list-column-heading">
                          <span><strong data-no-translate>{taskList.title}</strong><small>{listTasks.length} задач{taskList.accountEmail ? ` · ${taskList.accountEmail}` : ""}</small></span>
                          <span className="task-list-column-actions">
                            <button type="button" onClick={() => setEditingTaskList(taskList)} aria-label={`Редактировать список «${taskList.title}»`}>✎</button>
                            {!taskList.isDefault ? (
                              <button type="button" className="danger" onClick={() => void deleteTaskList(taskList)} aria-label={`Удалить список «${taskList.title}»`}>×</button>
                            ) : null}
                          </span>
                        </div>
                        {taskList.isDefault ? <span className="task-list-default-badge">Основной список Google · удалить нельзя</span> : null}
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
                              <strong data-no-translate>{task.title}</strong>
                              <small>{taskRangeLabel(task, activeTaskCalendarMode)}</small>
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
                          <CalendarDatePicker
                            mode={activeTaskCalendarMode}
                            min={todayDateValue}
                            value={taskListBatchDates[taskList.id] || todayDateValue}
                            onChange={(nextDate) => setTaskListBatchDates((current) => ({ ...current, [taskList.id]: nextDate }))}
                            ariaLabel={`Срок новых задач в списке «${taskList.title}»`}
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
            {googleAccounts.length > 1 ? (
              <label htmlFor={`${context}-new-task-list-account`}>Google-аккаунт</label>
            ) : null}
            {googleAccounts.length > 1 ? (
              <select id={`${context}-new-task-list-account`} value={newTaskListAccountId || defaultSyncAccountIds[0] || ""} onChange={(event) => setNewTaskListAccountId(event.target.value)}>
                {googleAccounts.map((account) => <option value={account.id} key={account.id}>{account.email}{account.isPrimary ? " · основной" : ""}</option>)}
              </select>
            ) : null}
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
                  <CalendarDatePicker mode={activeTaskCalendarMode} min={todayDateValue} value={draft.dueDate || todayDateValue} onChange={(nextDate) => updateNewTaskListDraft(draft.id, { dueDate: nextDate })} ariaLabel={`Срок задачи ${index + 1}`} />
                  <button type="button" onClick={() => setNewTaskListDrafts((current) => current.length === 1 ? [{ ...current[0], title: "", dueDate: "" }] : current.filter((item) => item.id !== draft.id))} aria-label={`Удалить задачу ${index + 1}`}>×</button>
                </div>
              ))}
              <button type="button" className="text-button task-list-add-draft" onClick={() => setNewTaskListDrafts((current) => [...current, { id: uid(), title: "", dueDate: "" }])}>＋ Ещё задача</button>
            </fieldset>
            <button type="submit" className="primary-button" disabled={!newTaskListTitle.trim()}>Создать список</button>
          </form>
        </>
      ) : (
        <button type="button" className="primary-button" onClick={() => void handleGoogleConnect()}>Подключить Google Tasks</button>
      )}
    </div>
  );

  const renderTaskCreateForm = (context: "today" | "all-tasks" | "day-details") => {
    const selectedTaskList = taskLists.find((taskList) => taskList.id === taskTaskListId);
    const createsTaskList = taskTaskListId === CREATE_NEW_TASK_LIST_ID;
    const dueDateIsPast = newTaskDueDate < todayDateValue;
    const rangeIsInvalid = newTaskEndDate < newTaskDueDate;
    const recurrenceOccurrenceCount = taskRecurrenceConfig.enabled
      ? buildRecurrenceDates(newTaskDueDate, taskRecurrenceConfig).length
      : 1;
    const recurrenceIsInvalid = recurrenceOccurrenceCount === 0 || recurrenceOccurrenceCount > MAX_RECURRENCE_OCCURRENCES;
    const syncAccountsInvalid = Boolean(cloudUser?.multiAccountEnabled && cloudUser.syncRouting.mode === "choose" && !selectedTaskList && !createsTaskList && effectiveTaskSyncAccountIds.length === 0);
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
          <label htmlFor={`${context}-task-start-date`}>
            <span>Начало</span>
            <CalendarDatePicker id={`${context}-task-start-date`} mode={activeTaskCalendarMode} min={todayDateValue} value={newTaskDueDate} onChange={(nextDate) => {
              setTaskDueDate(nextDate);
              setTaskEndDate((current) => !current || current < nextDate ? nextDate : current);
            }} required />
          </label>
          <label htmlFor={`${context}-task-end-date`}>
            <span>Срок выполнения</span>
            <CalendarDatePicker id={`${context}-task-end-date`} mode={activeTaskCalendarMode} min={newTaskDueDate} value={newTaskEndDate} onChange={setTaskEndDate} required />
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
                setTaskReminders([]);
              }
            }}>
              <option value="">Google Calendar</option>
              {taskLists.map((taskList) => <option value={taskList.id} key={`${taskList.accountId ?? "primary"}-${taskList.id}`}>Google Tasks · {taskList.title}{taskList.accountEmail ? ` · ${taskList.accountEmail}` : ""}</option>)}
              <option value={CREATE_NEW_TASK_LIST_ID}>＋ Начать новый список задач</option>
            </select>
          </label>
        </div>
        {createsTaskList ? (
          <div className="task-form-new-list">
            <label>
              <span>Название нового списка</span>
              <input value={taskNewListTitle} onChange={(event) => setTaskNewListTitle(event.target.value)} placeholder="Например, подготовка события" required />
            </label>
            {googleAccounts.length > 1 ? (
              <label>
                <span>Google-аккаунт списка</span>
                <select value={taskNewListAccountId || effectiveTaskSyncAccountIds[0] || defaultSyncAccountIds[0] || ""} onChange={(event) => setTaskNewListAccountId(event.target.value)}>
                  {googleAccounts.map((account) => <option value={account.id} key={account.id}>{account.email}{account.isPrimary ? " · основной" : ""}</option>)}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
        <RecurrenceBuilder
          value={taskRecurrenceConfig}
          onChange={setTaskRecurrenceConfig}
          startDate={newTaskDueDate}
          destination={taskTaskListId ? "tasks" : "calendar"}
          calendarMode={activeTaskCalendarMode}
        />
        <div className="task-form-section task-form-settings" aria-label="Настройки задачи">
          <TaskReminderPicker
            value={taskReminders}
            onChange={setTaskReminders}
            taskDate={newTaskDueDate}
            taskTime={taskTime}
            calendarMode={activeTaskCalendarMode}
            disabled={Boolean(taskTaskListId)}
          />
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
        {cloudUser?.multiAccountEnabled && cloudUser.syncRouting.mode === "choose" && !selectedTaskList && !createsTaskList && googleAccounts.length > 1 ? (
          <fieldset className="task-sync-account-picker">
            <legend>Синхронизировать эту задачу</legend>
            {googleAccounts.map((account) => (
              <label key={account.id}>
                <input
                  type="checkbox"
                  checked={effectiveTaskSyncAccountIds.includes(account.id)}
                  onChange={(event) => setTaskSyncAccountIds((current) => {
                    const base = current ?? defaultSyncAccountIds;
                    return event.target.checked
                      ? Array.from(new Set([...base, account.id]))
                      : base.filter((id) => id !== account.id);
                  })}
                />
                <span>{account.email}{account.isPrimary ? " · основной" : ""}</span>
              </label>
            ))}
            <small>Можно выбрать один или несколько аккаунтов.</small>
          </fieldset>
        ) : null}
        <div className="sync-checkbox sync-always-on">
          <span aria-hidden="true">✓</span>
          <span>{createsTaskList
            ? taskRecurrenceConfig.enabled
              ? `Сначала будет создан список «${taskNewListTitle.trim() || "без названия"}», затем в нём появится серия из ${recurrenceOccurrenceCount} задач`
              : `Сначала будет создан список «${taskNewListTitle.trim() || "без названия"}», затем задача появится внутри него`
            : selectedTaskList
            ? taskRecurrenceConfig.enabled
              ? `${recurrenceOccurrenceCount} задач по выбранным датам попадут в список «${selectedTaskList.title}» Google Tasks`
              : `Срок завершения попадёт в список «${selectedTaskList.title}» Google Tasks, начало сохранится в данных GENESIS`
            : taskRecurrenceConfig.enabled
            ? `${taskRecurrenceConfig.mode === "classic" ? "Григорианская" : taskRecurrenceConfig.mode === "lunar" ? "Лунная" : "Сакральная"} серия из ${recurrenceOccurrenceCount} повторений будет сохранена одной задачей в GENESIS и одним событием в Google Calendar`
            : "Задача будет синхронизирована с Google Calendar в часовом поясе этого устройства"}</span>
        </div>
        <button type="submit" className="add-task-button" disabled={!taskTitle.trim() || !newTaskDueDate || !newTaskEndDate || dueDateIsPast || rangeIsInvalid || recurrenceIsInvalid || syncAccountsInvalid || (createsTaskList && !taskNewListTitle.trim())}>
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
    const lunar = getLunarDate(gregorian);
    const weekdayPatron = PROFANE_WEEKDAY_PATRONS[gregorian.getDay()];
    const gregorianWeekdayRaw = new Intl.DateTimeFormat(runtimeLocale(), { weekday: "long" }).format(gregorian);
    const gregorianWeekday = `${gregorianWeekdayRaw.charAt(0).toLocaleUpperCase(runtimeLocale())}${gregorianWeekdayRaw.slice(1)}`;
    const gregorianMonth = profaneMonthName(gregorian);
    const gregorianDateTitle = new Intl.DateTimeFormat(runtimeLocale(), {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(gregorian);
    const gregorianMonthLength = new Date(gregorian.getFullYear(), gregorian.getMonth() + 1, 0).getDate();
    const gregorianYearLength = new Date(gregorian.getFullYear(), 1, 29).getMonth() === 1 ? 366 : 365;
    const gregorianDayOfYear = Math.floor((Date.UTC(gregorian.getFullYear(), gregorian.getMonth(), gregorian.getDate()) - Date.UTC(gregorian.getFullYear(), 0, 0)) / 86_400_000);
    const gregorianWeek = (() => {
      const normalized = new Date(Date.UTC(gregorian.getFullYear(), gregorian.getMonth(), gregorian.getDate()));
      normalized.setUTCDate(normalized.getUTCDate() + 4 - (normalized.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1));
      return Math.ceil((((normalized.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
    })();
    const element = getDayElement(info.monthIndex, info.day);
    const pythagorean = getPythagorean(info.monthIndex, info.day);
    const solarEvent = getSolarEvent(info.sacredYear, info.monthIndex, info.day);
    const solarCopy = solarEvent ? SOLAR_EVENT_COPY[solarEvent.id] : null;
    const isNewMoonDay = moon.event.toLocaleLowerCase().includes("новолуние");
    const dayTitleMatch = day.name.match(/^(.*?)\s*(\([^()]+\))$/u);
    const sacredTitlePrimary = dayTitleMatch?.[1] ?? day.name;
    const sacredTitleTranslation = dayTitleMatch?.[2] ?? "";
    const heroTitlePrimary = activeCalendarMode === "lunar"
      ? `${lunar.day} лунный день`
      : activeCalendarMode === "profane"
        ? gregorianWeekday
        : sacredTitlePrimary;
    const heroTitleTranslation = activeCalendarMode === "lunar"
      ? (lunar.isThreshold ? "Рубеж лунного месяца" : lunar.decade.name)
      : activeCalendarMode === "profane"
        ? gregorianDateTitle
        : sacredTitleTranslation;
    const dayTitleTranslationSize = heroTitleTranslation
      ? `clamp(16px, ${Math.min(8.2, 164 / heroTitleTranslation.length)}cqw, 44px)`
      : undefined;
    const heroEyebrow = activeCalendarMode === "lunar"
      ? `Лунный календарь · ${lunar.month.roman} месяц`
      : activeCalendarMode === "profane"
        ? `Григорианский календарь · ${gregorian.getFullYear()} год`
        : `${month.season} · ${month.roman} месяц`;
    const heroMonth = activeCalendarMode === "lunar" ? lunar.month.name : activeCalendarMode === "profane" ? gregorianMonth : month.name;
    const heroDescription = activeCalendarMode === "lunar"
      ? `${moon.direction}. ${moon.phase}, освещённость ${moon.illumination}%. ${lunar.month.description}`
      : activeCalendarMode === "profane"
        ? `${weekdayPatron.patronage}. ${gregorianMonth} содержит ${gregorianMonthLength} дней; сегодня ${gregorianDayOfYear}-й день ${gregorian.getFullYear()} года.`
        : day.description;

    return (
      <div className="today-view">
        <section className={`hero-card mode-${activeCalendarMode}`} aria-labelledby="today-title">
          <div className="hero-copy">
            <div className="eyebrow-row">
              <span className="eyebrow">{heroEyebrow}</span>
              {activeCalendarMode === "lunar" ? (
                <span className="event-badge lunar-event-badge"><MoonPhaseIcon phaseStep={moon.phaseStep} size={14} /> {moon.event || moon.epithet}</span>
              ) : solarEvent ? <span className="event-badge solar-event-badge"><b aria-hidden="true">{solarEvent.symbol}</b> {solarEvent.name}</span> : null}
            </div>
            <p className="hero-month">{heroMonth}</p>
            <h1 id="today-title">
              <span className="hero-day-title-primary">{heroTitlePrimary}</span>
              {heroTitleTranslation ? (
                <span className="hero-day-title-translation" style={{ fontSize: dayTitleTranslationSize }}>{heroTitleTranslation}</span>
              ) : null}
            </h1>
            <p className="hero-description">{heroDescription}</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={openSelectedInCalendar}>
                Открыть день <span aria-hidden="true">↗</span>
              </button>
              <span className="hero-date">{activeCalendarMode === "profane" ? formatCalendarDate(gregorian, "sacred") : formatGregorian(gregorian, true)}</span>
            </div>
          </div>
          <div className="hero-number" aria-hidden="true">
            {activeCalendarMode === "lunar" ? (
              <MoonPhaseIcon phaseStep={moon.phaseStep} size={68} className="hero-mode-moon" />
            ) : (
              <span>{activeCalendarMode === "profane" ? gregorian.getDate() : romanDay(info.monthIndex, info.day)}</span>
            )}
            <small>{activeCalendarMode === "lunar" ? moon.phase : activeCalendarMode === "profane" ? weekdayPatron.weekday : info.monthIndex === 12 ? "вне времени" : `${day.pyata} пята`}</small>
          </div>
          <DeviceClock />
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
                  <h2>Сегодня {translateText(solarEvent.name).toLocaleLowerCase(runtimeLocale())}</h2>
                  <p><strong>Сила дня.</strong> {solarCopy.force}</p>
                  <p><strong>Древняя Греция.</strong> {solarCopy.greekPractice}</p>
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        <div className={`today-lower-grid mode-${activeCalendarMode}`}>
          <section className={`meaning-panel today-mode-panel mode-${activeCalendarMode}`} aria-labelledby="rhythm-title">
            <div className="section-heading compact-heading">
              <div>
                <span className="eyebrow">{activeCalendarMode === "lunar" ? "Лунный день" : activeCalendarMode === "profane" ? "Григорианский день" : "Смысл дня"}</span>
                <h2 id="rhythm-title">{activeCalendarMode === "lunar" ? "Ритм Луны сегодня" : activeCalendarMode === "profane" ? "Дата в гражданском календаре" : "Три ритма в одной точке"}</h2>
              </div>
              <span className="ornament" aria-hidden="true">{activeCalendarMode === "lunar" ? "☾" : activeCalendarMode === "profane" ? <CronusSickleIcon size={24} /> : "✣"}</span>
            </div>
            <div className="meaning-grid">
              {activeCalendarMode === "lunar" ? (
                <>
                  <article className="meaning-card">
                    <span className="meaning-symbol meaning-moon-symbol" aria-hidden="true"><MoonPhaseIcon phaseStep={moon.phaseStep} size={34} /></span>
                    <span className="meaning-label">{lunar.day} лунный день</span>
                    <strong>{moon.phase}</strong>
                    <p>{moon.direction} · освещённость {moon.illumination}%</p>
                  </article>
                  <article className="meaning-card">
                    <span className="meaning-symbol" aria-hidden="true">{lunar.month.roman}</span>
                    <span className="meaning-label">Лунный месяц</span>
                    <strong>{lunar.month.name}</strong>
                    <p>{lunar.month.title}</p>
                  </article>
                  <article className="meaning-card">
                    <span className="meaning-symbol" aria-hidden="true">{lunar.isThreshold ? "○" : "≈"}</span>
                    <span className="meaning-label">Ритм месяца</span>
                    <strong>{lunar.isThreshold ? "Рубеж" : lunar.decade.name}</strong>
                    <p>{lunar.decade.range} · {lunar.monthLength} дней в месяце</p>
                  </article>
                </>
              ) : activeCalendarMode === "profane" ? (
                <>
                  <article className="meaning-card">
                    <span className="meaning-symbol meaning-sickle-symbol" aria-hidden="true"><CronusSickleIcon size={34} /></span>
                    <span className="meaning-label">День недели</span>
                    <strong>{weekdayPatron.weekday}</strong>
                    <p>{weekdayPatron.patronage}</p>
                  </article>
                  <article className="meaning-card">
                    <span className="meaning-symbol" aria-hidden="true">{gregorian.getDate()}</span>
                    <span className="meaning-label">Дата</span>
                    <strong>{gregorianMonth} {gregorian.getFullYear()}</strong>
                    <p>{gregorianMonthLength} дней в этом месяце</p>
                  </article>
                  <article className="meaning-card">
                    <span className="meaning-symbol" aria-hidden="true">{gregorianWeek}</span>
                    <span className="meaning-label">Неделя года</span>
                    <strong>{gregorianDayOfYear}-й день</strong>
                    <p>{gregorianDayOfYear} из {gregorianYearLength} дней года</p>
                  </article>
                </>
              ) : (
                <>
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
                </>
              )}
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

  const renderModeCalendarDay = (date: Date, mode: Exclude<CalendarMode, "sacred">, layoutIndex: number) => {
    const dateValue = inputDate(date);
    const sacred = getSacredDate(date);
    const sacredDay = getSacredDay(sacred.monthIndex, sacred.day);
    const moon = getMoon(date);
    const lunar = getLunarDate(date);
    const solarEvent = getSolarEvent(sacred.sacredYear, sacred.monthIndex, sacred.day);
    const cellTasks = [...(tasksByDate.get(dateValue) ?? [])]
      .sort((a, b) => a.time.localeCompare(b.time));
    const taskCount = cellTasks.length;
    const isToday = dateValue === todayDateValue;
    const isSelected = dateValue === selectedDateValue;
    const weekdayIndex = date.getDay();
    const isSaturday = weekdayIndex === 6;
    const sunriseSunset = deviceLocation ? getSunriseSunset(date, deviceLocation) : null;
    const solarTimePlaceholder = solarLocationStatus === "ready" ? "нет" : "…";
    const sunrise = sunriseSunset ? formatDeviceSolarTime(sunriseSunset.sunrise, deviceTimeZone) : solarTimePlaceholder;
    const sunset = sunriseSunset ? formatDeviceSolarTime(sunriseSunset.sunset, deviceTimeZone) : solarTimePlaceholder;
    const popoverOpen = openDayTaskPopover === dateValue;
    const columnCount = mode === "profane" ? 7 : 6;
    const column = layoutIndex % columnCount;
    const popoverAlignment = column < 2 ? "align-left" : column >= columnCount - 2 ? "align-right" : "align-center";
    const weekday = new Intl.DateTimeFormat(runtimeLocale(), { weekday: "short" }).format(date).replace(/\.$/u, "");
    const weekdayPatron = PROFANE_WEEKDAY_PATRONS[date.getDay()];
    const profaneDate = new Intl.DateTimeFormat(runtimeLocale(), { day: "numeric", month: "short" }).format(date);

    return (
      <article
        className={`calendar-day calendar-mode-day mode-${mode}${mode === "profane" ? ` weekday-${weekdayIndex}` : ""}${isSelected ? " selected" : ""}${isToday ? " today" : ""}${isSaturday ? " saturday" : ""}${solarEvent ? " solar-day" : ""}${taskCount ? " has-tasks" : ""}${popoverOpen ? " popover-open" : ""}`}
        key={dateValue}
      >
        <button
          type="button"
          className="calendar-day-open"
          onClick={() => openCalendarDate(date, "calendar")}
          aria-pressed={isSelected}
          aria-label={`${formatCalendarDate(date, mode, true)}${mode === "profane" ? ` — ${weekdayPatron.weekday}, ${weekdayPatron.patronage}` : ""} — ${sacredDay.name} — ${moon.day} лунный день${taskCount ? ` — ${taskCount} задач` : ""}`}
        />
        <span className="calendar-mode-primary">
          {mode === "lunar" ? <MoonPhaseIcon phaseStep={moon.phaseStep} size={26} /> : null}
          <strong>{mode === "lunar" ? moon.day : date.getDate()}</strong>
          <small>{mode === "lunar" && lunar.isThreshold ? "Рубеж" : mode === "lunar" ? moon.phase : weekday}</small>
        </span>
        {mode === "profane" ? (
          <span className="profane-weekday-patron">
            <strong>{weekdayPatron.weekday}</strong>
            <small>{weekdayPatron.patronage}</small>
          </span>
        ) : null}
        <span className="calendar-cross-date profane-date">
          <CronusSickleIcon size={12} />{mode === "profane" ? `${profaneDate} · ${date.getFullYear()}` : profaneDate}
        </span>
        <span className="calendar-cross-date sacred-date" title={sacredDay.name}>
          <b aria-hidden="true">✦</b>{formatCalendarDate(date, "sacred")}
        </span>
        {mode === "profane" ? (
          <span className="calendar-cross-date lunar-date" title={moon.phase}>
            <MoonPhaseIcon phaseStep={moon.phaseStep} size={15} />{moon.day} лунный день
          </span>
        ) : (
          <span className="calendar-cross-date lunar-date"><b aria-hidden="true">☾</b>{moon.epithet} · {moon.illumination}%</span>
        )}
        {solarEvent ? <span className="calendar-solar-mark" title={solarEvent.name}><b aria-hidden="true">{solarEvent.symbol}</b><em>{solarEvent.shortName}</em></span> : null}
        <span
          className="calendar-sun-times"
          aria-label={`Рассвет ${sunrise}, закат ${sunset}`}
          title={sunriseSunset ? "Рассвет и закат по времени устройства" : "Синхронизируем время рассвета и заката"}
        >
          <span><i aria-hidden="true">↗</i>{sunrise}</span>
          <span><i aria-hidden="true">↘</i>{sunset}</span>
        </span>
        {taskCount ? (
          <div
            className="calendar-day-task-control"
            onPointerEnter={(event) => { if (event.pointerType === "mouse") setOpenDayTaskPopover(dateValue); }}
            onPointerLeave={(event) => { if (event.pointerType === "mouse") setOpenDayTaskPopover((current) => current === dateValue ? "" : current); }}
            onFocus={() => setOpenDayTaskPopover(dateValue)}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget;
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                setOpenDayTaskPopover((current) => current === dateValue ? "" : current);
              }
            }}
          >
            <button
              type="button"
              className="calendar-day-task-count"
              onClick={() => {
                selectCalendarDate(date);
                setOpenDayTaskPopover(dateValue);
              }}
              aria-label={`Показать задачи на ${formatGregorian(date, true)}: ${taskCount}`}
              aria-expanded={popoverOpen}
              aria-controls={`calendar-task-popover-${dateValue}`}
              aria-haspopup="dialog"
            >
              {taskCount}
            </button>
            {popoverOpen ? (
              <div className={`calendar-task-popover ${popoverAlignment}`} id={`calendar-task-popover-${dateValue}`} role="dialog" aria-label={`Задачи на ${formatGregorian(date, true)}`}>
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
                        <span data-no-translate>{task.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {taskCount > 6 ? <small>Ещё {taskCount - 6}</small> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  };

  const renderSacredCalendar = () => {
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
                  {row.map((dayNumber, dayColumn) => {
                    const gregorian = getGregorianDate(sacredYear, monthIndex, dayNumber);
                    const moon = getMoon(gregorian);
                    const sacredDay = getSacredDay(monthIndex, dayNumber);
                    const key = taskDateKey(sacredYear, monthIndex, dayNumber);
                    const gregorianDateValue = inputDate(gregorian);
                    const cellTasks = [...(tasksByDate.get(gregorianDateValue) ?? [])]
                      .sort((a, b) => a.time.localeCompare(b.time));
                    const taskCount = cellTasks.length;
                    const isToday = key === todayKey;
                    const isSelected = dayNumber === selectedDay;
                    const isSaturday = gregorian.getDay() === 6;
                    const profaneWeekday = new Intl.DateTimeFormat(runtimeLocale(), { weekday: "long" }).format(gregorian);
                    const profaneWeekdayShort = new Intl.DateTimeFormat(runtimeLocale(), { weekday: "short" }).format(gregorian).replace(/\.$/, "");
                    const profaneDate = new Intl.DateTimeFormat(runtimeLocale(), { day: "2-digit", month: "short" }).format(gregorian);
                    const solarEvent = getSolarEvent(sacredYear, monthIndex, dayNumber);
                    const sunriseSunset = deviceLocation ? getSunriseSunset(gregorian, deviceLocation) : null;
                    const solarTimePlaceholder = solarLocationStatus === "ready" ? "нет" : "…";
                    const sunrise = sunriseSunset ? formatDeviceSolarTime(sunriseSunset.sunrise, deviceTimeZone) : solarTimePlaceholder;
                    const sunset = sunriseSunset ? formatDeviceSolarTime(sunriseSunset.sunset, deviceTimeZone) : solarTimePlaceholder;
                    const popoverOpen = openDayTaskPopover === key;
                    const popoverAlignment = dayColumn < 2 ? "align-left" : dayColumn > 2 ? "align-right" : "align-center";
                    return (
                      <article
                        key={dayNumber}
                        className={`calendar-day${isSelected ? " selected" : ""}${isToday ? " today" : ""}${isSaturday ? " saturday" : ""}${solarEvent ? " solar-day" : ""}${taskCount ? " has-tasks" : ""}${popoverOpen ? " popover-open" : ""}`}
                      >
                        <button
                          type="button"
                          className="calendar-day-open"
                          onClick={() => {
                            setOpenDayTaskPopover("");
                            setSelectedDay(dayNumber);
                            setDayDetailsOrigin("calendar");
                            setDayDetailsOpen(true);
                          }}
                          aria-pressed={isSelected}
                          aria-label={`${formatGregorian(gregorian, true)} — ${sacredDay.name}${solarEvent ? ` — ${solarEvent.name}` : ""}${taskCount ? ` — ${taskCount} задач` : ""}`}
                        />
                        <span className="calendar-gregorian">
                          <b className="calendar-weekday">
                            <span className="calendar-weekday-full">{profaneWeekday}</span>
                            <span className="calendar-weekday-short">{profaneWeekdayShort}</span>
                          </b>
                          <span>{profaneDate}</span>
                        </span>
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
                          <div
                            className="calendar-day-task-control"
                            onPointerEnter={(event) => {
                              if (event.pointerType === "mouse") setOpenDayTaskPopover(key);
                            }}
                            onPointerLeave={(event) => {
                              if (event.pointerType === "mouse") {
                                setOpenDayTaskPopover((current) => current === key ? "" : current);
                              }
                            }}
                            onFocus={() => setOpenDayTaskPopover(key)}
                            onBlur={(event) => {
                              const nextTarget = event.relatedTarget;
                              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                                setOpenDayTaskPopover((current) => current === key ? "" : current);
                              }
                            }}
                          >
                            <button
                              type="button"
                              className="calendar-day-task-count"
                              onClick={() => {
                                setSelectedDay(dayNumber);
                                setOpenDayTaskPopover(key);
                              }}
                              aria-label={`Показать задачи на ${formatGregorian(gregorian, true)}: ${taskCount}`}
                              aria-expanded={popoverOpen}
                              aria-controls={`calendar-task-popover-${monthIndex}-${dayNumber}`}
                              aria-haspopup="dialog"
                            >
                              {taskCount}
                            </button>
                            {popoverOpen ? (
                              <div
                                className={`calendar-task-popover ${popoverAlignment}`}
                                id={`calendar-task-popover-${monthIndex}-${dayNumber}`}
                                role="dialog"
                                aria-label={`Задачи на ${formatGregorian(gregorian, true)}`}
                              >
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
                                        <span data-no-translate>{task.title}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                                {taskCount > 6 ? <small>Ещё {taskCount - 6}</small> : null}
                              </div>
                            ) : null}
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

      </div>
    );
  };

  const renderAlternativeCalendar = (mode: Exclude<CalendarMode, "sacred">) => {
    const lunarDates = mode === "lunar" ? getLunarMonthDates(selectedLunarMonthIndex) : [];
    const dates = mode === "profane" ? profaneMonthDates(selectedDate) : lunarDates;
    const representativeDate = dates[Math.floor(dates.length / 2)] ?? selectedDate;
    const representativeSacred = getSacredDate(representativeDate);
    const accentMonth = MONTHS[representativeSacred.monthIndex];
    const firstDate = dates[0] ?? selectedDate;
    const lastDate = dates.at(-1) ?? selectedDate;
    const lunarOrdinal = selectedLunarMonthIndex - selectedLunarYear.startMonthIndex + 1;
    const lunarDefinition = getLunarMonthDefinition(lunarOrdinal);
    const monthTitle = mode === "profane" ? profaneMonthName(selectedDate) : lunarDefinition.name;
    const monthEyebrow = mode === "profane"
      ? `Григорианский календарь · ${selectedDate.getFullYear()} год`
      : `Лунный год ${selectedLunarYear.sacredYear}–${selectedLunarYear.sacredYear + 1} · ${lunarDefinition.roman} месяц из ${selectedLunarYear.monthCount}`;
    const monthSubtitle = mode === "profane"
      ? `${profaneMonthName(selectedDate)} · ${dates.length} дней`
      : `${lunarDefinition.title} · ${formatDateRange(firstDate, lastDate)}`;
    const monthDescription = mode === "profane"
      ? "Григорианский календарный месяц с неделями с воскресенья по субботу. В каждом дне дополнительно показаны покровители дня, сакральная дата, лунные сутки, рассвет и закат."
      : lunarDefinition.description;
    const leadingDays = mode === "profane" ? firstDate.getDay() : 0;
    const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(2024, 0, 7 + index, 12);
      return new Intl.DateTimeFormat(runtimeLocale(), { weekday: "short" }).format(day).replace(/\.$/u, "");
    });
    const moveMonth = (delta: number) => {
      if (mode === "profane") {
        selectCalendarDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + delta, 1, 12));
        return;
      }
      selectCalendarDate(getLunarMonthStart(selectedLunarMonthIndex + delta));
    };

    return (
      <div
        className={`calendar-view calendar-mode-view mode-${mode}`}
        style={{
          "--month-accent": accentMonth.color,
        } as CSSProperties}
      >
        <header className="calendar-header calendar-mode-header">
          <div>
            <span className="eyebrow">{monthEyebrow}</span>
            <h1>{monthTitle}</h1>
            <p className="calendar-title">{monthSubtitle}</p>
            <p>{monthDescription}</p>
            <div className={`calendar-solar-control status-${solarLocationStatus}`} aria-live="polite">
              <div><span aria-hidden="true">☀</span><strong>{solarLocationStatus === "ready" ? "Рассвет и закат · время устройства" : "Синхронизируем рассвет и закат…"}</strong></div>
              <small>{solarLocationStatus === "ready" ? `${deviceTimeZone} · автоматический расчёт для региона устройства` : "Определяем регион автоматически, без запроса геопозиции"}</small>
            </div>
          </div>
          <div className="month-switcher" aria-label={mode === "profane" ? "Переключение календарных месяцев" : "Переключение лунных месяцев"}>
            <button type="button" onClick={() => moveMonth(-1)} aria-label={mode === "profane" ? "Предыдущий календарный месяц" : "Предыдущий лунный месяц"}>←</button>
            <span aria-hidden="true">{mode === "profane" ? <CronusSickleIcon size={35} /> : "☾"}</span>
            <button type="button" onClick={() => moveMonth(1)} aria-label={mode === "profane" ? "Следующий календарный месяц" : "Следующий лунный месяц"}>→</button>
          </div>
        </header>

        <section className={`month-calendar calendar-mode-calendar mode-${mode}`} aria-label={`${CALENDAR_MODE_META[mode].label}: ${monthTitle}`}>
          {mode === "profane" ? (
            <div className="calendar-mode-weekdays" aria-hidden="true">
              {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
            </div>
          ) : (
            <div className="lunar-month-rule">
              <MoonPhaseIcon phaseStep={getMoon(firstDate).phaseStep} size={28} />
              <span><strong>Новолуние открывает месяц</strong><small>{formatGregorian(firstDate, true)}</small></span>
              <i>{dates.length} лунных суток</i>
            </div>
          )}
          {mode === "profane" ? (
            <div className="calendar-mode-days">
              {Array.from({ length: leadingDays }, (_, index) => <span className="calendar-mode-blank" aria-hidden="true" key={`blank-${index}`} />)}
              {dates.map((date, index) => renderModeCalendarDay(date, mode, leadingDays + index))}
            </div>
          ) : (
            <div className="lunar-decades">
              {LUNAR_DECADES.map((decade) => {
                const decadeDates = dates.filter((date) => getLunarDate(date).decade.id === decade.id);
                return (
                  <section className={`lunar-decade decade-${decade.id}`} aria-labelledby={`lunar-decade-${decade.id}`} key={decade.id}>
                    <header>
                      <span aria-hidden="true">{decade.id === "growth" ? "☽" : decade.id === "fullness" ? "○" : "☾"}</span>
                      <div><strong id={`lunar-decade-${decade.id}`}>{decade.name}</strong><small>{decade.range}</small></div>
                    </header>
                    <div className="calendar-mode-days">
                      {decadeDates.map((date, index) => renderModeCalendarDay(date, mode, index))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderCalendar = () => activeCalendarMode === "sacred"
    ? renderSacredCalendar()
    : renderAlternativeCalendar(activeCalendarMode);

  const renderProjects = () => {
    const searchTerms = tagSearch
      .toLocaleLowerCase(runtimeLocale())
      .split(/[\s,;#]+/)
      .map((term) => term.trim())
      .filter(Boolean);
    const tagsMatch = (tags: string[]) => !searchTerms.length || searchTerms.every((term) => (
      tags.some((tag) => tag.toLocaleLowerCase(runtimeLocale()).includes(term))
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
    const inboxTaskLists = taskListsForWorkspace.filter((taskList) => !linkedProjectId(taskList.id));
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
                  <span>Проект</span><strong data-no-translate>{project.title}</strong><small data-no-translate>{project.tags.map((tag) => `#${tag}`).join(" ")}</small>
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
                        <span><strong data-no-translate>{taskList.title}</strong><small>Список · {taskCount} задач</small></span>
                      </article>
                    );
                  })}
                  {inboxTasks.map((task) => {
                    const item: ProjectDragItem = { kind: "task", id: task.id, title: task.title };
                    return (
                      <article className={`inbox-task-item project-draggable-item${task.done ? " done" : ""}`} key={task.id} aria-label={`Перетащить задачу «${task.title}»`} {...projectDragProps(item)}>
                        <span className="project-drag-handle" aria-hidden="true">⋮⋮</span>
                        <button type="button" onClick={() => {
                          if (!suppressProjectItemClickRef.current) openTaskEditor(task);
                        }}>
                          <strong data-no-translate>{task.title}</strong>
                          <small>{taskRangeLabel(task, activeTaskCalendarMode)}</small>
                        </button>
                        <button
                          type="button"
                          className="inbox-task-delete"
                          onPointerDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteTask(task.id);
                          }}
                          aria-label={`Удалить задачу «${task.title}»`}
                        >×</button>
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
                        <strong data-no-translate>{project.title}</strong>
                        <small>{category?.name ?? "Без категории"} · {finished}/{projectTasks.length} действий{projectTaskLists.length ? ` · ${projectTaskLists.length} списков Google Tasks` : ""}</small>
                        {project.description ? <p data-no-translate>{project.description}</p> : null}
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
                              <span><strong data-no-translate>{taskList.title}</strong><small>Список · {taskCount} задач</small></span>
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
                              }}><strong data-no-translate>{task.title}</strong><small>{taskRangeLabel(task, activeTaskCalendarMode)}</small></button>
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
                    <strong data-no-translate>{category.name}</strong>
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
      .toLocaleLowerCase(runtimeLocale())
      .split(/[\s,;#]+/)
      .map((term) => term.trim())
      .filter(Boolean);
    const taskMatches = (task: Task) => {
      if (allTasksStatusFilter === "active" && task.done) return false;
      if (allTasksStatusFilter === "done" && !task.done) return false;
      if (!searchTerms.length) return true;
      const haystack = [task.title, task.description, task.calendarNote, resolvedTaskProjectTitle(task), task.googleTaskListTitle, ...task.tags]
        .join(" ")
        .toLocaleLowerCase(runtimeLocale());
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
            <input value={allTasksSearch} onChange={(event) => setAllTasksSearch(event.target.value)} placeholder="Поиск по названию, описанию, проекту или тегу" />
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
            const lastOccurrenceDate = recurrenceDatesForTask(task).at(-1) ?? task.endDate ?? task.dueDate;
            const isOverdue = !task.done && lastOccurrenceDate < todayDateValue;
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
                    <strong data-no-translate>{task.title}</strong>
                    <span className="all-task-priority" title="Приоритет">⚑{task.priority}</span>
                  </div>
                  <div className="all-task-meta">
                    <span>{taskRangeLabel(task, activeTaskCalendarMode)}</span>
                    <span>{resolvedTaskProjectTitle(task) || "Без проекта"}</span>
                    {task.googleTaskListTitle ? <span>Список: {task.googleTaskListTitle}</span> : null}
                    {task.syncAccountIds.length > 1 ? <span>Google-аккаунты: {task.syncAccountIds.length}</span> : task.googleAccountEmail ? <span>{task.googleAccountEmail}</span> : null}
                    {category ? <span className="all-task-category" data-no-translate style={{ "--project-color": category.color } as CSSProperties}>{category.name}</span> : null}
                    <span className={`all-task-source source-${source.className}`}>{source.label}</span>
                  </div>
                  {task.tags.length ? <div className="task-tags">{task.tags.map((tag) => <i key={tag}>#{tag}</i>)}</div> : null}
                  {dependencyNames.length ? <div className="task-dependency">↳ после: {dependencyNames.join(", ")}</div> : null}
                  {task.description || task.calendarNote ? (
                    <details className="task-description-viewer">
                      <summary>Описание задачи</summary>
                      {task.description ? <p data-no-translate>{task.description}</p> : <p className="muted">Описание не добавлено.</p>}
                      {task.calendarNote ? <pre>{task.calendarNote}</pre> : null}
                    </details>
                  ) : null}
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

  const renderSacredYear = () => (
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
          const weekday = new Intl.DateTimeFormat(runtimeLocale(), { weekday: "long" }).format(event.date);
          const date = new Intl.DateTimeFormat(runtimeLocale(), { day: "numeric", month: "long", year: "numeric" }).format(event.date);
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
          const monthTaskCount = Array.from({ length: availableDays }, (_, index) => (
            tasksByDate.get(inputDate(getGregorianDate(sacredYear, month.index, index + 1)))?.length ?? 0
          )).reduce((total, count) => total + count, 0);
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
                        const taskCount = tasksByDate.get(inputDate(getGregorianDate(sacredYear, month.index, dayNumber)))?.length ?? 0;
                        const hasTask = taskCount > 0;
                        const todayDot = key === todayKey;
                        const solarDot = Boolean(getSolarEvent(sacredYear, month.index, dayNumber));
                        const isYearSaturday = getGregorianDate(sacredYear, month.index, dayNumber).getDay() === 6;
                        const sacredDay = getSacredDay(month.index, dayNumber);
                        return (
                          <button
                            type="button"
                            className={`mini-day${hasTask ? " has-task" : ""}${todayDot ? " today" : ""}${solarDot ? " solar" : ""}${isYearSaturday ? " saturday" : ""}`}
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

  const renderAlternativeYear = (mode: Exclude<CalendarMode, "sacred">) => {
    const profaneYear = selectedDate.getFullYear();
    const lunarYear = selectedLunarYear;
    const yearMonths: AlternativeYearMonth[] = mode === "profane"
      ? Array.from({ length: 12 }, (_, month) => {
          const dates = profaneMonthDates(new Date(profaneYear, month, 1, 12));
          const representative = dates[Math.floor(dates.length / 2)];
          const accentMonth = MONTHS[getSacredDate(representative).monthIndex];
          return {
            id: `profane-${profaneYear}-${month}`,
            title: profaneMonthName(representative),
            subtitle: `${dates.length} дней · ${profaneYear} год`,
            ordinal: String(month + 1).padStart(2, "0"),
            symbol: "",
            dates,
            accentMonth,
          };
        })
      : Array.from({ length: lunarYear.monthCount }, (_, offset) => {
          const absoluteIndex = lunarYear.startMonthIndex + offset;
          const dates = getLunarMonthDates(absoluteIndex);
          const representative = dates[Math.floor(dates.length / 2)] ?? getLunarMonthStart(absoluteIndex);
          const accentMonth = MONTHS[getSacredDate(representative).monthIndex];
          const lunarDefinition = getLunarMonthDefinition(offset + 1);
          return {
            id: `lunar-${lunarYear.sacredYear}-${absoluteIndex}`,
            title: lunarDefinition.name,
            subtitle: `${lunarDefinition.title} · ${formatDateRange(dates[0] ?? representative, dates.at(-1) ?? representative)}`,
            ordinal: String(offset + 1).padStart(2, "0"),
            symbol: "☾",
            dates,
            accentMonth,
          };
        });
    const yearValue = mode === "profane" ? profaneYear : lunarYear.sacredYear;
    const yearSolarEvents = mode === "profane"
      ? getSolarEvents(yearValue)
      : [...getSolarEvents(lunarYear.sacredYear), ...getSolarEvents(lunarYear.sacredYear + 1)]
          .filter((event) => event.date >= lunarYear.startDate && event.date < lunarYear.endDate);
    const yearDayCount = mode === "profane"
      ? Math.round((Date.UTC(profaneYear + 1, 0, 1) - Date.UTC(profaneYear, 0, 1)) / 86_400_000)
      : Math.round((Date.UTC(lunarYear.endDate.getFullYear(), lunarYear.endDate.getMonth(), lunarYear.endDate.getDate()) - Date.UTC(lunarYear.startDate.getFullYear(), lunarYear.startDate.getMonth(), lunarYear.startDate.getDate())) / 86_400_000);
    const yearTitle = mode === "profane" ? `Григорианский год ${profaneYear}` : `Лунный год ${lunarYear.sacredYear}–${lunarYear.sacredYear + 1}`;
    const yearDescription = mode === "profane"
      ? "Григорианский календарь — это профанский календарь из двенадцати стандартных месяцев с января по декабрь. Откройте любой день, чтобы увидеть его сакральный смысл, лунные сутки, рассвет, закат и задачи."
      : `Год начинается ${formatGregorian(lunarYear.startDate, true)} — в день первого точного новолуния после весеннего равноденствия — и включает ${lunarYear.monthCount} лунных месяцев по 29 или 30 суток.`;
    const profaneWeekdayLabels = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(2024, 0, 7 + index, 12);
      return new Intl.DateTimeFormat(runtimeLocale(), { weekday: "short" }).format(day).replace(/\.$/u, "");
    });
    const changeYear = (delta: number) => {
      if (mode === "profane") {
        const targetYear = profaneYear + delta;
        const targetDay = Math.min(selectedDate.getDate(), new Date(targetYear, selectedDate.getMonth() + 1, 0).getDate());
        selectCalendarDate(new Date(targetYear, selectedDate.getMonth(), targetDay, 12));
        return;
      }
      const target = getLunarYear(lunarYear.sacredYear + delta);
      const currentOrdinal = selectedLunarMonthIndex - lunarYear.startMonthIndex;
      selectCalendarDate(getLunarMonthStart(target.startMonthIndex + Math.min(currentOrdinal, target.monthCount - 1)));
    };

    return (
      <div className={`year-view calendar-mode-year mode-${mode}`}>
        <header className="projects-header year-header">
          <div>
            <span className="eyebrow">{yearDayCount} дней · {yearMonths.length} месяцев</span>
            <h1>{yearTitle}</h1>
            <p>{yearDescription}</p>
          </div>
          <div className="year-switcher">
            <button type="button" onClick={() => changeYear(-1)} aria-label="Предыдущий год">←</button>
            <strong>{mode === "profane" ? profaneYear : `${lunarYear.sacredYear}–${lunarYear.sacredYear + 1}`}</strong>
            <button type="button" onClick={() => changeYear(1)} aria-label="Следующий год">→</button>
          </div>
        </header>
        <section className="solar-year-strip" aria-label="Солнцестояния и равноденствия года">
          {yearSolarEvents.map((event) => {
            const weekday = new Intl.DateTimeFormat(runtimeLocale(), { weekday: "long" }).format(event.date);
            const date = new Intl.DateTimeFormat(runtimeLocale(), { day: "numeric", month: "long", year: "numeric" }).format(event.date);
            return (
              <button type="button" key={event.id} onClick={() => openCalendarDate(event.date, "year")}>
                <span className="solar-glyph" aria-hidden="true"><i>{event.symbol}</i></span>
                <span><small>{event.kind === "equinox" ? "Равноденствие" : "Солнцестояние"}</small><em>{weekday}</em><strong>{date}</strong></span>
              </button>
            );
          })}
        </section>
        <section className="year-grid" aria-label={mode === "profane" ? "Двенадцать календарных месяцев" : "Лунные месяцы года"}>
          {yearMonths.map((month) => {
            const monthTaskCount = datesTaskCount(tasksByDate, month.dates);
            const containsToday = month.dates.some((date) => inputDate(date) === todayDateValue);
            const containsSelectedMonth = month.dates.some((date) => inputDate(date) === selectedDateValue);
            const leadingDays = mode === "profane" ? (month.dates[0]?.getDay() ?? 0) : 0;
            const openMonth = () => {
              const todayInMonth = month.dates.find((date) => inputDate(date) === todayDateValue);
              selectCalendarDate(todayInMonth ?? month.dates[0]);
              setDayDetailsOrigin("calendar");
              setDayDetailsOpen(false);
              navigateTo("calendar");
            };
            return (
              <article
                className={`year-month calendar-mode-year-month mode-${mode}${containsToday ? " current" : ""}${containsSelectedMonth ? " selected-period" : ""}`}
                key={month.id}
                aria-labelledby={`year-month-${month.id}`}
                style={{
                  "--month-accent": month.accentMonth.color,
                } as CSSProperties}
              >
                <span className="year-month-top"><i>{month.ordinal}</i><b>{mode === "profane" ? <CronusSickleIcon size={27} /> : month.symbol}</b></span>
                <strong id={`year-month-${month.id}`}>{month.title}</strong>
                <small>{month.subtitle}</small>
                <div className={`civil-mini-calendar mode-${mode}`}>
                  {mode === "profane" ? profaneWeekdayLabels.map((label, index) => <span className="civil-mini-weekday" key={`${month.id}-weekday-${index}`}>{label}</span>) : null}
                  {Array.from({ length: leadingDays }, (_, index) => <span className="civil-mini-blank" aria-hidden="true" key={`${month.id}-blank-${index}`} />)}
                  {month.dates.map((date) => {
                    const dateValue = inputDate(date);
                    const dayTasks = tasksByDate.get(dateValue)?.length ?? 0;
                    const moon = getMoon(date);
                    const sacred = getSacredDate(date);
                    const sacredDay = getSacredDay(sacred.monthIndex, sacred.day);
                    const solar = getSolarEvent(sacred.sacredYear, sacred.monthIndex, sacred.day);
                    const isSaturday = mode === "profane" && date.getDay() === 6;
                    const weekdayPatron = PROFANE_WEEKDAY_PATRONS[date.getDay()];
                    return (
                      <button
                        type="button"
                        className={`mini-day${dayTasks ? " has-task" : ""}${dateValue === todayDateValue ? " today" : ""}${solar ? " solar" : ""}${isSaturday ? " saturday" : ""}`}
                        key={dateValue}
                        onClick={() => openCalendarDate(date, "year")}
                        aria-label={`${formatCalendarDate(date, mode, true)}${mode === "profane" ? `; ${weekdayPatron.weekday}, ${weekdayPatron.patronage}` : ""}; ${sacredDay.name}; ${moon.day} лунный день${dayTasks ? `; задач: ${dayTasks}` : ""}`}
                        title={`${formatGregorian(date, true)}${mode === "profane" ? ` · ${weekdayPatron.patronage}` : ""} · ${formatCalendarDate(date, "sacred")} · ${moon.day} лунный день`}
                      >
                        {mode === "lunar" ? <MoonPhaseIcon phaseStep={moon.phaseStep} size={30} className="mini-day-moon-phase" /> : null}
                        <span className="mini-day-number">{mode === "lunar" ? moon.day : date.getDate()}</span>
                        {dayTasks ? <span className="mini-day-task-count" aria-hidden="true">{dayTasks}</span> : null}
                      </button>
                    );
                  })}
                </div>
                <footer className="year-month-footer">
                  <span className="year-month-meta"><em>{mode === "profane" ? "Григорианский месяц" : `${month.dates.length} лунных суток`}</em>{monthTaskCount ? <i>{monthTaskCount} задач</i> : null}</span>
                  <button type="button" className="year-open-button" onClick={openMonth}><span>Открыть месяц</span><i aria-hidden="true" /></button>
                </footer>
              </article>
            );
          })}
          <article
            className={`year-description-card calendar-mode-description${mode === "profane" ? " profane-year-full-width" : yearMonths.length === 13 ? " lunar-year-has-intercalary" : " lunar-year-full-width"}`}
            aria-labelledby="calendar-mode-year-description"
          >
            <span className="eyebrow">{CALENDAR_MODE_META[mode].label}</span>
            <h2 id="calendar-mode-year-description">{mode === "profane" ? "Обычный год, полный контекст" : "Лунный год"}</h2>
            <p>{yearDescription}</p>
            <dl>
              <div><dt>{yearMonths.length}</dt><dd>месяцев</dd></div>
              <div><dt>{yearDayCount}</dt><dd>дней в круге</dd></div>
              <div><dt>3</dt><dd>системы дат в каждом дне</dd></div>
              <div><dt>4</dt><dd>солнечные точки</dd></div>
            </dl>
            {mode === "lunar" ? (
              <>
                <p>В системе GENESIS это магический «женский» год: его внутренняя ткань определяется не месяцами и неделями солнечного года, а ростом, полнотой и исходом Луны. Весеннее равноденствие служит только ежегодной точкой настройки; условия для практик рождаются внутри самих лунных месяцев и потому не привязаны к григорианскому делению года.</p>
                <p>Это современная символическая система GENESIS, а не реконструкция единого древнегреческого календаря. Её античная опора — образ Селены как небесного знака для людей и полнота Луны в середине месяца в Гомеровом гимне; греческие лунно-солнечные календари действительно удерживали месяцы рядом с сезонами при помощи вставочного месяца.</p>
              </>
            ) : <p>Клик по дню открывает задачи, сакральное значение, фазу Луны, точное время рассвета и заката для региона устройства.</p>}
          </article>
        </section>
      </div>
    );
  };

  const renderYear = () => activeCalendarMode === "sacred"
    ? renderSacredYear()
    : renderAlternativeYear(activeCalendarMode);

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
  const calendarRailItems = activeCalendarMode === "sacred"
    ? MONTHS.map((month) => ({
        id: `sacred-${month.index}`,
        name: month.name,
        label: month.name,
        symbol: month.symbol,
        color: month.color,
        active: monthIndex === month.index,
        date: getGregorianDate(sacredYear, month.index, 1),
      }))
    : activeCalendarMode === "profane"
      ? Array.from({ length: 12 }, (_, month) => {
          const date = new Date(selectedDate.getFullYear(), month, 1, 12);
          const sacred = getSacredDate(date);
          return {
            id: `profane-${selectedDate.getFullYear()}-${month}`,
            name: profaneMonthName(date),
            label: profaneMonthName(date, true),
            symbol: String(month + 1).padStart(2, "0"),
            color: MONTHS[sacred.monthIndex].color,
            active: selectedDate.getMonth() === month,
            date,
          };
        })
      : Array.from({ length: selectedLunarYear.monthCount }, (_, offset) => {
          const absoluteIndex = selectedLunarYear.startMonthIndex + offset;
          const dates = getLunarMonthDates(absoluteIndex);
          const date = dates[0] ?? getLunarMonthStart(absoluteIndex);
          const sacred = getSacredDate(date);
          const lunarDefinition = getLunarMonthDefinition(offset + 1);
          return {
            id: `lunar-${selectedLunarYear.sacredYear}-${absoluteIndex}`,
            name: lunarDefinition.name,
            label: `${lunarDefinition.roman} · ${lunarDefinition.name}`,
            symbol: "☾",
            color: MONTHS[sacred.monthIndex].color,
            active: selectedLunarMonthIndex === absoluteIndex,
            date,
          };
        });
  const calendarRailTitle = activeCalendarMode === "sacred"
    ? `Сакральные месяцы ${sacredYear}–${sacredYear + 1}`
    : activeCalendarMode === "profane"
      ? `Месяцы ${selectedDate.getFullYear()} года`
      : `Лунные месяцы ${selectedLunarYear.sacredYear}–${selectedLunarYear.sacredYear + 1}`;

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
        androidApkUrl={androidApkUrl}
        busy={syncStatus === "syncing"}
        error={authError || syncError}
        language={language}
        onLanguageChange={selectLanguage}
        onGoogle={() => void handleGoogleSignIn()}
      />
    );
  }

  return (
    <main
      className={`genesis-app mode-${activeCalendarMode}`}
      style={{
        "--genesis-hero-image": activeCalendarMode === "sacred"
          ? `url("${dayArtUrl(todayInfo.monthIndex, todayInfo.day)}")`
          : activeCalendarMode === "lunar"
            ? `url("${APP_BASE}/genesis-hero.png")`
            : "none",
        "--genesis-hero-fallback": activeCalendarMode === "sacred" ? `url("${APP_BASE}/genesis-hero.png")` : "none",
      } as CSSProperties}
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
        <div className={`month-rail mode-${activeCalendarMode}`} aria-label={calendarRailTitle}>
          <span className="month-rail-title">{calendarRailTitle}</span>
          <div className="month-rail-grid">
            {calendarRailItems.map((month) => (
              <button
                type="button"
                key={month.id}
                className={month.active ? "active" : ""}
                onClick={() => {
                  selectCalendarDate(month.date);
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
            <span className="topbar-kicker">{CALENDAR_MODE_META[activeCalendarMode].label}</span>
            <strong>{formatCalendarDate(today, activeCalendarMode, activeCalendarMode !== "sacred")}</strong>
          </div>
          <div className="topbar-actions">
            {androidApkUrl ? (
              <a className="icon-button ux-action-button android-apk-icon-button" href={androidApkUrl} download data-tooltip="Скачать приложение для телефона" title="Скачать GENESIS для Android (APK)" aria-label="Скачать приложение GENESIS для телефона">
                <span className="ux-android-icon" aria-hidden="true" />
              </a>
            ) : null}
            {!androidApkUrl && !isStandalone && canInstall ? (
              <button type="button" className="icon-button ux-action-button" data-tooltip="Установить приложение" title="Установить GENESIS" aria-label="Установить GENESIS" onClick={() => void install()}>
                <span className="ux-install-icon" aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" className={`voice-open-button${voiceLaunchAnimating ? " is-activating" : ""}`} onClick={openVoiceAssistant} title="Открыть бесплатного голосового помощника GENESIS Voice" aria-label="Открыть бесплатного голосового помощника GENESIS Voice" aria-busy={voiceLaunchAnimating}>
              <svg className="voice-microphone-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <rect className="voice-microphone-capsule" x="8.7" y="2.8" width="6.6" height="11.2" rx="3.3" />
                <path className="voice-microphone-grille" d="M10.55 6.2h2.9M10.55 8.45h2.9" />
                <path className="voice-microphone-capture" d="M5.9 10.4v.9a6.1 6.1 0 0 0 12.2 0v-.9" />
                <path className="voice-microphone-stand" d="M12 17.4v3.35M8.9 20.75h6.2" />
                <circle className="voice-microphone-spark" cx="18.7" cy="5.2" r="1.15" />
              </svg>
            </button>
            {geminiAvailable ? (
              <button type="button" className="gemini-open-button" onClick={() => setGeminiOpen(true)} title="Открыть голосового помощника Gemini" aria-label="Открыть голосового помощника Gemini">
                <span aria-hidden="true">✦</span>
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
                title={!isGoogleSyncConfigured ? "Сервер GENESIS подключается" : "Войти через Google"}
                aria-label="Войти через Google"
              >
                <img src={`${APP_BASE}/google-signin-light-square.svg`} alt="" aria-hidden="true" />
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
            {authError ? <p className="oauth-callback-error" role="alert">{authError}</p> : null}
            {cloudUser && (!cloudUser.calendarConnected || !cloudUser.googleTasksImportReady) ? (
              <section className="google-connect-banner" aria-labelledby="google-connect-title">
                <div>
                  <span className="eyebrow">Необязательная синхронизация</span>
                  <h2 id="google-connect-title">Подключите Google Calendar и Google Tasks</h2>
                  <p>
                    Вход уже выполнен. Разрешения на календарь и списки задач запрашиваются отдельно и только после вашего нажатия.
                    GENESIS создаёт собственный календарь, а доступ к Google Tasks нужен для показа и двустороннего изменения выбранных вами списков и задач.
                  </p>
                  <p><a href="/privacy">Как GENESIS использует и защищает данные Google</a></p>
                </div>
                <button type="button" className="primary-button" onClick={() => void handleGoogleConnect()} disabled={syncStatus === "syncing"}>
                  {syncStatus === "syncing" ? "Подключаем…" : "Подключить синхронизацию"}
                </button>
              </section>
            ) : null}
            {view === "today" ? renderToday() : null}
            {view === "calendar" ? renderCalendar() : null}
            {view === "projects" ? renderProjects() : null}
            {view === "year" ? renderYear() : null}
            {view === "all-tasks" ? renderAllTasks() : null}
            {view === "stoicheion" ? (
              <StoicheionView
                key={cloudUser?.stoicheionDivinationDisabled ? "divination-disabled" : "divination-enabled"}
                divinationDisabled={Boolean(cloudUser?.stoicheionDivinationDisabled)}
              />
            ) : null}
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
          <section className={`selected-day-card day-details-modal mode-${activeCalendarMode}${selectedSolarEvent ? " solar-selected-day" : ""}`} role="dialog" aria-modal="true" aria-labelledby="selected-day-title" aria-describedby="selected-day-description">
            <button type="button" className="modal-close" onClick={() => setDayDetailsOpen(false)} aria-label="Закрыть сведения о дне">×</button>
            <div className="selected-day-symbol" aria-hidden="true">{selectedSolarEvent?.symbol ?? (activeCalendarMode === "lunar" ? "☾" : activeCalendarMode === "profane" ? selectedDate.getDate() : selectedElement.symbol)}</div>
            <div className="selected-day-copy">
              <span className="eyebrow">{activeCalendarMode === "profane"
                ? `${formatCalendarDate(selectedDate, "sacred")} · ${selectedMoon.day} лунный день`
                : activeCalendarMode === "lunar"
                  ? `${formatGregorian(selectedDate, true)} · ${formatCalendarDate(selectedDate, "sacred")}`
                  : `${formatGregorian(selectedDate, true)} · ${selectedMoon.epithet}`}</span>
              <h2 id="selected-day-title">{activeCalendarMode === "profane"
                ? formatGregorian(selectedDate, true)
                : activeCalendarMode === "lunar"
                  ? `${selectedLunarDate.month.name} · ${selectedMoon.day} лунный день`
                  : selectedSacredDay.name}</h2>
              <p id="selected-day-description">{activeCalendarMode === "lunar"
                ? `${selectedLunarDate.isThreshold ? "Рубеж" : selectedLunarDate.decade.name} · ${selectedMoon.phase} · освещённость ${selectedMoon.illumination}%. ${selectedLunarDate.month.description} Сакральный смысл дня: ${selectedSacredDay.name} — ${selectedSacredDay.description}`
                : activeCalendarMode === "profane"
                  ? `${selectedWeekdayPatron.patronage}. ${selectedSacredDay.name} — ${selectedSacredDay.description}`
                  : selectedSacredDay.description}</p>
              {selectedSolarEvent ? <strong className="selected-solar-event">{selectedSolarEvent.name} · День Солнца</strong> : null}
            </div>
            <dl className="selected-day-facts">
              {selectedSolarEvent ? <div className="solar-fact"><dt>Солнечная точка</dt><dd>{selectedSolarEvent.name}</dd></div> : null}
              {activeCalendarMode === "profane" ? <div><dt>Покровители дня</dt><dd>{selectedWeekdayPatron.weekday} · {selectedWeekdayPatron.patronage}</dd></div> : null}
              <div><dt>Григорианская дата</dt><dd>{formatGregorian(selectedDate, true)}</dd></div>
              <div><dt>Сакральная дата</dt><dd>{formatCalendarDate(selectedDate, "sacred")}</dd></div>
              <div><dt>Лунный месяц</dt><dd>{selectedLunarDate.month.name} · {selectedLunarDate.month.title}</dd></div>
              <div><dt>Лунные сутки</dt><dd>{selectedMoon.day} · {selectedMoon.phase}</dd></div>
              <div><dt>Лунная декада</dt><dd>{selectedLunarDate.isThreshold ? "Рубеж" : selectedLunarDate.decade.name}</dd></div>
              <div><dt>Стихия</dt><dd>{selectedElement.name}</dd></div>
              <div><dt>Пята</dt><dd>{selectedSacredDay.pyataTitle || "Апейрон"}</dd></div>
              <div><dt>Число</dt><dd>{selectedPythagorean?.name || "Безграничное"}</dd></div>
            </dl>
            <div className="day-details-create-task">
              <button type="button" className="day-details-create-task-button" onClick={beginSelectedDayTask}>
                <span aria-hidden="true">＋</span>
                <span><strong>Создать задачу</strong><small>{formatCalendarDate(selectedDate, activeTaskCalendarMode, true)}</small></span>
                <i aria-hidden="true">→</i>
              </button>
            </div>
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
                          <strong data-no-translate>{task.title}</strong>
                          {task.description || projectTitle || task.googleTaskListTitle ? (
                            <small data-no-translate>{task.description || projectTitle || task.googleTaskListTitle}</small>
                          ) : null}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
            <details className="day-details-celestial" open={activeCalendarMode !== "sacred" ? true : undefined}>
              <summary>
                <span><i aria-hidden="true">☾</i> Луна и Солнце</span>
                <small>Фаза Луны, рассвет и закат</small>
              </summary>
              <div className="day-details-celestial-grid">
                <article className="day-details-moon">
                  <MoonPhaseIcon phaseStep={selectedMoon.phaseStep} size={44} />
                  <div>
                    <span className="eyebrow">{selectedLunarDate.month.name} · {selectedMoon.day} день</span>
                    <strong>{selectedMoon.epithet}</strong>
                    <p>{selectedMoon.phase} · освещённость {selectedMoon.illumination}%</p>
                    <small>{selectedLunarDate.isThreshold ? "Рубеж" : selectedLunarDate.decade.name} · {selectedMoon.direction}{selectedMoon.event ? ` · ${selectedMoon.event}` : ""}</small>
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
                  Открыть месяц «{selectedDisplayMonthName}» <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
      {dayTaskCreatorOpen ? (
        <div className="modal-backdrop day-task-create-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) closeSelectedDayTaskCreator(); }}>
          <section className="editor-modal day-task-create-modal" role="dialog" aria-modal="true" aria-labelledby="day-task-create-title" aria-describedby="day-task-create-description">
            <button type="button" className="modal-close" onClick={closeSelectedDayTaskCreator} aria-label="Закрыть создание задачи">×</button>
            <span className="eyebrow">Дата задачи</span>
            <h2 id="day-task-create-title">Новая задача на выбранный день</h2>
            <p className="day-task-create-date" id="day-task-create-description">
              <strong>{formatCalendarDate(selectedDate, activeTaskCalendarMode, true)}</strong>
              <small>{formatGregorian(selectedDate, true)}</small>
              <span>Дата уже выбрана. При необходимости её можно изменить в форме.</span>
            </p>
            {renderTaskCreateForm("day-details")}
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
              <label htmlFor="edit-task-start-date">
                <span>Начало</span>
                <CalendarDatePicker id="edit-task-start-date" mode={activeTaskCalendarMode} min={editingTask.dueDate < todayDateValue ? editingTask.dueDate : todayDateValue} value={editingTask.dueDate} onChange={(nextDate) => setEditingTask((current) => current ? {
                  ...current,
                  dueDate: nextDate,
                  endDate: current.endDate < nextDate ? nextDate : current.endDate,
                } : current)} required />
              </label>
              <label htmlFor="edit-task-end-date">
                <span>Срок выполнения</span>
                <CalendarDatePicker id="edit-task-end-date" mode={activeTaskCalendarMode} min={editingTask.dueDate} value={editingTask.endDate || editingTask.dueDate} onChange={(nextDate) => setEditingTask((current) => current ? { ...current, endDate: nextDate } : current)} required />
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
                  const destination = taskLists.find((taskList) => taskList.id === nextListId);
                  setEditingTask((current) => current ? {
                    ...current,
                    googleTaskListId: nextListId || null,
                    googleTaskListTitle: destination?.title ?? "",
                    googleAccountId: destination?.accountId ?? null,
                    googleAccountEmail: destination?.accountEmail ?? "",
                    syncAccountIds: destination?.accountId ? [destination.accountId] : current.syncAccountIds,
                    time: nextListId ? "" : current.time,
                    reminders: nextListId ? [] : current.reminders,
                    reminderMinutes: nextListId ? null : current.reminderMinutes,
                    recurrence: nextListId ? "none" : current.recurrence,
                    recurrenceInterval: nextListId ? 1 : current.recurrenceInterval,
                    recurrenceMode: nextListId ? "none" : current.recurrenceMode,
                    recurrencePattern: nextListId ? "none" : current.recurrencePattern,
                    recurrenceDays: nextListId ? [] : current.recurrenceDays,
                    recurrenceStartDate: nextListId ? null : current.recurrenceStartDate,
                    recurrenceEndDate: nextListId ? null : current.recurrenceEndDate,
                    recurrenceMonths: nextListId ? [] : current.recurrenceMonths,
                    recurrencePyatas: nextListId ? [] : current.recurrencePyatas,
                    recurrenceSeriesId: nextListId ? null : current.recurrenceSeriesId,
                  } : current);
                }}>
                  <option value="">Google Calendar</option>
                  {taskLists.map((taskList) => <option value={taskList.id} key={`${taskList.accountId ?? "primary"}-${taskList.id}`}>Список · {taskList.title}{taskList.accountEmail ? ` · ${taskList.accountEmail}` : ""}</option>)}
                </select>
              </label>
              <TaskReminderPicker
                value={editingTask.reminders}
                onChange={(reminders) => setEditingTask((current) => current ? {
                  ...current,
                  reminders,
                  reminderMinutes: legacyReminderMinutes(reminders),
                } : current)}
                taskDate={editingTask.dueDate}
                taskTime={editingTask.time}
                calendarMode={activeTaskCalendarMode}
                disabled={Boolean(editingTask.googleTaskId)}
              />
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
      {editingTaskList ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingTaskList(null); }}>
          <form className="editor-modal task-list-editor" role="dialog" aria-modal="true" aria-labelledby="task-list-editor-title" onSubmit={saveTaskListEdit}>
            <button type="button" className="modal-close" onClick={() => setEditingTaskList(null)} aria-label="Закрыть">×</button>
            <span className="eyebrow">Редактирование списка задач</span>
            <h2 id="task-list-editor-title">Название списка</h2>
            <label>
              <span>Название списка</span>
              <input value={editingTaskList.title} onChange={(event) => setEditingTaskList((current) => current ? { ...current, title: event.target.value } : current)} required />
            </label>
            <div className="editor-actions">
              <button type="button" className="text-button" onClick={() => setEditingTaskList(null)}>Отмена</button>
              <button type="submit" className="primary-button" disabled={!editingTaskList.title.trim()}>Сохранить список</button>
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
            void handleGoogleConnect();
          }}
          onConnectAdditionalGoogle={() => {
            setAccountOpen(false);
            void connectAdditionalGoogleAccount();
          }}
          onLanguageChange={selectLanguage}
          categories={categories}
          onUserChange={(user) => {
            const nextLanguage = normalizeLanguage(user.language);
            setLanguage(nextLanguage);
            storeLanguage(nextLanguage);
            setCloudUser(user);
            const nextTaskCalendarMode = user.taskCalendarMode ?? "sacred";
            setTaskRecurrenceConfig((current) => alignRecurrenceConfigWithCalendar(current, nextTaskCalendarMode, newTaskDueDate));
            localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
          }}
        />
      ) : null}
      {voiceAssistantOpen ? (
        <LocalVoiceAssistant
          language={language}
          neuralAvailable={geminiAvailable}
          context={{
            language,
            calendarMode: activeTaskCalendarMode,
            today: todayDateValue,
            timeZone: deviceTimeZone,
            categories: categories.map((category) => ({ name: category.name })),
            projects: projects.map((project) => ({
              title: project.title,
              parent: projects.find((candidate) => candidate.id === project.parentId)?.title ?? "",
              category: categories.find((category) => category.id === project.categoryId)?.name ?? "",
            })),
            taskLists: taskLists.map((taskList) => ({
              title: taskList.title,
              accountEmail: taskList.accountEmail ?? "",
            })),
            accounts: googleAccounts.map((account) => ({ email: account.email })),
          }}
          onApply={applyAssistantPlan}
          onClose={() => setVoiceAssistantOpen(false)}
        />
      ) : null}
      {geminiOpen && geminiAvailable ? (
        <GeminiAssistant
          language={language}
          context={{
            language,
            calendarMode: activeTaskCalendarMode,
            today: todayDateValue,
            timeZone: deviceTimeZone,
            categories: categories.map((category) => ({ name: category.name })),
            projects: projects.map((project) => ({
              title: project.title,
              parent: projects.find((candidate) => candidate.id === project.parentId)?.title ?? "",
              category: categories.find((category) => category.id === project.categoryId)?.name ?? "",
            })),
            taskLists: taskLists.map((taskList) => ({
              title: taskList.title,
              accountEmail: taskList.accountEmail ?? "",
            })),
            accounts: googleAccounts.map((account) => ({ email: account.email })),
          }}
          onApply={applyAssistantPlan}
          onClose={() => setGeminiOpen(false)}
        />
      ) : null}
    </main>
  );
}
