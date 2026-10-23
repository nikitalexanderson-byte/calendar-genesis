import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { clearPrivateDeviceStorage } from "../app/local-sign-out.ts";
import { cloudSyncClient, deferred } from "./helpers/cloud-sync-client.mjs";

const taskPath = "/shared/projects/cache-project/tasks/cache-task";
const task = { id: "cache-task", projectId: "cache-project", title: "Synthetic private title", revision: 1 };
const draft = { requestId: "draft-exact-id", projectId: "cache-project", path: taskPath, method: "PATCH", kind: "update", taskId: task.id,
  body: JSON.stringify({ title: "Unsent synthetic edit", expectedRevision: 1 }), title: "Unsent synthetic edit", dueDate: null, queuedAt: "2026-10-22T12:00:00Z" };
const ok = value => Response.json(value);
const denied = status => Response.json({ error: "SHARED_PROJECT_FORBIDDEN" }, { status });
const cacheEntry = (payload, savedAt = Date.now()) => ({ savedAt, payload });
const queryFilter = { projectIds: ["cache-project"] };
const queryPath = `/shared/tasks?filter=${encodeURIComponent(JSON.stringify(queryFilter))}&sort=position`;

for (const status of [401, 403, 404]) test(`a late successful read cannot restore content after HTTP ${status}`, async () => {
  const fixture = await cloudSyncClient();
  await fixture.seedStore({ cache: {}, queue: [draft] });
  const pending = deferred(), entered = deferred();
  fixture.respond(async () => { entered.resolve(); return pending.promise; });
  const oldRead = fixture.client.loadSharedTask("cache-project", "cache-task");
  await entered.promise;
  fixture.respond(() => denied(status));
  await assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"), error => error.status === status);
  pending.resolve(ok({ task }));
  await oldRead.catch(() => undefined);
  fixture.respond(() => { throw new TypeError("Synthetic offline after revocation"); });
  await assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"), /Synthetic offline/);
  assert.deepEqual((await fixture.readStore()).queue, [draft]);
  const reloaded = await cloudSyncClient(fixture);
  await assert.rejects(reloaded.client.loadSharedTask("cache-project", "cache-task"), /Synthetic offline/);
});

test("revocation blocks an offline read already decrypting an older query page", async () => {
  const fixture = await cloudSyncClient();
  await fixture.seedStore({ cache: { [queryPath]: { savedAt: Date.now(), payload: { tasks: [task] } } }, queue: [draft] });
  const decrypt = fixture.holdCrypto("decrypt");
  const offline = fixture.client.querySharedTasks(queryFilter);
  const rejected = assert.rejects(offline);
  await decrypt.entered;
  fixture.respond(() => denied(404));
  await assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"), error => error.status === 404);
  decrypt.release();
  await rejected;
  assert.deepEqual((await fixture.readStore()).queue, [draft]);
});

test("writes already encrypting or waiting for the store lock cannot revive denied pages", async () => {
  const fixture = await cloudSyncClient();
  await fixture.seedStore({ cache: { [queryPath]: cacheEntry({ tasks: [task] }) }, queue: [draft] });
  fixture.respond(() => ok({ task }));
  const encrypt = fixture.holdCrypto("encrypt");
  const encrypting = fixture.client.loadSharedTask("cache-project", "cache-task").catch(error => error);
  await encrypt.entered;
  const waiting = fixture.client.loadSharedTask("cache-project", "another-task").catch(error => error);
  await setImmediate(); // Drain the second response/body while the first still owns the write lock.
  const marker = deferred(), setItem = fixture.storage.setItem.bind(fixture.storage);
  fixture.storage.setItem = (key, value) => { setItem(key, value); if (key.endsWith(":read-epoch")) marker.resolve(); };
  fixture.respond(() => denied(403));
  const revoked = assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"), error => error.status === 403);
  await marker.promise;
  encrypt.release();
  await Promise.all([encrypting, waiting, revoked]);
  fixture.respond(() => { throw new TypeError("Synthetic offline"); });
  await assert.rejects(fixture.client.querySharedTasks(queryFilter), /Synthetic offline/);
  await assert.rejects(fixture.client.loadSharedTask("cache-project", "another-task"), /Synthetic offline/);
  assert.deepEqual((await fixture.readStore()).queue, [draft]);
  assert.deepEqual((await fixture.readStore()).cache, {});
});

test("revocation in another tab fences late replies and survives reload", async () => {
  const first = await cloudSyncClient();
  await first.seedStore({ cache: { [taskPath]: cacheEntry({ task }) }, queue: [draft] });
  const other = await cloudSyncClient({ storage: first.storage, key: first.key }), pending = deferred(), entered = deferred();
  first.respond(() => { entered.resolve(); return pending.promise; });
  const late = first.client.loadSharedTask("cache-project", "cache-task");
  const rejected = assert.rejects(late, error => error.status === 403);
  await entered.promise;
  other.respond(() => denied(403));
  await assert.rejects(other.client.loadSharedTask("cache-project", "cache-task"), error => error.status === 403);
  first.respond(() => denied(403));
  pending.resolve(ok({ task }));
  await rejected;
  const reloaded = await cloudSyncClient(first);
  await assert.rejects(reloaded.client.loadSharedTask("cache-project", "cache-task"), /Synthetic offline/);
  assert.deepEqual((await reloaded.readStore()).queue, [draft]);
});

