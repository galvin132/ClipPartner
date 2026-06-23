"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Search, ShieldAlert, Upload, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badge";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";
import { getProductValidity } from "@/lib/product-rules";

function samplePerformance(index: number) {
  const gmv = 3600 + index * 1280;
  return {
    gmv,
    commission: Math.round(gmv * 0.15)
  };
}

export default function PublishRecordsPage() {
  const { state, autoReviewPublishRecord, importPerformance, updatePublishStatus, syncStatus, refreshRemoteList } =
    useClipPartnerStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshRemoteList("publishRecords", {
        q: query,
        status: statusFilter,
        limit: 50
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, refreshRemoteList, statusFilter]);

  const publishRecords = state.publishRecords.filter((record) => {
    const keyword = query.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      [record.distributorName, record.materialTitle, record.productName, record.platform]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesKeyword && matchesStatus;
  });

  return (
    <AppShell active="/admin/publish-records">
      <PageHeader
        kicker="发布核验"
        title="检查作品链接和商品挂载"
        subtitle="第一版由分发者手动发布并回填作品链接，后台核验是否发布到绑定账号、是否挂载指定商品，再进入数据和结算流程。"
        actions={
          <button
            className="button primary"
            onClick={() => {
              const target = publishRecords.find((record) => record.status === "submitted" || record.status === "downloaded");
              if (target) {
                importPerformance(target.id, 6800, 1020);
              }
            }}
          >
            <Upload size={16} aria-hidden /> 导入首条待处理数据
          </button>
        }
      />

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 280 }}>
          <Search size={16} aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索分发者 / 素材"
          />
        </label>
        <select
          className="select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="发布状态"
        >
          <option value="all">全部状态</option>
          <option value="downloaded">已下载</option>
          <option value="submitted">待审核</option>
          <option value="verified">已核验</option>
          <option value="invalid">不合规</option>
        </select>
        <span className={syncStatus === "remote" ? "badge success" : syncStatus === "error" ? "badge danger" : "badge"}>
          {syncStatus === "remote" ? "已连接线上数据" : syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "同步失败" : "本地模式"}
        </span>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">发布记录</h2>
          <span className="badge info">支持单条导入表现数据，后续可升级为 CSV / Excel 导入</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发者</th>
              <th>素材</th>
              <th>商品</th>
              <th>平台</th>
              <th>提交时间</th>
              <th>作品链接 / 审核说明</th>
              <th>状态</th>
              <th>GMV / 佣金</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {publishRecords.map((record, index) => {
              const performance = samplePerformance(index);
              const productValidity = getProductValidity(state.products, record.productName, record.platform);
              return (
                <tr key={record.id}>
                  <td>{record.distributorName}</td>
                  <td>{record.materialTitle}</td>
                  <td>
                    <div className="item-title">{record.productName}</div>
                    {!productValidity.isValid ? <div className="item-meta">{productValidity.reason}</div> : null}
                  </td>
                  <td>{record.platform}</td>
                  <td>{record.submittedAt}</td>
                  <td>
                    <div className="item-title">{record.publishUrl || "待回填"}</div>
                    <div className="item-meta">{record.reviewNote || "等待处理"}</div>
                  </td>
                  <td>
                    <StatusBadge status={record.status} />
                  </td>
                  <td>
                    <div className="item-title">{money(record.gmv)}</div>
                    <div className="item-meta">佣金 {money(record.commission)}</div>
                  </td>
                  <td>
                    <div className="toolbar">
                      <button
                        className="button"
                        title="回填链接"
                        aria-label="回填链接"
                        onClick={() => updatePublishStatus(record.id, "submitted")}
                      >
                        <Link2 size={16} aria-hidden />
                      </button>
                      <button
                        className="button"
                        title={productValidity.isValid ? `导入 ${money(performance.gmv)} GMV` : productValidity.reason}
                        aria-label="导入表现数据"
                        disabled={!productValidity.isValid && record.status !== "invalid"}
                        onClick={() => importPerformance(record.id, performance.gmv, performance.commission)}
                      >
                        <Upload size={16} aria-hidden />
                      </button>
                      <button
                        className="button"
                        title="模拟核验"
                        aria-label="模拟核验"
                        onClick={() => autoReviewPublishRecord(record.id)}
                      >
                        <ShieldAlert size={16} aria-hidden />
                      </button>
                      <button
                        className="button"
                        title={productValidity.isValid ? "核验通过" : productValidity.reason}
                        aria-label="核验通过"
                        disabled={!productValidity.isValid}
                        onClick={() => updatePublishStatus(record.id, "verified")}
                      >
                        <Check size={16} aria-hidden />
                      </button>
                      <button
                        className="button"
                        title="标记不合规"
                        aria-label="标记不合规"
                        onClick={() => updatePublishStatus(record.id, "invalid")}
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
