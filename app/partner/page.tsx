"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
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
  WalletCards,
  TrendingUp,
  Briefcase,
  Video,
  ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
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
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "works" | "alerts">("overview");
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
  const notices = state.notifications.filter((item) => item.audience === "all" || item.audience === "partner").slice(0, 5);
  const stats = buildPartnerPersonalStats(state, distributorName);
  const recentRecords = state.publishRecords
    .filter((item) => displayDistributorName(item.distributorName) === distributorName)
    .slice(0, 6);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="partner-shell">
      <header className="partner-header-modern">
        <div className="partner-header-inner-modern">
          <div className="partner-header-brand">
            <div className="partner-brand-logo" />
            <div>
              <div className="partner-brand-title">切片合伙人工作台</div>
              <div className="partner-brand-subtitle">
                <span className="user-tag">{distributorName}</span>
                <span className="dot-divider">·</span>
                <span className="score-tag">信用分 <strong>{stats.creditScore}</strong></span>
                <span className="dot-divider">·</span>
                <span className="data-source-tag">{syncStatus === "remote" ? "线上实时" : "本地演示"}</span>
              </div>
            </div>
          </div>
          <div className="partner-header-actions">
            <Link className="button partner-action-btn" href="/partner/tasks">
              领取任务
            </Link>
            <Link className="button partner-action-btn" href="/partner/wallet">
              我的钱包
            </Link>
            <button className="button partner-logout-btn" aria-label="退出" onClick={handleLogout}>
              <LogOut size={15} />
              <span>安全退出</span>
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main-modern">
        {/* 顶部战报看板：作为主视觉背景 */}
        <section className="partner-earnings-hero-modern">
          <div className="hero-welcome-area">
            <span className="badge success-badge-filled">收益业绩战报</span>
            <h1>领取爆款授权素材，发布作品自动躺赚佣金。</h1>
            <p>
              挑选带货力超强的 IP 达人片段，挂载专属商品链接发布。越快提交作品核验，佣金结算打款越迅速。
            </p>
            <div className="hero-action-row">
              <Link className="button primary-gradient-btn" href="/partner/tasks">
                去领取高佣任务 <ArrowRight size={15} />
              </Link>
              <Link className="button outline-white-btn" href="/partner/authorizations">
                申请达人独家授权
              </Link>
            </div>
          </div>
          <div className="hero-earnings-panel">
            <div className="panel-accent-glow" />
            <span className="panel-label">本月预估分账佣金</span>
            <strong className="panel-value">{money(stats.estimatedIncome)}</strong>
            <p className="panel-meta">
              本月 GMV {money(stats.totalGmv)} · 全站排名第 {stats.rankByGmv} 名 · {stats.effectivePosts} 条作品核验通过
            </p>
          </div>
        </section>

        {/* 合伙人专用高级 Tabs 导航条 */}
        <div className="partner-tabs-nav">
          <button
            className={`partner-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <TrendingUp size={15} />
            <span>我的收益大盘</span>
          </button>
          <button
            className={`partner-tab-btn ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            <Briefcase size={15} />
            <span>任务与领取记录</span>
            {stats.pendingPublish > 0 && (
              <span className="tab-badge-count">{stats.pendingPublish}</span>
            )}
          </button>
          <button
            className={`partner-tab-btn ${activeTab === "works" ? "active" : ""}`}
            onClick={() => setActiveTab("works")}
          >
            <Video size={15} />
            <span>作品收益分账</span>
          </button>
          <button
            className={`partner-tab-btn ${activeTab === "alerts" ? "active" : ""}`}
            onClick={() => setActiveTab("alerts")}
          >
            <Bell size={15} />
            <span>赚钱通知提醒</span>
            {notices.some((n) => !n.isRead) && (
              <span className="tab-badge-dot" />
            )}
          </button>
        </div>

        {/* TAB 1: 我的收益大盘 */}
        <div className={`modern-tab-panel ${activeTab === "overview" ? "active" : ""}`}>
          <section className="metrics-grid" style={{ marginBottom: 20 }}>
            <article className="metric-card metric-emerald">
              <div className="metric-label">
                <BadgeDollarSign size={16} /> <span>可用账户余额</span>
              </div>
              <div className="metric-value">{money(stats.availableIncome)}</div>
              <div className="metric-note">已核验通过并可直接发起提现结算的金额</div>
            </article>
            <article className="metric-card metric-amber">
              <div className="metric-label">
                <ClipboardList size={16} /> <span>已领待回填任务</span>
              </div>
              <div className="metric-value">{stats.pendingPublish}</div>
              <div className="metric-note">已下载素材，发布作品后需尽快补齐链接</div>
            </article>
            <article className="metric-card metric-blue">
              <div className="metric-label">
                <ShieldCheck size={16} /> <span>已交待核验作品</span>
              </div>
              <div className="metric-value">{stats.pendingReview}</div>
              <div className="metric-note">链接已提交，系统与人工核对后即刻结算</div>
            </article>
            <article className="metric-card metric-rose">
              <div className="metric-label">
                <WalletCards size={16} /> <span>违规冻结/风控</span>
              </div>
              <div className="metric-value">{money(stats.frozenIncome)}</div>
              <div className="metric-note">{stats.invalidPosts} 条异常作品导致分账被延迟限制</div>
            </article>
          </section>

          <section className="content-grid">
            <div className="content-card">
              <div className="section-heading-row">
                <h2 className="section-title">🚀 稳步赚钱核心步骤</h2>
                {profile ? <StatusBadge status={profile.onboardingStatus} /> : null}
              </div>
              <div className="workflow-steps-modern">
                <Link className="workflow-step-item" href="/partner/onboarding">
                  <div className="step-num">1</div>
                  <div className="step-body">
                    <strong>新手起航与准入保持</strong>
                    <p>提交账号资料、完成新手考试和协议签署，守住信用分，确保持续拿独家爆款授权。</p>
                  </div>
                  <span className="step-badge status-normal">{stats.creditScore} 信用分</span>
                  <ChevronRight size={16} className="step-arrow" />
                </Link>
                <Link className="workflow-step-item" href="/partner/authorizations">
                  <div className="step-num">2</div>
                  <div className="step-body">
                    <strong>申请扩大 IP 授权范围</strong>
                    <p>目前拥有 {stats.activeAuthorizations} 个生效中授权。授权越多，可解锁的爆款高分成佣金任务越多。</p>
                  </div>
                  <span className="step-badge status-success">申请授权</span>
                  <ChevronRight size={16} className="step-arrow" />
                </Link>
                <Link className="workflow-step-item" href="/partner/tasks">
                  <div className="step-num">3</div>
                  <div className="step-body">
                    <strong>领取高曝光、高分成任务</strong>
                    <p>当前共有 {stats.availableTaskCount} 个可领素材任务。建议优先选择带货转化极高的爆单商品。</p>
                  </div>
                  <span className="step-badge status-warning">去领任务</span>
                  <ChevronRight size={16} className="step-arrow" />
                </Link>
                <Link className="workflow-step-item" href="/partner/wallet">
                  <div className="step-num">4</div>
                  <div className="step-body">
                    <strong>查看账单明细与提现</strong>
                    <p>每笔 GMV 抽成、预估算和冻结惩罚都可穿透追溯至对应的视频作品。公开透明，快速提现。</p>
                  </div>
                  <span className="step-badge status-info">我的钱包</span>
                  <ChevronRight size={16} className="step-arrow" />
                </Link>
              </div>
            </div>

            <div className="content-card promo-tips-card">
              <h3>💡 合伙人赚钱黄金法则</h3>
              <ul>
                <li><strong>素材二创：</strong>尽量对下载的切片素材做混剪、添加转场或气泡，提高平台去重通过率，更容易爆播放。</li>
                <li><strong>黄金回填：</strong>发布作品后 24 小时内一定要在此回填视频作品链接，越早回填越快锁定结算权重。</li>
                <li><strong>信用保护：</strong>请不要挂羊头卖狗肉或引导不实宣传，否则风控拦截会直接冻结本月全部余额。</li>
              </ul>
            </div>
          </section>
        </div>

        {/* TAB 2: 任务与领取记录 */}
        <div className={`modern-tab-panel ${activeTab === "tasks" ? "active" : ""}`}>
          <section className="table-card">
            <div className="table-header">
              <h2 className="table-title">📝 我的历史领取记录 (最近 10 条)</h2>
              <Link className="button primary-btn-sm" href="/partner/tasks">
                去领新任务
              </Link>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>已领切片素材</th>
                    <th>挂载商品</th>
                    <th>分发账号</th>
                    <th>防伪专属 Token</th>
                    <th>当前核验状态</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-10">暂无任何素材领取记录，快去领取并下载你的第一个赚钱素材吧！</td>
                    </tr>
                  ) : (
                    claims.map((claim) => (
                      <tr key={claim.id}>
                        <td>
                          <div className="item-title">{claim.materialTitle}</div>
                          <div className="item-meta">领用时间: {claim.id.startsWith("claim-") ? "刚刚" : "近期"}</div>
                        </td>
                        <td>{claim.productName}</td>
                        <td>
                          <span className="badge info-badge-soft">{claim.socialAccount}</span>
                        </td>
                        <td>
                          <code className="token-code">{claim.claimToken}</code>
                        </td>
                        <td>
                          <StatusBadge status={claim.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* TAB 3: 作品收益分账 */}
        <div className={`modern-tab-panel ${activeTab === "works" ? "active" : ""}`}>
          <section className="table-card">
            <div className="table-header">
              <h2 className="table-title">🎥 我的分发作品收益账单</h2>
              <span className="badge success-badge-soft">
                <Trophy size={12} /> 我的全站带货排名：第 {stats.rankByGmv} 名
              </span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>已发作品关联素材</th>
                    <th>关联主推商品</th>
                    <th>核验状态</th>
                    <th>成交 GMV</th>
                    <th>我的预估佣金</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-10">暂无任何作品收益记录，视频回填并产生出单后会在本表更新。</td>
                    </tr>
                  ) : (
                    recentRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <div className="item-title">{record.materialTitle}</div>
                          <div className="item-meta">作品链接: <span className="text-truncate-link">{record.publishUrl}</span></div>
                        </td>
                        <td>{record.productName}</td>
                        <td>
                          <StatusBadge status={record.status} />
                        </td>
                    <td className="text-right text-bold text-emerald">{money(record.gmv)}</td>
                    <td className="text-right text-bold text-amber">
                      {(record.status === "verified" || record.status === "settled") ? money(record.gmv * 0.2) : money(0)}
                    </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* TAB 4: 赚钱通知提醒 */}
        <div className={`modern-tab-panel ${activeTab === "alerts" ? "active" : ""}`}>
          <section className="content-card">
            <h2 className="section-title">🔔 赚钱机会与系统重要提醒</h2>
            <div className="partner-notifications-list">
              {notices.length === 0 ? (
                <div className="text-center text-muted py-8">暂无任何系统提醒</div>
              ) : (
                notices.map((notice) => (
                  <button
                    className={`partner-notice-row-modern ${notice.isRead ? "read" : "unread"}`}
                    key={notice.id}
                    onClick={() => markNotificationRead(notice.id)}
                  >
                    <div className="notice-badge">
                      {notice.isRead ? <span className="dot-read" /> : <span className="dot-unread-glow" />}
                    </div>
                    <div className="notice-content-body">
                      <div className="notice-title-row">
                        <strong>{notice.title}</strong>
                        <span className="notice-time">{notice.createdAt}</span>
                      </div>
                      <p className="notice-text">{notice.content}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
