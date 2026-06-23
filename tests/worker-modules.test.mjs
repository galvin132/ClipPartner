import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../workers/api/src/errors.ts";
import { errorJson, json } from "../workers/api/src/http-utils.ts";
import { selectRows } from "../workers/api/src/supabase-rest.ts";

function env(overrides = {}) {
  return {
    FRONTEND_ORIGIN: "https://clip-partner.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    ...overrides
  };
}

test("worker HTTP utilities include JSON and CORS headers", async () => {
  const response = json({ ok: true }, env(), { status: 202 });

  assert.equal(response.status, 202);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://clip-partner.test");
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await response.json(), { ok: true });
});

test("worker HTTP utilities render ApiError responses", async () => {
  const response = errorJson(new ApiError("invalid_input", "Invalid input", 422, { field: "name" }), env());
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.error.code, "invalid_input");
  assert.deepEqual(body.error.details, { field: "name" });
});

test("Supabase REST helper uses the service role key server-side", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json([{ id: "row-1" }]);
  };

  try {
    const rows = await selectRows(env(), "app_user_profiles", "select=better_auth_user_id");

    assert.deepEqual(rows, [{ id: "row-1" }]);
    assert.equal(calls[0].url, "https://supabase.test/rest/v1/app_user_profiles?select=better_auth_user_id");
    assert.equal(calls[0].init.headers.apikey, "service-key");
    assert.equal(calls[0].init.headers.authorization, "Bearer service-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
