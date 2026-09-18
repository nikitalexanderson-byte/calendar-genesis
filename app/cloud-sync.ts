import { recurrenceDatesForTask, type RecurrenceMode, type RecurrencePattern } from "./task-recurrence";
import { normalizeCalendarDateNote, type CalendarMode } from "./calendar-data";
import type { Language } from "./i18n";
import { legacyReminderMinutes, normalizeTaskReminders, type TaskReminder } from "./task-reminders";
import type { TimeFormat } from "./time-format";
import {
  EMPTY_HABIT_WORKSPACE,
  normalizeHabitWorkspace,
  type HabitWorkspace,
} from "./habits";

export type RecurrenceKind =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "yearly";

export type TaskOrigin = "genesis" | "google-calendar" | "google-tasks";

export type GoogleTaskList = {
  id: string;
  title: string;
  updatedAt: string | null;
  isDefault?: boolean;
  accountId?: string;
  accountEmail?: string;
};

export type GoogleAccount = {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  isPrimary: boolean;
  calendarConnected: boolean;
  googleTasksImportReady: boolean;
};

export type SyncRouting = {
  mode: "fixed" | "choose" | "category";
  defaultAccountIds: string[];
  categoryAccountIds: Record<string, string[]>;
};

export type GoogleTaskLink = {
  eventId: string | null;
  taskId: string | null;
  taskListId: string | null;
  taskListTitle: string;
};

export type TaskListProjectLink = {
  taskListId: string;
  projectId: string | null;
};

export type GenesisTask = {
  id: string;
  sacredYear: number;
  monthIndex: number;
  day: number;
  dueDate: string;
  endDate: string;
  title: string;
  description: string;
  time: string;
  project: string;
  projectId: string | null;
  categoryId: string | null;
  tags: string[];
  dependsOnIds: string[];
  priority: number;
  done: boolean;
  completedAt: string | null;
  reminders: TaskReminder[];
  /** Legacy single-reminder field kept while older local and remote tasks are migrated. */
  reminderMinutes: number | null;
  recurrence: RecurrenceKind;
  recurrenceInterval: number;
  recurrenceMode: RecurrenceMode;
  recurrencePattern: RecurrencePattern;
  recurrenceDays: number[];
  recurrenceStartDate: string | null;
  recurrenceEndDate: string | null;
  recurrenceMonths: number[];
  recurrencePyatas: number[];
  recurrenceSeriesId: string | null;
  calendarMode: CalendarMode;
  calendarNote: string;
  syncToGoogle: boolean;
  syncAccountIds: string[];
  googleLinks: Record<string, GoogleTaskLink>;
  googleAccountId: string | null;
  googleAccountEmail: string;
  createdIn: TaskOrigin;
  googleEventId: string | null;
  googleTaskId: string | null;
  googleTaskListId: string | null;
  googleTaskListTitle: string;
  googleReadOnly: boolean;
  updatedAt: number;
};

export type GenesisUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  calendarConnected: boolean;
  googleTasksImportReady: boolean;
  passwordEnabled: boolean;
  stoicheionDivinationDisabled: boolean;
  isAdmin: boolean;
  calendarMode: CalendarMode;
  taskCalendarMode?: CalendarMode;
  timeFormat?: TimeFormat;
  language: Language;
  multiAccountEnabled: boolean;
  googleAccounts: GoogleAccount[];
  syncRouting: SyncRouting;
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

export type GenesisWorkspace = HabitWorkspace & {
  user: GenesisUser;
  csrf: string;
  tasks: GenesisTask[];
  projects: GenesisProject[];
  categories: GenesisCategory[];
  taskLists: GoogleTaskList[];
  taskListLinks: TaskListProjectLink[];
  hasRemoteStructure: boolean;
  syncWarning: string | null;
  workspaceKeyMode: "legacy" | "client" | "new";
};

export type GeminiPlanProject = {
  title: string;
  description: string;
  parentProject: string;
  category: string;
  tags: string[];
};

