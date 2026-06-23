"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessPath, getDefaultPath, type UserRole } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

export function AuthGate({
  children,
  roles
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isHydrated } = useAuth();

  useEffect(() => {
    if (!isHydrated) return;
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (roles && !roles.includes(session.role)) {
      router.replace(getDefaultPath(session.role));
      return;
    }
    if (!canAccessPath(session.role, pathname)) {
      router.replace(getDefaultPath(session.role));
    }
  }, [isHydrated, pathname, roles, router, session]);

  if (!isHydrated) {
    return (
      <div className="auth-loading">
        <div className="spinner" aria-hidden />
        <span>正在加载登录状态...</span>
      </div>
    );
  }

  if (!session || (roles && !roles.includes(session.role)) || !canAccessPath(session.role, pathname)) {
    return (
      <div className="auth-loading">
        <div className="spinner" aria-hidden />
        <span>正在进入可访问页面...</span>
      </div>
    );
  }

  return <>{children}</>;
}
