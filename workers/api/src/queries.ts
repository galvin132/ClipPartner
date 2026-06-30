/// <reference types="@cloudflare/workers-types" />

import type { WorkerEnv } from "./env.ts";
import type { RequestSession } from "./session.ts";
import {
  DEFAULT_AGREEMENT_NAME,
  DEFAULT_AGREEMENT_VERSION,
  asOnboardingStatus,
  platformToLabel,
  type AccountBindingStatus,
  type AuthorizationPoolStatus,
  type AuthorizationStatus,
  type DistributionTaskStatus,
  type MaterialStatus,
  type PublishStatus,
  type RiskStatus,
  type SettlementStatus,
  type TaskClaimStatus,
  type WalletTransactionStatus,
  type WalletTransactionType
} from "./domain.ts";
import {
  buildListQuery,
  countBy,
  dateOnly,
  eq,
  filterParam,
  first,
  formatDateTime,
  inList,
  listMeta,
  listOptions,
  safeRows,
  searchQuery,
  type PlatformValue
} from "./query-utils.ts";
import { selectRows } from "./supabase-rest.ts";

export async function findDistributorForSession(env: WorkerEnv, session: RequestSession | null) {
  if (!session || session.role !== "partner") return null;
  if (session.provider === "supabase" && session.userId) {
    return first(
      await safeRows(() =>
        selectRows<{ id: string }>(env, "distributor_profiles", `select=id&user_id=eq.${session.userId}&limit=1`)
      )
    );
  }

  if (session.provider === "better-auth" && session.userId) {
    const userId = session.userId;
    const profileLink = first(
      await safeRows(() =>
        selectRows<{ distributor_profile_id: string | null }>(
          env,
          "app_user_profiles",
          `select=distributor_profile_id&better_auth_user_id=eq.${encodeURIComponent(userId)}&limit=1`
        )
      )
    );
    if (profileLink?.distributor_profile_id) {
      return { id: profileLink.distributor_profile_id };
    }
  }

  return first(
    await safeRows(() =>
      selectRows<{ id: string }>(
        env,
        "distributor_profiles",
        `select=id&${eq("display_name", session.displayName)}&limit=1`
      )
    )
  );
}

export async function distributorFilterForSession(env: WorkerEnv, session: RequestSession | null) {
  const distributor = await findDistributorForSession(env, session);
  return distributor ? filterParam("distributor_id", "eq", distributor.id) : filterParam("distributor_id", "eq", "00000000-0000-0000-0000-000000000000");
}

export async function listAuthorizationRequests(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
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
    buildListQuery(
      "select=id,status,application_note,created_at,distributor_profiles(display_name,phone),ip_accounts(name),social_accounts(account_name,platform)",
      "order=created_at.desc",
      options,
      [options.status ? filterParam("status", "eq", options.status) : undefined]
    )
  );

  const authorizationRequests = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    phone: row.distributor_profiles?.phone ?? "Pending binding",
    socialAccount: row.social_accounts?.account_name ?? "Pending account",
    platform: platformToLabel[row.social_accounts?.platform ?? "douyin"],
    ipName: row.ip_accounts?.name ?? "Unknown IP",
    status: row.status,
    appliedAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
    reason: row.application_note ?? ""
  }));
  return { items: authorizationRequests, meta: listMeta(authorizationRequests, options) };
}