export type GeminiPlanTaskList = {
  title: string;
  project: string;
  accountEmail: string;
};

export type GeminiPlanTask = {
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
  time: string;
  project: string;
  taskList: string;
  tags: string[];
  priority: number;
  reminderMinutes: number;
};

export type GeminiPlan = {
  request: string;
  summary: string;
  projects: GeminiPlanProject[];
  taskLists: GeminiPlanTaskList[];
  tasks: GeminiPlanTask[];
};

export type GeminiAssistantContext = {
  language: Language;
  calendarMode: CalendarMode;
  today: string;
  timeZone: string;
  categories: Array<{ name: string }>;
  projects: Array<{ title: string; parent: string; category: string }>;
  taskLists: Array<{ title: string; accountEmail: string }>;
  accounts: Array<{ email: string }>;
};

export type AssistantProvider = "local" | "gigachat" | "gemini";

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

export type StoicheionDrawKind = "daily" | "spread";

export type StoicheionDrawRecord = {
  kind: StoicheionDrawKind;
  dayKey: string;
  seed: number;
  attempts: 1 | 2;
  firstDrawAt: string;
  rerollDeadline: string;
  remainingSeconds: number;
  canReroll: boolean;
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
  taskLists: GoogleTaskList[];
  workspace: {
    key: string | null;
    keyMode: "legacy" | "client" | "new";
    wrappedKey: string | null;
    wrappedKeyIv: string | null;
    envelope: WorkspaceEnvelope | null;
  };
  syncWarning: string | null;
};

const configuredBase = process.env.NEXT_PUBLIC_GENESIS_API_URL?.trim() ?? "";
const API_BASE = configuredBase.replace(/\/$/, "");
const PENDING_KEY = "genesis-pending-mutations-v2";
const LAST_USER_CACHE = "genesis-last-user-v2";
const WORKSPACE_DEVICE_KEY_PREFIX = "genesis-workspace-device-key-v2:";

export const isGoogleSyncConfigured = Boolean(API_BASE);

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