test("an unrelated allowed response is revalidated once, then remains available offline", async () => {
  const fixture = await cloudSyncClient(), pending = deferred(), entered = deferred();
  await fixture.seedStore({ cache: {}, queue: [draft] });
  fixture.respond(() => { entered.resolve(); return pending.promise; });
  const late = fixture.client.loadSharedTask("cache-project", "cache-task");
  await entered.promise;
  fixture.respond(() => denied(403));
  await assert.rejects(fixture.client.loadSharedTask("denied-project", "denied-task"));
  const fresh = { ...task, title: "Fresh allowed content", revision: 2 };
  fixture.respond(() => ok({ task: fresh }));
  pending.resolve(ok({ task }));
  assert.equal((await late).title, fresh.title);
  assert.equal(fixture.requests.length, 3);
  fixture.respond(() => { throw new TypeError("Synthetic offline"); });
  assert.equal((await fixture.client.loadSharedTask("cache-project", "cache-task")).title, fresh.title);
  assert.equal(fixture.client.sharedDataCameFromOfflineCache(), true);
  assert.deepEqual((await fixture.readStore()).queue, [draft]);
});

test("repeated access changes stop after one revalidation with the existing query-conflict error", async () => {
  const fixture = await cloudSyncClient(), first = deferred(), second = deferred(), entered = deferred();
  fixture.respond(() => first.promise);
  const late = fixture.client.loadSharedTask("cache-project", "cache-task");
  const rejected = assert.rejects(late, error => error.status === 409 && error.payload.error === "SHARED_QUERY_CHANGED");
  fixture.respond(() => denied(403));
  await assert.rejects(fixture.client.loadSharedTask("denied-project", "first"));
  fixture.respond(() => { entered.resolve(); return second.promise; });
  first.resolve(ok({ task }));
  await entered.promise;
  fixture.respond(() => denied(404));
  await assert.rejects(fixture.client.loadSharedTask("denied-project", "second"));
  second.resolve(ok({ task }));
  await rejected;
  assert.equal(fixture.requests.filter(request => request.url.endsWith(taskPath)).length, 2);
});

test("a durable epoch blocks old encrypted bytes even if cache clearing cannot be saved", async () => {
  const fixture = await cloudSyncClient();
  await fixture.seedStore({ cache: { [taskPath]: cacheEntry({ task }) }, queue: [draft] });
  const before = fixture.storage.getItem(`genesis-shared-offline-v1:${fixture.userId}`);
  const encrypt = fixture.holdCrypto("encrypt");
  fixture.respond(() => denied(403));
  const rejected = assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"), error => error.status === 403);
  await encrypt.entered;
  encrypt.fail(new DOMException("Synthetic storage/crypto failure", "OperationError"));
  await rejected;
  assert.equal(fixture.storage.getItem(`genesis-shared-offline-v1:${fixture.userId}`), before);
  const reloaded = await cloudSyncClient(fixture);
  await assert.rejects(reloaded.client.loadSharedTask("cache-project", "cache-task"), /Synthetic offline/);
  assert.deepEqual((await reloaded.readStore()).queue, [draft]);
  assert.equal(await reloaded.client.pendingSharedMutationCount(), 1);
});

test("a failed epoch write disables offline reads without discarding queued work or blocking online reads", async () => {
  const fixture = await cloudSyncClient();
  await fixture.seedStore({ cache: { [taskPath]: cacheEntry({ task }) }, queue: [draft] });
  const setItem = fixture.storage.setItem.bind(fixture.storage);
  fixture.storage.setItem = (key, value) => {
    if (key.endsWith(":read-epoch")) throw new DOMException("Synthetic quota", "QuotaExceededError");
    setItem(key, value);
  };
  fixture.respond(() => denied(403));
  await assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"));
  fixture.respond(() => ok({ task }));
  assert.equal((await fixture.client.loadSharedTask("cache-project", "cache-task")).id, task.id);
  fixture.respond(() => { throw new TypeError("Synthetic offline"); });
  await assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"), /Synthetic offline/);
  assert.deepEqual((await fixture.readStore()).queue, [draft]);
});

test("legacy encrypted cache, expiry and fresh online/offline reads keep their existing semantics", async () => {
  const fixture = await cloudSyncClient();
  await fixture.seedStore({ cache: { [taskPath]: cacheEntry({ task }) }, queue: [draft] });
  assert.equal((await fixture.client.loadSharedTask("cache-project", "cache-task")).title, task.title);
  assert.equal(fixture.client.sharedDataCameFromOfflineCache(), true);
  await fixture.seedStore({ cache: { [taskPath]: cacheEntry({ task }, Date.now() - 31 * 86400_000) }, queue: [draft] });
  await assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"), /Synthetic offline/);
  fixture.respond(() => ok({ task: { ...task, revision: 2 } }));
  assert.equal((await fixture.client.loadSharedTask("cache-project", "cache-task")).revision, 2);
  assert.equal(fixture.client.sharedDataCameFromOfflineCache(), false);
  const raw = [...fixture.storage.data.values()].join("");
  assert.ok(!raw.includes(task.title));
  assert.ok(!raw.includes(draft.body));
});

