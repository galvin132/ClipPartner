"use client";

import Link from "next/link";
import { HandCoins, LogOut, WalletCards, ArrowLeft, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Badge";
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
  const { state, addWalletTransaction, syncStatus, refreshRemoteList } = useClipPartnerStore();
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
      <header className="partner-header-modern">
        <div className="partner-header-inner-modern">
          <div className="partner-header-brand">
            <div className="partner-brand-logo" />
            <div>
              <div className="partner-brand-title">我的收益钱包</div>
              <div className="partner-brand-subtitle">
                <span className="user-tag">{distributorName}</span>
                <span className="dot-divider">·</span>
                <span className="score-tag">累计已打款 <strong>{money(paid)}</strong></span>
                <span className="dot-divider">·</span>
                <span className="data-source-tag">{syncStatus === "remote" ? "线上实时" : "本地演示"}</span>
              </div>
            </div>
          </div>
          <div className="partner-header-actions">
            <Link className="button partner-action-btn" href="/partner">
              <ArrowLeft size={14} /> 返回工作台
            </Link>
            <Link className="button partner-action-btn" href="/partner/tasks">
              领任务中心
            </Link>
            <button className="button partner-logout-btn" aria-label="退出" onClick={handleLogout}>
              <LogOut size={15} />
              <span>安全退出</span>
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main-modern">
        <div className="topbar">
          <div>
            <p className="page-kicker">佣金钱包与打款流水</p>
            <h1 className="page-title">按作品实时查看 GMV、佣金分成和结算状态</h1>
            <p className="page-subtitle">当前使用高保真演示流水，后续对接真实联盟订单状态与微信/支付宝打款电子回单接口。</p>
          </div>
          <button
            className="button primary-gradient-btn"
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
            <HandCoins size={15} /> 模拟补贴 +100元
          </button>
        </div>

        <section className="metrics-grid" style={{ marginBottom: 28 }}>
          <article className="metric-card metric-emerald">
            <div className="metric-label">
              <WalletCards size={16} /> 可提现金额
            </div>
            <div className="metric-value">{money(available)}</div>
            <div className="metric-note">满足平台 100 元打款门槛即可一键打款</div>
          </article>
          <article className="metric-card metric-rose">
            <div className="metric-label">
              <WalletCards size={16} /> 冻结中金额
            </div>
            <div className="metric-value">{money(frozen)}</div>
            <div className="metric-note">异常、退货或风控违规拦截的作品金额</div>
          </article>
          <article className="metric-card metric-blue">
            <div className="metric-label">
              <TrendingUp size={16} /> 财务待确认
            </div>
            <div className="metric-value">{money(pending)}</div>
            <div className="metric-note">正在进入账期，打款流程处理中</div>
          </article>
          <article className="metric-card metric-violet">
            <div className="metric-label">
              <HandCoins size={16} /> 累计已打款
            </div>
            <div className="metric-value">{money(paid)}</div>
            <div className="metric-note">包含扣除税费后的真实到账总金额</div>
          </article>
        </section>

        <section className="table-card" style={{ marginBottom: 28 }}>
          <div className="table-header">
            <h2 className="table-title">🎥 视频作品明细账单</h2>
            <span className="badge info">默认按 20% 授权分成比例核算，风控及核验失败作品不予分账</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>关联作品 / 商品</th>
                  <th>当前核验状态</th>
                  <th>产生有效 GMV</th>
                  <th>我获得的预估分账佣金</th>
                  <th>风控/未分账理由</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted" style={{ padding: "30px 0" }}>暂无关联视频作品的收益明细。</td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div className="item-title">{record.materialTitle}</div>
                        <div className="item-meta">{record.productName}</div>
                      </td>
                      <td>
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="text-bold text-emerald">{money(record.gmv)}</td>
                      <td className="text-bold text-amber">
                        {record.status === "verified" || record.status === "settled" ? money(record.gmv * 0.2) : money(0)}
                      </td>
                      <td style={{ fontSize: 13, color: record.status === "invalid" ? "var(--danger)" : "var(--muted)" }}>
                        {record.status === "invalid" ? record.reviewNote || "作品审核未通过" : "已正常核验，待进入打款流程"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="table-card">
          <div className="table-header">
            <h2 className="table-title">💳 钱包收支流证明细</h2>
            <span className="badge warning">包含平台扣罚、奖励、返现和打款留痕记录</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>资金交易类型</th>
                  <th>交易变动金额</th>
                  <th>业务来源</th>
                  <th>流水状态</th>
                  <th>资金备注</th>
                  <th>产生时间</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted" style={{ padding: "30px 0" }}>暂无钱包收支明细。</td>
                  </tr>
                ) : (
                  transactions.map((item) => (
                    <tr key={item.id}>
                      <td className="text-bold">{item.type === "adjustment" ? "资金调整/补贴" : item.type === "commission" ? "销售分成" : "提现扣减"}</td>
                      <td className={`text-bold ${item.amount >= 0 ? "text-emerald" : "text-rose"}`}>
                        {item.amount >= 0 ? "+" : ""}{money(item.amount)}
                      </td>
                      <td>
                        <span className="badge info-badge-soft">{item.source}</span>
                      </td>
                      <td>
                        <span className={`badge ${item.status === "available" ? "success" : item.status === "frozen" ? "danger" : "info"}`}>
                          {item.status === "available" ? "可提现" : item.status === "frozen" ? "冻结中" : "已打款"}
                        </span>
                      </td>
                      <td>
                        <div className="item-title">{item.note}</div>
                      </td>
                      <td>
                        <div className="item-meta">{item.createdAt}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
