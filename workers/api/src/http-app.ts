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
  bodySchema?: typeof jsonObjectSchema;
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
    fileName: z.string(),
    contentType: z.string(),
    size: z.number().optional(),
    purpose: z.string().optional()
  })
  .openapi("DirectUploadInitInput");

const directUploadCompleteBodySchema = z
  .object({
    key: z.string(),
    uploadId: z.string().optional(),
    fileName: z.string().optional(),
    contentType: z.string().optional(),
    size: z.number().optional()
  })
  .openapi("DirectUploadCompleteInput");

const routeDocs: RouteDoc[] = [
  { method: "get", path: "/health", tags: ["System"], summary: "Worker health check" },
  { method: "get", path: "/integrations", tags: ["System"], summary: "Integration readiness" },
  { method: "get", path: "/me", tags: ["Auth"], summary: "Current ClipPartner session" },
  { method: "get", path: "/state", tags: ["Legacy"], summary: "Legacy aggregate state" },
  { method: "post", path: "/state/reset", tags: ["Legacy"], summary: "Reset demo state" },
  { method: "get", path: "/admin/settings", tags: ["System"], summary: "Read backend system settings" },
  { method: "patch", path: "/admin/settings", tags: ["System"], summary: "Update backend system settings" },
  { method: "get", path: "/admin/integrations/{key}", tags: ["System"], summary: "Read integration configuration" },
  { method: "patch", path: "/admin/integrations/{key}", tags: ["System"], summary: "Update integration configuration" },
  { method: "post", path: "/admin/integrations/{key}/test", tags: ["System"], summary: "Validate integration configuration" },
  { method: "get", path: "/admin/distributors", tags: ["Admin"], summary: "List distributors" },
  { method: "get", path: "/admin/training", tags: ["Admin"], summary: "List training state" },
  { method: "get", path: "/admin/authorization-pools", tags: ["Admin"], summary: "List authorization pools" },
  { method: "post", path: "/admin/authorization-pools", tags: ["Admin"], summary: "Create authorization pool", successStatus: 201 },
  { method: "patch", path: "/admin/authorization-pools/{id}", tags: ["Admin"], summary: "Update authorization pool" },
  {
    method: "patch",
    path: "/admin/authorization-requests/{id}/review",
    tags: ["Admin"],
    summary: "Review authorization request"
  },
  { method: "get", path: "/admin/distribution-tasks", tags: ["Admin"], summary: "List distribution tasks" },
  { method: "post", path: "/admin/distribution-tasks", tags: ["Admin"], summary: "Create distribution task", successStatus: 201 },
  { method: "patch", path: "/admin/distribution-tasks/{id}", tags: ["Admin"], summary: "Update distribution task" },
  { method: "post", path: "/admin/risk-events", tags: ["Risk"], summary: "Create risk event", successStatus: 201 },
  { method: "patch", path: "/admin/risk-events/{id}/action", tags: ["Risk"], summary: "Apply risk action" },
  { method: "post", path: "/partner/profile", tags: ["Partner"], summary: "Upsert partner profile" },
  { method: "post", path: "/partner/exam-attempts", tags: ["Partner"], summary: "Record partner exam attempt", successStatus: 201 },
  { method: "post", path: "/partner/agreements/sign", tags: ["Partner"], summary: "Sign partner agreement", successStatus: 201 },
  { method: "get", path: "/partner/authorizations", tags: ["Partner"], summary: "List partner authorizations" },
  { method: "get", path: "/partner/social-accounts", tags: ["Partner"], summary: "List partner social accounts" },
  { method: "post", path: "/partner/social-accounts", tags: ["Partner"], summary: "Create partner social account", successStatus: 201 },
  { method: "get", path: "/partner/authorization-requests", tags: ["Partner"], summary: "List partner authorization requests" },
  {
    method: "post",
    path: "/partner/authorization-requests",
    tags: ["Partner"],
    summary: "Create partner authorization request",
    successStatus: 201
  },
  { method: "get", path: "/partner/tasks", tags: ["Partner"], summary: "List open partner tasks and claims" },
  { method: "post", path: "/partner/tasks/{id}/claim", tags: ["Partner"], summary: "Claim distribution task", successStatus: 201 },
  { method: "get", path: "/partner/wallet", tags: ["Partner"], summary: "List partner wallet" },
  {
    method: "post",
    path: "/partner/wallet/transactions",
    tags: ["Partner"],
    summary: "Create wallet transaction",
    successStatus: 201,
    bodySchema: walletTransactionBodySchema
  },
  { method: "post", path: "/partner/appeals", tags: ["Partner"], summary: "Create appeal", successStatus: 201 },
  { method: "post", path: "/partner/settlements/{id}/dispute", tags: ["Partner"], summary: "Dispute settlement", successStatus: 201 },
  { method: "post", path: "/admin/authorizations/{id}/pause", tags: ["Admin"], summary: "Pause authorization" },
  { method: "post", path: "/admin/authorizations/{id}/resume", tags: ["Admin"], summary: "Resume authorization" },
  { method: "post", path: "/admin/products/{id}/disable", tags: ["Products"], summary: "Disable product" },
  { method: "get", path: "/admin/products/{id}/commission-history", tags: ["Products"], summary: "Product commission history" },
  { method: "get", path: "/admin/performance-imports", tags: ["Publishing"], summary: "List performance imports" },
  { method: "post", path: "/admin/performance-imports", tags: ["Publishing"], summary: "Create performance import", successStatus: 201 },
  { method: "get", path: "/admin/performance-imports/{id}", tags: ["Publishing"], summary: "Get performance import" },
  { method: "get", path: "/admin/performance-imports/{id}/errors", tags: ["Publishing"], summary: "List performance import errors" },
  { method: "post", path: "/admin/publish-records/{id}/verify", tags: ["Publishing"], summary: "Verify publish record" },
  { method: "post", path: "/admin/publish-records/bulk-review", tags: ["Publishing"], summary: "Bulk review publish records" },
  { method: "post", path: "/admin/settlements/{id}/confirm", tags: ["Settlements"], summary: "Confirm settlement" },
  { method: "post", path: "/admin/settlements/{id}/pay", tags: ["Settlements"], summary: "Mark settlement paid" },
  {
    method: "post",
    path: "/admin/settlement-periods/generate",
    tags: ["Settlements"],
    summary: "Generate settlement period",
    successStatus: 201
  },
  { method: "patch", path: "/admin/appeals/{id}", tags: ["Risk"], summary: "Review appeal" },
  { method: "get", path: "/ffmpeg/jobs", tags: ["FFmpeg"], summary: "List FFmpeg jobs" },
  { method: "post", path: "/ffmpeg/jobs", tags: ["FFmpeg"], summary: "Create FFmpeg job", successStatus: 202 },
  { method: "get", path: "/ffmpeg/jobs/{id}", tags: ["FFmpeg"], summary: "Get FFmpeg job" },
  { method: "patch", path: "/ffmpeg/jobs/{id}", tags: ["FFmpeg"], summary: "Update FFmpeg job" },
  { method: "post", path: "/ffmpeg/webhook", tags: ["FFmpeg"], summary: "Receive FFmpeg webhook", successStatus: 202 },
  { method: "post", path: "/claims/{id}/download-url", tags: ["Claims"], summary: "Create claim download URL", successStatus: 201 },
  { method: "post", path: "/claims/{id}/submit", tags: ["Claims"], summary: "Submit task claim" },
  { method: "get", path: "/notifications", tags: ["Notifications"], summary: "List notifications" },
  { method: "post", path: "/notifications/{id}/read", tags: ["Notifications"], summary: "Mark notification as read" },
  { method: "get", path: "/authorization-requests", tags: ["Legacy"], summary: "List authorization requests" },
  { method: "post", path: "/authorization-requests", tags: ["Legacy"], summary: "Create authorization request", successStatus: 201 },
  { method: "patch", path: "/authorization-requests/{id}", tags: ["Legacy"], summary: "Update authorization request" },
  { method: "get", path: "/account-bindings", tags: ["Legacy"], summary: "List account bindings" },
  { method: "post", path: "/account-bindings", tags: ["Legacy"], summary: "Create account binding", successStatus: 201 },
  { method: "patch", path: "/account-bindings/{id}", tags: ["Legacy"], summary: "Update account binding" },
  { method: "get", path: "/clip-tasks", tags: ["Materials"], summary: "List clip tasks" },
  { method: "post", path: "/clip-tasks", tags: ["Materials"], summary: "Create manual clip task", successStatus: 201 },
  { method: "patch", path: "/clip-tasks/{id}", tags: ["Materials"], summary: "Update clip task" },
  { method: "post", path: "/clip-tasks/{id}/complete", tags: ["Materials"], summary: "Complete clip task" },
  { method: "get", path: "/materials", tags: ["Materials"], summary: "List materials" },
  { method: "post", path: "/materials", tags: ["Materials"], summary: "Create material", successStatus: 201 },
  { method: "patch", path: "/materials/{id}", tags: ["Materials"], summary: "Update material" },
  { method: "post", path: "/materials/{id}/product", tags: ["Materials"], summary: "Bind product to material" },
  { method: "post", path: "/materials/{id}/claim", tags: ["Materials"], summary: "Claim material", successStatus: 201 },
  { method: "get", path: "/products", tags: ["Products"], summary: "List products" },
  { method: "post", path: "/products", tags: ["Products"], summary: "Create product", successStatus: 201 },
  { method: "patch", path: "/products/{id}", tags: ["Products"], summary: "Update product" },
  { method: "get", path: "/publish-records", tags: ["Publishing"], summary: "List publish records" },
  { method: "post", path: "/publish-records/{id}/submit", tags: ["Publishing"], summary: "Submit publish link" },
  { method: "post", path: "/publish-records/{id}/performance", tags: ["Publishing"], summary: "Import performance" },
  { method: "patch", path: "/publish-records/{id}", tags: ["Publishing"], summary: "Update publish record" },
  { method: "get", path: "/settlements", tags: ["Settlements"], summary: "List settlements" },
  { method: "post", path: "/settlements/generate", tags: ["Settlements"], summary: "Generate settlement", successStatus: 201 },
  { method: "patch", path: "/settlements/{id}", tags: ["Settlements"], summary: "Update settlement" },
  { method: "get", path: "/risk-records", tags: ["Risk"], summary: "List risk records" },
  { method: "post", path: "/risk-records", tags: ["Risk"], summary: "Create risk record", successStatus: 201 },
  { method: "patch", path: "/risk-records/{id}", tags: ["Risk"], summary: "Update risk record" },
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
