import { mockHeadersForApiPath } from "./smoke-headers.mjs";

const frontendBase = process.env.SMOKE_FRONTEND_BASE || "http://127.0.0.1:3000";
const apiBase = process.env.SMOKE_API_BASE || "http://127.0.0.1:8787";

const frontendPaths = [
  "/",
  "/login",
  "/admin/distributors",
  "/admin/authorization-pools",
  "/admin/distribution-tasks",
  "/admin/training",
  "/admin/materials",
  "/admin/clip-tasks",
  "/admin/products",
  "/partner",
  "/partner/accounts",
  "/partner/onboarding",
  "/partner/authorizations",
  "/partner/tasks",
  "/partner/wallet"
];

const apiPaths = [
  "/health",
  "/me",
  "/materials?limit=1",
  "/account-bindings?limit=1",
  "/clip-tasks?limit=1",
  "/admin/authorization-pools?limit=1",
  "/admin/distribution-tasks?limit=1",
  "/admin/distributors?limit=1",
  "/admin/performance-imports?limit=1",
  "/ffmpeg/jobs?limit=1",
  "/partner/tasks?limit=1",
  "/partner/wallet?limit=1",
  "/partner/authorizations?limit=1",
  "/partner/social-accounts?limit=1",
  "/partner/authorization-requests?limit=1"
];

const targets = [
  ...frontendPaths.map((path) => ({ url: `${frontendBase}${path}` })),
  ...apiPaths.map((path) => ({ url: `${apiBase}${path}`, headers: mockHeadersForApiPath(path) }))
];

let hasFailure = false;

for (const target of targets) {
  try {
    const response = await fetch(target.url, { headers: target.headers });
    if (!response.ok) {
      hasFailure = true;
      console.error(`${target.url} -> ${response.status}`);
      continue;
    }
    console.log(`${target.url} -> ${response.status}`);
  } catch (error) {
    hasFailure = true;
    console.error(`${target.url} -> ${error instanceof Error ? error.message : "failed"}`);
  }
}

if (hasFailure) {
  process.exit(1);
}
