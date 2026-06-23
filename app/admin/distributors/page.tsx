"use client";

import { BadgeDollarSign, Search, ShieldAlert, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { buildDistributorPerformance, displayDistributorName } from "@/lib/analytics";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

function passRate(effectivePosts: number, posts: number) {
  if (!posts) return "0%";
  return `${Math.round((effectivePosts / posts) * 100)}%`;
}

export default function AdminDistributorsPage() {
  const { state, updateDistributorOnboarding, refreshRemoteList } = useClipPartnerStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    void refreshRemoteList("distributorProfiles", { q: query, limit: 50 });
    void refreshRemoteList("publishRecords", { limit: 50 });
    void refreshRemoteList("taskClaims", { limit: 50 });
  }, [query, refreshRemoteList]);

  const performances = useMemo(() => buildDistributorPerformance(state), [state]);
  const performanceByName = useMemo(() => new Map(performances.map((item) => [item.name, item])), [performances]);
  const distributors = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return state.distributorProfiles.filter(
      (item) =>
        !keyword ||
        [item.displayName, item.phone, item.wechatId, item.onboardingStatus].join(" ").toLowerCase().includes(keyword)
    );
  }, [query, state.distributorProfiles]);
  const totalGmv = performances.reduce((sum, item) => sum + item.gmv, 0);
  const totalCommission = performances.reduce((sum, item) => sum + item.commission, 0);
  const activeDistributors = performances.filter((item) => item.posts > 0).length;
  const blockedDistributors = distributors.filter((item) => item.violationCount > 0 || item.creditScore < 60).length;

  return (
    <AppShell active="/admin/distributors">
      <PageHeader
        kicker="分发达人资产管理"
        title="不是看谁注册了，而是看谁真的帮你卖货"
        subtitle="把分发者的账号、授权、信用分、作品、GMV、佣金和风险放在同一张表里。商务演示时，这一页回答客户最关心的问题：哪些人值得继续给素材和授权。"
        actions={<span className="badge info">{distributors.length} 个分发达人</span>}
      />

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-label">
            <BadgeDollarSign size={16} aria-hidden /> 分发GMV
          </div>
          <div className="metric-value">{money(totalGmv)}</div>
          <div className="metric-note">由分发作品带来的成交额</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">平台佣金</div>
          <div className="metric-value">{money(totalCommission)}</div>
          <div className="metric-note">后续按授权分成进入结算</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <Trophy size={16} aria-hidden /> 活跃达人
          </div>
          <div className="metric-value">{activeDistributors}</div>
          <div className="metric-note">已有发布或成交记录</div>
        </article>
        <article className="metric-card">
          <div className="metric-label">
            <ShieldAlert size={16} aria-hidden /> 风险达人
          </div>
          <div className="metric-value">{blockedDistributors}</div>
          <div className="metric-note">低信用或已有违规记录</div>
        </article>
      </section>

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 320 }}>
          <Search size={16} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名 / 手机 / 微信 / 状态" />
        </label>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">分发达人表现</h2>
          <span className="badge warning">低信用、低通过率、风险达人要收紧授权和素材领取</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发达人</th>
              <th>准入状态</th>
              <th>信用 / 账号</th>
              <th>作品表现</th>
              <th>GMV / 佣金</th>
              <th>风险</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {distributors.map((item) => {
              const displayName = displayDistributorName(item.displayName);
              const performance = performanceByName.get(displayName);
              return (
                <tr key={item.id}>
                  <td>
                    <div className="item-title">{displayName}</div>
                    <div className="item-meta">
                      {item.phone} · {item.wechatId}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={item.onboardingStatus} />
                    <div className="item-meta">{item.agreementSigned ? "协议已签" : "协议待签"}</div>
                  </td>
                  <td>
                    <div className="item-title">信用分 {item.creditScore}</div>
                    <div className="item-meta">
                      {item.accountCount} 个账号 · {item.authorizationCount} 个授权
                    </div>
                  </td>
                  <td>
                    <div className="item-title">
                      {performance?.effectivePosts ?? 0}/{performance?.posts ?? 0} 条有效
                    </div>
                    <div className="item-meta">通过率 {passRate(performance?.effectivePosts ?? 0, performance?.posts ?? 0)}</div>
                  </td>
                  <td>
                    <div className="item-title">{money(performance?.gmv ?? 0)}</div>
                    <div className="item-meta">佣金 {money(performance?.commission ?? item.payableCommission)}</div>
                  </td>
                  <td>
                    <span className={item.violationCount > 0 || (performance?.invalidPosts ?? 0) > 0 ? "badge danger" : "badge success"}>
                      <ShieldAlert size={13} aria-hidden /> {item.violationCount + (performance?.invalidPosts ?? 0)}
                    </span>
                  </td>
                  <td>
                    <div className="toolbar">
                      <button className="button" onClick={() => updateDistributorOnboarding(item.displayName, "ready_for_authorization")}>
                        标记可授权
                      </button>
                      <button className="button" onClick={() => updateDistributorOnboarding(item.displayName, "suspended")}>
                        暂停
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
