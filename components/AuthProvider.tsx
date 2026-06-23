"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDefaultPath, type AuthSession, type UserRole } from "@/lib/auth";
import { createAuthProvider } from "@/lib/providers/auth-provider";

type AuthContextValue = {
  session: AuthSession | null;
  isHydrated: boolean;
  login: (username: string, password: string) => Promise<AuthSession | null>;
  loginAs: (username: string) => Promise<AuthSession | null>;
  logout: () => Promise<void>;
  defaultPath: string;
  hasRole: (roles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const provider = useMemo(() => createAuthProvider(), []);

  useEffect(() => {
    let isActive = true;
    const timer = window.setTimeout(() => {
      void Promise.resolve(provider.getStoredSession()).then((storedSession) => {
        if (!isActive) return;
        setSession(storedSession);
        setIsHydrated(true);
      });
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [provider]);

  const value = useMemo<AuthContextValue>(() => {
    function setCurrentSession(nextSession: AuthSession | null) {
      setSession(nextSession);
      return nextSession;
    }

    return {
      session,
      isHydrated,
      async login(username, password) {
        return setCurrentSession(await provider.login(username, password));
      },
      async loginAs(username) {
        return setCurrentSession(await provider.loginAs(username));
      },
      async logout() {
        await provider.logout();
        setCurrentSession(null);
      },
      defaultPath: session ? getDefaultPath(session.role) : "/login",
      hasRole(roles) {
        return Boolean(session && roles.includes(session.role));
      }
    };
  }, [isHydrated, provider, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
