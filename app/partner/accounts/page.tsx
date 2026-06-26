"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, LogOut, Plus, Search, ArrowLeft, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { type AccountBindingStatus } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

const bindingStatusLabels: Record<AccountBindingStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  paused: "已暂停"
};

const bindingStatusTone: Record<AccountBindingStatus, string> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  paused: "info"
};

export default function PartnerAccountsPage() {
  return (
    <AuthGate roles={["partner"]}>
      <PartnerAccountsExperience />
    </AuthGate>
  );
}

function PartnerAccountsExperience() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const { state, addAccountBinding, addAuthorizationRequest, syncStatus } = useClipPartnerStore();
  const distributorName = session?.displayName ?? "";
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<"抖音" | "视频号">("视频号");
  const [accountName, setAccountName] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [followers, setFollowers] = useState(1000);
  const [category, setCategory] = useState("好物推荐");
  const [targetIp, setTargetIp] = useState("晴姐穿搭");

  const myAccounts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return state.accountBindings.filter((item) => {
      const matchesOwner = item.distributorName === distributorName;
      const matchesKeyword =
        !keyword || [item.accountName, item.platform, item.category, item.homepageUrl].join(" ").toLowerCase().includes(keyword);
      return matchesOwner && matchesKeyword;
    });
  }, [distributorName, query, state.accountBindings]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  function submitBinding() {
    addAccountBinding({
      distributorName,
      platform,
      accountName: accountName.trim() || `${distributorName}的${platform}账号`,
      homepageUrl: homepageUrl.trim() || "https://example.com/social-account",
      followers,
      category: category.trim() || "好物推荐",
      note: "模拟绑定账号，真实平台 API 接入后可自动校验主页与粉丝数。"
    });
    setAccountName("");
    setHomepageUrl("");
    setFollowers(1000);
  }

  function applyAuthorization(accountNameValue: string, platformValue: "抖音" | "视频号") {
    addAuthorizationRequest({
      distributorName,
      socialAccount: accountNameValue,
      platform: platformValue,
      ipName: targetIp,
      reason: `基于已绑定账号申请 ${targetIp} 授权。`
    });
  }

  return (
    <div className="partner-shell">
      <header className="partner-header-modern">
        <div className="partner-header-inner-modern">
          <div className="partner-header-brand">
            <div className="partner-brand-logo" />
            <div>
              <div className="partner-brand-title">分发账号管理</div>
              <div className="partner-brand-subtitle">
                <span className="user-tag">{distributorName}</span>
                <span className="dot-divider">·</span>
                <span className="score-tag">已绑 <strong>{myAccounts.length}</strong> 个账号</span>
                <span className="dot-divider">·</span>
                <span className="data-source-tag">{syncStatus === "remote" ? "线上实时" : "本地演示"}</span>
              </div>
            </div>
          </div>
          <div className="partner-header-actions">
            <Link className="button partner-action-btn" href="/partner">
              <ArrowLeft size={14} /> 返回工作台
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
            <p className="page-kicker">分发推广主页资料绑定</p>
            <h1 className="page-title">绑定抖音或微信视频号账号，开启爆款授权之旅</h1>
            <p className="page-subtitle">
              系统当前支持手动维护并核对绑定账号。API 接入完成后，将实现全自动 OAuth 授权绑定并校验主页粉丝、橱窗状态与开通类目。
            </p>
          </div>
        </div>

        <section className="content-card" style={{ marginBottom: 28 }}>
          <div className="section-heading-row">
            <h2 className="section-title">➕ 新增绑定我的推广媒体账号</h2>
          </div>
          <div className="filter-bar" style={{ gap: "16px", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>选择发布平台</span>
              <select className="select" style={{ minWidth: 120 }} value={platform} onChange={(event) => setPlatform(event.target.value as "抖音" | "视频号")}>
                <option value="视频号">微信视频号</option>
                <option value="抖音">字节抖音</option>
              </select>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 1 }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>账号展示名称</span>
              <input className="input" style={{ width: "100%" }} value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="如：林哥数码测评推荐" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 1.5 }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>个人主页链接</span>
              <input
                className="input"
                style={{ width: "100%" }}
                value={homepageUrl}
                onChange={(event) => setHomepageUrl(event.target.value)}
                placeholder="抖音或视频号的个人主页分享长链接"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "120px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>当前粉丝数量</span>
              <input
                className="input"
                style={{ width: "100%" }}
                type="number"
                min={0}
                value={followers}
                onChange={(event) => setFollowers(Number(event.target.value))}
                aria-label="粉丝数"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "150px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>主攻内容类目</span>
              <input className="input" style={{ width: "100%" }} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="如：服饰搭配、数码" />
            </div>

            <button className="button primary-gradient-btn" style={{ minHeight: "38px" }} onClick={submitBinding}>
              <Plus size={15} /> <span>提交绑定</span>
            </button>
          </div>
        </section>

        <div className="filter-bar" style={{ marginBottom: 18, justifyContent: "space-between", gap: "20px" }}>
          <label className="input search-control" style={{ minWidth: 320 }}>
            <Search size={16} aria-hidden />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索我的已绑账号 / 垂直类目 / 链接" />
          </label>
          
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>一键快捷申请授权给：</span>
            <select className="select" style={{ minWidth: 140 }} value={targetIp} onChange={(event) => setTargetIp(event.target.value)} aria-label="申请 IP">
              <option value="晴姐穿搭">晴姐穿搭</option>
              <option value="老许家居">老许家居</option>
              <option value="林哥数码">林哥数码</option>
            </select>
          </div>
        </div>

        <section className="table-card">
          <div className="table-header">
            <h2 className="table-title">📝 我的已绑定推广媒体账号列表</h2>
            <span className="badge info">账号审核批准后，点击右侧可一键发起 IP 达人白名单申请</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>账号名称</th>
                  <th>所属平台</th>
                  <th>真实粉丝数</th>
                  <th>内容类目</th>
                  <th>带货橱窗与风控</th>
                  <th>主页链接</th>
                  <th>审核状态</th>
                  <th className="text-right">极速授权</th>
                </tr>
              </thead>
              <tbody>
                {myAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted" style={{ padding: "40px 0" }}>
                      暂无绑定的账号信息。请在上方输入账号资料并提交。
                    </td>
                  </tr>
                ) : (
                  myAccounts.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div className="item-title">{account.accountName}</div>
                        <div className="item-meta">绑定时间: {account.boundAt}</div>
                      </td>
                      <td>
                        <span className="badge info-badge-soft">{account.platform}</span>
                      </td>
                      <td className="text-bold">{account.followers.toLocaleString("zh-CN")}</td>
                      <td>{account.category}</td>
                      <td>
                        <div className="item-title" style={{ fontSize: 13 }}>{account.shopWindowStatus === "open" ? "✅ 橱窗权限已开通" : "⏳ 橱窗待自动核验"}</div>
                        <div className="item-meta" style={{ color: account.riskTag ? "var(--danger)" : "var(--muted)" }}>风控评估: {account.riskTag ?? "无异常风险"}</div>
                      </td>
                      <td>
                        <a className="button" style={{ minHeight: "28px", padding: "4px 10px", fontSize: "12px" }} href={account.homepageUrl} target="_blank" rel="noreferrer">
                          查看主页
                        </a>
                      </td>
                      <td>
                        <span className={`badge ${bindingStatusTone[account.status]}`}>{bindingStatusLabels[account.status]}</span>
                      </td>
                      <td className="text-right">
                        <button className="button primary-btn-sm" disabled={account.status !== "approved"} onClick={() => applyAuthorization(account.accountName, account.platform)}>
                          <BadgeCheck size={14} /> 申请授权至【{targetIp}】
                        </button>
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
