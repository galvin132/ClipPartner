import { authenticateMockUser, mockUsers, toSession, type AuthSession } from "../auth.ts";
import { getRuntimeMode, type RuntimeMode } from "./runtime.ts";

const STORAGE_KEY = "clip-partner-auth-session-v1";

export type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type AuthProviderAdapter = {
  login: (username: string, password: string) => AuthSession | null;
  loginAs: (username: string) => AuthSession | null;
  logout: () => void;
  getStoredSession: () => AuthSession | null;
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
  return mode === "real" ? createSupabaseAuthProvider(storage) : createMockAuthProvider(storage);
}

export const authProvider = createAuthProvider();