export async function listAccountBindings(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      platform: PlatformValue;
      account_name: string;
      account_url: string | null;
      followers: number | null;
      category: string | null;
      status: AccountBindingStatus | null;
      binding_note: string | null;
      created_at: string;
      distributor_profiles: { display_name: string } | null;
    }>(
      env,
      "social_accounts",
      buildListQuery(
        "select=id,platform,account_name,account_url,followers,category,status,binding_note,created_at,distributor_profiles(display_name)",
        "order=created_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["account_name", "category", "account_url"], options.q)
        ]
      )
    );

    const accountBindings = rows.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      platform: platformToLabel[row.platform],
      accountName: row.account_name,
      homepageUrl: row.account_url ?? "https://example.com/social-account",
      followers: Number(row.followers ?? 0),
      category: row.category ?? "未分类",
      status: row.status ?? "pending",
      boundAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
      note: row.binding_note ?? ""
    }));
    return { items: accountBindings, meta: listMeta(accountBindings, options) };
  } catch {
    const rows = await safeRows(() =>
      selectRows<{
        id: string;
        platform: PlatformValue;
        account_name: string;
        account_url: string | null;
        created_at: string;
        distributor_profiles: { display_name: string } | null;
      }>(
        env,
        "social_accounts",
        buildListQuery(
          "select=id,platform,account_name,account_url,created_at,distributor_profiles(display_name)",
          "order=created_at.desc",
          options,
          [options.platform ? filterParam("platform", "eq", options.platform) : undefined, searchQuery(["account_name", "account_url"], options.q)]
        )
      )
    );

    const accountBindings = rows.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      platform: platformToLabel[row.platform],
      accountName: row.account_name,
      homepageUrl: row.account_url ?? "https://example.com/social-account",
      followers: 0,
      category: "未分类",
      status: "pending" as AccountBindingStatus,
      boundAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
      note: "当前数据库尚未添加账号绑定扩展字段。"
    }));
    return { items: accountBindings, meta: listMeta(accountBindings, options) };
  }
}

export async function listPartnerSocialAccounts(
  env: WorkerEnv,
  options = listOptions(new URLSearchParams()),
  session?: RequestSession | null
) {
  const distributorFilter = await distributorFilterForSession(env, session ?? null);
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      platform: PlatformValue;
      account_name: string;
      account_url: string | null;
      followers: number | null;
      category: string | null;
      status: AccountBindingStatus | null;
      binding_note: string | null;
      created_at: string;
      distributor_profiles: { display_name: string } | null;
    }>(
      env,
      "social_accounts",
      buildListQuery(
        "select=id,platform,account_name,account_url,followers,category,status,binding_note,created_at,distributor_profiles(display_name)",
        "order=created_at.desc",
        options,
        [
          distributorFilter,
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["account_name", "category", "account_url"], options.q)
        ]
      )
    )
  );

  const accountBindings = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    platform: platformToLabel[row.platform],
    accountName: row.account_name,
    homepageUrl: row.account_url ?? "https://example.com/social-account",
    followers: Number(row.followers ?? 0),
    category: row.category ?? "未分类",
    status: row.status ?? "pending",
    boundAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
    note: row.binding_note ?? ""
  }));

  return { items: accountBindings, meta: listMeta(accountBindings, options) };
}

export async function listMaterials(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      title: string;
      ip_name: string | null;
      source_platform: PlatformValue | null;
      live_date: string;
      duration_seconds: number | null;
      tags: string[] | null;
      product_name: string | null;
      status: MaterialStatus;
      claims: number | null;
      downloads: number | null;
      created_at: string;
    }>(
      env,
      "material_summaries",
      buildListQuery(
        "select=id,title,ip_name,source_platform,live_date,duration_seconds,tags,product_name,status,claims,downloads,created_at",
        "order=created_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("source_platform", "eq", options.platform) : undefined,
          searchQuery(["title", "ip_name", "product_name"], options.q)
        ]
      )
    );

    const materials = rows.map((row) => ({
      id: row.id,
      title: row.title,
      ipName: row.ip_name ?? "Unknown IP",
      sourcePlatform: platformToLabel[row.source_platform ?? "douyin"],
      liveDate: row.live_date,
      duration: row.duration_seconds && row.duration_seconds > 0 ? `${row.duration_seconds}s` : "Pending clip",
      tags: row.tags?.length ? row.tags : ["Pending tag"],
      productName: row.product_name ?? "Pending product",
      status: row.status,
      claims: Number(row.claims ?? 0),
      downloads: Number(row.downloads ?? 0)
    }));
    return { items: materials, meta: listMeta(materials, options) };
  } catch {
    // Older databases may not have material_summaries yet; keep the MVP API usable.
  }

  const [clips, claims, downloads] = await Promise.all([
    safeRows(() =>
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
        buildListQuery(
          "select=id,title,status,tags,start_second,end_second,created_at,ip_accounts(name,platform),clip_products(products(name))",
          "order=created_at.desc",
          options,
          [options.status ? filterParam("status", "eq", options.status) : undefined]
        )
      )
    ),
    safeRows(() => selectRows<{ clip_asset_id: string }>(env, "clip_claims", "select=clip_asset_id")),
    safeRows(() => selectRows<{ clip_asset_id: string }>(env, "clip_downloads", "select=clip_asset_id"))
  ]);

  const claimsByClip = countBy(claims, (claim) => claim.clip_asset_id);
  const downloadsByClip = countBy(downloads, (download) => download.clip_asset_id);

  const materials = clips.map((clip) => ({
    id: clip.id,
    title: clip.title,
    ipName: clip.ip_accounts?.name ?? "Unknown IP",
    sourcePlatform: platformToLabel[clip.ip_accounts?.platform ?? "douyin"],
    liveDate: clip.created_at.slice(0, 10),
    duration:
      clip.end_second && clip.start_second && clip.end_second > clip.start_second
        ? `${clip.end_second - clip.start_second}s`
        : "Pending clip",
    tags: clip.tags?.length ? clip.tags : ["Pending tag"],
    productName: clip.clip_products[0]?.products?.name ?? "Pending product",
    status: clip.status,
    claims: claimsByClip.get(clip.id) ?? 0,
    downloads: downloadsByClip.get(clip.id) ?? 0
  }));
  return { items: materials, meta: listMeta(materials, options) };
}

