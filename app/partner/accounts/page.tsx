"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, LogOut, Plus, Search } from "lucide-react";
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
    <AuthGate roles={["admin", "partner"]}>
      <PartnerAccountsExperience />
    </AuthGate>
  );
}

function PartnerAccountsExperience() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const { state, addAccountBinding, addAuthorizationRequest, syncStatus } = useClipPartnerStore();
  const distributorName = session?.role === "partner" ? session.displayName : "周婧";
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
      <header className="partner-header">
        <div className="partner-header-inner">
          <div>
            <div className="brand-title">账号绑定</div>
            <div className="brand-subtitle">{distributorName} · 抖音 / 视频号账号资料</div>
          </div>
          <div className="toolbar">
            <Link className="button" href="/partner">
              工作台
            </Link>
            <span className={syncStatus === "remote" ? "badge success" : syncStatus === "error" ? "badge danger" : "badge"}>
              {syncStatus === "remote" ? "已连接线上数据" : syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "同步失败" : "本地模式"}
            </span>
            <button className="button" aria-label="退出" onClick={handleLogout}>
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main">
        <div className="topbar">
          <div>
            <p className="page-kicker">分发者账号资料</p>
            <h1 className="page-title">先手动绑定账号，后续再接平台 API 校验</h1>
            <p className="page-subtitle">
              微信、抖音、视频号接口未开通前，可先手动维护账号信息并申请 IP 授权；真实接口接入后会自动校验主页、粉丝数和账号归属。
            </p>
          </div>
          <button className="button primary" onClick={submitBinding}>
            <Plus size={16} aria-hidden /> 新增绑定账号
          </button>
        </div>

        <section className="content-card" style={{ marginBottom: 16 }}>
          <h2 className="section-title">新增账号</h2>
          <div className="filter-bar">
            <select className="select" value={platform} onChange={(event) => setPlatform(event.target.value as "抖音" | "视频号")}>
              <option value="视频号">视频号</option>
              <option value="抖音">抖音</option>
            </select>
            <input className="input" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="账号名称" />
            <input
              className="input"
              style={{ minWidth: 280 }}
              value={homepageUrl}
              onChange={(event) => setHomepageUrl(event.target.value)}
              placeholder="主页链接"
            />
            <input
              className="input"
              type="number"
              min={0}
              value={followers}
              onChange={(event) => setFollowers(Number(event.target.value))}
              aria-label="粉丝数"
            />
            <input className="input" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="内容类目" />
          </div>
        </section>

        <div className="filter-bar">
          <label className="input search-control" style={{ minWidth: 300 }}>
            <Search size={16} aria-hidden />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索账号 / 类目 / 链接" />
          </label>
          <select className="select" value={targetIp} onChange={(event) => setTargetIp(event.target.value)} aria-label="申请 IP">
            <option value="晴姐穿搭">晴姐穿搭</option>
            <option value="老许家居">老许家居</option>
            <option value="林哥数码">林哥数码</option>
          </select>
        </div>

        <section className="table-card">
          <div className="table-header">
            <h2 className="table-title">我的绑定账号</h2>
            <span className="badge info">审核通过后可领取对应 IP 素材</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>账号</th>
                <th>平台</th>
                <th>粉丝数</th>
                <th>类目</th>
                <th>橱窗 / 风险</th>
                <th>主页</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {myAccounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <div className="item-title">{account.accountName}</div>
                    <div className="item-meta">{account.boundAt}</div>
                  </td>
                  <td>{account.platform}</td>
                  <td>{account.followers.toLocaleString("zh-CN")}</td>
                  <td>{account.category}</td>
                  <td>
                    <div className="item-title">{account.shopWindowStatus === "open" ? "橱窗已开通" : "橱窗待核验"}</div>
                    <div className="item-meta">{account.riskTag ?? "待评估"}</div>
                  </td>
                  <td>
                    <a className="button" href={account.homepageUrl} target="_blank" rel="noreferrer">
                      查看主页
                    </a>
                  </td>
                  <td>
                    <span className={`badge ${bindingStatusTone[account.status]}`}>{bindingStatusLabels[account.status]}</span>
                  </td>
                  <td>
                    <button className="button" onClick={() => applyAuthorization(account.accountName, account.platform)}>
                      <BadgeCheck size={16} aria-hidden /> 申请授权
                    </button>
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
