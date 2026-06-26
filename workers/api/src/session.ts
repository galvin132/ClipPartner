import {
  allowMissingSessionForMockRead,
  isMockAuthAllowed,
  isUserRole,
  routeRoles,
  type UserRole
} from "./auth-policy.ts";
import { handleBetterAuthRequest } from "./better-auth.ts";
import type { WorkerEnv } from "./env.ts";
import { ApiError } from "./errors.ts";

type SessionProvider = "mock" | "supabase" | "better-auth";

export type RequestSession = {
  id: string;
  userId?: string;
  role: UserRole;
  displayName: string;
  email?: string;
  provider: SessionProvider;
  isMock: boolean;
};

type SupabaseAuthUser = {
  id: string;
  email?: string;
  phone?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type BetterAuthSessionResponse = {
  session?: {
    id?: unknown;
    token?: unknown;
    userId?: unknown;
  } | null;
  user?: {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    role?: unknown;
  } | null;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "管理员",
  reviewer: "审核员",
  finance: "财务",
  partner: "分发者"
};

const DEFAULT_DISTRIBUTOR_NAME = "周婧";

function roleFromAppMetadata(appMetadata: Record<string, unknown> | undefined): UserRole {
  const role = typeof appMetadata?.role === "string" ? appMetadata.role : undefined;
  if (role === "operator") return "reviewer";
  const candidate = role ?? null;
  if (isUserRole(candidate)) return candidate;
  return "partner";
}

function displayNameFromAuthUser(user: SupabaseAuthUser, role: UserRole) {
  const appDisplayName = user.app_metadata?.display_name;
  const profileDisplayName = user.user_metadata?.display_name;
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;
  return (
    (typeof appDisplayName === "string" && appDisplayName.trim()) ||
    (typeof profileDisplayName === "string" && profileDisplayName.trim()) ||
    (typeof fullName === "string" && fullName.trim()) ||
    (typeof name === "string" && name.trim()) ||
    user.email ||
    user.phone ||
    (role === "partner" ? DEFAULT_DISTRIBUTOR_NAME : ROLE_LABELS[role])
  );
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function roleFromBetterAuthUser(user: BetterAuthSessionResponse["user"]): UserRole {
  const role = typeof user?.role === "string" ? user.role : undefined;
  if (role === "operator") return "reviewer";
  const candidate = role ?? null;
  if (isUserRole(candidate)) return candidate;
  return "partner";
}

function displayNameFromBetterAuthUser(user: BetterAuthSessionResponse["user"], role: UserRole) {
  return (
    (typeof user?.name === "string" && user.name.trim()) ||
    (typeof user?.email === "string" && user.email.trim()) ||
    (role === "partner" ? DEFAULT_DISTRIBUTOR_NAME : ROLE_LABELS[role])
  );
}

async function readBetterAuthSession(env: WorkerEnv, request: Request): Promise<RequestSession | null> {
  const token = bearerToken(request);
  const cookie = request.headers.get("cookie");
  if (!token && !cookie) return null;

  const sessionUrl = new URL("/api/auth/get-session", request.url);
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (cookie) headers.set("cookie", cookie);

  const response = await handleBetterAuthRequest(new Request(sessionUrl, { headers }), env);
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    if (response.status === 503) return null;
    throw new ApiError("auth_provider_error", "Better Auth session validation failed", 502, {
      status: response.status
    });
  }

  const payload = (await response.json()) as BetterAuthSessionResponse | null;
  if (!payload?.session || !payload.user || typeof payload.user.id !== "string") return null;

  const role = roleFromBetterAuthUser(payload.user);
  return {
    id: typeof payload.session.id === "string" ? payload.session.id : payload.user.id,
    userId: payload.user.id,
    role,
    displayName: displayNameFromBetterAuthUser(payload.user, role),
    email: typeof payload.user.email === "string" ? payload.user.email : undefined,
    provider: "better-auth",
    isMock: false
  };
}

async function readSupabaseSession(env: WorkerEnv, request: Request): Promise<RequestSession | null> {
  const token = bearerToken(request);
  if (!token) return null;

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new ApiError("auth_not_configured", "Supabase Auth is not configured for token validation", 503);
  }

  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401 || response.status === 403) {
    throw new ApiError("invalid_token", "Supabase access token is invalid or expired", 401);
  }

  if (!response.ok) {
    throw new ApiError("auth_provider_error", "Supabase Auth token validation failed", 502, {
      status: response.status
    });
  }

  const user = (await response.json()) as SupabaseAuthUser;
  const role = roleFromAppMetadata(user.app_metadata);

  return {
    id: user.id,
    userId: user.id,
    role,
    displayName: displayNameFromAuthUser(user, role),
    email: user.email,
    provider: "supabase",
    isMock: false
  };
}

function readMockSession(request: Request): RequestSession | null {
  if (request.headers.get("x-clip-auth-provider") !== "mock") return null;

  const role = request.headers.get("x-clip-role");
  if (!isUserRole(role)) return null;

  return {
    id: request.headers.get("x-clip-user-id")?.trim() || `mock-${role}`,
    role,
    displayName: request.headers.get("x-clip-display-name")?.trim() || ROLE_LABELS[role],
    provider: "mock",
    isMock: true
  };
}

export async function readRequestSession(env: WorkerEnv, request: Request): Promise<RequestSession | null> {
  return (
    (await readBetterAuthSession(env, request)) ??
    (await readSupabaseSession(env, request)) ??
    (isMockAuthAllowed(env) ? readMockSession(request) : null)
  );
}

export async function authorizeRequest(request: Request, env: WorkerEnv, pathname: string) {
  if (pathname === "/ffmpeg/webhook") {
    return null;
  }

  const allowedRoles = routeRoles(pathname, request.method);
  const session = await readRequestSession(env, request);

  if (!allowedRoles) {
    return session;
  }

  if (!session) {
    if (allowMissingSessionForMockRead(env, request.method)) {
      return null;
    }
    throw new ApiError("unauthenticated", "Missing ClipPartner session headers", 401);
  }

  if (!allowedRoles.includes(session.role)) {
    throw new ApiError("forbidden", `Role ${session.role} cannot access ${pathname}`, 403, {
      allowedRoles
    });
  }

  return session;
}

export function requireSession(session: RequestSession | null): RequestSession {
  if (!session) {
    throw new ApiError("unauthenticated", "A valid ClipPartner session is required", 401);
  }
  return session;
}

export function requirePartnerSession(session: RequestSession | null): RequestSession {
  const current = requireSession(session);
  if (current.role !== "partner") {
    throw new ApiError("forbidden", "This action requires a distributor session", 403);
  }
  return current;
}
