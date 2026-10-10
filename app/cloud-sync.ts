import { recurrenceDatesForTask, type RecurrenceMode, type RecurrencePattern } from "./task-recurrence";
import { normalizeCalendarDateNote, type CalendarMode } from "./calendar-data";
import type { Language } from "./i18n";
import { legacyReminderMinutes, normalizeTaskReminders, type TaskReminder } from "./task-reminders";
import type { TimeFormat } from "./time-format";
import { ThemeConflictError, type GenesisTheme } from "./theme-controller";
import { cleanTaskDescription } from "./task-description";
import { cleanGenesisAppUrl } from "./app-url";
import { shouldSeedRemoteWorkspace } from "./workspace-import-policy";
import { shouldUploadCachedTask } from "./task-sync-policy";
import {
  EMPTY_HABIT_WORKSPACE,
  normalizeHabitWorkspace,
  type HabitWorkspace,
} from "./habits";
import { clearTrackerAnalyticsCache } from "./tracker-cache";
import {
  mergeWorkspaceDocuments,
  mergeIndependentWorkspaceDocuments,
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

export type LinkedLocalAccount = {
  id: string;
  provider: "yandex";
  email: string;
  displayName: string;
  photoURL: string | null;
  isPrimary: boolean;
  calendarConnected: boolean;
  tasksConnected: boolean;
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
  yandexEntryType?: "task" | "meeting";
  yandexEndTime?: string;
  yandexLocation?: string;
  yandexTelemostUrl?: string;
  yandexAttendees?: string[];
  yandexOptionalAttendees?: string[];
  yandexBusy?: boolean;
  yandexVisibility?: "private" | "public";
  yandexReminders?: number[];
  updatedAt: number;
};

export type GenesisUser = {
  uid: string;
  authProvider?: "google" | "yandex";
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  calendarConnected: boolean;
  googleTasksImportReady: boolean;
  passwordEnabled: boolean;
  stoicheionDivinationDisabled: boolean;
  isAdmin: boolean;
  sharedProjectsEligible?: boolean;
  sharedProjectsLifetimeAccess?: boolean;
  sharedProjectsEnabled?: boolean;
  uiVisibility?: import("./ui-visibility").UiVisibility;
  calendarMode: CalendarMode;
  taskCalendarMode?: CalendarMode;
  timeFormat?: TimeFormat;
  weekStart?: "sunday" | "monday";
  gregorianYearStart?: "january" | "march";
  theme?: GenesisTheme;
  themeRevision?: number;
  language: Language;
  multiAccountEnabled: boolean;
  googleAccounts: GoogleAccount[];
  linkedAccounts?: LinkedLocalAccount[];
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
  deletedTaskIds: string[];
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
  googleAuthConnected: boolean;
  lastGoogleCalendarSyncAt: string | null;
  yandexCalendarConnected: boolean;
  yandexSyncedCount: number;
  lastYandexCalendarCheckAt: string | null;
  projectCount: number;
  taskCount: number;
  openTaskCount: number;
  completedTaskCount: number;
  googleSyncedCount: number;
  habitCount: number;
  isAdmin: boolean;
  metricsUpdatedAt: string | null;
  androidDownloadCount: number;
  androidFirstDownloadAt: string | null;
  androidLastDownloadAt: string | null;
  androidLastDownloadVersion: string | null;
  androidDeviceCount: number;
  androidReportedVersion: string | null;
  androidLastSeenAt: string | null;
  androidLastServerSyncAt: string | null;
  androidServerSyncStatus: "ok" | "warning" | null;
  androidGoogleSyncStatus: "ok" | "warning" | "disconnected" | null;
};

export type TodayAd = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  repeatHours: number;
};

export type AdminAd = TodayAd & {
  languages: string[];
  countries: string[];
  platforms: string[];
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  enabled: boolean;
};

export type AdminAdInput = Omit<AdminAd, "id"> & { imageData?: string };

export type AdminStats = {
  users: AdminUserStats[];
  totals: { users: number; projects: number; tasks: number; completedTasks: number; habits: number; blockedIdentities: number; androidDownloadRequests: number; androidReportingUsers: number };
  featureUsage: { startedAt: string | null; accountCount: number; features: Array<{
    id: string; opens: number; usedUsers: number; disabledUsers: number;
    webOpens: number; androidOpens: number;
  }> };
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

export type EncryptedWorkspaceStructure = Pick<GenesisWorkspace, "projects" | "categories" | "taskListLinks"> & HabitWorkspace & {
  /** Yandex accounts keep list metadata in the end-to-end encrypted workspace. */
  taskLists: GoogleTaskList[];
};

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
  deletedTaskIds?: string[];
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
let activeAuthProvider: "google" | "yandex" = "google";
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

function clearMutation(key: string, sent?: PendingMutation) {
  writePending(readPending().filter((item) => item.key !== key
    || Boolean(sent && (item.method !== sent.method || item.body !== sent.body))));
}

function rememberDeletedTasks(ids: string[]) {
  const key = `${PENDING_KEY}-deleted:${workspaceUserId || "anonymous"}`;
  let previous: unknown = [];
  try { previous = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* Recover a malformed local cache from the server ledger. */ }
  const deleted = new Set(Array.isArray(previous) ? previous.filter((id): id is string => typeof id === "string") : []);
  ids.forEach((id) => deleted.add(id));
  localStorage.setItem(key, JSON.stringify([...deleted]));
}

export function isCloudTaskDeleted(id: string): boolean {
  if (typeof window === "undefined") return false;
  const key = `${PENDING_KEY}-deleted:${workspaceUserId || "anonymous"}`;
  try {
    const deleted: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(deleted) && deleted.includes(id);
  } catch { return false; }
}

const taskMutationLocks = new Map<string, Promise<unknown>>();
async function withTaskMutationLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = taskMutationLocks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  taskMutationLocks.set(key, current);
  try { return await current; }
  finally { if (taskMutationLocks.get(key) === current) taskMutationLocks.delete(key); }
}

function isDeletedTaskResponse(error: unknown): boolean {
  return error instanceof GenesisApiError && error.status === 409 && error.payload?.error === "TASK_DELETED";
}

