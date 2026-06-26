/// <reference types="@cloudflare/workers-types" />

import { z } from "zod";
import { runAuditedSideEffect } from "./audit.ts";
import { isMockAuthAllowed, taskClaimOwnershipFilter, type UserRole } from "./auth-policy.ts";
import {
  createFfmpegJob,
  getFfmpegJob,
  handleFfmpegWebhook,
  listFfmpegJobs,
  updateFfmpegJob
} from "./ffmpeg.ts";
import {
  integrationReadiness,
  loadIntegrationConfig,
  loadSystemSettings,
  redactIntegrationConfig,
  saveIntegrationConfig,
  saveSystemSettings,
  testIntegrationConfig,
  type IntegrationProviderKey
} from "./config-center.ts";
import type { WorkerEnv } from "./env.ts";
import { ApiError } from "./errors.ts";
import { createApiApp } from "./http-app.ts";
import { corsHeaders, errorJson, json, logError, readJson } from "./http-utils.ts";
import {
  authorizeRequest,
  bearerToken,
  readRequestSession,
  requirePartnerSession,
  requireSession,
  ROLE_LABELS,
  type RequestSession
} from "./session.ts";
import { deleteByFilter, deleteRows, insertRow, patchRows, selectRows } from "./supabase-rest.ts";
import {
  buildListQuery,
  countBy,
  dateOnly,
  eq,
  filterParam,
  first,
  formatDateTime,
  inList,
  isUuid,
  listMeta,
  listOptions,
  nextExpiry,
  safeList,
  safeRows,
  searchQuery,
  type ListMeta,
  type ListOptions,
  type PlatformValue
} from "./query-utils.ts";
import {
  completeDirectUpload,
  createDirectUpload,
  queueClipTask,
  uploadRecording,
  type ClipTaskPayload,
  type RecordingUploadMeta
} from "./recordings.ts";

const DOUYIN_LABEL = "\u6296\u97f3";
const WECHAT_CHANNELS_LABEL = "\u89c6\u9891\u53f7";
const DEFAULT_DISTRIBUTOR_NAME = "\u5468\u5a67";
const DEFAULT_AGREEMENT_NAME = "\u76f4\u64ad\u5207\u7247\u6388\u6743\u5408\u4f5c\u534f\u8bae";
const DEFAULT_AGREEMENT_VERSION = "2026.06";
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";
type PlatformLabel = typeof DOUYIN_LABEL | typeof WECHAT_CHANNELS_LABEL;

type AuthorizationStatus = "pending" | "approved" | "rejected" | "paused" | "banned" | "expired";
type MaterialStatus = "draft" | "processing" | "ready" | "published" | "archived";
type PublishStatus = "claimed" | "downloaded" | "submitted" | "verified" | "invalid" | "settled";
type SettlementStatus = "pending" | "confirmed" | "paid" | "blocked";
type RiskStatus = "pending" | "open" | "warning" | "blocked" | "resolved";
type AccountBindingStatus = "pending" | "approved" | "rejected" | "paused";
type ClipTaskStatus = "queued" | "processing" | "completed" | "failed";
type OnboardingStatus =
  | "registered"
  | "profile_pending"
  | "account_pending"
  | "training_pending"
  | "exam_failed"
  | "agreement_pending"
  | "ready_for_authorization"
  | "suspended"
  | "banned";
type AuthorizationPoolStatus = "open" | "paused" | "full";
type DistributionTaskStatus = "draft" | "open" | "paused" | "closed";
type TaskClaimStatus = "claimed" | "downloaded" | "submitted" | "overdue" | "verified" | "invalid" | "settled";
type WalletTransactionType = "commission" | "adjustment" | "freeze" | "payout";
type WalletTransactionStatus = "available" | "frozen" | "pending" | "paid";

type AuthorizationRequestInput = {
  distributorName?: string;
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

type AccountBindingInput = {
  distributorName?: string;
  platform: string;
  accountName: string;
  homepageUrl: string;
  followers: number;
  category: string;
  note?: string;
};

type ClipTaskInput = {
  recordingTitle: string;
  ipName: string;
  sourcePlatform: string;
};

const platformSchema = z.union([
  z.literal("douyin"),
  z.literal("wechat_channels"),
  z.literal(DOUYIN_LABEL),
  z.literal(WECHAT_CHANNELS_LABEL)
]);
const nonEmptyString = z.string().trim().min(1).max(500);
const uuidSchema = z.string().uuid();

const authorizationRequestSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
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

const accountBindingSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  platform: platformSchema,
  accountName: nonEmptyString.max(120),
  homepageUrl: z.url().max(1000),
  followers: z.coerce.number().int().min(0).max(999999999),
  category: nonEmptyString.max(120),
  note: z.string().trim().max(500).optional()
});

const clipTaskSchema = z.object({
  recordingTitle: nonEmptyString.max(180),
  ipName: nonEmptyString.max(120),
  sourcePlatform: platformSchema
});

const statusSchemas = {
  authorization: z.object({ status: z.enum(["pending", "approved", "rejected", "paused", "banned", "expired"]) }),
  material: z.object({ status: z.enum(["draft", "processing", "ready", "published", "archived"]) }),
  publish: z.object({ status: z.enum(["claimed", "downloaded", "submitted", "verified", "invalid", "settled"]) }),
  settlement: z.object({ status: z.enum(["pending", "confirmed", "paid", "blocked"]) }),
  risk: z.object({ status: z.enum(["pending", "open", "warning", "blocked", "resolved"]) }),
  accountBinding: z.object({ status: z.enum(["pending", "approved", "rejected", "paused"]) }),
  clipTask: z.object({ status: z.enum(["queued", "processing", "completed", "failed"]) }),
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

const onboardingStatusSchema = z.enum([
  "registered",
  "profile_pending",
  "account_pending",
  "training_pending",
  "exam_failed",
  "agreement_pending",
  "ready_for_authorization",
  "suspended",
  "banned"
]);

const authorizationPoolStatusSchema = z.enum(["open", "paused", "full"]);
const distributionTaskStatusSchema = z.enum(["draft", "open", "paused", "closed"]);
const walletTransactionTypeSchema = z.enum(["commission", "adjustment", "freeze", "payout"]);
const walletTransactionStatusSchema = z.enum(["available", "frozen", "pending", "paid"]);

const partnerProfileSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  displayName: nonEmptyString.max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  wechatId: z.string().trim().max(120).optional(),
  onboardingStatus: onboardingStatusSchema.optional()
});

const examAttemptSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  score: z.coerce.number().int().min(0).max(100),
  answers: z.record(z.string(), z.unknown()).optional()
});

const agreementSignSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  templateName: nonEmptyString.max(160).optional(),
  version: nonEmptyString.max(40).optional()
});

const authorizationPoolSchema = z.object({
  ipName: nonEmptyString.max(120),
  platform: platformSchema,
  totalQuota: z.coerce.number().int().min(0).max(100000),
  minCreditScore: z.coerce.number().int().min(0).max(100).default(80),
  defaultShareRate: z.coerce.number().min(0).max(100).default(30),
  dailyClaimLimit: z.coerce.number().int().min(0).max(10000).default(10),
  requirement: z.string().trim().max(1000).default("")
});

const authorizationPoolPatchSchema = z.object({
  status: authorizationPoolStatusSchema
});

const authorizationReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "paused", "banned", "expired"]),
  reviewNote: z.string().trim().max(1000).optional()
});

const distributionTaskSchema = z.object({
  title: nonEmptyString.max(180),
  ipName: nonEmptyString.max(120),
  platform: platformSchema,
  productName: nonEmptyString.max(180),
  materialIds: z.array(z.string().trim().min(1).max(120)).default([]),
  endAt: z.string().trim().max(80).optional(),
  rewardRule: z.string().trim().max(1000).default(""),
  claimLimit: z.coerce.number().int().min(0).max(100000).default(0),
  requirement: z.string().trim().max(1000).default("")
});

const distributionTaskPatchSchema = z.object({
  status: distributionTaskStatusSchema
});

const taskClaimSchema = z.object({
  distributorName: nonEmptyString.max(80).optional()
});

const taskClaimSubmitSchema = z.object({
  publishUrl: z.url().max(1000)
});

const walletTransactionSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  type: walletTransactionTypeSchema,
  amount: z.coerce.number().min(-999999999).max(999999999),
  status: walletTransactionStatusSchema,
  source: nonEmptyString.max(500),
  note: z.string().trim().max(1000).optional()
});

const riskEventSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  publishRecordId: z.string().uuid().optional(),
  taskClaimId: z.string().uuid().optional(),
  title: nonEmptyString.max(180),
  description: nonEmptyString.max(1000)
});

const riskActionSchema = z.object({
  actionType: nonEmptyString.max(80),
  note: z.string().trim().max(1000).optional(),
  status: z.string().trim().max(40).optional(),
  creditDelta: z.coerce.number().int().min(-100).max(100).optional(),
  freezeWallet: z.boolean().optional(),
  pauseAuthorization: z.boolean().optional()
});

const appealSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  riskEventId: z.string().uuid().optional(),
  reason: nonEmptyString.max(1000)
});

const systemSettingsPatchSchema = z.object({
  runtimeMode: z.enum(["mock", "hybrid", "real"]).optional(),
  commissionShare: z.coerce.number().min(0).max(100).optional(),
  dailyClaimLimit: z.coerce.number().int().min(0).max(10000).optional(),
  riskKeywords: z.union([z.array(z.string().trim().min(1).max(120)), z.string().trim().max(2000)]).optional()
});

const integrationProviderKeySchema = z.enum([
  "wechat_oauth",
  "douyin",
  "wechat_channels",
  "tencent_identity",
  "payment",
  "ffmpeg"
]);

const integrationConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  publicConfig: z.record(z.string(), z.unknown()).optional(),
  secrets: z.record(z.string(), z.string()).optional()
});

const reasonSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional()
});

const publishVerifySchema = z.object({
  result: z.enum(["verified", "invalid"]).default("verified"),
  reason: z.string().trim().max(1000).optional()
});

const publishBulkReviewSchema = z.object({
  ids: z.array(nonEmptyString.max(120)).min(1).max(100),
  result: z.enum(["verified", "invalid"]).default("verified"),
  reason: z.string().trim().max(1000).optional()
});

const performanceImportSchema = z.object({
  fileName: nonEmptyString.max(240).default("manual.json"),
  rows: z
    .array(
      z.object({
        publishRecordId: z.string().trim().min(1).max(120).optional(),
        publishUrl: z.url().max(1000).optional(),
        platform: platformSchema.optional(),
        gmv: z.coerce.number().min(0).max(999999999).default(0),
        commission: z.coerce.number().min(0).max(999999999).default(0)
      })
    )
    .min(1)
    .max(500)
});

const settlementPeriodSchema = z.object({
  period: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/)
    .default(() => new Date().toISOString().slice(0, 7))
});

const settlementDisputeSchema = z.object({
  reason: nonEmptyString.max(1000)
});

const appealReviewSchema = z.object({
  status: z.enum(["open", "resolved", "rejected"]),
  handledNote: z.string().trim().max(1000).optional()
});

const ffmpegJobSchema = z.object({
  clipTaskId: nonEmptyString.max(120),
  r2Key: nonEmptyString.max(500),
  outputPrefix: z.string().trim().max(500).optional()
});

const ffmpegJobPatchSchema = z.object({
  status: z.enum(["queued", "processing", "completed", "failed", "pending_external_config"]),
  message: z.string().trim().max(1000).optional()
});

