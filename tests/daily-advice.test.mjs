import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAdviceParagraphs, mergeAdviceCatalog, adviceCategories } from "../scripts/import-daily-advice.mjs";
import { adviceHabitScores, advicePreferences } from "../app/daily-advice.ts";

test("paragraph import preserves text and stable IDs across reorder, BOM, CRLF, and reflow", () => {
  const entries = parseAdviceParagraphs("\uFEFFFirst line\r\ncontinued.\r\n\r\nSecond post.\r\n", "hermetica");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].body, "First line\ncontinued.");
  assert.equal(entries[0].id, parseAdviceParagraphs("Second post.\n\nFirst line continued.", "aretology")[1].id);
  const catalog = { version: 1, tradition: ["Plato"], items: [] };
  const merged = mergeAdviceCatalog(mergeAdviceCatalog(catalog, entries), parseAdviceParagraphs("First line continued.", "aretology"));
  assert.equal(merged.items.length, 2);
  assert.deepEqual(merged.items[0].categories, ["aretology", "hermetica"]);
  assert.deepEqual(merged.tradition, catalog.tradition);
  assert.equal(merged.items[0].body, "First line\ncontinued.");
  assert.deepEqual(merged.items[0].sources, []);
});

test("invalid imports fail before writing content or inventing citations", () => {
  assert.throws(() => parseAdviceParagraphs(" ", "hermetica"));
  assert.throws(() => parseAdviceParagraphs("Text", "unknown"));
  assert.throws(() => parseAdviceParagraphs("a".repeat(24001), "hermetica"));
  assert.throws(() => parseAdviceParagraphs("Text", "hermetica", { sources: [{ kind: "quote" }] }));
  const item = parseAdviceParagraphs("Example", "hermetica")[0];
  assert.throws(() => mergeAdviceCatalog({ version: 1, items: [item, item] }, []));
});

test("all fourteen interface locales cover every control and all six categories", async () => {
  const copy = JSON.parse(await readFile(new URL("../app/daily-advice-copy.json", import.meta.url), "utf8"));
  assert.equal(Object.keys(copy).length, 14);
  for (const locale of Object.values(copy)) {
    assert.deepEqual(Object.keys(locale).sort(), Object.keys(copy.ru).sort());
    assert.equal(locale.categories.length, adviceCategories.length);
    assert.equal(locale.categoryHints.length, adviceCategories.length);
    assert.ok(Object.values(locale).every(value => typeof value === "string" ? value.length > 0 : value.every(Boolean)));
  }
});

test("smart affinity uses only active, current habits and keeps all six numeric scores private", () => {
  const habit = (changes = {}) => ({ id: "fixture", title: "", description: "", ritualName: "", createdDate: "2026-01-01", active: true,
    priority: 1, isKeyHabit: false, sourceTemplateId: null, sacredSectorId: null, schedule: { startDate: "2026-01-01", endDate: null }, ...changes });
  const scores = adviceHabitScores([habit({ title: "Read Plato", sourceTemplateId: "reading" }), habit({ title: "Home cleaning", id: "home" })], "2026-10-22");
  assert.ok(scores.hermetica > 0 && scores.hestiology > 0);
  assert.equal(scores.aphrodisia, 0);
  for (const changes of [{ active: false }, { createdDate: "2027-01-01" }, { schedule: { startDate: "2027-01-01", endDate: null } },
    { schedule: { startDate: "2026-01-01", endDate: "2026-09-01" } }, { lifecycleHistory: [{ habitId: "fixture", id: "archive", date: "2026-10-20", status: "archived", baselineActive: true, replaces: [] }] }]) {
    assert.ok(Object.values(adviceHabitScores([habit({ ...changes, title: "Training", sourceTemplateId: "walk" })], "2026-10-22")).every(value => value === 0));
  }
  const workout = adviceHabitScores([habit({ title: "Workout" })], "2026-10-22");
  assert.ok(workout.aretology > 0); assert.equal(workout.hermetica, 0);
  assert.deepEqual(Object.keys(scores), adviceCategories);
  assert.equal(advicePreferences({ enabled: false }).enabled, false);
  assert.equal(advicePreferences().smart, true);
});
