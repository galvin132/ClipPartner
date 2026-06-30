import { z } from "zod";
import { DOUYIN_LABEL, WECHAT_CHANNELS_LABEL } from "./domain.ts";

export const platformSchema = z.union([
  z.literal("douyin"),
  z.literal("wechat_channels"),
  z.literal(DOUYIN_LABEL),
  z.literal(WECHAT_CHANNELS_LABEL)
]);
export const nonEmptyString = z.string().trim().min(1).max(500);
export const uuidSchema = z.string().uuid();

export const authorizationRequestSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  socialAccount: nonEmptyString.max(120),
  platform: platformSchema,
  ipName: nonEmptyString.max(120),
  reason: nonEmptyString.max(500)
});

export const materialSchema = z.object({
  title: nonEmptyString.max(160),
  ipName: nonEmptyString.max(120),
  sourcePlatform: platformSchema,
  productName: nonEmptyString.max(160)
});

export const productSchema = z.object({
  name: nonEmptyString.max(160),
  platform: platformSchema,
  affiliateUrl: z.url().max(1000),
  commissionRate: z.coerce.number().min(0).max(100)
});

export const riskRecordSchema = z.object({
  platform: platformSchema,
  account: nonEmptyString.max(120),
  issue: nonEmptyString.max(500),
  workUrl: z.url().max(1000)
});

export const accountBindingSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  platform: platformSchema,
  accountName: nonEmptyString.max(120),
  homepageUrl: z.url().max(1000),
  followers: z.coerce.number().int().min(0).max(999999999),
  category: nonEmptyString.max(120),
  note: z.string().trim().max(500).optional()
});

export const clipTaskSchema = z.object({
  recordingTitle: nonEmptyString.max(180),
  ipName: nonEmptyString.max(120),
  sourcePlatform: platformSchema
});

export const statusSchemas = {
  authorization: z.object({ status: z.enum(["pending", "approved", "rejected", "paused", "banned", "expired"]) }),
  material: z.object({ status: z.enum(["draft", "processing", "ready", "published", "archived"]) }),
  publish: z.object({ status: z.enum(["claimed", "downloaded", "submitted", "verified", "invalid", "settled"]) }),
  settlement: z.object({ status: z.enum(["pending", "confirmed", "paid", "blocked"]) }),
  risk: z.object({ status: z.enum(["pending", "open", "warning", "blocked", "resolved"]) }),
  accountBinding: z.object({ status: z.enum(["pending", "approved", "rejected", "paused"]) }),
  clipTask: z.object({ status: z.enum(["queued", "processing", "completed", "failed"]) }),
  product: z.object({ isActive: z.boolean() })
};

export const directUploadInitSchema = z.object({
  title: nonEmptyString.max(160),
  ipName: nonEmptyString.max(120),
  sourcePlatform: platformSchema,
  fileName: nonEmptyString.max(240),
  contentType: z.string().trim().max(120).optional(),
  size: z.coerce.number().int().positive().max(1024 * 1024 * 1024).optional()
});

export const directUploadCompleteSchema = z.object({
  uploadId: uuidSchema,
  key: nonEmptyString.max(500),
  title: nonEmptyString.max(160),
  ipName: nonEmptyString.max(120),
  sourcePlatform: platformSchema
});

export const submitPublishSchema = z.object({
  publishUrl: z.url().max(1000).optional()
});

export const performanceSchema = z.object({
  gmv: z.coerce.number().min(0).max(999999999),
  commission: z.coerce.number().min(0).max(999999999)
});

export const claimSchema = z.object({
  distributorName: z.string().trim().min(1).max(80).optional()
});

export const materialProductSchema = z.object({
  productId: uuidSchema
});

export const onboardingStatusSchema = z.enum([
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

export const authorizationPoolStatusSchema = z.enum(["open", "paused", "full"]);
export const distributionTaskStatusSchema = z.enum(["draft", "open", "paused", "closed"]);
export const walletTransactionTypeSchema = z.enum(["commission", "adjustment", "freeze", "payout"]);
export const walletTransactionStatusSchema = z.enum(["available", "frozen", "pending", "paid"]);

export const partnerProfileSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  displayName: nonEmptyString.max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  wechatId: z.string().trim().max(120).optional(),
  onboardingStatus: onboardingStatusSchema.optional()
});

export const examAttemptSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  score: z.coerce.number().int().min(0).max(100),
  answers: z.record(z.string(), z.unknown()).optional()
});