let csrfToken = "";
let workspaceKey = "";
let workspaceUserId = "";
let workspaceVersion = Date.now();
let encryptedHabitWorkspace: HabitWorkspace = EMPTY_HABIT_WORKSPACE;

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
      "X-Genesis-Time-Zone": deviceTimeZone(),
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
  const createdIn: TaskOrigin = ["genesis", "google-calendar", "google-tasks"].includes(task.createdIn ?? "")
    ? task.createdIn as TaskOrigin
    : task.googleTaskId
      ? "google-tasks"
      : "genesis";
  const dueDate = typeof task.dueDate === "string" ? task.dueDate : "";
  const recurrenceMode: RecurrenceMode = ["none", "genesis", "classic", "lunar"].includes(task.recurrenceMode ?? "")
    ? task.recurrenceMode as RecurrenceMode
    : task.recurrence && task.recurrence !== "none" ? "classic" : "none";
  const recurrencePattern: RecurrencePattern = ["none", "daily", "weekdays", "monthly", "yearly", "pyata-days", "month-days", "lunar-days"].includes(task.recurrencePattern ?? "")
    ? task.recurrencePattern as RecurrencePattern
    : recurrenceMode === "classic"
      ? task.recurrence === "daily" || task.recurrence === "monthly" || task.recurrence === "yearly" ? task.recurrence : "weekdays"
      : recurrenceMode === "lunar" ? "lunar-days" : recurrenceMode === "genesis" ? "pyata-days" : "none";
  const recurrenceDays = Array.isArray(task.recurrenceDays)
    ? Array.from(new Set(task.recurrenceDays.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 30))).sort((left, right) => left - right)
    : [];
  const recurrenceMonths = Array.isArray(task.recurrenceMonths)
    ? Array.from(new Set(task.recurrenceMonths.map(Number).filter((month) => Number.isInteger(month) && month >= 1 && month <= 72))).sort((left, right) => left - right)
    : [];
  const recurrencePyatas = Array.isArray(task.recurrencePyatas)
    ? Array.from(new Set(task.recurrencePyatas.map(Number).filter((pyata) => Number.isInteger(pyata) && pyata >= 1 && pyata <= 6))).sort((left, right) => left - right)
    : [];
  const recurrenceStartDate = typeof task.recurrenceStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.recurrenceStartDate)
    ? task.recurrenceStartDate
    : null;
  const recurrenceEndDate = typeof task.recurrenceEndDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.recurrenceEndDate)
    ? task.recurrenceEndDate
    : null;
  const calendarMode: CalendarMode = ["profane", "sacred", "lunar"].includes(task.calendarMode ?? "")
    ? task.calendarMode as CalendarMode
    : "profane";
  const reminders = normalizeTaskReminders(task.reminders, task.reminderMinutes);
  return {
    sacredYear: 0,
    monthIndex: 0,
    day: 1,
    dueDate,
    endDate: typeof task.endDate === "string" && task.endDate ? task.endDate : dueDate,
    description: "",
    time: "",
    project: "",
    projectId: null,
    categoryId: null,
    tags: [],
    dependsOnIds: [],
    priority: 5,
    done: false,
    completedAt: null,
    recurrence: "none",
    recurrenceInterval: 1,
    syncToGoogle: true,
    googleEventId: null,
    googleTaskId: null,
    googleTaskListId: null,
    googleReadOnly: false,
    updatedAt: Date.now(),
    ...task,
    createdIn,
    recurrenceMode,
    recurrencePattern,
    recurrenceDays,
    recurrenceStartDate,
    recurrenceEndDate,
    recurrenceMonths,
    recurrencePyatas,
    recurrenceSeriesId: typeof task.recurrenceSeriesId === "string" && task.recurrenceSeriesId ? task.recurrenceSeriesId : null,
    reminders,
    reminderMinutes: legacyReminderMinutes(reminders),
    calendarMode,
    calendarNote: normalizeCalendarDateNote(typeof task.calendarNote === "string" ? task.calendarNote : "", calendarMode),
    syncAccountIds: Array.isArray(task.syncAccountIds) ? task.syncAccountIds.filter((id): id is string => typeof id === "string" && Boolean(id)) : [],
    googleLinks: task.googleLinks && typeof task.googleLinks === "object" ? task.googleLinks : {},
    googleAccountId: typeof task.googleAccountId === "string" && task.googleAccountId ? task.googleAccountId : null,
    googleAccountEmail: typeof task.googleAccountEmail === "string" ? task.googleAccountEmail : "",
    googleTaskListTitle: typeof task.googleTaskListTitle === "string" ? task.googleTaskListTitle : "",
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

type DeviceWorkspaceKey = { key: string; recoveryCode: string };

function deviceWorkspaceKey(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(`${WORKSPACE_DEVICE_KEY_PREFIX}${userId}`) || "null") as DeviceWorkspaceKey | null;
    if (!parsed || base64ToBytes(parsed.key).length !== 32 || base64ToBytes(parsed.recoveryCode).length !== 32) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeDeviceWorkspaceKey(userId: string, value: DeviceWorkspaceKey) {
  localStorage.setItem(`${WORKSPACE_DEVICE_KEY_PREFIX}${userId}`, JSON.stringify(value));
}

export function workspaceRecoveryCodeForUser(userId: string) {
  return deviceWorkspaceKey(userId)?.recoveryCode ?? "";
}

async function wrapWorkspaceKey(userId: string, rawKey: string, recoveryCode?: string) {
  const recoveryBytes = recoveryCode ? base64ToBytes(recoveryCode) : crypto.getRandomValues(new Uint8Array(32));
  if (recoveryBytes.length !== 32) throw new Error("Код восстановления должен содержать 32 байта.");
  const recovery = bytesToBase64(recoveryBytes);
  const wrappingKey = await crypto.subtle.importKey("raw", recoveryBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKey = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, base64ToBytes(rawKey));
  storeDeviceWorkspaceKey(userId, { key: rawKey, recoveryCode: recovery });
  await api<{ ok: boolean }>("/workspace/key", {
    method: "PUT",
    body: JSON.stringify({ wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)), iv: bytesToBase64(iv) }),
  });
  return recovery;
}

