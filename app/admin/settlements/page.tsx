"use client";

import { useEffect } from "react";
import { Ban, CheckCircle2, Download, HandCoins, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badge";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

export default function SettlementsPage() {
  const { state, generateSettlement, updateSettlementStatus, syncStatus, refreshRemoteList } = useClipPartnerStore();
  const settlements = state.settlements;
  const verifiedPosts = state.publishRecords.filter((record) => record.status === "verified").length;

  useEffect(() => {
    void refreshRemoteList("settlements", { limit: 50 });
  }, [refreshRemoteList]);

  function exportCsv() {
    const headers = ["结算单", "分发者", "周期", "有效作品", "应结算", "状态"];
    const rows = settlements.map((settlement) => [
      settlement.id,
      settlement.distributorName,
      settlement.period,
      String(settlement.verifiedPosts),
      String(settlement.payableCommission),
      settlement.status
    ]);
    const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clip-partner-settlements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell active="/admin/settlements">
      <PageHeader
        kicker="佣金结算"
        title="按发布记录和成交数据生成台账"
        subtitle="第一版先支持人工录入或表格导入成交数据，排除退款、违规、挂错商品等记录，再按分成比例生成分发者结算单。"
        actions={
          <>
            <button className="button" onClick={exportCsv}>
              <Download size={16} aria-hidden /> 导出台账
            </button>
            <button className="button primary" onClick={generateSettlement}>
              <Plus size={16} aria-hidden /> 生成本月结算
            </button>
          </>
        }
      />

      <div className="filter-bar">
        <span className="badge info">已核验作品 {verifiedPosts} 条</span>
        <span className={syncStatus === "remote" ? "badge success" : syncStatus === "error" ? "badge danger" : "badge"}>
          {syncStatus === "remote" ? "已连接线上数据" : syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "同步失败" : "本地模式"}
        </span>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">结算单</h2>
          <span className="badge warning">低于最低结算金额顺延，违规作品不结算</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>结算单</th>
              <th>分发者</th>
              <th>周期</th>
              <th>有效作品</th>
              <th>应结算</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((settlement) => (
              <tr key={settlement.id}>
                <td>{settlement.id}</td>
                <td>{settlement.distributorName}</td>
                <td>{settlement.period}</td>
                <td>{settlement.verifiedPosts}</td>
                <td>{money(settlement.payableCommission)}</td>
                <td>
                  <StatusBadge status={settlement.status} />
                </td>
                <td>
                  <div className="toolbar">
                    <button
                      className="button"
                      title="确认"
                      aria-label="确认"
                      onClick={() => updateSettlementStatus(settlement.id, "confirmed")}
                    >
                      <CheckCircle2 size={16} aria-hidden />
                    </button>
                    <button
                      className="button"
                      title="标记已打款"
                      aria-label="标记已打款"
                      onClick={() => updateSettlementStatus(settlement.id, "paid")}
                    >
                      <HandCoins size={16} aria-hidden />
                    </button>
                    <button
                      className="button"
                      title="冻结"
                      aria-label="冻结"
                      onClick={() => updateSettlementStatus(settlement.id, "blocked")}
                    >
                      <Ban size={16} aria-hidden />
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
