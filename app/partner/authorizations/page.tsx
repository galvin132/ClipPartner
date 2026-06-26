"use client";

import Link from "next/link";
import { BadgeCheck, LogOut, Plus, ArrowLeft, ShieldCheck, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Badge";
import { useClipPartnerStore } from "@/lib/local-store";

export default function PartnerAuthorizationsPage() {
  return (
    <AuthGate roles={["partner"]}>
      <PartnerAuthorizationsExperience />
    </AuthGate>
  );
}

function PartnerAuthorizationsExperience() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const { state, addAuthorizationRequest, syncStatus, refreshRemoteList } = useClipPartnerStore();
  const distributorName = session?.displayName ?? "";
  
  useEffect(() => {
    void refreshRemoteList("distributorProfiles", { limit: 50 });
    void refreshRemoteList("accountBindings", { limit: 50 });
    void refreshRemoteList("formalAuthorizations", { limit: 50 });
    void refreshRemoteList("authorizationPools", { limit: 50 });
  }, [refreshRemoteList]);

  const profile = state.distributorProfiles.find((item) => item.displayName === distributorName);
  const accounts = state.accountBindings.filter((item) => item.distributorName === distributorName && item.status === "approved");
  const authorizations = state.formalAuthorizations.filter((item) => item.distributorName === distributorName);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  function apply(ipName: string, platform: "抖音" | "视频号") {
    const account = accounts.find((item) => item.platform === platform);
    addAuthorizationRequest({
      distributorName,
      socialAccount: account?.accountName ?? "待审核账号",
      platform,
      ipName,
      reason: `分发者通过授权中心申请 ${ipName}，信用分 ${profile?.creditScore ?? 100}。`
    });
  }

  return (
    <div className="partner-shell">
      <header className="partner-header-modern">
        <div className="partner-header-inner-modern">
          <div className="partner-header-brand">
            <div className="partner-brand-logo" />
            <div>
              <div className="partner-brand-title">独家授权申请中心</div>
              <div className="partner-brand-subtitle">
                <span className="user-tag">{distributorName}</span>
                <span className="dot-divider">·</span>
                <span className="score-tag">我的信用分 <strong>{profile?.creditScore ?? 100}</strong></span>
                <span className="dot-divider">·</span>
                <span className="data-source-tag">{syncStatus === "remote" ? "线上实时" : "本地演示"}</span>
              </div>
            </div>
          </div>
          <div className="partner-header-actions">
            <Link className="button partner-action-btn" href="/partner">
              <ArrowLeft size={14} /> 返回工作台
            </Link>
            <Link className="button partner-action-btn" href="/partner/onboarding">
              新手入驻进度
            </Link>
            <button className="button partner-logout-btn" aria-label="退出" onClick={handleLogout}>
              <LogOut size={15} />
              <span>安全退出</span>
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main-modern">
        <div className="topbar">
          <div>
            <p className="page-kicker">IP 官方白名单授权管理</p>
            <h1 className="page-title">授权名额、分成比例和每日领取上限透明展示</h1>
            <p className="page-subtitle">授权申请会检查新手准入状态、账号审核、信用分和授权池名额。对接真实 MCN 与平台白名单接口。</p>
          </div>
          <span className="badge success-badge-filled">
            信用分 {profile?.creditScore ?? 100} 分
          </span>
        </div>

        <section className="table-card" style={{ marginBottom: 28 }}>
          <div className="table-header">
            <h2 className="table-title">🛍️ 开放中的官方 IP 授权池</h2>
            <span className="badge warning">名额已满或 IP 暂停领取时将不开放申请通道</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>主推 IP 达人 / 平台</th>
                  <th>当前配额状态</th>
                  <th>官方默认分成比例</th>
                  <th>每日素材领取上限</th>
                  <th>独家入驻门槛</th>
                  <th>授权池状态</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {state.authorizationPools.map((pool) => {
                  const canApply =
                    pool.status === "open" &&
                    pool.usedQuota < pool.totalQuota &&
                    (profile?.creditScore ?? 100) >= pool.minCreditScore &&
                    accounts.some((item) => item.platform === pool.platform);
                  return (
                    <tr key={pool.id}>
                      <td>
                        <div className="item-title">{pool.ipName}</div>
                        <div className="item-meta">投放平台：<span className="badge info-badge-soft">{pool.platform}</span></div>
                      </td>
                      <td className="text-bold">
                        {pool.usedQuota} / {pool.totalQuota} <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: "normal" }}>(已领/配额)</span>
                      </td>
                      <td className="text-bold text-emerald">{pool.defaultShareRate}%</td>
                      <td>{pool.dailyClaimLimit} 条视频/天</td>
                      <td>
                        <span style={{ fontSize: 13 }}>{pool.requirement}</span>
                        <div className="item-meta">最低信用分要求：{pool.minCreditScore}分</div>
                      </td>
                      <td>
                        <StatusBadge status={pool.status} />
                      </td>
                      <td className="text-right">
                        <button 
                          className={`button ${canApply ? "primary-gradient-btn" : ""}`}
                          disabled={!canApply} 
                          onClick={() => apply(pool.ipName, pool.platform)}
                        >
                          <Plus size={14} /> 立即申请授权
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="table-card">
          <div className="table-header">
            <h2 className="table-title">📜 我的正式授权书列表</h2>
            <span className="badge success">已生效授权账号才可自动通过任务与素材安全核验</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>已绑定社会化媒体账号</th>
                  <th>授权绑定 IP</th>
                  <th>专属分成比例</th>
                  <th>授权书有效期</th>
                  <th>每日允许下载数</th>
                  <th>授权状态</th>
                </tr>
              </thead>
              <tbody>
                {authorizations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted" style={{ padding: "40px 0" }}>
                      <div className="item-meta" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                        <ShieldAlert size={24} style={{ color: "var(--warning)" }} />
                        <span>您当前暂无任何正式授权书。请先去绑账号，并完成新手准入进度。</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  authorizations.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="item-title">{item.socialAccount}</div>
                        <div className="item-meta">所属平台：<span className="badge info-badge-soft">{item.platform}</span></div>
                      </td>
                      <td className="text-bold">{item.ipName}</td>
                      <td className="text-bold text-emerald">{item.shareRate}%</td>
                      <td>
                        <div style={{ fontSize: 13 }}>{item.startsAt}</div>
                        <div className="item-meta">至 {item.expiresAt}</div>
                      </td>
                      <td>{item.dailyClaimLimit} 条/天</td>
                      <td>
                        <StatusBadge status={item.status} />
                        {item.pausedReason ? (
                          <div className="item-meta" style={{ color: "var(--danger)" }}>原因: {item.pausedReason}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
