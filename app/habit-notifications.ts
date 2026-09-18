export type HabitNotificationTone = "calm" | "heroic" | "ironic";

export type HabitNotificationSettings = {
  enabled: boolean;
  motivational: boolean;
  tone: HabitNotificationTone;
  dailyGoalTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export type HabitNotificationPermission = NotificationPermission | "unsupported";

export type HabitNotificationCandidate = {
  id: string;
  kind: "habit" | "habit-group" | "daily-goal" | "perfect-day";
  variant: "concise" | "context";
  scheduledAt: string;
  title: string;
  body: string;
};

export type HabitNotificationPlanInput = {
  date: string;
  now: Date;
  language: "ru" | "en";
  settings: HabitNotificationSettings;
  habits: Array<{
    id: string;
    title: string;
    emoji: string;
    priority: number;
    reminderTime: string;
  }>;
  dailyGoal: {
    scheduled: number;
    completed: number;
    target: number;
    currentStreak: number;
  };
  xpToNextRank?: number | null;
};

type HabitNotificationTelemetryEvent = {
  notificationId: string;
  kind: HabitNotificationCandidate["kind"];
  variant: HabitNotificationCandidate["variant"];
  event: "delivered" | "opened" | "disabled";
  occurredAt: string;
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TELEMETRY_KEY = "genesis-habit-notification-metrics-v1";
const DELIVERED_KEY = "genesis-habit-notifications-delivered-v1";
const GROUP_WINDOW_MINUTES = 20;

export const DEFAULT_HABIT_NOTIFICATION_SETTINGS: HabitNotificationSettings = {
  enabled: false,
  motivational: true,
  tone: "calm",
  dailyGoalTime: "20:30",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:30",
};

function normalizedTime(value: unknown, fallback: string) {
  return typeof value === "string" && TIME_PATTERN.test(value) ? value : fallback;
}

export function normalizeHabitNotificationSettings(value: Partial<HabitNotificationSettings> | null | undefined): HabitNotificationSettings {
  const tone = ["calm", "heroic", "ironic"].includes(String(value?.tone))
    ? value!.tone as HabitNotificationTone
    : DEFAULT_HABIT_NOTIFICATION_SETTINGS.tone;
  return {
    enabled: value?.enabled === true,
    motivational: value?.motivational !== false,
    tone,
    dailyGoalTime: normalizedTime(value?.dailyGoalTime, DEFAULT_HABIT_NOTIFICATION_SETTINGS.dailyGoalTime),
    quietHoursStart: normalizedTime(value?.quietHoursStart, DEFAULT_HABIT_NOTIFICATION_SETTINGS.quietHoursStart),
    quietHoursEnd: normalizedTime(value?.quietHoursEnd, DEFAULT_HABIT_NOTIFICATION_SETTINGS.quietHoursEnd),
  };
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function localDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function isHabitNotificationQuietTime(time: string, settings: HabitNotificationSettings) {
  const value = minutesFromTime(time);
  const start = minutesFromTime(settings.quietHoursStart);
  const end = minutesFromTime(settings.quietHoursEnd);
  if (start === end) return false;
  return start < end ? value >= start && value < end : value >= start || value < end;
}

function notificationVariant(seed: string): HabitNotificationCandidate["variant"] {
  const checksum = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  return checksum % 2 ? "context" : "concise";
}

function dailyGoalCopy(input: HabitNotificationPlanInput, remaining: number, perfectRemaining: number, variant: HabitNotificationCandidate["variant"]) {
  const { language, settings, dailyGoal, xpToNextRank } = input;
  if (dailyGoal.completed >= dailyGoal.target && perfectRemaining === 1) {
    return language === "en"
      ? { title: "Almost a Perfect Day", body: "One more step will complete every habit planned for today." }
      : { title: "Почти идеальный день", body: "Ещё один шаг — и все запланированные привычки на сегодня будут выполнены." };
  }
  if (language === "en") {
    const title = settings.tone === "heroic" ? "Today's path is not complete" : settings.tone === "ironic" ? "The plan has not vanished" : "Daily goal";
    const base = settings.tone === "heroic"
      ? `${remaining} step(s) remain to preserve today's rhythm.`
      : settings.tone === "ironic"
        ? `${remaining} small action(s) remain — still shorter than postponing them.`
        : `${remaining} habit(s) remain to reach today's goal.`;
    const context = dailyGoal.currentStreak > 0
      ? ` Your current streak is ${dailyGoal.currentStreak} day(s).`
      : xpToNextRank && xpToNextRank > 0 ? ` ${xpToNextRank} XP to the next rank.` : "";
    return { title, body: `${base}${variant === "context" ? context : ""}` };
  }
  const title = settings.tone === "heroic" ? "Сегодняшний путь ещё не завершён" : settings.tone === "ironic" ? "План никуда не испарился" : "Дневная цель";
  const base = settings.tone === "heroic"
    ? `До сохранения сегодняшнего ритма осталось действий: ${remaining}.`
    : settings.tone === "ironic"
      ? `Осталось небольших действий: ${remaining}. Это всё ещё быстрее, чем откладывать.`
      : `До дневной цели осталось привычек: ${remaining}.`;
  const context = dailyGoal.currentStreak > 0
    ? ` Текущая серия: ${dailyGoal.currentStreak} дн.`
    : xpToNextRank && xpToNextRank > 0 ? ` До следующего ранга: ${xpToNextRank} XP.` : "";
  return { title, body: `${base}${variant === "context" ? context : ""}` };
}

function habitCopy(input: HabitNotificationPlanInput, habits: HabitNotificationPlanInput["habits"], variant: HabitNotificationCandidate["variant"]) {
  const { language, settings } = input;
  if (habits.length > 1) {
    const body = language === "en"
      ? `${habits.length} actions are planned close together. GENESIS combined them into one reminder.`
      : `Рядом по времени запланировано действий: ${habits.length}. GENESIS объединил их в одно напоминание.`;
    return { title: language === "en" ? "Your next rhythm" : "Ближайший ритм", body };
  }
  const habit = habits[0];
  if (language === "en") {
    const title = settings.tone === "heroic" ? "One more step" : settings.tone === "ironic" ? "A brief interruption from postponing" : "Habit reminder";
    const body = settings.tone === "heroic"
      ? `${habit.emoji} ${habit.title}. Continue today's path.`
      : settings.tone === "ironic"
        ? `${habit.emoji} ${habit.title}. The reminder is shorter than the excuse.`
        : `${habit.emoji} Time for ${habit.title}.`;
    return { title, body: variant === "context" ? `${body} A small completed action still counts.` : body };
  }
  const title = settings.tone === "heroic" ? "Ещё один шаг" : settings.tone === "ironic" ? "Короткое отвлечение от откладывания" : "Напоминание о привычке";
  const body = settings.tone === "heroic"
    ? `${habit.emoji} ${habit.title}. Продолжите сегодняшний путь.`
    : settings.tone === "ironic"
      ? `${habit.emoji} ${habit.title}. Напоминание короче, чем отговорка.`
      : `${habit.emoji} Время для привычки «${habit.title}».`;
  return { title, body: variant === "context" ? `${body} Даже небольшое завершённое действие имеет значение.` : body };
}

export function buildHabitNotificationPlan(input: HabitNotificationPlanInput): HabitNotificationCandidate[] {
  if (!input.settings.enabled) return [];
  const earliestAllowed = input.now.getTime() - 5 * 60_000;
  const reminderHabits = input.habits
    .filter((habit) => TIME_PATTERN.test(habit.reminderTime) && !isHabitNotificationQuietTime(habit.reminderTime, input.settings))
    .sort((left, right) => left.reminderTime.localeCompare(right.reminderTime) || right.priority - left.priority);
  const groups: HabitNotificationPlanInput["habits"][] = [];
  reminderHabits.forEach((habit) => {
    const group = groups.at(-1);
    if (group && minutesFromTime(habit.reminderTime) - minutesFromTime(group.at(-1)!.reminderTime) <= GROUP_WINDOW_MINUTES) group.push(habit);
    else groups.push([habit]);
  });
  const candidates = groups.flatMap((group): HabitNotificationCandidate[] => {
    const time = group[0].reminderTime;
    const scheduled = localDateTime(input.date, time);
    if (scheduled.getTime() < earliestAllowed) return [];
    const kind = group.length > 1 ? "habit-group" as const : "habit" as const;
    const id = `notification:${input.date}:${kind}:${time}`;
    const variant = notificationVariant(id);
    const copy = habitCopy(input, group, variant);
    return [{ id, kind, variant, scheduledAt: scheduled.toISOString(), ...copy }];
  });

  const remaining = Math.max(0, input.dailyGoal.target - input.dailyGoal.completed);
  const perfectRemaining = Math.max(0, input.dailyGoal.scheduled - input.dailyGoal.completed);
  const achievable = input.dailyGoal.completed + perfectRemaining >= input.dailyGoal.target;
  const needsGoalReminder = input.settings.motivational && achievable && (remaining > 0 || (input.dailyGoal.completed >= input.dailyGoal.target && perfectRemaining === 1));
  if (needsGoalReminder && !isHabitNotificationQuietTime(input.settings.dailyGoalTime, input.settings)) {
    const scheduled = localDateTime(input.date, input.settings.dailyGoalTime);
    if (scheduled.getTime() >= earliestAllowed) {
      const nearby = candidates.find((candidate) => Math.abs(new Date(candidate.scheduledAt).getTime() - scheduled.getTime()) <= GROUP_WINDOW_MINUTES * 60_000);
      if (nearby) {
        const copy = dailyGoalCopy(input, remaining, perfectRemaining, nearby.variant);
        nearby.kind = input.dailyGoal.completed >= input.dailyGoal.target ? "perfect-day" : "daily-goal";
        nearby.title = copy.title;
        nearby.body = `${copy.body} ${input.language === "en" ? "Nearby habit reminders were combined." : "Близкие напоминания о привычках объединены."}`;
      } else {
        const kind = input.dailyGoal.completed >= input.dailyGoal.target ? "perfect-day" as const : "daily-goal" as const;
        const id = `notification:${input.date}:${kind}:${input.settings.dailyGoalTime}`;
        const variant = notificationVariant(id);
        candidates.push({ id, kind, variant, scheduledAt: scheduled.toISOString(), ...dailyGoalCopy(input, remaining, perfectRemaining, variant) });
      }
    }
  }
  return candidates.sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
}

function readTelemetry(): HabitNotificationTelemetryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TELEMETRY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.notificationId === "string").slice(-120) : [];
  } catch {
    return [];
  }
}