export async function listProducts(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      name: string;
      platform: PlatformValue;
      affiliate_url: string;
      commission_rate: number | null;
      is_active: boolean;
      material_count: number | null;
      created_at: string;
    }>(
      env,
      "product_summaries",
      buildListQuery(
        "select=id,name,platform,affiliate_url,commission_rate,is_active,material_count,created_at",
        "order=created_at.desc",
        options,
        [
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["name", "affiliate_url"], options.q)
        ]
      )
    );

    const products = rows.map((row) => ({
      id: row.id,
      name: row.name,
      platform: platformToLabel[row.platform],
      affiliateUrl: row.affiliate_url,
      commissionRate: Number(row.commission_rate ?? 0),
      isActive: row.is_active,
      materialCount: Number(row.material_count ?? 0),
      createdAt: row.created_at.slice(0, 10)
    }));
    return { items: products, meta: listMeta(products, options) };
  } catch {
    // Older databases may not have product_summaries yet; keep the MVP API usable.
  }

  const [rows, bindings] = await Promise.all([
    selectRows<{
      id: string;
      name: string;
      platform: PlatformValue;
      affiliate_url: string;
      commission_rate: number | null;
      is_active: boolean;
      created_at: string;
    }>(
      env,
      "products",
      buildListQuery(
        "select=id,name,platform,affiliate_url,commission_rate,is_active,created_at",
        "order=created_at.desc",
        options,
        [options.platform ? filterParam("platform", "eq", options.platform) : undefined]
      )
    ),
    selectRows<{ product_id: string }>(env, "clip_products", "select=product_id")
  ]);

  const bindingsByProduct = countBy(bindings, (binding) => binding.product_id);

  const products = rows.map((row) => ({
    id: row.id,
    name: row.name,
    platform: platformToLabel[row.platform],
    affiliateUrl: row.affiliate_url,
    commissionRate: Number(row.commission_rate ?? 0),
    isActive: row.is_active,
    materialCount: bindingsByProduct.get(row.id) ?? 0,
    createdAt: row.created_at.slice(0, 10)
  }));
  return { items: products, meta: listMeta(products, options) };
}

