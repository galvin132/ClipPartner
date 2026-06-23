"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDefaultPath, type AuthSession, type UserRole } from "@/lib/auth";
import { createAuthProvider } from "@/lib/providers/auth-provider";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const provider = useMemo(() => createAuthProvider(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSession(provider.getStoredSession());
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [provider]);

  const value = useMemo<AuthContextValue>(() => {
    function setCurrentSession(nextSession: AuthSession | null) {
      setSession(nextSession);
      return nextSession;
    }

    return {
      session,
      isHydrated,
      login(username, password) {
        return setCurrentSession(provider.login(username, password));
      },
      loginAs(username) {
        return setCurrentSession(provider.loginAs(username));
      },
      logout() {
        provider.logout();
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
