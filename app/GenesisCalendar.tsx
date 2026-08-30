"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
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

type ViewName = "today" | "calendar" | "year";

type Task = {
  id: string;
  sacredYear: number;
  monthIndex: number;
  day: number;
  title: string;
  time: string;
  project: string;
  tags: string[];
  done: boolean;
};

type StoredState = {
  tasks: Task[];
  projects: string[];
};

const STORAGE_KEY = "genesis-calendar-v1";

const NAVIGATION: Array<{ id: ViewName; label: string; symbol: string }> = [
  { id: "today", label: "Сегодня", symbol: "☉" },
  { id: "calendar", label: "Календарь", symbol: "◫" },
  { id: "year", label: "Круг года", symbol: "◎" },
];

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
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  const [projects, setProjects] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskProject, setTaskProject] = useState("");
  const [taskTags, setTaskTags] = useState("");

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
    let nextProjects: string[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<StoredState>;
        nextTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        nextProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
      }
    } catch {
      // A damaged local snapshot should never prevent the calendar from opening.
    }

    const timer = window.setTimeout(() => {
      setTasks(nextTasks);
      setProjects(nextProjects);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, projects }));
  }, [hydrated, tasks, projects]);

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

    setTasks((current) => [
      ...current,
      {
        id: uid(),
        sacredYear,
        monthIndex,
        day: selectedDay,
        title,
        time: taskTime,
        project,
        tags,
        done: false,
      },
    ]);

    if (project && !projects.includes(project)) {
      setProjects((current) => [...current, project]);
    }

    setTaskTitle("");
    setTaskTime("");
    setTaskTags("");
  };

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
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
              <span className="eyebrow">Лунный ритм · {moon.day} день</span>
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

  return (
    <main className="genesis-app">
      <a className="skip-link" href="#main-content">К основному содержанию</a>
      <aside className="app-sidebar" aria-label="Основная навигация">
        <button className="brand-mark" type="button" onClick={selectToday} aria-label="GENESIS — на главную">
          <span aria-hidden="true">Γ</span>
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
        <div className="sidebar-foot">
          <span className="sync-dot" aria-hidden="true" />
          <span>Сохранено<br />на устройстве</span>
        </div>
      </aside>

      <section className="app-stage">
        <header className="topbar">
          <div>
            <span className="topbar-kicker">Сакральный календарь</span>
            <strong>{MONTHS[todayInfo.monthIndex].name} · {romanDay(todayInfo.monthIndex, todayInfo.day)}</strong>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-button" onClick={selectToday}>К сегодняшнему дню</button>
            <button type="button" className="icon-button" onClick={exportCalendar} disabled={!tasks.length} title="Экспортировать задачи в .ics" aria-label="Экспортировать задачи в календарь">↥</button>
          </div>
        </header>

        <div className="workspace" id="main-content">
          <div className="content-column">
            {view === "today" ? renderToday() : null}
            {view === "calendar" ? renderCalendar() : null}
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
                    <span className="task-meta">{task.time || "В течение дня"}{task.project ? ` · ${task.project}` : ""}</span>
                    <strong>{task.title}</strong>
                    {task.tags.length ? <span className="task-tags">{task.tags.map((tag) => <i key={tag}>#{tag}</i>)}</span> : null}
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
                  <datalist id="project-list">{projects.map((project) => <option value={project} key={project} />)}</datalist>
                </label>
              </div>
              <label>
                <span>Теги</span>
                <input value={taskTags} onChange={(event) => setTaskTags(event.target.value)} placeholder="ритуал, работа, дом" />
              </label>
              <button type="submit" className="add-task-button" disabled={!taskTitle.trim()}>
                <span aria-hidden="true">＋</span> Добавить задачу
              </button>
            </form>
            <div className="planner-foot">
              <span><i className="sync-dot" /> {hydrated ? "Все изменения сохранены" : "Загрузка данных"}</span>
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
