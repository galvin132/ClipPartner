import { ApiError } from "./errors.ts";
import type { WorkerEnv } from "./env.ts";
import { insertRow, patchRows, selectRows } from "./supabase-rest.ts";

export type RuntimeMode = "mock" | "hybrid" | "real";
export type IntegrationProviderKey = "wechat_oauth" | "douyin" | "wechat_channels" | "tencent_identity" | "payment" | "ffmpeg";
type PublicConfig = Record<string, unknown>;
type SecretMap = Record<string, string>;

export type SystemSettings = {
  runtimeMode: RuntimeMode;
  commissionShare: number;
  dailyClaimLimit: number;
  riskKeywords: string[];
};

export type IntegrationConfigRecord = {
  key: IntegrationProviderKey;
  enabled: boolean;
  publicConfig: PublicConfig;
  encryptedSecrets: SecretMap;
  secretFingerprints: SecretMap;
  lastCheckedAt: string | null;
  lastCheckStatus: string | null;
};

export type IntegrationRuntimeConfig = {
  key: IntegrationProviderKey;
  enabled: boolean;
  publicConfig: Record<string, string>;
  secrets: Record<string, string>;
  validation: ReturnType<typeof validateIntegrationConfig>;
};

type IntegrationProviderDefinition = {
  key: IntegrationProviderKey;
  name: string;
  purpose: string;
  publicFields: Array<{ key: string; envKey?: keyof WorkerEnv }>;
  secretFields: Array<{ key: string; envKey?: keyof WorkerEnv }>;
};

type SystemSettingsRow = {
  id: string;
  runtime_mode: RuntimeMode | null;
  commission_share: number | string | null;
  daily_claim_limit: number | string | null;
  risk_keywords: string[] | null;
  updated_at?: string | null;
};

type IntegrationConfigRow = {
  provider_key: IntegrationProviderKey;
  enabled: boolean | null;
  public_config: PublicConfig | null;
  encrypted_secrets: SecretMap | null;
  secret_fingerprints: SecretMap | null;
  last_checked_at: string | null;
  last_check_status: string | null;
};

export const defaultSystemSettings: SystemSettings = {
  runtimeMode: "mock",
  commissionShare: 50,
  dailyClaimLimit: 10,
  riskKeywords: ["搬运", "非指定商品", "risk"]
};

export const integrationProviderDefinitions: IntegrationProviderDefinition[] = [
  {
    key: "wechat_oauth",
    name: "微信 OAuth",
    purpose: "分发者微信登录与身份绑定",
    publicFields: [
      { key: "appId", envKey: "WECHAT_OAUTH_APP_ID" },
      { key: "redirectUri", envKey: "WECHAT_OAUTH_REDIRECT_URI" }
    ],
    secretFields: [{ key: "appSecret", envKey: "WECHAT_OAUTH_APP_SECRET" }]
  },
  {
    key: "douyin",
    name: "抖音开放平台",
    purpose: "同步抖音作品数据、互动数据和成交数据",
    publicFields: [{ key: "clientKey", envKey: "DOUYIN_CLIENT_KEY" }],
    secretFields: [{ key: "clientSecret", envKey: "DOUYIN_CLIENT_SECRET" }]
  },
  {
    key: "wechat_channels",
    name: "视频号接口",
    purpose: "同步视频号作品和互动数据",
    publicFields: [{ key: "clientId", envKey: "WECHAT_CHANNELS_CLIENT_ID" }],
    secretFields: [{ key: "clientSecret", envKey: "WECHAT_CHANNELS_CLIENT_SECRET" }]
  },
  {
    key: "tencent_identity",
    name: "腾讯认证",
    purpose: "后续接入腾讯身份认证或实名校验",
    publicFields: [{ key: "appId" }, { key: "endpoint" }],
    secretFields: [{ key: "appSecret" }]
  },
  {
    key: "payment",
    name: "打款 / 财务接口",
    purpose: "自动打款、付款回执和财务对账",
    publicFields: [{ key: "endpoint", envKey: "PAYMENT_PROVIDER_ENDPOINT" }],
    secretFields: [{ key: "token", envKey: "PAYMENT_PROVIDER_TOKEN" }]
  },
  {
    key: "ffmpeg",
    name: "FFmpeg 服务",
    purpose: "真实视频切片、转码和水印处理",
    publicFields: [{ key: "endpoint", envKey: "FFMPEG_WORKER_ENDPOINT" }],
    secretFields: [{ key: "token", envKey: "FFMPEG_WORKER_TOKEN" }]
  }
];

