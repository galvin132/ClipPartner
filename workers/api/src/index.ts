/// <reference types="@cloudflare/workers-types" />

import { AwsClient } from "aws4fetch";
import { z } from "zod";

type PlatformValue = "douyin" | "wechat_channels";
const DOUYIN_LABEL = "\u6296\u97f3";
const WECHAT_CHANNELS_LABEL = "\u89c6\u9891\u53f7";
type PlatformLabel = typeof DOUYIN_LABEL | typeof WECHAT_CHANNELS_LABEL;

type AuthorizationStatus = "pending" | "approved" | "rejected" | "paused" | "banned" | "expired";
type MaterialStatus = "draft" | "processing" | "ready" | "published" | "archived";
type PublishStatus = "claimed" | "downloaded" | "submitted" | "verified" | "invalid" | "settled";
type SettlementStatus = "pending" | "confirmed" | "paid" | "blocked";
type RiskStatus = "pending" | "open" | "warning" | "blocked" | "resolved";

type AuthorizationRequestInput = {
  distributorName: string;
  socialAccount: string;
  platform: string;
  ipName: string;
  reason: string;
};

type MaterialInput = {
  title: string;
  ipName: string;
  sourcePlatform: string;
  productName: string;
};

type ProductInput = {
  name: string;
  platform: string;
  affiliateUrl: string;
  commissionRate: number;
};

type RiskRecordInput = {
  platform: string;
  account: string;
  issue: string;
  workUrl: string;
};

type DirectUploadInitInput = {
  title: string;
  ipName: string;
  sourcePlatform: string;
  fileName: string;
  contentType?: string;
  size?: number;
};

type DirectUploadCompleteInput = {
  uploadId: string;
  key: string;
  title: string;
  ipName: string;
  sourcePlatform: string;
};

type RecordingUploadMeta = {
  title: string;
  ipName: string;
  sourcePlatform: string;
};

type RecordingUploadResult = {
  recordingId: string;
  clipAssetId: string;
  r2Key: string;
  meta: RecordingUploadMeta;
};

type ClipTaskPayload = {
  type: "clip.create" | "cron.scan";
  taskId: string;
  recordingId?: string;
  clipAssetId?: string;
  r2Key?: string;
  meta?: RecordingUploadMeta;
  createdAt: string;
};

type ListOptions = {
  limit: number;
  offset: number;
  q?: string;
  status?: string;
  platform?: PlatformValue;
};

type ListMeta = {
  limit: number;
  offset: number;
  count: number;
  nextOffset: number | null;
};

type WorkerEnv = Cloudflare.Env & {
  FRONTEND_ORIGIN: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  CLIP_PARTNER_BUCKET: R2Bucket;
  CLIP_TASK_QUEUE: Queue;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown
  ) {
    super(message);
  }
}

const platformSchema = z.union([
  z.literal("douyin"),
  z.literal("wechat_channels"),
  z.literal(DOUYIN_LABEL),
  z.literal(WECHAT_CHANNELS_LABEL)
]);
const nonEmptyString = z.string().trim().min(1).max(500);
const uuidSchema = z.string().uuid();

const authorizationRequestSchema = z.object({
  distributorName: nonEmptyString.max(80),
  socialAccount: nonEmptyString.max(120),
  platform: platformSchema,
  ipName: nonEmptyString.max(120),
  reason: nonEmptyString.max(500)
});

const materialSchema = z.object({
  title: nonEmptyString.max(160),
  ipName: nonEmptyString.max(120),
  sourcePlatform: platformSchema,
  productName: nonEmptyString.max(160)
});

const productSchema = z.object({
  name: nonEmptyString.max(160),
  platform: platformSchema,
  affiliateUrl: z.url().max(1000),
  commissionRate: z.coerce.number().min(0).max(100)
});

const riskRecordSchema = z.object({
  platform: platformSchema,
  account: nonEmptyString.max(120),
  issue: nonEmptyString.max(500),
  workUrl: z.url().max(1000)
});

const statusSchemas = {
  authorization: z.object({ status: z.enum(["pending", "approved", "rejected", "paused", "banned", "expired"]) }),
  material: z.object({ status: z.enum(["draft", "processing", "ready", "published", "archived"]) }),
  publish: z.object({ status: z.enum(["claimed", "downloaded", "submitted", "verified", "invalid", "settled"]) }),
  settlement: z.object({ status: z.enum(["pending", "confirmed", "paid", "blocked"]) }),
  risk: z.object({ status: z.enum(["pending", "open", "warning", "blocked", "resolved"]) }),
  product: z.object({ isActive: z.boolean() })
};

const directUploadInitSchema = z.object({
  title: nonEmptyString.max(160),
  ipName: nonEmptyString.max(120),
  sourcePlatform: platformSchema,
  fileName: nonEmptyString.max(240),
  contentType: z.string().trim().max(120).optional(),
  size: z.coerce.number().int().positive().max(1024 * 1024 * 1024).optional()
});

const directUploadCompleteSchema = z.object({
  uploadId: uuidSchema,
  key: nonEmptyString.max(500),
  title: nonEmptyString.max(160),
  ipName: nonEmptyString.max(120),
  sourcePlatform: platformSchema
});

const submitPublishSchema = z.object({
  publishUrl: z.url().max(1000).optional()
});

const performanceSchema = z.object({
  gmv: z.coerce.number().min(0).max(999999999),
  commission: z.coerce.number().min(0).max(999999999)
});

const claimSchema = z.object({
  distributorName: z.string().trim().min(1).max(80).optional()
});

const materialProductSchema = z.object({
  productId: uuidSchema
});

