import { recurrenceDatesForTask, type RecurrenceMode, type RecurrencePattern } from "./task-recurrence";
import { normalizeCalendarDateNote, type CalendarMode } from "./calendar-data";
import type { Language } from "./i18n";
import { legacyReminderMinutes, normalizeTaskReminders, type TaskReminder } from "./task-reminders";
import type { TimeFormat } from "./time-format";
import { ThemeConflictError, type GenesisTheme } from "./theme-controller";
import { cleanTaskDescription } from "./task-description";
import { cleanGenesisAppUrl } from "./app-url";
import {
  EMPTY_HABIT_WORKSPACE,
  normalizeHabitWorkspace,
  type HabitWorkspace,
} from "./habits";
import { clearTrackerAnalyticsCache } from "./tracker-cache";
import {
  mergeWorkspaceDocuments,
  normalizeWorkspaceSyncMetadata,
  prepareWorkspaceForSync,
  type SyncableWorkspaceDocument,
  type WorkspaceSyncMetadata,
} from "./workspace-sync-state";

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
  recurrenceExcludedDates: string[];
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
  theme?: GenesisTheme;
  themeRevision?: number;
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
  workspaceKeyMode: "account" | "legacy" | "client" | "new";
};

export type WorkspaceRecoveryReason = "new-device" | "key-mismatch";

export type WorkspaceRecoveryRequest = {
  reason: WorkspaceRecoveryReason;
  validate: (recoveryCode: string) => Promise<void>;
};

type WorkspaceRecoveryRequestHandler = (request: WorkspaceRecoveryRequest) => Promise<boolean>;

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
  habitCount: number;
};

export type AdminUserStats = {
  id: string;
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
  habitCount: number;
  isAdmin: boolean;
  metricsUpdatedAt: string | null;
};