function providerDefinition(key: string) {
  const definition = integrationProviderDefinitions.find((item) => item.key === key);
  if (!definition) throw new ApiError("unknown_integration", `Unknown integration provider: ${key}`, 404);
  return definition;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : fallback;
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
}

function normalizeRiskKeywords(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，\n]/) : defaultSystemSettings.riskKeywords;
  return raw.map((item) => String(item).trim()).filter(Boolean);
}

export function normalizeSystemSettings(
  input: Partial<Omit<SystemSettings, "riskKeywords">> & { riskKeywords?: unknown },
  env: Pick<WorkerEnv, "APP_ENV"> = {}
): SystemSettings {
  const requestedRuntime =
    input.runtimeMode === "hybrid" || input.runtimeMode === "real" || input.runtimeMode === "mock"
      ? input.runtimeMode
      : defaultSystemSettings.runtimeMode;
  const runtimeMode: RuntimeMode = env.APP_ENV === "production" && requestedRuntime !== "real" ? "real" : requestedRuntime;

  return {
    runtimeMode,
    commissionShare: clampNumber(input.commissionShare, defaultSystemSettings.commissionShare, 0, 100),
    dailyClaimLimit: Math.round(clampNumber(input.dailyClaimLimit, defaultSystemSettings.dailyClaimLimit, 0, 10000)),
    riskKeywords: normalizeRiskKeywords(input.riskKeywords)
  };
}

function settingsFromRow(row: SystemSettingsRow | undefined, env: WorkerEnv) {
  if (!row) return normalizeSystemSettings(defaultSystemSettings, env);
  return normalizeSystemSettings(
    {
      runtimeMode: row.runtime_mode ?? defaultSystemSettings.runtimeMode,
      commissionShare: Number(row.commission_share ?? defaultSystemSettings.commissionShare),
      dailyClaimLimit: Number(row.daily_claim_limit ?? defaultSystemSettings.dailyClaimLimit),
      riskKeywords: row.risk_keywords ?? defaultSystemSettings.riskKeywords
    },
    env
  );
}

export async function loadSystemSettings(env: WorkerEnv) {
  try {
    const rows = await selectRows<SystemSettingsRow>(env, "system_settings", "select=id,runtime_mode,commission_share,daily_claim_limit,risk_keywords,updated_at&id=eq.global&limit=1");
    return settingsFromRow(rows[0], env);
  } catch {
    return normalizeSystemSettings(defaultSystemSettings, env);
  }
}

export async function saveSystemSettings(env: WorkerEnv, input: Partial<Omit<SystemSettings, "riskKeywords">> & { riskKeywords?: unknown }) {
  const current = await loadSystemSettings(env);
  const settings = normalizeSystemSettings({ ...current, ...input }, env);
  const row = {
    id: "global",
    runtime_mode: settings.runtimeMode,
    commission_share: settings.commissionShare,
    daily_claim_limit: settings.dailyClaimLimit,
    risk_keywords: settings.riskKeywords,
    updated_at: new Date().toISOString()
  };

  const updated = await patchRows<SystemSettingsRow>(env, "system_settings", "id=eq.global", row).catch(() => []);
  if (!updated.length) {
    await insertRow<SystemSettingsRow>(env, "system_settings", row);
  }
  return settings;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function aesKey(masterKey: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(masterKey));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecretValue(value: string, masterKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(masterKey), new TextEncoder().encode(value));
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecretValue(payload: string, masterKey: string) {
  const [version, ivValue, encryptedValue] = payload.split(":");
  if (version !== "v1" || !ivValue || !encryptedValue) {
    throw new ApiError("invalid_secret_payload", "Encrypted secret payload is invalid", 500);
  }
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivValue) },
    await aesKey(masterKey),
    base64ToBytes(encryptedValue)
  );
  return new TextDecoder().decode(decrypted);
}

