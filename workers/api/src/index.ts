/// <reference types="@cloudflare/workers-types" />

type PlatformLabel = "抖音" | "视频号";
type PlatformValue = "douyin" | "wechat_channels";

type AuthorizationStatus = "pending" | "approved" | "rejected" | "paused" | "banned" | "expired";
type MaterialStatus = "draft" | "processing" | "ready" | "published" | "archived";
type PublishStatus = "claimed" | "downloaded" | "submitted" | "verified" | "invalid" | "settled";
type SettlementStatus = "pending" | "confirmed" | "paid" | "blocked";

type AuthorizationRequestInput = {
  distributorName: string;
  socialAccount: string;
  platform: PlatformLabel;
  ipName: string;
  reason: string;
};

type MaterialInput = {
  title: string;
  ipName: string;
  sourcePlatform: PlatformLabel;
  productName: string;
};

export interface Env {
  APP_ENV: string;
  FRONTEND_ORIGIN: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WECHAT_OAUTH_APP_ID?: string;
  WECHAT_OAUTH_APP_SECRET?: string;
  WECHAT_OAUTH_REDIRECT_URI?: string;
  FFMPEG_WORKER_ENDPOINT?: string;
  FFMPEG_WORKER_TOKEN?: string;
  CLIP_PARTNER_BUCKET: R2Bucket;
  CLIP_TASK_QUEUE: Queue;
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

const platformToValue: Record<PlatformLabel, PlatformValue> = {
  抖音: "douyin",
  视频号: "wechat_channels"
};

const platformToLabel: Record<PlatformValue, PlatformLabel> = {
  douyin: "抖音",
  wechat_channels: "视频号"
};

function corsHeaders(env: Env) {
  return {
    "access-control-allow-origin": env.FRONTEND_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  };
}

function json(data: unknown, env: Env, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...corsHeaders(env),
      ...init.headers
    }
  });
}

