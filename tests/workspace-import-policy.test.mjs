import assert from "node:assert/strict";
import test from "node:test";
import { shouldSeedRemoteWorkspace } from "../app/workspace-import-policy.ts";
import { shouldUploadCachedTask } from "../app/task-sync-policy.ts";

test("a deleted last habit is not restored from stale local data on sign in", () => {
  assert.equal(shouldSeedRemoteWorkspace(true, 1), false);
  assert.equal(shouldSeedRemoteWorkspace(true, 0), false);
  assert.equal(shouldSeedRemoteWorkspace(false, 1), true);
});

test("sign-in never recreates an absent previously synced task from stale cache", () => {
  const task = { id: "task", updatedAt: 10 };
  assert.equal(shouldUploadCachedTask({ ...task, googleEventId: "event" }, undefined, false), false);
  assert.equal(shouldUploadCachedTask({ ...task, googleLinks: { secondary: { eventId: "event" } } }, undefined, false), false);
  assert.equal(shouldUploadCachedTask({ ...task, googleTaskId: "google-task" }, undefined, false), false);
  assert.equal(shouldUploadCachedTask(task, undefined, true), false);
  assert.equal(shouldUploadCachedTask(task, undefined, false), true);
  assert.equal(shouldUploadCachedTask(task, { ...task, updatedAt: 5 }, false), true);
  assert.equal(shouldUploadCachedTask(task, { ...task, updatedAt: 15 }, false), false);
});