async function unwrapWorkspaceKey(userId: string, wrappedKey: string, wrappedKeyIv: string, recoveryCode: string) {
  const recoveryBytes = base64ToBytes(recoveryCode.trim());
  if (recoveryBytes.length !== 32) throw new Error("Неверный формат кода восстановления.");
  try {
    const wrappingKey = await crypto.subtle.importKey("raw", recoveryBytes, "AES-GCM", false, ["decrypt"]);
    const rawKey = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(wrappedKeyIv) },
      wrappingKey,
      base64ToBytes(wrappedKey),
    );
    const key = bytesToBase64(new Uint8Array(rawKey));
    storeDeviceWorkspaceKey(userId, { key, recoveryCode: recoveryCode.trim() });
    return key;
  } catch {
    throw new Error("Код восстановления не подошёл. Зашифрованные данные не изменены.");
  }
}

async function resolveWorkspaceKey(payload: BootstrapPayload) {
  workspaceUserId = payload.user.uid;
  const stored = deviceWorkspaceKey(workspaceUserId);
  if (payload.workspace.keyMode === "new") {
    workspaceKey = stored?.key ?? bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
    await wrapWorkspaceKey(workspaceUserId, workspaceKey, stored?.recoveryCode);
    return;
  }
  if (payload.workspace.keyMode === "legacy") {
    if (!payload.workspace.key) throw new Error("Ключ пространства не получен");
    workspaceKey = payload.workspace.key;
    const recoveryCode = stored?.key === workspaceKey ? stored.recoveryCode : undefined;
    try {
      await wrapWorkspaceKey(workspaceUserId, workspaceKey, recoveryCode);
    } catch {
      // Safe fallback: the server keeps the legacy key until client-key registration succeeds.
    }
    return;
  }
  if (stored?.key) {
    workspaceKey = stored.key;
    return;
  }
  if (!payload.workspace.wrappedKey || !payload.workspace.wrappedKeyIv) {
    throw new Error("Зашифрованное пространство не содержит ключ восстановления.");
  }
  const recoveryCode = window.prompt("Введите код восстановления GENESIS для расшифровки данных на этом устройстве:");
  if (!recoveryCode) throw new Error("Для доступа к зашифрованным данным нужен код восстановления из личного кабинета.");
  workspaceKey = await unwrapWorkspaceKey(workspaceUserId, payload.workspace.wrappedKey, payload.workspace.wrappedKeyIv, recoveryCode);
}