export type AdminStats = {
  users: AdminUserStats[];
  totals: { users: number; projects: number; tasks: number; completedTasks: number; habits: number; blockedIdentities: number };
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

export type WorkspaceEnvelope = {
  ciphertext: string;
  iv: string;
  version: number;
  updatedAt: string;
};

export type EncryptedWorkspaceStructure = Pick<GenesisWorkspace, "projects" | "categories" | "taskListLinks"> & HabitWorkspace;

type WorkspaceSaveResponse = {
  ok: boolean;
  workspace: { version: number; updatedAt: string };
};

type WorkspaceEnvelopeRequest = {
  ciphertext: string;
  iv: string;
  version: number;
  expectedVersion: number;
  metrics: GenesisMetrics;
};

type BootstrapPayload = {
  user: GenesisUser;
  csrf: string;
  tasks: GenesisTask[];
  taskLists: GoogleTaskList[];
  workspace: {
    key: string | null;
    keyMode: "account" | "legacy" | "client" | "new";
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
const WORKSPACE_DEVICE_ID_PREFIX = "genesis-workspace-device-id-v1:";
const WORKSPACE_SYNC_STATE_PREFIX = "genesis-workspace-sync-state-v1:";
const API_TIMEOUT_MS = 20_000;
export const GENESIS_LEGACY_WORKSPACE_STORAGE_KEY = "genesis-calendar-v1";
export const GENESIS_USER_WORKSPACE_STORAGE_PREFIX = "genesis-calendar-v2:";

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
let workspaceVersion = 0;
let workspaceDeviceId = "";
let workspaceBase: EncryptedWorkspaceStructure | null = null;
let workspaceBaseMetadata: WorkspaceSyncMetadata | null = null;
let workspaceSyncMetadata: WorkspaceSyncMetadata | null = null;
let encryptedHabitWorkspace: HabitWorkspace = EMPTY_HABIT_WORKSPACE;
let workspaceMutationLock: Promise<void> = Promise.resolve();
let workspaceRecoveryRequestHandler: WorkspaceRecoveryRequestHandler | null = null;
const workspaceUpdateListeners = new Set<(workspace: EncryptedWorkspaceStructure, userId: string) => void>();

type WorkspaceSyncCache = {
  version: number;
  base: EncryptedWorkspaceStructure | null;
  baseMetadata: WorkspaceSyncMetadata | null;
  metadata: WorkspaceSyncMetadata | null;
};

export function observeEncryptedWorkspaceUpdates(listener: (workspace: EncryptedWorkspaceStructure, userId: string) => void) {
  workspaceUpdateListeners.add(listener);
  return () => {
    workspaceUpdateListeners.delete(listener);
  };
}

export function registerWorkspaceRecoveryRequestHandler(handler: WorkspaceRecoveryRequestHandler) {
  workspaceRecoveryRequestHandler = handler;
  return () => {
    if (workspaceRecoveryRequestHandler === handler) workspaceRecoveryRequestHandler = null;
  };
}

function publishWorkspaceUpdate(workspace: EncryptedWorkspaceStructure) {
  const userId = workspaceUserId;
  workspaceUpdateListeners.forEach((listener) => listener(workspace, userId));
}

async function withWorkspaceMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = workspaceMutationLock;
  let release: () => void = () => undefined;
  workspaceMutationLock = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

type PendingMutation = {
  key: string;
  path: string;
  method: "PUT" | "DELETE" | "POST";
  body?: string;
};

function pendingStorageKey(userId = workspaceUserId) {
  return `${PENDING_KEY}:${userId || "anonymous"}`;
}

function readPending(): PendingMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const storageKey = pendingStorageKey();
    if (workspaceUserId && !localStorage.getItem(storageKey) && localStorage.getItem(PENDING_KEY)) {
      localStorage.setItem(storageKey, localStorage.getItem(PENDING_KEY) || "[]");
      localStorage.removeItem(PENDING_KEY);
    }
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]") as unknown;
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
    localStorage.setItem(pendingStorageKey(), JSON.stringify(items.slice(-2000)));
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

class GenesisApiError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown> | null;

  constructor(status: number, payload: Record<string, unknown> | null, message: string) {
    super(message);
    this.name = "GenesisApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const { signal: callerSignal, ...requestInit } = init;
  const requestController = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => requestController.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, API_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...requestInit,
      credentials: "include",
      signal: requestController.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Genesis-Time-Zone": deviceTimeZone(),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (timedOut) throw new Error("Сервер GENESIS не ответил за 20 секунд. Изменения сохранены на устройстве и будут синхронизированы позже.");
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
  const payload = (await response.json().catch(() => null)) as ({ error?: string } & Record<string, unknown>) | null;
  if (!response.ok) {
    throw new GenesisApiError(response.status, payload, payload?.error || `GENESIS API ${response.status}`);
  }
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
    if (mutation.key === "workspace" && mutation.body) {
      await withWorkspaceMutationLock(async () => {
        const queued = readPending().find((item) => item.key === "workspace" && item.body);
        if (!queued?.body) return;
        const body = JSON.parse(queued.body) as WorkspaceEnvelopeRequest;
        const local = await decryptWorkspaceEnvelope({ ...body, updatedAt: new Date().toISOString() });
        const result = await sendWorkspaceMutation(body);
        if (workspaceVersion < result.workspace.version) {
          adoptSavedWorkspace(local.structure, local.metadata, result.workspace);
        }
        clearMutation(queued.key);
      });
      continue;
    }
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
  const recurrenceExcludedDates = Array.isArray(task.recurrenceExcludedDates)
    ? Array.from(new Set(task.recurrenceExcludedDates.filter((date): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)))).sort()
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
    description: cleanTaskDescription(task.description),
    createdIn,
    recurrenceMode,
    recurrencePattern,
    recurrenceDays,
    recurrenceStartDate,
    recurrenceEndDate,
    recurrenceMonths,
    recurrencePyatas,
    recurrenceExcludedDates,
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

function deviceWorkspaceId(userId: string) {
  if (typeof window === "undefined") return "server";
  const storageKey = `${WORKSPACE_DEVICE_ID_PREFIX}${userId}`;
  const stored = localStorage.getItem(storageKey)?.trim();
  if (stored) return stored;
  const generated = bytesToBase64(crypto.getRandomValues(new Uint8Array(18)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  localStorage.setItem(storageKey, generated);
  return generated;
}

function workspaceDocument(structure: EncryptedWorkspaceStructure, metadata = workspaceSyncMetadata) {
  return {
    projects: structure.projects,
    categories: structure.categories,
    taskListLinks: structure.taskListLinks,
    trackerSchemaVersion: structure.trackerSchemaVersion,
    userProgress: structure.userProgress,
    habits: structure.habits,
    habitCompletions: structure.habitCompletions,
    sleepPlans: structure.sleepPlans,
    sleepEntries: structure.sleepEntries,
    moodEntries: structure.moodEntries,
    addictionTrackers: structure.addictionTrackers,
    addictionEntries: structure.addictionEntries,
    analyticsSnapshots: structure.analyticsSnapshots,
    dailyGoalRecords: structure.dailyGoalRecords,
    quests: structure.quests,
    achievementUnlocks: structure.achievementUnlocks,
    rewardTransactions: structure.rewardTransactions,
    streakFreezeTransactions: structure.streakFreezeTransactions,
    habitSettings: structure.habitSettings,
    hiddenDefaultTemplates: structure.hiddenDefaultTemplates,
    ...(metadata ? { syncMetadata: metadata } : {}),
  } satisfies SyncableWorkspaceDocument;
}

function structureFromDocument(document: SyncableWorkspaceDocument): EncryptedWorkspaceStructure {
  const normalized = normalizeHabitWorkspace(document as Parameters<typeof normalizeHabitWorkspace>[0]);
  return {
    projects: Array.isArray(document.projects) ? document.projects as GenesisProject[] : [],
    categories: Array.isArray(document.categories) ? document.categories as GenesisCategory[] : [],
    taskListLinks: Array.isArray(document.taskListLinks) ? document.taskListLinks as TaskListProjectLink[] : [],
    ...normalized,
  };
}

function syncFallback(version = workspaceVersion, updatedAt = new Date().toISOString(), deviceId = workspaceDeviceId || "legacy") {
  return { version: Math.max(1, version), updatedAt, deviceId };
}

function readWorkspaceSyncCache(userId = workspaceUserId): WorkspaceSyncCache | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(`${WORKSPACE_SYNC_STATE_PREFIX}${userId}`) || "null") as WorkspaceSyncCache | null;
    if (!parsed || typeof parsed !== "object") return null;
    const version = Math.max(0, Math.round(Number(parsed.version) || 0));
    const base = parsed.base && typeof parsed.base === "object" ? structureFromDocument(parsed.base as unknown as SyncableWorkspaceDocument) : null;
    const baseMetadata = normalizeWorkspaceSyncMetadata(parsed.baseMetadata ?? parsed.metadata, syncFallback(version));
    const metadata = normalizeWorkspaceSyncMetadata(parsed.metadata, syncFallback(version));
    return { version, base, baseMetadata, metadata };
  } catch {
    return null;
  }
}

function persistWorkspaceSyncCache() {
  if (typeof window === "undefined" || !workspaceUserId) return;
  const cache: WorkspaceSyncCache = {
    version: workspaceVersion,
    base: workspaceBase,
    baseMetadata: workspaceBaseMetadata,
    metadata: workspaceSyncMetadata,
  };
  localStorage.setItem(`${WORKSPACE_SYNC_STATE_PREFIX}${workspaceUserId}`, JSON.stringify(cache));
}

function restoreWorkspaceSyncCache() {
  const cached = readWorkspaceSyncCache();
  if (!cached) return;
  workspaceVersion = cached.version;
  workspaceBase = cached.base;
  workspaceBaseMetadata = cached.baseMetadata;
  workspaceSyncMetadata = cached.metadata;
  if (cached.base) encryptedHabitWorkspace = normalizeHabitWorkspace(cached.base);
}

export function restoreOfflineWorkspaceSession(userId: string) {
  workspaceUserId = userId;
  workspaceDeviceId = deviceWorkspaceId(userId);
  const stored = deviceWorkspaceKey(userId);
  workspaceKey = stored?.key ?? "";
  restoreWorkspaceSyncCache();
  return Boolean(workspaceKey);
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
    body: JSON.stringify({ key: rawKey, wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)), iv: bytesToBase64(iv) }),
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

