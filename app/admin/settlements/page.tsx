"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Download, HandCoins, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badge";
import { defaultAppSettings, readAppSettings } from "@/lib/app-settings";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";
import { getProductValidity } from "@/lib/product-rules";

export default function SettlementsPage() {
  const { state, generateSettlement, updateSettlementStatus, syncStatus, refreshRemoteList } = useClipPartnerStore();
  const [commissionShare, setCommissionShare] = useState(defaultAppSettings.commissionShare);
  const settlements = state.settlements;
  const shareRate = commissionShare / 100;
  const settlementDetails = state.publishRecords
    .filter((record) => ["verified", "invalid", "settled"].includes(record.status))
    .map((record) => {
      const productValidity = getProductValidity(state.products, record.productName, record.platform);
      const isSettleable = (record.status === "verified" || record.status === "settled") && productValidity.isValid;
      return {
        ...record,
        payable: isSettleable ? Math.round(record.commission * shareRate) : 0,
        deductionReason:
          record.status === "invalid"
            ? record.reviewNote || "作品不合规"
            : !productValidity.isValid
              ? productValidity.reason
              : ""
      };
    });
  const verifiedPosts = state.publishRecords.filter(
    (record) => record.status === "verified" && getProductValidity(state.products, record.productName, record.platform).isValid
  ).length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCommissionShare(readAppSettings().commissionShare);
    }, 0);
    void refreshRemoteList("settlements", { limit: 50 });
    return () => window.clearTimeout(timer);
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

  function exportDetailCsv() {
    const headers = ["分发者", "素材", "商品", "平台", "状态", "作品链接", "GMV", "平台佣金", "可结算", "扣减原因"];
    const rows = settlementDetails.map((record) => [
      record.distributorName,
      record.materialTitle,
      record.productName,
      record.platform,
      record.status,
      record.publishUrl || "",
      String(record.gmv),
      String(record.commission),
      String(record.payable),
      record.deductionReason
    ]);
    const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clip-partner-settlement-details-${new Date().toISOString().slice(0, 10)}.csv`;
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
            <button className="button" onClick={exportDetailCsv}>
              <Download size={16} aria-hidden /> 导出明细
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

      <section className="table-card" style={{ marginTop: 18 }}>
        <div className="table-header">
          <h2 className="table-title">作品结算明细</h2>
          <span className="badge info">当前按平台佣金的 {commissionShare}% 作为模拟分发者可结算金额</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发者</th>
              <th>作品 / 商品</th>
              <th>平台</th>
              <th>GMV</th>
              <th>平台佣金</th>
              <th>可结算</th>
              <th>扣减原因</th>
            </tr>
          </thead>
          <tbody>
            {settlementDetails.map((record) => (
              <tr key={record.id}>
                <td>{record.distributorName}</td>
                <td>
                  <div className="item-title">{record.materialTitle}</div>
                  <div className="item-meta">{record.productName}</div>
                </td>
                <td>{record.platform}</td>
                <td>{money(record.gmv)}</td>
                <td>{money(record.commission)}</td>
                <td>{money(record.payable)}</td>
                <td>{record.deductionReason || "正常结算"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