const ffmpegWebhookSchema = z.object({
  jobId: nonEmptyString.max(120),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  message: z.string().trim().max(1000).optional()
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

function toTaskUiStatus(status: string | undefined): ClipTaskStatus {
  if (status === "running") return "processing";
  if (status === "succeeded") return "completed";
  if (status === "dead") return "failed";
  if (status === "processing" || status === "completed" || status === "failed") return status;
  return "queued";
}

function toTaskDbStatus(status: ClipTaskStatus) {
  if (status === "processing") return "running";
  if (status === "completed") return "succeeded";
  return status;
}

function isUsableProduct(product?: {
  is_active?: boolean | null;
  commission_rate?: number | string | null;
  affiliate_url?: string | null;
} | null) {
  const commissionRate = Number(product?.commission_rate ?? 0);
  return Boolean(
    product?.is_active &&
      product.affiliate_url &&
      /^https?:\/\//i.test(product.affiliate_url) &&
      commissionRate > 0 &&
      commissionRate <= 100
  );
}

function asOnboardingStatus(value: string | null | undefined): OnboardingStatus {
  if (
    value === "registered" ||
    value === "profile_pending" ||
    value === "account_pending" ||
    value === "training_pending" ||
    value === "exam_failed" ||
    value === "agreement_pending" ||
    value === "ready_for_authorization" ||
    value === "suspended" ||
    value === "banned"
  ) {
    return value;
  }
  return "registered";
}

async function findOrCreateDistributor(
  env: WorkerEnv,
  displayName: string,
  phone = "Pending binding",
  options: { userId?: string } = {}
) {
  if (options.userId) {
    const existingByUser = await selectRows<{ id: string }>(
      env,
      "distributor_profiles",
      `select=id&user_id=eq.${options.userId}&limit=1`
    );
    if (first(existingByUser)) return first(existingByUser);
  } else {
    const existing = await selectRows<{ id: string }>(
      env,
      "distributor_profiles",
      `select=id&${eq("display_name", displayName)}&limit=1`
    );
    if (first(existing)) return first(existing);
  }

  const userId = options.userId ?? crypto.randomUUID();
  try {
    return await insertRow<{ id: string }>(env, "distributor_profiles", {
      user_id: userId,
      display_name: displayName,
      phone,
      status: "approved",
      wechat_id: "",
      onboarding_status: "registered",
      credit_score: 100,
      exam_score: 0,
      agreement_signed: false
    });
  } catch {
    return insertRow<{ id: string }>(env, "distributor_profiles", {
      user_id: userId,
      display_name: displayName,
      phone,
      status: "approved"
    });
  }
}

async function findDistributorForSession(env: WorkerEnv, session: RequestSession | null) {
  if (!session || session.role !== "partner") return null;
  if (session.provider === "supabase" && session.userId) {
    return first(
      await safeRows(() =>
        selectRows<{ id: string }>(env, "distributor_profiles", `select=id&user_id=eq.${session.userId}&limit=1`)
      )
    );
  }

  if (session.provider === "better-auth" && session.userId) {
    const userId = session.userId;
    const profileLink = first(
      await safeRows(() =>
        selectRows<{ distributor_profile_id: string | null }>(
          env,
          "app_user_profiles",
          `select=distributor_profile_id&better_auth_user_id=eq.${encodeURIComponent(userId)}&limit=1`
        )
      )
    );
    if (profileLink?.distributor_profile_id) {
      return { id: profileLink.distributor_profile_id };
    }
  }

  return first(
    await safeRows(() =>
      selectRows<{ id: string }>(
        env,
        "distributor_profiles",
        `select=id&${eq("display_name", session.displayName)}&limit=1`
      )
    )
  );
}

async function linkBetterAuthUserProfile(env: WorkerEnv, session: RequestSession, distributorId: string) {
  if (session.provider !== "better-auth" || !session.userId) return;
  const body = {
    role: session.role,
    distributor_profile_id: distributorId,
    display_name: session.displayName,
    email: session.email ?? null,
    status: "active"
  };

  try {
    const existing = first(
      await selectRows<{ better_auth_user_id: string }>(
        env,
        "app_user_profiles",
        `select=better_auth_user_id&better_auth_user_id=eq.${encodeURIComponent(session.userId)}&limit=1`
      )
    );
    if (existing) {
      await patchRows(env, "app_user_profiles", `better_auth_user_id=eq.${encodeURIComponent(session.userId)}`, body);
      return;
    }
    await insertRow(env, "app_user_profiles", {
      better_auth_user_id: session.userId,
      ...body
    });
  } catch {
    // The mapping table is added by a new migration; local/demo data can still
    // fall back to display-name lookup before the migration is applied.
  }
}

async function findOrCreateDistributorForSession(
  env: WorkerEnv,
  session: RequestSession | null,
  fallbackName = DEFAULT_DISTRIBUTOR_NAME,
  phone = "Pending binding"
) {
  if (session?.role === "partner") {
    const distributor = await findOrCreateDistributor(env, session.displayName || fallbackName, phone, {
      userId: session.provider === "supabase" ? session.userId : undefined
    });
    await linkBetterAuthUserProfile(env, session, distributor.id);
    return distributor;
  }
  return findOrCreateDistributor(env, fallbackName, phone);
}

async function distributorFilterForSession(env: WorkerEnv, session: RequestSession | null) {
  const distributor = await findDistributorForSession(env, session);
  return distributor ? filterParam("distributor_id", "eq", distributor.id) : filterParam("distributor_id", "eq", "00000000-0000-0000-0000-000000000000");
}

async function taskClaimFilterForSession(env: WorkerEnv, claimId: string, session: RequestSession) {
  const distributor = await findDistributorForSession(env, session);
  if (!distributor) {
    throw new ApiError("not_found", "Task claim not found", 404);
  }
  return taskClaimOwnershipFilter(claimId, distributor.id);
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
    account_name: accountName,
    status: "approved"
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

async function createAuthorizationRequest(env: WorkerEnv, input: AuthorizationRequestInput, session?: RequestSession | null) {
  const distributor = await findOrCreateDistributorForSession(
    env,
    session ?? null,
    input.distributorName ?? DEFAULT_DISTRIBUTOR_NAME
  );
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

async function createAccountBinding(env: WorkerEnv, input: AccountBindingInput, session?: RequestSession | null) {
  const distributor = await findOrCreateDistributorForSession(
    env,
    session ?? null,
    input.distributorName ?? DEFAULT_DISTRIBUTOR_NAME
  );
  const body = {
    distributor_id: distributor.id,
    platform: toPlatformValue(input.platform),
    account_name: input.accountName,
    account_url: input.homepageUrl,
    followers: input.followers,
    category: input.category,
    status: "pending",
    binding_note: input.note ?? ""
  };

  try {
    await insertRow(env, "social_accounts", body);
  } catch {
    await insertRow(env, "social_accounts", {
      distributor_id: distributor.id,
      platform: toPlatformValue(input.platform),
      account_name: input.accountName,
      account_url: input.homepageUrl
    });
  }
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

async function createManualClipTask(env: WorkerEnv, input: ClipTaskInput) {
  const payload = {
    recordingTitle: input.recordingTitle,
    ipName: input.ipName,
    sourcePlatform: input.sourcePlatform
  };
  let taskId = crypto.randomUUID();
  try {
    const task = await insertRow<{ id: string }>(env, "clip_tasks", {
      type: "clip.create",
      dedupe_key: `manual:${taskId}`,
      payload,
      status: "queued"
    });
    taskId = task.id;
  } catch {
    // Older Supabase projects may not have clip_tasks yet; keep the action queueable.
  }
  await env.CLIP_TASK_QUEUE.send({
    type: "clip.create",
    taskId,
    meta: {
      title: input.recordingTitle,
      ipName: input.ipName,
      sourcePlatform: input.sourcePlatform
    },
    createdAt: new Date().toISOString()
  } satisfies ClipTaskPayload);
}

async function updateManualClipTask(env: WorkerEnv, id: string, status: ClipTaskStatus) {
  await patchRows(env, "clip_tasks", `id=eq.${id}`, {
    status: toTaskDbStatus(status),
    started_at: status === "processing" ? new Date().toISOString() : undefined,
    finished_at: status === "completed" || status === "failed" ? new Date().toISOString() : undefined,
    last_error: status === "failed" ? "模拟失败：等待重新处理。" : null,
    updated_at: new Date().toISOString()
  });
}

async function completeManualClipTask(env: WorkerEnv, id: string) {
  const rows = await selectRows<{
    id: string;
    status: string;
    payload: { recordingTitle?: string; ipName?: string; sourcePlatform?: string } | null;
  }>(env, "clip_tasks", `select=id,status,payload&id=eq.${id}&limit=1`);
  const task = first(rows);
  if (!task) throw new ApiError("not_found", "Clip task not found", 404);
  if (task.status === "succeeded") return;

  const recordingTitle = task.payload?.recordingTitle ?? "模拟录屏";
  const ipName = task.payload?.ipName ?? "晴姐穿搭";
  const sourcePlatform = task.payload?.sourcePlatform ?? WECHAT_CHANNELS_LABEL;
  const ip = await findOrCreateIp(env, ipName, sourcePlatform);

  await Promise.all(
    [1, 2, 3].map((index) =>
      insertRow(env, "clip_assets", {
        ip_account_id: ip.id,
        title: `${recordingTitle} - 模拟切片 ${index}`,
        status: "ready",
        tags: ["模拟切片", index === 2 ? "强卖点" : "待标注"],
        start_second: (index - 1) * 60,
        end_second: index * 60
      })
    )
  );

  await updateManualClipTask(env, id, "completed");
}

async function bindProductToMaterial(env: WorkerEnv, clipAssetId: string, productId: string) {
  await deleteByFilter(env, "clip_products", `clip_asset_id=eq.${clipAssetId}`);
  await insertRow(env, "clip_products", {
    clip_asset_id: clipAssetId,
    product_id: productId,
    is_primary: true
  });
}

async function claimMaterial(
  env: WorkerEnv,
  clipAssetId: string,
  distributorName = "Demo Distributor",
  session?: RequestSession | null
) {
  const clipRows = await selectRows<{
    id: string;
    title: string;
    ip_account_id: string;
    ip_accounts: { platform: PlatformValue } | null;
    clip_products: {
      product_id: string;
      products: { name: string; is_active: boolean; commission_rate: number | null; affiliate_url: string | null } | null;
    }[];
  }>(
    env,
    "clip_assets",
    `select=id,title,ip_account_id,ip_accounts(platform),clip_products(product_id,products(name,is_active,commission_rate,affiliate_url))&id=eq.${clipAssetId}&limit=1`
  );
  const clip = first(clipRows);
  if (!clip) throw new Error("Clip asset not found");

  const platform = platformToLabel[clip.ip_accounts?.platform ?? "wechat_channels"];
  const productBinding = clip.clip_products[0];
  const productId = productBinding?.product_id;
  if (!productId || !isUsableProduct(productBinding.products)) {
    throw new ApiError("invalid_product", "Clip asset must be bound to an active affiliate product before claiming", 422);
  }

  const distributor = await findOrCreateDistributorForSession(env, session ?? null, distributorName, "186****7108");
  const [authorizationRows, socialRows] = await Promise.all([
    selectRows<{ id: string }>(
      env,
      "authorization_requests",
      `select=id&distributor_id=eq.${distributor.id}&ip_account_id=eq.${clip.ip_account_id}&status=eq.approved&limit=1`
    ),
    selectRows<{ id: string }>(
      env,
      "social_accounts",
      `select=id&distributor_id=eq.${distributor.id}&platform=eq.${toPlatformValue(platform)}&status=eq.approved&limit=1`
    )
  ]);
  const social = first(socialRows);
  if (!first(authorizationRows) || !social) {
    throw new ApiError("forbidden", "Distributor must have an approved authorization and social account before claiming material", 403);
  }

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
  const rows = await selectRows<{
    status: PublishStatus;
    products: { is_active: boolean; commission_rate: number | null; affiliate_url: string | null } | null;
  }>(
    env,
    "publish_records",
    `select=status,products(is_active,commission_rate,affiliate_url)&id=eq.${publishRecordId}&limit=1`
  );
  const record = first(rows);
  if (!record) throw new ApiError("not_found", "Publish record not found", 404);
  if (!isUsableProduct(record.products)) {
    await patchRows(env, "publish_records", `id=eq.${publishRecordId}`, {
      status: "invalid",
      verification_note: "精选联盟商品无效或已停用，本条不进入结算。"
    });
  } else if (record.status !== "invalid") {
    await patchRows(env, "publish_records", `id=eq.${publishRecordId}`, {
      status: "verified",
      verified_at: new Date().toISOString()
    });
  }
  await insertRow(env, "performance_snapshots", {
    publish_record_id: publishRecordId,
    gmv,
    commission_amount: commission
  });
}

async function generateSettlement(env: WorkerEnv) {
  const settings = await loadSystemSettings(env);
  const shareRate = settings.commissionShare / 100;
  const records = await selectRows<{
    id: string;
    distributor_id: string;
    products: { is_active: boolean; commission_rate: number | null; affiliate_url: string | null } | null;
    performance_snapshots: { commission_amount: number }[];
  }>(
    env,
    "publish_records",
    "select=id,distributor_id,products(is_active,commission_rate,affiliate_url),performance_snapshots(commission_amount)&status=eq.verified"
  );

  const settleableRecords = records.filter((record) => isUsableProduct(record.products));
  const payable = settleableRecords.reduce((sum, record) => {
    const latest = record.performance_snapshots.at(-1);
    return sum + Number(latest?.commission_amount ?? 0) * shareRate;
  }, 0);

  const distributor = settleableRecords[0]?.distributor_id ?? (await findOrCreateDistributor(env, "Monthly settlement")).id;
  await insertRow(env, "settlement_orders", {
    distributor_id: distributor,
    period: new Date().toISOString().slice(0, 7),
    status: "pending",
    total_amount: payable
  });
}

async function listState(env: WorkerEnv) {
  async function readStateLists() {
    const [
      accountBindings,
      authorizationRequests,
      clipTasks,
      materials,
      products,
      publishRecords,
      settlements,
      riskRecords,
      distributorProfiles,
      authorizationPools,
      formalAuthorizations,
      distributionTasks,
      taskClaims,
      walletTransactions,
      notifications,
      trainingState
    ] = await Promise.all([
      listAccountBindings(env),
      listAuthorizationRequests(env),
      listClipTasks(env),
      listMaterials(env),
      listProducts(env),
      listPublishRecords(env),
      listSettlements(env),
      listRiskRecords(env),
      safeList(() => listDistributors(env)),
      safeList(() => listAuthorizationPools(env)),
      safeList(() => listFormalAuthorizations(env)),
      safeList(() => listDistributionTasks(env)),
      safeList(() => listTaskClaims(env)),
      safeList(() => listWalletTransactions(env)),
      safeList(() => listNotifications(env)),
      listTrainingState(env).catch(() => ({
        trainingCourses: [],
        examAttempts: [],
        agreementSignatures: [],
        creditScoreEvents: []
      }))
    ]);

    return {
      accountBindings: accountBindings.items,
      agreementSignatures: trainingState.agreementSignatures,
      authorizationPools: authorizationPools.items,
      authorizationRequests: authorizationRequests.items,
      creditScoreEvents: trainingState.creditScoreEvents,
      clipTasks: clipTasks.items,
      distributionTasks: distributionTasks.items,
      distributorProfiles: distributorProfiles.items,
      examAttempts: trainingState.examAttempts,
      formalAuthorizations: formalAuthorizations.items,
      materials: materials.items,
      notifications: notifications.items,
      products: products.items,
      publishRecords: publishRecords.items,
      settlements: settlements.items,
      riskRecords: riskRecords.items,
      taskClaims: taskClaims.items,
      trainingCourses: trainingState.trainingCourses,
      walletTransactions: walletTransactions.items
    };
  }

  let state = await readStateLists();

  if (
    state.authorizationRequests.length === 0 &&
    state.authorizationPools.length === 0 &&
    state.accountBindings.length === 0 &&
    state.clipTasks.length === 0 &&
    state.distributionTasks.length === 0 &&
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

async function listAccountBindings(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      platform: PlatformValue;
      account_name: string;
      account_url: string | null;
      followers: number | null;
      category: string | null;
      status: AccountBindingStatus | null;
      binding_note: string | null;
      created_at: string;
      distributor_profiles: { display_name: string } | null;
    }>(
      env,
      "social_accounts",
      buildListQuery(
        "select=id,platform,account_name,account_url,followers,category,status,binding_note,created_at,distributor_profiles(display_name)",
        "order=created_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["account_name", "category", "account_url"], options.q)
        ]
      )
    );

    const accountBindings = rows.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      platform: platformToLabel[row.platform],
      accountName: row.account_name,
      homepageUrl: row.account_url ?? "https://example.com/social-account",
      followers: Number(row.followers ?? 0),
      category: row.category ?? "未分类",
      status: row.status ?? "pending",
      boundAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
      note: row.binding_note ?? ""
    }));
    return { items: accountBindings, meta: listMeta(accountBindings, options) };
  } catch {
    const rows = await safeRows(() =>
      selectRows<{
        id: string;
        platform: PlatformValue;
        account_name: string;
        account_url: string | null;
        created_at: string;
        distributor_profiles: { display_name: string } | null;
      }>(
        env,
        "social_accounts",
        buildListQuery(
          "select=id,platform,account_name,account_url,created_at,distributor_profiles(display_name)",
          "order=created_at.desc",
          options,
          [options.platform ? filterParam("platform", "eq", options.platform) : undefined, searchQuery(["account_name", "account_url"], options.q)]
        )
      )
    );

    const accountBindings = rows.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      platform: platformToLabel[row.platform],
      accountName: row.account_name,
      homepageUrl: row.account_url ?? "https://example.com/social-account",
      followers: 0,
      category: "未分类",
      status: "pending" as AccountBindingStatus,
      boundAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
      note: "当前数据库尚未添加账号绑定扩展字段。"
    }));
    return { items: accountBindings, meta: listMeta(accountBindings, options) };
  }
}

