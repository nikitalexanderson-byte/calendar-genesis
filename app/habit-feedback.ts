export type HabitFeedbackSettings = {
  animations: boolean;
  sound: boolean;
  haptics: boolean;
  achievementPopups: boolean;
  questsEnabled: boolean;
  gamificationWidgets: boolean;
};

export type HabitFeedbackKind = "completion" | "daily-goal" | "perfect-day" | "rank-up";

export type HabitFeedbackEvent = {
  id: string;
  habitId: string;
  habitTitle: string;
  habitEmoji: string;
  kind: HabitFeedbackKind;
  xp: number;
  laurels: number;
  rankTitle: string;
  rankTitleEn: string;
  achievementTitle: string;
  achievementTitleEn: string;
};

export const DEFAULT_HABIT_FEEDBACK_SETTINGS: HabitFeedbackSettings = {
  animations: true,
  sound: false,
  haptics: false,
  achievementPopups: true,
  questsEnabled: true,
  gamificationWidgets: true,
};

export function normalizeHabitFeedbackSettings(value: Partial<HabitFeedbackSettings> | null | undefined): HabitFeedbackSettings {
  return {
    animations: typeof value?.animations === "boolean" ? value.animations : DEFAULT_HABIT_FEEDBACK_SETTINGS.animations,
    sound: typeof value?.sound === "boolean" ? value.sound : DEFAULT_HABIT_FEEDBACK_SETTINGS.sound,
    haptics: typeof value?.haptics === "boolean" ? value.haptics : DEFAULT_HABIT_FEEDBACK_SETTINGS.haptics,
    achievementPopups: typeof value?.achievementPopups === "boolean" ? value.achievementPopups : DEFAULT_HABIT_FEEDBACK_SETTINGS.achievementPopups,
    questsEnabled: typeof value?.questsEnabled === "boolean" ? value.questsEnabled : DEFAULT_HABIT_FEEDBACK_SETTINGS.questsEnabled,
    gamificationWidgets: typeof value?.gamificationWidgets === "boolean" ? value.gamificationWidgets : DEFAULT_HABIT_FEEDBACK_SETTINGS.gamificationWidgets,
  };
}

function hapticPattern(kind: HabitFeedbackKind) {
  if (kind === "rank-up") return [28, 38, 42, 38, 64];
  if (kind === "perfect-day") return [24, 34, 48];
  if (kind === "daily-goal") return [24, 28, 32];
  return 22;
}

function feedbackNotes(kind: HabitFeedbackKind) {
  if (kind === "rank-up") return [392, 523.25, 659.25];
  if (kind === "perfect-day") return [440, 554.37, 659.25];
  if (kind === "daily-goal") return [392, 523.25];
  return [440];
}

function playFeedbackSound(kind: HabitFeedbackKind) {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return;
  try {
    const context = new window.AudioContext();
    const master = context.createGain();
    const notes = feedbackNotes(kind);
    const now = context.currentTime;
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.085, now + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.24, notes.length * 0.12 + 0.08));
    master.connect(context.destination);
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      const start = now + index * 0.1;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(0.7, start + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      oscillator.connect(noteGain);
      noteGain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });
    window.setTimeout(() => { void context.close(); }, 700);
  } catch {
    // Feedback must never block an offline completion on restricted devices.
  }
}

export function deliverHabitFeedback(kind: HabitFeedbackKind, settings: HabitFeedbackSettings) {
  if (typeof window === "undefined") return;
  if (settings.haptics && typeof navigator.vibrate === "function") navigator.vibrate(hapticPattern(kind));
  if (settings.sound) playFeedbackSound(kind);
}
