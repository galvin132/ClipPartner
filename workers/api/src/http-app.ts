import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import { handleBetterAuthRequest } from "./better-auth.ts";
import type { WorkerEnv } from "./env.ts";

type AppEnv = {
  Bindings: WorkerEnv;
};

type LegacyHandler = (request: Request, env: WorkerEnv, ctx: ExecutionContext) => Promise<Response>;
type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

type RouteDoc = {
  method: HttpMethod;
  path: string;
  tags: string[];
  summary: string;
  successStatus?: 200 | 201 | 202;
  bodySchema?: z.ZodTypeAny;
};

const jsonObjectSchema = z.object({}).passthrough();
const errorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional()
    })
  })
  .openapi("ApiError");

const authSessionSchema = z
  .object({
    session: z.object({}).passthrough(),
    user: z.object({}).passthrough()
  })
  .nullable()
  .openapi("AuthSession");

const platformBodySchema = z.union([z.literal("douyin"), z.literal("wechat_channels"), z.literal("抖音"), z.literal("视频号")]);
const nonEmptyString = z.string().trim().min(1).max(1000);
const reasonBodySchema = z
  .object({
    reason: z.string().trim().max(1000).optional(),
    note: z.string().trim().max(1000).optional()
  })
  .passthrough()
  .openapi("ReasonInput");
const statusBodySchema = (name: string, values: [string, ...string[]]) =>
  z
    .object({
      status: z.enum(values)
    })
    .passthrough()
    .openapi(name);
const systemSettingsBodySchema = z
  .object({
    runtimeMode: z.enum(["mock", "hybrid", "real"]).optional(),
    commissionShare: z.number().min(0).max(100).optional(),
    dailyClaimLimit: z.number().int().min(0).max(10000).optional(),
    riskKeywords: z.union([z.array(z.string()), z.string()]).optional()
  })
  .passthrough()
  .openapi("SystemSettingsPatchInput");
const integrationConfigBodySchema = z
  .object({
    enabled: z.boolean().optional(),
    publicConfig: z.record(z.string(), z.unknown()).optional(),
    secrets: z.record(z.string(), z.string()).optional()
  })
  .passthrough()
  .openapi("IntegrationConfigPatchInput");
const authorizationRequestBodySchema = z
  .object({
    distributorName: z.string().optional(),
    socialAccount: nonEmptyString,
    platform: platformBodySchema,
    ipName: nonEmptyString,
    reason: nonEmptyString
  })
  .passthrough()
  .openapi("AuthorizationRequestInput");
const accountBindingBodySchema = z
  .object({
    distributorName: z.string().optional(),
    platform: platformBodySchema,
    accountName: nonEmptyString,
    homepageUrl: z.string(),
    followers: z.number().int().min(0),
    category: nonEmptyString,
    note: z.string().optional()
  })
  .passthrough()
  .openapi("AccountBindingInput");
const clipTaskBodySchema = z
  .object({
    recordingTitle: nonEmptyString,
    ipName: nonEmptyString,
    sourcePlatform: platformBodySchema
  })
  .passthrough()
  .openapi("ClipTaskInput");
const materialBodySchema = z
  .object({
    title: nonEmptyString,
    ipName: nonEmptyString,
    sourcePlatform: platformBodySchema,
    productName: nonEmptyString
  })
  .passthrough()
  .openapi("MaterialInput");
const productBodySchema = z
  .object({
    name: nonEmptyString,
    platform: platformBodySchema,
    affiliateUrl: z.string(),
    commissionRate: z.number().min(0).max(100)
  })
  .passthrough()
  .openapi("ProductInput");
const riskRecordBodySchema = z
  .object({
    platform: platformBodySchema,
    account: nonEmptyString,
    issue: nonEmptyString,
    workUrl: z.string()
  })
  .passthrough()
  .openapi("RiskRecordInput");