async function listPartnerSocialAccounts(
  env: WorkerEnv,
  options = listOptions(new URLSearchParams()),
  session?: RequestSession | null
) {
  const distributorFilter = await distributorFilterForSession(env, session ?? null);
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      platform: PlatformValue;
      account_name: string;
      account_url: string | null;
      followers: number | null;
      category: string | null;
      status: AccountBindingStatus | null;
      binding_note: string | null;
      created_at: string;
      distributor_profiles: { display_name: string } | null;
    }>(
      env,
      "social_accounts",
      buildListQuery(
        "select=id,platform,account_name,account_url,followers,category,status,binding_note,created_at,distributor_profiles(display_name)",
        "order=created_at.desc",
        options,
        [
          distributorFilter,
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["account_name", "category", "account_url"], options.q)
        ]
      )
    )
  );

  const accountBindings = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    platform: platformToLabel[row.platform],
    accountName: row.account_name,
    homepageUrl: row.account_url ?? "https://example.com/social-account",
    followers: Number(row.followers ?? 0),
    category: row.category ?? "未分类",
    status: row.status ?? "pending",
    boundAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
    note: row.binding_note ?? ""
  }));

  return { items: accountBindings, meta: listMeta(accountBindings, options) };
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
    safeRows(() =>
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
      )
    ),
    safeRows(() => selectRows<{ clip_asset_id: string }>(env, "clip_claims", "select=clip_asset_id")),
    safeRows(() => selectRows<{ clip_asset_id: string }>(env, "clip_downloads", "select=clip_asset_id"))
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

async function listClipTasks(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  let rows: {
    id: string;
    type: string;
    payload: {
      meta?: RecordingUploadMeta;
      recordingTitle?: string;
      ipName?: string;
      sourcePlatform?: string;
    } | null;
    status: string;
    attempts: number | null;
    last_error: string | null;
    queued_at: string;
    finished_at: string | null;
  }[] = [];
  try {
    rows = await selectRows<typeof rows[number]>(
      env,
      "clip_tasks",
      buildListQuery(
        "select=id,type,payload,status,attempts,last_error,queued_at,finished_at",
        "order=queued_at.desc",
        options,
        [options.status ? filterParam("status", "eq", toTaskDbStatus(toTaskUiStatus(options.status))) : undefined]
      )
    );
  } catch {
    return { items: [], meta: listMeta([], options) };
  }

  const tasks = rows.map((row) => {
    const meta = row.payload?.meta;
    const status = toTaskUiStatus(row.status);
    return {
      id: row.id,
      recordingTitle: row.payload?.recordingTitle ?? meta?.title ?? "待处理录屏",
      ipName: row.payload?.ipName ?? meta?.ipName ?? "未知 IP",
      sourcePlatform: toPlatformLabel(row.payload?.sourcePlatform ?? meta?.sourcePlatform),
      status,
      progress: status === "completed" ? 100 : status === "processing" ? 60 : status === "failed" ? 35 : 0,
      outputCount: status === "completed" ? 3 : 0,
      errorMessage: row.last_error ?? "",
      createdAt: new Date(row.queued_at).toLocaleString("zh-CN", { hour12: false })
    };
  });

  return { items: tasks, meta: listMeta(tasks, options) };
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

async function listDistributors(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  let rows = await safeRows(() =>
    selectRows<{
      id: string;
      display_name: string;
      phone: string | null;
      wechat_id: string | null;
      onboarding_status: string | null;
      credit_score: number | null;
      exam_score: number | null;
      agreement_signed: boolean | null;
      created_at: string;
    }>(
      env,
      "distributor_profiles",
      buildListQuery(
        "select=id,display_name,phone,wechat_id,onboarding_status,credit_score,exam_score,agreement_signed,created_at",
        "order=created_at.desc",
        options,
        [searchQuery(["display_name", "phone", "wechat_id"], options.q)]
      )
    )
  );

  if (!rows.length) {
    rows = await safeRows(() =>
      selectRows<{
        id: string;
        display_name: string;
        phone: string | null;
        wechat_id: string | null;
        onboarding_status: string | null;
        credit_score: number | null;
        exam_score: number | null;
        agreement_signed: boolean | null;
        created_at: string;
      }>(
        env,
        "distributor_profiles",
        buildListQuery("select=id,display_name,phone,created_at", "order=created_at.desc", options, [
          searchQuery(["display_name", "phone"], options.q)
        ])
      )
    );
  }

  const distributorIds = rows.map((row) => row.id);
  const [accounts, authorizations, violations, walletTransactions] = distributorIds.length
    ? await Promise.all([
        safeRows(() =>
          selectRows<{ distributor_id: string }>(env, "social_accounts", `select=distributor_id&${inList("distributor_id", distributorIds)}`)
        ),
        safeRows(() =>
          selectRows<{ distributor_id: string }>(
            env,
            "authorizations",
            `select=distributor_id&${inList("distributor_id", distributorIds)}&status=eq.approved`
          )
        ),
        safeRows(() =>
          selectRows<{ distributor_id: string | null }>(
            env,
            "violation_records",
            `select=distributor_id&${inList("distributor_id", distributorIds)}`
          )
        ),
        safeRows(() =>
          selectRows<{ distributor_id: string; amount: number | string; status: WalletTransactionStatus }>(
            env,
            "wallet_transactions",
            `select=distributor_id,amount,status&${inList("distributor_id", distributorIds)}`
          )
        )
      ])
    : [[], [], [], []];

  const accountCounts = countBy(accounts, (item) => item.distributor_id);
  const authorizationCounts = countBy(authorizations, (item) => item.distributor_id);
  const violationCounts = countBy(violations, (item) => item.distributor_id);
  const payableByDistributor = new Map<string, number>();
  walletTransactions.forEach((transaction) => {
    if (transaction.status !== "available") return;
    payableByDistributor.set(
      transaction.distributor_id,
      (payableByDistributor.get(transaction.distributor_id) ?? 0) + Number(transaction.amount ?? 0)
    );
  });

  const items = rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    phone: row.phone ?? "",
    wechatId: row.wechat_id ?? "",
    onboardingStatus: asOnboardingStatus(row.onboarding_status),
    creditScore: Number(row.credit_score ?? 100),
    examScore: Number(row.exam_score ?? 0),
    agreementSigned: Boolean(row.agreement_signed),
    accountCount: accountCounts.get(row.id) ?? 0,
    authorizationCount: authorizationCounts.get(row.id) ?? 0,
    violationCount: violationCounts.get(row.id) ?? 0,
    payableCommission: payableByDistributor.get(row.id) ?? 0,
    createdAt: dateOnly(row.created_at)
  }));

  return { items, meta: listMeta(items, options) };
}

async function listAuthorizationPools(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      status: AuthorizationPoolStatus;
      total_quota: number;
      used_quota: number;
      min_credit_score: number;
      default_share_rate: number | string;
      daily_claim_limit: number;
      requirement: string | null;
      ip_accounts: { name: string; platform: PlatformValue } | null;
    }>(
      env,
      "authorization_pools",
      buildListQuery(
        "select=id,status,total_quota,used_quota,min_credit_score,default_share_rate,daily_claim_limit,requirement,ip_accounts(name,platform)",
        "order=created_at.desc",
        options,
        [options.status ? filterParam("status", "eq", options.status) : undefined]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    ipName: row.ip_accounts?.name ?? "Unknown IP",
    platform: platformToLabel[row.ip_accounts?.platform ?? "douyin"],
    status: row.status,
    totalQuota: Number(row.total_quota ?? 0),
    usedQuota: Number(row.used_quota ?? 0),
    minCreditScore: Number(row.min_credit_score ?? 80),
    defaultShareRate: Number(row.default_share_rate ?? 30),
    dailyClaimLimit: Number(row.daily_claim_limit ?? 10),
    requirement: row.requirement ?? ""
  }));
  return { items, meta: listMeta(items, options) };
}

async function listFormalAuthorizations(
  env: WorkerEnv,
  options = listOptions(new URLSearchParams()),
  session?: RequestSession | null
) {
  const distributorFilter = session?.role === "partner" ? await distributorFilterForSession(env, session) : undefined;
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      status: AuthorizationStatus;
      share_rate: number | string;
      daily_claim_limit: number | null;
      starts_at: string;
      expires_at: string | null;
      paused_reason: string | null;
      distributor_profiles: { display_name: string } | null;
      social_accounts: { account_name: string; platform: PlatformValue } | null;
      ip_accounts: { name: string; platform: PlatformValue } | null;
      agreement_signatures: { agreement_templates: { version: string } | null } | null;
    }>(
      env,
      "authorizations",
      buildListQuery(
        "select=id,status,share_rate,daily_claim_limit,starts_at,expires_at,paused_reason,distributor_profiles(display_name),social_accounts(account_name,platform),ip_accounts(name,platform),agreement_signatures(agreement_templates(version))",
        "order=created_at.desc",
        options,
        [options.status ? filterParam("status", "eq", options.status) : undefined, distributorFilter]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    socialAccount: row.social_accounts?.account_name ?? "Unknown account",
    ipName: row.ip_accounts?.name ?? "Unknown IP",
    platform: platformToLabel[row.social_accounts?.platform ?? row.ip_accounts?.platform ?? "douyin"],
    status: row.status,
    shareRate: Number(row.share_rate ?? 30),
    dailyClaimLimit: Number(row.daily_claim_limit ?? 10),
    startsAt: dateOnly(row.starts_at),
    expiresAt: dateOnly(row.expires_at),
    agreementVersion: row.agreement_signatures?.agreement_templates?.version ?? DEFAULT_AGREEMENT_VERSION,
    pausedReason: row.paused_reason ?? undefined
  }));
  return { items, meta: listMeta(items, options) };
}

