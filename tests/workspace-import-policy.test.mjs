import assert from "node:assert/strict";
import test from "node:test";
import { shouldSeedRemoteWorkspace } from "../app/workspace-import-policy.ts";

test("a deleted last habit is not restored from stale local data on sign in", () => {
  assert.equal(shouldSeedRemoteWorkspace(true, 1), false);
  assert.equal(shouldSeedRemoteWorkspace(true, 0), false);
  assert.equal(shouldSeedRemoteWorkspace(false, 1), true);
});
