import type { GeminiPlan, GenesisCategory, GenesisProject, GenesisTask, GoogleTaskList } from "./cloud-sync";
import { defaultHabit, updateHabitCompletion, type HabitWorkspace } from "./habits";
import { localizeCategoryName, type Language } from "./i18n";
import { createLocalVoicePlan } from "./local-voice-plan";
import { parseWebVoiceAction } from "./web-voice-actions";
import type { CalendarMode } from "./calendar-data";

type View = "today" | "calendar" | "all-tasks" | "projects" | "habits" | "theokyklos" | "stoicheion" | "admin";
type Request = { kind: "edit" | "delete" | "section"; id?: string; section?: string };
export type WebVoiceContext = {
  language: Language; calendarMode: CalendarMode; today: string; timeZone: string;
  categories: GenesisCategory[]; projects: GenesisProject[]; taskLists: GoogleTaskList[];
  accounts: { email: string }[]; tasks: GenesisTask[]; workspace: HabitWorkspace;
};
export type WebVoiceEffects = {
  navigate: (view: View) => void;
  requestHabit: (request: Request) => void;
  applyPlan: (plan: GeminiPlan) => Promise<string>;
  updateWorkspace: (workspace: HabitWorkspace) => void;
  openTask: (task: GenesisTask) => void;
  openProject: (project: GenesisProject) => void;
  toggleTask: (id: string) => void;
  changeTask: (original: GenesisTask, changed: GenesisTask) => void;
};

export async function runWebVoiceCommand(command: string, context: WebVoiceContext, effects: WebVoiceEffects): Promise<string> {
  const { language, calendarMode, today, timeZone, categories, projects, taskLists, accounts, tasks, workspace } = context;
  const { navigate, requestHabit, applyPlan, updateWorkspace, openTask, openProject, toggleTask, changeTask } = effects;
  const action = parseWebVoiceAction(command, tasks, projects, workspace.habits, language);
  const reply = (ru: string, en: string) => language === "en" ? en : ru;
  if (!action) return reply("Пока не умею это делать. Попробуйте открыть раздел или назвать задачу, проект, список либо привычку.",
    "I cannot do that yet. Try opening a section or naming a task, project, list or habit.");
  if (action.kind === "navigate") {
    navigate(action.section);
    if (action.section === "habits") {
      const section = /(?:сон и настроение|sleep and mood)/i.test(command) ? "modules"
        : /(?:путь героя|hero path)/i.test(command) ? "progress" : "library";
      requestHabit({ kind: "section", section });
    }
    return reply("Раздел открыт.", "Section opened.");
  }
  if (action.kind === "create-project" || action.kind === "create-list") {
    return applyPlan({
      request: command, summary: command,
      projects: action.kind === "create-project" ? [{ title: action.title, description: "", parentProject: "", category: "", tags: [] }] : [],
      taskLists: action.kind === "create-list" ? [{ title: action.title, project: "", accountEmail: "" }] : [],
      tasks: [],
    });
  }
  if (action.kind === "create-task") {
    return applyPlan(createLocalVoicePlan(command, {
      language, calendarMode, today, timeZone,
      categories: categories.map((category) => ({ name: localizeCategoryName(category, language) })),
      projects: projects.map((project) => ({ title: project.title,
        parent: projects.find((candidate) => candidate.id === project.parentId)?.title ?? "",
        category: categories.find((category) => category.id === project.categoryId)?.name ?? "" })),
      taskLists: taskLists.map((taskList) => ({ title: taskList.title, accountEmail: taskList.accountEmail ?? "" })),
      accounts,
    }));
  }
  if (action.kind === "create-habit") {
    const habit = { ...defaultHabit(today, calendarMode), title: action.title };
    updateWorkspace({ ...workspace, habits: [...workspace.habits, habit] });
    navigate("habits");
    return reply("Привычка создана.", "Habit created.");
  }
  if (action.kind === "edit-task") {
    const task = tasks.find((item) => item.id === action.id);
    if (!task) return reply("Задача больше не найдена.", "Task was not found.");
    openTask(task);
    return reply("Открыта форма задачи.", "Task editor opened.");
  }
  if (action.kind === "edit-project") {
    const project = projects.find((item) => item.id === action.id);
    if (!project) return reply("Проект больше не найден.", "Project was not found.");
    navigate("projects");
    openProject(project);
    return reply("Открыта форма проекта.", "Project editor opened.");
  }
  if (action.kind === "edit-habit" || action.kind === "delete-habit") {
    navigate("habits");
    requestHabit({ kind: action.kind === "edit-habit" ? "edit" : "delete", id: action.id });
    return reply(action.kind === "edit-habit" ? "Открыта форма привычки." : "Проверьте подтверждение удаления привычки.",
      action.kind === "edit-habit" ? "Habit editor opened." : "Confirm habit deletion.");
  }
  if (action.kind === "complete-task" || action.kind === "uncomplete-task") {
    const task = tasks.find((item) => item.id === action.id);
    if (!task) return reply("Задача больше не найдена.", "Task was not found.");
    const desired = action.kind === "complete-task";
    if (task.done !== desired) {
      if (desired && task.dependsOnIds.some((id) => tasks.some((item) => item.id === id && !item.done))) {
        return reply("Сначала завершите связанные задачи.", "Complete dependent tasks first.");
      }
      toggleTask(task.id);
    }
    navigate("all-tasks");
    return reply(desired ? "Задача выполнена." : "Отметка задачи снята.", desired ? "Task completed." : "Task completion cleared.");
  }
  if (action.kind === "complete-habit" || action.kind === "uncomplete-habit") {
    const habit = workspace.habits.find((item) => item.id === action.id);
    if (!habit) return reply("Привычка больше не найдена.", "Habit was not found.");
    updateWorkspace(updateHabitCompletion(workspace, habit, today, { completed: action.kind === "complete-habit" }));
    navigate("habits");
    return reply(action.kind === "complete-habit" ? "Привычка выполнена." : "Отметка привычки снята.",
      action.kind === "complete-habit" ? "Habit completed." : "Habit completion cleared.");
  }
  if (action.kind === "move-task") {
    const task = tasks.find((item) => item.id === action.id);
    if (!task) return reply("Задача больше не найдена.", "Task was not found.");
    const target = projects.find((item) => item.id === action.projectId);
    changeTask(task, { ...task, projectId: target?.id ?? null, project: target?.title ?? "",
      categoryId: target?.categoryId ?? null, updatedAt: Date.now() });
    navigate("projects");
    return reply("Задача перемещена.", "Task moved.");
  }
  return reply("Пока не умею это делать.", "I cannot do that yet.");
}
