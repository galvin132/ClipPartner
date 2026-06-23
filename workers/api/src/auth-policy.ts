export type UserRole = "admin" | "reviewer" | "finance" | "partner";

export type AuthPolicyEnv = {
  APP_ENV?: string;
  ALLOW_MOCK_AUTH?: string;
};

export const USER_ROLES = new Set<UserRole>(["admin", "reviewer", "finance", "partner"]);

export function isUserRole(value: string | null): value is UserRole {
  return Boolean(value && USER_ROLES.has(value as UserRole));
}

export function isMockAuthAllowed(env: AuthPolicyEnv) {
  return env.APP_ENV !== "production" && env.ALLOW_MOCK_AUTH === "true";
}

export function allowMissingSessionForMockRead(env: AuthPolicyEnv, method: string) {
  return method === "GET" && isMockAuthAllowed(env);
}

export function taskClaimOwnershipFilter(claimId: string, distributorId: string) {
  return `id=eq.${encodeURIComponent(claimId)}&distributor_id=eq.${encodeURIComponent(distributorId)}`;
}

export function routeRoles(pathname: string, method: string): UserRole[] | null {
  if (pathname === "/state") {
    return ["admin", "reviewer", "finance"];
  }

  if (pathname === "/settlements") {
    return ["admin", "finance"];
  }

  if (
    pathname === "/authorization-requests" ||
    pathname === "/account-bindings" ||
    pathname === "/clip-tasks" ||
    pathname === "/materials" ||
    pathname === "/products" ||
    pathname === "/publish-records" ||
    pathname === "/risk-records"
  ) {
    return ["admin", "reviewer"];
  }

  if (pathname === "/notifications" || /^\/notifications\/[^/]+\/read$/.test(pathname)) {
    return ["admin", "reviewer", "finance", "partner"];
  }

  if (method !== "GET") {
    if (pathname === "/authorization-requests" || /^\/materials\/[^/]+\/claim$/.test(pathname)) {
      return ["partner"];
    }

    if (pathname === "/account-bindings" || /^\/publish-records\/[^/]+\/submit$/.test(pathname)) {
      return ["partner"];
    }

    if (/^\/authorization-requests\/[^/]+$/.test(pathname) || /^\/account-bindings\/[^/]+$/.test(pathname)) {
      return ["admin", "reviewer"];
    }

    if (
      pathname === "/materials" ||
      pathname === "/products" ||
      pathname === "/clip-tasks" ||
      pathname === "/recordings/direct-upload/init" ||
      pathname === "/recordings/direct-upload/complete" ||
      pathname === "/recordings/upload" ||
      pathname === "/risk-records" ||
      /^\/materials\/[^/]+(\/product)?$/.test(pathname) ||
      /^\/clip-tasks\/[^/]+(\/complete)?$/.test(pathname) ||
      /^\/products\/[^/]+$/.test(pathname) ||
      /^\/risk-records\/[^/]+$/.test(pathname) ||
      /^\/publish-records\/[^/]+(\/performance)?$/.test(pathname)
    ) {
      return ["admin", "reviewer"];
    }

    if (pathname === "/state/reset" || pathname.startsWith("/settlements/") || pathname === "/settlements/generate") {
      return ["admin", "finance"];
    }
  }

  if (pathname.startsWith("/admin/settlements")) {
    return ["admin", "finance"];
  }

  if (pathname.startsWith("/admin/risk-events")) {
    return ["admin", "reviewer"];
  }

  if (pathname.startsWith("/admin/")) {
    return ["admin", "reviewer"];
  }

  if (pathname.startsWith("/partner/") || /^\/claims\/[^/]+\/(download-url|submit)$/.test(pathname)) {
    return ["partner"];
  }

  return null;
}
