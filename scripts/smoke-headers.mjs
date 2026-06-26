export function mockHeadersForApiPath(path) {
  if (path.startsWith("/admin/") || path === "/state") {
    return {
      "x-clip-auth-provider": "mock",
      "x-clip-role": path.startsWith("/admin/settlements") ? "finance" : "admin",
      "x-clip-user-id": "smoke-admin",
      "x-clip-display-name": "Smoke Admin"
    };
  }

  if (
    path.startsWith("/partner/") ||
    path.startsWith("/claims/") ||
    path === "/authorization-requests" ||
    path === "/account-bindings"
  ) {
    return {
      "x-clip-auth-provider": "mock",
      "x-clip-role": "partner",
      "x-clip-user-id": "smoke-partner",
      "x-clip-display-name": "Smoke Partner"
    };
  }

  if (
    path.startsWith("/materials") ||
    path.startsWith("/products") ||
    path.startsWith("/clip-tasks") ||
    path.startsWith("/publish-records") ||
    path.startsWith("/risk-records") ||
    path.startsWith("/ffmpeg/")
  ) {
    return {
      "x-clip-auth-provider": "mock",
      "x-clip-role": "reviewer",
      "x-clip-user-id": "smoke-reviewer",
      "x-clip-display-name": "Smoke Reviewer"
    };
  }

  if (path.startsWith("/settlements")) {
    return {
      "x-clip-auth-provider": "mock",
      "x-clip-role": "finance",
      "x-clip-user-id": "smoke-finance",
      "x-clip-display-name": "Smoke Finance"
    };
  }

  return {};
}
