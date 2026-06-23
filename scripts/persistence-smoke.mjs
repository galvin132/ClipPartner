import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const apiBase = process.env.PERSISTENCE_SMOKE_API_BASE || "http://127.0.0.1:8787";
const mockReadUserId = "00000000-0000-0000-0000-000000000001";

function loadEnvFile(path) {
  try {
    const raw = readFileSync(resolve(path), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Env files are optional; CI can pass values through the environment.
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.development");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if ((!supabaseUrl || !serviceRoleKey) && process.env.PERSISTENCE_SMOKE_KEEP_DATA !== "1") {
  throw new Error(
    "Persistence smoke needs Supabase env for cleanup. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or set PERSISTENCE_SMOKE_KEEP_DATA=1."
  );
}

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const suffix = `E2E-${stamp}`;
const names = {
  distributor: `${suffix}-Distributor`,
  account: `${suffix}-douyin-account`,
  ip: `${suffix}-IP`,
  product: `${suffix}-Product`,
  material: `${suffix}-Material`,
  task: `${suffix}-Task`,
  risk: `${suffix}-Risk`
};

async function api(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function supabase(path, init = {}) {
  if (!supabaseUrl || !serviceRoleKey) return null;
  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      ...init.headers
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase ${init.method || "GET"} ${path} -> ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function find(items, predicate, label) {
  const item = (items || []).find(predicate);
  if (!item) throw new Error(`Missing ${label}`);
  return item;
}

async function cleanup(notificationId) {
  if (process.env.PERSISTENCE_SMOKE_KEEP_DATA === "1") {
    console.log(`Kept persistence smoke data with prefix ${suffix}`);
    return;
  }
  if (!supabaseUrl || !serviceRoleKey) return;

  const prefer = { prefer: "return=minimal" };
  if (notificationId) {
    await supabase(
      `/notification_reads?notification_id=eq.${encodeURIComponent(notificationId)}&user_id=eq.${mockReadUserId}`,
      { method: "DELETE", headers: prefer }
    );
  }
  await supabase(`/risk_events?title=eq.${encodeURIComponent(names.risk)}`, { method: "DELETE", headers: prefer });
  await supabase(`/distributor_profiles?display_name=eq.${encodeURIComponent(names.distributor)}`, {
    method: "DELETE",
    headers: prefer
  });
  await supabase(`/distribution_tasks?title=eq.${encodeURIComponent(names.task)}`, { method: "DELETE", headers: prefer });
  await supabase(`/clip_assets?title=eq.${encodeURIComponent(names.material)}`, { method: "DELETE", headers: prefer });
  await supabase(`/products?name=eq.${encodeURIComponent(names.product)}`, { method: "DELETE", headers: prefer });
  await supabase(`/ip_accounts?name=eq.${encodeURIComponent(names.ip)}`, { method: "DELETE", headers: prefer });
}

let notificationId;

try {
  await api("/partner/profile", {
    method: "POST",
    body: JSON.stringify({
      distributorName: names.distributor,
      phone: "13900000000",
      wechatId: suffix,
      onboardingStatus: "training_pending"
    })
  });
  await api("/partner/exam-attempts", { method: "POST", body: JSON.stringify({ distributorName: names.distributor, score: 92 }) });
  let state = await api("/partner/agreements/sign", { method: "POST", body: JSON.stringify({ distributorName: names.distributor }) });
  find(state.distributorProfiles, (item) => item.displayName === names.distributor, "profile");

  state = await api("/account-bindings", {
    method: "POST",
    body: JSON.stringify({
      distributorName: names.distributor,
      platform: "douyin",
      accountName: names.account,
      homepageUrl: `https://example.com/${suffix}/account`,
      followers: 5000,
      category: "E2E",
      note: suffix
    })
  });
  const account = find(
    state.accountBindings,
    (item) => item.distributorName === names.distributor && item.accountName === names.account,
    "account"
  );
  await api(`/account-bindings/${account.id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) });

  state = await api("/admin/authorization-pools", {
    method: "POST",
    body: JSON.stringify({
      ipName: names.ip,
      platform: "douyin",
      totalQuota: 3,
      minCreditScore: 80,
      defaultShareRate: 35,
      dailyClaimLimit: 2,
      requirement: suffix
    })
  });
  find(state.authorizationPools, (item) => item.ipName === names.ip, "authorization pool");

  state = await api("/authorization-requests", {
    method: "POST",
    body: JSON.stringify({
      distributorName: names.distributor,
      socialAccount: names.account,
      platform: "douyin",
      ipName: names.ip,
      reason: suffix
    })
  });
  const authRequest = find(
    state.authorizationRequests,
    (item) => item.distributorName === names.distributor && item.socialAccount === names.account && item.ipName === names.ip,
    "authorization request"
  );
  state = await api(`/admin/authorization-requests/${authRequest.id}/review`, {
    method: "PATCH",
    body: JSON.stringify({ status: "approved", reviewNote: suffix })
  });
  find(state.formalAuthorizations, (item) => item.distributorName === names.distributor && item.status === "approved", "authorization");

  state = await api("/materials", {
    method: "POST",
    body: JSON.stringify({ title: names.material, ipName: names.ip, sourcePlatform: "douyin", productName: names.product })
  });
  const material = find(state.materials, (item) => item.title === names.material, "material");
  state = await api(`/materials/${material.id}`, { method: "PATCH", body: JSON.stringify({ status: "published" }) });
  find(state.materials, (item) => item.id === material.id && item.status === "published", "published material");

  state = await api("/admin/distribution-tasks", {
    method: "POST",
    body: JSON.stringify({
      title: names.task,
      ipName: names.ip,
      platform: "douyin",
      productName: names.product,
      materialIds: [material.id],
      endAt: "2026-07-30",
      rewardRule: suffix,
      claimLimit: 3,
      requirement: suffix
    })
  });
  const task = find(state.distributionTasks, (item) => item.title === names.task, "distribution task");
  state = await api(`/partner/tasks/${task.id}/claim`, {
    method: "POST",
    body: JSON.stringify({ distributorName: names.distributor })
  });
  const claim = find(state.taskClaims, (item) => item.taskId === task.id && item.status === "downloaded", "downloaded claim");

  state = await api(`/claims/${claim.id}/submit`, {
    method: "POST",
    body: JSON.stringify({ publishUrl: `https://example.com/${suffix}/published-work-valid` })
  });
  find(state.taskClaims, (item) => item.id === claim.id && item.status === "submitted", "submitted claim");

  state = await api("/partner/wallet/transactions", {
    method: "POST",
    body: JSON.stringify({
      distributorName: names.distributor,
      type: "commission",
      amount: 88,
      status: "available",
      source: suffix,
      note: "E2E wallet transaction"
    })
  });
  find(state.walletTransactions, (item) => item.distributorName === names.distributor && item.source === suffix, "wallet transaction");

  await api("/admin/risk-events", {
    method: "POST",
    body: JSON.stringify({ distributorName: names.distributor, title: names.risk, description: suffix })
  });
  const riskRows = await supabase(`/risk_events?select=id&title=eq.${encodeURIComponent(names.risk)}&limit=1`);
  const riskEventId = riskRows?.[0]?.id;
  if (!riskEventId) throw new Error("Missing risk event");

  state = await api(`/admin/risk-events/${riskEventId}/action`, {
    method: "PATCH",
    body: JSON.stringify({
      actionType: "freeze_wallet_pause_authorization",
      note: "E2E risk action",
      creditDelta: -30,
      freezeWallet: true,
      pauseAuthorization: true
    })
  });
  find(state.formalAuthorizations, (item) => item.distributorName === names.distributor && item.status === "paused", "paused authorization");
  find(state.walletTransactions, (item) => item.distributorName === names.distributor && item.type === "freeze", "freeze transaction");

  await api("/partner/appeals", {
    method: "POST",
    body: JSON.stringify({ distributorName: names.distributor, riskEventId, reason: "E2E appeal" })
  });

  const notifications = await api("/notifications?limit=1");
  notificationId = notifications.notifications?.[0]?.id;
  if (notificationId) {
    await api(`/notifications/${notificationId}/read`, { method: "POST" });
  }

  console.log(`Persistence smoke passed with prefix ${suffix}`);
} finally {
  await cleanup(notificationId);
}
