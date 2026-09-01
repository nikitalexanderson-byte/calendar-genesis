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
  passwordEnabled: boolean;
  isAdmin: boolean;
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
  hasRemoteStructure: boolean;
  syncWarning: string | null;
};

export type GenesisMetrics = {
  projectCount: number;
  taskCount: number;
  openTaskCount: number;
  completedTaskCount: number;
  googleSyncedCount: number;
};

export type AdminUserStats = {
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  loginCount: number;
  passwordEnabled: boolean;
  calendarConnected: boolean;
  projectCount: number;
  taskCount: number;
  openTaskCount: number;
  completedTaskCount: number;
  googleSyncedCount: number;
  metricsUpdatedAt: string | null;
};

export type AdminStats = {
  users: AdminUserStats[];
  totals: { users: number; projects: number; tasks: number; completedTasks: number };
};

type WorkspaceEnvelope = {
  ciphertext: string;
  iv: string;
  version: number;
  updatedAt: string;
};

type BootstrapPayload = {
  user: GenesisUser;
  csrf: string;
  tasks: GenesisTask[];
  workspace: { key: string; envelope: WorkspaceEnvelope | null };
  syncWarning: string | null;
};

const configuredBase = process.env.NEXT_PUBLIC_GENESIS_API_URL?.trim() ?? "";
const API_BASE = configuredBase.replace(/\/$/, "");
const PENDING_KEY = "genesis-pending-mutations-v2";
const LAST_USER_CACHE = "genesis-last-user-v2";

export const isGoogleSyncConfigured = Boolean(API_BASE);

let csrfToken = "";
let workspaceKey = "";
let workspaceVersion = Date.now();

type PendingMutation = {
  key: string;
  path: string;
  method: "PUT" | "DELETE" | "POST";
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
      ["PUT", "DELETE", "POST"].includes((item as PendingMutation).method)
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
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error || (response.status === 401 ? "AUTH_REQUIRED" : `Ошибка сервера ${response.status}`));
  }
  if (payload === null) {
    throw new Error("Сервис GENESIS временно недоступен.");
  }
  return payload as T;
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

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importWorkspaceKey() {
  if (!workspaceKey) throw new Error("Ключ пространства не получен");
  return crypto.subtle.importKey("raw", base64ToBytes(workspaceKey), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function decryptWorkspace(envelope: WorkspaceEnvelope | null): Promise<Pick<GenesisWorkspace, "projects" | "categories">> {
  if (!envelope) return { projects: [], categories: [] };
  const key = await importWorkspaceKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  const decoded = JSON.parse(new TextDecoder().decode(plain)) as { projects?: GenesisProject[]; categories?: GenesisCategory[] };
  workspaceVersion = Math.max(workspaceVersion, envelope.version + 1);
  return {
    projects: Array.isArray(decoded.projects) ? decoded.projects : [],
    categories: Array.isArray(decoded.categories) ? decoded.categories : [],
  };
}

async function encryptWorkspace(projects: GenesisProject[], categories: GenesisCategory[]) {
  const key = await importWorkspaceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({ projects, categories }));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  workspaceVersion = Math.max(workspaceVersion + 1, Date.now());
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    version: workspaceVersion,
  };
}

export async function loadGenesisWorkspace(): Promise<GenesisWorkspace> {
  const payload = await api<BootstrapPayload>("/bootstrap");
  csrfToken = payload.csrf;
  workspaceKey = payload.workspace.key;
  const structure = await decryptWorkspace(payload.workspace.envelope);
  return {
    user: payload.user,
    csrf: payload.csrf,
    tasks: payload.tasks.map((task) => normalizeTask(task)),
    projects: structure.projects,
    categories: structure.categories,
    hasRemoteStructure: payload.workspace.envelope !== null,
    syncWarning: payload.syncWarning,
  };
}

export function observeGenesisUser(
  listener: (user: GenesisUser | null) => void,
  onError?: (error: Error) => void,
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
      if (active) onError?.(error instanceof Error ? error : new Error("Сервер недоступен"));
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
  window.location.assign(`${API_BASE}/auth/google/start?return_to=${encodeURIComponent(returnTo)}`);
  return Promise.resolve();
}

export async function signOutFromGoogle() {
  await api<{ ok: boolean }>("/auth/logout", { method: "POST", body: "{}" });
  workspaceKey = "";
  localStorage.removeItem(LAST_USER_CACHE);
  window.location.reload();
}

export async function deleteGenesisAccount() {
  await api<{ ok: boolean }>("/account", { method: "DELETE", body: "{}" });
  workspaceKey = "";
  localStorage.removeItem(LAST_USER_CACHE);
  window.location.assign("/");
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
      const result = await api<{ tasks: GenesisTask[] }>("/sync/tasks");
      if (active) listener(result.tasks.map((task) => normalizeTask(task)), !navigator.onLine);
    } catch (error) {
      if (active) onError(error instanceof Error ? error : new Error("Ошибка синхронизации"));
    }
  };
  const interval = window.setInterval(poll, 30_000);
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

export async function mergeLocalWorkspace(
  _uid: string,
  local: Pick<GenesisWorkspace, "tasks" | "projects" | "categories">,
) {
  const remote = await loadGenesisWorkspace();
  if (!remote.hasRemoteStructure && (local.projects.length || local.categories.length)) {
    await saveWorkspaceStructure(local.projects, local.categories, metricsFor(local.tasks, local.projects));
  }
  const remoteById = new Map(remote.tasks.map((task) => [task.id, task]));
  for (const task of local.tasks) {
    const remoteTask = remoteById.get(task.id);
    if (!remoteTask || task.updatedAt > remoteTask.updatedAt) {
      await saveCloudTask(_uid, task);
    }
  }
}

export async function saveCloudTask(_uid: string, task: GenesisTask) {
  const path = `/tasks/${encodeURIComponent(task.id)}`;
  const body = JSON.stringify({ ...task, syncToGoogle: true });
  queueMutation({ key: `task:${task.id}`, path, method: "PUT", body });
  const result = await api<{ task: GenesisTask }>(path, { method: "PUT", body });
  clearMutation(`task:${task.id}`);
  return normalizeTask(result.task);
}

export async function removeCloudTask(_uid: string, taskId: string) {
  const path = `/tasks/${encodeURIComponent(taskId)}`;
  queueMutation({ key: `task:${taskId}`, path, method: "DELETE" });
  await api<{ ok: boolean }>(path, { method: "DELETE" });
  clearMutation(`task:${taskId}`);
}

export function metricsFor(tasks: GenesisTask[], projects: GenesisProject[]): GenesisMetrics {
  return {
    projectCount: projects.length,
    taskCount: tasks.length,
    openTaskCount: tasks.filter((task) => !task.done).length,
    completedTaskCount: tasks.filter((task) => task.done).length,
    googleSyncedCount: tasks.filter((task) => Boolean(task.googleEventId)).length,
  };
}

export async function saveWorkspaceStructure(
  projects: GenesisProject[],
  categories: GenesisCategory[],
  metrics: GenesisMetrics,
) {
  const envelope = await encryptWorkspace(projects, categories);
  const body = JSON.stringify({ ...envelope, metrics });
  queueMutation({ key: "workspace", path: "/workspace", method: "PUT", body });
  const result = await api<{ ok: boolean }>("/workspace", { method: "PUT", body });
  clearMutation("workspace");
  return result;
}

export async function saveMetrics(metrics: GenesisMetrics) {
  return api<{ ok: boolean }>("/metrics", { method: "POST", body: JSON.stringify({ metrics }) });
}

export async function loadAdminStats() {
  return api<AdminStats>("/admin/stats");
}