async function importWorkspaceKey() {
  if (!workspaceKey) throw new Error("Ключ пространства не получен");
  return crypto.subtle.importKey("raw", base64ToBytes(workspaceKey), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function decryptWorkspace(envelope: WorkspaceEnvelope | null): Promise<Pick<GenesisWorkspace, "projects" | "categories" | "taskListLinks"> & HabitWorkspace> {
  if (!envelope) {
    encryptedHabitWorkspace = normalizeHabitWorkspace(EMPTY_HABIT_WORKSPACE);
    return { projects: [], categories: [], taskListLinks: [], ...encryptedHabitWorkspace };
  }
  const key = await importWorkspaceKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  const decoded = JSON.parse(new TextDecoder().decode(plain)) as {
    projects?: GenesisProject[];
    categories?: GenesisCategory[];
    taskListLinks?: TaskListProjectLink[];
  } & Partial<HabitWorkspace> & { habitEntries?: unknown[] };
  workspaceVersion = Math.max(workspaceVersion, envelope.version + 1);
  encryptedHabitWorkspace = normalizeHabitWorkspace(decoded as Parameters<typeof normalizeHabitWorkspace>[0]);
  return {
    projects: Array.isArray(decoded.projects) ? decoded.projects : [],
    categories: Array.isArray(decoded.categories) ? decoded.categories : [],
    taskListLinks: Array.isArray(decoded.taskListLinks) ? decoded.taskListLinks : [],
    ...encryptedHabitWorkspace,
  };
}

async function encryptWorkspace(
  projects: GenesisProject[],
  categories: GenesisCategory[],
  taskListLinks: TaskListProjectLink[],
  habitWorkspace?: HabitWorkspace,
) {
  if (habitWorkspace) encryptedHabitWorkspace = normalizeHabitWorkspace(habitWorkspace);
  const key = await importWorkspaceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({
    projects,
    categories,
    taskListLinks,
    ...encryptedHabitWorkspace,
  }));
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
  await resolveWorkspaceKey(payload);
  let structure: Awaited<ReturnType<typeof decryptWorkspace>>;
  try {
    structure = await decryptWorkspace(payload.workspace.envelope);
  } catch (error) {
    if (payload.workspace.keyMode !== "client" || !payload.workspace.wrappedKey || !payload.workspace.wrappedKeyIv) throw error;
    const recoveryCode = window.prompt("Введите код восстановления GENESIS: локальный ключ этого устройства не подошёл к зашифрованным данным.");
    if (!recoveryCode) throw new Error("Для восстановления доступа к зашифрованным данным нужен код из личного кабинета.");
    workspaceKey = await unwrapWorkspaceKey(workspaceUserId, payload.workspace.wrappedKey, payload.workspace.wrappedKeyIv, recoveryCode);
    structure = await decryptWorkspace(payload.workspace.envelope);
  }
  return {
    user: payload.user,
    csrf: payload.csrf,
    tasks: payload.tasks.map((task) => normalizeTask(task)),
    projects: structure.projects,
    categories: structure.categories,
    taskLists: Array.isArray(payload.taskLists) ? payload.taskLists : [],
    taskListLinks: structure.taskListLinks,
    trackerSchemaVersion: structure.trackerSchemaVersion,
    habits: structure.habits,
    habitCompletions: structure.habitCompletions,
    sleepPlans: structure.sleepPlans,
    sleepEntries: structure.sleepEntries,
    moodEntries: structure.moodEntries,
    addictionTrackers: structure.addictionTrackers,
    addictionEntries: structure.addictionEntries,
    analyticsSnapshots: structure.analyticsSnapshots,
    habitSettings: structure.habitSettings,
    hasRemoteStructure: payload.workspace.envelope !== null,
    syncWarning: payload.syncWarning,
    workspaceKeyMode: payload.workspace.keyMode,
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
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`${API_BASE}/auth/google/start?purpose=login&return_to=${encodeURIComponent(returnTo)}`);
  return Promise.resolve();
}

export function connectGoogleServices() {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`${API_BASE}/auth/google/start?purpose=services&return_to=${encodeURIComponent(returnTo)}`);
  return Promise.resolve();
}

export function connectAdditionalGoogleAccount() {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`${API_BASE}/auth/google/start?purpose=link&return_to=${encodeURIComponent(returnTo)}`);
  return Promise.resolve();
}

export function consumeGoogleAuthError() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const code = url.searchParams.get("auth_error");
  if (!code) return "";
  url.searchParams.delete("auth_error");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  const messages: Record<string, string> = {
    access_denied: "Вы отменили вход или подключение сервисов Google. Доступ к данным не был предоставлен.",
    invalid_state: "Защитная проверка входа истекла. Пожалуйста, начните вход заново.",
    session_expired: "Сессия GENESIS истекла. Войдите ещё раз и повторите подключение.",
    account_mismatch: "Для подключения выберите тот же аккаунт Google, с которым вы вошли в GENESIS.",
    missing_permissions: "Google не предоставил необходимые разрешения Calendar и Tasks. Подключение не завершено.",
    oauth_failed: "Google не завершил авторизацию. Попробуйте ещё раз или обратитесь в поддержку.",
  };
  return messages[code] ?? messages.oauth_failed;
}

