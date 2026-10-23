import assert from "node:assert/strict";
import test from "node:test";
import { calendarModule } from "./helpers/calendar-modules.mjs";
const habits = calendarModule("app/habits.ts"), practices = calendarModule("app/sacred-practices.ts");
const goals = calendarModule("app/habit-practice-goal.ts"), rewards = calendarModule("app/rewards.ts");
const plain = value => JSON.parse(JSON.stringify(value));
const start = "2026-10-23", next = "2026-10-24", expired = "2026-10-25";
function fixture(mode = "profane") {
  const habit = habits.createHabitFromSacredPractice(practices.SACRED_PRACTICES[0], start, mode, "ru");
  return { habit, workspace: { ...habits.EMPTY_HABIT_WORKSPACE, habits: [habit] } };
}
for (const mode of ["profane", "sacred", "lunar"]) test(`a new sacred practice is available once in a two-day window (${mode})`, () => {
  const { habit, workspace } = fixture(mode);
  assert.equal(habit.practiceGoal.requiredCompletions, 1);
  assert.equal(habit.schedule.endDate, next);
  assert.equal(habits.isHabitScheduledForDate(habit, start, mode), true);
  assert.equal(habits.isHabitScheduledForDate(habit, next, mode), true);
  assert.equal(habits.isHabitScheduledForDate(habit, expired, mode), false);
  const done = habits.updateHabitCompletion(workspace, habit, start, { completed: true }, start);
  assert.equal(goals.habitPracticeProgress(habit, done.habitCompletions, start).status, "completed");
  assert.equal(habits.isHabitScheduledForDate(habit, next, mode, done.habitCompletions), false);
  assert.equal(habits.updateHabitCompletion(done, habit, next, { completed: true }, next), done);
  assert.equal(goals.reconcilePracticePenalties([habit], done.habitCompletions, [], expired).length, 0);
});
test("the first day is neutral; the last allowed day may complete the practice", () => {
  const { habit, workspace } = fixture();
  const neutral = habits.dailyGoalForDate(workspace, start, "profane", next);
  assert.equal(neutral.scheduledCount, 0);
  assert.equal(goals.reconcilePracticePenalties([habit], [], [], next).length, 0);
  const done = habits.updateHabitCompletion(workspace, habit, next, { completed: true }, next);
  assert.equal(goals.habitPracticeProgress(habit, done.habitCompletions, expired).status, "completed");
  assert.equal(habits.dailyGoalForDate(done, next, "profane", next).completedCount, 1);
});

test("pausing a finite practice still removes it from the daily goal", () => {
  const { habit, workspace } = fixture();
  const paused = { ...workspace, habits: [{ ...habit, active: false }] };
  assert.equal(habits.dailyGoalForDate(paused, next, "profane", next).scheduledCount, 0);
  assert.equal(habits.dailyGoalForDate(workspace, next, "profane", next).scheduledCount, 1);
});
test("expiry debits ten Laurels once, preserves XP and is repaired by a timely offline completion", () => {
  const { habit, workspace } = fixture();
  const seed = rewards.createRewardTransaction({ amount: 40, reason: "achievement", sourceId: "test", idempotencyKey: "test", createdAt: `${start}T00:00:00Z` });
  const first = goals.reconcilePracticePenalties([habit], [], [seed], expired);
  const second = goals.reconcilePracticePenalties([habit], [], [...first, ...first], "2026-11-25");
  assert.equal(rewards.calculateLaurelsBalance(first), 30);
  assert.deepEqual(plain(second), plain(first));
  const done = habits.updateHabitCompletion(workspace, habit, next, { completed: true }, next);
  assert.equal(rewards.calculateLaurelsBalance(goals.reconcilePracticePenalties([habit], done.habitCompletions, second, expired)), 40);
  const closed = habits.ensureDailyGoalProgress({ ...workspace, rewardTransactions: [seed], userProgress: { ...workspace.userProgress, lifetimeXp: 160 } }, "profane", expired);
  assert.equal(closed.userProgress.lifetimeXp, 160);
  assert.equal(closed.userProgress.laurelsBalance, 30);
});
test("a configured longer deadline is honored and two offline days do not double XP", () => {
  const { habit, workspace } = fixture();
  habit.schedule.endDate = "2026-10-30"; habit.schedule.recurrence.rangeEnd = "2026-10-30";
  assert.equal(goals.habitPracticeProgress(habit, [], expired).status, "open");
  const a = habits.updateHabitCompletion(workspace, habit, start, { completed: true }, start);
  const b = habits.updateHabitCompletion(workspace, habit, next, { completed: true }, next);
  const credits = goals.practiceXpSources([habit], [...a.habitCompletions, ...b.habitCompletions]);
  assert.equal(credits.length, 1); assert.equal(credits[0].xpAwarded, 10);
});
test("legacy sacred habits retain their original schedule, history and economy", () => {
  const { habit } = fixture(); delete habit.practiceGoal;
  habit.schedule.endDate = null; habit.schedule.recurrence.rangeEnd = "";
  assert.equal(goals.habitPracticeProgress(habit, [], expired), null);
  assert.equal(goals.reconcilePracticePenalties([habit], [], [], expired).length, 0);
  assert.equal(habits.isHabitScheduledForDate(habit, expired), true);
});

