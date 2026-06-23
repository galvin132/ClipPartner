"use client";

import Link from "next/link";
import { BarChart3, Crown, FileVideo2, Search, ShieldAlert, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buildIpTalentPerformance, buildMaterialPerformance } from "@/lib/analytics";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

function conversionRate(effectivePosts: number, claimCount: number) {
  if (!claimCount) return "0%";
  return `${Math.round((effectivePosts / claimCount) * 100)}%`;
}

export default function AdminIpTalentsPage() {
  const { state } = useClipPartnerStore();
  const [query, setQuery] = useState("");
  const ipTalents = useMemo(() => buildIpTalentPerformance(state), [state]);
  const materialRank = useMemo(() => buildMaterialPerformance(state), [state]);
  const keyword = query.trim().toLowerCase();
  const filteredTalents = ipTalents.filter(
    (item) =>
      !keyword ||
      [item.ipName, ...item.platforms].join(" ").toLowerCase().includes(keyword)
  );
  const totalGmv = ipTalents.reduce((sum, item) => sum + item.gmv, 0);
  const totalMaterials = ipTalents.reduce((sum, item) => sum + item.materialCount, 0);
  const totalEffectivePosts = ipTalents.reduce((sum, item) => sum + item.effectivePosts, 0);
  const totalRisks = ipTalents.reduce((sum, item) => sum + item.riskCount + item.invalidPosts, 0);

  return (
    <AppShell active="/admin/ip-talents">
      <PageHeader
        kicker="IP达人管理"
        title="看清楚哪个主播IP真正帮你赚钱"
        subtitle="这里管理的是内容源头表现：每个IP产出了多少素材，被领取多少次，带来多少有效作品、GMV、佣金和风险。商务演示时，这一页就是客户决定继续投谁的依据。"
        actions={
          <Link className="button primary" href="/admin/materials">
            <FileVideo2 size={16} aria-hidden /> 补充素材
          </Link>
        }
      />

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-label">
            <Crown size={16} aria-hidden /> IP/主播数
          </div>
          <div className="metric-value">{ipTalents.length}</div>
          <div className="metric-note">按素材和任务中的 IP 名称聚合</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <BarChart3 size={16} aria-hidden /> 总GMV
          </div>
          <div className="metric-value">{money(totalGmv)}</div>
          <div className="metric-note">来自所有发布记录的成交额</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <FileVideo2 size={16} aria-hidden /> 内容资产
          </div>
          <div className="metric-value">{totalMaterials}</div>
          <div className="metric-note">{totalEffectivePosts} 条作品已通过核验</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <ShieldAlert size={16} aria-hidden /> 风险信号
          </div>
          <div className="metric-value">{totalRisks}</div>
          <div className="metric-note">用于判断授权和素材投放边界</div>
        </article>
      </section>

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 320 }}>
          <Search size={16} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 IP / 主播 / 平台" />
        </label>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">IP达人表现看板</h2>
          <span className="badge info">先用现有数据聚合，不新增数据库表</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>IP / 主播</th>
              <th>平台</th>
              <th>素材资产</th>
              <th>领取 / 下载</th>
              <th>有效作品</th>
              <th>GMV</th>
              <th>佣金</th>
              <th>商品 / 风险</th>
            </tr>
          </thead>
          <tbody>
            {filteredTalents.map((item) => (
              <tr key={item.ipName}>
                <td>
                  <div className="item-title">{item.ipName}</div>
                  <div className="item-meta">
                    {item.taskCount} 个分发任务 · 转化率 {conversionRate(item.effectivePosts, item.claimCount)}
                  </div>
                </td>
                <td>{item.platforms.join(" / ") || "待补充"}</td>
                <td>
                  <div className="item-title">{item.materialCount} 条素材</div>
                  <div className="item-meta">{item.publishedMaterialCount} 条可领取</div>
                </td>
                <td>
                  {item.claimCount} / {item.downloadCount}
                </td>
                <td>
                  <div className="item-title">{item.effectivePosts}</div>
                  <div className="item-meta">{item.submittedPosts} 条待核验</div>
                </td>
                <td>{money(item.gmv)}</td>
                <td>{money(item.commission)}</td>
                <td>
                  <div className="toolbar">
                    <span className="badge success">
                      <ShoppingBag size={13} aria-hidden /> {item.productCount}
                    </span>
                    <span className={item.riskCount + item.invalidPosts > 0 ? "badge danger" : "badge success"}>
                      <ShieldAlert size={13} aria-hidden /> {item.riskCount + item.invalidPosts}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="content-grid" style={{ marginTop: 18 }}>
        <div className="content-card">
          <h2 className="section-title">这个IP为什么值得继续投</h2>
          <div className="value-stack">
            <div>
              <Crown size={18} aria-hidden />
              <strong>看内容源头</strong>
              <span>先判断哪个主播IP能稳定产出素材和有效作品。</span>
            </div>
            <div>
              <BarChart3 size={18} aria-hidden />
              <strong>看成交结果</strong>
              <span>GMV、佣金、有效作品数决定后续预算和任务优先级。</span>
            </div>
            <div>
              <ShieldAlert size={18} aria-hidden />
              <strong>看风险边界</strong>
              <span>风险高的IP要收紧授权、商品和话术规则。</span>
            </div>
          </div>
        </div>

        <div className="content-card">
          <h2 className="section-title">各IP爆款素材</h2>
          <div className="rank-list">
            {materialRank.slice(0, 5).map((item, index) => (
              <Link className="rank-row" href={`/admin/materials/${item.id}`} key={item.id}>
                <span className="rank-index">{index + 1}</span>
                <div>
                  <div className="rank-title">{item.title}</div>
                  <div className="rank-meta">
                    {item.ipName} · 领取 {item.claims} · 下载 {item.downloads}
                  </div>
                </div>
                <div className="rank-value">{money(item.gmv)}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