export async function signOutFromGoogle() {
  await api<{ ok: boolean }>("/auth/logout", { method: "POST", body: "{}" });
  workspaceKey = "";
  workspaceUserId = "";
  localStorage.removeItem(LAST_USER_CACHE);
  window.location.reload();
}

export async function deleteGenesisAccount() {
  await api<{ ok: boolean }>("/account", { method: "DELETE", body: "{}" });
  if (workspaceUserId) localStorage.removeItem(`${WORKSPACE_DEVICE_KEY_PREFIX}${workspaceUserId}`);
  workspaceKey = "";
  workspaceUserId = "";
  localStorage.removeItem(LAST_USER_CACHE);
  window.location.assign("/");
}

export function disconnectGoogleServices() {
  return api<{ user: GenesisUser }>("/account/google-services/disconnect", {
    method: "POST",
    body: "{}",
  });
}

export async function updateAccountPreferences(preferences: Partial<{
  stoicheionDivinationDisabled: boolean;
  calendarMode: CalendarMode;
  taskCalendarMode: CalendarMode;
  timeFormat: TimeFormat;
  language: Language;
  syncRouting: SyncRouting;
}>) {
  return api<{ user: GenesisUser }>("/account/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  });
}

export function removeAdditionalGoogleAccount(accountId: string) {
  return api<{ user: GenesisUser }>(`/account/google-accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
    body: "{}",
  });
}

export function observeCloudTasks(
  _uid: string,
  listener: (tasks: GenesisTask[], taskLists: GoogleTaskList[], fromCache: boolean, warning: string | null) => void,
  onError: (error: Error) => void,
) {
  let active = true;
  const poll = async () => {
    try {
      await flushPendingMutations();
      const result = await api<{ tasks: GenesisTask[]; taskLists?: GoogleTaskList[]; syncWarning?: string | null }>("/sync/tasks");
      if (active) listener(
        result.tasks.map((task) => normalizeTask(task)),
        Array.isArray(result.taskLists) ? result.taskLists : [],
        !navigator.onLine,
        result.syncWarning ?? null,
      );
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
  local: Pick<GenesisWorkspace, "tasks" | "projects" | "categories" | "taskListLinks"> & Partial<HabitWorkspace>,
) {
  const remote = await loadGenesisWorkspace();
  if (!remote.hasRemoteStructure && (local.projects.length || local.categories.length || local.taskListLinks.length || local.habits?.length)) {
    await saveWorkspaceStructure(
      local.projects,
      local.categories,
      local.taskListLinks,
      metricsFor(local.tasks, local.projects),
      normalizeHabitWorkspace(local),
    );
  } else if (remote.hasRemoteStructure && !remote.habits.length && local.habits?.length) {
    await saveWorkspaceStructure(
      remote.projects,
      remote.categories,
      remote.taskListLinks,
      metricsFor(local.tasks, remote.projects),
      normalizeHabitWorkspace(local),
    );
  }
  if (!remote.user.calendarConnected) return;
  const remoteById = new Map(remote.tasks.map((task) => [task.id, task]));
  for (const task of local.tasks) {
    if (task.googleTaskId) continue;
    const remoteTask = remoteById.get(task.id);
    if (!remoteTask || task.updatedAt > remoteTask.updatedAt) {
      await saveCloudTask(_uid, task);
    }
  }
}

export async function saveCloudTask(_uid: string, task: GenesisTask) {
  const path = `/tasks/${encodeURIComponent(task.id)}`;
  const body = JSON.stringify({
    ...task,
    recurrenceDates: recurrenceDatesForTask(task),
    syncToGoogle: true,
  });
  queueMutation({ key: `task:${task.id}`, path, method: "PUT", body });
  const result = await api<{ task: GenesisTask }>(path, { method: "PUT", body });
  clearMutation(`task:${task.id}`);
  return normalizeTask(result.task);
}

export async function removeCloudTask(_uid: string, task: GenesisTask) {
  const path = `/tasks/${encodeURIComponent(task.id)}`;
  const body = JSON.stringify({
    googleEventId: task.googleEventId,
    googleTaskId: task.googleTaskId,
    googleTaskListId: task.googleTaskListId,
    googleLinks: task.googleLinks,
  });
  queueMutation({ key: `task:${task.id}`, path, method: "DELETE", body });
  await api<{ ok: boolean }>(path, { method: "DELETE", body });
  clearMutation(`task:${task.id}`);
}

export function metricsFor(tasks: GenesisTask[], projects: GenesisProject[]): GenesisMetrics {
  return {
    projectCount: projects.length,
    taskCount: tasks.length,
    openTaskCount: tasks.filter((task) => !task.done).length,
    completedTaskCount: tasks.filter((task) => task.done).length,
    googleSyncedCount: tasks.filter((task) => Boolean(task.googleEventId || task.googleTaskId)).length,
  };
}

export async function saveWorkspaceStructure(
  projects: GenesisProject[],
  categories: GenesisCategory[],
  taskListLinks: TaskListProjectLink[],
  metrics: GenesisMetrics,
  habitWorkspace?: HabitWorkspace,
) {
  const envelope = await encryptWorkspace(projects, categories, taskListLinks, habitWorkspace);
  const body = JSON.stringify({ ...envelope, metrics });
  queueMutation({ key: "workspace", path: "/workspace", method: "PUT", body });
  const result = await api<{ ok: boolean }>("/workspace", { method: "PUT", body });
  clearMutation("workspace");
  return result;
}

export async function createGoogleTaskList(title: string, accountId?: string) {
  return api<{ taskList: GoogleTaskList }>("/task-lists", {
    method: "POST",
    body: JSON.stringify({ title, accountId }),
  });
}

export async function updateGoogleTaskList(taskListId: string, title: string, accountId?: string) {
  return api<{ taskList: GoogleTaskList }>(`/task-lists/${encodeURIComponent(taskListId)}`, {
    method: "PATCH",
    body: JSON.stringify({ title, accountId }),
  });
}

export async function removeGoogleTaskList(taskListId: string, accountId?: string) {
  return api<{ ok: boolean }>(`/task-lists/${encodeURIComponent(taskListId)}`, {
    method: "DELETE",
    body: JSON.stringify({ accountId }),
  });
}

export async function saveMetrics(metrics: GenesisMetrics) {
  return api<{ ok: boolean }>("/metrics", { method: "POST", body: JSON.stringify({ metrics }) });
}

export async function loadAdminStats() {
  return api<AdminStats>("/admin/stats");
}

export async function loadStoicheionDraws() {
  return api<{ dayKey: string; draws: Partial<Record<StoicheionDrawKind, StoicheionDrawRecord>> }>("/stoicheion/draws");
}

export async function saveStoicheionDraw(kind: StoicheionDrawKind, seed: number) {
  return api<{ draw: StoicheionDrawRecord }>("/stoicheion/draws", {
    method: "POST",
    body: JSON.stringify({ kind, seed: seed >>> 0 }),
  });
}

export async function requestAssistantPlan(payload: {
  command: string;
  audio: { data: string; mimeType: string } | null;
  context: GeminiAssistantContext;
}) {
  return api<{ provider: Exclude<AssistantProvider, "local">; model: string; plan: GeminiPlan }>("/assistant/plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loadAssistantStatus() {
  return api<{ available: boolean; provider: AssistantProvider; model: string; audioAvailable: boolean }>("/assistant/status");
}
