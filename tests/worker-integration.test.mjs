import assert from "node:assert/strict";
import test from "node:test";

import { encryptSecretValue } from "../workers/api/src/config-center.ts";
import worker from "../workers/api/src/index.ts";

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

test.before(() => {
  console.error = () => undefined;
  console.warn = () => undefined;
});

test.after(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
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

function developmentEnv(overrides = {}) {
  return env({ APP_ENV: "development", ALLOW_MOCK_AUTH: "true", ...overrides });
}

function jsonHeaders(extra = {}) {
  return { "content-type": "application/json", ...extra };
}

function supabaseRowsForUrl(textUrl, init = {}) {
  const method = init.method ?? "GET";
  if (method !== "GET") {
    return [{ id: "created-id", token: "download-token", expires_at: "2026-06-30T00:00:00.000Z" }];
  }

  if (textUrl.includes("/distributor_profiles?")) {
    return [{ id: "dist-partner", display_name: "Smoke Partner", credit_score: 96, onboarding_status: "ready_for_authorization" }];
  }
  if (textUrl.includes("/social_accounts?")) {
    return [
      {
        id: "social-1",
        platform: "douyin",
        account_name: "Partner Channel",
        account_url: "https://example.com/partner-channel",
        followers: 1200,
        category: "Beauty",
        status: "approved",
        binding_note: "primary account",
        created_at: "2026-06-01T00:00:00.000Z",
        distributor_profiles: { display_name: "Smoke Partner" }
      }
    ];
  }
  if (textUrl.includes("/authorization_requests?")) {
    return [
      {
        id: "auth-request-1",
        status: "pending",
        application_note: "Need authorization",
        created_at: "2026-06-01T00:00:00.000Z",
        distributor_profiles: { display_name: "Smoke Partner", phone: "13900000000" },
        ip_accounts: { name: "Demo IP" },
        social_accounts: { account_name: "Partner Channel", platform: "douyin" }
      }
    ];
  }
  if (textUrl.includes("/authorizations?")) {
    return [{ id: "auth-1", distributor_id: "dist-partner", ip_account_id: "ip-1", status: "approved" }];
  }
  if (textUrl.includes("/products?")) {
    return [
      {
        id: "prod-1",
        name: "Demo Product",
        platform: "douyin",
        affiliate_url: "https://example.com/product",
        commission_rate: 20,
        is_active: true,
        created_at: "2026-06-01T00:00:00.000Z"
      }
    ];
  }
  if (textUrl.includes("/publish_records?")) {
    return [
      {
        id: "pub-1",
        distributor_id: "dist-partner",
        clip_asset_id: "clip-1",
        product_id: "prod-1",
        platform: "douyin",
        publish_url: "https://example.com/valid-work",
        status: "submitted",
        submitted_at: "2026-06-01T00:00:00.000Z",
        verification_note: "",
        distributor_profiles: { display_name: "Smoke Partner" },
        clip_assets: { title: "Demo Material" },
        products: { name: "Demo Product", is_active: true, commission_rate: 20, affiliate_url: "https://example.com/product" },
        performance_snapshots: []
      }
    ];
  }
  if (textUrl.includes("/settlement_orders?")) {
    return [
      {
        id: "set-1",
        distributor_id: "dist-partner",
        period: "2026-06",
        status: "pending",
        total_amount: 120,
        distributor_profiles: { display_name: "Smoke Partner" }
      }
    ];
  }
  if (textUrl.includes("/settlement_disputes?")) {
    return [{ id: "dispute-1", status: "open", reason: "Need review" }];
  }
  if (textUrl.includes("/appeals?")) {
    return [{ id: "appeal-1", distributor_id: "dist-partner", status: "open", reason: "Appeal reason" }];
  }
  if (textUrl.includes("/performance_import_batches?")) {
    return [{ id: "import-1", file_name: "manual.json", status: "completed", total_rows: 1, matched_rows: 1, error_rows: 0, created_at: "2026-06-01T00:00:00.000Z" }];
  }
  if (textUrl.includes("/performance_import_errors?")) {
    return [{ id: "error-1", error_code: "unmatched", error_message: "No publish record", created_at: "2026-06-01T00:00:00.000Z" }];
  }
  if (textUrl.includes("/clip_tasks?")) {
    return [{ id: "job-1", status: "queued", payload: { title: "Demo job" }, created_at: "2026-06-01T00:00:00.000Z", queued_at: "2026-06-01T00:00:00.000Z" }];
  }
  if (textUrl.includes("/ip_accounts?")) {
    return [{ id: "ip-1", name: "Demo IP", platform: "douyin" }];
  }
  return [];
}

async function withSupabaseFetchStub(run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => Response.json(supabaseRowsForUrl(String(url), init));
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("materials list falls back to an empty result when Supabase is not configured", async () => {
  const response = await worker.fetch(
    request("/materials?limit=5", { headers: mockHeaders("reviewer") }),
    env({
      APP_ENV: "development",
      ALLOW_MOCK_AUTH: "true",
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined
    })
  );

  assert.equal(response.status, 200);
  const responseBody = await body(response);
  assert.deepEqual(responseBody.materials, []);
  assert.equal(responseBody.meta.count, 0);
});

test("account bindings list falls back to an empty result when Supabase is not configured", async () => {
  const response = await worker.fetch(
    request("/account-bindings?limit=5", { headers: mockHeaders("reviewer") }),
    env({
      APP_ENV: "development",
      ALLOW_MOCK_AUTH: "true",
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined
    })
  );

  assert.equal(response.status, 200);
  const responseBody = await body(response);
  assert.deepEqual(responseBody.accountBindings, []);
  assert.equal(responseBody.meta.count, 0);
});

test("partner social accounts route lists the current partner account bindings", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const textUrl = String(url);
    if (textUrl.includes("/distributor_profiles?")) {
      return Response.json([{ id: "dist-partner" }]);
    }
    if (textUrl.includes("/social_accounts?")) {
      assert.match(textUrl, /distributor_id=eq\.dist-partner/);
      return Response.json([
        {
          id: "social-1",
          platform: "douyin",
          account_name: "Partner Channel",
          account_url: "https://example.com/partner-channel",
          followers: 1200,
          category: "Beauty",
          status: "approved",
          binding_note: "primary account",
          created_at: "2026-06-01T00:00:00.000Z",
          distributor_profiles: { display_name: "Smoke Partner" }
        }
      ]);
    }
    return Response.json([]);
  };

  try {
    const response = await worker.fetch(
      request("/partner/social-accounts?limit=5", { headers: mockHeaders("partner") }),
      env({ APP_ENV: "development", ALLOW_MOCK_AUTH: "true" })
    );

    assert.equal(response.status, 200);
    const responseBody = await body(response);
    assert.equal(responseBody.mode, undefined);
    assert.equal(responseBody.accountBindings.length, 1);
    assert.equal(responseBody.accountBindings[0].id, "social-1");
    assert.equal(responseBody.accountBindings[0].accountName, "Partner Channel");
    assert.equal(responseBody.meta.count, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("partner authorization requests route only lists the current partner requests", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const textUrl = String(url);
    if (textUrl.includes("/distributor_profiles?")) {
      return Response.json([{ id: "dist-partner" }]);
    }
    if (textUrl.includes("/authorization_requests?")) {
      assert.match(textUrl, /distributor_id=eq\.dist-partner/);
      assert.doesNotMatch(textUrl, /dist-other/);
      return Response.json([
        {
          id: "auth-request-1",
          status: "pending",
          application_note: "Need authorization",
          created_at: "2026-06-01T00:00:00.000Z",
          distributor_profiles: { display_name: "Smoke Partner", phone: "13900000000" },
          ip_accounts: { name: "Demo IP" },
          social_accounts: { account_name: "Partner Channel", platform: "douyin" }
        }
      ]);
    }
    return Response.json([]);
  };

  try {
    const response = await worker.fetch(
      request("/partner/authorization-requests?limit=5", { headers: mockHeaders("partner") }),
      developmentEnv()
    );

    assert.equal(response.status, 200);
    const responseBody = await body(response);
    assert.equal(responseBody.mode, undefined);
    assert.equal(responseBody.authorizationRequests.length, 1);
    assert.equal(responseBody.authorizationRequests[0].id, "auth-request-1");
    assert.equal(responseBody.meta.count, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reserved Worker routes are implemented instead of returning contract stubs", async () => {
  const routes = [
    {
      path: "/partner/social-accounts",
      init: { method: "POST", headers: jsonHeaders(mockHeaders("partner")), body: JSON.stringify({ platform: "douyin", accountName: "Partner Channel", homepageUrl: "https://example.com/partner-channel", followers: 1200, category: "Beauty" }) }
    },
    { path: "/partner/authorization-requests?limit=5", init: { headers: mockHeaders("partner") } },
    {
      path: "/partner/authorization-requests",
      init: { method: "POST", headers: jsonHeaders(mockHeaders("partner")), body: JSON.stringify({ socialAccount: "Partner Channel", platform: "douyin", ipName: "Demo IP", reason: "Need authorization" }) }
    },
    { path: "/admin/performance-imports?limit=5", init: { headers: mockHeaders("reviewer") } },
    {
      path: "/admin/performance-imports",
      init: { method: "POST", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ fileName: "manual.json", rows: [{ publishUrl: "https://example.com/valid-work", platform: "douyin", gmv: 100, commission: 20 }] }) }
    },
    { path: "/admin/performance-imports/import-1", init: { headers: mockHeaders("reviewer") } },
    { path: "/admin/performance-imports/import-1/errors", init: { headers: mockHeaders("reviewer") } },
    { path: "/admin/authorizations/auth-1/pause", init: { method: "POST", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ reason: "Risk pause" }) } },
    { path: "/admin/authorizations/auth-1/resume", init: { method: "POST", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ reason: "Risk resolved" }) } },
    { path: "/admin/products/prod-1/disable", init: { method: "POST", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ reason: "Out of stock" }) } },
    { path: "/admin/products/prod-1/commission-history", init: { headers: mockHeaders("reviewer") } },
    { path: "/admin/publish-records/pub-1/verify", init: { method: "POST", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ result: "verified", reason: "Manual pass" }) } },
    { path: "/admin/publish-records/bulk-review", init: { method: "POST", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ ids: ["pub-1"], result: "verified", reason: "Batch pass" }) } },
    { path: "/admin/settlements/set-1/confirm", init: { method: "POST", headers: jsonHeaders(mockHeaders("finance")), body: JSON.stringify({ note: "Confirmed" }) } },
    { path: "/admin/settlements/set-1/pay", init: { method: "POST", headers: jsonHeaders(mockHeaders("finance")), body: JSON.stringify({ note: "Paid manually" }) } },
    { path: "/admin/settlement-periods/generate", init: { method: "POST", headers: jsonHeaders(mockHeaders("finance")), body: JSON.stringify({ period: "2026-06" }) } },
    { path: "/partner/settlements/set-1/dispute", init: { method: "POST", headers: jsonHeaders(mockHeaders("partner")), body: JSON.stringify({ reason: "Amount mismatch" }) } },
    { path: "/admin/appeals/appeal-1", init: { method: "PATCH", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ status: "resolved", handledNote: "Accepted" }) } },
    { path: "/ffmpeg/jobs?limit=5", init: { headers: mockHeaders("reviewer") } },
    { path: "/ffmpeg/jobs", init: { method: "POST", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ clipTaskId: "job-1", r2Key: "recordings/demo.mp4" }) } },
    { path: "/ffmpeg/jobs/job-1", init: { headers: mockHeaders("reviewer") } },
    { path: "/ffmpeg/jobs/job-1", init: { method: "PATCH", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ status: "completed", message: "done" }) } },
    { path: "/ffmpeg/webhook", init: { method: "POST", headers: jsonHeaders(mockHeaders("reviewer")), body: JSON.stringify({ jobId: "job-1", status: "completed", message: "done" }) } }
  ];

  await withSupabaseFetchStub(async () => {
    for (const route of routes) {
      const response = await worker.fetch(request(route.path, route.init), developmentEnv());
      const responseBody = await body(response);
      assert.notEqual(responseBody.mode, "contract_stub", route.path);
      assert.notEqual(response.status, 404, route.path);
    }
  });
});