async function recoverWorkspaceKey(
  reason: WorkspaceRecoveryReason,
  wrappedKey: string,
  wrappedKeyIv: string,
  cancelledMessage: string,
) {
  const handler = workspaceRecoveryRequestHandler;
  if (!handler) throw new Error(cancelledMessage);
  let recoveredKey = "";
  const accepted = await handler({
    reason,
    validate: async (recoveryCode) => {
      recoveredKey = await unwrapWorkspaceKey(workspaceUserId, wrappedKey, wrappedKeyIv, recoveryCode);
    },
  });
  if (!accepted || !recoveredKey) throw new Error(cancelledMessage);
  workspaceKey = recoveredKey;
}

async function resolveWorkspaceKey(payload: BootstrapPayload) {
  workspaceUserId = payload.user.uid;
  workspaceDeviceId = deviceWorkspaceId(workspaceUserId);
  restoreWorkspaceSyncCache();
  const stored = deviceWorkspaceKey(workspaceUserId);
  if (payload.workspace.keyMode === "new") {
    workspaceKey = stored?.key ?? bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
    await wrapWorkspaceKey(workspaceUserId, workspaceKey, stored?.recoveryCode);
    return;
  }
  if (payload.workspace.keyMode === "account" || payload.workspace.keyMode === "legacy") {
    if (!payload.workspace.key) throw new Error("Ключ пространства не получен");
    workspaceKey = payload.workspace.key;
    if (stored?.key !== workspaceKey) {
      storeDeviceWorkspaceKey(workspaceUserId, {
        key: workspaceKey,
        recoveryCode: stored?.recoveryCode ?? bytesToBase64(crypto.getRandomValues(new Uint8Array(32))),
      });
    }
    return;
  }
  if (stored?.key) {
    workspaceKey = stored.key;
    await wrapWorkspaceKey(workspaceUserId, workspaceKey, stored.recoveryCode);
    return;
  }
  if (!payload.workspace.wrappedKey || !payload.workspace.wrappedKeyIv) {
    throw new Error("Зашифрованное пространство не содержит ключ восстановления.");
  }
  await recoverWorkspaceKey(
    "new-device",
    payload.workspace.wrappedKey,
    payload.workspace.wrappedKeyIv,
    "Для доступа к зашифрованным данным нужен код восстановления из личного кабинета.",
  );
  await wrapWorkspaceKey(workspaceUserId, workspaceKey, deviceWorkspaceKey(workspaceUserId)?.recoveryCode);
}

