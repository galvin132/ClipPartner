"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Bell,
  ClipboardList,
  Crown,
  Flame,
  LogOut,
  ShieldCheck,
  Trophy,
  WalletCards
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Badge";
import { buildPartnerPersonalStats, displayDistributorName } from "@/lib/analytics";
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
    void refreshRemoteList("publishRecords", { limit: 50 });
    void refreshRemoteList("distributionTasks", { limit: 50 });
  }, [refreshRemoteList]);

  const profile = state.distributorProfiles.find((item) => displayDistributorName(item.displayName) === distributorName);
  const claims = state.taskClaims.filter((item) => displayDistributorName(item.distributorName) === distributorName);
  const notices = state.notifications.filter((item) => item.audience === "all" || item.audience === "partner").slice(0, 3);
  const stats = buildPartnerPersonalStats(state, distributorName);
  const recentRecords = state.publishRecords
    .filter((item) => displayDistributorName(item.distributorName) === distributorName)
    .slice(0, 4);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="partner-shell">
      <header className="partner-header">
        <div className="partner-header-inner">
          <div>
            <div className="brand-title">切片合伙人赚钱中心</div>
            <div className="brand-subtitle">
              {distributorName} · 信用分 {stats.creditScore} · {syncStatus === "remote" ? "线上数据" : "演示数据"}
            </div>
          </div>
          <div className="toolbar">
            <Link className="button" href="/partner/tasks">
              领任务
            </Link>
            <Link className="button" href="/partner/wallet">
              看钱包
            </Link>
            <button className="button" aria-label="退出" onClick={handleLogout}>
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main">
        <section className="partner-earnings-hero">
          <div>
            <span className="badge success">我的收益战报</span>
            <h1>把任务发出去，把通过核验的作品变成佣金。</h1>
            <p>
              优先领取有授权、有商品、有爆款素材的任务；发布后及时回填链接，越快通过核验，越快进入结算。
            </p>
            <div className="toolbar">
              <Link className="button primary" href="/partner/tasks">
                去领取可赚钱任务 <ArrowRight size={16} aria-hidden />
              </Link>
              <Link className="button" href="/partner/authorizations">
                申请更多授权
              </Link>
            </div>
          </div>
          <div className="partner-earnings-panel">
            <span>本月预估佣金</span>
            <strong>{money(stats.estimatedIncome)}</strong>
            <p>
              GMV {money(stats.totalGmv)} · 排名第 {stats.rankByGmv} · {stats.effectivePosts} 条作品已通过
            </p>
          </div>
        </section>

        <section className="metrics-grid">
          <article className="metric-card">
            <div className="metric-label">
              <BadgeDollarSign size={16} aria-hidden /> 可用收益
            </div>
            <div className="metric-value">{money(stats.availableIncome)}</div>
            <div className="metric-note">已经进入钱包的可结算金额</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">
              <ClipboardList size={16} aria-hidden /> 待回填
            </div>
            <div className="metric-value">{stats.pendingPublish}</div>
            <div className="metric-note">已领取/下载，发布后要补作品链接</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">
              <ShieldCheck size={16} aria-hidden /> 待核验
            </div>
            <div className="metric-value">{stats.pendingReview}</div>
            <div className="metric-note">后台通过后才进入结算</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">
              <WalletCards size={16} aria-hidden /> 冻结金额
            </div>
            <div className="metric-value">{money(stats.frozenIncome)}</div>
            <div className="metric-note">{stats.invalidPosts} 条异常作品会影响收益</div>
          </article>
        </section>

        <section className="content-grid">
          <div className="content-card">
            <div className="section-heading-row">
              <h2 className="section-title">我的赚钱动作</h2>
              {profile ? <StatusBadge status={profile.onboardingStatus} /> : null}
            </div>
            <div className="workflow">
              <Link className="workflow-row" href="/partner/onboarding">
                <span className="step-index">1</span>
                <div>
                  <div className="step-title">保持准入状态</div>
                  <div className="step-desc">资料、账号、考试、协议完整，才能持续拿授权。</div>
                </div>
                <span className="badge info">{stats.creditScore} 分</span>
              </Link>
              <Link className="workflow-row" href="/partner/authorizations">
                <span className="step-index">2</span>
                <div>
                  <div className="step-title">扩大授权范围</div>
                  <div className="step-desc">当前 {stats.activeAuthorizations} 个有效授权，授权越多，可领取任务越多。</div>
                </div>
                <span className="badge success">
                  <Crown size={13} aria-hidden /> 授权
                </span>
              </Link>
              <Link className="workflow-row" href="/partner/tasks">
                <span className="step-index">3</span>
                <div>
                  <div className="step-title">优先领高转化任务</div>
                  <div className="step-desc">当前有 {stats.availableTaskCount} 个可领取任务，先看商品和奖励规则。</div>
                </div>
                <span className="badge warning">
                  <Flame size={13} aria-hidden /> 领任务
                </span>
              </Link>
              <Link className="workflow-row" href="/partner/wallet">
                <span className="step-index">4</span>
                <div>
                  <div className="step-title">看清每笔收益</div>
                  <div className="step-desc">GMV、佣金、冻结、打款都能追到作品和任务。</div>
                </div>
                <span className="badge info">钱包</span>
              </Link>
            </div>
          </div>

          <div className="content-card">
            <h2 className="section-title">
              <Bell size={18} aria-hidden /> 赚钱提醒
            </h2>
            <div className="workflow">
              {notices.map((notice) => (
                <button className="workflow-row" key={notice.id} onClick={() => markNotificationRead(notice.id)}>
                  <span className="step-index">{notice.isRead ? "已读" : "新"}</span>
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

        <section className="content-grid" style={{ marginTop: 18 }}>
          <div className="table-card">
            <div className="table-header">
              <h2 className="table-title">我的领取记录</h2>
              <Link className="button" href="/partner/tasks">
                继续领任务
              </Link>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>素材</th>
                  <th>账号</th>
                  <th>凭证</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {claims.slice(0, 5).map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <div className="item-title">{claim.materialTitle}</div>
                      <div className="item-meta">{claim.productName}</div>
                    </td>
                    <td>{claim.socialAccount}</td>
                    <td>{claim.claimToken}</td>
                    <td>
                      <StatusBadge status={claim.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-card">
            <div className="table-header">
              <h2 className="table-title">我的作品收益</h2>
              <span className="badge success">
                <Trophy size={13} aria-hidden /> 排名第 {stats.rankByGmv}
              </span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>作品</th>
                  <th>状态</th>
                  <th>GMV</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="item-title">{record.materialTitle}</div>
                      <div className="item-meta">{record.productName}</div>
                    </td>
                    <td>
                      <StatusBadge status={record.status} />
                    </td>
                    <td>{money(record.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
