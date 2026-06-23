"use client";

import Link from "next/link";
import { ClipboardCheck, Download, LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Badge";
import { useClipPartnerStore } from "@/lib/local-store";

export default function PartnerTasksPage() {
  return (
    <AuthGate roles={["admin", "partner"]}>
      <PartnerTasksExperience />
    </AuthGate>
  );
}

function PartnerTasksExperience() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const { state, claimDistributionTask, submitTaskClaim, refreshRemoteList } = useClipPartnerStore();
  const distributorName = session?.role === "partner" ? session.displayName : "周婧";
  const [query, setQuery] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  useEffect(() => {
    void refreshRemoteList("formalAuthorizations", { limit: 50 });
    void refreshRemoteList("distributionTasks", { limit: 50 });
    void refreshRemoteList("taskClaims", { limit: 50 });
  }, [refreshRemoteList]);

  const authorizations = useMemo(
    () => state.formalAuthorizations.filter((item) => item.distributorName === distributorName && item.status === "approved"),
    [distributorName, state.formalAuthorizations]
  );
  const allowedIps = useMemo(() => new Set(authorizations.map((item) => item.ipName)), [authorizations]);
  const myClaims = state.taskClaims.filter((item) => item.distributorName === distributorName);

  const tasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return state.distributionTasks.filter((task) => {
      const matchesKeyword =
        !keyword || [task.title, task.ipName, task.productName, task.requirement].join(" ").toLowerCase().includes(keyword);
      return matchesKeyword && allowedIps.has(task.ipName);
    });
  }, [allowedIps, query, state.distributionTasks]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="partner-shell">
      <header className="partner-header">
        <div className="partner-header-inner">
          <div>
            <div className="brand-title">任务中心</div>
            <div className="brand-subtitle">{distributorName} · 授权任务、下载凭证和发布回填</div>
          </div>
          <div className="toolbar">
            <Link className="button" href="/partner/wallet">
              收益钱包
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
            <p className="page-kicker">分发任务</p>
            <h1 className="page-title">领取任务会生成唯一下载凭证</h1>
            <p className="page-subtitle">任务领取会校验正式授权、审核账号、商品有效性和信用分。下载凭证默认 30 分钟有效。</p>
          </div>
          <span className="badge info">我的领取 {myClaims.length} 条</span>
        </div>

        <div className="filter-bar">
          <label className="input search-control" style={{ minWidth: 320 }}>
            <Search size={16} aria-hidden />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务 / IP / 商品" />
          </label>
        </div>

        <section className="material-grid">
          {tasks.map((task) => {
            const alreadyClaimed = myClaims.some((item) => item.taskId === task.id && item.status !== "invalid");
            const material = state.materials.find((item) => task.materialIds.includes(item.id));
            return (
              <article className="material-card" key={task.id}>
                <div className="material-cover" />
                <div className="material-body">
                  <div>
                    <div className="item-title">{task.title}</div>
                    <div className="item-meta">
                      {task.ipName} · {task.platform} · 截止 {task.endAt}
                    </div>
                  </div>
                  <div className="toolbar">
                    <StatusBadge status={task.status} />
                    <span className="badge info">
                      {task.claimedCount}/{task.claimLimit}
                    </span>
                  </div>
                  <div className="item-meta">素材：{material?.title ?? "待绑定素材"}</div>
                  <div className="item-meta">商品：{task.productName}</div>
                  <div className="item-meta">{task.requirement}</div>
                  <button className="button primary" disabled={alreadyClaimed || task.status !== "open"} onClick={() => claimDistributionTask(task.id, distributorName)}>
                    <Download size={16} aria-hidden /> {alreadyClaimed ? "已领取" : "领取并生成下载凭证"}
                  </button>
                </div>
              </article>
            );
          })}
          {!tasks.length ? (
            <div className="content-card" style={{ gridColumn: "1 / -1" }}>
              <div className="item-title">暂无可领取任务</div>
              <div className="item-meta">请先完成准入并申请正式授权，或等待运营开放新的分发任务。</div>
            </div>
          ) : null}
        </section>

        <section className="table-card" style={{ marginTop: 18 }}>
          <div className="table-header">
            <h2 className="table-title">我的任务领取</h2>
            <span className="badge warning">发布后及时回填链接，逾期会影响信用分</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>任务素材</th>
                <th>账号 / 商品</th>
                <th>下载凭证</th>
                <th>状态</th>
                <th>发布链接</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {myClaims.map((claim) => (
                <tr key={claim.id}>
                  <td>
                    <div className="item-title">{claim.materialTitle}</div>
                    <div className="item-meta">{claim.claimedAt}</div>
                  </td>
                  <td>
                    <div className="item-title">{claim.socialAccount}</div>
                    <div className="item-meta">{claim.productName}</div>
                  </td>
                  <td>
                    <div className="item-title">{claim.claimToken}</div>
                    <div className="item-meta">有效至 {claim.downloadExpiresAt}</div>
                  </td>
                  <td>
                    <StatusBadge status={claim.status} />
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ minWidth: 260 }}
                      value={links[claim.id] ?? claim.submittedUrl ?? ""}
                      onChange={(event) => setLinks((current) => ({ ...current, [claim.id]: event.target.value }))}
                      placeholder="粘贴作品链接"
                    />
                  </td>
                  <td>
                    <button className="button" onClick={() => submitTaskClaim(claim.id, links[claim.id] || "https://example.com/published-work-valid")}>
                      <ClipboardCheck size={16} aria-hidden /> 回填
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
