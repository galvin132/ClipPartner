import { betterAuth } from "better-auth/minimal";
import { admin, bearer } from "better-auth/plugins";

import type { WorkerEnv } from "./index.ts";

type ClipPartnerAuth = {
  handler: (request: Request) => Promise<Response>;
};

const authCache = new Map<string, ClipPartnerAuth>();

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

export function getClipPartnerAuth(env: WorkerEnv, request: Request) {
  const baseURL = authBaseUrl(env, request);
  const secret = authSecret(env);
  const cacheKey = `${baseURL}:${secret}:${env.APP_ENV ?? "development"}`;
  const cached = authCache.get(cacheKey);
  if (cached) return cached;

  const auth = betterAuth({
    appName: "ClipPartner",
    baseURL,
    basePath: "/api/auth",
    secret,
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
  const auth = getClipPartnerAuth(env, request);
  return auth.handler(request);
}
