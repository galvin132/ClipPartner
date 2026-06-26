"use client";

import Link from "next/link";
import { ClipboardCheck, Download, LogOut, Search, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Badge";
import { useClipPartnerStore } from "@/lib/local-store";

export default function PartnerTasksPage() {
  return (
    <AuthGate roles={["partner"]}>
      <PartnerTasksExperience />
    </AuthGate>
  );
}

function PartnerTasksExperience() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const { state, claimDistributionTask, submitTaskClaim, syncStatus, refreshRemoteList } = useClipPartnerStore();
  const distributorName = session?.displayName ?? "";
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
      <header className="partner-header-modern">
        <div className="partner-header-inner-modern">
          <div className="partner-header-brand">
            <div className="partner-brand-logo" />
            <div>
              <div className="partner-brand-title">分发任务中心</div>
              <div className="partner-brand-subtitle">
                <span className="user-tag">{distributorName}</span>
                <span className="dot-divider">·</span>
                <span className="score-tag">已领 <strong>{myClaims.length}</strong> 个任务</span>
                <span className="dot-divider">·</span>
                <span className="data-source-tag">{syncStatus === "remote" ? "线上实时" : "本地演示"}</span>
              </div>
            </div>
          </div>
          <div className="partner-header-actions">
            <Link className="button partner-action-btn" href="/partner">
              <ArrowLeft size={14} /> 返回工作台
            </Link>
            <Link className="button partner-action-btn" href="/partner/wallet">
              收益钱包
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
            <p className="page-kicker">分发领取与防伪凭证</p>
            <h1 className="page-title">领取任务会生成唯一下载凭证</h1>
            <p className="page-subtitle">任务领取会校验正式授权、审核账号、商品有效性和信用分。下载凭证默认 30 分钟有效。</p>
          </div>
        </div>

        <div className="filter-bar">
          <label className="input search-control" style={{ minWidth: 320 }}>
            <Search size={16} aria-hidden />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索我的专属授权任务 / IP / 商品" />
          </label>
        </div>

        <section className="material-grid" style={{ marginBottom: 28 }}>
          {tasks.map((task) => {
            const alreadyClaimed = myClaims.some((item) => item.taskId === task.id && item.status !== "invalid");
            const material = state.materials.find((item) => task.materialIds.includes(item.id));
            return (
              <article className="material-card" key={task.id}>
                <div className="material-cover" />
                <div className="material-body">
                  <div>
                    <div className="item-title" style={{ fontSize: 16, marginBottom: 4 }}>{task.title}</div>
                    <div className="item-meta" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="badge info-badge-soft">{task.ipName}</span>
                      <span className="badge success">{task.platform}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>截止 {task.endAt}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                    <StatusBadge status={task.status} />
                    <span className="badge info">
                      已领 {task.claimedCount} / {task.claimLimit} 名额
                    </span>
                  </div>

                  <div className="info-list-compact" style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)", margin: "4px 0 12px" }}>
                    <div>🎬 关联素材：<span style={{ color: "var(--ink)", fontWeight: 600 }}>{material?.title ?? "待绑定素材"}</span></div>
                    <div>🛍️ 推广商品：<span style={{ color: "var(--ink)", fontWeight: 600 }}>{task.productName}</span></div>
                    <div>📌 任务要求：<span style={{ color: "var(--ink)" }}>{task.requirement}</span></div>
                  </div>

                  <button 
                    className={`button ${alreadyClaimed ? "" : "primary-gradient-btn"}`}
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={alreadyClaimed || task.status !== "open"} 
                    onClick={() => claimDistributionTask(task.id, distributorName)}
                  >
                    <Download size={14} /> <span>{alreadyClaimed ? "已成功领取" : "领取并生成下载凭证"}</span>
                  </button>
                </div>
              </article>
            );
          })}
          {!tasks.length ? (
            <div className="content-card" style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center" }}>
              <div className="item-title" style={{ fontSize: 18, marginBottom: 8 }}>暂无可领取的专属任务</div>
              <div className="item-meta" style={{ maxWidth: 500, margin: "0 auto" }}>
                任务列表仅展示您已获得正式授权的 IP 达人任务。请先完成 <Link className="text-link" href="/partner/onboarding" style={{ color: "var(--brand)" }}>新手准入</Link> 并去 <Link className="text-link" href="/partner/authorizations" style={{ color: "var(--brand)" }}>授权中心申请 IP 授权</Link>，通过审核后即可解锁！
              </div>
            </div>
          ) : null}
        </section>

        <section className="table-card">
          <div className="table-header">
            <h2 className="table-title">📝 我的任务回填与凭证中心</h2>
            <span className="badge warning">发布后及时在此回填作品链接，逾期未回填会降低信用分</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>已领任务素材</th>
                  <th>绑定的推广账号/商品</th>
                  <th>下载防伪凭证</th>
                  <th>状态</th>
                  <th>作品发布链接回填</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {myClaims.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted" style={{ padding: "40px 0" }}>暂无已领取的任务。快去上方选择任务并领取吧！</td>
                  </tr>
                ) : (
                  myClaims.map((claim) => (
                    <tr key={claim.id}>
                      <td>
                        <div className="item-title">{claim.materialTitle}</div>
                        <div className="item-meta">领取时间: {claim.claimedAt}</div>
                      </td>
                      <td>
                        <div className="item-title">{claim.socialAccount}</div>
                        <div className="item-meta">{claim.productName}</div>
                      </td>
                      <td>
                        <div className="item-title">
                          <code className="token-code">{claim.claimToken}</code>
                        </div>
                        <div className="item-meta" style={{ fontSize: 11, color: "var(--muted)" }}>有效至: {claim.downloadExpiresAt}</div>
                      </td>
                      <td>
                        <StatusBadge status={claim.status} />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ minWidth: 280, width: "100%" }}
                          value={links[claim.id] ?? claim.submittedUrl ?? ""}
                          onChange={(event) => setLinks((current) => ({ ...current, [claim.id]: event.target.value }))}
                          placeholder="请粘贴抖音/视频号的作品分享链接"
                        />
                      </td>
                      <td className="text-right">
                        <button className="button primary-btn-sm" onClick={() => submitTaskClaim(claim.id, links[claim.id] || "https://example.com/published-work-valid")}>
                          <ClipboardCheck size={14} /> 回填链接
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
