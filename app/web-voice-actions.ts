export type WebVoiceAction =
  | { kind: "navigate"; section: "today" | "calendar" | "year" | "all-tasks" | "projects" | "habits" | "theokyklos" | "stoicheion" | "admin" }
  | { kind: "calendar-mode"; mode: "sacred" | "lunar" | "profane" }
  | { kind: "calendar-view"; view: "calendar" | "year" }
  | { kind: "calendar-step"; unit: "month" | "year"; step: -1 | 1 }
  | { kind: "calendar-swipe"; step: -1 | 1 }
  | { kind: "calendar-date"; year: number; month: number; day: number }
  | { kind: "calendar-month"; ordinal: number }
  | { kind: "scroll"; direction: "up" | "down" | "top" | "bottom" }
  | { kind: "create-project" | "create-list" | "create-habit" | "create-task"; title: string }
  | { kind: "edit-task" | "edit-project" | "edit-habit" | "delete-habit" | "complete-task" | "uncomplete-task" | "complete-habit" | "uncomplete-habit"; id: string; title: string }
  | { kind: "move-task"; id: string; title: string; projectId: string | null };

type Named = { id: string; title: string };

function resolveName(name: string, records: Named[], english: boolean): Named {
  const query = name.trim().toLocaleLowerCase();
  const exact = records.filter((item) => item.title.toLocaleLowerCase() === query);
  const matches = exact.length ? exact : records.filter((item) => item.title.toLocaleLowerCase().includes(query));
  if (matches.length !== 1) throw new Error(matches.length
    ? english ? `Multiple matches: ${name}. Be more specific.` : `Найдено несколько совпадений: ${name}. Уточните название.`
    : english ? `Not found: ${name}` : `Не найдено: ${name}`);
  return matches[0];
}