class GenesisNetworkTimeoutError extends Error {}

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
    if (timedOut) throw new GenesisNetworkTimeoutError("Сервер GENESIS не ответил за 20 секунд. Изменения сохранены на устройстве и будут синхронизированы позже.");
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
    await withTaskMutationLock(mutation.key, async () => {
      const latest = readPending().find((item) => item.key === mutation.key);
      if (!latest || latest.method !== mutation.method || latest.body !== mutation.body) return;
      if (mutation.method === "PUT" && mutation.key.startsWith("task:") && isCloudTaskDeleted(mutation.key.slice(5))) {
        clearMutation(mutation.key, mutation);
        return;
      }
      try {
        await api(mutation.path, { method: mutation.method, ...(mutation.body ? { body: mutation.body } : {}) });
      } catch (error) {
        if (!mutation.key.startsWith("task:") || !isDeletedTaskResponse(error)) throw error;
        rememberDeletedTasks([mutation.key.slice(5)]);
      }
      clearMutation(mutation.key, mutation);
    });
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
    yandexEntryType: task.yandexEntryType === "meeting" ? "meeting" : "task",
    yandexEndTime: typeof task.yandexEndTime === "string" ? task.yandexEndTime : "",
    yandexLocation: typeof task.yandexLocation === "string" ? task.yandexLocation : "",
    yandexTelemostUrl: typeof task.yandexTelemostUrl === "string" ? task.yandexTelemostUrl : "",
    yandexAttendees: Array.isArray(task.yandexAttendees) ? task.yandexAttendees.filter((item): item is string => typeof item === "string") : [],
    yandexOptionalAttendees: Array.isArray(task.yandexOptionalAttendees) ? task.yandexOptionalAttendees.filter((item): item is string => typeof item === "string") : [],
    yandexBusy: Boolean(task.yandexBusy),
    yandexVisibility: task.yandexVisibility === "public" ? "public" : "private",
    yandexReminders: Array.isArray(task.yandexReminders) ? task.yandexReminders.filter((item): item is number =>
      Number.isInteger(item) && item >= 0 && item <= 40_320).slice(0, 5) : [],
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
    taskLists: structure.taskLists,
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
    taskLists: Array.isArray(document.taskLists) ? document.taskLists as GoogleTaskList[] : [],
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

export function restoreOfflineWorkspaceSession(userId: string, provider: "google" | "yandex" = "google") {
  activeAuthProvider = provider;
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
    workspaceBase = { projects: [], categories: [], taskListLinks: [], taskLists: [], ...encryptedHabitWorkspace };
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
  taskLists?: GoogleTaskList[],
) {
  if (habitWorkspace) encryptedHabitWorkspace = normalizeHabitWorkspace(habitWorkspace);
  const current: EncryptedWorkspaceStructure = { projects, categories, taskListLinks,
    taskLists: taskLists ?? workspaceBase?.taskLists ?? [], ...encryptedHabitWorkspace };
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
  activeAuthProvider = payload.user.authProvider === "yandex" ? "yandex" : "google";
  csrfToken = payload.csrf;
  await resolveWorkspaceKey(payload);
  rememberDeletedTasks(payload.deletedTaskIds ?? []);
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
    tasks: payload.tasks.filter((task) => !isCloudTaskDeleted(task.id)).map((task) => normalizeTask(task)),
    deletedTaskIds: payload.deletedTaskIds ?? [],
    projects: structure.projects,
    categories: structure.categories,
    taskLists: payload.user.authProvider !== "google" ? structure.taskLists
      : Array.isArray(payload.taskLists) ? payload.taskLists : [],
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
  activeAuthProvider = result.user?.authProvider === "yandex" ? "yandex" : "google";
  return result.user;
}

export function signInWithGoogle() {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const returnTo = cleanGenesisAppUrl(window.location.href);
  window.location.assign(`${API_BASE}/auth/google/start?purpose=login&return_to=${encodeURIComponent(returnTo)}`);
  return Promise.resolve();
}

export async function loadAuthProviders(): Promise<{ google: boolean; yandex: boolean }> {
  if (!API_BASE) return { google: false, yandex: false };
  return api<{ google: boolean; yandex: boolean }>("/auth/providers");
}

export function signInWithYandex() {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const returnTo = cleanGenesisAppUrl(window.location.href);
  window.location.assign(`${API_BASE}/auth/yandex/start?return_to=${encodeURIComponent(returnTo)}`);
  return Promise.resolve();
}

export function connectLocalAccount(provider: "yandex") {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const url = new URL(window.location.href);
  url.searchParams.set("account_link", "1");
  const returnTo = cleanGenesisAppUrl(url);
  window.location.assign(`${API_BASE}/auth/${provider}/start?purpose=link&return_to=${encodeURIComponent(returnTo)}`);
}

export type PendingLocalAccountLink = {
  provider: "yandex";
  memberId: string;
  email: string;
  displayName: string;
  sourceWorkspace: {
    key: string;
    keyMode: "account";
    envelope: WorkspaceEnvelope | null;
  };
};

export async function getPendingLocalAccountLink() {
  return (await api<{ pending: PendingLocalAccountLink | null }>("/account/local-link/pending")).pending;
}

export async function cancelPendingLocalAccountLink() {
  await api<{ ok: true }>("/account/local-link/cancel", { method: "POST", body: "{}" });
}

