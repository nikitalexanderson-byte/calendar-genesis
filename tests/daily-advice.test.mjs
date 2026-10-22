import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAdviceParagraphs, mergeAdviceCatalog, adviceCategories } from "../scripts/import-daily-advice.mjs";
import { adviceAvailableCategories, adviceHabitScores, adviceHabitTopicScores, advicePreferences } from "../app/daily-advice.ts";
import { verifyDailyAdvice } from "../scripts/verify-daily-advice.mjs";

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

test("nutrition matching covers supported scripts and ignores paused or future habits", () => {
  const habit = title => ({ id: "food", title, description: "", ritualName: "", createdDate: "2026-01-01", active: true,
    priority: 1, isKeyHabit: false, sourceTemplateId: null, sacredSectorId: null, schedule: { startDate: "2026-01-01", endDate: null } });
  for (const title of ["Пищевые привычки", "Balanced nutrition", "Διατροφή", "Gesunde Ernährung", "Alimentation", "Alimentación",
    "Alimentazione", "Alimentação", "Zdrowe odżywianie", "Здрава исхрана", "Здорове харчування", "每天规律饮食", "Dengeli beslenme", "毎日の食事"]) {
    assert.ok(adviceHabitTopicScores([habit(title)], "2026-10-22").nutrition > 0, title);
  }
  const food = habit("Пищевые привычки");
  assert.deepEqual(Object.keys(adviceHabitTopicScores([food], "2026-10-22")), ["nutrition", "training", "recovery", "discipline"]);
  for (const changes of [{ active: false }, { createdDate: "2027-01-01" }, { schedule: { startDate: "2027-01-01", endDate: null } }]) {
    assert.ok(Object.values(adviceHabitTopicScores([{ ...food, ...changes }], "2026-10-22")).every(score => score === 0));
  }
  assert.deepEqual(adviceAvailableCategories(), ["aretology"]);
  assert.deepEqual(adviceAvailableCategories(["aretology", "kourotrophy"]), ["aretology", "kourotrophy"]);
  assert.deepEqual(adviceAvailableCategories([]), []);
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

test("published advice has complete titles and bodies in all fourteen languages and distinct real artwork", async () => {
  const result = await verifyDailyAdvice();
  assert.deepEqual(result, { published: 152, drafts: 8, languages: 14, illustrations: 152 });
  const catalog = JSON.parse(await readFile(new URL("../server/content/daily-advice.json", import.meta.url), "utf8"));
  assert.equal(catalog.items[18].title, "Точность Прямодействия");
  assert.ok(catalog.items[18].body.endsWith("Любая задача, которую ты решил довести до конца, должна выполняться с предельной интенсивностью, без оглядки на усталость."));
  assert.equal(catalog.items[18].status, undefined);
  assert.deepEqual(catalog.items.map((entry, index) => entry.status === "draft" ? index + 1 : null).filter(Boolean), [26, 60, 65, 70, 97, 98, 99, 100]);
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