export function parseWebVoiceAction(raw: string, tasks: Named[], projects: Named[], habits: Named[], language = "ru"): WebVoiceAction | null {
  const english = language === "en";
  const command = raw.trim().replace(/\s+/g, " ")
    .replace(/^(?:генезис|genesis)[,\s]+/iu, "")
    .replace(/^(?:(?:хочу|пожалуйста|please|i want to|можешь|could you)[,\s]+)+/iu, "")
    .replace(/[,\s]+(?:пожалуйста|please)[.!?]*$/iu, "").replace(/[.!?]+$/u, "").trim();
  if (!command || /[;\n]/.test(raw)) return null;
  const named = (pattern: RegExp) => command.match(pattern)?.[1]?.trim().replace(/^[«"\s]+|[»".,!?\s]+$/g, "") || "";
  const calendarMode = command.match(/^(?:(?:переключи|переключить|поменяй|выбери|установи|включи|покажи|открой|switch(?: to)?|select|use|show|open)\s+)?(?:календарь\s+)?(?:на\s+|в\s+)?(лунн[а-яё]*|сакральн[а-яё]*|григорианск[а-яё]*|профанск[а-яё]*|lunar|sacred|gregorian)(?:\s+календарь)?$/iu);
  if (calendarMode) return { kind: "calendar-mode", mode: /^(?:лун|lunar)/iu.test(calendarMode[1]) ? "lunar"
    : /^(?:сакрал|sacred)/iu.test(calendarMode[1]) ? "sacred" : "profane" };
  const calendarView = command.match(/^(?:открой|покажи|перейди\s+(?:в|на|к)|выбери|open|show|switch\s+to)\s+(?:(?:календарь|calendar)\s*)?(год(?:овой\s+вид)?|месяц|year(?:\s+view)?|month(?:\s+view)?)$/iu);
  if (calendarView) return { kind: "calendar-view", view: /^(?:год|year)/iu.test(calendarView[1]) ? "year" : "calendar" };
  const calendarStep = command.match(/^(?:(следующ[а-яё]*|предыдущ[а-яё]*|прошл[а-яё]*|next|previous|last)\s+(месяц[а-яё]*|год[а-яё]*|month|year)|(месяц[а-яё]*|год[а-яё]*|month|year)\s+(впер[её]д|назад|forward|back))$/iu);
  if (calendarStep) return { kind: "calendar-step", unit: /^(?:год|year)/iu.test(calendarStep[2] || calendarStep[3]) ? "year" : "month",
    step: /^(?:пред|прош|prev|last|назад|back)/iu.test(calendarStep[1] || calendarStep[4]) ? -1 : 1 };
  const swipe = command.match(/^(?:свайп(?:ни|нуть|ай)?|листай|пролистай|swipe)\s+(влево|вправо|left|right)$/iu);
  if (swipe) return { kind: "calendar-swipe", step: /^(?:влево|left)/iu.test(swipe[1]) ? 1 : -1 };
  const scroll = command.match(/^(?:прокрути|пролистай|листай|скролл(?:ь|и)?|scroll)(?:\s+(?:страницу|экран|page))?\s+(вверх|вниз|наверх|в\s+начало|в\s+конец|up|down|top|bottom)$/iu);
  if (scroll) return { kind: "scroll", direction: /^(?:в\s+начало|наверх|top)/iu.test(scroll[1]) ? "top"
    : /^(?:в\s+конец|bottom)/iu.test(scroll[1]) ? "bottom"
      : /^(?:вверх|up)/iu.test(scroll[1]) ? "up" : "down" };
  const date = command.match(/^(?:покажи|открой|выбери|перейди\s+на|show|open|select)\s+(?:(?:дату|день|date|day)\s+)?(\d{4})-(\d{1,2})-(\d{1,2})$/iu);
  if (date) return { kind: "calendar-date", year: Number(date[1]), month: Number(date[2]), day: Number(date[3]) };
  const spokenDate = command.match(/^(?:покажи|открой|выбери|перейди\s+на|show|open|select)\s+(?:(?:дату|день|date|day)\s+)?(\d{1,2})\s+([а-яёa-z]+)\s+(\d{4})(?:\s+года)?$/iu);
  if (spokenDate) {
    const months = ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
    const englishMonths = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const name = spokenDate[2].toLocaleLowerCase();
    const month = months.findIndex((item) => name.startsWith(item) || item === "май" && name === "мая");
    const englishMonth = englishMonths.findIndex((item) => name === item || name === item.slice(0, 3));
    if (month >= 0 || englishMonth >= 0) return { kind: "calendar-date", year: Number(spokenDate[3]), month: (month >= 0 ? month : englishMonth) + 1, day: Number(spokenDate[1]) };
  }
  const month = command.match(/^(?:покажи|открой|выбери|перейди\s+(?:в|на|к)|show|open|select)\s+(?:(?:месяц|month)\s+)?(\d{1,2})(?:[-\s]?(?:й|ый|ой|го|месяц|month))?$/iu);
  if (month) return { kind: "calendar-month", ordinal: Number(month[1]) };
  const destination = named(/^(?:открой|покажи|перейди в|open|show)\s+(.+)$/i).toLocaleLowerCase();
  const sections: Record<string, Extract<WebVoiceAction, { kind: "navigate" }>["section"]> = {
    "сегодня": "today", today: "today", "календарь": "calendar", calendar: "calendar",
    "задачи": "all-tasks", tasks: "all-tasks", "списки задач": "all-tasks", "task lists": "all-tasks",
    "проекты": "projects", projects: "projects", "привычки": "habits", habits: "habits",
    "сакральные привычки": "habits", "sacred habits": "habits", "путь героя": "habits", "hero path": "habits",
    "сон и настроение": "habits", "sleep and mood": "habits", "теокиклос": "theokyklos", theokyklos: "theokyklos",
    "стойхейон": "stoicheion", stoicheion: "stoicheion", "настройки": "admin", settings: "admin",
  };
  if (destination && sections[destination]) return { kind: "navigate", section: sections[destination] };
  for (const [kind, pattern] of [
    ["create-project", /^(?:создай|создать|добавь|добавить|create|add)\s+(?:новый\s+)?(?:проект|project)\s+(.+)$/i],
    ["create-list", /^(?:создай|создать|добавь|добавить|create|add)\s+(?:новый\s+)?(?:список задач|task list)\s+(.+)$/i],
    ["create-habit", /^(?:создай|создать|добавь|добавить|create|add)\s+(?:новую\s+)?(?:привычку|привычка|habit)\s+(.+)$/i],
    ["create-task", /^(?:создай|создать|добавь|добавить|create|add)\s+(?:новую\s+)?(?:задачу|задача|task)\s+(.+)$/i],
  ] as const) {
    const title = named(pattern);
    if (title) return { kind, title };
  }
  const move = command.match(/^(?:перемести|перенеси|move)\s+(?:задачу|задача|task)\s+(.+?)\s+(?:в|into|to)\s+(?:проект|project)\s+(.+)$/i);
  if (move) {
    const task = resolveName(move[1], tasks, english);
    const destinationName = move[2].trim().replace(/[»".,!?]+$/g, "");
    const projectId = /^(?:хаос-бокс|inbox)$/i.test(destinationName) ? null : resolveName(destinationName, projects, english).id;
    return { kind: "move-task", id: task.id, title: task.title, projectId };
  }
  const removeFromProject = named(/^(?:убери|исключи|remove)\s+(?:задачу|задача|task)\s+(.+?)\s+(?:из проекта|from project)$/i);
  if (removeFromProject) {
    const task = resolveName(removeFromProject, tasks, english);
    return { kind: "move-task", id: task.id, title: task.title, projectId: null };
  }
  for (const [kind, pattern, records] of [
    ["edit-task", /^(?:отредактируй|отредактировать|редактировать|изменить|измени|edit)\s+(?:задачу|задача|task)\s+(.+)$/i, tasks],
    ["complete-task", /^(?:выполни|заверши|отметь|пометь|complete)\s+(?:задачу|задача|task)\s+(.+)$/i, tasks],
    ["uncomplete-task", /^(?:сними выполнение|отмени выполнение|uncomplete)\s+(?:задачи|задачу|task)\s+(.+)$/i, tasks],
    ["edit-habit", /^(?:отредактируй|отредактировать|редактировать|изменить|измени|edit)\s+(?:привычку|привычка|habit)\s+(.+)$/i, habits],
    ["delete-habit", /^(?:удали|удалить|delete|remove)\s+(?:привычку|привычка|habit)\s+(.+)$/i, habits],
    ["complete-habit", /^(?:выполни|отметь|пометь|complete)\s+(?:привычку|привычка|habit)\s+(.+)$/i, habits],
    ["uncomplete-habit", /^(?:сними отметку|отмени выполнение|uncomplete)\s+(?:привычки|привычку|habit)\s+(.+)$/i, habits],
    ["edit-project", /^(?:отредактируй|отредактировать|редактировать|изменить|измени|edit)\s+(?:проект|project)\s+(.+)$/i, projects],
  ] as const) {
    const name = named(pattern);
    if (name) {
      const record = resolveName(name, records, english);
      return { kind, id: record.id, title: record.title };
    }
  }
  return null;
}