async function importWorkspaceKey() {
  if (!workspaceKey) throw new Error("Ключ пространства не получен");
  return crypto.subtle.importKey("raw", base64ToBytes(workspaceKey), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function decryptWorkspaceEnvelope(envelope: WorkspaceEnvelope): Promise<{
  structure: EncryptedWorkspaceStructure;
  metadata: WorkspaceSyncMetadata;
}> {
  const key = await importWorkspaceKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  const decoded = JSON.parse(new TextDecoder().decode(plain)) as SyncableWorkspaceDocument & { habitEntries?: unknown[] };
  const metadata = normalizeWorkspaceSyncMetadata(
    decoded.syncMetadata,
    syncFallback(envelope.version, envelope.updatedAt, "legacy"),
  );
  return { structure: structureFromDocument(decoded), metadata };
}

async function decryptWorkspace(envelope: WorkspaceEnvelope | null): Promise<EncryptedWorkspaceStructure> {
  if (!envelope) {
    workspaceVersion = 0;
    workspaceSyncMetadata = normalizeWorkspaceSyncMetadata(null, syncFallback(1));
    workspaceBaseMetadata = workspaceSyncMetadata;
    encryptedHabitWorkspace = normalizeHabitWorkspace(EMPTY_HABIT_WORKSPACE);
    workspaceBase = { projects: [], categories: [], taskListLinks: [], ...encryptedHabitWorkspace };
    persistWorkspaceSyncCache();
    return workspaceBase;
  }
  const decrypted = await decryptWorkspaceEnvelope(envelope);
  workspaceVersion = envelope.version;
  workspaceBase = decrypted.structure;
  workspaceBaseMetadata = decrypted.metadata;
  workspaceSyncMetadata = decrypted.metadata;
  encryptedHabitWorkspace = normalizeHabitWorkspace(decrypted.structure);
  persistWorkspaceSyncCache();
  return decrypted.structure;
}

async function encryptWorkspace(
  projects: GenesisProject[],
  categories: GenesisCategory[],
  taskListLinks: TaskListProjectLink[],
  habitWorkspace?: HabitWorkspace,
) {
  if (habitWorkspace) encryptedHabitWorkspace = normalizeHabitWorkspace(habitWorkspace);
  const current: EncryptedWorkspaceStructure = { projects, categories, taskListLinks, ...encryptedHabitWorkspace };
  const timestamp = new Date().toISOString();
  const prepared = prepareWorkspaceForSync({
    current: workspaceDocument(current),
    base: workspaceBase ? workspaceDocument(workspaceBase, workspaceBaseMetadata) : null,
    metadata: workspaceSyncMetadata,
    baseMetadata: workspaceBaseMetadata,
    clock: syncFallback(workspaceVersion + 1, timestamp, workspaceDeviceId),
  });
  const structure = structureFromDocument(prepared.document);
  workspaceSyncMetadata = prepared.metadata;
  const key = await importWorkspaceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(workspaceDocument(structure, prepared.metadata)));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    envelope: {
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
      iv: bytesToBase64(iv),
      version: workspaceVersion + 1,
      expectedVersion: workspaceVersion,
    },
    structure,
    metadata: prepared.metadata,
  };
}

