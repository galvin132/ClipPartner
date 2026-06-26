import assert from "node:assert/strict";
import test from "node:test";

import { canEditBackendConfig, isRuntimeModeLocked } from "../lib/admin-settings-access.ts";

test("only admins can edit backend configuration from the settings UI", () => {
  assert.equal(canEditBackendConfig("admin"), true);
  assert.equal(canEditBackendConfig("reviewer"), false);
  assert.equal(canEditBackendConfig("finance"), false);
  assert.equal(canEditBackendConfig("partner"), false);
  assert.equal(canEditBackendConfig(null), false);
});

test("runtime mode selector is locked in production builds", () => {
  assert.equal(isRuntimeModeLocked("production"), true);
  assert.equal(isRuntimeModeLocked("development"), false);
  assert.equal(isRuntimeModeLocked(undefined), false);
});