async function listTrainingState(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const [courses, examAttempts, agreementSignatures, creditScoreEvents] = await Promise.all([
    safeRows(() =>
      selectRows<{
        id: string;
        title: string;
        lesson_count: number;
        estimated_minutes: number;
        is_required: boolean;
      }>(
        env,
        "training_courses",
        buildListQuery("select=id,title,lesson_count,estimated_minutes,is_required", "order=created_at.desc", options, [])
      )
    ),
    safeRows(() =>
      selectRows<{
        id: string;
        score: number;
        passed: boolean;
        attempted_at: string;
        distributor_profiles: { display_name: string } | null;
      }>(
        env,
        "exam_attempts",
        buildListQuery(
          "select=id,score,passed,attempted_at,distributor_profiles(display_name)",
          "order=attempted_at.desc",
          options,
          []
        )
      )
    ),
    safeRows(() =>
      selectRows<{
        id: string;
        signed_at: string;
        distributor_profiles: { display_name: string } | null;
        agreement_templates: { name: string; version: string } | null;
      }>(
        env,
        "agreement_signatures",
        buildListQuery(
          "select=id,signed_at,distributor_profiles(display_name),agreement_templates(name,version)",
          "order=signed_at.desc",
          options,
          []
        )
      )
    ),
    safeRows(() =>
      selectRows<{
        id: string;
        delta: number;
        reason: string;
        created_at: string;
        distributor_profiles: { display_name: string } | null;
      }>(
        env,
        "credit_score_events",
        buildListQuery("select=id,delta,reason,created_at,distributor_profiles(display_name)", "order=created_at.desc", options, [])
      )
    )
  ]);

  return {
    trainingCourses: courses.map((row) => ({
      id: row.id,
      title: row.title,
      lessonCount: Number(row.lesson_count ?? 0),
      estimatedMinutes: Number(row.estimated_minutes ?? 0),
      isRequired: Boolean(row.is_required)
    })),
    examAttempts: examAttempts.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      score: Number(row.score ?? 0),
      passed: Boolean(row.passed),
      attemptedAt: formatDateTime(row.attempted_at)
    })),
    agreementSignatures: agreementSignatures.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      templateName: row.agreement_templates?.name ?? DEFAULT_AGREEMENT_NAME,
      version: row.agreement_templates?.version ?? DEFAULT_AGREEMENT_VERSION,
      signedAt: formatDateTime(row.signed_at)
    })),
    creditScoreEvents: creditScoreEvents.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      delta: Number(row.delta ?? 0),
      reason: row.reason,
      createdAt: formatDateTime(row.created_at)
    }))
  };
}

async function listDistributionTasks(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      title: string;
      platform: PlatformValue;
      status: DistributionTaskStatus;
      start_at: string;
      end_at: string | null;
      reward_rule: string | null;
      claim_limit: number;
      claimed_count: number;
      published_count: number;
      requirement: string | null;
      ip_accounts: { name: string } | null;
      products: { name: string } | null;
      distribution_task_materials: { clip_asset_id: string }[];
    }>(
      env,
      "distribution_tasks",
      buildListQuery(
        "select=id,title,platform,status,start_at,end_at,reward_rule,claim_limit,claimed_count,published_count,requirement,ip_accounts(name),products(name),distribution_task_materials(clip_asset_id)",
        "order=created_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["title", "reward_rule", "requirement"], options.q)
        ]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    ipName: row.ip_accounts?.name ?? "Unknown IP",
    platform: platformToLabel[row.platform],
    materialIds: row.distribution_task_materials?.map((item) => item.clip_asset_id) ?? [],
    productName: row.products?.name ?? "Unknown product",
    status: row.status,
    startAt: dateOnly(row.start_at),
    endAt: row.end_at ? dateOnly(row.end_at) : "",
    rewardRule: row.reward_rule ?? "",
    claimLimit: Number(row.claim_limit ?? 0),
    claimedCount: Number(row.claimed_count ?? 0),
    publishedCount: Number(row.published_count ?? 0),
    requirement: row.requirement ?? ""
  }));
  return { items, meta: listMeta(items, options) };
}

async function listTaskClaims(env: WorkerEnv, options = listOptions(new URLSearchParams()), session?: RequestSession | null) {
  const distributorFilter = session?.role === "partner" ? await distributorFilterForSession(env, session) : undefined;
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      distribution_task_id: string;
      status: TaskClaimStatus;
      claim_token: string;
      submitted_url: string | null;
      claimed_at: string;
      distributor_profiles: { display_name: string } | null;
      social_accounts: { account_name: string; platform: PlatformValue } | null;
      clip_assets: { title: string } | null;
      products: { name: string } | null;
      download_tokens: { expires_at: string }[];
    }>(
      env,
      "task_claims",
      buildListQuery(
        "select=id,distribution_task_id,status,claim_token,submitted_url,claimed_at,distributor_profiles(display_name),social_accounts(account_name,platform),clip_assets(title),products(name),download_tokens(expires_at)",
        "order=claimed_at.desc",
        options,
        [options.status ? filterParam("status", "eq", options.status) : undefined, distributorFilter]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    taskId: row.distribution_task_id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    socialAccount: row.social_accounts?.account_name ?? "Unknown account",
    materialTitle: row.clip_assets?.title ?? "Unknown material",
    productName: row.products?.name ?? "Unknown product",
    platform: platformToLabel[row.social_accounts?.platform ?? "douyin"],
    status: row.status,
    claimToken: row.claim_token,
    downloadExpiresAt: formatDateTime(row.download_tokens?.[0]?.expires_at),
    claimedAt: formatDateTime(row.claimed_at),
    submittedUrl: row.submitted_url ?? undefined
  }));
  return { items, meta: listMeta(items, options) };
}

async function listWalletTransactions(
  env: WorkerEnv,
  options = listOptions(new URLSearchParams()),
  session?: RequestSession | null
) {
  const distributorFilter = session?.role === "partner" ? await distributorFilterForSession(env, session) : undefined;
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      type: WalletTransactionType;
      amount: number | string;
      status: WalletTransactionStatus;
      source: string;
      note: string | null;
      created_at: string;
      distributor_profiles: { display_name: string } | null;
    }>(
      env,
      "wallet_transactions",
      buildListQuery(
        "select=id,type,amount,status,source,note,created_at,distributor_profiles(display_name)",
        "order=created_at.desc",
        options,
        [options.status ? filterParam("status", "eq", options.status) : undefined, distributorFilter]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    type: row.type,
    amount: Number(row.amount ?? 0),
    status: row.status,
    source: row.source,
    note: row.note ?? "",
    createdAt: formatDateTime(row.created_at)
  }));
  return { items, meta: listMeta(items, options) };
}

async function listNotifications(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      audience: "all" | "admin" | "partner";
      title: string;
      content: string;
      created_at: string;
    }>(
      env,
      "notifications",
      buildListQuery("select=id,audience,title,content,created_at", "order=created_at.desc", options, [])
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    audience: row.audience,
    title: row.title,
    content: row.content,
    createdAt: formatDateTime(row.created_at),
    isRead: false
  }));
  return { items, meta: listMeta(items, options) };
}

async function partnerWalletResponse(env: WorkerEnv, options = listOptions(new URLSearchParams()), session?: RequestSession | null) {
  const { items, meta } = await listWalletTransactions(env, options, session);
  const wallet = items.reduce(
    (summary, transaction) => {
      if (transaction.status === "available") summary.availableAmount += transaction.amount;
      if (transaction.status === "frozen") summary.frozenAmount += Math.abs(transaction.amount);
      if (transaction.status === "pending") summary.pendingAmount += transaction.amount;
      if (transaction.status === "paid") summary.paidAmount += transaction.amount;
      return summary;
    },
    { availableAmount: 0, frozenAmount: 0, pendingAmount: 0, paidAmount: 0 }
  );

  return { wallet, walletTransactions: items, meta };
}

async function getMe(env: WorkerEnv, request: Request) {
  const requestSession = await readRequestSession(env, request);
  const session = mockSession(requestSession ?? undefined);
  const distributorName = session.distributor?.displayName ?? DEFAULT_DISTRIBUTOR_NAME;
  const linkedDistributor =
    requestSession?.provider === "better-auth" ? await findDistributorForSession(env, requestSession) : null;
  const profileFilter =
    linkedDistributor?.id
      ? `id=eq.${linkedDistributor.id}`
      : requestSession?.provider === "supabase" && requestSession.userId
      ? `user_id=eq.${requestSession.userId}`
      : eq("display_name", distributorName);
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      display_name: string;
      onboarding_status: string | null;
      credit_score: number | null;
    }>(
      env,
      "distributor_profiles",
      `select=id,display_name,onboarding_status,credit_score&${profileFilter}&limit=1`
    )
  );
  const profile = first(rows);

  return {
    ...session,
    distributor: profile
      ? {
          id: profile.id,
          displayName: profile.display_name,
          onboardingStatus: asOnboardingStatus(profile.onboarding_status),
          creditScore: Number(profile.credit_score ?? 100)
        }
      : session.distributor,
    providers: {
      authProvider: requestSession?.provider ?? "mock",
      videoProvider: "mock",
      platformDataProvider: "mock",
      paymentProvider: "manual",
      supabase: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
    }
  };
}

async function upsertPartnerProfile(env: WorkerEnv, input: z.infer<typeof partnerProfileSchema>, session: RequestSession) {
  const displayName = input.displayName ?? session.displayName ?? input.distributorName ?? DEFAULT_DISTRIBUTOR_NAME;
  const distributor = await findOrCreateDistributorForSession(env, session, displayName, input.phone || "Pending binding");
  await patchRows(env, "distributor_profiles", `id=eq.${distributor.id}`, {
    display_name: displayName,
    phone: input.phone,
    wechat_id: input.wechatId,
    onboarding_status: input.onboardingStatus ?? "account_pending",
    updated_at: new Date().toISOString()
  });
}

async function recordPartnerExamAttempt(env: WorkerEnv, input: z.infer<typeof examAttemptSchema>, session: RequestSession) {
  const distributor = await findOrCreateDistributorForSession(env, session, input.distributorName ?? DEFAULT_DISTRIBUTOR_NAME, "186****7108");
  const passed = input.score >= 80;
  await insertRow(env, "exam_attempts", {
    distributor_id: distributor.id,
    score: input.score,
    passed,
    answers: input.answers ?? {}
  });
  await patchRows(env, "distributor_profiles", `id=eq.${distributor.id}`, {
    exam_score: input.score,
    onboarding_status: passed ? "agreement_pending" : "exam_failed",
    updated_at: new Date().toISOString()
  });
}

async function findOrCreateAgreementTemplate(env: WorkerEnv, name: string, version: string) {
  const existing = await selectRows<{ id: string }>(
    env,
    "agreement_templates",
    `select=id&${eq("name", name)}&${eq("version", version)}&limit=1`
  );
  if (first(existing)) return first(existing);

  return insertRow<{ id: string }>(env, "agreement_templates", {
    name,
    version,
    body: `${name} ${version}`,
    is_active: true
  });
}

async function signPartnerAgreement(env: WorkerEnv, input: z.infer<typeof agreementSignSchema>, request: Request, session: RequestSession) {
  const distributor = await findOrCreateDistributorForSession(env, session, input.distributorName ?? DEFAULT_DISTRIBUTOR_NAME, "186****7108");
  const template = await findOrCreateAgreementTemplate(
    env,
    input.templateName ?? DEFAULT_AGREEMENT_NAME,
    input.version ?? DEFAULT_AGREEMENT_VERSION
  );
  await insertRow(env, "agreement_signatures", {
    distributor_id: distributor.id,
    template_id: template.id,
    signer_ip: request.headers.get("cf-connecting-ip") ?? "",
    signer_user_agent: request.headers.get("user-agent") ?? ""
  });
  await patchRows(env, "distributor_profiles", `id=eq.${distributor.id}`, {
    agreement_signed: true,
    onboarding_status: "ready_for_authorization",
    updated_at: new Date().toISOString()
  });
}

async function createAuthorizationPool(env: WorkerEnv, input: z.infer<typeof authorizationPoolSchema>) {
  const ip = await findOrCreateIp(env, input.ipName, input.platform);
  await insertRow(env, "authorization_pools", {
    ip_account_id: ip.id,
    status: "open",
    total_quota: input.totalQuota,
    used_quota: 0,
    min_credit_score: input.minCreditScore,
    default_share_rate: input.defaultShareRate,
    daily_claim_limit: input.dailyClaimLimit,
    requirement: input.requirement
  });
}

async function updateAuthorizationPool(env: WorkerEnv, id: string, input: z.infer<typeof authorizationPoolPatchSchema>) {
  await patchRows(env, "authorization_pools", `id=eq.${id}`, { status: input.status });
}

