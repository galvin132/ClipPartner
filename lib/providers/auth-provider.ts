import { authenticateMockUser, isUserRole, mockUsers, roleLabel, toSession, type AuthSession, type UserRole } from "../auth.ts";
import { getRuntimeMode, type RuntimeMode } from "./runtime.ts";

const STORAGE_KEY = "clip-partner-auth-session-v1";

export type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type MaybePromise<T> = T | Promise<T>;

type BetterAuthUserPayload = {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  role?: unknown;
};

type BetterAuthLoginPayload = {
  token?: unknown;
  user?: BetterAuthUserPayload;
};

type BetterAuthSessionPayload = {
  session?: {
    token?: unknown;
    expiresAt?: unknown;
  } | null;
  user?: BetterAuthUserPayload | null;
};

type BetterAuthProviderOptions = {
  apiBaseUrl?: string;
  fetcher?: typeof fetch;
};

export type AuthProviderAdapter = {
  login: (username: string, password: string) => MaybePromise<AuthSession | null>;
  loginAs: (username: string) => MaybePromise<AuthSession | null>;
  logout: () => MaybePromise<void>;
  getStoredSession: () => MaybePromise<AuthSession | null>;
};

function browserStorage(): SessionStorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function readStoredSession(storage: SessionStorageLike | null): AuthSession | null {
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

function storeSession(storage: SessionStorageLike | null, session: AuthSession | null) {
  if (!storage) return;
  if (session) {
    storage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    storage.removeItem(STORAGE_KEY);
  }
}

function defaultApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

function sessionFromBetterAuth(user: BetterAuthUserPayload | null | undefined, token: unknown, expiresAt?: unknown): AuthSession | null {
  if (!user || typeof user.id !== "string" || typeof token !== "string" || !token) return null;
  const role: UserRole = isUserRole(user.role) ? user.role : "partner";
  const email = typeof user.email === "string" ? user.email : "";
  const name = typeof user.name === "string" && user.name.trim() ? user.name.trim() : email || roleLabel(role);
  const expiresAtMs = typeof expiresAt === "string" ? Date.parse(expiresAt) : undefined;

  return {
    id: user.id,
    username: email || user.id,
    displayName: name,
    role,
    roleLabel: roleLabel(role),
    description: "",
    authProvider: "better-auth",
    accessToken: token,
    expiresAt: Number.isFinite(expiresAtMs) ? expiresAtMs : undefined
  };
}

export function createMockAuthProvider(storage: SessionStorageLike | null = browserStorage()): AuthProviderAdapter {
  return {
    login(username, password) {
      const session = authenticateMockUser(username, password);
      storeSession(storage, session);
      return session;
    },
    loginAs(username) {
      const user = mockUsers.find((item) => item.username === username);
      const session = user ? toSession(user) : null;
      storeSession(storage, session);
      return session;
    },
    logout() {
      storeSession(storage, null);
    },
    getStoredSession() {
      return readStoredSession(storage);
    }
  };
}

export function createBetterAuthProvider(
  storage: SessionStorageLike | null = browserStorage(),
  options: BetterAuthProviderOptions = {}
): AuthProviderAdapter {
  const apiBaseUrl = options.apiBaseUrl?.replace(/\/$/, "") ?? defaultApiBase();
  const fetcher = options.fetcher ?? fetch;

  async function requestJson<T>(path: string, init: RequestInit = {}) {
    if (!apiBaseUrl) return null;
    const response = await fetcher(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: init.credentials ?? "include",
      headers: {
        "content-type": "application/json",
        ...(init.headers as Record<string, string> | undefined)
      }
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  }

  return {
    async login(username, password) {
      const payload = await requestJson<BetterAuthLoginPayload>("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email: username, password })
      });
      const session = sessionFromBetterAuth(payload?.user, payload?.token);
      storeSession(storage, session);
      return session;
    },
    async loginAs() {
      storeSession(storage, null);
      return null;
    },
    async logout() {
      const session = readStoredSession(storage);
      if (session?.authProvider === "better-auth" && session.accessToken) {
        await requestJson("/api/auth/sign-out", {
          method: "POST",
          headers: { authorization: `Bearer ${session.accessToken}` }
        });
      }
      storeSession(storage, null);
    },
    async getStoredSession() {
      const session = readStoredSession(storage);
      if (session?.authProvider !== "better-auth" || !session.accessToken) return null;
      const payload = await requestJson<BetterAuthSessionPayload>("/api/auth/get-session", {
        headers: { authorization: `Bearer ${session.accessToken}` }
      });
      const refreshed = sessionFromBetterAuth(payload?.user, payload?.session?.token ?? session.accessToken, payload?.session?.expiresAt);
      storeSession(storage, refreshed);
      return refreshed;
    }
  };
}

export function createSupabaseAuthProvider(storage: SessionStorageLike | null = browserStorage()): AuthProviderAdapter {
  return {
    login() {
      storeSession(storage, null);
      return null;
    },
    loginAs() {
      storeSession(storage, null);
      return null;
    },
    logout() {
      storeSession(storage, null);
    },
    getStoredSession() {
      const session = readStoredSession(storage);
      return session?.authProvider === "supabase" ? session : null;
    }
  };
}

export function createAuthProvider(
  mode: RuntimeMode = getRuntimeMode(),
  storage: SessionStorageLike | null = browserStorage()
): AuthProviderAdapter {
  return mode === "real" ? createBetterAuthProvider(storage) : createMockAuthProvider(storage);
}

export const authProvider = createAuthProvider();
