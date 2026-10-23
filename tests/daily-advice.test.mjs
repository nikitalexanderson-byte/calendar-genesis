import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAdviceParagraphs, mergeAdviceCatalog, adviceCategories } from "../scripts/import-daily-advice.mjs";
import { ADVICE_TOPICS, adviceAvailableCategories, adviceHabitScores, adviceHabitTopicScores, adviceTaskContext, advicePreferences } from "../app/daily-advice.ts";
import { adviceLanguages, verifyAdvicePairing, verifyDailyAdvice } from "../scripts/verify-daily-advice.mjs";

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
  assert.deepEqual(Object.keys(adviceHabitTopicScores([food], "2026-10-22")), [...ADVICE_TOPICS]);
  for (const changes of [{ active: false }, { createdDate: "2027-01-01" }, { schedule: { startDate: "2027-01-01", endDate: null } }]) {
    assert.ok(Object.values(adviceHabitTopicScores([{ ...food, ...changes }], "2026-10-22")).every(score => score === 0));
  }
  assert.deepEqual(adviceAvailableCategories(), ["aretology", "hestiology"]);
  assert.deepEqual(adviceAvailableCategories(["aretology", "kourotrophy"]), ["aretology", "kourotrophy"]);
  assert.deepEqual(adviceAvailableCategories([]), []);
});

test("private task intentions match clothing, attributes and cleaning in supported scripts without leaking text", () => {
  const task = title => ({ title, description: "", done: false, dueDate: "2026-10-23" });
  for (const title of ["Купить одежду", "Сходить пошопиться", "Buy clothes", "Acheter des chaussures", "Kleidung kaufen", "Comprar ropa", "Comprare scarpe", "Comprar roupas", "Kupić ubrania", "Купити одећу", "Купити одяг", "Kıyafet alışverişi", "买衣服", "服を買う", "Αγορά ρούχων"]) {
    const result = adviceTaskContext([task(title)], "2026-10-23");
    assert.ok(result.topics.clothing > 0 && result.scores.hestiology > 0, title);
    assert.ok(!JSON.stringify(result).includes(title));
  }
  assert.ok(adviceTaskContext([task("Купить какой-то атрибут")], "2026-10-23").topics.attributes > 0);
  for (const title of ["Купить куртку", "Buy a jacket", "Acheter un manteau", "Kupić płaszcz", "新しいコートを買う", "买袜子"])
    assert.ok(adviceTaskContext([task(title)], "2026-10-23").topics.clothing > 0, title);
  assert.ok(adviceTaskContext([task("Купить браслет")], "2026-10-23").topics.attributes > 0);
  for (const title of ["Shopping for groceries", "Lebensmittel einkaufen", "Compras de alimentos", "Сходить на шопинг за продуктами", "食品の買い物"])
    assert.equal(adviceTaskContext([task(title)], "2026-10-23").topics.clothing, 0, title);
  for (const title of ["为客户提供服务", "薬を服用する"])
    assert.equal(adviceTaskContext([task(title)], "2026-10-23").topics.clothing, 0, title);
  assert.ok(adviceTaskContext([task("Shopping for a shirt and groceries")], "2026-10-23").topics.clothing > 0);
  for (const title of ["Organise a meeting", "Разобрать задачи"])
    assert.equal(adviceTaskContext([task(title)], "2026-10-23").topics.cleaning, 0, title);
  for (const title of ["Запланировать уборку", "Clean the kitchen", "Nettoyer la maison", "Wohnung aufräumen", "Limpiar la casa", "Pulire la casa", "Limpeza da casa", "Sprzątanie", "Чишћење стана", "Прибирання", "Ev temizliği", "打扫房间", "部屋の掃除", "Καθαρισμός σπιτιού"])
    assert.ok(adviceTaskContext([task(title)], "2026-10-23").topics.cleaning > 0, title);
  for (const changes of [{ done: true }, { entryType: "birthday" }, { dueDate: "2027-01-01" }])
    assert.ok(Object.values(adviceTaskContext([{ ...task("Купить одежду"), ...changes }], "2026-10-23").topics).every(score => score === 0));
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
  assert.deepEqual(result, { published: 312, drafts: 0, languages: 14, illustrations: 312 });
  const catalog = JSON.parse(await readFile(new URL("../server/content/daily-advice.json", import.meta.url), "utf8"));
  assert.equal(catalog.items.filter(entry => entry.categories.includes("hestiology")).length, 152);
  assert.deepEqual([...new Set(catalog.items.flatMap(entry => entry.categories))].sort(), ["aretology", "hestiology"]);
  assert.equal(catalog.items[18].title, "Точность Прямодействия");
  assert.ok(catalog.items[18].body.endsWith("Любая задача, которую ты решил довести до конца, должна выполняться с предельной интенсивностью, без оглядки на усталость."));
  assert.equal(catalog.items[18].status, undefined);
  assert.equal(catalog.items[25].id, "advice-a981fcbe698a094088afcbd5");
  assert.deepEqual(catalog.items.map((entry, index) => entry.status === "draft" ? index + 1 : null).filter(Boolean), []);
});

test("reviewed locale pairs reject another advice's title or body in every language", async () => {
  const catalog = JSON.parse(await readFile(new URL("../server/content/daily-advice.json", import.meta.url), "utf8"));
  const review = JSON.parse(await readFile(new URL("../server/content/daily-advice-pairings.json", import.meta.url), "utf8"));
  const fasting = catalog.items.find(entry => entry.id === "advice-fe0f86e475bc9350744f1095");
  const other = catalog.items[0];
  for (const language of adviceLanguages) {
    const locale = JSON.parse(await readFile(new URL(`../server/content/daily-advice/${fasting.contentVersion}/${language}.json`, import.meta.url), "utf8"));
    assert.doesNotThrow(() => verifyAdvicePairing(fasting, language, locale[fasting.id], review.entries[fasting.id]));
    assert.throws(() => verifyAdvicePairing(fasting, language, { ...locale[fasting.id], title: locale[other.id].title }, review.entries[fasting.id]), /title\/body pairing/);
    assert.throws(() => verifyAdvicePairing(fasting, language, { ...locale[fasting.id], body: locale[other.id].body }, review.entries[fasting.id]), /title\/body pairing/);
    const formerTitle = review.titleCorrections.find(change => change.id === fasting.id).locales[language].before;
    assert.throws(() => verifyAdvicePairing(fasting, language, { ...locale[fasting.id], title: formerTitle }, review.entries[fasting.id]), /title\/body pairing/);
  }
});

test("reviewed advice identity also binds category, illustration, version and language", async () => {
  const catalog = JSON.parse(await readFile(new URL("../server/content/daily-advice.json", import.meta.url), "utf8"));
  const review = JSON.parse(await readFile(new URL("../server/content/daily-advice-pairings.json", import.meta.url), "utf8"));
  const entry = catalog.items[0], other = catalog.items[1];
  const content = { title: entry.title, body: entry.body };
  for (const change of [{ id: other.id }, { categories: ["hestiology"] }, { image: other.image }, { contentVersion: "other-version" }]) {
    assert.throws(() => verifyAdvicePairing({ ...entry, ...change }, "ru", content, review.entries[entry.id]), /title\/body pairing/);
  }
  assert.throws(() => verifyAdvicePairing(entry, "en", content, review.entries[entry.id]), /title\/body pairing/);
  assert.throws(() => verifyAdvicePairing(entry, "ru", content, undefined), /title\/body pairing/);
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