async function reviewAuthorizationRequest(env: WorkerEnv, requestId: string, input: z.infer<typeof authorizationReviewSchema>) {
  const rows = await selectRows<{
    id: string;
    distributor_id: string;
    ip_account_id: string;
    social_account_id: string | null;
  }>(env, "authorization_requests", `select=id,distributor_id,ip_account_id,social_account_id&id=eq.${requestId}&limit=1`);
  const request = first(rows);
  if (!request) throw new ApiError("not_found", "Authorization request not found", 404);

  await patchRows(env, "authorization_requests", `id=eq.${requestId}`, {
    status: input.status,
    review_note: input.reviewNote ?? "",
    reviewed_at: new Date().toISOString()
  });

  if (input.status !== "approved") return;

  const pools = await selectRows<{
    id: string;
    status: AuthorizationPoolStatus;
    total_quota: number;
    used_quota: number;
    default_share_rate: number | string;
    daily_claim_limit: number;
  }>(env, "authorization_pools", `select=id,status,total_quota,used_quota,default_share_rate,daily_claim_limit&ip_account_id=eq.${request.ip_account_id}&limit=1`);
  const pool = first(pools);
  if (pool && (pool.status !== "open" || (pool.total_quota > 0 && pool.used_quota >= pool.total_quota))) {
    throw new ApiError("authorization_pool_unavailable", "Authorization pool is paused or full", 409);
  }
  const settings = await loadSystemSettings(env);

  const existing = await selectRows<{ id: string }>(
    env,
    "authorizations",
    `select=id&distributor_id=eq.${request.distributor_id}&ip_account_id=eq.${request.ip_account_id}&limit=1`
  );
  let authorizationId = first(existing)?.id;
  if (authorizationId) {
    await patchRows(env, "authorizations", `id=eq.${authorizationId}`, {
      status: "approved",
      social_account_id: request.social_account_id,
      authorization_pool_id: pool?.id,
      daily_claim_limit: pool?.daily_claim_limit ?? settings.dailyClaimLimit,
      share_rate: pool?.default_share_rate ?? 30,
      paused_reason: null
    });
  } else {
    const authorization = await insertRow<{ id: string }>(env, "authorizations", {
      distributor_id: request.distributor_id,
      ip_account_id: request.ip_account_id,
      social_account_id: request.social_account_id,
      authorization_pool_id: pool?.id,
      status: "approved",
      share_rate: pool?.default_share_rate ?? 30,
      daily_claim_limit: pool?.daily_claim_limit ?? settings.dailyClaimLimit,
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    });
    authorizationId = authorization.id;
    if (pool) {
      await patchRows(env, "authorization_pools", `id=eq.${pool.id}`, { used_quota: pool.used_quota + 1 });
    }
  }

  if (authorizationId) {
    await insertRow(env, "authorization_events", {
      authorization_id: authorizationId,
      event_type: "approved",
      note: input.reviewNote ?? "Approved from authorization request"
    }).catch(() => undefined);
  }
}

async function createDistributionTask(env: WorkerEnv, input: z.infer<typeof distributionTaskSchema>) {
  const ip = await findOrCreateIp(env, input.ipName, input.platform);
  const product = await findOrCreateProduct(env, input.productName, input.platform);
  const task = await insertRow<{ id: string }>(env, "distribution_tasks", {
    title: input.title,
    ip_account_id: ip.id,
    platform: toPlatformValue(input.platform),
    product_id: product.id,
    status: "open",
    end_at: input.endAt ? new Date(input.endAt).toISOString() : null,
    reward_rule: input.rewardRule,
    claim_limit: input.claimLimit,
    requirement: input.requirement
  });

  await Promise.all(
    input.materialIds
      .filter((id) => isUuid(id))
      .map((clipAssetId) =>
        insertRow(env, "distribution_task_materials", {
          distribution_task_id: task.id,
          clip_asset_id: clipAssetId
        }).catch(() => undefined)
      )
  );
}

async function updateDistributionTask(env: WorkerEnv, id: string, input: z.infer<typeof distributionTaskPatchSchema>) {
  await patchRows(env, "distribution_tasks", `id=eq.${id}`, { status: input.status });
}

async function claimDistributionTask(
  env: WorkerEnv,
  taskId: string,
  input: z.infer<typeof taskClaimSchema>,
  request: Request,
  session: RequestSession
) {
  const taskRows = await selectRows<{
    id: string;
    title: string;
    ip_account_id: string;
    platform: PlatformValue;
    product_id: string;
    status: DistributionTaskStatus;
    claim_limit: number;
    claimed_count: number;
  }>(
    env,
    "distribution_tasks",
    `select=id,title,ip_account_id,platform,product_id,status,claim_limit,claimed_count&id=eq.${taskId}&limit=1`
  );
  const task = first(taskRows);
  if (!task) throw new ApiError("not_found", "Distribution task not found", 404);
  if (task.status !== "open") throw new ApiError("task_closed", "Distribution task is not open", 409);
  if (task.claim_limit > 0 && task.claimed_count >= task.claim_limit) {
    throw new ApiError("task_full", "Distribution task claim limit has been reached", 409);
  }

  const product = first(
    await selectRows<{
      id: string;
      name: string;
      is_active: boolean;
      commission_rate: number | null;
      affiliate_url: string | null;
    }>(env, "products", `select=id,name,is_active,commission_rate,affiliate_url&id=eq.${task.product_id}&limit=1`)
  );
  if (!isUsableProduct(product)) throw new ApiError("product_disabled", "Product is disabled or invalid", 422);

  const distributor = await findOrCreateDistributorForSession(env, session, input.distributorName ?? DEFAULT_DISTRIBUTOR_NAME, "186****7108");
  const profile = first(
    await selectRows<{
      id: string;
      credit_score: number | null;
      onboarding_status: string | null;
    }>(
      env,
      "distributor_profiles",
      `select=id,credit_score,onboarding_status&id=eq.${distributor.id}&limit=1`
    )
  );
  const creditScore = Number(profile?.credit_score ?? 100);
  const onboardingStatus = asOnboardingStatus(profile?.onboarding_status);
  if (creditScore < 60) throw new ApiError("credit_score_low", "Credit score is lower than the claiming threshold", 403);
  if (onboardingStatus !== "ready_for_authorization") {
    throw new ApiError("onboarding_incomplete", "Distributor onboarding is not complete", 403);
  }

  const authorization = first(
    await selectRows<{
      id: string;
      expires_at: string | null;
      daily_claim_limit: number | null;
    }>(
      env,
      "authorizations",
      `select=id,expires_at,daily_claim_limit&distributor_id=eq.${distributor.id}&ip_account_id=eq.${task.ip_account_id}&status=eq.approved&limit=1`
    )
  );
  if (!authorization) throw new ApiError("authorization_missing", "Distributor has no active authorization for this IP", 403);
  if (authorization.expires_at && new Date(authorization.expires_at).getTime() < Date.now()) {
    throw new ApiError("authorization_expired", "Authorization has expired", 403);
  }

  const social = first(
    await selectRows<{ id: string; account_name: string }>(
      env,
      "social_accounts",
      `select=id,account_name&distributor_id=eq.${distributor.id}&platform=eq.${task.platform}&status=eq.approved&limit=1`
    )
  );
  if (!social) throw new ApiError("account_not_approved", "Distributor has no approved social account for this platform", 403);

  const today = new Date().toISOString().slice(0, 10);
  const todayClaims = await safeRows(() =>
    selectRows<{ id: string }>(
      env,
      "task_claims",
      `select=id&distributor_id=eq.${distributor.id}&claimed_at=gte.${encodeURIComponent(today)}`
    )
  );
  const settings = await loadSystemSettings(env);
  const dailyLimit = Number(authorization.daily_claim_limit ?? settings.dailyClaimLimit);
  if (dailyLimit > 0 && todayClaims.length >= dailyLimit) {
    throw new ApiError("daily_claim_limit_reached", "Daily claim limit has been reached", 409);
  }

  const materialLinks = await selectRows<{ clip_asset_id: string }>(
    env,
    "distribution_task_materials",
    `select=clip_asset_id&distribution_task_id=eq.${task.id}`
  );
  if (!materialLinks.length) throw new ApiError("task_material_missing", "Distribution task has no material", 422);
  const clips = await selectRows<{ id: string; title: string; status: MaterialStatus }>(
    env,
    "clip_assets",
    `select=id,title,status&${inList(
      "id",
      materialLinks.map((item) => item.clip_asset_id)
    )}`
  );
  const clip = clips.find((item) => item.status === "published" || item.status === "ready");
  if (!clip) throw new ApiError("material_not_publishable", "No ready material is available for this task", 422);

  const claimToken = `CP-${crypto.randomUUID()}`;
  const taskClaim = await insertRow<{ id: string }>(env, "task_claims", {
    distribution_task_id: task.id,
    distributor_id: distributor.id,
    authorization_id: authorization.id,
    social_account_id: social.id,
    clip_asset_id: clip.id,
    product_id: task.product_id,
    status: "downloaded",
    claim_token: claimToken
  });
  const expiresAt = nextExpiry(30);
  await insertRow(env, "download_tokens", {
    task_claim_id: taskClaim.id,
    token: crypto.randomUUID(),
    expires_at: expiresAt,
    requester_ip: request.headers.get("cf-connecting-ip") ?? "",
    requester_user_agent: request.headers.get("user-agent") ?? ""
  });

  const legacyClaim = await insertRow<{ id: string }>(env, "clip_claims", {
    distributor_id: distributor.id,
    clip_asset_id: clip.id,
    product_id: task.product_id,
    social_account_id: social.id,
    planned_platform: task.platform
  });
  await insertRow(env, "clip_downloads", {
    claim_id: legacyClaim.id,
    distributor_id: distributor.id,
    clip_asset_id: clip.id,
    download_version: "watermarked"
  });
  await insertRow(env, "publish_records", {
    claim_id: legacyClaim.id,
    distributor_id: distributor.id,
    clip_asset_id: clip.id,
    product_id: task.product_id,
    platform: task.platform,
    publish_url: "pending",
    status: "downloaded"
  });
  await patchRows(env, "distribution_tasks", `id=eq.${task.id}`, {
    claimed_count: task.claimed_count + 1
  });
}

async function createClaimDownloadUrl(env: WorkerEnv, claimId: string, request: Request, session: RequestSession) {
  const claimFilter = await taskClaimFilterForSession(env, claimId, session);
  const claim = first(await selectRows<{ id: string }>(env, "task_claims", `select=id&${claimFilter}&limit=1`));
  if (!claim) throw new ApiError("not_found", "Task claim not found", 404);
  const token = await insertRow<{ token: string; expires_at: string }>(env, "download_tokens", {
    task_claim_id: claim.id,
    token: crypto.randomUUID(),
    expires_at: nextExpiry(30),
    requester_ip: request.headers.get("cf-connecting-ip") ?? "",
    requester_user_agent: request.headers.get("user-agent") ?? ""
  });
  await patchRows(env, "task_claims", `id=eq.${claim.id}`, {
    status: "downloaded",
    updated_at: new Date().toISOString()
  });
  return {
    token: token.token,
    expiresAt: token.expires_at,
    downloadUrl: `/claims/${claim.id}/download?token=${encodeURIComponent(token.token)}`
  };
}

async function submitTaskClaim(env: WorkerEnv, claimId: string, input: z.infer<typeof taskClaimSubmitSchema>, session: RequestSession) {
  const claimFilter = await taskClaimFilterForSession(env, claimId, session);
  const claim = first(
    await selectRows<{
      id: string;
      distribution_task_id: string;
      distributor_id: string;
      clip_asset_id: string;
      product_id: string;
    }>(
      env,
      "task_claims",
      `select=id,distribution_task_id,distributor_id,clip_asset_id,product_id&${claimFilter}&limit=1`
    )
  );
  if (!claim) throw new ApiError("not_found", "Task claim not found", 404);

  await patchRows(env, "task_claims", `id=eq.${claim.id}`, {
    status: "submitted",
    submitted_url: input.publishUrl,
    updated_at: new Date().toISOString()
  });
  await patchRows(
    env,
    "publish_records",
    `distributor_id=eq.${claim.distributor_id}&clip_asset_id=eq.${claim.clip_asset_id}&product_id=eq.${claim.product_id}&status=eq.downloaded`,
    {
      status: "submitted",
      submitted_at: new Date().toISOString(),
      publish_url: input.publishUrl,
      verification_note: "Submitted from distribution task claim"
    }
  );
  const taskRows = await selectRows<{ published_count: number }>(
    env,
    "distribution_tasks",
    `select=published_count&id=eq.${claim.distribution_task_id}&limit=1`
  );
  const task = first(taskRows);
  if (task) {
    await patchRows(env, "distribution_tasks", `id=eq.${claim.distribution_task_id}`, {
      published_count: Number(task.published_count ?? 0) + 1
    });
  }
}

async function createWalletTransaction(env: WorkerEnv, input: z.infer<typeof walletTransactionSchema>, session: RequestSession) {
  const distributor = await findOrCreateDistributorForSession(env, session, input.distributorName ?? DEFAULT_DISTRIBUTOR_NAME, "186****7108");
  await insertRow(env, "wallet_transactions", {
    distributor_id: distributor.id,
    type: input.type,
    amount: input.amount,
    status: input.status,
    source: input.source,
    note: input.note ?? ""
  });
}

