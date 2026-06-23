"use client";

import { useEffect, useState } from "react";
import { Check, Pause, Plus, Search, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badge";
import { useClipPartnerStore } from "@/lib/local-store";

export default function AuthorizationsPage() {
  const {
    state,
    addAuthorizationRequest,
    updateAuthorizationStatus,
    updateAccountBindingStatus,
    refreshRemoteList
  } = useClipPartnerStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ipFilter, setIpFilter] = useState("all");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshRemoteList("authorizationRequests", {
        status: statusFilter,
        limit: 50
      });
      void refreshRemoteList("authorizationPools", { limit: 50 });
      void refreshRemoteList("formalAuthorizations", { limit: 50 });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [refreshRemoteList, statusFilter]);

  const authorizationRequests = state.authorizationRequests.filter((request) => {
    const keyword = query.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      [request.distributorName, request.phone, request.socialAccount, request.ipName, request.reason]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesIp = ipFilter === "all" || request.ipName === ipFilter;
    return matchesKeyword && matchesStatus && matchesIp;
  });

  function findBinding(distributorName: string, socialAccount: string) {
    return state.accountBindings.find(
      (item) => item.distributorName === distributorName && item.accountName === socialAccount
    );
  }

  function reviewAuthorization(requestId: string, bindingId: string | undefined, status: "approved" | "paused" | "rejected") {
    updateAuthorizationStatus(requestId, status);
    if (bindingId) {
      updateAccountBindingStatus(bindingId, status === "approved" ? "approved" : status);
    }
  }

  return (
    <AppShell active="/admin/authorizations">
      <PageHeader
        kicker="授权审核"
        title="控制谁能领取哪个 IP 的素材"
        subtitle="分发者完成微信登录、手机号绑定、社媒账号绑定后，按 IP 提交授权申请；后台通过后才开放素材查看和下载权限。"
        actions={
          <button
            className="button primary"
            onClick={() =>
              addAuthorizationRequest({
                distributorName: "新合伙人",
                socialAccount: "待核验账号",
                platform: "抖音",
                ipName: "晴姐穿搭",
                reason: "运营邀约进入，待补充分发计划。"
              })
            }
          >
            <Plus size={16} aria-hidden /> 新增申请
          </button>
        }
      />

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 260 }}>
          <Search size={16} aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索分发者 / 社媒账号"
          />
        </label>
        <select
          className="select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="审核状态"
        >
          <option value="all">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="paused">已暂停</option>
        </select>
        <select
          className="select"
          value={ipFilter}
          onChange={(event) => setIpFilter(event.target.value)}
          aria-label="IP"
        >
          <option value="all">全部 IP</option>
          <option value="老许家居">老许家居</option>
          <option value="晴姐穿搭">晴姐穿搭</option>
          <option value="林哥数码">林哥数码</option>
        </select>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">授权申请</h2>
          <span className="badge warning">{authorizationRequests.length} 条记录</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发者</th>
              <th>准入</th>
              <th>绑定账号</th>
              <th>账号资料</th>
              <th>申请 IP</th>
              <th>申请说明</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {authorizationRequests.map((request) => {
              const binding = findBinding(request.distributorName, request.socialAccount);
              const profile = state.distributorProfiles.find((item) => item.displayName === request.distributorName);
              const agreement = state.agreementSignatures.find((item) => item.distributorName === request.distributorName);
              return (
                <tr key={request.id}>
                  <td>
                    <div className="item-title">{request.distributorName}</div>
                    <div className="item-meta">{request.phone}</div>
                  </td>
                  <td>
                    {profile ? (
                      <>
                        <StatusBadge status={profile.onboardingStatus} />
                        <div className="item-meta">
                          信用 {profile.creditScore} · 考试 {profile.examScore} · {agreement ? "协议已签" : "协议待签"}
                        </div>
                      </>
                    ) : (
                      <span className="badge warning">待建档</span>
                    )}
                  </td>
                  <td>
                    <div className="item-title">{request.socialAccount}</div>
                    <div className="item-meta">
                      {request.platform} · {request.appliedAt}
                    </div>
                  </td>
                  <td>
                    {binding ? (
                      <>
                        <div className="item-title">{binding.followers.toLocaleString("zh-CN")} 粉丝</div>
                        <div className="item-meta">{binding.category}</div>
                        <a className="text-link" href={binding.homepageUrl} target="_blank" rel="noreferrer">
                          查看主页
                        </a>
                      </>
                    ) : (
                      <span className="badge warning">待补充账号资料</span>
                    )}
                  </td>
                  <td>{request.ipName}</td>
                  <td>{request.reason}</td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td>
                    <div className="toolbar">
                      <button
                        className="button"
                        aria-label="通过"
                        title="通过"
                        onClick={() => reviewAuthorization(request.id, binding?.id, "approved")}
                      >
                        <Check size={16} aria-hidden />
                      </button>
                      <button
                        className="button"
                        aria-label="暂停"
                        title="暂停"
                        onClick={() => reviewAuthorization(request.id, binding?.id, "paused")}
                      >
                        <Pause size={16} aria-hidden />
                      </button>
                      <button
                        className="button"
                        aria-label="拒绝"
                        title="拒绝"
                        onClick={() => reviewAuthorization(request.id, binding?.id, "rejected")}
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