test("localStorage write failure preserves the encrypted queue and keeps reload offline reads blocked", async () => {
  const fixture = await cloudSyncClient();
  await fixture.seedStore({ cache: { [taskPath]: cacheEntry({ task }) }, queue: [draft] });
  const original = fixture.storage.getItem(`genesis-shared-offline-v1:${fixture.userId}`);
  fixture.storage.setItem = () => { throw new DOMException("Synthetic full localStorage", "QuotaExceededError"); };
  fixture.respond(() => denied(403));
  await assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"));
  const reloaded = await cloudSyncClient(fixture);
  await assert.rejects(reloaded.client.loadSharedTask("cache-project", "cache-task"), /Synthetic offline/);
  assert.equal(reloaded.storage.getItem(`genesis-shared-offline-v1:${fixture.userId}`), original);
  assert.equal(await reloaded.client.pendingSharedMutationCount(), 1);
  assert.deepEqual((await reloaded.readStore()).queue, [draft]);
});

test("cache stays bounded and a full queue retains every exact request instead of being evicted", async () => {
  const fixture = await cloudSyncClient();
  const queue = Array.from({ length: 100 }, (_, index) => ({ ...draft, requestId: `request-${index}`, taskId: `task-${index}` }));
  await fixture.seedStore({ cache: {}, queue });
  fixture.respond(() => ok({ task }));
  for (let index = 0; index < 13; index++) await fixture.client.loadSharedTask("cache-project", `read-${index}`);
  const stored = await fixture.readStore();
  assert.equal(Object.keys(stored.cache).length, 12);
  assert.deepEqual(stored.queue, queue);
  await assert.rejects(fixture.client.createSharedTask("cache-project", { title: "Queue overflow", statusId: "todo" }), /SHARED_OFFLINE_QUEUE_FULL/);
  assert.deepEqual((await fixture.readStore()).queue, queue);
  assert.equal(fixture.requests.length, 13);
});

test("aborting while decrypting never supplies a cached page", async () => {
  const fixture = await cloudSyncClient();
  await fixture.seedStore({ cache: { [queryPath]: cacheEntry({ tasks: [task] }) }, queue: [draft] });
  const decrypt = fixture.holdCrypto("decrypt"), controller = new AbortController();
  const rejected = assert.rejects(fixture.client.querySharedTasks(queryFilter, null, "position", controller.signal));
  await decrypt.entered;
  controller.abort();
  decrypt.release();
  await rejected;
});

test("an aborted successful response is not returned after cache encryption", async () => {
  const fixture = await cloudSyncClient(), controller = new AbortController();
  fixture.respond(() => ok({ tasks: [task] }));
  const encrypt = fixture.holdCrypto("encrypt");
  const rejected = assert.rejects(fixture.client.querySharedTasks(queryFilter, null, "position", controller.signal), error => error.name === "AbortError");
  await encrypt.entered;
  controller.abort();
  encrypt.release();
  await rejected;
});

test("logout blocks a late reply and clears the epoch with the private cache", async () => {
  const fixture = await cloudSyncClient(), pending = deferred();
  await fixture.seedStore({ cache: { [taskPath]: cacheEntry({ task }) }, queue: [draft] });
  fixture.storage.setItem(`genesis-shared-offline-v1:${fixture.userId}:read-epoch`, "synthetic-fence");
  fixture.respond(() => pending.promise);
  const rejected = assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"), error => error.status === 401);
  clearPrivateDeviceStorage(fixture.storage);
  fixture.storage.setItem("genesis-local-sign-out-v1", "synthetic-sign-out");
  fixture.window.dispatchEvent(Object.assign(new Event("storage"), { key: "genesis-local-sign-out-v1", newValue: "synthetic-sign-out" }));
  pending.resolve(ok({ task }));
  await rejected;
  assert.deepEqual([...fixture.storage.data.keys()], ["genesis-local-sign-out-v1"]);
});

test("a late denial from the previous workspace never invalidates the new workspace cache", async () => {
  const fixture = await cloudSyncClient(), pending = deferred();
  fixture.respond(() => pending.promise);
  const rejected = assert.rejects(fixture.client.loadSharedTask("cache-project", "cache-task"), error => error.status === 401);
  const other = await cloudSyncClient({ storage: fixture.storage, userId: "cache-user-b", key: fixture.key });
  await other.seedStore({ cache: { [taskPath]: cacheEntry({ task }) }, queue: [] });
  assert.equal(fixture.client.restoreOfflineWorkspaceSession("cache-user-b"), true);
  pending.resolve(denied(403));
  await rejected;
  assert.equal(fixture.storage.getItem("genesis-shared-offline-v1:cache-user-b:read-epoch"), null);
  assert.equal((await other.client.loadSharedTask("cache-project", "cache-task")).title, task.title);
});
