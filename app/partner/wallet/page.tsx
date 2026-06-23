"use client";

import Link from "next/link";
import { HandCoins, LogOut, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

export default function PartnerWalletPage() {
  return (
    <AuthGate roles={["partner"]}>
      <PartnerWalletExperience />
    </AuthGate>
  );
}

function PartnerWalletExperience() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const { state, addWalletTransaction, refreshRemoteList } = useClipPartnerStore();
  const distributorName = session?.displayName ?? "";
  useEffect(() => {
    void refreshRemoteList("walletTransactions", { limit: 50 });
    void refreshRemoteList("publishRecords", { limit: 50 });
    void refreshRemoteList("settlements", { limit: 50 });
  }, [refreshRemoteList]);

  const transactions = state.walletTransactions.filter((item) => item.distributorName === distributorName);
  const records = state.publishRecords.filter((item) => item.distributorName === distributorName);
  const available = transactions.filter((item) => item.status === "available").reduce((sum, item) => sum + item.amount, 0);
  const frozen = transactions.filter((item) => item.status === "frozen").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const paid = state.settlements
    .filter((item) => item.distributorName === distributorName && item.status === "paid")
    .reduce((sum, item) => sum + item.payableCommission, 0);
  const pending = state.settlements
    .filter((item) => item.distributorName === distributorName && item.status !== "paid" && item.status !== "blocked")
    .reduce((sum, item) => sum + item.payableCommission, 0);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="partner-shell">
      <header className="partner-header">
        <div className="partner-header-inner">
          <div>
            <div className="brand-title">收益钱包</div>
            <div className="brand-subtitle">{distributorName} · 作品级收益、冻结和打款记录</div>
          </div>
          <div className="toolbar">
            <Link className="button" href="/partner/tasks">
              任务中心
            </Link>
            <button className="button" aria-label="退出" onClick={handleLogout}>
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main">
        <div className="topbar">
          <div>
            <p className="page-kicker">结算钱包</p>
            <h1 className="page-title">按作品查看 GMV、佣金、分成和扣减原因</h1>
            <p className="page-subtitle">当前先使用模拟结算流水，后续接真实精选联盟订单、退款和打款接口。</p>
          </div>
          <button
            className="button primary"
            onClick={() =>
              addWalletTransaction({
                distributorName,
                type: "adjustment",
                amount: 100,
                status: "available",
                source: "内测补贴",
                note: "运营手动补贴，用于验证钱包流水。"
              })
            }
          >
            <HandCoins size={16} aria-hidden /> 模拟补贴
          </button>
        </div>

        <section className="metrics-grid">
          <article className="metric-card">
            <div className="metric-label">
              <WalletCards size={16} aria-hidden /> 可结算
            </div>
            <div className="metric-value">{money(available)}</div>
            <div className="metric-note">满足打款门槛后进入账期</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">冻结金额</div>
            <div className="metric-value">{money(frozen)}</div>
            <div className="metric-note">风控、退款或申诉中</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">待打款</div>
            <div className="metric-value">{money(pending)}</div>
            <div className="metric-note">财务确认后打款</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">已打款</div>
            <div className="metric-value">{money(paid)}</div>
            <div className="metric-note">保留打款凭证</div>
          </article>
        </section>

        <section className="table-card">
          <div className="table-header">
            <h2 className="table-title">作品收益明细</h2>
            <span className="badge info">默认按授权分成比例计算，异常作品不结算</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>作品 / 商品</th>
                <th>状态</th>
                <th>GMV</th>
                <th>平台佣金</th>
                <th>扣减原因</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div className="item-title">{record.materialTitle}</div>
                    <div className="item-meta">{record.productName}</div>
                  </td>
                  <td>{record.status}</td>
                  <td>{money(record.gmv)}</td>
                  <td>{money(record.commission)}</td>
                  <td>{record.status === "invalid" ? record.reviewNote || "作品不合规" : "正常进入结算"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="table-card" style={{ marginTop: 18 }}>
          <div className="table-header">
            <h2 className="table-title">钱包流水</h2>
            <span className="badge warning">冻结流水会影响可提现金额</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>金额</th>
                <th>来源</th>
                <th>状态</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => (
                <tr key={item.id}>
                  <td>{item.type}</td>
                  <td>{money(item.amount)}</td>
                  <td>{item.source}</td>
                  <td>{item.status}</td>
                  <td>
                    <div className="item-title">{item.note}</div>
                    <div className="item-meta">{item.createdAt}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