function fingerprint(value: string) {
  return value.slice(-4);
}

function rowToIntegrationConfig(row: IntegrationConfigRow): IntegrationConfigRecord {
  providerDefinition(row.provider_key);
  return {
    key: row.provider_key,
    enabled: Boolean(row.enabled),
    publicConfig: row.public_config ?? {},
    encryptedSecrets: row.encrypted_secrets ?? {},
    secretFingerprints: row.secret_fingerprints ?? {},
    lastCheckedAt: row.last_checked_at,
    lastCheckStatus: row.last_check_status
  };
}

function nonEmptyPublicConfig(config: PublicConfig) {
  return Object.fromEntries(Object.entries(config).filter(([, value]) => String(value ?? "").trim()));
}

function envIntegrationConfig(env: WorkerEnv, key: IntegrationProviderKey): IntegrationConfigRecord {
  const definition = providerDefinition(key);
  const publicConfig = Object.fromEntries(
    definition.publicFields
      .map((field) => [field.key, field.envKey ? env[field.envKey] : undefined])
      .filter(([, value]) => Boolean(value))
  );
  const encryptedSecrets = Object.fromEntries(
    definition.secretFields
      .map((field) => [field.key, field.envKey && env[field.envKey] ? "env" : undefined])
      .filter(([, value]) => Boolean(value))
  ) as SecretMap;
  const secretFingerprints = Object.fromEntries(
    definition.secretFields
      .map((field) => [field.key, field.envKey && env[field.envKey] ? "env" : undefined])
      .filter(([, value]) => Boolean(value))
  ) as SecretMap;

  return {
    key,
    enabled: Object.keys(publicConfig).length > 0 || Object.keys(encryptedSecrets).length > 0,
    publicConfig,
    encryptedSecrets,
    secretFingerprints,
    lastCheckedAt: null,
    lastCheckStatus: null
  };
}

async function loadPersistedIntegrationConfig(env: WorkerEnv, key: IntegrationProviderKey) {
  providerDefinition(key);
  const rows = await selectRows<IntegrationConfigRow>(
    env,
    "integration_configs",
    `select=provider_key,enabled,public_config,encrypted_secrets,secret_fingerprints,last_checked_at,last_check_status&provider_key=eq.${key}&limit=1`
  );
  return rows[0] ? rowToIntegrationConfig(rows[0]) : null;
}

function publicFieldKeys(key: IntegrationProviderKey) {
  return new Set(providerDefinition(key).publicFields.map((field) => field.key));
}

function secretFieldKeys(key: IntegrationProviderKey) {
  return new Set(providerDefinition(key).secretFields.map((field) => field.key));
}

function sanitizePublicConfig(key: IntegrationProviderKey, config: PublicConfig = {}) {
  const allowed = publicFieldKeys(key);
  return Object.fromEntries(Object.entries(config).filter(([field]) => allowed.has(field)));
}

function mergeWithEnvFallback(env: WorkerEnv, persisted: IntegrationConfigRecord | null, key: IntegrationProviderKey) {
  const fallback = envIntegrationConfig(env, key);
  if (!persisted) return fallback;

  return {
    ...persisted,
    publicConfig: {
      ...fallback.publicConfig,
      ...nonEmptyPublicConfig(sanitizePublicConfig(key, persisted.publicConfig))
    },
    encryptedSecrets: {
      ...fallback.encryptedSecrets,
      ...persisted.encryptedSecrets
    },
    secretFingerprints: {
      ...fallback.secretFingerprints,
      ...persisted.secretFingerprints
    }
  };
}

