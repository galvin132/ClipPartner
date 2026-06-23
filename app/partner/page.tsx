"use client";

import Link from "next/link";
import { Bell, ClipboardList, LogOut, ShieldCheck, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Badge";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

export default function PartnerPage() {
  return (
    <AuthGate roles={["partner"]}>
      <PartnerDashboard />
    </AuthGate>
  );
}

function PartnerDashboard() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const { state, markNotificationRead, syncStatus, refreshRemoteList } = useClipPartnerStore();
  const distributorName = session?.displayName ?? "";
  useEffect(() => {
    void refreshRemoteList("distributorProfiles", { limit: 50 });
    void refreshRemoteList("formalAuthorizations", { limit: 50 });
    void refreshRemoteList("taskClaims", { limit: 50 });
    void refreshRemoteList("walletTransactions", { limit: 50 });
    void refreshRemoteList("notifications", { limit: 50 });
  }, [refreshRemoteList]);

  const profile = state.distributorProfiles.find((item) => item.displayName === distributorName);
  const authorizations = state.formalAuthorizations.filter((item) => item.distributorName === distributorName);
  const claims = state.taskClaims.filter((item) => item.distributorName === distributorName);
  const pendingClaims = claims.filter((item) => ["downloaded", "claimed"].includes(item.status)).length;
  const submittedClaims = claims.filter((item) => item.status === "submitted").length;
  const availableWallet = state.walletTransactions
    .filter((item) => item.distributorName === distributorName && item.status === "available")
    .reduce((sum, item) => sum + item.amount, 0);
  const notices = state.notifications.filter((item) => item.audience === "all" || item.audience === "partner").slice(0, 3);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="partner-shell">
      <header className="partner-header">
        <div className="partner-header-inner">
          <div>
            <div className="brand-title">切片合伙人工作台</div>
            <div className="brand-subtitle">
              {distributorName} · 信用分 {profile?.creditScore ?? 100} · {syncStatus === "remote" ? "线上数据" : "模拟数据"}
            </div>
          </div>
          <div className="toolbar">
            <Link className="button" href="/partner/onboarding">
              入驻
            </Link>
            <Link className="button" href="/partner/accounts">
              账号
            </Link>
            <Link className="button" href="/">
              后台预览
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
            <p className="page-kicker">今日待办</p>
            <h1 className="page-title">先看准入、授权、任务和收益</h1>
            <p className="page-subtitle">
              新版分发者端从素材中心升级为工作台：完成准入后申请授权，领取任务生成下载凭证，发布回填后进入核验和结算。
            </p>
          </div>
          {profile ? <StatusBadge status={profile.onboardingStatus} /> : null}
        </div>

        <section className="metrics-grid">
          <article className="metric-card">
            <div className="metric-label">
              <ShieldCheck size={16} aria-hidden /> 有效授权
            </div>
            <div className="metric-value">{authorizations.filter((item) => item.status === "approved").length}</div>
            <div className="metric-note">可领取对应 IP 任务</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">
              <ClipboardList size={16} aria-hidden /> 待发布
            </div>
            <div className="metric-value">{pendingClaims}</div>
            <div className="metric-note">已下载但未回填</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">待核验</div>
            <div className="metric-value">{submittedClaims}</div>
            <div className="metric-note">等待后台检查账号和商品</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">
              <WalletCards size={16} aria-hidden /> 可结算
            </div>
            <div className="metric-value">{money(availableWallet)}</div>
            <div className="metric-note">冻结和待打款另计</div>
          </article>
        </section>

        <section className="content-grid">
          <div className="content-card">
            <h2 className="section-title">快捷入口</h2>
            <div className="workflow">
              <Link className="workflow-row" href="/partner/onboarding">
                <span className="step-index">1</span>
                <div>
                  <div className="step-title">入驻准入</div>
                  <div className="step-desc">资料、账号、课程考试、协议签署。</div>
                </div>
                <span className="badge info">进入</span>
              </Link>
              <Link className="workflow-row" href="/partner/authorizations">
                <span className="step-index">2</span>
                <div>
                  <div className="step-title">授权中心</div>
                  <div className="step-desc">查看授权池、正式授权和分成比例。</div>
                </div>
                <span className="badge info">进入</span>
              </Link>
              <Link className="workflow-row" href="/partner/tasks">
                <span className="step-index">3</span>
                <div>
                  <div className="step-title">任务中心</div>
                  <div className="step-desc">领取任务、下载素材、回填发布链接。</div>
                </div>
                <span className="badge info">进入</span>
              </Link>
              <Link className="workflow-row" href="/partner/wallet">
                <span className="step-index">4</span>
                <div>
                  <div className="step-title">收益钱包</div>
                  <div className="step-desc">查看作品收益、冻结和打款记录。</div>
                </div>
                <span className="badge info">进入</span>
              </Link>
            </div>
          </div>

          <div className="content-card">
            <h2 className="section-title">
              <Bell size={18} aria-hidden /> 公告通知
            </h2>
            <div className="workflow">
              {notices.map((notice) => (
                <button className="workflow-row" key={notice.id} onClick={() => markNotificationRead(notice.id)}>
                  <span className="step-index">{notice.isRead ? "读" : "新"}</span>
                  <div>
                    <div className="step-title">{notice.title}</div>
                    <div className="step-desc">{notice.content}</div>
                  </div>
                  <span className="badge warning">{notice.createdAt}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="table-card" style={{ marginTop: 18 }}>
          <div className="table-header">
            <h2 className="table-title">我的领取记录</h2>
            <Link className="button" href="/partner/tasks">
              查看任务
            </Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>素材</th>
                <th>账号</th>
                <th>商品</th>
                <th>凭证</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id}>
                  <td>{claim.materialTitle}</td>
                  <td>{claim.socialAccount}</td>
                  <td>{claim.productName}</td>
                  <td>{claim.claimToken}</td>
                  <td>
                    <StatusBadge status={claim.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