export async function listPublishRecords(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      distributor_name: string | null;
      material_title: string | null;
      product_name: string | null;
      platform: PlatformValue;
      status: PublishStatus;
      submitted_at: string;
      gmv: number | null;
      commission: number | null;
    }>(
      env,
      "publish_record_summaries",
      buildListQuery(
        "select=id,distributor_name,material_title,product_name,platform,status,submitted_at,gmv,commission",
        "order=submitted_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["distributor_name", "material_title", "product_name"], options.q)
        ]
      )
    );

    const publishRecords = rows.map((row) => ({
      id: row.id,
      distributorName: row.distributor_name ?? "Unknown distributor",
      materialTitle: row.material_title ?? "Unknown material",
      productName: row.product_name ?? "Unknown product",
      platform: platformToLabel[row.platform],
      status: row.status,
      submittedAt: new Date(row.submitted_at).toLocaleString("zh-CN", { hour12: false }),
      gmv: Number(row.gmv ?? 0),
      commission: Number(row.commission ?? 0)
    }));
    return { items: publishRecords, meta: listMeta(publishRecords, options) };
  } catch {
    // Older databases may not have publish_record_summaries yet; keep the MVP API usable.
  }

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
    buildListQuery(
      "select=id,status,platform,submitted_at,distributor_profiles(display_name),clip_assets(title),products(name),performance_snapshots(gmv,commission_amount,captured_at)",
      "order=submitted_at.desc",
      options,
      [
        options.status ? filterParam("status", "eq", options.status) : undefined,
        options.platform ? filterParam("platform", "eq", options.platform) : undefined
      ]
    )
  );

  const publishRecords = rows.map((row) => {
    const latest = row.performance_snapshots.at(-1);
    return {
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      materialTitle: row.clip_assets?.title ?? "Unknown material",
      productName: row.products?.name ?? "Unknown product",
      platform: platformToLabel[row.platform],
      status: row.status,
      submittedAt: new Date(row.submitted_at).toLocaleString("zh-CN", { hour12: false }),
      gmv: Number(latest?.gmv ?? 0),
      commission: Number(latest?.commission_amount ?? 0)
    };
  });
  return { items: publishRecords, meta: listMeta(publishRecords, options) };
}

export async function listSettlements(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  try {
    const rows = await selectRows<{
      id: string;
      distributor_name: string | null;
      period: string;
      verified_posts: number | null;
      payable_commission: number | null;
      status: SettlementStatus;
      created_at: string;
    }>(
      env,
      "settlement_summaries",
      buildListQuery(
        "select=id,distributor_name,period,verified_posts,payable_commission,status,created_at",
        "order=created_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          searchQuery(["distributor_name", "period"], options.q)
        ]
      )
    );

    const settlements = rows.map((row) => ({
      id: row.id,
      distributorName: row.distributor_name ?? "Monthly settlement",
      period: row.period,
      verifiedPosts: Number(row.verified_posts ?? 0),
      payableCommission: Number(row.payable_commission ?? 0),
      status: row.status
    }));
    return { items: settlements, meta: listMeta(settlements, options) };
  } catch {
    // Older databases may not have settlement_summaries yet; keep the MVP API usable.
  }

  const rows = await selectRows<{
    id: string;
    period: string;
    status: SettlementStatus;
    total_amount: number;
    distributor_profiles: { display_name: string } | null;
  }>(
    env,
    "settlement_orders",
    buildListQuery(
      "select=id,period,status,total_amount,distributor_profiles(display_name)",
      "order=created_at.desc",
      options,
      [options.status ? filterParam("status", "eq", options.status) : undefined]
    )
  );

  const settlements = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Monthly settlement",
    period: row.period,
    verifiedPosts: 0,
    payableCommission: Number(row.total_amount),
    status: row.status
  }));
  return { items: settlements, meta: listMeta(settlements, options) };
}

export async function listRiskRecords(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await selectRows<{
    id: string;
    platform: PlatformValue;
    account_name: string;
    work_url: string;
    status: RiskStatus;
    handling_note: string | null;
    created_at: string;
  }>(
    env,
    "violation_leads",
    buildListQuery(
      "select=id,platform,account_name,work_url,status,handling_note,created_at",
      "order=created_at.desc",
      options,
      [
        options.status ? filterParam("status", "eq", options.status) : undefined,
        options.platform ? filterParam("platform", "eq", options.platform) : undefined,
        searchQuery(["account_name", "work_url", "handling_note"], options.q)
      ]
    )
  );

  const riskRecords = rows.map((row) => ({
    id: row.id,
    platform: platformToLabel[row.platform],
    account: row.account_name,
    issue: row.handling_note ?? "Pending review",
    workUrl: row.work_url,
    status: row.status,
    createdAt: new Date(row.created_at).toLocaleString("zh-CN", { hour12: false })
  }));
  return { items: riskRecords, meta: listMeta(riskRecords, options) };
}