const partnerProfileBodySchema = z
  .object({
    distributorName: z.string().optional(),
    displayName: z.string().optional(),
    phone: z.string().optional(),
    wechatId: z.string().optional(),
    onboardingStatus: z.string().optional()
  })
  .passthrough()
  .openapi("PartnerProfileInput");
const examAttemptBodySchema = z
  .object({
    distributorName: z.string().optional(),
    score: z.number().int().min(0).max(100),
    answers: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough()
  .openapi("ExamAttemptInput");
const agreementSignBodySchema = z
  .object({
    distributorName: z.string().optional(),
    templateName: z.string().optional(),
    version: z.string().optional()
  })
  .passthrough()
  .openapi("AgreementSignInput");
const authorizationPoolBodySchema = z
  .object({
    ipName: nonEmptyString,
    platform: platformBodySchema,
    totalQuota: z.number().int().min(0),
    minCreditScore: z.number().int().min(0).max(100).optional(),
    defaultShareRate: z.number().min(0).max(100).optional(),
    dailyClaimLimit: z.number().int().min(0).optional(),
    requirement: z.string().optional()
  })
  .passthrough()
  .openapi("AuthorizationPoolInput");
const authorizationReviewBodySchema = statusBodySchema("AuthorizationReviewInput", [
  "approved",
  "rejected",
  "paused",
  "banned",
  "expired"
]).extend({
  reviewNote: z.string().optional()
});
const distributionTaskBodySchema = z
  .object({
    title: nonEmptyString,
    ipName: nonEmptyString,
    platform: platformBodySchema,
    productName: nonEmptyString,
    materialIds: z.array(z.string()).optional(),
    endAt: z.string().optional(),
    rewardRule: z.string().optional(),
    claimLimit: z.number().int().min(0).optional(),
    requirement: z.string().optional()
  })
  .passthrough()
  .openapi("DistributionTaskInput");
const taskClaimBodySchema = z.object({ distributorName: z.string().optional() }).passthrough().openapi("TaskClaimInput");
const submitTaskClaimBodySchema = z.object({ publishUrl: z.string() }).passthrough().openapi("TaskClaimSubmitInput");
const riskEventBodySchema = z
  .object({
    distributorName: z.string().optional(),
    publishRecordId: z.string().optional(),
    taskClaimId: z.string().optional(),
    title: nonEmptyString,
    description: nonEmptyString
  })
  .passthrough()
  .openapi("RiskEventInput");
const riskActionBodySchema = z
  .object({
    actionType: nonEmptyString,
    note: z.string().optional(),
    status: z.string().optional(),
    creditDelta: z.number().int().min(-100).max(100).optional(),
    freezeWallet: z.boolean().optional(),
    pauseAuthorization: z.boolean().optional()
  })
  .passthrough()
  .openapi("RiskActionInput");
const appealBodySchema = z
  .object({
    distributorName: z.string().optional(),
    riskEventId: z.string().optional(),
    reason: nonEmptyString
  })
  .passthrough()
  .openapi("AppealInput");
const publishVerifyBodySchema = z
  .object({
    result: z.enum(["verified", "invalid"]).optional(),
    reason: z.string().optional()
  })
  .passthrough()
  .openapi("PublishVerifyInput");
const publishBulkReviewBodySchema = z
  .object({
    ids: z.array(z.string()).min(1).max(100),
    result: z.enum(["verified", "invalid"]).optional(),
    reason: z.string().optional()
  })
  .passthrough()
  .openapi("PublishBulkReviewInput");
const performanceImportBodySchema = z
  .object({
    fileName: z.string().optional(),
    rows: z.array(z.object({}).passthrough()).min(1).max(500)
  })
  .passthrough()
  .openapi("PerformanceImportInput");
const settlementPeriodBodySchema = z.object({ period: z.string().optional() }).passthrough().openapi("SettlementPeriodInput");
const settlementDisputeBodySchema = z.object({ reason: nonEmptyString }).passthrough().openapi("SettlementDisputeInput");
const appealReviewBodySchema = z
  .object({
    status: z.enum(["open", "resolved", "rejected"]),
    handledNote: z.string().optional()
  })
  .passthrough()
  .openapi("AppealReviewInput");
const ffmpegJobBodySchema = z
  .object({
    clipTaskId: nonEmptyString,
    r2Key: nonEmptyString,
    outputPrefix: z.string().optional()
  })
  .passthrough()
  .openapi("FfmpegJobInput");
const ffmpegJobPatchBodySchema = z
  .object({
    status: z.enum(["queued", "processing", "completed", "failed", "pending_external_config"]),
    message: z.string().optional()
  })
  .passthrough()
  .openapi("FfmpegJobPatchInput");
const ffmpegWebhookBodySchema = z
  .object({
    jobId: nonEmptyString,
    status: z.enum(["queued", "processing", "completed", "failed"]),
    message: z.string().optional()
  })
  .passthrough()
  .openapi("FfmpegWebhookInput");
const materialProductBodySchema = z.object({ productId: z.string() }).passthrough().openapi("MaterialProductInput");
const materialClaimBodySchema = z.object({ distributorName: z.string().optional() }).passthrough().openapi("MaterialClaimInput");
const submitPublishBodySchema = z.object({ publishUrl: z.string().optional() }).passthrough().openapi("PublishSubmitInput");
const performanceBodySchema = z
  .object({
    gmv: z.number().min(0),
    commission: z.number().min(0)
  })
  .passthrough()
  .openapi("PerformanceInput");

const walletTransactionBodySchema = z
  .object({
    distributorName: z.string().optional(),
    type: z.enum(["commission", "adjustment", "freeze", "payout"]),
    amount: z.number(),
    status: z.enum(["available", "frozen", "pending", "paid"]),
    source: z.string(),
    note: z.string().optional()
  })
  .openapi("WalletTransactionInput");

const directUploadInitBodySchema = z
  .object({
    title: z.string(),
    ipName: z.string(),
    sourcePlatform: platformBodySchema,
    fileName: z.string(),
    contentType: z.string(),
    size: z.number().optional()
  })
  .passthrough()
  .openapi("DirectUploadInitInput");

const directUploadCompleteBodySchema = z
  .object({
    uploadId: z.string(),
    key: z.string(),
    title: z.string(),
    ipName: z.string(),
    sourcePlatform: platformBodySchema
  })
  .passthrough()
  .openapi("DirectUploadCompleteInput");

const routeDocs: RouteDoc[] = [
  { method: "get", path: "/health", tags: ["System"], summary: "Worker health check" },
  { method: "get", path: "/integrations", tags: ["System"], summary: "Integration readiness" },
  { method: "get", path: "/me", tags: ["Auth"], summary: "Current ClipPartner session" },
  { method: "get", path: "/state", tags: ["Legacy"], summary: "Legacy aggregate state" },
  { method: "post", path: "/state/reset", tags: ["Legacy"], summary: "Reset demo state" },
  { method: "get", path: "/admin/settings", tags: ["System"], summary: "Read backend system settings" },
  { method: "patch", path: "/admin/settings", tags: ["System"], summary: "Update backend system settings", bodySchema: systemSettingsBodySchema },
  { method: "get", path: "/admin/integrations/{key}", tags: ["System"], summary: "Read integration configuration" },
  {
    method: "patch",
    path: "/admin/integrations/{key}",
    tags: ["System"],
    summary: "Update integration configuration",
    bodySchema: integrationConfigBodySchema
  },
  { method: "post", path: "/admin/integrations/{key}/test", tags: ["System"], summary: "Validate integration configuration" },
  { method: "get", path: "/admin/distributors", tags: ["Admin"], summary: "List distributors" },
  { method: "get", path: "/admin/training", tags: ["Admin"], summary: "List training state" },
  { method: "get", path: "/admin/authorization-pools", tags: ["Admin"], summary: "List authorization pools" },
  {
    method: "post",
    path: "/admin/authorization-pools",
    tags: ["Admin"],
    summary: "Create authorization pool",
    successStatus: 201,
    bodySchema: authorizationPoolBodySchema
  },
  {
    method: "patch",
    path: "/admin/authorization-pools/{id}",
    tags: ["Admin"],
    summary: "Update authorization pool",
    bodySchema: statusBodySchema("AuthorizationPoolPatchInput", ["open", "paused", "full"])
  },
  {
    method: "patch",
    path: "/admin/authorization-requests/{id}/review",
    tags: ["Admin"],
    summary: "Review authorization request",
    bodySchema: authorizationReviewBodySchema
  },
  { method: "get", path: "/admin/distribution-tasks", tags: ["Admin"], summary: "List distribution tasks" },
  {
    method: "post",
    path: "/admin/distribution-tasks",
    tags: ["Admin"],
    summary: "Create distribution task",
    successStatus: 201,
    bodySchema: distributionTaskBodySchema
  },
  {
    method: "patch",
    path: "/admin/distribution-tasks/{id}",
    tags: ["Admin"],
    summary: "Update distribution task",
    bodySchema: statusBodySchema("DistributionTaskPatchInput", ["draft", "open", "paused", "closed"])
  },
  { method: "post", path: "/admin/risk-events", tags: ["Risk"], summary: "Create risk event", successStatus: 201, bodySchema: riskEventBodySchema },
  { method: "patch", path: "/admin/risk-events/{id}/action", tags: ["Risk"], summary: "Apply risk action", bodySchema: riskActionBodySchema },
  { method: "post", path: "/partner/profile", tags: ["Partner"], summary: "Upsert partner profile", bodySchema: partnerProfileBodySchema },
  {
    method: "post",
    path: "/partner/exam-attempts",
    tags: ["Partner"],
    summary: "Record partner exam attempt",
    successStatus: 201,
    bodySchema: examAttemptBodySchema
  },
  { method: "post", path: "/partner/agreements/sign", tags: ["Partner"], summary: "Sign partner agreement", successStatus: 201, bodySchema: agreementSignBodySchema },
  { method: "get", path: "/partner/authorizations", tags: ["Partner"], summary: "List partner authorizations" },
  { method: "get", path: "/partner/social-accounts", tags: ["Partner"], summary: "List partner social accounts" },
  { method: "post", path: "/partner/social-accounts", tags: ["Partner"], summary: "Create partner social account", successStatus: 201, bodySchema: accountBindingBodySchema },
  { method: "get", path: "/partner/authorization-requests", tags: ["Partner"], summary: "List partner authorization requests" },
  {
    method: "post",
    path: "/partner/authorization-requests",
    tags: ["Partner"],
    summary: "Create partner authorization request",
    successStatus: 201,
    bodySchema: authorizationRequestBodySchema
  },
  { method: "get", path: "/partner/tasks", tags: ["Partner"], summary: "List open partner tasks and claims" },
  { method: "post", path: "/partner/tasks/{id}/claim", tags: ["Partner"], summary: "Claim distribution task", successStatus: 201, bodySchema: taskClaimBodySchema },
  { method: "get", path: "/partner/wallet", tags: ["Partner"], summary: "List partner wallet" },
  {
    method: "post",
    path: "/partner/wallet/transactions",
    tags: ["Partner"],
    summary: "Create wallet transaction",
    successStatus: 201,
    bodySchema: walletTransactionBodySchema
  },
  { method: "post", path: "/partner/appeals", tags: ["Partner"], summary: "Create appeal", successStatus: 201, bodySchema: appealBodySchema },
  {
    method: "post",
    path: "/partner/settlements/{id}/dispute",
    tags: ["Partner"],
    summary: "Dispute settlement",
    successStatus: 201,
    bodySchema: settlementDisputeBodySchema
  },
  { method: "post", path: "/admin/authorizations/{id}/pause", tags: ["Admin"], summary: "Pause authorization", bodySchema: reasonBodySchema },
  { method: "post", path: "/admin/authorizations/{id}/resume", tags: ["Admin"], summary: "Resume authorization", bodySchema: reasonBodySchema },
  { method: "post", path: "/admin/products/{id}/disable", tags: ["Products"], summary: "Disable product", bodySchema: reasonBodySchema },
  { method: "get", path: "/admin/products/{id}/commission-history", tags: ["Products"], summary: "Product commission history" },
  { method: "get", path: "/admin/performance-imports", tags: ["Publishing"], summary: "List performance imports" },
  {
    method: "post",
    path: "/admin/performance-imports",
    tags: ["Publishing"],
    summary: "Create performance import",
    successStatus: 201,
    bodySchema: performanceImportBodySchema
  },
  { method: "get", path: "/admin/performance-imports/{id}", tags: ["Publishing"], summary: "Get performance import" },
  { method: "get", path: "/admin/performance-imports/{id}/errors", tags: ["Publishing"], summary: "List performance import errors" },
  { method: "post", path: "/admin/publish-records/{id}/verify", tags: ["Publishing"], summary: "Verify publish record", bodySchema: publishVerifyBodySchema },
  { method: "post", path: "/admin/publish-records/bulk-review", tags: ["Publishing"], summary: "Bulk review publish records", bodySchema: publishBulkReviewBodySchema },
  { method: "post", path: "/admin/settlements/{id}/confirm", tags: ["Settlements"], summary: "Confirm settlement", bodySchema: reasonBodySchema },
  { method: "post", path: "/admin/settlements/{id}/pay", tags: ["Settlements"], summary: "Mark settlement paid", bodySchema: reasonBodySchema },
  {
    method: "post",
    path: "/admin/settlement-periods/generate",
    tags: ["Settlements"],
    summary: "Generate settlement period",
    successStatus: 201,
    bodySchema: settlementPeriodBodySchema
  },
  { method: "patch", path: "/admin/appeals/{id}", tags: ["Risk"], summary: "Review appeal", bodySchema: appealReviewBodySchema },
  { method: "get", path: "/ffmpeg/jobs", tags: ["FFmpeg"], summary: "List FFmpeg jobs" },
  { method: "post", path: "/ffmpeg/jobs", tags: ["FFmpeg"], summary: "Create FFmpeg job", successStatus: 202, bodySchema: ffmpegJobBodySchema },
  { method: "get", path: "/ffmpeg/jobs/{id}", tags: ["FFmpeg"], summary: "Get FFmpeg job" },
  { method: "patch", path: "/ffmpeg/jobs/{id}", tags: ["FFmpeg"], summary: "Update FFmpeg job", bodySchema: ffmpegJobPatchBodySchema },
  { method: "post", path: "/ffmpeg/webhook", tags: ["FFmpeg"], summary: "Receive FFmpeg webhook", successStatus: 202, bodySchema: ffmpegWebhookBodySchema },
  { method: "post", path: "/claims/{id}/download-url", tags: ["Claims"], summary: "Create claim download URL", successStatus: 201 },
  { method: "post", path: "/claims/{id}/submit", tags: ["Claims"], summary: "Submit task claim", bodySchema: submitTaskClaimBodySchema },
  { method: "get", path: "/notifications", tags: ["Notifications"], summary: "List notifications" },
  { method: "post", path: "/notifications/{id}/read", tags: ["Notifications"], summary: "Mark notification as read" },
  { method: "get", path: "/authorization-requests", tags: ["Legacy"], summary: "List authorization requests" },
  {
    method: "post",
    path: "/authorization-requests",
    tags: ["Legacy"],
    summary: "Create authorization request",
    successStatus: 201,
    bodySchema: authorizationRequestBodySchema
  },
  {
    method: "patch",
    path: "/authorization-requests/{id}",
    tags: ["Legacy"],
    summary: "Update authorization request",
    bodySchema: statusBodySchema("AuthorizationRequestPatchInput", ["pending", "approved", "rejected", "paused", "banned", "expired"])
  },
  { method: "get", path: "/account-bindings", tags: ["Legacy"], summary: "List account bindings" },
  { method: "post", path: "/account-bindings", tags: ["Legacy"], summary: "Create account binding", successStatus: 201, bodySchema: accountBindingBodySchema },
  {
    method: "patch",
    path: "/account-bindings/{id}",
    tags: ["Legacy"],
    summary: "Update account binding",
    bodySchema: statusBodySchema("AccountBindingPatchInput", ["pending", "approved", "rejected", "paused"])
  },
  { method: "get", path: "/clip-tasks", tags: ["Materials"], summary: "List clip tasks" },
  { method: "post", path: "/clip-tasks", tags: ["Materials"], summary: "Create manual clip task", successStatus: 201, bodySchema: clipTaskBodySchema },
  {
    method: "patch",
    path: "/clip-tasks/{id}",
    tags: ["Materials"],
    summary: "Update clip task",
    bodySchema: statusBodySchema("ClipTaskPatchInput", ["queued", "processing", "completed", "failed"])
  },
  { method: "post", path: "/clip-tasks/{id}/complete", tags: ["Materials"], summary: "Complete clip task" },
  { method: "get", path: "/materials", tags: ["Materials"], summary: "List materials" },
  { method: "post", path: "/materials", tags: ["Materials"], summary: "Create material", successStatus: 201, bodySchema: materialBodySchema },
  {
    method: "patch",
    path: "/materials/{id}",
    tags: ["Materials"],
    summary: "Update material",
    bodySchema: statusBodySchema("MaterialPatchInput", ["draft", "processing", "ready", "published", "archived"])
  },
  { method: "post", path: "/materials/{id}/product", tags: ["Materials"], summary: "Bind product to material", bodySchema: materialProductBodySchema },
  { method: "post", path: "/materials/{id}/claim", tags: ["Materials"], summary: "Claim material", successStatus: 201, bodySchema: materialClaimBodySchema },
  { method: "get", path: "/products", tags: ["Products"], summary: "List products" },
  { method: "post", path: "/products", tags: ["Products"], summary: "Create product", successStatus: 201, bodySchema: productBodySchema },
  { method: "patch", path: "/products/{id}", tags: ["Products"], summary: "Update product", bodySchema: z.object({ isActive: z.boolean() }).passthrough().openapi("ProductPatchInput") },
  { method: "get", path: "/publish-records", tags: ["Publishing"], summary: "List publish records" },
  { method: "post", path: "/publish-records/{id}/submit", tags: ["Publishing"], summary: "Submit publish link", bodySchema: submitPublishBodySchema },
  { method: "post", path: "/publish-records/{id}/performance", tags: ["Publishing"], summary: "Import performance", bodySchema: performanceBodySchema },
  {
    method: "patch",
    path: "/publish-records/{id}",
    tags: ["Publishing"],
    summary: "Update publish record",
    bodySchema: statusBodySchema("PublishRecordPatchInput", ["claimed", "downloaded", "submitted", "verified", "invalid", "settled"])
  },
  { method: "get", path: "/settlements", tags: ["Settlements"], summary: "List settlements" },
  { method: "post", path: "/settlements/generate", tags: ["Settlements"], summary: "Generate settlement", successStatus: 201 },
  {
    method: "patch",
    path: "/settlements/{id}",
    tags: ["Settlements"],
    summary: "Update settlement",
    bodySchema: statusBodySchema("SettlementPatchInput", ["pending", "confirmed", "paid", "blocked"])
  },
  { method: "get", path: "/risk-records", tags: ["Risk"], summary: "List risk records" },
  { method: "post", path: "/risk-records", tags: ["Risk"], summary: "Create risk record", successStatus: 201, bodySchema: riskRecordBodySchema },
  {
    method: "patch",
    path: "/risk-records/{id}",
    tags: ["Risk"],
    summary: "Update risk record",
    bodySchema: statusBodySchema("RiskRecordPatchInput", ["pending", "open", "warning", "blocked", "resolved"])
  },
  {
    method: "post",
    path: "/recordings/direct-upload/init",
    tags: ["Recordings"],
    summary: "Initialize direct R2 upload",
    successStatus: 201,
    bodySchema: directUploadInitBodySchema
  },
  {
    method: "post",
    path: "/recordings/direct-upload/complete",
    tags: ["Recordings"],
    summary: "Complete direct R2 upload",
    successStatus: 201,
    bodySchema: directUploadCompleteBodySchema
  },
  { method: "post", path: "/recordings/upload", tags: ["Recordings"], summary: "Upload recording through Worker", successStatus: 201 }
];

function executionContext(c: Context<AppEnv>) {
  return (c as Context<AppEnv> & { executionCtx: ExecutionContext }).executionCtx;
}

function jsonResponse(status = 200) {
  return {
    description: "JSON response",
    content: {
      "application/json": {
        schema: jsonObjectSchema
      }
    },
    status
  };
}

function errorResponse() {
  return {
    description: "API error",
    content: {
      "application/json": {
        schema: errorSchema
      }
    }
  };
}

function legacyRequest(c: Context<AppEnv>, route: RouteDoc): Request {
  const raw = c.req.raw;
  const contentType = raw.headers.get("content-type") ?? "";
  if (route.bodySchema && route.method !== "get" && contentType.includes("application/json")) {
    const validatedBody = c.req.valid("json" as never) as unknown;
    return new Request(raw.url, {
      method: raw.method,
      headers: raw.headers,
      body: JSON.stringify(validatedBody ?? {})
    });
  }
  return raw.clone() as Request;
}

function registerLegacyRoute(app: OpenAPIHono<AppEnv>, route: RouteDoc, legacyHandler: LegacyHandler) {
  const config = createRoute({
    method: route.method,
    path: route.path,
    tags: route.tags,
    summary: route.summary,
    ...(route.bodySchema
      ? {
          request: {
            body: {
              required: true,
              content: {
                "application/json": {
                  schema: route.bodySchema ?? jsonObjectSchema
                }
              }
          }
        }
      }
      : {}),
    responses: {
      [route.successStatus ?? 200]: jsonResponse(route.successStatus ?? 200),
      default: errorResponse()
    }
  });

  app.openapi(config, ((c: Context<AppEnv>) => legacyHandler(legacyRequest(c, route), c.env, executionContext(c))) as never);
}

export function createApiApp(legacyHandler: LegacyHandler) {
  const app = new OpenAPIHono<AppEnv>();

  const authSessionRoute = createRoute({
    method: "get",
    path: "/api/auth/get-session",
    tags: ["Auth"],
    summary: "Get Better Auth session",
    responses: {
      200: {
        description: "Current Better Auth session or null",
        content: {
          "application/json": {
            schema: authSessionSchema
          }
        }
      }
    }
  });

  app.openapi(authSessionRoute, ((c: Context<AppEnv>) => handleBetterAuthRequest(c.req.raw, c.env)) as never);
  app.on(["GET", "POST"], "/api/auth/*", (c) => handleBetterAuthRequest(c.req.raw, c.env));

  for (const route of routeDocs) {
    registerLegacyRoute(app, route, legacyHandler);
  }

  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "ClipPartner API",
      version: "0.1.0",
      description: "Unified Worker API gateway for ClipPartner web, app, WeChat, Douyin, and R2 workflows."
    },
    servers: [
      {
        url: "https://clip-partner-api.workers.dev",
        description: "Production Worker API"
      }
    ]
  });

  app.get(
    "/docs",
    swaggerUI({
      title: "ClipPartner API",
      url: "/openapi.json"
    })
  );

  app.all("*", (c) => legacyHandler(c.req.raw, c.env, executionContext(c)));

  return app;
}