async function createRiskEvent(env: WorkerEnv, input: z.infer<typeof riskEventSchema>) {
  const distributor = input.distributorName
    ? await findOrCreateDistributor(env, input.distributorName, "Pending binding")
    : undefined;
  await insertRow(env, "risk_events", {
    distributor_id: distributor?.id,
    publish_record_id: input.publishRecordId,
    task_claim_id: input.taskClaimId,
    title: input.title,
    description: input.description,
    status: "open"
  });
}

async function applyRiskAction(env: WorkerEnv, riskEventId: string, input: z.infer<typeof riskActionSchema>) {
  const risk = first(
    await selectRows<{
      id: string;
      distributor_id: string | null;
      title: string;
      description: string;
    }>(env, "risk_events", `select=id,distributor_id,title,description&id=eq.${riskEventId}&limit=1`)
  );
  if (!risk) throw new ApiError("not_found", "Risk event not found", 404);

  await insertRow(env, "risk_actions", {
    risk_event_id: risk.id,
    action_type: input.actionType,
    note: input.note ?? ""
  });
  await patchRows(env, "risk_events", `id=eq.${risk.id}`, {
    status: input.status ?? (input.actionType === "resolve" ? "resolved" : "blocked")
  });

  if (!risk.distributor_id) return;

  const creditDelta =
    input.creditDelta ??
    (input.actionType.includes("leak") ? -50 : input.actionType.includes("wrong_product") ? -10 : input.actionType.includes("freeze") ? -30 : 0);
  if (creditDelta !== 0) {
    const profile = first(
      await selectRows<{ credit_score: number | null }>(
        env,
        "distributor_profiles",
        `select=credit_score&id=eq.${risk.distributor_id}&limit=1`
      )
    );
    const nextCredit = Math.max(0, Math.min(100, Number(profile?.credit_score ?? 100) + creditDelta));
    await insertRow(env, "credit_score_events", {
      distributor_id: risk.distributor_id,
      delta: creditDelta,
      reason: input.note ?? risk.title
    });
    await patchRows(env, "distributor_profiles", `id=eq.${risk.distributor_id}`, {
      credit_score: nextCredit,
      onboarding_status: nextCredit < 60 ? "suspended" : undefined,
      updated_at: new Date().toISOString()
    });
  }

  if (input.freezeWallet || input.actionType.includes("freeze")) {
    await insertRow(env, "wallet_transactions", {
      distributor_id: risk.distributor_id,
      type: "freeze",
      amount: 0,
      status: "frozen",
      source: risk.title,
      note: input.note ?? risk.description
    });
    await patchRows(env, "settlement_orders", `distributor_id=eq.${risk.distributor_id}&status=neq.paid`, { status: "blocked" }).catch(
      () => undefined
    );
  }

  if (input.pauseAuthorization || input.actionType.includes("pause_authorization")) {
    await patchRows(env, "authorizations", `distributor_id=eq.${risk.distributor_id}&status=eq.approved`, {
      status: "paused",
      paused_reason: input.note ?? risk.title
    });
  }
}

async function createAppeal(env: WorkerEnv, input: z.infer<typeof appealSchema>, session: RequestSession) {
  const distributor = await findOrCreateDistributorForSession(env, session, input.distributorName ?? DEFAULT_DISTRIBUTOR_NAME, "186****7108");
  await insertRow(env, "appeals", {
    distributor_id: distributor.id,
    risk_event_id: input.riskEventId,
    reason: input.reason,
    status: "open"
  });
}

async function listPartnerAuthorizationRequests(
  env: WorkerEnv,
  options = listOptions(new URLSearchParams()),
  session?: RequestSession | null
) {
  const distributorFilter = await distributorFilterForSession(env, session ?? null);
  const rows = await safeRows(() =>
    selectRows<{
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
        [
          distributorFilter,
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("social_accounts.platform", "eq", options.platform) : undefined,
          searchQuery(["application_note"], options.q)
        ]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    phone: row.distributor_profiles?.phone ?? "Pending phone",
    socialAccount: row.social_accounts?.account_name ?? "Pending account",
    platform: platformToLabel[row.social_accounts?.platform ?? "douyin"],
    ipName: row.ip_accounts?.name ?? "Unknown IP",
    status: row.status,
    appliedAt: formatDateTime(row.created_at),
    reason: row.application_note ?? ""
  }));

  return { items, meta: listMeta(items, options) };
}

async function updateAuthorizationLifecycle(env: WorkerEnv, authorizationId: string, action: "pause" | "resume", note = "") {
  await patchRows(env, "authorizations", `id=eq.${authorizationId}`, {
    status: action === "pause" ? "paused" : "approved",
    paused_reason: action === "pause" ? note : null
  });
  await insertRow(env, "authorization_events", {
    authorization_id: authorizationId,
    event_type: action === "pause" ? "paused" : "resumed",
    note
  }).catch(() => undefined);
}

async function disableProduct(env: WorkerEnv, productId: string, note = "") {
  await patchRows(env, "products", `id=eq.${productId}`, { is_active: false });
  await insertRow(env, "audit_logs", {
    action: "product.disable",
    entity_type: "products",
    entity_id: productId,
    after_data: { is_active: false, note }
  }).catch(() => undefined);
}

async function productCommissionHistory(env: WorkerEnv, productId: string, options = listOptions(new URLSearchParams())) {
  const product = first(
    await safeRows(() =>
      selectRows<{
        id: string;
        name: string;
        platform: PlatformValue;
        commission_rate: number | string | null;
        is_active: boolean;
      }>(env, "products", `select=id,name,platform,commission_rate,is_active&id=eq.${productId}&limit=1`)
    )
  );
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      status: PublishStatus;
      publish_url: string;
      performance_snapshots: { gmv: number | string; commission_amount: number | string; captured_at: string }[];
    }>(
      env,
      "publish_records",
      buildListQuery(
        "select=id,status,publish_url,performance_snapshots(gmv,commission_amount,captured_at)",
        "order=submitted_at.desc",
        options,
        [filterParam("product_id", "eq", productId)]
      )
    )
  );
  const commissionHistory = rows.map((row) => {
    const latest = row.performance_snapshots?.at(-1);
    return {
      publishRecordId: row.id,
      status: row.status,
      publishUrl: row.publish_url,
      gmv: Number(latest?.gmv ?? 0),
      commission: Number(latest?.commission_amount ?? 0),
      capturedAt: latest?.captured_at ? formatDateTime(latest.captured_at) : null
    };
  });
  return { product, commissionHistory, meta: listMeta(commissionHistory, options) };
}

async function verifyPublishRecord(env: WorkerEnv, publishRecordId: string, input: z.infer<typeof publishVerifySchema>) {
  const records = await safeRows(() =>
    selectRows<{
      id: string;
      distributor_id: string | null;
      publish_url: string | null;
      products: { is_active: boolean; commission_rate: number | null; affiliate_url: string | null } | null;
    }>(
      env,
      "publish_records",
      `select=id,distributor_id,publish_url,products(is_active,commission_rate,affiliate_url)&id=eq.${publishRecordId}&limit=1`
    )
  );
  const record = first(records);
  if (!record) throw new ApiError("not_found", "Publish record not found", 404);
  const settings = await loadSystemSettings(env);
  const riskText = (record.publish_url ?? "").toLowerCase();
  const matchedRiskKeyword =
    settings.riskKeywords.find((keyword) => keyword.trim() && riskText.includes(keyword.trim().toLowerCase())) ??
    (/risk|violation|blocked/i.test(record.publish_url ?? "") ? "risk" : "");
  const hasRiskUrl = Boolean(matchedRiskKeyword);
  const isVerified = input.result === "verified" && !hasRiskUrl && isUsableProduct(record.products);
  const status: PublishStatus = isVerified ? "verified" : "invalid";
  const reason =
    input.reason ??
    (hasRiskUrl
      ? `Publish URL matched risk keyword: ${matchedRiskKeyword}`
      : isUsableProduct(record.products)
        ? "Manual verification"
        : "Product is disabled or invalid");

  await patchRows(env, "publish_records", `id=eq.${publishRecordId}`, {
    status,
    verified_at: status === "verified" ? new Date().toISOString() : null,
    verification_note: reason
  });
  await insertRow(env, "publish_verification_results", {
    publish_record_id: publishRecordId,
    result: status,
    reason
  }).catch(() => undefined);
  if (status === "invalid" && record.distributor_id) {
    await insertRow(env, "risk_events", {
      distributor_id: record.distributor_id,
      publish_record_id: publishRecordId,
      title: "Publish verification risk",
      description: reason,
      status: "open"
    }).catch(() => undefined);
  }
}

async function bulkReviewPublishRecords(env: WorkerEnv, input: z.infer<typeof publishBulkReviewSchema>) {
  for (const id of input.ids) {
    await verifyPublishRecord(env, id, { result: input.result, reason: input.reason });
  }
}

async function updateSettlementAction(env: WorkerEnv, settlementId: string, action: "confirm" | "pay", note = "") {
  const settlement = first(
    await safeRows(() =>
      selectRows<{ id: string; distributor_id: string; total_amount: number | string; status: SettlementStatus }>(
        env,
        "settlement_orders",
        `select=id,distributor_id,total_amount,status&id=eq.${settlementId}&limit=1`
      )
    )
  );
  if (!settlement) throw new ApiError("not_found", "Settlement not found", 404);

  const status: SettlementStatus = action === "confirm" ? "confirmed" : "paid";
  await patchRows(env, "settlement_orders", `id=eq.${settlementId}`, { status });
  if (action === "pay") {
    await insertRow(env, "payment_records", {
      settlement_order_id: settlement.id,
      distributor_id: settlement.distributor_id,
      amount: Number(settlement.total_amount ?? 0),
      status: "paid",
      payment_note: note,
      paid_at: new Date().toISOString()
    }).catch(() => undefined);
    await insertRow(env, "wallet_transactions", {
      distributor_id: settlement.distributor_id,
      type: "payout",
      amount: Number(settlement.total_amount ?? 0),
      status: "paid",
      source: settlement.id,
      note
    }).catch(() => undefined);
  }
}

async function generateSettlementPeriod(env: WorkerEnv, input: z.infer<typeof settlementPeriodSchema>) {
  await insertRow(env, "settlement_periods", {
    period: input.period,
    status: "calculating"
  }).catch(() => undefined);
  await generateSettlement(env);
  await patchRows(env, "settlement_periods", `period=eq.${input.period}`, { status: "completed" }).catch(() => undefined);
}

async function createSettlementDispute(env: WorkerEnv, settlementId: string, input: z.infer<typeof settlementDisputeSchema>, session: RequestSession) {
  const distributor = await findOrCreateDistributorForSession(env, session, DEFAULT_DISTRIBUTOR_NAME, "186****7108");
  await insertRow(env, "settlement_disputes", {
    settlement_order_id: settlementId,
    distributor_id: distributor.id,
    reason: input.reason,
    status: "open"
  });
}

async function reviewAppeal(env: WorkerEnv, appealId: string, input: z.infer<typeof appealReviewSchema>) {
  await patchRows(env, "appeals", `id=eq.${appealId}`, {
    status: input.status,
    handled_note: input.handledNote ?? ""
  });
}

async function listPerformanceImports(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      file_name: string;
      status: string;
      total_rows: number;
      matched_rows: number;
      error_rows: number;
      created_at: string;
    }>(
      env,
      "performance_import_batches",
      buildListQuery("select=id,file_name,status,total_rows,matched_rows,error_rows,created_at", "order=created_at.desc", options, [])
    )
  );
  const performanceImports = rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    status: row.status,
    totalRows: Number(row.total_rows ?? 0),
    matchedRows: Number(row.matched_rows ?? 0),
    errorRows: Number(row.error_rows ?? 0),
    createdAt: formatDateTime(row.created_at)
  }));
  return { items: performanceImports, meta: listMeta(performanceImports, options) };
}

async function getPerformanceImport(env: WorkerEnv, id: string) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      file_name: string;
      status: string;
      total_rows: number;
      matched_rows: number;
      error_rows: number;
      created_at: string;
    }>(env, "performance_import_batches", `select=id,file_name,status,total_rows,matched_rows,error_rows,created_at&id=eq.${id}&limit=1`)
  );
  const row = first(rows);
  if (!row) throw new ApiError("not_found", "Performance import not found", 404);
  return {
    id: row.id,
    fileName: row.file_name,
    status: row.status,
    totalRows: Number(row.total_rows ?? 0),
    matchedRows: Number(row.matched_rows ?? 0),
    errorRows: Number(row.error_rows ?? 0),
    createdAt: formatDateTime(row.created_at)
  };
}

async function listPerformanceImportErrors(env: WorkerEnv, batchId: string, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      error_code: string;
      error_message: string;
      created_at: string;
    }>(
      env,
      "performance_import_errors",
      buildListQuery("select=id,error_code,error_message,created_at", "order=created_at.desc", options, [filterParam("batch_id", "eq", batchId)])
    )
  );
  const errors = rows.map((row) => ({
    id: row.id,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: formatDateTime(row.created_at)
  }));
  return { items: errors, meta: listMeta(errors, options) };
}