export async function mergePendingLocalAccountLink(pending: PendingLocalAccountLink) {
  if (!workspaceKey || !workspaceUserId) throw new Error("Сначала откройте защищённое пространство GENESIS.");
  const source = pending.sourceWorkspace.envelope;
  const target = await fetchWorkspaceEnvelope();
  let mergedWorkspace: Awaited<ReturnType<typeof encryptWorkspaceDocument>> | undefined;
  if (source) {
    if (!pending.sourceWorkspace.key) throw new Error("Ключ второго пространства недоступен.");
    const sourceKey = await crypto.subtle.importKey("raw", base64ToBytes(pending.sourceWorkspace.key),
      "AES-GCM", false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(source.iv) },
      sourceKey, base64ToBytes(source.ciphertext));
    const sourceDocument = JSON.parse(new TextDecoder().decode(plaintext)) as SyncableWorkspaceDocument;
    const decodedTarget = target ? await decryptWorkspaceEnvelope(target) : null;
    const targetDocument = decodedTarget
      ? workspaceDocument(decodedTarget.structure, decodedTarget.metadata)
      : workspaceDocument({ projects: [], categories: [], taskListLinks: [], taskLists: [],
          ...normalizeHabitWorkspace(EMPTY_HABIT_WORKSPACE) });
    const merged = mergeIndependentWorkspaceDocuments({
      primary: targetDocument,
      secondary: sourceDocument,
      defaults: workspaceDocument({ projects: [], categories: [], taskListLinks: [], taskLists: [],
        ...normalizeHabitWorkspace(EMPTY_HABIT_WORKSPACE) }),
      clock: syncFallback(target?.version ?? 0, target?.updatedAt, workspaceDeviceId),
    });
    const structure = structureFromDocument(merged.document);
    mergedWorkspace = await encryptWorkspaceDocument(structure, merged.metadata, target?.version ?? 0);
  }
  return api<{ user: GenesisUser }>("/account/local-link/commit", {
    method: "POST",
    body: JSON.stringify({ sourceVersion: source?.version ?? 0, mergedWorkspace }),
  });
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
    account_conflict: "Этот адрес уже используется другим аккаунтом GENESIS. Войдите прежним способом или обратитесь в поддержку.",
    yandex_invalid_state: "Защитная проверка входа через Яндекс истекла. Начните вход заново.",
    yandex_access_denied: "Вы отменили вход через Яндекс. Доступ к данным не был предоставлен.",
    yandex_oauth_failed: "Яндекс не завершил авторизацию. Попробуйте ещё раз.",
    yandex_calendar_failed: "Не удалось подключить Яндекс.Календарь. Проверьте разрешения приложения в Яндекс ID.",
    oauth_failed: "Google не завершил авторизацию. Попробуйте ещё раз или обратитесь в поддержку.",
  };
  return messages[code] ?? messages.oauth_failed;
}

export async function signOutFromGoogle() {
  await api<{ ok: boolean }>("/auth/logout", { method: "POST", body: "{}" });
  if (workspaceUserId) localStorage.removeItem(sharedOfflineKey());
  workspaceKey = "";
  activeAuthProvider = "google";
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
    localStorage.removeItem(sharedOfflineKey(deletedUserId));
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

export function connectYandexCalendar(accountId: string) {
  if (!API_BASE) throw new Error("Сервер GENESIS ещё не подключён");
  const returnTo = cleanGenesisAppUrl(window.location.href);
  window.location.assign(`${API_BASE}/auth/yandex/calendar/start?account_id=${encodeURIComponent(accountId)}&return_to=${encodeURIComponent(returnTo)}`);
}

export function disconnectYandexCalendar(accountId?: string) {
  return api<{ user: GenesisUser }>("/account/yandex-calendar/disconnect", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
}

export async function updateAccountPreferences(preferences: Partial<{
  sharedProjectsEnabled: boolean;
  uiVisibility: import("./ui-visibility").UiVisibility;
  stoicheionDivinationDisabled: boolean;
  calendarMode: CalendarMode;
  taskCalendarMode: CalendarMode;
  timeFormat: TimeFormat;
  weekStart: "sunday" | "monday";
  gregorianYearStart: "january" | "march";
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

export type SharedPermissions = Record<"createProjects" | "editTasks" | "organizeTasks" | "comment" | "manageProjects" | "inviteMembers", boolean>;
export type SharedSpace = { coverUrl?:string|null;coverPosition?:{x:number;y:number}; id: string; title: string; description?: string; revision?: number; permissions?: SharedPermissions; role: "owner" | "admin" | "member" | "guest"; updatedAt: string };
export type SharedSpaceInvitationInput = { email: string; role: "admin" | "member" | "guest"; permissions: SharedPermissions };
export type SharedSpaceSettings = { space: SharedSpace; members: { userId: string; displayName: string; email: string; role: SharedSpace["role"]; permissions: SharedPermissions }[];
  invitations: (SharedSpaceInvitationInput & { id: string; expiresAt: string })[] };
export type SharedProject = { id: string; spaceId: string; parentId: string | null; title: string;
  labelIds?: string[];
  description: string; tags?: string[]; kind?: "project" | "task-list"; boardStatusId?: string | null; layout: "list" | "board"; isInbox?: number; taskCount?: number; boardCount?: number;
  revision: number; role: string; spaceRole?: string; canOrganizeTasks?: boolean; canCreateBoards?: boolean; permissions?: SharedPermissions; updatedAt: string };
export type SharedStatus = { color?: string; imageUrl?: string; id: string; title: string; position: number; isDone: number; revision: number };
export type SharedTaskList = SharedStatus & { projectId: string; projectTitle: string;
  spaceId: string; spaceTitle: string; role: string; taskCount: number; openCount: number };
export type SharedCategory = { id: string; title: string; color: string; position: number; revision: number };
export type SharedLabel = SharedCategory;
export type SharedTask = { id: string; projectId: string; statusId: string; title: string;
  labelIds?: string[]; startDate?: string | null; startTime?: string | null; endTime?: string | null; dependsOnIds?: string[];
  categoryId: string | null; description: string; tags?: string[]; dueDate: string | null;
  assigneeId: string | null; createdBy?: string | null;
  completedBy?: string | null; completedAt?: string | null; position: number;
  revision: number; updatedAt: string; pending?: boolean };
export type SharedMember = { userId: string; role: string; spaceRole: string;
  canOrganizeTasks: number; displayName: string };
export type SharedProjectSnapshot = { project: SharedProject; statuses: SharedStatus[]; categories: SharedCategory[];
  tasks: SharedTask[]; members: SharedMember[] };
export type SharedComment = { id: string; body: string; mentionIds?: string[]; authorId: string; authorName: string; createdAt: string };
export type SharedActivityEvent = { id: string; action: string; objectId: string; taskId: string | null; boardId: string | null; actorName: string; createdAt: string;
  details: { objectTitle?: string; imageChanged?: boolean; changes?: Record<string, { from: unknown; to: unknown }> } };
export type SharedGoogleSettings = { tasksEnabled: boolean; calendarEnabled: boolean;
  tasksAvailable: boolean; calendarAvailable: boolean };

type SharedQueuedMutation = { requestId: string; projectId: string; path: string;
  method: "POST" | "PATCH"; kind: "create" | "update" | "move"; taskId?: string;
  body: string; title: string; dueDate: string | null; queuedAt: string; error?: string };
type SharedOfflineStore = { cache: Record<string, { savedAt: number; payload: unknown }>;
  queue: SharedQueuedMutation[] };
const SHARED_OFFLINE_PREFIX = "genesis-shared-offline-v1:";
let sharedOfflineLock: Promise<void> = Promise.resolve();
let sharedLastReadFromCache = false;

function sharedOfflineKey(userId = workspaceUserId) {
  if (!userId) throw new Error("AUTH_REQUIRED");
  return `${SHARED_OFFLINE_PREFIX}${userId}`;
}

async function readSharedOfflineStore(): Promise<SharedOfflineStore> {
  const saved = localStorage.getItem(sharedOfflineKey());
  if (!saved) return { cache: {}, queue: [] };
  const envelope = JSON.parse(saved) as { iv: string; ciphertext: string };
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(envelope.iv),
    additionalData: new TextEncoder().encode(sharedOfflineKey()) },
  await importWorkspaceKey(), base64ToBytes(envelope.ciphertext));
  const decoded = JSON.parse(new TextDecoder().decode(plain)) as SharedOfflineStore;
  if (!decoded || typeof decoded.cache !== "object" || !Array.isArray(decoded.queue)) {
    throw new Error("SHARED_OFFLINE_CACHE_INVALID");
  }
  return decoded;
}

async function changeSharedOfflineStore(change: (store: SharedOfflineStore) => void) {
  const previous = sharedOfflineLock;
  let release: () => void = () => undefined;
  sharedOfflineLock = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const store = await readSharedOfflineStore();
    change(store);
    const entries = Object.entries(store.cache).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, 12);
    store.cache = Object.fromEntries(entries);
    if (store.queue.length > 100) throw new Error("SHARED_OFFLINE_QUEUE_FULL");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv,
      additionalData: new TextEncoder().encode(sharedOfflineKey()) },
    await importWorkspaceKey(), new TextEncoder().encode(JSON.stringify(store)));
    localStorage.setItem(sharedOfflineKey(), JSON.stringify({
      iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    }));
    window.dispatchEvent(new Event("genesis-shared-offline-change"));
  } finally { release(); }
}

