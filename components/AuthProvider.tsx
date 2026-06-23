"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authenticateMockUser, getDefaultPath, mockUsers, toSession, type AuthSession, type UserRole } from "@/lib/auth";

const STORAGE_KEY = "clip-partner-auth-session-v1";

type AuthContextValue = {
  session: AuthSession | null;
  isHydrated: boolean;
  login: (username: string, password: string) => AuthSession | null;
  loginAs: (username: string) => AuthSession | null;
  logout: () => void;
  defaultPath: string;
  hasRole: (roles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function storeSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSession(readStoredSession());
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    function setAndStore(nextSession: AuthSession | null) {
      setSession(nextSession);
      storeSession(nextSession);
      return nextSession;
    }

    return {
      session,
      isHydrated,
      login(username, password) {
        return setAndStore(authenticateMockUser(username, password));
      },
      loginAs(username) {
        const user = mockUsers.find((item) => item.username === username);
        return setAndStore(user ? toSession(user) : null);
      },
      logout() {
        setAndStore(null);
      },
      defaultPath: session ? getDefaultPath(session.role) : "/login",
      hasRole(roles) {
        return Boolean(session && roles.includes(session.role));
      }
    };
  }, [isHydrated, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