async function createPerformanceImport(env: WorkerEnv, input: z.infer<typeof performanceImportSchema>) {
  const batch = await insertRow<{ id: string }>(env, "performance_import_batches", {
    file_name: input.fileName,
    status: "processing",
    total_rows: input.rows.length,
    matched_rows: 0,
    error_rows: 0
  });
  let matchedRows = 0;
  let errorRows = 0;

  for (const row of input.rows) {
    const publishRecord = row.publishRecordId
      ? { id: row.publishRecordId }
      : first(
          await safeRows(() =>
            selectRows<{ id: string }>(
              env,
              "publish_records",
              `select=id&${filterParam("publish_url", "eq", row.publishUrl ?? "missing")}&limit=1`
            )
          )
        );
    const importRow = await insertRow<{ id: string }>(env, "performance_import_rows", {
      batch_id: batch.id,
      publish_url: row.publishUrl ?? null,
      platform: row.platform ? toPlatformValue(row.platform) : null,
      gmv: row.gmv,
      commission_amount: row.commission,
      raw_row: row,
      matched_publish_record_id: publishRecord?.id ?? null
    });
    if (publishRecord?.id) {
      matchedRows += 1;
      await importPerformance(env, publishRecord.id, row.gmv, row.commission);
    } else {
      errorRows += 1;
      await insertRow(env, "performance_import_errors", {
        batch_id: batch.id,
        row_id: importRow.id,
        error_code: "unmatched_publish_record",
        error_message: "No publish record matched this row"
      }).catch(() => undefined);
    }
  }

  await patchRows(env, "performance_import_batches", `id=eq.${batch.id}`, {
    status: errorRows > 0 ? "completed_with_errors" : "completed",
    matched_rows: matchedRows,
    error_rows: errorRows
  });
  return batch.id;
}

async function markNotificationRead(env: WorkerEnv, notificationId: string, session?: RequestSession | null) {
  await insertRow(env, "notification_reads", {
    notification_id: notificationId,
    user_id: session?.provider === "supabase" && session.userId ? session.userId : MOCK_USER_ID
  }).catch(() => undefined);
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

async function readBody<T>(request: Request) {
  return request.json().catch(() => ({})) as Promise<T>;
}

function mockSession(session?: RequestSession) {
  const role = session?.role ?? "partner";
  const displayName = session?.displayName || (role === "partner" ? DEFAULT_DISTRIBUTOR_NAME : ROLE_LABELS[role]);
  const authProvider = session?.provider ?? "mock";
  const distributor =
    role === "partner"
      ? {
          id: "demo-distributor",
          displayName,
          onboardingStatus: "ready_for_authorization",
          creditScore: 96
        }
      : null;

  return {
    user: {
      id: session?.id ?? `user-${role}`,
      displayName,
      role,
      roleLabel: ROLE_LABELS[role]
    },
    distributor,
    providers: {
      authProvider,
      videoProvider: "mock",
      platformDataProvider: "mock",
      paymentProvider: "manual"
    }
  };
}

async function processClipQueuePayload(env: WorkerEnv, payload: Partial<ClipTaskPayload>) {
  if (payload.type === "cron.scan") {
    console.log(JSON.stringify({ level: "info", message: "clip queue cron scan received", createdAt: payload.createdAt }));
    return;
  }

  if (payload.type !== "clip.create" || !payload.taskId) {
    console.warn(JSON.stringify({ level: "warn", message: "unknown clip queue payload", payload }));
    return;
  }

  try {
    await updateManualClipTask(env, payload.taskId, "processing");
    await completeManualClipTask(env, payload.taskId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "not_found") {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "queued clip task is not persisted; skipping mock completion",
          taskId: payload.taskId
        })
      );
      return;
    }
    await updateManualClipTask(env, payload.taskId, "failed").catch(() => undefined);
    throw error;
  }
}