export async function loadIntegrationConfig(env: WorkerEnv, key: IntegrationProviderKey) {
  try {
    return mergeWithEnvFallback(env, await loadPersistedIntegrationConfig(env, key), key);
  } catch {
    return envIntegrationConfig(env, key);
  }
}

export async function loadIntegrationRuntimeConfig(env: WorkerEnv, key: IntegrationProviderKey): Promise<IntegrationRuntimeConfig> {
  const definition = providerDefinition(key);
  const persisted = await loadPersistedIntegrationConfig(env, key).catch(() => null);
  const config = mergeWithEnvFallback(env, persisted, key);
  const secrets: Record<string, string> = {};

  for (const field of definition.secretFields) {
    const encrypted = persisted?.encryptedSecrets[field.key];
    if (encrypted && env.CONFIG_ENCRYPTION_KEY) {
      try {
        secrets[field.key] = await decryptSecretValue(encrypted, env.CONFIG_ENCRYPTION_KEY);
        continue;
      } catch {
        // Fall through to env fallback when a stored secret cannot be decrypted.
      }
    }

    const envValue = field.envKey ? env[field.envKey] : undefined;
    if (typeof envValue === "string" && envValue) {
      secrets[field.key] = envValue;
    }
  }

  return {
    key,
    enabled: config.enabled,
    publicConfig: Object.fromEntries(Object.entries(config.publicConfig).map(([field, value]) => [field, String(value ?? "")])),
    secrets,
    validation: validateIntegrationConfig(config)
  };
}

export function redactIntegrationConfig(config: IntegrationConfigRecord) {
  const definition = providerDefinition(config.key);
  return {
    key: config.key,
    enabled: config.enabled,
    publicConfig: config.publicConfig,
    secretFields: Object.fromEntries(
      definition.secretFields.map((field) => [
        field.key,
        {
          configured: Boolean(config.encryptedSecrets[field.key]),
          fingerprint: config.secretFingerprints[field.key] ?? null
        }
      ])
    ),
    lastCheckedAt: config.lastCheckedAt,
    lastCheckStatus: config.lastCheckStatus
  };
}

export async function saveIntegrationConfig(
  env: WorkerEnv,
  key: IntegrationProviderKey,
  input: { enabled?: boolean; publicConfig?: PublicConfig; secrets?: SecretMap }
) {
  const allowedSecrets = secretFieldKeys(key);
  const persisted = await loadPersistedIntegrationConfig(env, key).catch(() => null);
  const fallback = envIntegrationConfig(env, key);
  const current = persisted ?? fallback;
  const encryptedSecrets: SecretMap = { ...(persisted?.encryptedSecrets ?? {}) };
  const secretFingerprints: SecretMap = { ...(persisted?.secretFingerprints ?? {}) };

  for (const [field, rawValue] of Object.entries(input.secrets ?? {})) {
    if (!allowedSecrets.has(field) || !rawValue.trim()) continue;
    if (!env.CONFIG_ENCRYPTION_KEY) {
      throw new ApiError("config_encryption_not_configured", "CONFIG_ENCRYPTION_KEY is required to store integration secrets", 503);
    }
    encryptedSecrets[field] = await encryptSecretValue(rawValue, env.CONFIG_ENCRYPTION_KEY);
    secretFingerprints[field] = fingerprint(rawValue);
  }

  const row = {
    provider_key: key,
    enabled: input.enabled ?? current.enabled,
    public_config: sanitizePublicConfig(key, {
      ...fallback.publicConfig,
      ...(persisted?.publicConfig ?? {}),
      ...(input.publicConfig ?? {})
    }),
    encrypted_secrets: encryptedSecrets,
    secret_fingerprints: secretFingerprints,
    updated_at: new Date().toISOString()
  };

  const updated = await patchRows<IntegrationConfigRow>(env, "integration_configs", `provider_key=eq.${key}`, row).catch(() => []);
  const saved = updated[0] ?? (await insertRow<IntegrationConfigRow>(env, "integration_configs", row));
  return redactIntegrationConfig(rowToIntegrationConfig(saved));
}

