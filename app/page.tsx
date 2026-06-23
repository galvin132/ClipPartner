"use client";

import Link from "next/link";
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
  UsersRound
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
      note: "直播内容被二次分发后带来的成交盘子",
      icon: BadgeDollarSign
    },
    {
      label: "有效成交作品",
      value: String(summary.effectivePosts),
      note: `发布核验通过率 ${formatRate(summary.effectivePosts, summary.distributedWorks)}`,
      icon: ShieldCheck
    },
    {
      label: "活跃分发达人",
      value: String(summary.activeDistributors),
      note: "已经产生领取、发布或成交记录的人",
      icon: UsersRound
    },
    {
      label: "待结算佣金",
      value: money(summary.payableCommission),
      note: `有效GMV/待结算 ${formatMultiplier(summary.roiMultiplier)}`,
      icon: Trophy
    },
    {
      label: "风险拦截",
      value: String(summary.riskIntercepts),
      note: "不合规作品与风控记录已进入流程",
      icon: ShieldCheck
    }
  ];

  return (
    <AppShell active="/">
      <PageHeader
        kicker="切片分销增长战报"
        title="让客户第一眼看到：谁帮你卖了多少钱"
        subtitle="把直播内容、IP达人、分发达人、商品和风险统一拉成一张增长账单。对外讲的是新增成交、按结果结算和安全可控，不是后台有多少表格。"
        actions={
          <>
            <button className="button" onClick={resetDemoData}>
              <RotateCcw size={16} aria-hidden /> 重置演示数据
            </button>
            <Link className="button primary" href="/admin/ip-talents">
              <Crown size={16} aria-hidden /> 看IP达人
            </Link>
          </>
        }
      />

      <section className="growth-hero" aria-label="增长摘要">
        <div className="growth-hero-copy">
          <span className="badge success">商业演示第一屏</span>
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
              <span>当前最强IP</span>
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

      <section className="metrics-grid growth-metrics" aria-label="核心赚钱指标">
        {heroMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
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

      <section className="content-grid">
        <div className="content-card">
          <div className="section-heading-row">
            <h2 className="section-title">IP / 主播达人GMV榜</h2>
            <Link className="text-link" href="/admin/ip-talents">
              管理IP达人
            </Link>
          </div>
          <div className="rank-list">
            {ipRank.slice(0, 5).map((item, index) => (
              <Link className="rank-row" href="/admin/ip-talents" key={item.ipName}>
                <span className="rank-index">{index + 1}</span>
                <div>
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
          <h2 className="section-title">为什么客户愿意合作</h2>
          <div className="value-stack">
            <div>
              <Flame size={18} aria-hidden />
              <strong>更多账号帮你卖</strong>
              <span>把直播素材分发给授权合伙人，扩大曝光和成交。</span>
            </div>
            <div>
              <BarChart3 size={18} aria-hidden />
              <strong>按结果结算</strong>
              <span>通过核验、产生有效数据的作品才进入结算。</span>
            </div>
            <div>
              <ShieldCheck size={18} aria-hidden />
              <strong>风险关进流程</strong>
              <span>授权、领取、回填、核验、冻结都有记录可追责。</span>
            </div>
          </div>
        </div>
      </section>

      <section className="content-grid" style={{ marginTop: 18 }}>
        <div className="content-card">
          <h2 className="section-title">爆款素材排行</h2>
          <div className="rank-list">
            {materialRank.slice(0, 5).map((item, index) => (
              <Link className="rank-row" href={`/admin/materials/${item.id}`} key={item.id}>
                <span className="rank-index">{index + 1}</span>
                <div>
                  <div className="rank-title">{item.title}</div>
                  <div className="rank-meta">
                    {item.ipName} · 热度 {item.heat} · {item.productName}
                  </div>
                </div>
                <div className="rank-value">{money(item.gmv)}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="content-card">
          <h2 className="section-title">分发达人GMV榜</h2>
          <div className="rank-list">
            {distributorRank.slice(0, 5).map((item, index) => (
              <Link className="rank-row" href="/admin/distributors" key={item.name}>
                <span className="rank-index">{index + 1}</span>
                <div>
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

      <section className="table-card" style={{ marginTop: 18 }}>
        <div className="table-header">
          <h2 className="table-title">商品转化榜</h2>
          <span className="badge info">把预算和素材继续投给真正出单的商品</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>商品</th>
              <th>平台</th>
              <th>有效作品</th>
              <th>素材数</th>
              <th>GMV</th>
              <th>佣金</th>
            </tr>
          </thead>
          <tbody>
            {productRank.slice(0, 6).map((item) => (
              <tr key={item.productName}>
                <td>
                  <div className="item-title">{item.productName}</div>
                  <div className="item-meta">{item.posts} 条发布记录</div>
                </td>
                <td>{item.platform}</td>
                <td>{item.effectivePosts}</td>
                <td>{item.materialCount}</td>
                <td>{money(item.gmv)}</td>
                <td>{money(item.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="content-card" style={{ marginTop: 18 }}>
        <h2 className="section-title">运营待办仍在，但不抢第一屏</h2>
        <div className="analytics-grid">
          <div className="analytics-cell">
            <span>待审核授权</span>
            <strong>{state.authorizationRequests.filter((item) => item.status === "pending").length}</strong>
          </div>
          <div className="analytics-cell">
            <span>待核验作品</span>
            <strong>{state.publishRecords.filter((item) => item.status === "submitted").length}</strong>
          </div>
          <div className="analytics-cell">
            <span>处理中切片</span>
            <strong>{state.clipTasks.filter((item) => ["queued", "processing"].includes(item.status)).length}</strong>
          </div>
          <div className="analytics-cell">
            <span>待处理风控</span>
            <strong>{state.riskRecords.filter((item) => item.status !== "resolved").length}</strong>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