export async function handleApiRequest(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders(env) });
      }

      if (url.pathname === "/health") {
        return json({ service: "clip-partner-api", runtime: "cloudflare-workers", status: "ok" }, env);
      }

      if (url.pathname === "/integrations") {
        return json({ integrations: await integrationReadiness(env) }, env);
      }

      if (url.pathname === "/me") {
        return json(await getMe(env, request), env);
      }

      const requestSession = await authorizeRequest(request, env, url.pathname);

      if (url.pathname === "/admin/settings" && request.method === "GET") {
        return json({ settings: await loadSystemSettings(env) }, env);
      }

      if (url.pathname === "/admin/settings" && request.method === "PATCH") {
        const settings = await saveSystemSettings(env, await readJson(request, systemSettingsPatchSchema));
        return json({ settings }, env);
      }

      const adminIntegrationTestMatch = url.pathname.match(/^\/admin\/integrations\/([^/]+)\/test$/);
      if (adminIntegrationTestMatch && request.method === "POST") {
        const parsedKey = integrationProviderKeySchema.safeParse(adminIntegrationTestMatch[1]);
        if (!parsedKey.success) throw new ApiError("unknown_integration", "Unknown integration provider", 404);
        const result = await testIntegrationConfig(env, parsedKey.data);
        return json({ result }, env);
      }

      const adminIntegrationMatch = url.pathname.match(/^\/admin\/integrations\/([^/]+)$/);
      if (adminIntegrationMatch && request.method === "GET") {
        const parsedKey = integrationProviderKeySchema.safeParse(adminIntegrationMatch[1]);
        if (!parsedKey.success) throw new ApiError("unknown_integration", "Unknown integration provider", 404);
        return json({ integration: redactIntegrationConfig(await loadIntegrationConfig(env, parsedKey.data)) }, env);
      }

      if (adminIntegrationMatch && request.method === "PATCH") {
        const parsedKey = integrationProviderKeySchema.safeParse(adminIntegrationMatch[1]);
        if (!parsedKey.success) throw new ApiError("unknown_integration", "Unknown integration provider", 404);
        const integration = await saveIntegrationConfig(
          env,
          parsedKey.data as IntegrationProviderKey,
          await readJson(request, integrationConfigPatchSchema)
        );
        return json({ integration }, env);
      }

      if (url.pathname === "/admin/distributors" && request.method === "GET") {
        const { items, meta } = await listDistributors(env, listOptions(url.searchParams));
        return json({ distributorProfiles: items, meta }, env);
      }

      if (url.pathname === "/partner/profile" && request.method === "POST") {
        await upsertPartnerProfile(env, await readJson(request, partnerProfileSchema), requirePartnerSession(requestSession));
        return json(await listState(env), env);
      }

      if (url.pathname === "/partner/exam-attempts" && request.method === "POST") {
        await recordPartnerExamAttempt(env, await readJson(request, examAttemptSchema), requirePartnerSession(requestSession));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/partner/agreements/sign" && request.method === "POST") {
        await signPartnerAgreement(env, await readJson(request, agreementSignSchema), request, requirePartnerSession(requestSession));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/admin/training" && request.method === "GET") {
        return json(await listTrainingState(env, listOptions(url.searchParams)), env);
      }

      if (url.pathname === "/admin/authorization-pools" && request.method === "GET") {
        const { items, meta } = await listAuthorizationPools(env, listOptions(url.searchParams));
        return json({ authorizationPools: items, meta }, env);
      }

      if (url.pathname === "/partner/authorizations" && request.method === "GET") {
        const options = listOptions(url.searchParams);
        const [formalAuthorizations, authorizationPools] = await Promise.all([
          listFormalAuthorizations(env, options, requestSession),
          listAuthorizationPools(env, options)
        ]);
        return json(
          {
            formalAuthorizations: formalAuthorizations.items,
            authorizationPools: authorizationPools.items,
            meta: formalAuthorizations.meta
          },
          env
        );
      }

      if (url.pathname === "/admin/authorization-pools" && request.method === "POST") {
        await createAuthorizationPool(env, await readJson(request, authorizationPoolSchema));
        return json(await listState(env), env, { status: 201 });
      }

      const adminAuthorizationPoolMatch = url.pathname.match(/^\/admin\/authorization-pools\/([^/]+)$/);
      if (adminAuthorizationPoolMatch && request.method === "PATCH") {
        await updateAuthorizationPool(env, adminAuthorizationPoolMatch[1], await readJson(request, authorizationPoolPatchSchema));
        return json(await listState(env), env);
      }

      const adminAuthorizationReviewMatch = url.pathname.match(/^\/admin\/authorization-requests\/([^/]+)\/review$/);
      if (adminAuthorizationReviewMatch && request.method === "PATCH") {
        await reviewAuthorizationRequest(
          env,
          adminAuthorizationReviewMatch[1],
          await readJson(request, authorizationReviewSchema)
        );
        return json(await listState(env), env);
      }

      if (url.pathname === "/admin/distribution-tasks" && request.method === "GET") {
        const { items, meta } = await listDistributionTasks(env, listOptions(url.searchParams));
        return json({ distributionTasks: items, meta }, env);
      }

      if (url.pathname === "/admin/distribution-tasks" && request.method === "POST") {
        await createDistributionTask(env, await readJson(request, distributionTaskSchema));
        return json(await listState(env), env, { status: 201 });
      }

      const adminDistributionTaskMatch = url.pathname.match(/^\/admin\/distribution-tasks\/([^/]+)$/);
      if (adminDistributionTaskMatch && request.method === "PATCH") {
        await updateDistributionTask(env, adminDistributionTaskMatch[1], await readJson(request, distributionTaskPatchSchema));
        return json(await listState(env), env);
      }

      if (url.pathname === "/partner/tasks" && request.method === "GET") {
        const options = listOptions(url.searchParams);
        const [distributionTasks, taskClaims] = await Promise.all([
          listDistributionTasks(env, { ...options, status: options.status ?? "open" }),
          listTaskClaims(env, options, requestSession)
        ]);
        return json({ distributionTasks: distributionTasks.items, taskClaims: taskClaims.items, meta: distributionTasks.meta }, env);
      }

      const partnerTaskClaimMatch = url.pathname.match(/^\/partner\/tasks\/([^/]+)\/claim$/);
      if (partnerTaskClaimMatch && request.method === "POST") {
        await claimDistributionTask(
          env,
          partnerTaskClaimMatch[1],
          await readJson(request, taskClaimSchema),
          request,
          requirePartnerSession(requestSession)
        );
        return json(await listState(env), env, { status: 201 });
      }

      const claimDownloadMatch = url.pathname.match(/^\/claims\/([^/]+)\/download-url$/);
      if (claimDownloadMatch && request.method === "POST") {
        const downloadToken = await createClaimDownloadUrl(env, claimDownloadMatch[1], request, requirePartnerSession(requestSession));
        return json({ ...(await listState(env)), downloadToken }, env, { status: 201 });
      }

      const claimSubmitMatch = url.pathname.match(/^\/claims\/([^/]+)\/submit$/);
      if (claimSubmitMatch && request.method === "POST") {
        await submitTaskClaim(env, claimSubmitMatch[1], await readJson(request, taskClaimSubmitSchema), requirePartnerSession(requestSession));
        return json(await listState(env), env);
      }

      if (url.pathname === "/partner/wallet" && request.method === "GET") {
        return json(await partnerWalletResponse(env, listOptions(url.searchParams), requestSession), env);
      }

      if (url.pathname === "/partner/wallet/transactions" && request.method === "POST") {
        await createWalletTransaction(env, await readJson(request, walletTransactionSchema), requirePartnerSession(requestSession));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/admin/risk-events" && request.method === "POST") {
        await createRiskEvent(env, await readJson(request, riskEventSchema));
        return json(await listState(env), env, { status: 201 });
      }

      const riskEventActionMatch = url.pathname.match(/^\/admin\/risk-events\/([^/]+)\/action$/);
      if (riskEventActionMatch && request.method === "PATCH") {
        await applyRiskAction(env, riskEventActionMatch[1], await readJson(request, riskActionSchema));
        return json(await listState(env), env);
      }

      if (url.pathname === "/partner/appeals" && request.method === "POST") {
        await createAppeal(env, await readJson(request, appealSchema), requirePartnerSession(requestSession));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/notifications" && request.method === "GET") {
        const { items, meta } = await listNotifications(env, listOptions(url.searchParams));
        return json({ notifications: items, meta }, env);
      }

      const notificationReadMatch = url.pathname.match(/^\/notifications\/([^/]+)\/read$/);
      if (notificationReadMatch && request.method === "POST") {
        await markNotificationRead(env, notificationReadMatch[1], requireSession(requestSession));
        return json(await listState(env), env);
      }

      if (url.pathname === "/partner/social-accounts" && request.method === "GET") {
        const { items, meta } = await listPartnerSocialAccounts(env, listOptions(url.searchParams), requirePartnerSession(requestSession));
        return json({ accountBindings: items, meta }, env);
      }

      if (url.pathname === "/partner/social-accounts" && request.method === "POST") {
        await createAccountBinding(env, await readJson(request, accountBindingSchema), requirePartnerSession(requestSession));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/partner/authorization-requests" && request.method === "GET") {
        const { items, meta } = await listPartnerAuthorizationRequests(
          env,
          listOptions(url.searchParams),
          requirePartnerSession(requestSession)
        );
        return json({ authorizationRequests: items, meta }, env);
      }

      if (url.pathname === "/partner/authorization-requests" && request.method === "POST") {
        await createAuthorizationRequest(env, await readJson(request, authorizationRequestSchema), requirePartnerSession(requestSession));
        return json(await listState(env), env, { status: 201 });
      }

      const adminAuthorizationLifecycleMatch = url.pathname.match(/^\/admin\/authorizations\/([^/]+)\/(pause|resume)$/);
      if (adminAuthorizationLifecycleMatch && request.method === "POST") {
        const body = await readJson(request, reasonSchema);
        await updateAuthorizationLifecycle(
          env,
          adminAuthorizationLifecycleMatch[1],
          adminAuthorizationLifecycleMatch[2] as "pause" | "resume",
          body.reason ?? body.note ?? ""
        );
        return json(await listState(env), env);
      }

      const adminProductDisableMatch = url.pathname.match(/^\/admin\/products\/([^/]+)\/disable$/);
      if (adminProductDisableMatch && request.method === "POST") {
        const body = await readJson(request, reasonSchema);
        await disableProduct(env, adminProductDisableMatch[1], body.reason ?? body.note ?? "");
        return json(await listState(env), env);
      }

      const adminProductCommissionMatch = url.pathname.match(/^\/admin\/products\/([^/]+)\/commission-history$/);
      if (adminProductCommissionMatch && request.method === "GET") {
        return json(await productCommissionHistory(env, adminProductCommissionMatch[1], listOptions(url.searchParams)), env);
      }

      const adminPublishVerifyMatch = url.pathname.match(/^\/admin\/publish-records\/([^/]+)\/verify$/);
      if (adminPublishVerifyMatch && request.method === "POST") {
        await verifyPublishRecord(env, adminPublishVerifyMatch[1], await readJson(request, publishVerifySchema));
        return json(await listState(env), env);
      }

      if (url.pathname === "/admin/publish-records/bulk-review" && request.method === "POST") {
        await bulkReviewPublishRecords(env, await readJson(request, publishBulkReviewSchema));
        return json(await listState(env), env);
      }

      if (url.pathname === "/admin/performance-imports" && request.method === "GET") {
        const { items, meta } = await listPerformanceImports(env, listOptions(url.searchParams));
        return json({ performanceImports: items, meta }, env);
      }

      if (url.pathname === "/admin/performance-imports" && request.method === "POST") {
        const importId = await createPerformanceImport(env, await readJson(request, performanceImportSchema));
        return json({ ...(await listState(env)), performanceImport: await getPerformanceImport(env, importId) }, env, { status: 201 });
      }

      const adminPerformanceImportMatch = url.pathname.match(/^\/admin\/performance-imports\/([^/]+)$/);
      if (adminPerformanceImportMatch && request.method === "GET") {
        return json({ performanceImport: await getPerformanceImport(env, adminPerformanceImportMatch[1]) }, env);
      }

      const adminPerformanceImportErrorsMatch = url.pathname.match(/^\/admin\/performance-imports\/([^/]+)\/errors$/);
      if (adminPerformanceImportErrorsMatch && request.method === "GET") {
        const { items, meta } = await listPerformanceImportErrors(env, adminPerformanceImportErrorsMatch[1], listOptions(url.searchParams));
        return json({ errors: items, meta }, env);
      }

      const adminSettlementActionMatch = url.pathname.match(/^\/admin\/settlements\/([^/]+)\/(confirm|pay)$/);
      if (adminSettlementActionMatch && request.method === "POST") {
        const body = await readJson(request, reasonSchema);
        await updateSettlementAction(
          env,
          adminSettlementActionMatch[1],
          adminSettlementActionMatch[2] as "confirm" | "pay",
          body.reason ?? body.note ?? ""
        );
        return json(await listState(env), env);
      }

      if (url.pathname === "/admin/settlement-periods/generate" && request.method === "POST") {
        await generateSettlementPeriod(env, await readJson(request, settlementPeriodSchema));
        return json(await listState(env), env, { status: 201 });
      }

      const partnerSettlementDisputeMatch = url.pathname.match(/^\/partner\/settlements\/([^/]+)\/dispute$/);
      if (partnerSettlementDisputeMatch && request.method === "POST") {
        await createSettlementDispute(
          env,
          partnerSettlementDisputeMatch[1],
          await readJson(request, settlementDisputeSchema),
          requirePartnerSession(requestSession)
        );
        return json(await listState(env), env, { status: 201 });
      }

      const adminAppealMatch = url.pathname.match(/^\/admin\/appeals\/([^/]+)$/);
      if (adminAppealMatch && request.method === "PATCH") {
        await reviewAppeal(env, adminAppealMatch[1], await readJson(request, appealReviewSchema));
        return json(await listState(env), env);
      }

      if (url.pathname === "/ffmpeg/jobs" && request.method === "GET") {
        const { items, meta } = await listFfmpegJobs(env, listOptions(url.searchParams));
        return json({ ffmpegJobs: items, meta }, env);
      }

      if (url.pathname === "/ffmpeg/jobs" && request.method === "POST") {
        const ffmpegJob = await createFfmpegJob(env, await readJson(request, ffmpegJobSchema));
        return json({ ffmpegJob }, env, { status: ffmpegJob.status === "pending_external_config" ? 202 : 201 });
      }

      const ffmpegJobMatch = url.pathname.match(/^\/ffmpeg\/jobs\/([^/]+)$/);
      if (ffmpegJobMatch && request.method === "GET") {
        return json({ ffmpegJob: await getFfmpegJob(env, ffmpegJobMatch[1]) }, env);
      }

      if (ffmpegJobMatch && request.method === "PATCH") {
        await updateFfmpegJob(env, ffmpegJobMatch[1], await readJson(request, ffmpegJobPatchSchema));
        return json({ ffmpegJob: await getFfmpegJob(env, ffmpegJobMatch[1]) }, env);
      }

      if (url.pathname === "/ffmpeg/webhook" && request.method === "POST") {
        const jobId = await handleFfmpegWebhook(env, bearerToken(request), await readJson(request, ffmpegWebhookSchema));
        return json({ accepted: true, jobId }, env, { status: 202 });
      }

      if (url.pathname === "/state" && request.method === "GET") {
        return json(await listState(env), env);
      }

      if (url.pathname === "/authorization-requests" && request.method === "GET") {
        const { items, meta } = await listAuthorizationRequests(env, listOptions(url.searchParams));
        return json({ authorizationRequests: items, meta }, env);
      }

      if (url.pathname === "/account-bindings" && request.method === "GET") {
        const { items, meta } = await listAccountBindings(env, listOptions(url.searchParams));
        return json({ accountBindings: items, meta }, env);
      }

      if (url.pathname === "/clip-tasks" && request.method === "GET") {
        const { items, meta } = await listClipTasks(env, listOptions(url.searchParams));
        return json({ clipTasks: items, meta }, env);
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
        await createAuthorizationRequest(env, await readJson(request, authorizationRequestSchema), requirePartnerSession(requestSession));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/account-bindings" && request.method === "POST") {
        await createAccountBinding(env, await readJson(request, accountBindingSchema), requirePartnerSession(requestSession));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/clip-tasks" && request.method === "POST") {
        await createManualClipTask(env, await readJson(request, clipTaskSchema));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/recordings/direct-upload/init" && request.method === "POST") {
        const upload = await createDirectUpload(env, await readJson(request, directUploadInitSchema));
        return json({ upload }, env, { status: 201 });
      }

      if (url.pathname === "/recordings/direct-upload/complete" && request.method === "POST") {
        const upload = await completeDirectUpload(env, await readJson(request, directUploadCompleteSchema), {
          findOrCreateIp,
          toPlatformValue
        });
        ctx.waitUntil(queueClipTask(env, upload));
        return json(await listState(env), env, { status: 201 });
      }

      if (url.pathname === "/recordings/upload" && request.method === "POST") {
        const upload = await uploadRecording(env, request, {
          findOrCreateIp,
          toPlatformValue
        });
        ctx.waitUntil(queueClipTask(env, upload));
        return json(await listState(env), env, { status: 201 });
      }

      const authorizationMatch = url.pathname.match(/^\/authorization-requests\/([^/]+)$/);
      if (authorizationMatch && request.method === "PATCH") {
        const body = await readJson(request, statusSchemas.authorization);
        if (body.status === "pending") {
          await patchRows(env, "authorization_requests", `id=eq.${authorizationMatch[1]}`, { status: body.status });
        } else {
          await reviewAuthorizationRequest(env, authorizationMatch[1], {
            status: body.status,
            reviewNote: "Reviewed from legacy route"
          });
        }
        return json(await listState(env), env);
      }

      const accountBindingMatch = url.pathname.match(/^\/account-bindings\/([^/]+)$/);
      if (accountBindingMatch && request.method === "PATCH") {
        const body = await readJson(request, statusSchemas.accountBinding);
        await patchRows(env, "social_accounts", `id=eq.${accountBindingMatch[1]}`, { status: body.status });
        return json(await listState(env), env);
      }

      const clipTaskCompleteMatch = url.pathname.match(/^\/clip-tasks\/([^/]+)\/complete$/);
      if (clipTaskCompleteMatch && request.method === "POST") {
        await completeManualClipTask(env, clipTaskCompleteMatch[1]);
        return json(await listState(env), env);
      }

      const clipTaskMatch = url.pathname.match(/^\/clip-tasks\/([^/]+)$/);
      if (clipTaskMatch && request.method === "PATCH") {
        const body = await readJson(request, statusSchemas.clipTask);
        await updateManualClipTask(env, clipTaskMatch[1], body.status);
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
        const riskRows = await selectRows<{
          account_name: string;
          handling_note: string | null;
          work_url: string;
        }>(env, "violation_leads", `select=account_name,handling_note,work_url&id=eq.${riskMatch[1]}&limit=1`);
        const risk = first(riskRows);
        await patchRows(env, "violation_leads", `id=eq.${riskMatch[1]}`, { status: body.status });
        if (body.status === "blocked" && risk) {
          const distributor = await findOrCreateDistributor(env, risk.account_name, "Pending binding");
          const profile = first(
            await safeRows(() =>
              selectRows<{ credit_score: number | null }>(
                env,
                "distributor_profiles",
                `select=credit_score&id=eq.${distributor.id}&limit=1`
              )
            )
          );
          const nextCredit = Math.max(0, Number(profile?.credit_score ?? 100) - 30);
          await runAuditedSideEffect(
            env,
            {
              type: "credit_adjust",
              targetId: distributor.id,
              detail: {
                riskRecordId: riskMatch[1],
                delta: -30,
                nextCredit,
                reason: risk.handling_note ?? "Risk record blocked"
              }
            },
            async () => {
              await insertRow(env, "credit_score_events", {
                distributor_id: distributor.id,
                delta: -30,
                reason: risk.handling_note ?? "Risk record blocked"
              });
              await patchRows(env, "distributor_profiles", `id=eq.${distributor.id}`, {
                credit_score: nextCredit,
                onboarding_status: nextCredit < 60 ? "suspended" : undefined,
                updated_at: new Date().toISOString()
              });
            }
          );
          await runAuditedSideEffect(
            env,
            {
              type: "wallet_freeze",
              targetId: distributor.id,
              detail: {
                riskRecordId: riskMatch[1],
                source: risk.work_url,
                note: risk.handling_note ?? "Risk freeze"
              }
            },
            () =>
              insertRow(env, "wallet_transactions", {
                distributor_id: distributor.id,
                type: "freeze",
                amount: 0,
                status: "frozen",
                source: risk.work_url,
                note: risk.handling_note ?? "Risk freeze"
              })
          );
          await runAuditedSideEffect(
            env,
            {
              type: "settlement_block",
              targetId: distributor.id,
              detail: {
                riskRecordId: riskMatch[1],
                status: "blocked"
              }
            },
            () =>
              patchRows(env, "settlement_orders", `distributor_id=eq.${distributor.id}&status=neq.paid`, {
                status: "blocked"
              })
          );
        }
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
        await claimMaterial(env, claimMatch[1], body.distributorName, requirePartnerSession(requestSession));
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

      return errorJson(new ApiError("not_found", "Not found", 404), env);
    } catch (error) {
      logError(request, error);
      return errorJson(error, env);
    }
}

const apiApp = createApiApp(handleApiRequest);

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx?: ExecutionContext): Promise<Response> {
    const executionContext =
      ctx ??
      ({
        waitUntil() {
          return undefined;
        },
        passThroughOnException() {
          return undefined;
        }
      } as unknown as ExecutionContext);
    return apiApp.fetch(request, env, executionContext);
  },

  async scheduled(_event: ScheduledEvent, env: WorkerEnv): Promise<void> {
    await env.CLIP_TASK_QUEUE.send({
      type: "cron.scan",
      createdAt: new Date().toISOString()
    });
  },

  async queue(batch: MessageBatch<ClipTaskPayload>, env: WorkerEnv): Promise<void> {
    for (const message of batch.messages) {
      await processClipQueuePayload(env, message.body);
      message.ack();
    }
  }
};

export default worker;
