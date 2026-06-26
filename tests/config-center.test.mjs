import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptSecretValue,
  encryptSecretValue,
  integrationReadiness,
  integrationProviderDefinitions,
  loadIntegrationConfig,
  normalizeSystemSettings,
  redactIntegrationConfig,
  saveIntegrationConfig,
  validateIntegrationConfig
} from "../workers/api/src/config-center.ts";

test("system settings normalize unsafe input and keep production runtime from switching to mock", () => {
  assert.deepEqual(
    normalizeSystemSettings(
      {
        runtimeMode: "mock",
        commissionShare: 120,
        dailyClaimLimit: -3,
        riskKeywords: ["搬运", "", "risk"]
      },
      { APP_ENV: "production" }
    ),
    {
      runtimeMode: "real",
      commissionShare: 100,
      dailyClaimLimit: 0,
      riskKeywords: ["搬运", "risk"]
    }
  );
});

test("integration secrets encrypt, decrypt, and redact without exposing plaintext", async () => {
  const encrypted = await encryptSecretValue("secret-token", "test-master-key");

  assert.notEqual(encrypted, "secret-token");
  assert.equal(await decryptSecretValue(encrypted, "test-master-key"), "secret-token");

  const redacted = redactIntegrationConfig({
    key: "payment",
    enabled: true,
    publicConfig: { endpoint: "https://payment.example.test" },
    encryptedSecrets: { token: encrypted },
    secretFingerprints: { token: "oken" },
    lastCheckedAt: "2026-06-26T00:00:00.000Z",
    lastCheckStatus: "configured"
  });

  assert.equal(redacted.secretFields.token.configured, true);
  assert.equal(redacted.secretFields.token.fingerprint, "oken");
  assert.equal(JSON.stringify(redacted).includes("secret-token"), false);
  assert.equal(JSON.stringify(redacted).includes(encrypted), false);
});

test("integration test validation requires enabled provider public config and secrets", () => {
  assert.equal(integrationProviderDefinitions.some((item) => item.key === "tencent_identity"), true);

  assert.deepEqual(
    validateIntegrationConfig({
      key: "ffmpeg",
      enabled: true,
      publicConfig: {},
      encryptedSecrets: {},
      secretFingerprints: {},
      lastCheckedAt: "",
      lastCheckStatus: ""
    }),
    {
      status: "missing_config",
      missingPublicFields: ["endpoint"],
      missingSecretFields: ["token"],
      invalidPublicFields: []
    }
  );

  assert.deepEqual(
    validateIntegrationConfig({
      key: "ffmpeg",
      enabled: true,
      publicConfig: { endpoint: "https://ffmpeg.example.test/jobs" },
      encryptedSecrets: { token: "encrypted" },
      secretFingerprints: { token: "oken" },
      lastCheckedAt: "",
      lastCheckStatus: ""
    }),
    {
      status: "configured",
      missingPublicFields: [],
      missingSecretFields: [],
      invalidPublicFields: []
    }
  );
});

test("integration validation rejects malformed endpoint and redirect URLs without external calls", () => {
  assert.deepEqual(
    validateIntegrationConfig({
      key: "payment",
      enabled: true,
      publicConfig: { endpoint: "not-a-url" },
      encryptedSecrets: { token: "encrypted" },
      secretFingerprints: { token: "oken" },
      lastCheckedAt: "",
      lastCheckStatus: ""
    }),
    {
      status: "invalid_config",
      missingPublicFields: [],
      missingSecretFields: [],
      invalidPublicFields: ["endpoint"]
    }
  );

  assert.deepEqual(
    validateIntegrationConfig({
      key: "wechat_oauth",
      enabled: true,
      publicConfig: { appId: "wx-app", redirectUri: "https://clip-partner.test/auth/wechat/callback" },
      encryptedSecrets: { appSecret: "encrypted" },
      secretFingerprints: { appSecret: "cret" },
      lastCheckedAt: "",
      lastCheckStatus: ""
    }),
    {
      status: "configured",
      missingPublicFields: [],
      missingSecretFields: [],
      invalidPublicFields: []
    }
  );
});

test("integration config rows merge missing fields from environment fallback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const textUrl = String(url);
    const method = init.method ?? "GET";
    if (textUrl.includes("/integration_configs?") && method === "GET") {
      return Response.json([
        {
          provider_key: "payment",
          enabled: true,
          public_config: {},
          encrypted_secrets: {},
          secret_fingerprints: {},
          last_checked_at: null,
          last_check_status: null
        }
      ]);
    }
    return Response.json([]);
  };

  try {
    const config = await loadIntegrationConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        PAYMENT_PROVIDER_ENDPOINT: "https://payment.example.test",
        PAYMENT_PROVIDER_TOKEN: "payment-token"
      },
      "payment"
    );

    assert.equal(config.enabled, true);
    assert.equal(config.publicConfig.endpoint, "https://payment.example.test");
    assert.equal(config.encryptedSecrets.token, "env");
    assert.equal(config.secretFingerprints.token, "env");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("integration readiness exposes invalid public fields separately from missing fields", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const textUrl = String(url);
    const method = init.method ?? "GET";
    if (textUrl.includes("/integration_configs?") && method === "GET" && textUrl.includes("provider_key=eq.payment")) {
      return Response.json([
        {
          provider_key: "payment",
          enabled: true,
          public_config: { endpoint: "not-a-url" },
          encrypted_secrets: { token: "encrypted" },
          secret_fingerprints: { token: "oken" },
          last_checked_at: null,
          last_check_status: null
        }
      ]);
    }
    return Response.json([]);
  };

  try {
    const readiness = await integrationReadiness({
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      CLIP_PARTNER_BUCKET: {},
      CLIP_TASK_QUEUE: {}
    });
    const payment = readiness.find((item) => item.key === "payment");

    assert.equal(payment.isConfigured, false);
    assert.deepEqual(payment.missingKeys, []);
    assert.deepEqual(payment.invalidKeys, ["endpoint"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("saving integration config persists only defined public and secret fields", async () => {
  const writes = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const textUrl = String(url);
    const method = init.method ?? "GET";
    if (textUrl.includes("/integration_configs?") && method === "GET") {
      return Response.json([]);
    }
    if (textUrl.includes("/integration_configs?") && method === "PATCH") {
      return Response.json([]);
    }
    if (textUrl.endsWith("/integration_configs") && method === "POST") {
      const row = JSON.parse(init.body);
      writes.push(row);
      return Response.json([row]);
    }
    return Response.json([]);
  };

  try {
    await saveIntegrationConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        CONFIG_ENCRYPTION_KEY: "test-master-key"
      },
      "payment",
      {
        enabled: true,
        publicConfig: {
          endpoint: "https://payment.example.test",
          extraEndpoint: "https://shadow.example.test"
        },
        secrets: {
          token: "payment-token",
          extraSecret: "shadow-token"
        }
      }
    );

    assert.deepEqual(writes[0].public_config, { endpoint: "https://payment.example.test" });
    assert.deepEqual(Object.keys(writes[0].encrypted_secrets), ["token"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