function sharedNetworkFailure(error: unknown) {
  return !(error instanceof GenesisApiError) && (typeof navigator !== "undefined" && !navigator.onLine
    || error instanceof TypeError
    || error instanceof GenesisNetworkTimeoutError);
}

async function sharedCachedRequest<T>(path: string): Promise<T> {
  try {
    const payload = await api<T>(path);
    sharedLastReadFromCache = false;
    await changeSharedOfflineStore((store) => { store.cache[path] = { savedAt: Date.now(), payload }; })
      .catch(() => undefined);
    return payload;
  } catch (error) {
    if (error instanceof GenesisApiError && [401, 403, 404].includes(error.status)) {
      if (workspaceUserId) await changeSharedOfflineStore((store) => {
        if (error.status === 401) store.cache = {};
        else delete store.cache[path];
      }).catch(() => undefined);
    }
    if (!sharedNetworkFailure(error)) throw error;
    const saved = (await readSharedOfflineStore()).cache[path];
    if (!saved || Date.now() - saved.savedAt > 30 * 24 * 60 * 60 * 1000) throw error;
    sharedLastReadFromCache = true;
    return saved.payload as T;
  }
}

export function sharedDataCameFromOfflineCache() { return sharedLastReadFromCache; }

export async function queuedSharedMutations(projectId: string) {
  return (await readSharedOfflineStore()).queue.filter((item) => item.projectId === projectId)
    .map(({ requestId, kind, title, dueDate, queuedAt, error, body }) => ({
      requestId, kind, title, dueDate, queuedAt, error, draft: error ? body : null,
    }));
}

export async function pendingSharedMutationCount() {
  if (!workspaceUserId || !workspaceKey) return 0;
  return (await readSharedOfflineStore()).queue.length;
}

export async function discardSharedMutation(requestId: string) {
  await changeSharedOfflineStore((store) => {
    const item = store.queue.find((queued) => queued.requestId === requestId);
    if (!item || !item.error) throw new Error("SHARED_DRAFT_NOT_FOUND");
    store.queue = store.queue.filter((queued) => queued.requestId !== requestId);
  });
}

export async function flushSharedMutations() {
  if (!workspaceUserId || !workspaceKey || !navigator.onLine) return;
  const queued = (await readSharedOfflineStore()).queue;
  for (const item of queued) {
    if (item.error) continue;
    if (Date.now() - Date.parse(item.queuedAt) > 89 * 24 * 60 * 60 * 1000) {
      await changeSharedOfflineStore((store) => {
        const entry = store.queue.find((current) => current.requestId === item.requestId);
        if (entry) entry.error = "EXPIRED_SHARED_DRAFT";
      });
      continue;
    }
    try {
      await api(item.path, { method: item.method, body: item.body });
      await changeSharedOfflineStore((store) => {
        store.queue = store.queue.filter((entry) => entry.requestId !== item.requestId);
      });
    } catch (error) {
      if (sharedNetworkFailure(error)) return;
      await changeSharedOfflineStore((store) => {
        const entry = store.queue.find((current) => current.requestId === item.requestId);
        if (entry) entry.error = error instanceof Error ? error.message : "SHARED_SYNC_FAILED";
      });
    }
  }
}

