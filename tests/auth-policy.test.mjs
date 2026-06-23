import assert from "node:assert/strict";
import test from "node:test";

import {
  allowMissingSessionForMockRead,
  isMockAuthAllowed,
  routeRoles,
  taskClaimOwnershipFilter
} from "../workers/api/src/auth-policy.ts";
import { mockHeadersForApiPath } from "../scripts/smoke-headers.mjs";

test("mock auth is disabled in production even when the flag is set", () => {
  assert.equal(isMockAuthAllowed({ APP_ENV: "production", ALLOW_MOCK_AUTH: "true" }), false);
});

test("mock auth must be explicitly enabled outside production", () => {
  assert.equal(isMockAuthAllowed({ APP_ENV: "development" }), false);
  assert.equal(isMockAuthAllowed({ APP_ENV: "development", ALLOW_MOCK_AUTH: "true" }), true);
});

test("missing session fallback only applies to GET requests in explicit mock mode", () => {
  assert.equal(allowMissingSessionForMockRead({ APP_ENV: "development", ALLOW_MOCK_AUTH: "true" }, "GET"), true);
  assert.equal(allowMissingSessionForMockRead({ APP_ENV: "development", ALLOW_MOCK_AUTH: "true" }, "POST"), false);
  assert.equal(allowMissingSessionForMockRead({ APP_ENV: "production", ALLOW_MOCK_AUTH: "true" }, "GET"), false);
});

test("aggregate state is restricted to internal operator roles", () => {
  assert.deepEqual(routeRoles("/state", "GET"), ["admin", "reviewer", "finance"]);
});

test("partner claim routes require a partner session", () => {
  assert.deepEqual(routeRoles("/claims/claim-1/download-url", "POST"), ["partner"]);
  assert.deepEqual(routeRoles("/claims/claim-1/submit", "POST"), ["partner"]);
});

test("legacy business list routes require operator roles", () => {
  assert.deepEqual(routeRoles("/authorization-requests", "GET"), ["admin", "reviewer"]);
  assert.deepEqual(routeRoles("/account-bindings", "GET"), ["admin", "reviewer"]);
  assert.deepEqual(routeRoles("/clip-tasks", "GET"), ["admin", "reviewer"]);
  assert.deepEqual(routeRoles("/materials", "GET"), ["admin", "reviewer"]);
  assert.deepEqual(routeRoles("/products", "GET"), ["admin", "reviewer"]);
  assert.deepEqual(routeRoles("/publish-records", "GET"), ["admin", "reviewer"]);
  assert.deepEqual(routeRoles("/risk-records", "GET"), ["admin", "reviewer"]);
  assert.deepEqual(routeRoles("/settlements", "GET"), ["admin", "finance"]);
});

test("partner data routes require a partner role", () => {
  assert.deepEqual(routeRoles("/partner/tasks", "GET"), ["partner"]);
  assert.deepEqual(routeRoles("/partner/wallet", "GET"), ["partner"]);
  assert.deepEqual(routeRoles("/partner/authorizations", "GET"), ["partner"]);
});

test("task claim ownership filter scopes partner operations to one distributor", () => {
  assert.equal(
    taskClaimOwnershipFilter("claim 1", "distributor 1"),
    "id=eq.claim%201&distributor_id=eq.distributor%201"
  );
});

test("smoke headers map protected API paths to allowed demo roles", () => {
  assert.equal(mockHeadersForApiPath("/materials?limit=1")["x-clip-role"], "reviewer");
  assert.equal(mockHeadersForApiPath("/admin/distributors?limit=1")["x-clip-role"], "admin");
  assert.equal(mockHeadersForApiPath("/partner/wallet?limit=1")["x-clip-role"], "partner");
  assert.equal(mockHeadersForApiPath("/settlements?limit=1")["x-clip-role"], "finance");
});
