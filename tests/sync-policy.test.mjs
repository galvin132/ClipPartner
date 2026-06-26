import assert from "node:assert/strict";
import test from "node:test";

import {
  canPersistLocalState,
  canUseLocalMutationFallback,
  shouldLoadLocalStateBeforeRemoteSync
} from "../lib/sync-policy.ts";

test("real runtime mode disables local state persistence and mutation fallback", () => {
  assert.equal(shouldLoadLocalStateBeforeRemoteSync("real"), false);
  assert.equal(canPersistLocalState("real"), false);
  assert.equal(canUseLocalMutationFallback("real"), false);
});

test("mock and hybrid runtime modes keep local fallback for demos and partial API rollout", () => {
  for (const mode of ["mock", "hybrid"]) {
    assert.equal(shouldLoadLocalStateBeforeRemoteSync(mode), true);
    assert.equal(canPersistLocalState(mode), true);
    assert.equal(canUseLocalMutationFallback(mode), true);
  }
});