async function sendSharedMutation<T extends { pending?: boolean }>(item: SharedQueuedMutation, pending: T): Promise<T> {
  if (!workspaceUserId || !workspaceKey) {
    return (await api<{ task: T }>(item.path, { method: item.method, body: item.body })).task;
  }
  await changeSharedOfflineStore((store) => {
    if (item.taskId && store.queue.some((queued) => queued.taskId === item.taskId && !queued.error)) {
      throw new Error("SHARED_TASK_PENDING");
    }
    store.queue.push(item);
  });
  try {
    const result = (await api<{ task: T }>(item.path, { method: item.method, body: item.body })).task;
    await changeSharedOfflineStore((store) => {
      store.queue = store.queue.filter((queued) => queued.requestId !== item.requestId);
    });
    return result;
  } catch (error) {
    if (sharedNetworkFailure(error)) return pending;
    await changeSharedOfflineStore((store) => {
      store.queue = store.queue.filter((queued) => queued.requestId !== item.requestId);
    });
    throw error;
  }
}

export async function listSharedSpaces() {
  return (await sharedCachedRequest<{ spaces: SharedSpace[] }>("/shared/spaces")).spaces;
}
export async function createSharedSpace(title: string, description = "", invitations: SharedSpaceInvitationInput[] = [], cover?:{coverImage?:string;coverPosition:{x:number;y:number}}) {
  return (await api<{ space: SharedSpace }>("/shared/spaces", {
    method: "POST", body: JSON.stringify({ title, description, invitations, ...cover }),
  })).space;
}
export function loadSharedSpaceSettings(spaceId: string) {
  return api<SharedSpaceSettings>(`/shared/spaces/${encodeURIComponent(spaceId)}`);
}
export async function updateSharedSpace(space: SharedSpace, title: string, description: string, cover?:{coverImage?:string;coverPosition:{x:number;y:number}}) {
  return (await api<{ space: SharedSpace }>(`/shared/spaces/${encodeURIComponent(space.id)}`, {
    method: "PATCH", body: JSON.stringify({ title, description, expectedRevision: space.revision, ...cover }),
  })).space;
}
export function deleteSharedSpace(space: SharedSpace) {
  return api<{ ok: true }>(`/shared/spaces/${encodeURIComponent(space.id)}`, {
    method: "DELETE", body: JSON.stringify({ expectedRevision: space.revision }),
  });
}
export function setSharedSpaceMemberPermissions(spaceId: string, userId: string, role: SharedSpace["role"], permissions: SharedPermissions) {
  return api<{ ok: true }>(`/shared/spaces/${encodeURIComponent(spaceId)}/members/${encodeURIComponent(userId)}`, {
    method: "PATCH", body: JSON.stringify({ role, permissions, canOrganizeTasks: permissions.organizeTasks }),
  });
}
export function revokeSharedSpaceInvitation(spaceId: string, invitationId: string) {
  return api<{ ok: true }>(`/shared/spaces/${encodeURIComponent(spaceId)}/invitations/${encodeURIComponent(invitationId)}`, { method: "DELETE" });
}
export async function listSharedProjects(spaceId: string) {
  return (await sharedCachedRequest<{ projects: SharedProject[] }>(`/shared/spaces/${encodeURIComponent(spaceId)}/projects`)).projects;
}
export async function listArchivedSharedProjects(spaceId: string) {
  return (await sharedCachedRequest<{ projects: (SharedProject & { archivedAt: string })[] }>(
    `/shared/spaces/${encodeURIComponent(spaceId)}/archived-projects`)).projects;
}
export type SharedAffairSearch = { projects: SharedProject[]; tasks: { id: string; title: string; projectId: string; projectTitle: string; tags: string[]; completedAt: string | null }[] };
export function searchSharedAffairs(spaceId: string, query: string, signal?: AbortSignal) {
  return api<SharedAffairSearch>(`/shared/spaces/${encodeURIComponent(spaceId)}/search?q=${encodeURIComponent(query)}`, { signal });
}
export async function createSharedProject(spaceId: string, input: { title: string; description: string;
  layout: "list" | "board"; tags?: string[]; labelIds?: string[]; kind?: "project" | "task-list"; boardStatusId?: string | null; parentId?: string | null }) {
  return (await api<{ project: SharedProject }>(`/shared/spaces/${encodeURIComponent(spaceId)}/projects`, {
    method: "POST", body: JSON.stringify(input),
  })).project;
}
export type SharedProjectImport = {
  transferId: string;
  targetParentId?: string | null;
  targetStatusId?: string | null;
  mode: "copy" | "move";
  projects: { sourceId: string; parentSourceId: string | null; title: string;
    description: string; tags?: string[]; layout: "list" | "board" }[];
  categories: { sourceId: string; projectSourceId: string; title: string; color: string }[];
  tasks: { sourceId: string; projectSourceId: string; categorySourceId: string | null;
    title: string; description: string; tags?: string[]; dueDate: string | null; done: boolean }[];
};
export type SharedProjectImportReceipt = { rootProjectId: string; projectIds: Record<string, string>;
  taskIds: Record<string, string>; taskCount: number; mode: "copy" | "move" };