function requireSupabase(env: Env) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured");
  }

  return {
    restUrl: `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}

async function supabase<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const { restUrl, serviceKey } = requireSupabase(env);
  const response = await fetch(`${restUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed ${response.status}: ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function selectRows<T>(env: Env, table: string, query = "select=*") {
  return supabase<T[]>(env, `/${table}?${query}`);
}

async function insertRow<T>(env: Env, table: string, body: Record<string, unknown>) {
  return supabase<T[]>(env, `/${table}`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(body)
  }).then((rows) => rows[0]);
}

async function patchRows<T>(env: Env, table: string, filter: string, body: Record<string, unknown>) {
  return supabase<T[]>(env, `/${table}?${filter}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(body)
  });
}

async function deleteRows(env: Env, table: string) {
  await supabase<void>(env, `/${table}?id=not.is.null`, {
    method: "DELETE"
  });
}

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function first<T>(rows: T[]) {
  return rows[0];
}

async function findOrCreateDistributor(env: Env, displayName: string, phone = "待绑定") {
  const existing = await selectRows<{ id: string }>(
    env,
    "distributor_profiles",
    `select=id&${eq("display_name", displayName)}&limit=1`
  );
  if (first(existing)) return first(existing);

  return insertRow<{ id: string }>(env, "distributor_profiles", {
    user_id: crypto.randomUUID(),
    display_name: displayName,
    phone,
    status: "approved"
  });
}

async function findOrCreateIp(env: Env, name: string, platform: PlatformLabel) {
  const existing = await selectRows<{ id: string }>(env, "ip_accounts", `select=id&${eq("name", name)}&limit=1`);
  if (first(existing)) return first(existing);

  return insertRow<{ id: string }>(env, "ip_accounts", {
    name,
    platform: platformToValue[platform],
    description: `${name} 直播切片 IP`,
    default_share_rate: 50
  });
}

async function findOrCreateSocialAccount(
  env: Env,
  distributorId: string,
  accountName: string,
  platform: PlatformLabel
) {
  const existing = await selectRows<{ id: string }>(
    env,
    "social_accounts",
    `select=id&distributor_id=eq.${distributorId}&${eq("account_name", accountName)}&limit=1`
  );
  if (first(existing)) return first(existing);

  return insertRow<{ id: string }>(env, "social_accounts", {
    distributor_id: distributorId,
    platform: platformToValue[platform],
    account_name: accountName
  });
}

async function findOrCreateProduct(env: Env, name: string, platform: PlatformLabel) {
  const existing = await selectRows<{ id: string }>(env, "products", `select=id&${eq("name", name)}&limit=1`);
  if (first(existing)) return first(existing);

  return insertRow<{ id: string }>(env, "products", {
    name,
    platform: platformToValue[platform],
    affiliate_url: "https://example.com/product",
    commission_rate: 15
  });
}

async function createAuthorizationRequest(env: Env, input: AuthorizationRequestInput) {
  const distributor = await findOrCreateDistributor(env, input.distributorName);
  const ip = await findOrCreateIp(env, input.ipName, input.platform);
  const social = await findOrCreateSocialAccount(env, distributor.id, input.socialAccount, input.platform);

  await insertRow(env, "authorization_requests", {
    distributor_id: distributor.id,
    ip_account_id: ip.id,
    social_account_id: social.id,
    status: "pending",
    application_note: input.reason
  });
}

async function createMaterial(env: Env, input: MaterialInput) {
  const ip = await findOrCreateIp(env, input.ipName, input.sourcePlatform);
  const product = await findOrCreateProduct(env, input.productName, input.sourcePlatform);
  const clip = await insertRow<{ id: string }>(env, "clip_assets", {
    ip_account_id: ip.id,
    title: input.title,
    status: "processing",
    tags: ["待标注"],
    start_second: 0,
    end_second: 0
  });

  await insertRow(env, "clip_products", {
    clip_asset_id: clip.id,
    product_id: product.id,
    is_primary: true
  });
}

async function claimMaterial(env: Env, clipAssetId: string, distributorName = "周婧") {
  const clipRows = await selectRows<{
    id: string;
    title: string;
    ip_account_id: string;
    ip_accounts: { platform: PlatformValue } | null;
    clip_products: { product_id: string; products: { name: string } | null }[];
  }>(
    env,
    "clip_assets",
    `select=id,title,ip_account_id,ip_accounts(platform),clip_products(product_id,products(name))&id=eq.${clipAssetId}&limit=1`
  );
  const clip = first(clipRows);
  if (!clip) throw new Error("Clip asset not found");

  const platform = platformToLabel[clip.ip_accounts?.platform ?? "wechat_channels"];
  const productId = clip.clip_products[0]?.product_id;
  if (!productId) throw new Error("Clip asset has no product");

  const distributor = await findOrCreateDistributor(env, distributorName, "186****7108");
  const social = await findOrCreateSocialAccount(env, distributor.id, "小周好物局", platform);
  const claim = await insertRow<{ id: string }>(env, "clip_claims", {
    distributor_id: distributor.id,
    clip_asset_id: clip.id,
    product_id: productId,
    social_account_id: social.id,
    planned_platform: platformToValue[platform]
  });

  await insertRow(env, "clip_downloads", {
    claim_id: claim.id,
    distributor_id: distributor.id,
    clip_asset_id: clip.id,
    download_version: "watermarked"
  });

  await insertRow(env, "publish_records", {
    claim_id: claim.id,
    distributor_id: distributor.id,
    clip_asset_id: clip.id,
    product_id: productId,
    platform: platformToValue[platform],
    publish_url: "待回填",
    status: "downloaded"
  });
}

async function importPerformance(env: Env, publishRecordId: string, gmv: number, commission: number) {
  await patchRows(env, "publish_records", `id=eq.${publishRecordId}`, {
    status: "verified",
    verified_at: new Date().toISOString()
  });
  await insertRow(env, "performance_snapshots", {
    publish_record_id: publishRecordId,
    gmv,
    commission_amount: commission
  });
}

async function generateSettlement(env: Env) {
  const records = await selectRows<{
    id: string;
    distributor_id: string;
    performance_snapshots: { commission_amount: number }[];
  }>(
    env,
    "publish_records",
    "select=id,distributor_id,performance_snapshots(commission_amount)&status=eq.verified"
  );

  const payable = records.reduce((sum, record) => {
    const latest = record.performance_snapshots.at(-1);
    return sum + Number(latest?.commission_amount ?? 0) * 0.5;
  }, 0);

  const distributor = records[0]?.distributor_id ?? (await findOrCreateDistributor(env, "本月汇总")).id;
  await insertRow(env, "settlement_orders", {
    distributor_id: distributor,
    period: new Date().toISOString().slice(0, 7),
    status: "pending",
    total_amount: payable
  });
}

async function listState(env: Env) {
  let [authorizationRequests, materials, publishRecords, settlements] = await Promise.all([
    listAuthorizationRequests(env),
    listMaterials(env),
    listPublishRecords(env),
    listSettlements(env)
  ]);

  if (
    authorizationRequests.length === 0 &&
    materials.length === 0 &&
    publishRecords.length === 0 &&
    settlements.length === 0
  ) {
    await seedDemoData(env);
    [authorizationRequests, materials, publishRecords, settlements] = await Promise.all([
      listAuthorizationRequests(env),
      listMaterials(env),
      listPublishRecords(env),
      listSettlements(env)
    ]);
  }

  return { authorizationRequests, materials, publishRecords, settlements };
}

async function listAuthorizationRequests(env: Env) {
  const rows = await selectRows<{
    id: string;
    status: AuthorizationStatus;
    application_note: string | null;
    created_at: string;
    distributor_profiles: { display_name: string; phone: string | null } | null;
    ip_accounts: { name: string } | null;
    social_accounts: { account_name: string; platform: PlatformValue } | null;
  }>(
    env,
    "authorization_requests",
    "select=id,status,application_note,created_at,distributor_profiles(display_name,phone),ip_accounts(name),social_accounts(account_name,platform)&order=created_at.desc"
  );

  return rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "未知分发者",
    phone: row.distributor_profiles?.phone ?? "待绑定",
    socialAccount: row.social_accounts?.account_name ?? "待绑定账号",
    platform: platformToLabel[row.social_accounts?.platform ?? "douyin"],
    ipName: row.ip_accounts?.name ?? "未知 IP",
    status: row.status,
    appliedAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
    reason: row.application_note ?? ""
  }));
}

async function listMaterials(env: Env) {
  const [clips, claims, downloads] = await Promise.all([
    selectRows<{
      id: string;
      title: string;
      status: MaterialStatus;
      tags: string[];
      start_second: number | null;
      end_second: number | null;
      created_at: string;
      ip_accounts: { name: string; platform: PlatformValue } | null;
      clip_products: { products: { name: string } | null }[];
    }>(
      env,
      "clip_assets",
      "select=id,title,status,tags,start_second,end_second,created_at,ip_accounts(name,platform),clip_products(products(name))&order=created_at.desc"
    ),
    selectRows<{ clip_asset_id: string }>(env, "clip_claims", "select=clip_asset_id"),
    selectRows<{ clip_asset_id: string }>(env, "clip_downloads", "select=clip_asset_id")
  ]);

  return clips.map((clip) => ({
    id: clip.id,
    title: clip.title,
    ipName: clip.ip_accounts?.name ?? "未知 IP",
    sourcePlatform: platformToLabel[clip.ip_accounts?.platform ?? "douyin"],
    liveDate: clip.created_at.slice(0, 10),
    duration:
      clip.end_second && clip.start_second && clip.end_second > clip.start_second
        ? `${clip.end_second - clip.start_second}s`
        : "待切片",
    tags: clip.tags?.length ? clip.tags : ["待标注"],
    productName: clip.clip_products[0]?.products?.name ?? "待绑定商品",
    status: clip.status,
    claims: claims.filter((claim) => claim.clip_asset_id === clip.id).length,
    downloads: downloads.filter((download) => download.clip_asset_id === clip.id).length
  }));
}

async function listPublishRecords(env: Env) {
  const rows = await selectRows<{
    id: string;
    status: PublishStatus;
    platform: PlatformValue;
    submitted_at: string;
    distributor_profiles: { display_name: string } | null;
    clip_assets: { title: string } | null;
    products: { name: string } | null;
    performance_snapshots: { gmv: number; commission_amount: number; captured_at: string }[];
  }>(
    env,
    "publish_records",
    "select=id,status,platform,submitted_at,distributor_profiles(display_name),clip_assets(title),products(name),performance_snapshots(gmv,commission_amount,captured_at)&order=submitted_at.desc"
  );

  return rows.map((row) => {
    const latest = row.performance_snapshots.at(-1);
    return {
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "未知分发者",
      materialTitle: row.clip_assets?.title ?? "未知素材",
      productName: row.products?.name ?? "未知商品",
      platform: platformToLabel[row.platform],
      status: row.status,
      submittedAt: new Date(row.submitted_at).toLocaleString("zh-CN", { hour12: false }),
      gmv: Number(latest?.gmv ?? 0),
      commission: Number(latest?.commission_amount ?? 0)
    };
  });
}

async function listSettlements(env: Env) {
  const rows = await selectRows<{
    id: string;
    period: string;
    status: SettlementStatus;
    total_amount: number;
    distributor_profiles: { display_name: string } | null;
  }>(
    env,
    "settlement_orders",
    "select=id,period,status,total_amount,distributor_profiles(display_name)&order=created_at.desc"
  );

  return rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "本月汇总",
    period: row.period,
    verifiedPosts: 0,
    payableCommission: Number(row.total_amount),
    status: row.status
  }));
}

async function seedDemoData(env: Env) {
  await createAuthorizationRequest(env, {
    distributorName: "李晨",
    socialAccount: "晨剪精选",
    platform: "抖音",
    ipName: "老许家居",
    reason: "已有家居垂类账号，计划每日发布 3 条切片。"
  });
  await createAuthorizationRequest(env, {
    distributorName: "周婧",
    socialAccount: "小周好物局",
    platform: "视频号",
    ipName: "晴姐穿搭",
    reason: "视频号粉丝 1.8 万，女装转化稳定。"
  });
  await createMaterial(env, {
    title: "晴姐讲解夏季通勤套装三件套",
    ipName: "晴姐穿搭",
    sourcePlatform: "抖音",
    productName: "冰感通勤套装"
  });
}

async function resetState(env: Env) {
  const tables = [
    "settlement_order_items",
    "settlement_orders",
    "commission_records",
    "performance_snapshots",
    "publish_records",
    "clip_downloads",
    "clip_claims",
    "clip_products",
    "clip_assets",
    "authorization_requests",
    "authorizations",
    "social_accounts",
    "products",
    "ip_accounts",
    "distributor_profiles",
    "violation_records",
    "violation_leads"
  ];
  for (const table of tables) {
    await deleteRows(env, table).catch(() => undefined);
  }
  await seedDemoData(env);
}

function integrationStatus(env: Env) {
  const groups = [
    {
      key: "supabase",
      required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    },
    {
      key: "wechatOAuth",
      required: ["WECHAT_OAUTH_APP_ID", "WECHAT_OAUTH_APP_SECRET", "WECHAT_OAUTH_REDIRECT_URI"]
    },
    {
      key: "ffmpegWorker",
      required: ["FFMPEG_WORKER_ENDPOINT", "FFMPEG_WORKER_TOKEN"]
    }
  ];

  return groups.map((group) => {
    const configured = group.required.filter((key) => Boolean(env[key as keyof Env]));
    return {
      key: group.key,
      configuredCount: configured.length,
      totalCount: group.required.length,
      missingKeys: group.required.filter((key) => !env[key as keyof Env]),
      isConfigured: configured.length === group.required.length
    };
  });
}

async function readBody<T>(request: Request) {
  return request.json().catch(() => ({})) as Promise<T>;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders(env) });
      }

      if (url.pathname === "/health") {
        return json({ service: "clip-partner-api", runtime: "cloudflare-workers", status: "ok" }, env);
      }

      if (url.pathname === "/integrations") {
        return json({ integrations: integrationStatus(env) }, env);
      }

      if (url.pathname === "/state" && request.method === "GET") {
        return json(await listState(env), env);
      }

      if (url.pathname === "/state/reset" && request.method === "POST") {
        await resetState(env);
        return json(await listState(env), env);
      }

      if (url.pathname === "/authorization-requests" && request.method === "POST") {
        await createAuthorizationRequest(env, await readBody<AuthorizationRequestInput>(request));
        return json(await listState(env), env, { status: 201 });
      }

      const authorizationMatch = url.pathname.match(/^\/authorization-requests\/([^/]+)$/);
      if (authorizationMatch && request.method === "PATCH") {
        const body = await readBody<{ status: AuthorizationStatus }>(request);
        await patchRows(env, "authorization_requests", `id=eq.${authorizationMatch[1]}`, { status: body.status });
        return json(await listState(env), env);
      }

      if (url.pathname === "/materials" && request.method === "POST") {
        await createMaterial(env, await readBody<MaterialInput>(request));
        return json(await listState(env), env, { status: 201 });
      }

      const materialMatch = url.pathname.match(/^\/materials\/([^/]+)$/);
      if (materialMatch && request.method === "PATCH") {
        const body = await readBody<{ status: MaterialStatus }>(request);
        await patchRows(env, "clip_assets", `id=eq.${materialMatch[1]}`, { status: body.status });
        return json(await listState(env), env);
      }

      const claimMatch = url.pathname.match(/^\/materials\/([^/]+)\/claim$/);
      if (claimMatch && request.method === "POST") {
        const body = await readBody<{ distributorName?: string }>(request);
        await claimMaterial(env, claimMatch[1], body.distributorName);
        return json(await listState(env), env, { status: 201 });
      }

      const submitPublishMatch = url.pathname.match(/^\/publish-records\/([^/]+)\/submit$/);
      if (submitPublishMatch && request.method === "POST") {
        await patchRows(env, "publish_records", `id=eq.${submitPublishMatch[1]}`, {
          status: "submitted",
          submitted_at: new Date().toISOString(),
          publish_url: "https://example.com/published-work"
        });
        return json(await listState(env), env);
      }

      const performanceMatch = url.pathname.match(/^\/publish-records\/([^/]+)\/performance$/);
      if (performanceMatch && request.method === "POST") {
        const body = await readBody<{ gmv: number; commission: number }>(request);
        await importPerformance(env, performanceMatch[1], body.gmv, body.commission);
        return json(await listState(env), env);
      }

      const publishMatch = url.pathname.match(/^\/publish-records\/([^/]+)$/);
      if (publishMatch && request.method === "PATCH") {
        const body = await readBody<{ status: PublishStatus }>(request);
        await patchRows(env, "publish_records", `id=eq.${publishMatch[1]}`, {
          status: body.status,
          verified_at: body.status === "verified" ? new Date().toISOString() : null
        });
        return json(await listState(env), env);
      }

      if (url.pathname === "/settlements/generate" && request.method === "POST") {
        await generateSettlement(env);
        return json(await listState(env), env, { status: 201 });
      }

      const settlementMatch = url.pathname.match(/^\/settlements\/([^/]+)$/);
      if (settlementMatch && request.method === "PATCH") {
        const body = await readBody<{ status: SettlementStatus }>(request);
        await patchRows(env, "settlement_orders", `id=eq.${settlementMatch[1]}`, { status: body.status });
        return json(await listState(env), env);
      }

      if (url.pathname === "/clip-tasks" && request.method === "POST") {
        const body = await readBody<Record<string, unknown>>(request);
        await env.CLIP_TASK_QUEUE.send({
          type: "clip.create",
          payload: body,
          createdAt: new Date().toISOString()
        });

        return json({ ok: true, queued: true }, env, { status: 202 });
      }

      return json({ error: "Not found" }, env, { status: 404 });
    } catch (error) {
      return json(
        {
          error: error instanceof Error ? error.message : "Unknown error"
        },
        env,
        { status: 500 }
      );
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await env.CLIP_TASK_QUEUE.send({
      type: "cron.scan",
      createdAt: new Date().toISOString()
    });
  }
};

export default worker;
