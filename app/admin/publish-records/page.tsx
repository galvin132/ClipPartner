"use client";

import { Check, Link2, Search, Upload, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badge";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

export default function PublishRecordsPage() {
  const { state, importPerformance, updatePublishStatus } = useClipPartnerStore();
  const publishRecords = state.publishRecords;

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
            <Upload size={16} aria-hidden /> 导入表现数据
          </button>
        }
      />

      <div className="filter-bar">
        <div className="input" style={{ minWidth: 280 }}>
          <Search size={16} aria-hidden /> 搜索分发者 / 素材
        </div>
        <select className="select" defaultValue="submitted" aria-label="发布状态">
          <option value="submitted">待审核</option>
          <option value="verified">已核验</option>
          <option value="invalid">不合规</option>
        </select>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">发布记录</h2>
          <span className="badge info">支持先手动回填，后续再接平台接口</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发者</th>
              <th>素材</th>
              <th>商品</th>
              <th>平台</th>
              <th>提交时间</th>
              <th>状态</th>
              <th>GMV / 佣金</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {publishRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.distributorName}</td>
                <td>{record.materialTitle}</td>
                <td>{record.productName}</td>
                <td>{record.platform}</td>
                <td>{record.submittedAt}</td>
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
                      title="核验通过"
                      aria-label="核验通过"
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
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