async function encryptWorkspaceDocument(
  structure: EncryptedWorkspaceStructure,
  metadata: WorkspaceSyncMetadata,
  expectedVersion: number,
) {
  const key = await importWorkspaceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(workspaceDocument(structure, metadata)));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    version: expectedVersion + 1,
    expectedVersion,
  };
}

async function fetchWorkspaceEnvelope() {
  const payload = await api<{ workspace: { envelope: WorkspaceEnvelope | null } }>("/workspace");
  return payload.workspace.envelope;
}

function adoptSavedWorkspace(
  structure: EncryptedWorkspaceStructure,
  metadata: WorkspaceSyncMetadata,
  saved: WorkspaceSaveResponse["workspace"],
) {
  workspaceVersion = saved.version;
  workspaceBase = structure;
  workspaceBaseMetadata = metadata;
  workspaceSyncMetadata = metadata;
  encryptedHabitWorkspace = normalizeHabitWorkspace(structure);
  persistWorkspaceSyncCache();
}

async function resolveWorkspaceConflict(body: WorkspaceEnvelopeRequest) {
  const remoteEnvelope = await fetchWorkspaceEnvelope();
  if (!remoteEnvelope) throw new Error("WORKSPACE_CONFLICT_WITHOUT_REMOTE");
  const [local, remote] = await Promise.all([
    decryptWorkspaceEnvelope({ ...body, updatedAt: new Date().toISOString() }),
    decryptWorkspaceEnvelope(remoteEnvelope),
  ]);
  const merged = mergeWorkspaceDocuments({
    left: workspaceDocument(local.structure, local.metadata),
    right: workspaceDocument(remote.structure, remote.metadata),
    leftFallback: syncFallback(body.version, new Date().toISOString(), workspaceDeviceId),
    rightFallback: syncFallback(remoteEnvelope.version, remoteEnvelope.updatedAt, "remote"),
  });
  const mergedStructure = structureFromDocument(merged.document);
  const envelope = await encryptWorkspaceDocument(mergedStructure, merged.metadata, remoteEnvelope.version);
  const retryBody: WorkspaceEnvelopeRequest = {
    ...envelope,
    metrics: { ...body.metrics, projectCount: mergedStructure.projects.length },
  };
  const serialized = JSON.stringify(retryBody);
  queueMutation({ key: "workspace", path: "/workspace", method: "PUT", body: serialized });
  const response = await api<WorkspaceSaveResponse>("/workspace", { method: "PUT", body: serialized });
  adoptSavedWorkspace(mergedStructure, merged.metadata, response.workspace);
  clearMutation("workspace");
  publishWorkspaceUpdate(mergedStructure);
  return response;
}

async function sendWorkspaceMutation(body: WorkspaceEnvelopeRequest) {
  try {
    const response = await api<WorkspaceSaveResponse>("/workspace", { method: "PUT", body: JSON.stringify(body) });
    return response;
  } catch (error) {
    if (error instanceof GenesisApiError && error.status === 409) return resolveWorkspaceConflict(body);
    throw error;
  }
}

