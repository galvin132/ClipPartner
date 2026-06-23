import assert from "node:assert/strict";
import test from "node:test";

import worker from "../workers/api/src/index.ts";

const originalConsoleError = console.error;

test.before(() => {
  console.error = () => undefined;
});

test.after(() => {
  console.error = originalConsoleError;
});

function env(overrides = {}) {
  return {
    APP_ENV: "production",
    ALLOW_MOCK_AUTH: "false",
    FRONTEND_ORIGIN: "https://clip-partner.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    CLIP_PARTNER_BUCKET: {},
    CLIP_TASK_QUEUE: { send: async () => undefined },
    ...overrides
  };
}

function request(path, init = {}) {
  return new Request(`https://api.test${path}`, init);
}

function mockHeaders(role, displayName = "Smoke Partner") {
  return {
    "x-clip-auth-provider": "mock",
    "x-clip-role": role,
    "x-clip-user-id": `mock-${role}`,
    "x-clip-display-name": displayName
  };
}

async function body(response) {
  return response.json();
}

test("production rejects forged mock admin headers without a bearer token", async () => {
  const response = await worker.fetch(request("/admin/distributors", { headers: mockHeaders("admin") }), env());
  assert.equal(response.status, 401);
  assert.equal((await body(response)).error.code, "unauthenticated");
});

test("development rejects forged mock headers unless mock auth is explicitly enabled", async () => {
  const response = await worker.fetch(
    request("/admin/distributors", { headers: mockHeaders("admin") }),
    env({ APP_ENV: "development", ALLOW_MOCK_AUTH: "false" })
  );
  assert.equal(response.status, 401);
});

test("state endpoint without a session returns 401 outside explicit mock read mode", async () => {
  const response = await worker.fetch(request("/state"), env({ APP_ENV: "development", ALLOW_MOCK_AUTH: "false" }));
  assert.equal(response.status, 401);
});

test("admin route with partner mock role returns 403 when mock auth is enabled", async () => {
  const response = await worker.fetch(
    request("/admin/distributors", { headers: mockHeaders("partner") }),
    env({ APP_ENV: "development", ALLOW_MOCK_AUTH: "true" })
  );
  assert.equal(response.status, 403);
  assert.equal((await body(response)).error.code, "forbidden");
});

test("partner cannot create download tokens for a non-owned claim", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const textUrl = String(url);
    if (textUrl.includes("/distributor_profiles?")) {
      return Response.json([{ id: "dist-owned" }]);
    }
    if (textUrl.includes("/task_claims?")) {
      return Response.json([]);
    }
    return Response.json([]);
  };

  try {
    const response = await worker.fetch(
      request("/claims/claim-other/download-url", { method: "POST", headers: mockHeaders("partner", "Partner A") }),
      env({ APP_ENV: "development", ALLOW_MOCK_AUTH: "true" })
    );
    assert.equal(response.status, 404);
    assert.equal((await body(response)).error.code, "not_found");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