export async function listDistributors(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  let rows = await safeRows(() =>
    selectRows<{
      id: string;
      display_name: string;
      phone: string | null;
      wechat_id: string | null;
      onboarding_status: string | null;
      credit_score: number | null;
      exam_score: number | null;
      agreement_signed: boolean | null;
      created_at: string;
    }>(
      env,
      "distributor_profiles",
      buildListQuery(
        "select=id,display_name,phone,wechat_id,onboarding_status,credit_score,exam_score,agreement_signed,created_at",
        "order=created_at.desc",
        options,
        [searchQuery(["display_name", "phone", "wechat_id"], options.q)]
      )
    )
  );

  if (!rows.length) {
    rows = await safeRows(() =>
      selectRows<{
        id: string;
        display_name: string;
        phone: string | null;
        wechat_id: string | null;
        onboarding_status: string | null;
        credit_score: number | null;
        exam_score: number | null;
        agreement_signed: boolean | null;
        created_at: string;
      }>(
        env,
        "distributor_profiles",
        buildListQuery("select=id,display_name,phone,created_at", "order=created_at.desc", options, [
          searchQuery(["display_name", "phone"], options.q)
        ])
      )
    );
  }

  const distributorIds = rows.map((row) => row.id);
  const [accounts, authorizations, violations, walletTransactions] = distributorIds.length
    ? await Promise.all([
        safeRows(() =>
          selectRows<{ distributor_id: string }>(env, "social_accounts", `select=distributor_id&${inList("distributor_id", distributorIds)}`)
        ),
        safeRows(() =>
          selectRows<{ distributor_id: string }>(
            env,
            "authorizations",
            `select=distributor_id&${inList("distributor_id", distributorIds)}&status=eq.approved`
          )
        ),
        safeRows(() =>
          selectRows<{ distributor_id: string | null }>(
            env,
            "violation_records",
            `select=distributor_id&${inList("distributor_id", distributorIds)}`
          )
        ),
        safeRows(() =>
          selectRows<{ distributor_id: string; amount: number | string; status: WalletTransactionStatus }>(
            env,
            "wallet_transactions",
            `select=distributor_id,amount,status&${inList("distributor_id", distributorIds)}`
          )
        )
      ])
    : [[], [], [], []];

  const accountCounts = countBy(accounts, (item) => item.distributor_id);
  const authorizationCounts = countBy(authorizations, (item) => item.distributor_id);
  const violationCounts = countBy(violations, (item) => item.distributor_id);
  const payableByDistributor = new Map<string, number>();
  walletTransactions.forEach((transaction) => {
    if (transaction.status !== "available") return;
    payableByDistributor.set(
      transaction.distributor_id,
      (payableByDistributor.get(transaction.distributor_id) ?? 0) + Number(transaction.amount ?? 0)
    );
  });

  const items = rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    phone: row.phone ?? "",
    wechatId: row.wechat_id ?? "",
    onboardingStatus: asOnboardingStatus(row.onboarding_status),
    creditScore: Number(row.credit_score ?? 100),
    examScore: Number(row.exam_score ?? 0),
    agreementSigned: Boolean(row.agreement_signed),
    accountCount: accountCounts.get(row.id) ?? 0,
    authorizationCount: authorizationCounts.get(row.id) ?? 0,
    violationCount: violationCounts.get(row.id) ?? 0,
    payableCommission: payableByDistributor.get(row.id) ?? 0,
    createdAt: dateOnly(row.created_at)
  }));

  return { items, meta: listMeta(items, options) };
}

export async function listAuthorizationPools(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      status: AuthorizationPoolStatus;
      total_quota: number;
      used_quota: number;
      min_credit_score: number;
      default_share_rate: number | string;
      daily_claim_limit: number;
      requirement: string | null;
      ip_accounts: { name: string; platform: PlatformValue } | null;
    }>(
      env,
      "authorization_pools",
      buildListQuery(
        "select=id,status,total_quota,used_quota,min_credit_score,default_share_rate,daily_claim_limit,requirement,ip_accounts(name,platform)",
        "order=created_at.desc",
        options,
        [options.status ? filterParam("status", "eq", options.status) : undefined]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    ipName: row.ip_accounts?.name ?? "Unknown IP",
    platform: platformToLabel[row.ip_accounts?.platform ?? "douyin"],
    status: row.status,
    totalQuota: Number(row.total_quota ?? 0),
    usedQuota: Number(row.used_quota ?? 0),
    minCreditScore: Number(row.min_credit_score ?? 80),
    defaultShareRate: Number(row.default_share_rate ?? 30),
    dailyClaimLimit: Number(row.daily_claim_limit ?? 10),
    requirement: row.requirement ?? ""
  }));
  return { items, meta: listMeta(items, options) };
}