async function refreshWorkspaceFromCloud() {
  await withWorkspaceMutationLock(async () => {
    if (readPending().some((mutation) => mutation.key === "workspace")) return;
    const envelope = await fetchWorkspaceEnvelope();
    if (!envelope || envelope.version <= workspaceVersion) return;
    const remote = await decryptWorkspaceEnvelope(envelope);
    workspaceVersion = envelope.version;
    workspaceBase = remote.structure;
    workspaceBaseMetadata = remote.metadata;
    workspaceSyncMetadata = remote.metadata;
    encryptedHabitWorkspace = normalizeHabitWorkspace(remote.structure);
    persistWorkspaceSyncCache();
    publishWorkspaceUpdate(remote.structure);
  });
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
    await recoverWorkspaceKey(
      "key-mismatch",
      payload.workspace.wrappedKey,
      payload.workspace.wrappedKeyIv,
      "Для восстановления доступа к зашифрованным данным нужен код из личного кабинета.",
    );
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
    userProgress: structure.userProgress,
    habits: structure.habits,
    habitCompletions: structure.habitCompletions,
    sleepPlans: structure.sleepPlans,
    sleepEntries: structure.sleepEntries,
    moodEntries: structure.moodEntries,
    addictionTrackers: structure.addictionTrackers,
    addictionEntries: structure.addictionEntries,
    analyticsSnapshots: structure.analyticsSnapshots,
    dailyGoalRecords: structure.dailyGoalRecords,
    quests: structure.quests,
    achievementUnlocks: structure.achievementUnlocks,
    rewardTransactions: structure.rewardTransactions,
    streakFreezeTransactions: structure.streakFreezeTransactions,
    habitSettings: structure.habitSettings,
    hiddenDefaultTemplates: structure.hiddenDefaultTemplates,
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
      const user = await loadGenesisSession();
      if (active) listener(user);
    } catch (error) {
      if (active) onError?.(error instanceof Error ? error : new Error("Сервер недоступен"));
    }
  };
  void poll();
  const interval = window.setInterval(poll, 60_000);
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

export async function loadGenesisSession(signal?: AbortSignal) {
  const result = await api<{ user: GenesisUser | null; csrf: string }>("/session", { signal });
  csrfToken = result.csrf;
  return result.user;
}

export function signInWithGoogle() {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const returnTo = cleanGenesisAppUrl(window.location.href);
  window.location.assign(`${API_BASE}/auth/google/start?purpose=login&return_to=${encodeURIComponent(returnTo)}`);
  return Promise.resolve();
}

export function connectGoogleServices() {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const returnTo = cleanGenesisAppUrl(window.location.href);
  window.location.assign(`${API_BASE}/auth/google/start?purpose=services&return_to=${encodeURIComponent(returnTo)}`);
  return Promise.resolve();
}

export function connectAdditionalGoogleAccount() {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const returnTo = cleanGenesisAppUrl(window.location.href);
  window.location.assign(`${API_BASE}/auth/google/start?purpose=link&return_to=${encodeURIComponent(returnTo)}`);
  return Promise.resolve();
}

export function consumeGoogleAuthError() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const code = url.searchParams.get("auth_error");
  if (!code) return "";
  url.searchParams.delete("auth_error");
  window.history.replaceState(window.history.state, "", cleanGenesisAppUrl(url));
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
  workspaceVersion = 0;
  workspaceDeviceId = "";
  workspaceBase = null;
  workspaceBaseMetadata = null;
  workspaceSyncMetadata = null;
  localStorage.removeItem(LAST_USER_CACHE);
  window.location.reload();
}

