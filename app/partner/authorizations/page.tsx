"use client";

import Link from "next/link";
import { BadgeCheck, LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Badge";
import { useClipPartnerStore } from "@/lib/local-store";

export default function PartnerAuthorizationsPage() {
  return (
    <AuthGate roles={["admin", "partner"]}>
      <PartnerAuthorizationsExperience />
    </AuthGate>
  );
}

function PartnerAuthorizationsExperience() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const { state, addAuthorizationRequest, refreshRemoteList } = useClipPartnerStore();
  const distributorName = session?.role === "partner" ? session.displayName : "周婧";
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
      <header className="partner-header">
        <div className="partner-header-inner">
          <div>
            <div className="brand-title">授权中心</div>
            <div className="brand-subtitle">{distributorName} · 可申请 IP 与已授权账号</div>
          </div>
          <div className="toolbar">
            <Link className="button" href="/partner/onboarding">
              入驻进度
            </Link>
            <button className="button" aria-label="退出" onClick={handleLogout}>
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main">
        <div className="topbar">
          <div>
            <p className="page-kicker">IP 授权池</p>
            <h1 className="page-title">授权名额、分成比例和每日领取上限透明展示</h1>
            <p className="page-subtitle">授权申请会检查准入状态、账号审核、信用分和授权池名额。当前为模拟接口，后续可接真实 MCN 审核。</p>
          </div>
          <span className="badge info">信用分 {profile?.creditScore ?? 100}</span>
        </div>

        <section className="table-card">
          <div className="table-header">
            <h2 className="table-title">可申请授权池</h2>
            <span className="badge warning">名额满或暂停时不可申请</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>IP / 平台</th>
                <th>名额</th>
                <th>默认分成</th>
                <th>领取上限</th>
                <th>门槛</th>
                <th>状态</th>
                <th>操作</th>
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
                      <div className="item-meta">{pool.platform}</div>
                    </td>
                    <td>
                      {pool.usedQuota} / {pool.totalQuota}
                    </td>
                    <td>{pool.defaultShareRate}%</td>
                    <td>{pool.dailyClaimLimit} 条/日</td>
                    <td>{pool.requirement}</td>
                    <td>
                      <StatusBadge status={pool.status} />
                    </td>
                    <td>
                      <button className="button" disabled={!canApply} onClick={() => apply(pool.ipName, pool.platform)}>
                        <Plus size={16} aria-hidden /> 申请
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="table-card" style={{ marginTop: 18 }}>
          <div className="table-header">
            <h2 className="table-title">我的正式授权</h2>
            <span className="badge success">用于任务领取和下载校验</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>授权账号</th>
                <th>IP</th>
                <th>分成</th>
                <th>有效期</th>
                <th>每日领取</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {authorizations.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="item-title">{item.socialAccount}</div>
                    <div className="item-meta">{item.platform}</div>
                  </td>
                  <td>{item.ipName}</td>
                  <td>{item.shareRate}%</td>
                  <td>
                    {item.startsAt} 至 {item.expiresAt}
                  </td>
                  <td>{item.dailyClaimLimit}</td>
                  <td>
                    <StatusBadge status={item.status} />
                    {item.pausedReason ? <div className="item-meta">{item.pausedReason}</div> : null}
                  </td>
                </tr>
              ))}
              {!authorizations.length ? (
                <tr>
                  <td colSpan={6}>
                    <div className="item-meta">
                      暂无正式授权。请先完成 <Link className="text-link" href="/partner/onboarding">入驻准入</Link>。
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
