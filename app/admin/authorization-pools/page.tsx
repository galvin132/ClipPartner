"use client";

import { Pause, Play, Plus, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { useClipPartnerStore } from "@/lib/local-store";

export default function AuthorizationPoolsPage() {
  const { state, addAuthorizationPool, updateAuthorizationPoolStatus, refreshRemoteList } = useClipPartnerStore();
  const [query, setQuery] = useState("");
  useEffect(() => {
    void refreshRemoteList("authorizationPools", { q: query, limit: 50 });
  }, [query, refreshRemoteList]);

  const pools = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return state.authorizationPools.filter(
      (item) => !keyword || [item.ipName, item.platform, item.requirement].join(" ").toLowerCase().includes(keyword)
    );
  }, [query, state.authorizationPools]);

  return (
    <AppShell active="/admin/authorization-pools">
      <PageHeader
        kicker="授权池"
        title="控制每个 IP 的授权名额、门槛和默认分成"
        subtitle="对标众小二/三只羊授权池：名额满、信用分不足、账号未审都会影响申请和任务领取。"
        actions={
          <button
            className="button primary"
            onClick={() =>
              addAuthorizationPool({
                ipName: "新 IP 授权池",
                platform: "抖音",
                totalQuota: 100,
                minCreditScore: 80,
                defaultShareRate: 30,
                dailyClaimLimit: 5,
                requirement: "完成准入、签署协议、账号审核通过。"
              })
            }
          >
            <Plus size={16} aria-hidden /> 新建授权池
          </button>
        }
      />

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 320 }}>
          <Search size={16} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 IP / 平台 / 门槛" />
        </label>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">授权池列表</h2>
          <span className="badge info">授权通过会占用名额</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>IP</th>
              <th>名额</th>
              <th>门槛</th>
              <th>默认分成</th>
              <th>每日领取</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {pools.map((pool) => (
              <tr key={pool.id}>
                <td>
                  <div className="item-title">{pool.ipName}</div>
                  <div className="item-meta">{pool.platform}</div>
                </td>
                <td>
                  <div className="item-title">
                    {pool.usedQuota} / {pool.totalQuota}
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${Math.min(100, (pool.usedQuota / pool.totalQuota) * 100)}%` }} />
                  </div>
                </td>
                <td>
                  <div className="item-title">信用分 {pool.minCreditScore}+</div>
                  <div className="item-meta">{pool.requirement}</div>
                </td>
                <td>{pool.defaultShareRate}%</td>
                <td>{pool.dailyClaimLimit}</td>
                <td>
                  <StatusBadge status={pool.status} />
                </td>
                <td>
                  <div className="toolbar">
                    <button className="button" title="开放" onClick={() => updateAuthorizationPoolStatus(pool.id, "open")}>
                      <Play size={16} aria-hidden />
                    </button>
                    <button className="button" title="暂停" onClick={() => updateAuthorizationPoolStatus(pool.id, "paused")}>
                      <Pause size={16} aria-hidden />
                    </button>
                    <button className="button" title="满额" onClick={() => updateAuthorizationPoolStatus(pool.id, "full")}>
                      <XCircle size={16} aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