const platformToLabel: Record<PlatformValue, PlatformLabel> = {
  douyin: DOUYIN_LABEL,
  wechat_channels: WECHAT_CHANNELS_LABEL
};

function toPlatformValue(value: string | undefined): PlatformValue {
  if (value === "wechat_channels" || value === WECHAT_CHANNELS_LABEL) return "wechat_channels";
  return "douyin";
}

function toPlatformLabel(value: string | undefined): PlatformLabel {
  return toPlatformValue(value) === "wechat_channels" ? WECHAT_CHANNELS_LABEL : DOUYIN_LABEL;
}

function corsHeaders(env: WorkerEnv) {
  return {
    "access-control-allow-origin": env.FRONTEND_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  };
}

function json(data: unknown, env: WorkerEnv, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...corsHeaders(env),
      ...init.headers
    }
  });
}

function errorJson(error: unknown, env: WorkerEnv) {
  if (error instanceof ApiError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      env,
      { status: error.status }
    );
  }

  return json(
    {
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error"
      }
    },
    env,
    { status: 500 }
  );
}

function logError(request: Request, error: unknown) {
  console.error(
    JSON.stringify({
      level: "error",
      path: new URL(request.url).pathname,
      message: error instanceof Error ? error.message : "Unknown error"
    })
  );
}

async function readJson<T>(request: Request, schema: z.ZodType<T>) {
  const body = await request.json().catch(() => {
    throw new ApiError("invalid_json", "Request body must be valid JSON", 400);
  });
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError("validation_error", "Request body validation failed", 422, z.flattenError(parsed.error));
  }

  return parsed.data;
}