function recordTelemetry(candidate: Pick<HabitNotificationCandidate, "id" | "kind" | "variant">, event: HabitNotificationTelemetryEvent["event"]) {
  if (typeof window === "undefined") return;
  const metrics = [...readTelemetry(), { notificationId: candidate.id, kind: candidate.kind, variant: candidate.variant, event, occurredAt: new Date().toISOString() }].slice(-120);
  window.localStorage.setItem(TELEMETRY_KEY, JSON.stringify(metrics));
}

function deliveredIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DELIVERED_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(-60) : []);
  } catch {
    return new Set<string>();
  }
}

function hasNotificationFatigue() {
  const metrics = readTelemetry();
  const opened = new Set(metrics.filter((entry) => entry.event === "opened").map((entry) => entry.notificationId));
  const ignored = metrics.filter((entry) => entry.event === "delivered" && !opened.has(entry.notificationId));
  return ignored.slice(-3).length >= 3;
}

async function showCandidate(candidate: HabitNotificationCandidate, appBase: string) {
  const options: NotificationOptions = {
    body: candidate.body,
    tag: `genesis-${candidate.id}`,
    icon: `${appBase}/icons/icon-192.png`,
    badge: `${appBase}/icons/icon-192.png`,
    data: { genesisNotificationId: candidate.id, kind: candidate.kind, variant: candidate.variant, url: `${appBase || "/"}#today` },
  };
  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration) await registration.showNotification(candidate.title, options);
  else new Notification(candidate.title, options);
  const delivered = deliveredIds();
  delivered.add(candidate.id);
  window.localStorage.setItem(DELIVERED_KEY, JSON.stringify(Array.from(delivered).slice(-60)));
  recordTelemetry(candidate, "delivered");
}

