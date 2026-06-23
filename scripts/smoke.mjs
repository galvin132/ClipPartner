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
  "/partner/tasks?limit=1",
  "/partner/wallet?limit=1",
  "/partner/authorizations?limit=1"
];

const targets = [
  ...frontendPaths.map((path) => `${frontendBase}${path}`),
  ...apiPaths.map((path) => `${apiBase}${path}`)
];

let hasFailure = false;

for (const target of targets) {
  try {
    const response = await fetch(target);
    if (!response.ok) {
      hasFailure = true;
      console.error(`${target} -> ${response.status}`);
      continue;
    }
    console.log(`${target} -> ${response.status}`);
  } catch (error) {
    hasFailure = true;
    console.error(`${target} -> ${error instanceof Error ? error.message : "failed"}`);
  }
}

if (hasFailure) {
  process.exit(1);
}
