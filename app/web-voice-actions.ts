export type WebVoiceAction =
  | { kind: "navigate"; section: "today" | "calendar" | "all-tasks" | "projects" | "habits" | "theokyklos" | "stoicheion" | "admin" }
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
  const command = raw.trim().replace(/\s+/g, " ").replace(/^(?:(?:хочу|пожалуйста|please|i want to)\s+)/i, "").trim();
  if (!command || /[;\n]/.test(raw)) return null;
  const named = (pattern: RegExp) => command.match(pattern)?.[1]?.trim().replace(/^[«"\s]+|[»".,!?\s]+$/g, "") || "";
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