test("an already completed historical default practice closes without enrolling old failures in penalties", () => {
  const { habit, workspace } = fixture();
  const done = habits.updateHabitCompletion(workspace, habit, start, { completed: true }, start);
  delete habit.practiceGoal;
  habit.schedule.endDate = null; habit.schedule.recurrence.rangeEnd = ""; habit.schedule.recurrence.enabled = false;
  assert.equal(goals.habitPracticeProgress(habit, done.habitCompletions, expired).status, "completed");
  assert.equal(goals.reconcilePracticePenalties([habit], [], [], expired).length, 0);
  const untouched = plain(habit);
  goals.habitPracticeProgress(habit, done.habitCompletions, expired);
  assert.deepEqual(plain(habit), untouched);
});

test("a configured multi-completion practice stays open until its selected target is met", () => {
  const { habit, workspace } = fixture(); habit.practiceGoal.requiredCompletions = 2;
  const first = habits.updateHabitCompletion(workspace, habit, start, { completed: true }, start);
  assert.equal(goals.habitPracticeProgress(habit, first.habitCompletions, next).status, "open");
  const second = habits.updateHabitCompletion(first, habit, next, { completed: true }, next);
  assert.equal(goals.habitPracticeProgress(habit, second.habitCompletions, expired).status, "completed");
});

test("the stored timezone owns expiry even when the device has already crossed midnight", () => {
  const { habit } = fixture(); habit.schedule.timezone = "Pacific/Honolulu";
  assert.equal(goals.reconcilePracticePenalties([habit], [], [], expired, new Date("2026-10-25T09:59:59.999Z")).length, 0);
  const ledger = goals.reconcilePracticePenalties([habit], [], [], expired, new Date("2026-10-25T10:00:00.000Z"));
  assert.equal(ledger.length, 1); assert.equal(ledger[0].createdAt, "2026-10-25T10:00:00.000Z");
});

test("an older client's fifty-day deletion reset cannot wipe a finite practice's Laurel balance", () => {
  const { habit, workspace } = fixture();
  const seed = rewards.createRewardTransaction({ amount: 40, reason: "achievement", sourceId: "seed", idempotencyKey: "seed", createdAt: `${start}T00:00:00Z` });
  const old = rewards.resetLaurelsBalance([seed], "habit-deleted-reset", habit.id, "old-client-delete", `${next}T10:00:00Z`);
  const done = habits.updateHabitCompletion(workspace, habit, start, { completed: true }, start);
  assert.equal(rewards.calculateLaurelsBalance(goals.reconcilePracticePenalties([habit], done.habitCompletions, old, expired)), 40);
  assert.equal(rewards.calculateLaurelsBalance(goals.reconcilePracticePenalties([habit], [], old, expired)), 30);
});

test("attaching a practice preserves a regular habit's earlier legitimate Laurel reset", () => {
  const { habit, workspace } = fixture();
  habit.stoicheionRestoration = { startedAt: `${start}T12:00:00Z`, startedDate: start, sourceDate: start };
  const seed = rewards.createRewardTransaction({ amount: 40, reason: "achievement", sourceId: "seed", idempotencyKey: "seed", createdAt: `${start}T00:00:00Z` });
  const before = rewards.resetLaurelsBalance([seed], "habit-deleted-reset", habit.id, "before-attachment", `${start}T11:00:00Z`);
  const earned = rewards.createRewardTransaction({ amount: 20, reason: "achievement", sourceId: "earned", idempotencyKey: "earned", createdAt: `${start}T13:00:00Z` });
  const ledger = rewards.resetLaurelsBalance([...before, earned], "habit-deleted-reset", habit.id, "after-attachment", `${start}T14:00:00Z`);
  const done = habits.updateHabitCompletion(workspace, habit, start, { completed: true }, start);
  const reconciled = goals.reconcilePracticePenalties([habit], done.habitCompletions, ledger, expired);
  assert.equal(rewards.calculateLaurelsBalance(reconciled), 20);
  assert.equal(reconciled.filter(row => row.reason === "habit-deleted-reset").length, 1);
  assert.equal(rewards.calculateLaurelsBalance(goals.reconcilePracticePenalties([habit], [], ledger, expired)), 10);
});
