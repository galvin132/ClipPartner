"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Crown,
  FileVideo2,
  Flame,
  RotateCcw,
  ShieldCheck,
  Trophy,
  UsersRound,
  TrendingUp,
  Award,
  Zap,
  ShoppingBag
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { money } from "@/lib/domain";
import {
  buildDistributorPerformance,
  buildGrowthSummary,
  buildIpTalentPerformance,
  buildMaterialPerformance,
  buildProductPerformance
} from "@/lib/analytics";
import { useClipPartnerStore } from "@/lib/local-store";

function formatMultiplier(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "待计算";
  return `${value.toFixed(1)}x`;
}

function formatRate(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default function DashboardPage() {
  const { state, resetDemoData } = useClipPartnerStore();
  const [activeTab, setActiveTab] = useState<"overview" | "rankings" | "conversion" | "todo">("overview");

  const summary = buildGrowthSummary(state);
  const ipRank = buildIpTalentPerformance(state);
  const distributorRank = buildDistributorPerformance(state);
  const productRank = buildProductPerformance(state);
  const materialRank = buildMaterialPerformance(state);
  const topIp = ipRank[0];
  const topProduct = productRank[0];

  const heroMetrics = [
    {
      label: "本月切片GMV",
      value: money(summary.totalGmv),
      note: "被二次分发后带来的成交盘子",
      icon: BadgeDollarSign,
      colorClass: "metric-emerald"
    },
    {
      label: "有效成交作品",
      value: String(summary.effectivePosts),
      note: `发布核验通过率 ${formatRate(summary.effectivePosts, summary.distributedWorks)}`,
      icon: ShieldCheck,
      colorClass: "metric-blue"
    },
    {
      label: "活跃分发达人",
      value: String(summary.activeDistributors),
      note: "已经产生领取、发布或成交记录的人",
      icon: UsersRound,
      colorClass: "metric-violet"
    },
    {
      label: "待结算佣金",
      value: money(summary.payableCommission),
      note: `有效GMV/待结算 ${formatMultiplier(summary.roiMultiplier)}`,
      icon: Trophy,
      colorClass: "metric-amber"
    },
    {
      label: "风险拦截",
      value: String(summary.riskIntercepts),
      note: "不合规作品与风控记录已进入流程",
      icon: ShieldCheck,
      colorClass: "metric-rose"
    }
  ];

  return (
    <AppShell active="/">
      <PageHeader
        kicker="切片分销增长战报"
        title="让客户第一眼看到：谁帮你卖了多少钱"
        subtitle="把直播内容、IP达人、分发达人、商品和风险统一拉成一张增长账单。对外展示的是实际成交、按效果结算和安全可控，数据一目了然。"
        actions={
          <>
            <button className="button" onClick={resetDemoData}>
              <RotateCcw size={16} aria-hidden /> 重置演示数据
            </button>
            <Link className="button primary" href="/admin/ip-talents">
              <Crown size={16} aria-hidden /> 看 IP 达人
            </Link>
          </>
        }
      />

      {/* 现代化的 Tabs 选择器 */}
      <div className="modern-tabs-nav">
        <button
          className={`modern-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <TrendingUp size={16} />
          <span>大盘全局概览</span>
        </button>
        <button
          className={`modern-tab-btn ${activeTab === "rankings" ? "active" : ""}`}
          onClick={() => setActiveTab("rankings")}
        >
          <Award size={16} />
          <span>达人与 IP 排行</span>
        </button>
        <button
          className={`modern-tab-btn ${activeTab === "conversion" ? "active" : ""}`}
          onClick={() => setActiveTab("conversion")}
        >
          <ShoppingBag size={16} />
          <span>爆款与商品转化</span>
        </button>
        <button
          className={`modern-tab-btn ${activeTab === "todo" ? "active" : ""}`}
          onClick={() => setActiveTab("todo")}
        >
          <Zap size={16} />
          <span>运营待办工作台</span>
          {(state.authorizationRequests.filter((i) => i.status === "pending").length +
            state.publishRecords.filter((i) => i.status === "submitted").length) > 0 && (
            <span className="tab-badge-dot" />
          )}
        </button>
      </div>

      {/* TAB 1: 全局数据概览 */}
      <div className={`modern-tab-panel ${activeTab === "overview" ? "active" : ""}`}>
        <section className="growth-hero" aria-label="增长摘要">
          <div className="growth-hero-copy">
            <span className="badge success">商业演示大盘</span>
            <h2>直播结束不是结束，素材还能继续帮你卖货。</h2>
            <p>
              ClipPartner 把一场直播拆成可领取、可核验、可结算的分发任务，让授权账号矩阵持续种草成交。
              平台只为有效作品和真实结果结算，同时保留授权、商品、链接和风控证据。
            </p>
            <div className="growth-proof-grid">
              <div>
                <strong>{summary.contentOutputs}</strong>
                <span>条内容资产</span>
              </div>
              <div>
                <strong>{topIp?.ipName ?? "待跑量"}</strong>
                <span>当前最强 IP</span>
              </div>
              <div>
                <strong>{topProduct?.productName ?? "待绑定商品"}</strong>
                <span>当前主推商品</span>
              </div>
            </div>
          </div>
          <div className="growth-hero-panel">
            <div className="hero-panel-label">本月成交盘</div>
            <div className="hero-panel-value">{money(summary.totalGmv)}</div>
            <div className="hero-panel-subtitle">
              {summary.distributedWorks} 条分发作品，{summary.effectivePosts} 条通过核验
            </div>
            <Link className="button primary" href="/admin/publish-records">
              查看成交作品 <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>

        {/* 核心指标卡片组 */}
        <section className="metrics-grid growth-metrics" aria-label="核心赚钱指标">
          {heroMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article className={`metric-card ${metric.colorClass}`} key={metric.label}>
                <div className="metric-label">
                  <Icon size={17} aria-hidden />
                  <span>{metric.label}</span>
                </div>
                <div className="metric-value">{metric.value}</div>
                <div className="metric-note">{metric.note}</div>
              </article>
            );
          })}
        </section>

        {/* 价值阐述 */}
        <section className="content-grid-full">
          <div className="content-card">
            <h2 className="section-title">分销系统核心增益</h2>
            <div className="value-row-grid">
              <div className="value-row-item">
                <div className="icon-wrapper">
                  <Flame size={20} />
                </div>
                <div>
                  <strong>海量矩阵账号帮卖</strong>
                  <span>自动将直播素材分发给数千位授权合伙人，瞬间成百上千号同发，裂变级扩大曝光。</span>
                </div>
              </div>
              <div className="value-row-item">
                <div className="icon-wrapper">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <strong>纯按结果与成交结算</strong>
                  <span>只有通过后台严格算法核验并产生实际销售额的作品才计入结算，不为水分埋单。</span>
                </div>
              </div>
              <div className="value-row-item">
                <div className="icon-wrapper">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <strong>合规与风险全链追溯</strong>
                  <span>领取素材、挂载小黄车、回填链接、全量监控，每一个账号的每一次违规都精准拦截定位。</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* TAB 2: 达人与 IP 排行 */}
      <div className={`modern-tab-panel ${activeTab === "rankings" ? "active" : ""}`}>
        <section className="content-grid">
          <div className="content-card">
            <div className="section-heading-row">
              <h2 className="section-title">🏆 IP / 主播达人 GMV 榜</h2>
              <Link className="text-link" href="/admin/ip-talents">
                管理全部 IP
              </Link>
            </div>
            <div className="rank-list">
              {ipRank.slice(0, 5).map((item, index) => (
                <Link className="rank-row" href="/admin/ip-talents" key={item.ipName}>
                  <span className="rank-index">{index + 1}</span>
                  <div className="rank-main-content">
                    <div className="rank-title">{item.ipName}</div>
                    <div className="rank-meta">
                      {item.materialCount} 条素材 · {item.effectivePosts} 条有效作品 · {item.riskCount} 条风险
                    </div>
                  </div>
                  <div className="rank-value">{money(item.gmv)}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="content-card">
            <div className="section-heading-row">
              <h2 className="section-title">🏆 分发达人 GMV 榜</h2>
              <Link className="text-link" href="/admin/distributors">
                管理全部达人
              </Link>
            </div>
            <div className="rank-list">
              {distributorRank.slice(0, 5).map((item, index) => (
                <Link className="rank-row" href="/admin/distributors" key={item.name}>
                  <span className="rank-index">{index + 1}</span>
                  <div className="rank-main-content">
                    <div className="rank-title">{item.name}</div>
                    <div className="rank-meta">
                      {item.effectivePosts}/{item.posts} 条有效 · 信用分 {item.creditScore}
                    </div>
                  </div>
                  <div className="rank-value">{money(item.gmv)}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* TAB 3: 爆款与商品转化 */}
      <div className={`modern-tab-panel ${activeTab === "conversion" ? "active" : ""}`}>
        <section className="content-grid" style={{ marginBottom: 18 }}>
          <div className="content-card">
            <div className="section-heading-row">
              <h2 className="section-title">🔥 爆款分发素材排行</h2>
              <Link className="text-link" href="/admin/materials">
                管理素材库
              </Link>
            </div>
            <div className="rank-list">
              {materialRank.slice(0, 5).map((item, index) => (
                <Link className="rank-row" href={`/admin/materials/${item.id}`} key={item.id}>
                  <span className="rank-index">{index + 1}</span>
                  <div className="rank-main-content">
                    <div className="rank-title">{item.title}</div>
                    <div className="rank-meta">
                      {item.ipName} · 推荐热度 {item.heat} · 关联 {item.productName}
                    </div>
                  </div>
                  <div className="rank-value">{money(item.gmv)}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="content-card promo-card">
            <div className="promo-card-content">
              <h3>爆款分发逻辑建议</h3>
              <p>
                当前主推爆款素材成交 GMV 占比达 65% 以上。运营应当：
              </p>
              <ul>
                <li>将高转化、高佣金比例的商品置顶推荐</li>
                <li>及时将大主播高能带货片段切片成 15s - 30s 黄金素材</li>
                <li>对信用分高于 90 分的优秀分发者开放免审极速领用授权</li>
              </ul>
              <Link className="button primary" href="/admin/materials">
                发布新素材
              </Link>
            </div>
          </div>
        </section>

        <section className="table-card">
          <div className="table-header">
            <h2 className="table-title">🛍️ 平台商品转化分析大表</h2>
            <span className="badge info">把预算和素材投给真正高转化高出单的商品</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>商品信息</th>
                  <th>投放平台</th>
                  <th>有效作品数</th>
                  <th>分配素材数</th>
                  <th>累计 GMV</th>
                  <th>产生佣金</th>
                </tr>
              </thead>
              <tbody>
                {productRank.slice(0, 6).map((item) => (
                  <tr key={item.productName}>
                    <td>
                      <div className="item-title">{item.productName}</div>
                      <div className="item-meta">{item.posts} 条分发记录</div>
                    </td>
                    <td>
                      <span className="badge info">{item.platform}</span>
                    </td>
                    <td className="text-right text-bold">{item.effectivePosts}</td>
                    <td className="text-right">{item.materialCount}</td>
                    <td className="text-right text-emerald text-bold">{money(item.gmv)}</td>
                    <td className="text-right text-amber">{money(item.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* TAB 4: 运营待办工作台 */}
      <div className={`modern-tab-panel ${activeTab === "todo" ? "active" : ""}`}>
        <section className="content-card">
          <div className="section-heading-row">
            <h2 className="section-title">⚡ 极速运营待办通道</h2>
            <p className="section-subtitle-compact">日常高频待处理事务，点击可一键直达对应审核模块。</p>
          </div>
          <div className="analytics-grid">
            <Link className="analytics-cell hover-effect" href="/admin/authorizations">
              <span className="cell-label">待审核授权申请</span>
              <strong className="cell-value color-violet">
                {state.authorizationRequests.filter((item) => item.status === "pending").length}
              </strong>
              <span className="cell-action">去审核 <ArrowRight size={12} /></span>
            </Link>
            <Link className="analytics-cell hover-effect" href="/admin/publish-records">
              <span className="cell-label">待核验作品链接</span>
              <strong className="cell-value color-amber">
                {state.publishRecords.filter((item) => item.status === "submitted").length}
              </strong>
              <span className="cell-action">去核验 <ArrowRight size={12} /></span>
            </Link>
            <Link className="analytics-cell hover-effect" href="/admin/clip-tasks">
              <span className="cell-label">队列中切片任务</span>
              <strong className="cell-value color-blue">
                {state.clipTasks.filter((item) => ["queued", "processing"].includes(item.status)).length}
              </strong>
              <span className="cell-action">去监控 <ArrowRight size={12} /></span>
            </Link>
            <Link className="analytics-cell hover-effect" href="/admin/risk">
              <span className="cell-label">待处理违规拦截</span>
              <strong className="cell-value color-rose">
                {state.riskRecords.filter((item) => item.status !== "resolved").length}
              </strong>
              <span className="cell-action">去处理 <ArrowRight size={12} /></span>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