export const agreementSignSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  templateName: nonEmptyString.max(160).optional(),
  version: nonEmptyString.max(40).optional()
});

export const authorizationPoolSchema = z.object({
  ipName: nonEmptyString.max(120),
  platform: platformSchema,
  totalQuota: z.coerce.number().int().min(0).max(100000),
  minCreditScore: z.coerce.number().int().min(0).max(100).default(80),
  defaultShareRate: z.coerce.number().min(0).max(100).default(30),
  dailyClaimLimit: z.coerce.number().int().min(0).max(10000).default(10),
  requirement: z.string().trim().max(1000).default("")
});

export const authorizationPoolPatchSchema = z.object({
  status: authorizationPoolStatusSchema
});

export const authorizationReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "paused", "banned", "expired"]),
  reviewNote: z.string().trim().max(1000).optional()
});

export const distributionTaskSchema = z.object({
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

export const distributionTaskPatchSchema = z.object({
  status: distributionTaskStatusSchema
});

export const taskClaimSchema = z.object({
  distributorName: nonEmptyString.max(80).optional()
});

export const taskClaimSubmitSchema = z.object({
  publishUrl: z.url().max(1000)
});

export const walletTransactionSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  type: walletTransactionTypeSchema,
  amount: z.coerce.number().min(-999999999).max(999999999),
  status: walletTransactionStatusSchema,
  source: nonEmptyString.max(500),
  note: z.string().trim().max(1000).optional()
});

export const riskEventSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  publishRecordId: z.string().uuid().optional(),
  taskClaimId: z.string().uuid().optional(),
  title: nonEmptyString.max(180),
  description: nonEmptyString.max(1000)
});

export const riskActionSchema = z.object({
  actionType: nonEmptyString.max(80),
  note: z.string().trim().max(1000).optional(),
  status: z.string().trim().max(40).optional(),
  creditDelta: z.coerce.number().int().min(-100).max(100).optional(),
  freezeWallet: z.boolean().optional(),
  pauseAuthorization: z.boolean().optional()
});

export const appealSchema = z.object({
  distributorName: nonEmptyString.max(80).optional(),
  riskEventId: z.string().uuid().optional(),
  reason: nonEmptyString.max(1000)
});

export const systemSettingsPatchSchema = z.object({
  runtimeMode: z.enum(["mock", "hybrid", "real"]).optional(),
  commissionShare: z.coerce.number().min(0).max(100).optional(),
  dailyClaimLimit: z.coerce.number().int().min(0).max(10000).optional(),
  riskKeywords: z.union([z.array(z.string().trim().min(1).max(120)), z.string().trim().max(2000)]).optional()
});

export const integrationProviderKeySchema = z.enum([
  "wechat_oauth",
  "douyin",
  "wechat_channels",
  "tencent_identity",
  "payment",
  "ffmpeg"
]);

export const integrationConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  publicConfig: z.record(z.string(), z.unknown()).optional(),
  secrets: z.record(z.string(), z.string()).optional()
});

export const reasonSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional()
});

export const publishVerifySchema = z.object({
  result: z.enum(["verified", "invalid"]).default("verified"),
  reason: z.string().trim().max(1000).optional()
});

export const publishBulkReviewSchema = z.object({
  ids: z.array(nonEmptyString.max(120)).min(1).max(100),
  result: z.enum(["verified", "invalid"]).default("verified"),
  reason: z.string().trim().max(1000).optional()
});

export const performanceImportSchema = z.object({
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

export const settlementPeriodSchema = z.object({
  period: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/)
    .default(() => new Date().toISOString().slice(0, 7))
});

export const settlementDisputeSchema = z.object({
  reason: nonEmptyString.max(1000)
});

export const appealReviewSchema = z.object({
  status: z.enum(["open", "resolved", "rejected"]),
  handledNote: z.string().trim().max(1000).optional()
});

export const ffmpegJobSchema = z.object({
  clipTaskId: nonEmptyString.max(120),
  r2Key: nonEmptyString.max(500),
  outputPrefix: z.string().trim().max(500).optional()
});

export const ffmpegJobPatchSchema = z.object({
  status: z.enum(["queued", "processing", "completed", "failed", "pending_external_config"]),
  message: z.string().trim().max(1000).optional()
});

export const ffmpegWebhookSchema = z.object({
  jobId: nonEmptyString.max(120),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  message: z.string().trim().max(1000).optional()
});