export async function listFormalAuthorizations(
  env: WorkerEnv,
  options = listOptions(new URLSearchParams()),
  session?: RequestSession | null
) {
  const distributorFilter = session?.role === "partner" ? await distributorFilterForSession(env, session) : undefined;
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      status: AuthorizationStatus;
      share_rate: number | string;
      daily_claim_limit: number | null;
      starts_at: string;
      expires_at: string | null;
      paused_reason: string | null;
      distributor_profiles: { display_name: string } | null;
      social_accounts: { account_name: string; platform: PlatformValue } | null;
      ip_accounts: { name: string; platform: PlatformValue } | null;
      agreement_signatures: { agreement_templates: { version: string } | null } | null;
    }>(
      env,
      "authorizations",
      buildListQuery(
        "select=id,status,share_rate,daily_claim_limit,starts_at,expires_at,paused_reason,distributor_profiles(display_name),social_accounts(account_name,platform),ip_accounts(name,platform),agreement_signatures(agreement_templates(version))",
        "order=created_at.desc",
        options,
        [options.status ? filterParam("status", "eq", options.status) : undefined, distributorFilter]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    socialAccount: row.social_accounts?.account_name ?? "Unknown account",
    ipName: row.ip_accounts?.name ?? "Unknown IP",
    platform: platformToLabel[row.social_accounts?.platform ?? row.ip_accounts?.platform ?? "douyin"],
    status: row.status,
    shareRate: Number(row.share_rate ?? 30),
    dailyClaimLimit: Number(row.daily_claim_limit ?? 10),
    startsAt: dateOnly(row.starts_at),
    expiresAt: dateOnly(row.expires_at),
    agreementVersion: row.agreement_signatures?.agreement_templates?.version ?? DEFAULT_AGREEMENT_VERSION,
    pausedReason: row.paused_reason ?? undefined
  }));
  return { items, meta: listMeta(items, options) };
}

export async function listTrainingState(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const [courses, examAttempts, agreementSignatures, creditScoreEvents] = await Promise.all([
    safeRows(() =>
      selectRows<{
        id: string;
        title: string;
        lesson_count: number;
        estimated_minutes: number;
        is_required: boolean;
      }>(
        env,
        "training_courses",
        buildListQuery("select=id,title,lesson_count,estimated_minutes,is_required", "order=created_at.desc", options, [])
      )
    ),
    safeRows(() =>
      selectRows<{
        id: string;
        score: number;
        passed: boolean;
        attempted_at: string;
        distributor_profiles: { display_name: string } | null;
      }>(
        env,
        "exam_attempts",
        buildListQuery(
          "select=id,score,passed,attempted_at,distributor_profiles(display_name)",
          "order=attempted_at.desc",
          options,
          []
        )
      )
    ),
    safeRows(() =>
      selectRows<{
        id: string;
        signed_at: string;
        distributor_profiles: { display_name: string } | null;
        agreement_templates: { name: string; version: string } | null;
      }>(
        env,
        "agreement_signatures",
        buildListQuery(
          "select=id,signed_at,distributor_profiles(display_name),agreement_templates(name,version)",
          "order=signed_at.desc",
          options,
          []
        )
      )
    ),
    safeRows(() =>
      selectRows<{
        id: string;
        delta: number;
        reason: string;
        created_at: string;
        distributor_profiles: { display_name: string } | null;
      }>(
        env,
        "credit_score_events",
        buildListQuery("select=id,delta,reason,created_at,distributor_profiles(display_name)", "order=created_at.desc", options, [])
      )
    )
  ]);

  return {
    trainingCourses: courses.map((row) => ({
      id: row.id,
      title: row.title,
      lessonCount: Number(row.lesson_count ?? 0),
      estimatedMinutes: Number(row.estimated_minutes ?? 0),
      isRequired: Boolean(row.is_required)
    })),
    examAttempts: examAttempts.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      score: Number(row.score ?? 0),
      passed: Boolean(row.passed),
      attemptedAt: formatDateTime(row.attempted_at)
    })),
    agreementSignatures: agreementSignatures.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      templateName: row.agreement_templates?.name ?? DEFAULT_AGREEMENT_NAME,
      version: row.agreement_templates?.version ?? DEFAULT_AGREEMENT_VERSION,
      signedAt: formatDateTime(row.signed_at)
    })),
    creditScoreEvents: creditScoreEvents.map((row) => ({
      id: row.id,
      distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
      delta: Number(row.delta ?? 0),
      reason: row.reason,
      createdAt: formatDateTime(row.created_at)
    }))
  };
}

