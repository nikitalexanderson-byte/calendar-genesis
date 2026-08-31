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
  observeCloudTasks,
  observeGenesisUser,
  removeCloudTask,
  saveCategory,
  saveCloudTask,
  saveProject,
  signInWithGoogle,
  signOutFromGoogle,
} from "./cloud-sync";
import {
  MONTHS,
  PYATA_MEANINGS,
  SOLAR_EVENTS,
  dateKey,
  formatGregorian,
  getDayElement,
  getGregorianDate,
  getMoon,
  getPythagorean,
  getSacredDate,
  getSacredDay,
} from "./calendar-data";
import { usePwaInstall } from "./use-pwa-install";

type ViewName = "today" | "calendar" | "projects" | "year";

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

const STORAGE_KEY = "genesis-calendar-v1";

const NAVIGATION: Array<{ id: ViewName; label: string; symbol: string }> = [
  { id: "today", label: "Сегодня", symbol: "☉" },
  { id: "calendar", label: "Календарь", symbol: "◫" },
  { id: "projects", label: "Проекты", symbol: "◇" },
  { id: "year", label: "Круг года", symbol: "◎" },
];

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
  const [cloudUser, setCloudUser] = useState<GenesisUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskProject, setTaskProject] = useState("");
  const [taskTags, setTaskTags] = useState("");
  const [taskReminder, setTaskReminder] = useState("30");
  const [taskRecurrence, setTaskRecurrence] = useState<RecurrenceKind>("none");
  const [taskRecurrenceInterval, setTaskRecurrenceInterval] = useState("1");
  const [taskDependsOn, setTaskDependsOn] = useState("");
  const [taskSyncToGoogle, setTaskSyncToGoogle] = useState(true);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectParent, setNewProjectParent] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState(DEFAULT_CATEGORIES[0].id);
  const [newProjectTags, setNewProjectTags] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const tasksRef = useRef<Task[]>([]);
  const projectsRef = useRef<GenesisProject[]>([]);
  const categoriesRef = useRef<GenesisCategory[]>(DEFAULT_CATEGORIES);
  const { canInstall, install, isStandalone } = usePwaInstall();

  const todayInfo = useMemo(() => getSacredDate(today), [today]);
  const selectedDate = useMemo(
    () => getGregorianDate(sacredYear, monthIndex, selectedDay),
    [sacredYear, monthIndex, selectedDay],
  );
  const selectedMonth = MONTHS[monthIndex];
  const selectedSacredDay = getSacredDay(monthIndex, selectedDay);
  const selectedMoon = getMoon(selectedDate);
  const selectedElement = getDayElement(monthIndex, selectedDay);
  const selectedPythagorean = getPythagorean(monthIndex, selectedDay);
  const selectedKey = taskDateKey(sacredYear, monthIndex, selectedDay);
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

  useEffect(() => {
    let nextTasks: Task[] = [];
    let nextProjects: GenesisProject[] = [];
    let nextCategories: GenesisCategory[] = DEFAULT_CATEGORIES;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<StoredState>;
        nextTasks = Array.isArray(parsed.tasks)
          ? parsed.tasks.map((task) => ({
              description: "",
              dueDate: task.dueDate || inputDate(getGregorianDate(task.sacredYear, task.monthIndex, task.day)),
              projectId: null,
              categoryId: null,
              dependsOnIds: [],
              completedAt: task.done ? new Date().toISOString() : null,
              reminderMinutes: null,
              recurrence: "none" as RecurrenceKind,
              recurrenceInterval: 1,
              syncToGoogle: true,
              googleEventId: null,
              ...task,
              updatedAt:
                typeof task.updatedAt === "number" ? task.updatedAt : timestamp(),
            }))
          : [];
        nextProjects = Array.isArray(parsed.projects)
          ? parsed.projects.map((project, index) =>
              typeof project === "string"
                ? {
                    id: `legacy-${index}`,
                    parentId: null,
                    categoryId: null,
                    title: project,
                    description: "",
                    tags: [],
                    status: "active" as const,
                    position: index,
                  }
                : project,
            )
          : [];
        nextCategories = Array.isArray(parsed.categories) && parsed.categories.length
          ? parsed.categories
          : DEFAULT_CATEGORIES;
      }
    } catch {
      // A damaged local snapshot should never prevent the calendar from opening.
    }

    const timer = window.setTimeout(() => {
      tasksRef.current = nextTasks;
      projectsRef.current = nextProjects;
      categoriesRef.current = nextCategories;
      setTasks(nextTasks);
      setProjects(nextProjects);
      setCategories(nextCategories);
      setHydrated(true);
      setSyncStatus(isGoogleSyncConfigured ? "local" : "setup");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    tasksRef.current = tasks;
    projectsRef.current = projects;
    categoriesRef.current = categories;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, projects, categories }));
  }, [hydrated, tasks, projects, categories]);

  useEffect(() => {
    if (!hydrated || !isGoogleSyncConfigured) return;

    let active = true;
    let stopTasks: (() => void) | undefined;
    const stopUser = observeGenesisUser((user) => {
      stopTasks?.();
      stopTasks = undefined;
      setCloudUser(user);
      setSyncError("");

      if (!user) {
        setSyncStatus("local");
        return;
      }

      setSyncStatus("syncing");
      void mergeLocalWorkspace(user.uid, {
        tasks: tasksRef.current,
        projects: projectsRef.current,
        categories: categoriesRef.current,
      })
        .then(async () => {
          if (!active) return;
          const workspace = await loadGenesisWorkspace();
          if (!active) return;
          setProjects(workspace.projects);
          setCategories(workspace.categories.length ? workspace.categories : DEFAULT_CATEGORIES);
          stopTasks = observeCloudTasks(
            user.uid,
            (cloudTasks, fromCache) => {
              if (!active) return;
              tasksRef.current = cloudTasks;
              setTasks(cloudTasks);
              setSyncStatus(fromCache ? "offline" : "synced");
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
          setSyncStatus("error");
        });
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
    void saveCloudTask(cloudUser.uid, task).catch((error: Error) => {
      setSyncError(error.message);
      setSyncStatus("error");
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
    try {
      await signOutFromGoogle();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Не удалось выйти");
      setSyncStatus("error");
    }
  };

  const selectToday = () => {
    setSacredYear(todayInfo.sacredYear);
    setMonthIndex(todayInfo.monthIndex);
    setSelectedDay(todayInfo.day);
    setView("today");
  };

  const selectMonth = (nextIndex: number) => {
    const normalized = (nextIndex + 13) % 13;
    setMonthIndex(normalized);
    setSelectedDay(1);
  };

  const changeSacredYear = (nextYear: number) => {
    setSacredYear(nextYear);
    if (monthIndex === 12) {
      setSelectedDay((day) => Math.min(day, apeironLength(nextYear)));
    }
  };

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;

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
      dependsOnIds: taskDependsOn ? [taskDependsOn] : [],
      done: false,
      completedAt: null,
      reminderMinutes: taskReminder ? Number(taskReminder) : null,
      recurrence: taskRecurrence,
      recurrenceInterval: Math.max(1, Number(taskRecurrenceInterval) || 1),
      syncToGoogle: taskSyncToGoogle,
      googleEventId: null,
      updatedAt: timestamp(),
    };

    setTasks((current) => [...current, task]);
    saveTask(task);

    setTaskTitle("");
    setTaskTime("");
    setTaskTags("");
    setTaskDependsOn("");
  };

  const toggleTask = (id: string) => {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return;
    const nextTask = {
      ...currentTask,
      done: !currentTask.done,
      completedAt: currentTask.done ? null : new Date().toISOString(),
      updatedAt: timestamp(),
    };
    const nextDate = !currentTask.done && !cloudUser
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
  };

  const deleteTask = (id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
    if (cloudUser) {
      setSyncStatus("syncing");
      void removeCloudTask(cloudUser.uid, id).catch((error: Error) => {
        setSyncError(error.message);
        setSyncStatus("error");
      });
    }
  };

  const persistProject = (project: GenesisProject) => {
    if (!cloudUser) return;
    setSyncStatus("syncing");
    void saveProject(project)
      .then(() => setSyncStatus("synced"))
      .catch((error: Error) => {
        setSyncError(error.message);
        setSyncStatus("error");
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
      description: "",
      tags,
      status: "active",
      position: projects.length,
    };
    setProjects((current) => [...current, project]);
    persistProject(project);
    setNewProjectTitle("");
    setNewProjectTags("");
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
    setCategories((current) => [...current, category]);
    if (cloudUser) {
      void saveCategory(category).catch((error: Error) => {
        setSyncError(error.message);
        setSyncStatus("error");
      });
    }
    setNewCategoryTitle("");
  };

  const toggleProject = (id: string) => {
    const current = projects.find((project) => project.id === id);
    if (!current) return;
    const next: GenesisProject = {
      ...current,
      status: current.status === "completed" ? "active" : "completed",
    };
    setProjects((items) => items.map((project) => (project.id === id ? next : project)));
    persistProject(next);
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
    setView("calendar");
  };

  const renderToday = () => {
    const info = todayInfo;
    const month = MONTHS[info.monthIndex];
    const day = getSacredDay(info.monthIndex, info.day);
    const gregorian = getGregorianDate(info.sacredYear, info.monthIndex, info.day);
    const moon = getMoon(gregorian);
    const element = getDayElement(info.monthIndex, info.day);
    const pythagorean = getPythagorean(info.monthIndex, info.day);
    const solarEvent = SOLAR_EVENTS[dateKey(info.monthIndex, info.day)];
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
              {solarEvent ? <span className="event-badge">✦ {solarEvent}</span> : null}
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
              <h2 id="five-days-title">Пять дней вокруг сегодня</h2>
            </div>
            <button type="button" className="text-button" onClick={() => setView("calendar")}>Весь месяц →</button>
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
                    setView("calendar");
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
      <div className="calendar-view">
        <header className="calendar-header" style={{ "--month-accent": selectedMonth.color } as CSSProperties}>
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
                    return (
                      <button
                        type="button"
                        key={dayNumber}
                        className={`calendar-day${isSelected ? " selected" : ""}${isToday ? " today" : ""}`}
                        onClick={() => setSelectedDay(dayNumber)}
                        aria-pressed={isSelected}
                        aria-label={`${formatGregorian(gregorian, true)} — ${sacredDay.name}`}
                      >
                        <span className="calendar-gregorian">{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(gregorian)}</span>
                        <strong>{romanDay(monthIndex, dayNumber)}</strong>
                        <span className="calendar-moon" title={`${moon.epithet}: ${moon.phase}`}>{moon.icon} {moon.day}</span>
                        <small>{sacredDay.name.split("(")[0].trim()}</small>
                        {taskCount ? <i aria-label={`${taskCount} задач`}>{taskCount}</i> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        <section className="selected-day-card" aria-labelledby="selected-day-title">
          <div className="selected-day-symbol" aria-hidden="true">{selectedElement.symbol}</div>
          <div className="selected-day-copy">
            <span className="eyebrow">{formatGregorian(selectedDate, true)} · {selectedMoon.epithet}</span>
            <h2 id="selected-day-title">{selectedSacredDay.name}</h2>
            <p>{selectedSacredDay.description}</p>
          </div>
          <dl className="selected-day-facts">
            <div><dt>Стихия</dt><dd>{selectedElement.name}</dd></div>
            <div><dt>Пята</dt><dd>{selectedSacredDay.pyataTitle || "Апейрон"}</dd></div>
            <div><dt>Число</dt><dd>{selectedPythagorean?.name || "Безграничное"}</dd></div>
          </dl>
        </section>
      </div>
    );
  };

  const renderProjects = () => {
    const projectRows = flattenProjects(projects);
    const inboxTasks = tasks.filter((task) => !task.projectId && !task.project);
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

        <section className="category-strip" aria-label="Категории жизни">
          {categories.map((category) => {
            const projectCount = projects.filter((project) => project.categoryId === category.id).length;
            return (
              <article key={category.id} style={{ "--category-color": category.color } as CSSProperties}>
                <i aria-hidden="true" />
                <strong>{category.name}</strong>
                <span>{projectCount} проектов</span>
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
                        {project.tags.length ? <em>{project.tags.map((tag) => `#${tag}`).join("  ")}</em> : null}
                      </div>
                    </button>
                    <i className="project-progress" style={{ "--project-progress": `${projectTasks.length ? Math.round((finished / projectTasks.length) * 100) : 0}%` } as CSSProperties} />
                  </article>
                );
              }) : (
                <div className="task-empty compact-empty">
                  <span aria-hidden="true">◇</span>
                  <strong>Создайте первый проект</strong>
                  <p>Большая цель становится управляемой, когда у неё есть структура.</p>
                </div>
              )}
            </div>

            <form className="project-form" onSubmit={addProject}>
              <label>
                <span>Новый проект или подпроект</span>
                <input value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} placeholder="Название результата" />
              </label>
              <div className="project-form-grid">
                <label>
                  <span>Категория</span>
                  <select value={newProjectCategory} onChange={(event) => setNewProjectCategory(event.target.value)}>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label>
                  <span>Родительский проект</span>
                  <select value={newProjectParent} onChange={(event) => setNewProjectParent(event.target.value)}>
                    <option value="">Нет — верхний уровень</option>
                    {projectRows.filter(({ depth }) => depth < 3).map(({ project, depth }) => <option key={project.id} value={project.id}>{"— ".repeat(depth)}{project.title}</option>)}
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
              {inboxTasks.slice(0, 5).map((task) => <button type="button" key={task.id} onClick={() => setTaskTitle(task.title)}>{task.title}</button>)}
            </section>
            <section className="daily-plan-card">
              <span className="eyebrow">План на день</span>
              <h2>{formatGregorian(selectedDate, true)}</h2>
              <div><strong>{dayTasks.filter((task) => !task.done).length}</strong><span>осталось</span></div>
              <div><strong>{dayTasks.filter((task) => task.done).length}</strong><span>завершено</span></div>
              <button type="button" className="primary-button" onClick={() => setView("calendar")}>Открыть план →</button>
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
      <section className="year-grid" aria-label="Все месяцы года">
        {MONTHS.map((month) => {
          const availableDays = month.index === 12 ? apeironLength(sacredYear) : 30;
          const monthTaskCount = tasks.filter(
            (task) => task.sacredYear === sacredYear && task.monthIndex === month.index,
          ).length;
          const isCurrent = sacredYear === todayInfo.sacredYear && month.index === todayInfo.monthIndex;
          return (
            <button
              type="button"
              className={`year-month${month.index === 12 ? " apeiron" : ""}${isCurrent ? " current" : ""}`}
              key={month.name}
              onClick={() => {
                setMonthIndex(month.index);
                setSelectedDay(isCurrent ? todayInfo.day : 1);
                setView("calendar");
              }}
              style={{ "--month-accent": month.color } as CSSProperties}
            >
              <span className="year-month-top"><i>{month.roman}</i><b>{month.symbol}</b></span>
              <strong>{month.name}</strong>
              <small>{month.title}</small>
              <span className="mini-days" aria-hidden="true">
                {Array.from({ length: availableDays }, (_, index) => {
                  const key = taskDateKey(sacredYear, month.index, index + 1);
                  const hasTask = tasks.some(
                    (task) => taskDateKey(task.sacredYear, task.monthIndex, task.day) === key,
                  );
                  const todayDot = key === todayKey;
                  return <i key={index} className={`${hasTask ? "has-task" : ""}${todayDot ? " today" : ""}`} />;
                })}
              </span>
              <span className="year-month-footer">
                <em>{month.season}</em>
                {monthTaskCount ? <i>{monthTaskCount} задач</i> : <i>Открыть →</i>}
              </span>
            </button>
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
          {NAVIGATION.map((item) => (
            <button
              type="button"
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
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
                setView("calendar");
              }}
              title={month.name}
              aria-label={month.name}
            >
              {month.symbol}
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
              <button type="button" className="install-button" onClick={() => void install()}>
                <span aria-hidden="true">↓</span> Установить
              </button>
            ) : null}
            {cloudUser ? (
              <div className="account-chip">
                <span
                  className="account-avatar"
                  style={cloudUser.photoURL ? { backgroundImage: `url(${cloudUser.photoURL})` } : undefined}
                  aria-hidden="true"
                >
                  {cloudUser.photoURL ? "" : "G"}
                </span>
                <div>
                  <strong>{cloudUser.displayName || "Google"}</strong>
                  <small>{cloudUser.calendarConnected ? "Google Calendar подключён" : "личный кабинет"}</small>
                </div>
                <button type="button" onClick={() => void handleGoogleSignOut()} aria-label="Выйти из Google-аккаунта">×</button>
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
            <button type="button" className="icon-button" onClick={exportCalendar} disabled={!tasks.length} title="Экспортировать задачи в .ics" aria-label="Экспортировать задачи в календарь">↥</button>
          </div>
        </header>

        <div className="workspace" id="main-content">
          <div className="content-column">
            {view === "today" ? renderToday() : null}
            {view === "calendar" ? renderCalendar() : null}
            {view === "projects" ? renderProjects() : null}
            {view === "year" ? renderYear() : null}
          </div>

          <aside className="planner-panel" aria-labelledby="planner-title">
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
                  <div>
                    <span className="task-meta">{task.time || "В течение дня"}{task.project ? ` · ${task.project}` : ""}{task.recurrence !== "none" ? " · ↻" : ""}{task.reminderMinutes !== null ? ` · ⏰ ${task.reminderMinutes} мин` : ""}</span>
                    <strong>{task.title}</strong>
                    {task.tags.length ? <span className="task-tags">{task.tags.map((tag) => <i key={tag}>#{tag}</i>)}</span> : null}
                    {task.dependsOnIds.length ? <span className="task-dependency">↳ зависит от {task.dependsOnIds.length} задачи</span> : null}
                  </div>
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
                      <select value={taskDependsOn} onChange={(event) => setTaskDependsOn(event.target.value)}>
                        <option value="">Нет связи</option>
                        {tasks.filter((task) => !task.done).slice(0, 50).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
              ) : null}
              <label>
                <span>Теги</span>
                <input value={taskTags} onChange={(event) => setTaskTags(event.target.value)} placeholder="ритуал, работа, дом" />
              </label>
              <label className="sync-checkbox">
                <input type="checkbox" checked={taskSyncToGoogle} onChange={(event) => setTaskSyncToGoogle(event.target.checked)} />
                <span>Создать событие и напоминание в Google Calendar</span>
              </label>
              <button type="submit" className="add-task-button" disabled={!taskTitle.trim()}>
                <span aria-hidden="true">＋</span> Добавить задачу
              </button>
            </form>
            <div className="planner-foot">
              <span title={syncError || undefined}><i className={`sync-dot sync-${syncStatus}`} /> {syncLabel}</span>
              <button type="button" onClick={exportCalendar} disabled={!tasks.length}>.ics экспорт</button>
            </div>
          </aside>
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Мобильная навигация">
        {NAVIGATION.map((item) => (
          <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
            <span aria-hidden="true">{item.symbol}</span>{item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
