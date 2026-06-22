"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Search, ShieldAlert, Snowflake, Siren } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { badgeTone, statusLabels, type RiskStatus } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

const statusOptions: { value: RiskStatus; label: string }[] = [
  { value: "open", label: "待处理" },
  { value: "warning", label: "已警告" },
  { value: "blocked", label: "冻结结算" },
  { value: "resolved", label: "已关闭" }
];

export default function RiskPage() {
  const { state, addRiskRecord, updateRiskStatus, syncStatus, refreshRemoteList } = useClipPartnerStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [account, setAccount] = useState("");
  const [platform, setPlatform] = useState<"抖音" | "视频号">("抖音");
  const [issue, setIssue] = useState("");
  const [workUrl, setWorkUrl] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshRemoteList("riskRecords", {
        q: query,
        status: statusFilter,
        limit: 50
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, refreshRemoteList, statusFilter]);

  const riskRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return state.riskRecords.filter((item) => {
      const matchesKeyword =
        !keyword || [item.account, item.issue, item.workUrl, item.platform].join(" ").toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [query, state.riskRecords, statusFilter]);

  function submitRiskRecord() {
    addRiskRecord({
      platform,
      account: account.trim() || "待核查账号",
      issue: issue.trim() || "疑似未授权搬运或商品挂载异常",
      workUrl: workUrl.trim() || "https://example.com/suspected-work"
    });
    setAccount("");
    setIssue("");
    setWorkUrl("");
  }

  return (
    <AppShell active="/admin/risk">
      <PageHeader
        kicker="风控记录"
        title="素材出库后仍要可追踪、可处理"
        subtitle="第一版重点做授权前置、领取下载留痕、违规线索登记、结算拦截和处理状态流转，后续再升级视频指纹和自动监测。"
        actions={
          <button className="button primary" onClick={submitRiskRecord}>
            <ShieldAlert size={16} aria-hidden /> 新增违规线索
          </button>
        }
      />

      <section className="content-card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">新增线索</h2>
        <div className="filter-bar">
          <select className="select" value={platform} onChange={(event) => setPlatform(event.target.value as "抖音" | "视频号")}>
            <option value="抖音">抖音</option>
            <option value="视频号">视频号</option>
          </select>
          <input className="input" value={account} onChange={(event) => setAccount(event.target.value)} placeholder="账号名称" />
          <input
            className="input"
            style={{ minWidth: 320 }}
            value={workUrl}
            onChange={(event) => setWorkUrl(event.target.value)}
            placeholder="疑似作品链接"
          />
          <input
            className="input"
            style={{ minWidth: 320 }}
            value={issue}
            onChange={(event) => setIssue(event.target.value)}
            placeholder="问题说明"
          />
        </div>
      </section>

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 300 }}>
          <Search size={16} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索账号 / 问题 / 链接" />
        </label>
        <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="风控状态">
          <option value="all">全部状态</option>
          {statusOptions.map((item) => (
            <option value={item.value} key={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <span className={syncStatus === "remote" ? "badge success" : syncStatus === "error" ? "badge danger" : "badge"}>
          {syncStatus === "remote" ? "已连接线上数据" : syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "同步失败" : "本地模式"}
        </span>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">违规线索</h2>
          <span className="badge danger">违规作品不结算</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>平台</th>
              <th>账号</th>
              <th>问题</th>
              <th>作品链接</th>
              <th>处理状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {riskRecords.map((item) => (
              <tr key={item.id}>
                <td>{item.platform}</td>
                <td>
                  <div className="item-title">{item.account}</div>
                  <div className="item-meta">{item.createdAt}</div>
                </td>
                <td>{item.issue}</td>
                <td>
                  <a className="button" href={item.workUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} aria-hidden /> 查看
                  </a>
                </td>
                <td>
                  <span className={`badge ${badgeTone(item.status)}`}>{statusLabels[item.status]}</span>
                </td>
                <td>
                  <div className="toolbar">
                    <button className="button" onClick={() => updateRiskStatus(item.id, "warning")}>
                      <Siren size={16} aria-hidden /> 警告
                    </button>
                    <button className="button" onClick={() => updateRiskStatus(item.id, "blocked")}>
                      <Snowflake size={16} aria-hidden /> 冻结
                    </button>
                    <button className="button" onClick={() => updateRiskStatus(item.id, "resolved")}>
                      <CheckCircle2 size={16} aria-hidden /> 关闭
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
