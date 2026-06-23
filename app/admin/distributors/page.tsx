"use client";

import { Search, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

export default function AdminDistributorsPage() {
  const { state, updateDistributorOnboarding, refreshRemoteList } = useClipPartnerStore();
  const [query, setQuery] = useState("");
  useEffect(() => {
    void refreshRemoteList("distributorProfiles", { q: query, limit: 50 });
  }, [query, refreshRemoteList]);

  const distributors = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return state.distributorProfiles.filter(
      (item) => !keyword || [item.displayName, item.phone, item.wechatId, item.onboardingStatus].join(" ").toLowerCase().includes(keyword)
    );
  }, [query, state.distributorProfiles]);

  return (
    <AppShell active="/admin/distributors">
      <PageHeader
        kicker="分发者管理"
        title="准入、信用分、授权和收益统一查看"
        subtitle="把众小二类准入治理沉淀到后台，运营可以快速判断一个分发者是否具备授权和领取任务资格。"
        actions={<span className="badge info">{distributors.length} 个分发者</span>}
      />

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 320 }}>
          <Search size={16} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名 / 手机 / 微信 / 状态" />
        </label>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">分发者列表</h2>
          <span className="badge warning">低信用分限制授权和领取</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发者</th>
              <th>准入状态</th>
              <th>信用 / 考试</th>
              <th>账号 / 授权</th>
              <th>违规</th>
              <th>待结算</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {distributors.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="item-title">{item.displayName}</div>
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
                  <div className="item-meta">考试 {item.examScore} 分</div>
                </td>
                <td>
                  <div className="item-title">{item.accountCount} 个账号</div>
                  <div className="item-meta">{item.authorizationCount} 个授权</div>
                </td>
                <td>
                  <span className={item.violationCount > 0 ? "badge danger" : "badge success"}>
                    <ShieldAlert size={13} aria-hidden /> {item.violationCount}
                  </span>
                </td>
                <td>{money(item.payableCommission)}</td>
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
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