export async function listDistributionTasks(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      title: string;
      platform: PlatformValue;
      status: DistributionTaskStatus;
      start_at: string;
      end_at: string | null;
      reward_rule: string | null;
      claim_limit: number;
      claimed_count: number;
      published_count: number;
      requirement: string | null;
      ip_accounts: { name: string } | null;
      products: { name: string } | null;
      distribution_task_materials: { clip_asset_id: string }[];
    }>(
      env,
      "distribution_tasks",
      buildListQuery(
        "select=id,title,platform,status,start_at,end_at,reward_rule,claim_limit,claimed_count,published_count,requirement,ip_accounts(name),products(name),distribution_task_materials(clip_asset_id)",
        "order=created_at.desc",
        options,
        [
          options.status ? filterParam("status", "eq", options.status) : undefined,
          options.platform ? filterParam("platform", "eq", options.platform) : undefined,
          searchQuery(["title", "reward_rule", "requirement"], options.q)
        ]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    ipName: row.ip_accounts?.name ?? "Unknown IP",
    platform: platformToLabel[row.platform],
    materialIds: row.distribution_task_materials?.map((item) => item.clip_asset_id) ?? [],
    productName: row.products?.name ?? "Unknown product",
    status: row.status,
    startAt: dateOnly(row.start_at),
    endAt: row.end_at ? dateOnly(row.end_at) : "",
    rewardRule: row.reward_rule ?? "",
    claimLimit: Number(row.claim_limit ?? 0),
    claimedCount: Number(row.claimed_count ?? 0),
    publishedCount: Number(row.published_count ?? 0),
    requirement: row.requirement ?? ""
  }));
  return { items, meta: listMeta(items, options) };
}

export async function listTaskClaims(env: WorkerEnv, options = listOptions(new URLSearchParams()), session?: RequestSession | null) {
  const distributorFilter = session?.role === "partner" ? await distributorFilterForSession(env, session) : undefined;
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      distribution_task_id: string;
      status: TaskClaimStatus;
      claim_token: string;
      submitted_url: string | null;
      claimed_at: string;
      distributor_profiles: { display_name: string } | null;
      social_accounts: { account_name: string; platform: PlatformValue } | null;
      clip_assets: { title: string } | null;
      products: { name: string } | null;
      download_tokens: { expires_at: string }[];
    }>(
      env,
      "task_claims",
      buildListQuery(
        "select=id,distribution_task_id,status,claim_token,submitted_url,claimed_at,distributor_profiles(display_name),social_accounts(account_name,platform),clip_assets(title),products(name),download_tokens(expires_at)",
        "order=claimed_at.desc",
        options,
        [options.status ? filterParam("status", "eq", options.status) : undefined, distributorFilter]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    taskId: row.distribution_task_id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    socialAccount: row.social_accounts?.account_name ?? "Unknown account",
    materialTitle: row.clip_assets?.title ?? "Unknown material",
    productName: row.products?.name ?? "Unknown product",
    platform: platformToLabel[row.social_accounts?.platform ?? "douyin"],
    status: row.status,
    claimToken: row.claim_token,
    downloadExpiresAt: formatDateTime(row.download_tokens?.[0]?.expires_at),
    claimedAt: formatDateTime(row.claimed_at),
    submittedUrl: row.submitted_url ?? undefined
  }));
  return { items, meta: listMeta(items, options) };
}

export async function listWalletTransactions(
  env: WorkerEnv,
  options = listOptions(new URLSearchParams()),
  session?: RequestSession | null
) {
  const distributorFilter = session?.role === "partner" ? await distributorFilterForSession(env, session) : undefined;
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      type: WalletTransactionType;
      amount: number | string;
      status: WalletTransactionStatus;
      source: string;
      note: string | null;
      created_at: string;
      distributor_profiles: { display_name: string } | null;
    }>(
      env,
      "wallet_transactions",
      buildListQuery(
        "select=id,type,amount,status,source,note,created_at,distributor_profiles(display_name)",
        "order=created_at.desc",
        options,
        [options.status ? filterParam("status", "eq", options.status) : undefined, distributorFilter]
      )
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    distributorName: row.distributor_profiles?.display_name ?? "Unknown distributor",
    type: row.type,
    amount: Number(row.amount ?? 0),
    status: row.status,
    source: row.source,
    note: row.note ?? "",
    createdAt: formatDateTime(row.created_at)
  }));
  return { items, meta: listMeta(items, options) };
}

