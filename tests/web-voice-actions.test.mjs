import assert from "node:assert/strict";
import test from "node:test";
import { parseWebVoiceAction } from "../app/web-voice-actions.ts";

const tasks = [{ id: "task-1", title: "Позвонить врачу" }, { id: "task-2", title: "Позвонить коллеге" }];
const projects = [{ id: "project-1", title: "Здоровье" }];
const habits = [{ id: "habit-1", title: "Утренняя зарядка" }];

test("background voice commands navigate and resolve task, project, and habit targets", () => {
  assert.deepEqual(parseWebVoiceAction("открой сон и настроение", tasks, projects, habits), { kind: "navigate", section: "habits" });
  assert.deepEqual(parseWebVoiceAction("отметь привычку Утренняя зарядка", tasks, projects, habits),
    { kind: "complete-habit", id: "habit-1", title: "Утренняя зарядка" });
  assert.deepEqual(parseWebVoiceAction("перемести задачу Позвонить врачу в проект Здоровье", tasks, projects, habits),
    { kind: "move-task", id: "task-1", title: "Позвонить врачу", projectId: "project-1" });
});

test("background voice commands refuse ambiguous targets and unsupported actions", () => {
  assert.throws(() => parseWebVoiceAction("выполни задачу Позвонить", tasks, projects, habits), /несколько совпадений/);
  assert.equal(parseWebVoiceAction("отправь сообщение", tasks, projects, habits), null);
  assert.equal(parseWebVoiceAction("создай задачу одну; удали другую", tasks, projects, habits), null);
});

test("calendar voice variants keep display mode, period, date and movement distinct", () => {
  const parse = (phrase) => parseWebVoiceAction(phrase, tasks, projects, habits);
  assert.deepEqual(parse("переключи календарь на лунный"), { kind: "calendar-mode", mode: "lunar" });
  assert.deepEqual(parse("Генезис, пожалуйста, переключи календарь на лунный!"), { kind: "calendar-mode", mode: "lunar" });
  assert.deepEqual(parse("покажи григорианский календарь"), { kind: "calendar-mode", mode: "profane" });
  assert.deepEqual(parse("выбери сакральный"), { kind: "calendar-mode", mode: "sacred" });
  assert.deepEqual(parse("открой год"), { kind: "calendar-view", view: "year" });
  assert.deepEqual(parse("покажи месяц"), { kind: "calendar-view", view: "calendar" });
  assert.deepEqual(parse("следующий месяц"), { kind: "calendar-step", unit: "month", step: 1 });
  assert.deepEqual(parse("год назад"), { kind: "calendar-step", unit: "year", step: -1 });
  assert.deepEqual(parse("свайпни влево"), { kind: "calendar-swipe", step: 1 });
  assert.deepEqual(parse("прокрути экран вверх"), { kind: "scroll", direction: "up" });
  assert.deepEqual(parse("покажи 12 октября 2026"), { kind: "calendar-date", year: 2026, month: 10, day: 12 });
  assert.deepEqual(parse("покажи 3 мая 2026"), { kind: "calendar-date", year: 2026, month: 5, day: 3 });
  assert.deepEqual(parse("открой месяц 5"), { kind: "calendar-month", ordinal: 5 });
});
