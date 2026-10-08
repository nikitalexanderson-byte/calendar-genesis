import assert from "node:assert/strict";
import test from "node:test";
import { matchesAffair } from "../app/affairs-search.ts";
import { restoredSharedProject } from "../app/shared-expansion.ts";
import { normalizeMoonReminderSettings, planMoonReminders } from "../app/moon-reminders.ts";

test("shared tree restores visible paths and skips hidden children, inboxes and deleted projects", () => {
  const projects = [{ id: "root" }, { id: "child", parentId: "root" }, { id: "inbox", isInbox: true }];
  assert.equal(restoredSharedProject(projects, []), "");
  assert.equal(restoredSharedProject(projects, ["child"]), "");
  assert.equal(restoredSharedProject(projects, ["root", "child", "inbox", "deleted"]), "child");
  assert.equal(restoredSharedProject([{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }], ["a", "b"]), "");
});

test("live affair search combines partial names and tags, with explicit #tag semantics", () => {
  const project = { title: "Разработка сайта", tags: ["Генезис", "работа"] };
  assert.equal(matchesAffair(project, "разр"), true);
  assert.equal(matchesAffair(project, "РАЗР #ген"), true);
  assert.equal(matchesAffair(project, "#разработка"), false);
  assert.equal(matchesAffair(project, "разр #дом"), false);
  assert.equal(matchesAffair({ title: "Всё готово" }, "все"), true);
});
test("moon settings validate, deduplicate and keep independent choices", () => {
  assert.deepEqual(normalizeMoonReminderSettings({ full: [3, 1, 3, 0, 9], new: [2] }), { full: [1, 3], new: [2] });
  assert.deepEqual(normalizeMoonReminderSettings(null), { full: [], new: [] });
});
test("October phases produce individual reminders at 09:00 local, with no past entries", () => {
  const after = new Date(2026, 9, 7, 0);
  const plans = planMoonReminders(after, { full: [1, 2, 3], new: [1, 2, 3] }, 30);
  assert.equal(plans.length, 6);
  assert.deepEqual(plans.map((plan) => plan.eventDate), ["2026-10-10", "2026-10-10", "2026-10-10", "2026-10-26", "2026-10-26", "2026-10-26"]);
  assert.ok(plans.every((plan) => plan.at.getHours() === 9 && plan.at.getMinutes() === 0 && plan.at > after));
  assert.equal(new Set(plans.map((plan) => plan.key)).size, 6);
  assert.deepEqual(planMoonReminders(after, { full: [], new: [] }), []);
  assert.ok(planMoonReminders(new Date(2026, 9, 9, 10), { full: [], new: [1, 2, 3] }, 2).length === 0);
});