export function validateIntegrationConfig(config: IntegrationConfigRecord) {
  const definition = providerDefinition(config.key);
  const missingPublicFields = definition.publicFields
    .filter((field) => !String(config.publicConfig[field.key] ?? "").trim())
    .map((field) => field.key);
  const missingSecretFields = definition.secretFields
    .filter((field) => !config.encryptedSecrets[field.key])
    .map((field) => field.key);
  const invalidPublicFields = definition.publicFields
    .filter((field) => ["endpoint", "redirectUri"].includes(field.key))
    .filter((field) => {
      const value = String(config.publicConfig[field.key] ?? "").trim();
      if (!value) return false;
      try {
        const url = new URL(value);
        return url.protocol !== "https:" && url.protocol !== "http:";
      } catch {
        return true;
      }
    })
    .map((field) => field.key);

  return {
    status: missingPublicFields.length || missingSecretFields.length ? "missing_config" : invalidPublicFields.length ? "invalid_config" : "configured",
    missingPublicFields,
    missingSecretFields,
    invalidPublicFields
  };
}

export async function testIntegrationConfig(env: WorkerEnv, key: IntegrationProviderKey) {
  const config = await loadIntegrationConfig(env, key);
  const result = validateIntegrationConfig(config);
  const now = new Date().toISOString();
  await patchRows(env, "integration_configs", `provider_key=eq.${key}`, {
    last_checked_at: now,
    last_check_status: result.status
  }).catch(() => undefined);
  return { ...result, checkedAt: now };
}

function configuredCount(config: IntegrationConfigRecord) {
  const definition = providerDefinition(config.key);
  return (
    definition.publicFields.filter((field) => String(config.publicConfig[field.key] ?? "").trim()).length +
    definition.secretFields.filter((field) => config.encryptedSecrets[field.key]).length
  );
}

export async function integrationReadiness(env: WorkerEnv) {
  const infrastructure = [
    { key: "supabase", required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
    { key: "cloudflareR2", required: ["CLIP_PARTNER_BUCKET"] },
    { key: "r2DirectUpload", required: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] },
    { key: "cloudflareQueue", required: ["CLIP_TASK_QUEUE"] }
  ].map((group) => {
    const configured = group.required.filter((key) => Boolean(env[key as keyof WorkerEnv]));
    return {
      key: group.key,
      configuredCount: configured.length,
      totalCount: group.required.length,
      missingKeys: group.required.filter((key) => !env[key as keyof WorkerEnv]),
      isConfigured: configured.length === group.required.length,
      source: "environment"
    };
  });

  const providers = await Promise.all(
    integrationProviderDefinitions.map(async (definition) => {
      const config = await loadIntegrationConfig(env, definition.key);
      const totalCount = definition.publicFields.length + definition.secretFields.length;
      const validation = validateIntegrationConfig(config);
      return {
        key: definition.key,
        name: definition.name,
        purpose: definition.purpose,
        configuredCount: configuredCount(config),
        totalCount,
        missingKeys: [...validation.missingPublicFields, ...validation.missingSecretFields],
        invalidKeys: validation.invalidPublicFields,
        isConfigured: validation.status === "configured",
        enabled: config.enabled,
        lastCheckedAt: config.lastCheckedAt,
        lastCheckStatus: config.lastCheckStatus,
        source: "backend"
      };
    })
  );

  return [...infrastructure, ...providers];
}