function requireSupabase(env: WorkerEnv) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiError("supabase_not_configured", "Supabase is not configured", 503);
  }

  return {
    restUrl: `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}

async function supabase<T>(env: WorkerEnv, path: string, init: RequestInit = {}): Promise<T> {
  const { restUrl, serviceKey } = requireSupabase(env);
  const response = await fetch(`${restUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed ${response.status}: ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function selectRows<T>(env: WorkerEnv, table: string, query = "select=*") {
  return supabase<T[]>(env, `/${table}?${query}`);
}

async function insertRow<T>(env: WorkerEnv, table: string, body: Record<string, unknown>) {
  return supabase<T[]>(env, `/${table}`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(body)
  }).then((rows) => rows[0]);
}

async function patchRows<T>(env: WorkerEnv, table: string, filter: string, body: Record<string, unknown>) {
  return supabase<T[]>(env, `/${table}?${filter}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(body)
  });
}

async function deleteByFilter(env: WorkerEnv, table: string, filter: string) {
  await supabase<void>(env, `/${table}?${filter}`, {
    method: "DELETE"
  });
}

async function deleteRows(env: WorkerEnv, table: string) {
  await supabase<void>(env, `/${table}?id=not.is.null`, {
    method: "DELETE"
  });
}

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function first<T>(rows: T[]) {
  return rows[0];
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function listOptions(params: URLSearchParams): ListOptions {
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  const q = params.get("q")?.trim().slice(0, 80) || undefined;
  const status = params.get("status")?.trim().slice(0, 40) || undefined;
  const platformParam = params.get("platform")?.trim();
  const platform =
    platformParam === "douyin" || platformParam === DOUYIN_LABEL
      ? "douyin"
      : platformParam === "wechat_channels" || platformParam === WECHAT_CHANNELS_LABEL
        ? "wechat_channels"
        : undefined;

  return { limit, offset, q, status, platform };
}

function listMeta<T>(items: T[], options: ListOptions): ListMeta {
  return {
    limit: options.limit,
    offset: options.offset,
    count: items.length,
    nextOffset: items.length === options.limit ? options.offset + options.limit : null
  };
}

function filterParam(column: string, operator: string, value: string) {
  return `${column}=${operator}.${encodeURIComponent(value)}`;
}

function rangeQuery(options: ListOptions) {
  return `limit=${options.limit}&offset=${options.offset}`;
}

function searchQuery(columns: string[], value: string | undefined) {
  if (!value) return undefined;
  const safeValue = value.replace(/[*,()]/g, " ").replace(/\s+/g, " ").trim();
  if (!safeValue) return undefined;

  return `or=${encodeURIComponent(`(${columns.map((column) => `${column}.ilike.*${safeValue}*`).join(",")})`)}`;
}

function buildListQuery(select: string, order: string, options: ListOptions, filters: Array<string | undefined>) {
  return [select, order, rangeQuery(options), ...filters].filter(Boolean).join("&");
}

async function findOrCreateDistributor(env: WorkerEnv, displayName: string, phone = "Pending binding") {
  const existing = await selectRows<{ id: string }>(
    env,
    "distributor_profiles",
    `select=id&${eq("display_name", displayName)}&limit=1`
  );
  if (first(existing)) return first(existing);

  return insertRow<{ id: string }>(env, "distributor_profiles", {
    user_id: crypto.randomUUID(),
    display_name: displayName,
    phone,
    status: "approved"
  });
}

async function findOrCreateIp(env: WorkerEnv, name: string, platform: string) {
  const existing = await selectRows<{ id: string }>(env, "ip_accounts", `select=id&${eq("name", name)}&limit=1`);
  if (first(existing)) return first(existing);

  return insertRow<{ id: string }>(env, "ip_accounts", {
    name,
    platform: toPlatformValue(platform),
    description: `${name} 闁烩晛鐡ㄩ幐閬嶅礆閸モ晛顣?IP`,
    default_share_rate: 50
  });
}

async function findOrCreateSocialAccount(
  env: WorkerEnv,
  distributorId: string,
  accountName: string,
  platform: string
) {
  const existing = await selectRows<{ id: string }>(
    env,
    "social_accounts",
    `select=id&distributor_id=eq.${distributorId}&${eq("account_name", accountName)}&limit=1`
  );
  if (first(existing)) return first(existing);

  return insertRow<{ id: string }>(env, "social_accounts", {
    distributor_id: distributorId,
    platform: toPlatformValue(platform),
    account_name: accountName
  });
}

async function findOrCreateProduct(env: WorkerEnv, name: string, platform: string) {
  const existing = await selectRows<{ id: string }>(env, "products", `select=id&${eq("name", name)}&limit=1`);
  if (first(existing)) return first(existing);

  return insertRow<{ id: string }>(env, "products", {
    name,
    platform: toPlatformValue(platform),
    affiliate_url: "https://example.com/product",
    commission_rate: 15
  });
}

async function createProduct(env: WorkerEnv, input: ProductInput) {
  await insertRow(env, "products", {
    name: input.name,
    platform: toPlatformValue(input.platform),
    affiliate_url: input.affiliateUrl,
    commission_rate: input.commissionRate,
    is_active: true
  });
}

async function createAuthorizationRequest(env: WorkerEnv, input: AuthorizationRequestInput) {
  const distributor = await findOrCreateDistributor(env, input.distributorName);
  const ip = await findOrCreateIp(env, input.ipName, input.platform);
  const social = await findOrCreateSocialAccount(env, distributor.id, input.socialAccount, input.platform);

  await insertRow(env, "authorization_requests", {
    distributor_id: distributor.id,
    ip_account_id: ip.id,
    social_account_id: social.id,
    status: "pending",
    application_note: input.reason
  });
}

async function createMaterial(env: WorkerEnv, input: MaterialInput) {
  const ip = await findOrCreateIp(env, input.ipName, input.sourcePlatform);
  const product = await findOrCreateProduct(env, input.productName, input.sourcePlatform);
  const clip = await insertRow<{ id: string }>(env, "clip_assets", {
    ip_account_id: ip.id,
    title: input.title,
    status: "processing",
    tags: ["Pending tag"],
    start_second: 0,
    end_second: 0
  });

  await insertRow(env, "clip_products", {
    clip_asset_id: clip.id,
    product_id: product.id,
    is_primary: true
  });
}

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function createRecordingAsset(env: WorkerEnv, meta: RecordingUploadMeta, key: string): Promise<RecordingUploadResult> {
  const ip = await findOrCreateIp(env, meta.ipName, meta.sourcePlatform);
  const recording = await insertRow<{ id: string }>(env, "live_recordings", {
    ip_account_id: ip.id,
    source_platform: toPlatformValue(meta.sourcePlatform),
    live_date: new Date().toISOString().slice(0, 10),
    title: meta.title,
    r2_key: key
  });

  const clip = await insertRow<{ id: string }>(env, "clip_assets", {
    live_recording_id: recording.id,
    ip_account_id: ip.id,
    title: `${meta.title} - pending clip`,
    status: "processing",
    tags: ["recording-upload", "pending-clip"],
    start_second: 0,
    end_second: 0
  });

  return {
    recordingId: recording.id,
    clipAssetId: clip.id,
    r2Key: key,
    meta
  };
}

async function uploadRecording(env: WorkerEnv, request: Request): Promise<RecordingUploadResult> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiError("missing_recording_file", "Missing recording file", 400);
  }

  const meta: RecordingUploadMeta = {
    title: String(form.get("title") || file.name || "Uploaded recording pending clip"),
    ipName: String(form.get("ipName") || "Demo IP"),
    sourcePlatform: String(form.get("sourcePlatform") || WECHAT_CHANNELS_LABEL)
  };
  const parsed = directUploadInitSchema
    .pick({ title: true, ipName: true, sourcePlatform: true })
    .safeParse(meta);
  if (!parsed.success) {
    throw new ApiError("validation_error", "Upload metadata validation failed", 422, z.flattenError(parsed.error));
  }

  const key = `recordings/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

  await env.CLIP_PARTNER_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    },
    customMetadata: {
      title: meta.title,
      ipName: meta.ipName,
      sourcePlatform: toPlatformValue(meta.sourcePlatform)
    }
  });

  return createRecordingAsset(env, meta, key);
}

function requireR2Signing(env: WorkerEnv) {
  const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"].filter(
    (key) => !env[key as keyof WorkerEnv]
  );
  if (missing.length) {
    throw new ApiError("r2_signing_not_configured", "R2 direct upload signing is not configured", 503, { missing });
  }

  return {
    accountId: env.R2_ACCOUNT_ID as string,
    accessKeyId: env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
    bucketName: env.R2_BUCKET_NAME as string
  };
}

