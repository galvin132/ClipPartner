import { betterAuth } from "better-auth";
import { admin, bearer } from "better-auth/plugins";
import { Pool } from "pg";

import type { WorkerEnv } from "./env.ts";

type ClipPartnerAuth = {
  handler: (request: Request) => Promise<Response>;
};

const authCache = new Map<string, ClipPartnerAuth>();

class BetterAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetterAuthConfigurationError";
  }
}

function authBaseUrl(env: WorkerEnv, request: Request) {
  return env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
}

function authSecret(env: WorkerEnv) {
  // Production should set a dedicated BETTER_AUTH_SECRET. The service-role
  // fallback keeps the gateway bootable while secrets are being migrated.
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY.length >= 32) return env.SUPABASE_SERVICE_ROLE_KEY;
  return "clip-partner-local-better-auth-secret-change-before-production";
}

function authDatabase(env: WorkerEnv) {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.BETTER_AUTH_DATABASE_URL;
  if (connectionString) {
    return new Pool({
      connectionString,
      max: env.APP_ENV === "production" ? 5 : 1,
      options: "-c search_path=auth_app,public"
    });
  }

  if (env.APP_ENV === "production") {
    throw new BetterAuthConfigurationError("Better Auth requires Hyperdrive or BETTER_AUTH_DATABASE_URL in production");
  }

  return undefined;
}

export function getClipPartnerAuth(env: WorkerEnv, request: Request) {
  const baseURL = authBaseUrl(env, request);
  const secret = authSecret(env);
  const connectionKey = env.HYPERDRIVE?.connectionString ?? env.BETTER_AUTH_DATABASE_URL ?? "memory";
  const cacheKey = `${baseURL}:${secret}:${env.APP_ENV ?? "development"}:${connectionKey}`;
  const cached = authCache.get(cacheKey);
  if (cached) return cached;
  const database = authDatabase(env);

  const auth = betterAuth({
    appName: "ClipPartner",
    baseURL,
    basePath: "/api/auth",
    secret,
    database,
    trustedOrigins: [env.FRONTEND_ORIGIN, baseURL].filter(Boolean),
    emailAndPassword: {
      enabled: true,
      disableSignUp: env.APP_ENV === "production"
    },
    plugins: [
      bearer(),
      admin({
        defaultRole: "partner",
        adminRoles: ["admin"]
      })
    ]
  });

  authCache.set(cacheKey, auth);
  return auth;
}

export async function handleBetterAuthRequest(request: Request, env: WorkerEnv) {
  try {
    const auth = getClipPartnerAuth(env, request);
    return auth.handler(request);
  } catch (error) {
    if (error instanceof BetterAuthConfigurationError) {
      return Response.json(
        {
          error: {
            code: "auth_database_not_configured",
            message: error.message
          }
        },
        { status: 503 }
      );
    }
    throw error;
  }
}