export function habitNotificationPermission(): HabitNotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestHabitNotificationPermission(): Promise<HabitNotificationPermission> {
  if (habitNotificationPermission() === "unsupported") return "unsupported";
  return Notification.requestPermission();
}

export function scheduleHabitNotifications(candidates: readonly HabitNotificationCandidate[], appBase = "") {
  if (typeof window === "undefined" || habitNotificationPermission() !== "granted") return () => undefined;
  const delivered = deliveredIds();
  const fatigue = hasNotificationFatigue();
  const timers = candidates.flatMap((candidate) => {
    if (delivered.has(candidate.id) || (fatigue && ["daily-goal", "perfect-day"].includes(candidate.kind))) return [];
    const delay = Math.max(0, new Date(candidate.scheduledAt).getTime() - Date.now());
    if (delay > 24 * 60 * 60_000) return [];
    return [window.setTimeout(() => void showCandidate(candidate, appBase), delay)];
  });
  return () => timers.forEach((timer) => window.clearTimeout(timer));
}

export function observeHabitNotificationClicks() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => undefined;
  const listener = (event: MessageEvent) => {
    const payload = event.data as { type?: string; notificationId?: string; kind?: HabitNotificationCandidate["kind"]; variant?: HabitNotificationCandidate["variant"] };
    if (payload?.type !== "GENESIS_NOTIFICATION_OPENED" || !payload.notificationId || !payload.kind || !payload.variant) return;
    recordTelemetry({ id: payload.notificationId, kind: payload.kind, variant: payload.variant }, "opened");
  };
  navigator.serviceWorker.addEventListener("message", listener);
  return () => navigator.serviceWorker.removeEventListener("message", listener);
}

export function recordHabitNotificationsDisabled() {
  recordTelemetry({ id: `notification-disabled:${new Date().toISOString().slice(0, 10)}`, kind: "daily-goal", variant: "concise" }, "disabled");
}

export function suggestHabitReminderTime(completions: readonly { completed: boolean; updatedAt: string }[], currentTime: string) {
  const times = completions
    .filter((entry) => entry.completed && !Number.isNaN(Date.parse(entry.updatedAt)))
    .slice(-30)
    .map((entry) => {
      const value = new Date(entry.updatedAt);
      return value.getHours() * 60 + value.getMinutes();
    })
    .sort((left, right) => left - right);
  if (times.length < 4 || !TIME_PATTERN.test(currentTime)) return null;
  const median = times[Math.floor(times.length / 2)];
  if (Math.abs(median - minutesFromTime(currentTime)) < 30) return null;
  return { time: `${String(Math.floor(median / 60)).padStart(2, "0")}:${String(median % 60).padStart(2, "0")}`, sampleSize: times.length };
}