async function createDirectUpload(env: WorkerEnv, input: DirectUploadInitInput) {
  const config = requireR2Signing(env);
  const uploadId = crypto.randomUUID();
  const contentType = input.contentType || "application/octet-stream";
  const key = `recordings/uploads/${new Date().toISOString().slice(0, 10)}/${uploadId}-${safeFileName(input.fileName)}`;
  const url = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${key}`;
  const signer = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 0
  });
  const signed = await signer.sign(url, {
    method: "PUT",
    headers: {
      "content-type": contentType
    },
    aws: {
      signQuery: true,
      allHeaders: true
    }
  });

  return {
    uploadId,
    key,
    uploadUrl: signed.url,
    method: "PUT",
    expiresIn: 900,
    expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
    headers: {
      "content-type": contentType
    }
  };
}

async function completeDirectUpload(env: WorkerEnv, input: DirectUploadCompleteInput) {
  if (!input.key.startsWith("recordings/uploads/") || !input.key.includes(input.uploadId)) {
    throw new ApiError("invalid_upload_key", "Upload key does not match the upload session", 400);
  }

  const object = await env.CLIP_PARTNER_BUCKET.head(input.key);
  if (!object) {
    throw new ApiError("upload_not_found", "Uploaded object was not found in R2", 404);
  }

  return createRecordingAsset(
    env,
    {
      title: input.title,
      ipName: input.ipName,
      sourcePlatform: input.sourcePlatform
    },
    input.key
  );
}

async function createClipTask(env: WorkerEnv, upload: RecordingUploadResult) {
  const dedupeKey = `clip.create:${upload.clipAssetId}`;
  try {
    const existing = await selectRows<{ id: string }>(env, "clip_tasks", `select=id&${eq("dedupe_key", dedupeKey)}&limit=1`);
    if (first(existing)) {
      return first(existing).id;
    }

    const task = await insertRow<{ id: string }>(env, "clip_tasks", {
      type: "clip.create",
      dedupe_key: dedupeKey,
      recording_id: upload.recordingId,
      clip_asset_id: upload.clipAssetId,
      r2_key: upload.r2Key,
      status: "queued",
      payload: upload
    });
    return task.id;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "clip_tasks table unavailable; queueing without persistent task record",
        detail: error instanceof Error ? error.message : "Unknown error"
      })
    );
    return dedupeKey;
  }
}

async function queueClipTask(env: WorkerEnv, upload: RecordingUploadResult) {
  const taskId = await createClipTask(env, upload);
  const payload: ClipTaskPayload = {
    type: "clip.create",
    taskId,
    recordingId: upload.recordingId,
    clipAssetId: upload.clipAssetId,
    r2Key: upload.r2Key,
    meta: upload.meta,
    createdAt: new Date().toISOString()
  };

  return env.CLIP_TASK_QUEUE.send(payload);
}

async function bindProductToMaterial(env: WorkerEnv, clipAssetId: string, productId: string) {
  await deleteByFilter(env, "clip_products", `clip_asset_id=eq.${clipAssetId}`);
  await insertRow(env, "clip_products", {
    clip_asset_id: clipAssetId,
    product_id: productId,
    is_primary: true
  });
}

async function claimMaterial(env: WorkerEnv, clipAssetId: string, distributorName = "Demo Distributor") {
  const clipRows = await selectRows<{
    id: string;
    title: string;
    ip_account_id: string;
    ip_accounts: { platform: PlatformValue } | null;
    clip_products: { product_id: string; products: { name: string } | null }[];
  }>(
    env,
    "clip_assets",
    `select=id,title,ip_account_id,ip_accounts(platform),clip_products(product_id,products(name))&id=eq.${clipAssetId}&limit=1`
  );
  const clip = first(clipRows);
  if (!clip) throw new Error("Clip asset not found");

  const platform = platformToLabel[clip.ip_accounts?.platform ?? "wechat_channels"];
  const productId = clip.clip_products[0]?.product_id;
  if (!productId) throw new Error("Clip asset has no product");

  const distributor = await findOrCreateDistributor(env, distributorName, "186****7108");
  const social = await findOrCreateSocialAccount(env, distributor.id, "Demo account", platform);
  const claim = await insertRow<{ id: string }>(env, "clip_claims", {
    distributor_id: distributor.id,
    clip_asset_id: clip.id,
    product_id: productId,
    social_account_id: social.id,
    planned_platform: toPlatformValue(platform)
  });

  await insertRow(env, "clip_downloads", {
    claim_id: claim.id,
    distributor_id: distributor.id,
    clip_asset_id: clip.id,
    download_version: "watermarked"
  });

  await insertRow(env, "publish_records", {
    claim_id: claim.id,
    distributor_id: distributor.id,
    clip_asset_id: clip.id,
    product_id: productId,
    platform: toPlatformValue(platform),
    publish_url: "pending",
    status: "downloaded"
  });
}

async function importPerformance(env: WorkerEnv, publishRecordId: string, gmv: number, commission: number) {
  await patchRows(env, "publish_records", `id=eq.${publishRecordId}`, {
    status: "verified",
    verified_at: new Date().toISOString()
  });
  await insertRow(env, "performance_snapshots", {
    publish_record_id: publishRecordId,
    gmv,
    commission_amount: commission
  });
}

async function generateSettlement(env: WorkerEnv) {
  const records = await selectRows<{
    id: string;
    distributor_id: string;
    performance_snapshots: { commission_amount: number }[];
  }>(
    env,
    "publish_records",
    "select=id,distributor_id,performance_snapshots(commission_amount)&status=eq.verified"
  );

  const payable = records.reduce((sum, record) => {
    const latest = record.performance_snapshots.at(-1);
    return sum + Number(latest?.commission_amount ?? 0) * 0.5;
  }, 0);

  const distributor = records[0]?.distributor_id ?? (await findOrCreateDistributor(env, "Monthly settlement")).id;
  await insertRow(env, "settlement_orders", {
    distributor_id: distributor,
    period: new Date().toISOString().slice(0, 7),
    status: "pending",
    total_amount: payable
  });
}

async function listState(env: WorkerEnv) {
  async function readStateLists() {
    const [authorizationRequests, materials, products, publishRecords, settlements, riskRecords] = await Promise.all([
      listAuthorizationRequests(env),
      listMaterials(env),
      listProducts(env),
      listPublishRecords(env),
      listSettlements(env),
      listRiskRecords(env)
    ]);

    return {
      authorizationRequests: authorizationRequests.items,
      materials: materials.items,
      products: products.items,
      publishRecords: publishRecords.items,
      settlements: settlements.items,
      riskRecords: riskRecords.items
    };
  }

  let state = await readStateLists();

  if (
    state.authorizationRequests.length === 0 &&
    state.materials.length === 0 &&
    state.products.length === 0 &&
    state.publishRecords.length === 0 &&
    state.settlements.length === 0 &&
    state.riskRecords.length === 0
  ) {
    await seedDemoData(env);
    state = await readStateLists();
  }

  return state;
}

async function listAuthorizationRequests(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await selectRows<{
    id: string;
    status: AuthorizationStatus;
    application_note: string | null;
    created_at: string;
    distributor_profiles: { display_name: string; phone: string | null } | null;
    ip_accounts: { name: string } | null;
    social_accounts: { account_name: string; platform: PlatformValue } | null;
  }>(
    env,
    "authorization_requests",
    buildListQuery(
      "select=id,status,application_note,created_at,distributor_profiles(display_name,phone),ip_accounts(name),social_accounts(account_name,platform)",
      "order=created_at.desc",
      options,
      [options.status ? filterParam("status", "eq", options.status) : undefined]
    )
  );

  const authorizationRequests = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    phone: row.distributor_profiles?.phone ?? "Pending binding",
    socialAccount: row.social_accounts?.account_name ?? "Pending account",
    platform: platformToLabel[row.social_accounts?.platform ?? "douyin"],
    ipName: row.ip_accounts?.name ?? "Unknown IP",
    status: row.status,
    appliedAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
    reason: row.application_note ?? ""
  }));
  return { items: authorizationRequests, meta: listMeta(authorizationRequests, options) };
}

async function listMaterials(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      title: string;
      ip_name: string | null;
      source_platform: PlatformValue | null;
      live_date: string;
      duration_seconds: number | null;
      tags: string[] | null;
      product_name: string | null;
      status: MaterialStatus;
      claims: number | null;
      downloads: number | null;
      created_at: string;
    }>(
      env,
      "material_summaries",
      buildListQuery(
        "select=id,title,ip_name,source_platform,live_date,duration_seconds,tags,product_name,status,claims,downloads,created_at",
        "order=created_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("source_platform", "eq", options.platform) : undefined,
          searchQuery(["title", "ip_name", "product_name"], options.q)
        ]
      )
    );

    const materials = rows.map((row) => ({
      id: row.id,
      title: row.title,
      ipName: row.ip_name ?? "Unknown IP",
      sourcePlatform: platformToLabel[row.source_platform ?? "douyin"],
      liveDate: row.live_date,
      duration: row.duration_seconds && row.duration_seconds > 0 ? `${row.duration_seconds}s` : "Pending clip",
      tags: row.tags?.length ? row.tags : ["Pending tag"],
      productName: row.product_name ?? "Pending product",
      status: row.status,
      claims: Number(row.claims ?? 0),
      downloads: Number(row.downloads ?? 0)
    }));
    return { items: materials, meta: listMeta(materials, options) };
  } catch {
    // Older databases may not have material_summaries yet; keep the MVP API usable.
  }

  const [clips, claims, downloads] = await Promise.all([
    selectRows<{
      id: string;
      title: string;
      status: MaterialStatus;
      tags: string[];
      start_second: number | null;
      end_second: number | null;
      created_at: string;
      ip_accounts: { name: string; platform: PlatformValue } | null;
      clip_products: { products: { name: string } | null }[];
    }>(
      env,
      "clip_assets",
      buildListQuery(
        "select=id,title,status,tags,start_second,end_second,created_at,ip_accounts(name,platform),clip_products(products(name))",
        "order=created_at.desc",
        options,
        [options.status ? filterParam("status", "eq", options.status) : undefined]
      )
    ),
    selectRows<{ clip_asset_id: string }>(env, "clip_claims", "select=clip_asset_id"),
    selectRows<{ clip_asset_id: string }>(env, "clip_downloads", "select=clip_asset_id")
  ]);

  const claimsByClip = countBy(claims, (claim) => claim.clip_asset_id);
  const downloadsByClip = countBy(downloads, (download) => download.clip_asset_id);

  const materials = clips.map((clip) => ({
    id: clip.id,
    title: clip.title,
    ipName: clip.ip_accounts?.name ?? "Unknown IP",
    sourcePlatform: platformToLabel[clip.ip_accounts?.platform ?? "douyin"],
    liveDate: clip.created_at.slice(0, 10),
    duration:
      clip.end_second && clip.start_second && clip.end_second > clip.start_second
        ? `${clip.end_second - clip.start_second}s`
        : "Pending clip",
    tags: clip.tags?.length ? clip.tags : ["Pending tag"],
    productName: clip.clip_products[0]?.products?.name ?? "Pending product",
    status: clip.status,
    claims: claimsByClip.get(clip.id) ?? 0,
    downloads: downloadsByClip.get(clip.id) ?? 0
  }));
  return { items: materials, meta: listMeta(materials, options) };
}

async function listProducts(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      name: string;
      platform: PlatformValue;
      affiliate_url: string;
      commission_rate: number | null;
      is_active: boolean;
      material_count: number | null;
      created_at: string;
    }>(
      env,
      "product_summaries",
      buildListQuery(
        "select=id,name,platform,affiliate_url,commission_rate,is_active,material_count,created_at",
        "order=created_at.desc",
        options,
        [
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["name", "affiliate_url"], options.q)
        ]
      )
    );

    const products = rows.map((row) => ({
      id: row.id,
      name: row.name,
      platform: platformToLabel[row.platform],
      affiliateUrl: row.affiliate_url,
      commissionRate: Number(row.commission_rate ?? 0),
      isActive: row.is_active,
      materialCount: Number(row.material_count ?? 0),
      createdAt: row.created_at.slice(0, 10)
    }));
    return { items: products, meta: listMeta(products, options) };
  } catch {
    // Older databases may not have product_summaries yet; keep the MVP API usable.
  }

  const [rows, bindings] = await Promise.all([
    selectRows<{
      id: string;
      name: string;
      platform: PlatformValue;
      affiliate_url: string;
      commission_rate: number | null;
      is_active: boolean;
      created_at: string;
    }>(
      env,
      "products",
      buildListQuery(
        "select=id,name,platform,affiliate_url,commission_rate,is_active,created_at",
        "order=created_at.desc",
        options,
        [options.platform ? filterParam("platform", "eq", options.platform) : undefined]
      )
    ),
    selectRows<{ product_id: string }>(env, "clip_products", "select=product_id")
  ]);

  const bindingsByProduct = countBy(bindings, (binding) => binding.product_id);

  const products = rows.map((row) => ({
    id: row.id,
    name: row.name,
    platform: platformToLabel[row.platform],
    affiliateUrl: row.affiliate_url,
    commissionRate: Number(row.commission_rate ?? 0),
    isActive: row.is_active,
    materialCount: bindingsByProduct.get(row.id) ?? 0,
    createdAt: row.created_at.slice(0, 10)
  }));
  return { items: products, meta: listMeta(products, options) };
}

async function listPublishRecords(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      distributor_name: string | null;
      material_title: string | null;
      product_name: string | null;
      platform: PlatformValue;
      status: PublishStatus;
      submitted_at: string;
      gmv: number | null;
      commission: number | null;
    }>(
      env,
      "publish_record_summaries",
      buildListQuery(
        "select=id,distributor_name,material_title,product_name,platform,status,submitted_at,gmv,commission",
        "order=submitted_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["distributor_name", "material_title", "product_name"], options.q)
        ]
      )
    );

    const publishRecords = rows.map((row) => ({
      id: row.id,
      distributorName: row.distributor_name ?? "Unknown distributor",
      materialTitle: row.material_title ?? "Unknown material",
      productName: row.product_name ?? "Unknown product",
      platform: platformToLabel[row.platform],
      status: row.status,
      submittedAt: new Date(row.submitted_at).toLocaleString("zh-CN", { hour12: false }),
      gmv: Number(row.gmv ?? 0),
      commission: Number(row.commission ?? 0)
    }));
    return { items: publishRecords, meta: listMeta(publishRecords, options) };
  } catch {
    // Older databases may not have publish_record_summaries yet; keep the MVP API usable.
  }

  const rows = await selectRows<{
    id: string;
    status: PublishStatus;
    platform: PlatformValue;
    submitted_at: string;
    distributor_profiles: { display_name: string } | null;
    clip_assets: { title: string } | null;
    products: { name: string } | null;
    performance_snapshots: { gmv: number; commission_amount: number; captured_at: string }[];
  }>(
    env,
    "publish_records",
    buildListQuery(
      "select=id,status,platform,submitted_at,distributor_profiles(display_name),clip_assets(title),products(name),performance_snapshots(gmv,commission_amount,captured_at)",
      "order=submitted_at.desc",
      options,
      [
        options.status ? filterParam("status", "eq", options.status) : undefined,
        options.platform ? filterParam("platform", "eq", options.platform) : undefined
      ]
    )
  );

  const publishRecords = rows.map((row) => {
    const latest = row.performance_snapshots.at(-1);
    return {
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      materialTitle: row.clip_assets?.title ?? "Unknown material",
      productName: row.products?.name ?? "Unknown product",
      platform: platformToLabel[row.platform],
      status: row.status,
      submittedAt: new Date(row.submitted_at).toLocaleString("zh-CN", { hour12: false }),
      gmv: Number(latest?.gmv ?? 0),
      commission: Number(latest?.commission_amount ?? 0)
    };
  });
  return { items: publishRecords, meta: listMeta(publishRecords, options) };
}

async function listSettlements(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      distributor_name: string | null;
      period: string;
      verified_posts: number | null;
      payable_commission: number | null;
      status: SettlementStatus;
      created_at: string;
    }>(
      env,
      "settlement_summaries",
      buildListQuery(
        "select=id,distributor_name,period,verified_posts,payable_commission,status,created_at",
        "order=created_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          searchQuery(["distributor_name", "period"], options.q)
        ]
      )
    );

    const settlements = rows.map((row) => ({
      id: row.id,
      distributorName: row.distributor_name ?? "Monthly settlement",
      period: row.period,
      verifiedPosts: Number(row.verified_posts ?? 0),
      payableCommission: Number(row.payable_commission ?? 0),
      status: row.status
    }));
    return { items: settlements, meta: listMeta(settlements, options) };
  } catch {
    // Older databases may not have settlement_summaries yet; keep the MVP API usable.
  }

  const rows = await selectRows<{
    id: string;
    period: string;
    status: SettlementStatus;
    total_amount: number;
    distributor_profiles: { display_name: string } | null;
  }>(
    env,
    "settlement_orders",
    buildListQuery(
      "select=id,period,status,total_amount,distributor_profiles(display_name)",
      "order=created_at.desc",
      options,
      [options.status ? filterParam("status", "eq", options.status) : undefined]
    )
  );

  const settlements = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Monthly settlement",
    period: row.period,
    verifiedPosts: 0,
    payableCommission: Number(row.total_amount),
    status: row.status
  }));
  return { items: settlements, meta: listMeta(settlements, options) };
}

async function listRiskRecords(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await selectRows<{
    id: string;
    platform: PlatformValue;
    account_name: string;
    work_url: string;
    status: RiskStatus;
    handling_note: string | null;
    created_at: string;
  }>(
    env,
    "violation_leads",
    buildListQuery(
      "select=id,platform,account_name,work_url,status,handling_note,created_at",
      "order=created_at.desc",
      options,
      [
        options.status ? filterParam("status", "eq", options.status) : undefined,
        options.platform ? filterParam("platform", "eq", options.platform) : undefined,
        searchQuery(["account_name", "work_url", "handling_note"], options.q)
      ]
    )
  );

  const riskRecords = rows.map((row) => ({
    id: row.id,
    platform: platformToLabel[row.platform],
    account: row.account_name,
    issue: row.handling_note ?? "Pending review",
    workUrl: row.work_url,
    status: row.status,
    createdAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false })
  }));
  return { items: riskRecords, meta: listMeta(riskRecords, options) };
}

async function createRiskRecord(env: WorkerEnv, input: RiskRecordInput) {
  await insertRow(env, "violation_leads", {
    platform: toPlatformValue(input.platform),
    account_name: input.account,
    work_url: input.workUrl,
    is_authorized: null,
    status: "open",
    handling_note: input.issue
  });
}

async function seedDemoData(env: WorkerEnv) {
  await createAuthorizationRequest(env, {
    distributorName: "Demo Creator A",
    socialAccount: "demo_douyin_account",
    platform: DOUYIN_LABEL,
    ipName: "Demo Home IP",
    reason: "Existing home category account; plans to publish 3 clips per day."
  });
  await createAuthorizationRequest(env, {
    distributorName: "Demo Creator B",
    socialAccount: "demo_channels_account",
    platform: WECHAT_CHANNELS_LABEL,
    ipName: "Demo Fashion IP",
    reason: "Channels account with stable conversion."
  });
  await createMaterial(env, {
    title: "Demo product explainer clip",
    ipName: "Demo Fashion IP",
    sourcePlatform: DOUYIN_LABEL,
    productName: "Demo product"
  });
}

async function resetState(env: WorkerEnv) {
  const tables = [
    "settlement_order_items",
    "settlement_orders",
    "commission_records",
    "performance_snapshots",
    "publish_records",
    "clip_downloads",
    "clip_claims",
    "clip_products",
    "clip_assets",
    "authorization_requests",
    "authorizations",
    "social_accounts",
    "products",
    "ip_accounts",
    "distributor_profiles",
    "violation_records",
    "violation_leads"
  ];
  for (const table of tables) {
    await deleteRows(env, table).catch(() => undefined);
  }
  await seedDemoData(env);
}

function integrationStatus(env: WorkerEnv) {
  const groups = [
    {
      key: "supabase",
      required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    },
    {
      key: "cloudflareR2",
      required: ["CLIP_PARTNER_BUCKET"]
    },
    {
      key: "r2DirectUpload",
      required: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]
    },
    {
      key: "cloudflareQueue",
      required: ["CLIP_TASK_QUEUE"]
    },
    {
      key: "wechatOAuth",
      required: ["WECHAT_OAUTH_APP_ID", "WECHAT_OAUTH_APP_SECRET", "WECHAT_OAUTH_REDIRECT_URI"]
    },
    {
      key: "ffmpegWorker",
      required: ["FFMPEG_WORKER_ENDPOINT", "FFMPEG_WORKER_TOKEN"]
    }
  ];

  return groups.map((group) => {
    const configured = group.required.filter((key) => Boolean(env[key as keyof WorkerEnv]));
    return {
      key: group.key,
      configuredCount: configured.length,
      totalCount: group.required.length,
      missingKeys: group.required.filter((key) => !env[key as keyof WorkerEnv]),
      isConfigured: configured.length === group.required.length
    };
  });
}

async function readBody<T>(request: Request) {
  return request.json().catch(() => ({})) as Promise<T>;
}

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders(env) });
      }

      if (url.pathname === "/health") {
        return json({ service: "clip-partner-api", runtime: "cloudflare-workers", status: "ok" }, env);
      }

      if (url.pathname === "/integrations") {
        return json({ integrations: integrationStatus(env) }, env);
      }

      if (url.pathname === "/state" && request.method === "GET") {
        return json(await listState(env), env);
      }

      if (url.pathname === "/authorization-requests" && request.method === "GET") {
        const { items, meta } = await listAuthorizationRequests(env, listOptions(url.searchParams));
        return json({ authorizationRequests: items, meta }, env);
      }

      if (url.pathname === "/materials" && request.method === "GET") {
        const { items, meta } = await listMaterials(env, listOptions(url.searchParams));
        return json({ materials: items, meta }, env);
      }

      if (url.pathname === "/products" && request.method === "GET") {
        const { items, meta } = await listProducts(env, listOptions(url.searchParams));
        return json({ products: items, meta }, env);
      }

      if (url.pathname === "/publish-records" && request.method === "GET") {
        const { items, meta } = await listPublishRecords(env, listOptions(url.searchParams));
        return json({ publishRecords: items, meta }, env);
      }

      if (url.pathname === "/settlements" && request.method === "GET") {
        const { items, meta } = await listSettlements(env, listOptions(url.searchParams));
        return json({ settlements: items, meta }, env);
      }

      if (url.pathname === "/risk-records" && request.method === "GET") {
        const { items, meta } = await listRiskRecords(env, listOptions(url.searchParams));
        return json({ riskRecords: items, meta }, env);
      }

      if (url.pathname === "/state/reset" && request.method === "POST") {
        await resetState(env);
        return json(await listState(env), env);
      }

      if (url.pathname === "/authorization-requests" && request.method === "POST") {
        await createAuthorizationRequest(env, await readJson(request, authorizationRequestSchema));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/recordings/direct-upload/init" && request.method === "POST") {
        const upload = await createDirectUpload(env, await readJson(request, directUploadInitSchema));
        return json({ upload }, env, { status: 201 });
      }

      if (url.pathname === "/recordings/direct-upload/complete" && request.method === "POST") {
        const upload = await completeDirectUpload(env, await readJson(request, directUploadCompleteSchema));
        ctx.waitUntil(queueClipTask(env, upload));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/recordings/upload" && request.method === "POST") {
        const upload = await uploadRecording(env, request);
        ctx.waitUntil(queueClipTask(env, upload));
        return json(await listState(env), env, { status: 201 });
      }

      const authorizationMatch = url.pathname.match(/^\/authorization-requests\/([^/]+)$/);
      if (authorizationMatch && request.method === "PATCH") {
        const body = await readJson(request, statusSchemas.authorization);
        await patchRows(env, "authorization_requests", `id=eq.${authorizationMatch[1]}`, { status: body.status });
        return json(await listState(env), env);
      }

      if (url.pathname === "/materials" && request.method === "POST") {
        await createMaterial(env, await readJson(request, materialSchema));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/products" && request.method === "POST") {
        await createProduct(env, await readJson(request, productSchema));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/risk-records" && request.method === "POST") {
        await createRiskRecord(env, await readJson(request, riskRecordSchema));
        return json(await listState(env), env, { status: 201 });
      }

      const riskMatch = url.pathname.match(/^\/risk-records\/([^/]+)$/);
      if (riskMatch && request.method === "PATCH") {
        const body = await readJson(request, statusSchemas.risk);
        await patchRows(env, "violation_leads", `id=eq.${riskMatch[1]}`, { status: body.status });
        return json(await listState(env), env);
      }

      const productMatch = url.pathname.match(/^\/products\/([^/]+)$/);
      if (productMatch && request.method === "PATCH") {
        const body = await readJson(request, statusSchemas.product);
        await patchRows(env, "products", `id=eq.${productMatch[1]}`, { is_active: body.isActive });
        return json(await listState(env), env);
      }

      const materialMatch = url.pathname.match(/^\/materials\/([^/]+)$/);
      if (materialMatch && request.method === "PATCH") {
        const body = await readJson(request, statusSchemas.material);
        await patchRows(env, "clip_assets", `id=eq.${materialMatch[1]}`, { status: body.status });
        return json(await listState(env), env);
      }

      const materialProductMatch = url.pathname.match(/^\/materials\/([^/]+)\/product$/);
      if (materialProductMatch && request.method === "POST") {
        const body = await readJson(request, materialProductSchema);
        await bindProductToMaterial(env, materialProductMatch[1], body.productId);
        return json(await listState(env), env);
      }

      const claimMatch = url.pathname.match(/^\/materials\/([^/]+)\/claim$/);
      if (claimMatch && request.method === "POST") {
        const body = await readJson(request, claimSchema);
        await claimMaterial(env, claimMatch[1], body.distributorName);
        return json(await listState(env), env, { status: 201 });
      }

      const submitPublishMatch = url.pathname.match(/^\/publish-records\/([^/]+)\/submit$/);
      if (submitPublishMatch && request.method === "POST") {
        const body = await readJson(request, submitPublishSchema);
        await patchRows(env, "publish_records", `id=eq.${submitPublishMatch[1]}`, {
          status: "submitted",
          submitted_at: new Date().toISOString(),
          publish_url: body.publishUrl || "https://example.com/published-work"
        });
        return json(await listState(env), env);
      }

      const performanceMatch = url.pathname.match(/^\/publish-records\/([^/]+)\/performance$/);
      if (performanceMatch && request.method === "POST") {
        const body = await readJson(request, performanceSchema);
        await importPerformance(env, performanceMatch[1], body.gmv, body.commission);
        return json(await listState(env), env);
      }

      const publishMatch = url.pathname.match(/^\/publish-records\/([^/]+)$/);
      if (publishMatch && request.method === "PATCH") {
        const body = await readJson(request, statusSchemas.publish);
        await patchRows(env, "publish_records", `id=eq.${publishMatch[1]}`, {
          status: body.status,
          verified_at: body.status === "verified" ? new Date().toISOString() : null
        });
        return json(await listState(env), env);
      }

      if (url.pathname === "/settlements/generate" && request.method === "POST") {
        await generateSettlement(env);
        return json(await listState(env), env, { status: 201 });
      }

      const settlementMatch = url.pathname.match(/^\/settlements\/([^/]+)$/);
      if (settlementMatch && request.method === "PATCH") {
        const body = await readJson(request, statusSchemas.settlement);
        await patchRows(env, "settlement_orders", `id=eq.${settlementMatch[1]}`, { status: body.status });
        return json(await listState(env), env);
      }

      if (url.pathname === "/clip-tasks" && request.method === "POST") {
        const body = await readBody<Record<string, unknown>>(request);
        await env.CLIP_TASK_QUEUE.send({
          type: "clip.create",
          payload: body,
          createdAt: new Date().toISOString()
        });

        return json({ ok: true, queued: true }, env, { status: 202 });
      }

      return errorJson(new ApiError("not_found", "Not found", 404), env);
    } catch (error) {
      logError(request, error);
      return errorJson(error, env);
    }
  },

  async scheduled(_event: ScheduledEvent, env: WorkerEnv): Promise<void> {
    await env.CLIP_TASK_QUEUE.send({
      type: "cron.scan",
      createdAt: new Date().toISOString()
    });
  }
};

export default worker;
