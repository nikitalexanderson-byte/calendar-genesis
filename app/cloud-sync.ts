export type RecurrenceKind =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "yearly";

export type GenesisTask = {
  id: string;
  sacredYear: number;
  monthIndex: number;
  day: number;
  dueDate: string;
  title: string;
  description: string;
  time: string;
  project: string;
  projectId: string | null;
  categoryId: string | null;
  tags: string[];
  dependsOnIds: string[];
  done: boolean;
  completedAt: string | null;
  reminderMinutes: number | null;
  recurrence: RecurrenceKind;
  recurrenceInterval: number;
  syncToGoogle: boolean;
  googleEventId: string | null;
  updatedAt: number;
};

export type GenesisUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  calendarConnected: boolean;
};

export type GenesisCategory = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export type GenesisProject = {
  id: string;
  parentId: string | null;
  categoryId: string | null;
  title: string;
  description: string;
  tags: string[];
  status: "active" | "completed" | "archived";
  position: number;
};

export type GenesisWorkspace = {
  user: GenesisUser;
  csrf: string;
  tasks: GenesisTask[];
  projects: GenesisProject[];
  categories: GenesisCategory[];
};

const configuredBase = process.env.NEXT_PUBLIC_GENESIS_API_URL?.trim() ?? "";
const API_BASE = configuredBase.replace(/\/$/, "");
const PENDING_KEY = "genesis-pending-mutations-v1";

export const isGoogleSyncConfigured = Boolean(API_BASE);

let csrfToken = "";

type PendingMutation = {
  key: string;
  path: string;
  method: "PUT" | "DELETE";
  body?: string;
};

function readPending(): PendingMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is PendingMutation => (
      Boolean(item) && typeof item === "object" &&
      typeof (item as PendingMutation).key === "string" &&
      typeof (item as PendingMutation).path === "string" &&
      ["PUT", "DELETE"].includes((item as PendingMutation).method)
    )) : [];
  } catch {
    return [];
  }
}

function writePending(items: PendingMutation[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(PENDING_KEY, JSON.stringify(items.slice(-2000)));
  }
}

function queueMutation(mutation: PendingMutation) {
  const current = readPending().filter((item) => item.key !== mutation.key);
  current.push(mutation);
  writePending(current);
}

function clearMutation(key: string) {
  writePending(readPending().filter((item) => item.key !== key));
}

async function flushPendingMutations() {
  for (const mutation of readPending()) {
    await api(mutation.path, {
      method: mutation.method,
      ...(mutation.body ? { body: mutation.body } : {}),
    });
    clearMutation(mutation.key);
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || `Ошибка сервера ${response.status}`);
  }
  return (await response.json()) as T;
}

function normalizeTask(task: Partial<GenesisTask> & Pick<GenesisTask, "id" | "title">): GenesisTask {
  return {
    sacredYear: 0,
    monthIndex: 0,
    day: 1,
    dueDate: "",
    description: "",
    time: "",
    project: "",
    projectId: null,
    categoryId: null,
    tags: [],
    dependsOnIds: [],
    done: false,
    completedAt: null,
    reminderMinutes: null,
    recurrence: "none",
    recurrenceInterval: 1,
    syncToGoogle: true,
    googleEventId: null,
    updatedAt: Date.now(),
    ...task,
  };
}

export async function loadGenesisWorkspace(): Promise<GenesisWorkspace> {
  const workspace = await api<GenesisWorkspace>("/bootstrap");
  csrfToken = workspace.csrf;
  workspace.tasks = workspace.tasks.map((task) => normalizeTask(task));
  return workspace;
}

export function observeGenesisUser(
  listener: (user: GenesisUser | null) => void,
) {
  if (!API_BASE) {
    listener(null);
    return () => undefined;
  }

  let active = true;
  const poll = async () => {
    try {
      const result = await api<{ user: GenesisUser | null; csrf: string }>("/session");
      csrfToken = result.csrf;
      if (active) listener(result.user);
    } catch (error) {
      if (active && error instanceof Error && error.message === "AUTH_REQUIRED") {
        listener(null);
      }
    }
  };
  void poll();
  const interval = window.setInterval(poll, 60_000);
  return () => {
    active = false;
    window.clearInterval(interval);
  };
}

export function signInWithGoogle() {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(
    `${API_BASE}/auth/google/start?return_to=${encodeURIComponent(returnTo)}`,
  );
  return Promise.resolve();
}

export async function signOutFromGoogle() {
  await api<{ ok: boolean }>("/auth/logout", { method: "POST", body: "{}" });
  window.location.reload();
}

export function observeCloudTasks(
  _uid: string,
  listener: (tasks: GenesisTask[], fromCache: boolean) => void,
  onError: (error: Error) => void,
) {
  let active = true;
  const poll = async () => {
    try {
      await flushPendingMutations();
      const workspace = await loadGenesisWorkspace();
      if (active) listener(workspace.tasks, !navigator.onLine);
    } catch (error) {
      if (active) onError(error instanceof Error ? error : new Error("Ошибка синхронизации"));
    }
  };
  void poll();
  const interval = window.setInterval(poll, 20_000);
  const refresh = () => void poll();
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
  return () => {
    active = false;
    window.clearInterval(interval);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("online", refresh);
  };
}

export async function mergeLocalWorkspace(_uid: string, workspace: Pick<GenesisWorkspace, "tasks" | "projects" | "categories">) {
  if (!workspace.tasks.length && !workspace.projects.length) return;
  await api<{ ok: boolean }>("/workspace/import", {
    method: "POST",
    body: JSON.stringify(workspace),
  });
}

export async function saveCloudTask(_uid: string, task: GenesisTask) {
  const path = `/tasks/${encodeURIComponent(task.id)}`;
  const body = JSON.stringify(task);
  queueMutation({ key: `task:${task.id}`, path, method: "PUT", body });
  await api<{ task: GenesisTask }>(path, {
    method: "PUT",
    body,
  });
  clearMutation(`task:${task.id}`);
}

export async function removeCloudTask(_uid: string, taskId: string) {
  const path = `/tasks/${encodeURIComponent(taskId)}`;
  queueMutation({ key: `task:${taskId}`, path, method: "DELETE" });
  await api<{ ok: boolean }>(path, {
    method: "DELETE",
  });
  clearMutation(`task:${taskId}`);
}

export async function saveProject(project: GenesisProject) {
  const path = `/projects/${encodeURIComponent(project.id)}`;
  const body = JSON.stringify(project);
  queueMutation({ key: `project:${project.id}`, path, method: "PUT", body });
  const result = await api<{ project: GenesisProject }>(path, {
    method: "PUT",
    body,
  });
  clearMutation(`project:${project.id}`);
  return result;
}

export async function removeProject(projectId: string) {
  const path = `/projects/${encodeURIComponent(projectId)}`;
  queueMutation({ key: `project:${projectId}`, path, method: "DELETE" });
  const result = await api<{ ok: boolean }>(path, {
    method: "DELETE",
  });
  clearMutation(`project:${projectId}`);
  return result;
}

export async function saveCategory(category: GenesisCategory) {
  const path = `/categories/${encodeURIComponent(category.id)}`;
  const body = JSON.stringify(category);
  queueMutation({ key: `category:${category.id}`, path, method: "PUT", body });
  const result = await api<{ category: GenesisCategory }>(path, {
    method: "PUT",
    body,
  });
  clearMutation(`category:${category.id}`);
  return result;
}
