import assert from "node:assert/strict";
import test from "node:test";

import { headersForSession } from "../lib/api-client.ts";

test("real Better Auth sessions use bearer authorization without mock identity headers", () => {
  const headers = headersForSession({
    id: "user-1",
    username: "partner@example.test",
    displayName: "Partner",
    role: "partner",
    roleLabel: "Partner",
    description: "",
    authProvider: "better-auth",
    accessToken: "better-token"
  });

  assert.deepEqual(headers, { authorization: "Bearer better-token" });
});

test("mock sessions keep development-only identity headers", () => {
  const headers = headersForSession({
    id: "mock-partner",
    username: "partner",
    displayName: "Partner",
    role: "partner",
    roleLabel: "Partner",
    description: "",
    authProvider: "mock"
  });

  assert.equal(headers["x-clip-auth-provider"], "mock");
  assert.equal(headers["x-clip-role"], "partner");
  assert.equal(headers.authorization, undefined);
});