export async function deleteGenesisAccount(userId?: string) {
  const deletedUserId = userId || workspaceUserId || "";
  const result = await api<{ ok: boolean; deleted: boolean }>("/account", { method: "DELETE", body: "{}" });
  if (!result.deleted) throw new Error("Сервер не подтвердил полное удаление аккаунта.");
  if (deletedUserId) {
    localStorage.removeItem(`${WORKSPACE_DEVICE_KEY_PREFIX}${deletedUserId}`);
    localStorage.removeItem(`${WORKSPACE_DEVICE_ID_PREFIX}${deletedUserId}`);
    localStorage.removeItem(`${WORKSPACE_SYNC_STATE_PREFIX}${deletedUserId}`);
    localStorage.removeItem(pendingStorageKey(deletedUserId));
    localStorage.removeItem(`${GENESIS_USER_WORKSPACE_STORAGE_PREFIX}${deletedUserId}`);
    await clearTrackerAnalyticsCache(deletedUserId);
  }
  localStorage.removeItem(GENESIS_LEGACY_WORKSPACE_STORAGE_KEY);
  localStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(LAST_USER_CACHE);
  csrfToken = "";
  workspaceKey = "";
  workspaceUserId = "";
  workspaceVersion = 0;
  workspaceDeviceId = "";
  workspaceBase = null;
  workspaceBaseMetadata = null;
  workspaceSyncMetadata = null;
  encryptedHabitWorkspace = normalizeHabitWorkspace(EMPTY_HABIT_WORKSPACE);
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
  theme: GenesisTheme;
  expectedThemeRevision: number;
  language: Language;
  syncRouting: SyncRouting;
}>, signal?: AbortSignal) {
  try {
    return await api<{ user: GenesisUser }>("/account/preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
      signal,
    });
  } catch (error) {
    if ("theme" in preferences && error instanceof GenesisApiError && error.status === 409) {
      throw new ThemeConflictError(error.message);
    }
    throw error;
  }
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
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      await flushPendingMutations();
      await refreshWorkspaceFromCloud();
      const result = await api<{ tasks: GenesisTask[]; taskLists?: GoogleTaskList[]; syncWarning?: string | null }>("/sync/tasks");
      if (active) listener(
        result.tasks.map((task) => normalizeTask(task)),
        Array.isArray(result.taskLists) ? result.taskLists : [],
        !navigator.onLine,
        result.syncWarning ?? null,
      );
    } catch (error) {
      if (active) onError(error instanceof Error ? error : new Error("Ошибка синхронизации"));
    } finally {
      polling = false;
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

export function observeCloudWorkspace(onError?: (error: Error) => void) {
  let active = true;
  let polling = false;
  const poll = async () => {
    if (!workspaceUserId || !workspaceKey || polling) return;
    polling = true;
    try {
      await flushPendingMutations();
      await refreshWorkspaceFromCloud();
    } catch (error) {
      if (active) onError?.(error instanceof Error ? error : new Error("WORKSPACE_SYNC_FAILED"));
    } finally {
      polling = false;
    }
  };
  const interval = window.setInterval(poll, 30_000);
  const refresh = () => void poll();
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
  void poll();
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
  if (readPending().some((mutation) => mutation.key === "workspace")) {
    await flushPendingMutations();
  } else if (!remote.hasRemoteStructure && (local.projects.length || local.categories.length || local.taskListLinks.length || local.habits?.length)) {
    await saveWorkspaceStructure(
      local.projects,
      local.categories,
      local.taskListLinks,
      metricsFor(local.tasks, local.projects, local.habits?.length ?? 0),
      normalizeHabitWorkspace(local),
    );
  } else if (remote.hasRemoteStructure && !remote.habits.length && local.habits?.length) {
    await saveWorkspaceStructure(
      remote.projects,
      remote.categories,
      remote.taskListLinks,
      metricsFor(local.tasks, remote.projects, local.habits?.length ?? 0),
      normalizeHabitWorkspace(local),
    );
  }
  if (!remote.user.calendarConnected) return;
  const remoteById = new Map(remote.tasks.map((task) => [task.id, task]));
  const tasksToUpload = local.tasks.filter((task) => {
    if (task.googleTaskId) return false;
    const remoteTask = remoteById.get(task.id);
    return !remoteTask || task.updatedAt > remoteTask.updatedAt;
  });
  const batchSize = 8;
  for (let index = 0; index < tasksToUpload.length; index += batchSize) {
    await Promise.all(tasksToUpload.slice(index, index + batchSize).map((task) => saveCloudTask(_uid, task)));
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

export function metricsFor(tasks: GenesisTask[], projects: GenesisProject[], habitCount = 0): GenesisMetrics {
  return {
    projectCount: projects.length,
    taskCount: tasks.length,
    openTaskCount: tasks.filter((task) => !task.done).length,
    completedTaskCount: tasks.filter((task) => task.done).length,
    googleSyncedCount: tasks.filter((task) => Boolean(task.googleEventId || task.googleTaskId)).length,
    habitCount: Math.max(0, Math.min(100_000, Math.round(habitCount))),
  };
}

export async function saveWorkspaceStructure(
  projects: GenesisProject[],
  categories: GenesisCategory[],
  taskListLinks: TaskListProjectLink[],
  metrics: GenesisMetrics,
  habitWorkspace?: HabitWorkspace,
) {
  return withWorkspaceMutationLock(async () => {
    const encrypted = await encryptWorkspace(projects, categories, taskListLinks, habitWorkspace);
    const request: WorkspaceEnvelopeRequest = { ...encrypted.envelope, metrics };
    const body = JSON.stringify(request);
    queueMutation({ key: "workspace", path: "/workspace", method: "PUT", body });
    const result = await sendWorkspaceMutation(request);
    if (workspaceVersion < result.workspace.version) {
      adoptSavedWorkspace(encrypted.structure, encrypted.metadata, result.workspace);
    }
    clearMutation("workspace");
    return result;
  });
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

export async function deleteAdminUser(userId: string, blacklist: boolean) {
  return api<{ deleted: true; blacklisted: boolean; purged: Record<string, number> }>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    body: JSON.stringify({ blacklist }),
  });
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