test("ffmpeg job creation records pending external configuration without leaking secrets", async () => {
  await withSupabaseFetchStub(async () => {
    const response = await worker.fetch(
      request("/ffmpeg/jobs", {
        method: "POST",
        headers: jsonHeaders(mockHeaders("reviewer")),
        body: JSON.stringify({ clipTaskId: "job-1", r2Key: "recordings/demo.mp4" })
      }),
      developmentEnv({ FFMPEG_WORKER_ENDPOINT: undefined, FFMPEG_WORKER_TOKEN: undefined })
    );

    assert.equal(response.status, 202);
    const responseBody = await body(response);
    assert.equal(responseBody.ffmpegJob.status, "pending_external_config");
    assert.equal(JSON.stringify(responseBody).includes("FFMPEG_WORKER_TOKEN"), false);
  });
});

test("ffmpeg webhook accepts the configured bearer token without a user session", async () => {
  await withSupabaseFetchStub(async () => {
    const response = await worker.fetch(
      request("/ffmpeg/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer ffmpeg-secret"
        },
        body: JSON.stringify({ jobId: "job-1", status: "completed", message: "done" })
      }),
      env({
        FFMPEG_WORKER_ENDPOINT: "https://ffmpeg-worker.test/jobs",
        FFMPEG_WORKER_TOKEN: "ffmpeg-secret"
      })
    );

    assert.equal(response.status, 202);
    const responseBody = await body(response);
    assert.equal(responseBody.accepted, true);
    assert.equal(responseBody.jobId, "job-1");
  });
});