export async function listNotifications(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      audience: "all" | "admin" | "partner";
      title: string;
      content: string;
      created_at: string;
    }>(
      env,
      "notifications",
      buildListQuery("select=id,audience,title,content,created_at", "order=created_at.desc", options, [])
    )
  );

  const items = rows.map((row) => ({
    id: row.id,
    audience: row.audience,
    title: row.title,
    content: row.content,
    createdAt: formatDateTime(row.created_at),
    isRead: false
  }));
  return { items, meta: listMeta(items, options) };
}

export async function partnerWalletResponse(env: WorkerEnv, options = listOptions(new URLSearchParams()), session?: RequestSession | null) {
  const { items, meta } = await listWalletTransactions(env, options, session);
  const wallet = items.reduce(
    (summary, transaction) => {
      if (transaction.status === "available") summary.availableAmount += transaction.amount;
      if (transaction.status === "frozen") summary.frozenAmount += Math.abs(transaction.amount);
      if (transaction.status === "pending") summary.pendingAmount += transaction.amount;
      if (transaction.status === "paid") summary.paidAmount += transaction.amount;
      return summary;
    },
    { availableAmount: 0, frozenAmount: 0, pendingAmount: 0, paidAmount: 0 }
  );

  return { wallet, walletTransactions: items, meta };
}

export async function productCommissionHistory(env: WorkerEnv, productId: string, options = listOptions(new URLSearchParams())) {
  const product = first(
    await safeRows(() =>
      selectRows<{
        id: string;
        name: string;
        platform: PlatformValue;
        commission_rate: number | string | null;
        is_active: boolean;
      }>(env, "products", `select=id,name,platform,commission_rate,is_active&id=eq.${productId}&limit=1`)
    )
  );
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      status: PublishStatus;
      publish_url: string;
      performance_snapshots: { gmv: number | string; commission_amount: number | string; captured_at: string }[];
    }>(
      env,
      "publish_records",
      buildListQuery(
        "select=id,status,publish_url,performance_snapshots(gmv,commission_amount,captured_at)",
        "order=submitted_at.desc",
        options,
        [filterParam("product_id", "eq", productId)]
      )
    )
  );
  const commissionHistory = rows.map((row) => {
    const latest = row.performance_snapshots?.at(-1);
    return {
      publishRecordId: row.id,
      status: row.status,
      publishUrl: row.publish_url,
      gmv: Number(latest?.gmv ?? 0),
      commission: Number(latest?.commission_amount ?? 0),
      capturedAt: latest?.captured_at ? formatDateTime(latest.captured_at) : null
    };
  });
  return { product, commissionHistory, meta: listMeta(commissionHistory, options) };
}

export async function listPerformanceImports(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      file_name: string;
      status: string;
      total_rows: number;
      matched_rows: number;
      error_rows: number;
      created_at: string;
    }>(
      env,
      "performance_import_batches",
      buildListQuery("select=id,file_name,status,total_rows,matched_rows,error_rows,created_at", "order=created_at.desc", options, [])
    )
  );
  const performanceImports = rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    status: row.status,
    totalRows: Number(row.total_rows ?? 0),
    matchedRows: Number(row.matched_rows ?? 0),
    errorRows: Number(row.error_rows ?? 0),
    createdAt: formatDateTime(row.created_at)
  }));
  return { items: performanceImports, meta: listMeta(performanceImports, options) };
}

export async function listPerformanceImportErrors(env: WorkerEnv, batchId: string, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      error_code: string;
      error_message: string;
      created_at: string;
    }>(
      env,
      "performance_import_errors",
      buildListQuery("select=id,error_code,error_message,created_at", "order=created_at.desc", options, [filterParam("batch_id", "eq", batchId)])
    )
  );
  const errors = rows.map((row) => ({
    id: row.id,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: formatDateTime(row.created_at)
  }));
  return { items: errors, meta: listMeta(errors, options) };
}

