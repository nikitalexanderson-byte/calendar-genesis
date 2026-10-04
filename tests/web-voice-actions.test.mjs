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