export async function importSharedProject(spaceId: string, input: SharedProjectImport) {
  return (await api<{ receipt: SharedProjectImportReceipt }>(
    `/shared/spaces/${encodeURIComponent(spaceId)}/import-project`,
    { method: "POST", body: JSON.stringify(input) },
  )).receipt;
}
export async function loadSharedProject(projectId: string) {
  return sharedCachedRequest<SharedProjectSnapshot>(`/shared/projects/${encodeURIComponent(projectId)}`);
}
export async function loadSharedGoogleSettings(projectId: string) {
  return (await api<{ settings: SharedGoogleSettings }>(
    `/shared/projects/${encodeURIComponent(projectId)}/google`)).settings;
}
export async function updateSharedGoogleSettings(projectId: string,
  input: Pick<SharedGoogleSettings, "tasksEnabled" | "calendarEnabled">) {
  return (await api<{ settings: SharedGoogleSettings }>(
    `/shared/projects/${encodeURIComponent(projectId)}/google`,
    { method: "PATCH", body: JSON.stringify(input) })).settings;
}
export async function syncSharedGoogle(projectId: string) {
  return api<{ synced: number; pending: number }>(
    `/shared/projects/${encodeURIComponent(projectId)}/google/sync`,
    { method: "POST", body: "{}" });
}
export async function updateSharedProject(projectId: string, input: {
  title: string; description: string; tags?: string[]; labelIds?: string[]; layout: "list" | "board"; parentId: string | null; boardStatusId?: string | null; expectedRevision: number;
}) {
  return (await api<{ project: SharedProject }>(`/shared/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH", body: JSON.stringify(input),
  })).project;
}
export async function setSharedProjectArchived(projectId: string, archived: boolean) {
  return api<{ ok: true }>(`/shared/projects/${encodeURIComponent(projectId)}/${archived ? "archive" : "restore"}`, {
    method: "POST", body: "{}",
  });
}
export async function listSharedTaskLists() {
  return (await sharedCachedRequest<{ lists: SharedTaskList[] }>("/shared/task-lists")).lists;
}
export async function createSharedStatus(projectId: string, title: string, isDone: boolean,
  requestId: string = crypto.randomUUID()) {
  return (await api<{ status: SharedStatus }>(`/shared/projects/${encodeURIComponent(projectId)}/statuses`, {
    method: "POST", body: JSON.stringify({ title, isDone, requestId }),
  })).status;
}
export async function updateSharedStatus(projectId: string, statusId: string, title: string, expectedRevision: number, settings?: { color?: string; imageUrl?: string; isDone?: boolean }) {
  return (await api<{ status: SharedStatus }>(
    `/shared/projects/${encodeURIComponent(projectId)}/statuses/${encodeURIComponent(statusId)}`, {
      method: "PATCH", body: JSON.stringify({ title, expectedRevision, ...settings }),
    })).status;
}
export async function deleteSharedStatus(projectId: string, statusId: string,
  destinationStatusId: string, expectedRevision: number) {
  return api<{ ok: true }>(`/shared/projects/${encodeURIComponent(projectId)}/statuses/${encodeURIComponent(statusId)}`, {
    method: "DELETE", body: JSON.stringify({ destinationStatusId, expectedRevision }),
  });
}
export async function createSharedCategory(projectId: string, title: string, color: string) {
  return (await api<{ category: SharedCategory }>(`/shared/projects/${encodeURIComponent(projectId)}/categories`, {
    method: "POST", body: JSON.stringify({ title, color }),
  })).category;
}
export async function updateSharedCategory(projectId: string, categoryId: string,
  title: string, color: string, expectedRevision: number) {
  return (await api<{ category: SharedCategory }>(
    `/shared/projects/${encodeURIComponent(projectId)}/categories/${encodeURIComponent(categoryId)}`, {
      method: "PATCH", body: JSON.stringify({ title, color, expectedRevision }),
    })).category;
}
export async function deleteSharedCategory(projectId: string, categoryId: string, expectedRevision: number) {
  return api<{ ok: true }>(`/shared/projects/${encodeURIComponent(projectId)}/categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE", body: JSON.stringify({ expectedRevision }),
  });
}
export async function changeSharedMemberRole(projectId: string, userId: string, role: string) {
  return api<{ ok: true }>(`/shared/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, {
    method: "PATCH", body: JSON.stringify({ role }),
  });
}
export async function changeSharedSpaceRole(spaceId: string, userId: string, role: string,
  canOrganizeTasks?: boolean) {
  return api<{ ok: true }>(`/shared/spaces/${encodeURIComponent(spaceId)}/members/${encodeURIComponent(userId)}`, {
    method: "PATCH", body: JSON.stringify({ role, ...(canOrganizeTasks === undefined ? {} : { canOrganizeTasks }) }),
  });
}
export async function removeSharedMember(projectId: string, userId: string) {
  return api<{ ok: true }>(`/shared/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}
export async function createSharedTask(projectId: string, input: { title: string; statusId: string;
  labelIds?: string[]; startDate?: string | null; startTime?: string | null; endTime?: string | null; dependsOnIds?: string[];
  categoryId?: string | null; assigneeId?: string | null; dueDate?: string | null; description?: string;
  sourceTaskId?: string; tags?: string[] }) {
  const path = `/shared/projects/${encodeURIComponent(projectId)}/tasks`;
  if (input.sourceTaskId) {
    return (await api<{ task: SharedTask }>(path, { method: "POST", body: JSON.stringify(input) })).task;
  }
  const requestId = crypto.randomUUID();
  const body = JSON.stringify({ ...input, requestId });
  return sendSharedMutation<SharedTask>({
    requestId, projectId, path, method: "POST", kind: "create", body,
    title: input.title, dueDate: input.dueDate ?? null,
    queuedAt: new Date().toISOString(),
  }, { id: `pending:${requestId}`, projectId, statusId: input.statusId,
    title: input.title, description: input.description ?? "", dueDate: input.dueDate ?? null,
    categoryId: input.categoryId ?? null, assigneeId: input.assigneeId ?? null, labelIds: input.labelIds ?? [], startDate: input.startDate ?? null, dependsOnIds: input.dependsOnIds ?? [],
    startTime: input.startTime ?? null, endTime: input.endTime ?? null,
    position: 0, revision: 0, updatedAt: new Date().toISOString(), pending: true });
}
export async function updateSharedTask(projectId: string, taskId: string, input: Partial<SharedTask> & { expectedRevision: number }) {
  const requestId = crypto.randomUUID();
  const path = `/shared/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`;
  return sendSharedMutation<SharedTask>({ requestId, projectId, taskId, path, method: "PATCH", kind: "update",
    body: JSON.stringify({ ...input, requestId }), title: input.title ?? taskId,
    dueDate: input.dueDate ?? null, queuedAt: new Date().toISOString() },
  { id: taskId, projectId, statusId: input.statusId ?? "", title: input.title ?? "",
    description: input.description ?? "", categoryId: input.categoryId ?? null,
    assigneeId: input.assigneeId ?? null, dueDate: input.dueDate ?? null,
    ...Object.fromEntries(Object.entries({labelIds: input.labelIds, startDate: input.startDate, startTime: input.startTime, endTime: input.endTime, dependsOnIds: input.dependsOnIds}).filter(([,value])=>value!==undefined)),
    position: 0, revision: input.expectedRevision, updatedAt: new Date().toISOString(), pending: true });
}
export async function moveSharedTask(projectId: string, taskId: string, input: {
  destinationProjectId: string; statusId: string; expectedRevision: number; position: number;
  startDate?:string|null;dueDate?:string|null;startTime?:string|null;endTime?:string|null;
}) {
  const requestId = crypto.randomUUID();
  const path = `/shared/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/move`;
  return sendSharedMutation<Pick<SharedTask, "id" | "projectId" | "statusId" | "revision" | "pending">>({
    requestId, projectId, taskId, path, method: "POST", kind: "move",
    body: JSON.stringify({ ...input, requestId }), title: taskId, dueDate: null,
    queuedAt: new Date().toISOString(),
  }, { id: taskId, projectId: input.destinationProjectId, statusId: input.statusId,
    revision: input.expectedRevision, pending: true });
}
export async function inviteSharedMember(projectId: string, email: string, role: string) {
  return (await api<{ invitation: { id: string; expiresAt: string } }>(
    `/shared/projects/${encodeURIComponent(projectId)}/invitations`, {
      method: "POST", body: JSON.stringify({ email, role }),
    })).invitation;
}
export function deleteSharedTask(projectId: string, taskId: string, expectedRevision: number) {
  return api<{ ok: boolean; id: string }>(`/shared/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE", body: JSON.stringify({ expectedRevision, requestId: crypto.randomUUID() }),
  });
}
export type SharedInvitation = {
  id: string; inviterName: string; spaceTitle: string; projectTitle: string;
  role: string; expiresAt: string;
};
export async function listSharedInvitations() {
  return (await api<{ invitations: SharedInvitation[] }>("/shared/invitations")).invitations;
}
export type SharedNotification = {
  id: string; action: string; objectId: string; createdAt: string;
  projectId: string; projectTitle: string; spaceId: string;
  actorName: string; taskTitle: string | null; isRead: number;
};
export async function listSharedNotifications() {
  return (await api<{ notifications: SharedNotification[] }>("/shared/notifications")).notifications;
}
export async function readSharedNotifications(eventIds: string[]) {
  return api<{ ok: boolean }>("/shared/notifications/read", {
    method: "POST", body: JSON.stringify({ eventIds }),
  });
}
export async function acceptSharedInvitation(id: string) {
  return api<{ projectId: string; spaceId: string }>("/shared/invitations/accept", {
    method: "POST", body: JSON.stringify({ id }),
  });
}
export async function rejectSharedInvitation(id: string) {
  return api<{ ok: boolean }>(`/shared/invitations/${encodeURIComponent(id)}`, {
    method: "POST", body: "{}",
  });
}
export type SharedCalendarTask = {
  id: string; title: string; dueDate: string; completedAt: string | null;
  projectId: string; projectTitle: string; spaceId: string; isInbox: number;
};
export async function listSharedCalendarTasks(from: string, to: string) {
  return (await api<{ tasks: SharedCalendarTask[] }>(
    `/shared/calendar/tasks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)).tasks;
}
export async function listSharedComments(projectId: string, taskId: string) {
  return (await api<{ comments: SharedComment[] }>(
    `/shared/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments`)).comments;
}
export async function addSharedComment(projectId: string, taskId: string, body: string, mentionIds: string[] = []) {
  return (await api<{ comment: SharedComment }>(
    `/shared/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments`, {
      method: "POST", body: JSON.stringify({ body, mentionIds }),
    })).comment;
}