test("ffmpeg webhook rejects an incorrect configured bearer token", async () => {
  const response = await worker.fetch(
    request("/ffmpeg/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong-token"
      },
      body: JSON.stringify({ jobId: "job-1", status: "completed", message: "done" })
    }),
    env({
      FFMPEG_WORKER_ENDPOINT: "https://ffmpeg-worker.test/jobs",
      FFMPEG_WORKER_TOKEN: "ffmpeg-secret"
    })
  );

  assert.equal(response.status, 403);
  assert.equal((await body(response)).error.code, "forbidden");
});

test("ffmpeg jobs and webhooks use backend integration config before env fallback", async () => {
  const encryptedToken = await encryptSecretValue("backend-ffmpeg-token", "test-master-key");
  const writes = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const textUrl = String(url);
    const method = init.method ?? "GET";
    if (textUrl.includes("/integration_configs?") && method === "GET" && textUrl.includes("provider_key=eq.ffmpeg")) {
      return Response.json([
        {
          provider_key: "ffmpeg",
          enabled: true,
          public_config: { endpoint: "https://ffmpeg-backend.example.test/jobs" },
          encrypted_secrets: { token: encryptedToken },
          secret_fingerprints: { token: "oken" },
          last_checked_at: null,
          last_check_status: null
        }
      ]);
    }
    if (method !== "GET") {
      writes.push({ url: textUrl, body: init.body ? JSON.parse(init.body) : null });
      return Response.json([{ id: "job-backend", ...(init.body ? JSON.parse(init.body) : {}) }]);
    }
    return Response.json([]);
  };

  try {
    const jobResponse = await worker.fetch(
      request("/ffmpeg/jobs", {
        method: "POST",
        headers: jsonHeaders(mockHeaders("reviewer")),
        body: JSON.stringify({ clipTaskId: "job-backend", r2Key: "recordings/backend.mp4" })
      }),
      developmentEnv({
        FFMPEG_WORKER_ENDPOINT: undefined,
        FFMPEG_WORKER_TOKEN: undefined,
        CONFIG_ENCRYPTION_KEY: "test-master-key"
      })
    );
    assert.equal(jobResponse.status, 201);
    const jobBody = await body(jobResponse);
    assert.equal(jobBody.ffmpegJob.status, "queued");
    assert.equal(jobBody.ffmpegJob.externalConfigured, true);

    const webhookResponse = await worker.fetch(
      request("/ffmpeg/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer backend-ffmpeg-token"
        },
        body: JSON.stringify({ jobId: "job-backend", status: "completed", message: "done" })
      }),
      env({
        FFMPEG_WORKER_ENDPOINT: undefined,
        FFMPEG_WORKER_TOKEN: undefined,
        CONFIG_ENCRYPTION_KEY: "test-master-key"
      })
    );
    assert.equal(webhookResponse.status, 202);
    assert.equal((await body(webhookResponse)).accepted, true);
    assert.equal(writes.some((item) => item.body?.payload?.externalConfigured === true), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin settings API reads and writes service-backed system settings", async () => {
  const writes = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const textUrl = String(url);
    const method = init.method ?? "GET";
    if (textUrl.includes("/system_settings?") && method === "GET") {
      return Response.json([
        {
          id: "global",
          runtime_mode: "hybrid",
          commission_share: 42,
          daily_claim_limit: 7,
          risk_keywords: ["搬运", "refund"],
          updated_at: "2026-06-26T00:00:00.000Z"
        }
      ]);
    }
    if (textUrl.includes("/system_settings?") && method === "PATCH") {
      writes.push(JSON.parse(init.body));
      return Response.json([{ id: "global", ...JSON.parse(init.body) }]);
    }
    return Response.json([]);
  };

  try {
    const readResponse = await worker.fetch(
      request("/admin/settings", { headers: mockHeaders("reviewer") }),
      developmentEnv()
    );
    assert.equal(readResponse.status, 200);
    assert.deepEqual((await body(readResponse)).settings, {
      runtimeMode: "hybrid",
      commissionShare: 42,
      dailyClaimLimit: 7,
      riskKeywords: ["搬运", "refund"]
    });

    const writeResponse = await worker.fetch(
      request("/admin/settings", {
        method: "PATCH",
        headers: jsonHeaders(mockHeaders("admin")),
        body: JSON.stringify({ runtimeMode: "real", commissionShare: 55, dailyClaimLimit: 12, riskKeywords: ["risk"] })
      }),
      developmentEnv()
    );
    assert.equal(writeResponse.status, 200);
    assert.equal(writes[0].runtime_mode, "real");
    assert.equal(writes[0].commission_share, 55);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("only admins can mutate system settings and integration configs", async () => {
  const settingsResponse = await worker.fetch(
    request("/admin/settings", {
      method: "PATCH",
      headers: jsonHeaders(mockHeaders("reviewer")),
      body: JSON.stringify({ commissionShare: 55 })
    }),
    developmentEnv()
  );
  assert.equal(settingsResponse.status, 403);

  const integrationResponse = await worker.fetch(
    request("/admin/integrations/payment", {
      method: "PATCH",
      headers: jsonHeaders(mockHeaders("reviewer")),
      body: JSON.stringify({ enabled: true, publicConfig: { endpoint: "https://payment.example.test" } })
    }),
    developmentEnv()
  );
  assert.equal(integrationResponse.status, 403);
});

test("integration config API redacts secret values and requires encryption key for new secrets", async () => {
  const missingKeyResponse = await worker.fetch(
    request("/admin/integrations/payment", {
      method: "PATCH",
      headers: jsonHeaders(mockHeaders("admin")),
      body: JSON.stringify({
        enabled: true,
        publicConfig: { endpoint: "https://payment.example.test" },
        secrets: { token: "payment-secret" }
      })
    }),
    developmentEnv()
  );
  assert.equal(missingKeyResponse.status, 503);
  assert.equal((await body(missingKeyResponse)).error.code, "config_encryption_not_configured");

  const storedRows = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const textUrl = String(url);
    const method = init.method ?? "GET";
    if (textUrl.includes("/integration_configs?") && method === "GET") {
      return Response.json(storedRows);
    }
    if (textUrl.includes("/integration_configs?") && method === "PATCH") {
      return Response.json([]);
    }
    if (textUrl.endsWith("/integration_configs") && method === "POST") {
      const row = JSON.parse(init.body);
      storedRows.push(row);
      return Response.json([row]);
    }
    return Response.json([]);
  };

  try {
    const writeResponse = await worker.fetch(
      request("/admin/integrations/payment", {
        method: "PATCH",
        headers: jsonHeaders(mockHeaders("admin")),
        body: JSON.stringify({
          enabled: true,
          publicConfig: { endpoint: "https://payment.example.test" },
          secrets: { token: "payment-secret" }
        })
      }),
      developmentEnv({ CONFIG_ENCRYPTION_KEY: "test-master-key" })
    );
    assert.equal(writeResponse.status, 200);
    const writeBody = await body(writeResponse);
    assert.equal(writeBody.integration.secretFields.token.configured, true);
    assert.equal(JSON.stringify(writeBody).includes("payment-secret"), false);
    assert.equal(JSON.stringify(storedRows).includes("payment-secret"), false);

    const readResponse = await worker.fetch(
      request("/admin/integrations/payment", { headers: mockHeaders("finance") }),
      developmentEnv({ CONFIG_ENCRYPTION_KEY: "test-master-key" })
    );
    assert.equal(readResponse.status, 200);
    const readBody = await body(readResponse);
    assert.equal(readBody.integration.enabled, true);
    assert.equal(readBody.integration.secretFields.token.configured, true);
    assert.equal(JSON.stringify(readBody).includes("payment-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("integration test endpoint validates configuration completeness without external calls", async () => {
  const storedRows = [
    {
      provider_key: "ffmpeg",
      enabled: true,
      public_config: {},
      encrypted_secrets: {},
      secret_fingerprints: {},
      last_checked_at: null,
      last_check_status: null
    }
  ];
  const updates = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const textUrl = String(url);
    const method = init.method ?? "GET";
    if (textUrl.includes("/integration_configs?") && method === "GET") {
      return Response.json(storedRows);
    }
    if (textUrl.includes("/integration_configs?") && method === "PATCH") {
      updates.push(JSON.parse(init.body));
      return Response.json([{ ...storedRows[0], ...JSON.parse(init.body) }]);
    }
    return Response.json([]);
  };

  try {
    const response = await worker.fetch(
      request("/admin/integrations/ffmpeg/test", {
        method: "POST",
        headers: jsonHeaders(mockHeaders("admin"))
      }),
      developmentEnv()
    );
    assert.equal(response.status, 200);
    const responseBody = await body(response);
    assert.equal(responseBody.result.status, "missing_config");
    assert.deepEqual(responseBody.result.missingPublicFields, ["endpoint"]);
    assert.deepEqual(responseBody.result.missingSecretFields, ["token"]);
    assert.equal(updates[0].last_check_status, "missing_config");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("settlement generation uses backend commission share setting", async () => {
  const writes = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const textUrl = String(url);
    const method = init.method ?? "GET";
    if (textUrl.includes("/system_settings?")) {
      return Response.json([
        {
          id: "global",
          runtime_mode: "real",
          commission_share: 25,
          daily_claim_limit: 10,
          risk_keywords: ["risk"]
        }
      ]);
    }
    if (textUrl.includes("/publish_records?") && method === "GET") {
      return Response.json([
        {
          id: "pub-1",
          distributor_id: "dist-1",
          products: { is_active: true, commission_rate: 20, affiliate_url: "https://example.com/product" },
          performance_snapshots: [{ commission_amount: 100 }]
        }
      ]);
    }
    if (textUrl.endsWith("/settlement_orders") && method === "POST") {
      writes.push(JSON.parse(init.body));
      return Response.json([{ id: "set-1", ...JSON.parse(init.body) }]);
    }
    if (method !== "GET") {
      return Response.json([{ id: "created-id" }]);
    }
    return Response.json([]);
  };

  try {
    const response = await worker.fetch(
      request("/settlements/generate", { method: "POST", headers: jsonHeaders(mockHeaders("finance")) }),
      developmentEnv()
    );
    assert.equal(response.status, 201);
    assert.equal(writes[0].total_amount, 25);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publish verification uses backend risk keywords", async () => {
  const patches = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const textUrl = String(url);
    const method = init.method ?? "GET";
    if (textUrl.includes("/system_settings?")) {
      return Response.json([
        {
          id: "global",
          runtime_mode: "real",
          commission_share: 50,
          daily_claim_limit: 10,
          risk_keywords: ["customblock"]
        }
      ]);
    }
    if (textUrl.includes("/publish_records?") && method === "GET") {
      return Response.json([
        {
          id: "pub-1",
          distributor_id: "dist-1",
          publish_url: "https://example.com/customblock-work",
          products: { is_active: true, commission_rate: 20, affiliate_url: "https://example.com/product" }
        }
      ]);
    }
    if (textUrl.includes("/publish_records?") && method === "PATCH") {
      patches.push(JSON.parse(init.body));
      return Response.json([{ id: "pub-1", ...JSON.parse(init.body) }]);
    }
    if (method !== "GET") {
      return Response.json([{ id: "created-id" }]);
    }
    return Response.json([]);
  };

  try {
    const response = await worker.fetch(
      request("/admin/publish-records/pub-1/verify", {
        method: "POST",
        headers: jsonHeaders(mockHeaders("reviewer")),
        body: JSON.stringify({ result: "verified" })
      }),
      developmentEnv()
    );
    assert.equal(response.status, 200);
    assert.equal(patches[0].status, "invalid");
    assert.match(patches[0].verification_note, /customblock/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("worker exposes OpenAPI documentation for the unified API gateway", async () => {
  const response = await worker.fetch(request("/openapi.json"), env());
  assert.equal(response.status, 200);

  const spec = await body(response);
  assert.equal(spec.openapi, "3.0.0");
  assert.equal(spec.info.title, "ClipPartner API");
  assert.ok(spec.paths["/health"]);
  assert.ok(spec.paths["/admin/distributors"]);
  assert.ok(spec.paths["/partner/tasks"]);
  assert.ok(spec.paths["/api/auth/get-session"]);
  assert.ok(spec.paths["/partner/wallet/transactions"].post.requestBody);
  assert.ok(spec.paths["/recordings/direct-upload/init"].post.requestBody);
  assert.ok(spec.paths["/partner/social-accounts"].post);
  assert.ok(spec.paths["/partner/authorization-requests"].get);
  assert.ok(spec.paths["/admin/performance-imports"].get);
  assert.ok(spec.paths["/ffmpeg/jobs"].post);
});

test("worker exposes a Swagger UI page for API consumers", async () => {
  const response = await worker.fetch(request("/docs"), env());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await response.text(), /ClipPartner API/);
});

test("better auth session endpoint is mounted under the Worker gateway", async () => {
  const response = await worker.fetch(request("/api/auth/get-session"), env({ APP_ENV: "development" }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
});

test("better auth email flow creates a partner session in development", async () => {
  const authEnv = env({
    APP_ENV: "development",
    BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef"
  });
  const email = "partner-auth-flow@example.test";
  const password = "password1234";

  const signUp = await worker.fetch(
    request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test Partner", email, password })
    }),
    authEnv
  );
  assert.equal(signUp.status, 200);
  assert.equal((await body(signUp)).user.role, "partner");

  const signIn = await worker.fetch(
    request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    }),
    authEnv
  );
  const signInBody = await body(signIn);
  assert.equal(signIn.status, 200);
  assert.equal(signInBody.user.role, "partner");
  assert.equal(typeof signInBody.token, "string");
});

test("better auth bearer token authorizes business API sessions without Supabase Auth validation", async () => {
  const authEnv = env({
    APP_ENV: "development",
    BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef"
  });
  const email = `partner-business-${Date.now()}@example.test`;
  const password = "password1234";

  await worker.fetch(
    request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Business Partner", email, password })
    }),
    authEnv
  );

  const signIn = await worker.fetch(
    request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    }),
    authEnv
  );
  const token = (await body(signIn)).token;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const textUrl = String(url);
    if (textUrl.includes("/auth/v1/user")) {
      throw new Error("Supabase Auth must not validate Better Auth bearer tokens");
    }
    return Response.json([]);
  };

  try {
    const response = await worker.fetch(request("/me", { headers: { authorization: `Bearer ${token}` } }), authEnv);
    assert.equal(response.status, 200);
    const responseBody = await body(response);
    assert.equal(responseBody.user.role, "partner");
    assert.equal(responseBody.providers.authProvider, "better-auth");
  } finally {
    globalThis.fetch = originalFetch;
  }
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