export async function listSharedLabels(spaceId: string) {
  return (await sharedCachedRequest<{ labels: SharedLabel[] }>(`/shared/spaces/${encodeURIComponent(spaceId)}/labels`)).labels;
}
export async function saveSharedLabel(spaceId: string, title: string, color: string, label?: SharedLabel) {
  return (await api<{ label: SharedLabel }>(`/shared/spaces/${encodeURIComponent(spaceId)}/labels${label ? `/${encodeURIComponent(label.id)}` : ""}`, {
    method: label ? "PATCH" : "POST", body: JSON.stringify({ title, color, ...(label ? { expectedRevision: label.revision } : {}) }),
  })).label;
}
export async function deleteSharedLabel(spaceId: string, label: SharedLabel) {
  return api<{ ok: true }>(`/shared/spaces/${encodeURIComponent(spaceId)}/labels/${encodeURIComponent(label.id)}`, {method:"DELETE",body:JSON.stringify({expectedRevision:label.revision})});
}
export async function loadSharedActivity(projectId: string, scope: {taskId?: string; boardId?: string; before?: string} = {}) {
  const params = new URLSearchParams(scope);
  return api<{events:SharedActivityEvent[];nextCursor:string|null}>(`/shared/projects/${encodeURIComponent(projectId)}/activity?${params}`);
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
      await flushSharedMutations();
      await refreshWorkspaceFromCloud();
      const result = await api<{ tasks: GenesisTask[]; deletedTaskIds?: string[]; taskLists?: GoogleTaskList[]; syncWarning?: string | null }>("/sync/tasks");
      rememberDeletedTasks(result.deletedTaskIds ?? []);
      if (active) listener(
        result.tasks.filter((task) => !isCloudTaskDeleted(task.id)).map((task) => normalizeTask(task)),
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
  local: Pick<GenesisWorkspace, "tasks" | "projects" | "categories" | "taskListLinks" | "taskLists"> & Partial<HabitWorkspace>,
) {
  const remote = await loadGenesisWorkspace();
  if (readPending().some((mutation) => mutation.key === "workspace")) {
    await flushPendingMutations();
  } else if (shouldSeedRemoteWorkspace(remote.hasRemoteStructure,
    local.projects.length + local.categories.length + local.taskListLinks.length
      + (remote.user.authProvider !== "google" ? local.taskLists.length : 0) + (local.habits?.length ?? 0))) {
    await saveWorkspaceStructure(
      local.projects,
      local.categories,
      local.taskListLinks,
      metricsFor(local.tasks, local.projects, local.habits?.length ?? 0),
      normalizeHabitWorkspace(local),
      remote.user.authProvider !== "google" ? local.taskLists : undefined,
    );
  } else if (remote.user.authProvider !== "google" && remote.taskLists.length === 0 && local.taskLists.length > 0) {
    await saveWorkspaceStructure(remote.projects, remote.categories, remote.taskListLinks,
      metricsFor(remote.tasks, remote.projects, remote.habits.length),
      normalizeHabitWorkspace(remote), local.taskLists);
  }
  if (!remote.user.calendarConnected) return;
  const remoteById = new Map(remote.tasks.map((task) => [task.id, task]));
  const tasksToUpload = local.tasks.filter((task) => {
    const remoteTask = remoteById.get(task.id);
    return shouldUploadCachedTask(task, remoteTask, isCloudTaskDeleted(task.id));
  });
  const batchSize = 8;
  for (let index = 0; index < tasksToUpload.length; index += batchSize) {
    await Promise.all(tasksToUpload.slice(index, index + batchSize).map((task) => saveCloudTask(_uid, task)));
  }
}

export async function saveCloudTask(_uid: string, task: GenesisTask) {
  if (isCloudTaskDeleted(task.id)) throw new Error("TASK_DELETED");
  const path = `/tasks/${encodeURIComponent(task.id)}`;
  const body = JSON.stringify({
    ...task,
    recurrenceDates: recurrenceDatesForTask(task),
    syncToGoogle: activeAuthProvider === "google",
  });
  const mutation: PendingMutation = { key: `task:${task.id}`, path, method: "PUT", body };
  queueMutation(mutation);
  return withTaskMutationLock(mutation.key, async () => {
    if (isCloudTaskDeleted(task.id)) throw new Error("TASK_DELETED");
    try {
      const result = await api<{ task: GenesisTask }>(path, { method: "PUT", body });
      clearMutation(mutation.key, mutation);
      return normalizeTask(result.task);
    } catch (error) {
      if (isDeletedTaskResponse(error)) {
        rememberDeletedTasks([task.id]);
        clearMutation(mutation.key, mutation);
      }
      throw error;
    }
  });
}

export async function removeCloudTask(_uid: string, task: GenesisTask) {
  rememberDeletedTasks([task.id]);
  const path = `/tasks/${encodeURIComponent(task.id)}`;
  const body = JSON.stringify({
    googleEventId: task.googleEventId,
    googleTaskId: task.googleTaskId,
    googleTaskListId: task.googleTaskListId,
    googleLinks: task.googleLinks,
    googleAccountId: task.googleAccountId,
    createdIn: task.createdIn,
  });
  const mutation: PendingMutation = { key: `task:${task.id}`, path, method: "DELETE", body };
  queueMutation(mutation);
  await withTaskMutationLock(mutation.key, async () => {
    await api<{ ok: boolean }>(path, { method: "DELETE", body });
    clearMutation(mutation.key, mutation);
  });
}

/** A transfer must not queue an uncertain deletion for later replay. */
export async function removeCloudTaskForTransfer(task: GenesisTask) {
  const path = `/tasks/${encodeURIComponent(task.id)}`;
  const body = JSON.stringify({
    googleEventId: task.googleEventId,
    googleTaskId: task.googleTaskId,
    googleTaskListId: task.googleTaskListId,
    googleLinks: task.googleLinks,
    googleAccountId: task.googleAccountId,
    createdIn: task.createdIn,
  });
  await api<{ ok: boolean }>(path, { method: "DELETE", body });
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
  taskLists?: GoogleTaskList[],
) {
  return withWorkspaceMutationLock(async () => {
    const encrypted = await encryptWorkspace(projects, categories, taskListLinks, habitWorkspace, taskLists);
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
  if (activeAuthProvider !== "google") return {
    taskList: { id: `local:${crypto.randomUUID()}`, title, updatedAt: new Date().toISOString() },
  };
  return api<{ taskList: GoogleTaskList }>("/task-lists", {
    method: "POST",
    body: JSON.stringify({ title, accountId }),
  });
}

export async function updateGoogleTaskList(taskListId: string, title: string, accountId?: string) {
  if (activeAuthProvider !== "google") return {
    taskList: { id: taskListId, title, updatedAt: new Date().toISOString() },
  };
  return api<{ taskList: GoogleTaskList }>(`/task-lists/${encodeURIComponent(taskListId)}`, {
    method: "PATCH",
    body: JSON.stringify({ title, accountId }),
  });
}

export async function removeGoogleTaskList(taskListId: string, accountId?: string) {
  if (activeAuthProvider !== "google") return { ok: true };
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

export async function recordFeatureUsage(features: string[], platform: "web" | "android" = "web") {
  return api<{ ok: boolean }>("/feature-usage", {
    method: "POST", body: JSON.stringify({ features, platform }),
  });
}

export async function loadTodayAds(language: string, country: string, platform: "web" | "android") {
  return api<{ ads: TodayAd[] }>(`/ads/today?language=${encodeURIComponent(language)}&country=${encodeURIComponent(country)}&platform=${platform}`);
}

export async function loadAdminAds() {
  return api<{ ads: AdminAd[] }>("/admin/ads");
}

export async function saveAdminAd(input: AdminAdInput, id?: string) {
  return api<{ ad: AdminAd }>(id ? `/admin/ads/${encodeURIComponent(id)}` : "/admin/ads", {
    method: id ? "PUT" : "POST", body: JSON.stringify(input),
  });
}

export async function deleteAdminAd(id: string) {
  return api<{ deleted: true }>(`/admin/ads/${encodeURIComponent(id)}`, { method: "DELETE" });
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

export function loadSharedUiState(spaceId: string) {
  return api<{ expandedIds: string[] }>(`/shared/spaces/${encodeURIComponent(spaceId)}/ui`);
}
export function saveSharedUiState(spaceId: string, expandedIds: string[]) {
  return api<{ expandedIds: string[] }>(`/shared/spaces/${encodeURIComponent(spaceId)}/ui`,
    { method: "PATCH", body: JSON.stringify({ expandedIds }) });
}
export function inviteSharedSpaceMember(spaceId: string, email: string, role: "admin" | "member" | "guest", permissions?: SharedPermissions) {
  return api<{ invitation: { id: string; expiresAt: string } }>(`/shared/spaces/${encodeURIComponent(spaceId)}/invitations`,
    { method: "POST", body: JSON.stringify({ email, role, ...(permissions ? { permissions } : {}) }) });
}
