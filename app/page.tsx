"use client";

import { ArrowRight, CheckCircle2, Download, FileVideo2, RotateCcw, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badge";
import { workflowSteps } from "@/lib/mock-data";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

const metricIcons = [ShieldCheck, FileVideo2, Download, CheckCircle2];

export default function DashboardPage() {
  const { state, metrics, resetDemoData } = useClipPartnerStore();
  const dashboardMetrics = [
    {
      label: "待审核授权",
      value: String(metrics.pendingAuthorizations),
      note: "可在授权审核页直接处理"
    },
    {
      label: "可领取素材",
      value: String(metrics.publishedMaterials),
      note: "仅授权分发者可见"
    },
    {
      label: "待核验发布",
      value: String(metrics.submittedRecords),
      note: "需检查作品和商品链接"
    },
    {
      label: "本月待结算",
      value: money(metrics.payable),
      note: "不含违规和冻结记录"
    }
  ];

  return (
    <AppShell active="/">
      <PageHeader
        kicker="MVP 工作台"
        title="授权分发运营闭环"
        subtitle="以众小二 / 三只羊模式为业务参考，把 IP 录屏、素材切片、分发授权、发布回填和佣金结算沉淀到平台方自有系统。"
        actions={
          <>
            <button className="button">导入成交数据</button>
            <button className="button" onClick={resetDemoData}>
              <RotateCcw size={16} aria-hidden /> 重置演示数据
            </button>
            <a className="button primary" href="/admin/materials">
              创建切片任务
            </a>
          </>
        }
      />

      <section className="metrics-grid" aria-label="核心指标">
        {dashboardMetrics.map((metric, index) => {
          const Icon = metricIcons[index];
          return (
            <article className="metric-card" key={metric.label}>
              <div className="metric-label">
                <Icon size={17} aria-hidden />
                <span>{metric.label}</span>
              </div>
              <div className="metric-value">{metric.value}</div>
              <div className="metric-note">{metric.note}</div>
            </article>
          );
        })}
      </section>

      <section className="content-grid">
        <div className="content-card">
          <h2 className="section-title">今日主流程</h2>
          <div className="workflow">
            {workflowSteps.map((step, index) => (
              <div className="workflow-row" key={step.title}>
                <span className="step-index">{index + 1}</span>
                <div>
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc">{step.desc}</div>
                </div>
                <span className="badge warning">{step.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="content-card">
          <h2 className="section-title">MVP 边界</h2>
          <div className="workflow">
            <div className="workflow-row">
              <span className="step-index">A</span>
              <div>
                <div className="step-title">第一版先手动闭环</div>
                <div className="step-desc">录屏上传、人工切点、链接回填、成交导入、结算台账。</div>
              </div>
              <ArrowRight size={18} aria-hidden />
            </div>
            <div className="workflow-row">
              <span className="step-index">B</span>
              <div>
                <div className="step-title">后续再自动化</div>
                <div className="step-desc">平台接口、自动抓数、AI 切片、隐形水印、自动打款。</div>
              </div>
              <ArrowRight size={18} aria-hidden />
            </div>
          </div>
        </div>
      </section>

      <section className="table-card" style={{ marginTop: 18 }}>
        <div className="table-header">
          <h2 className="table-title">待关注发布记录</h2>
          <button className="button">查看全部</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发者</th>
              <th>素材 / 商品</th>
              <th>平台</th>
              <th>状态</th>
              <th>GMV</th>
              <th>佣金</th>
            </tr>
          </thead>
          <tbody>
            {state.publishRecords.slice(0, 5).map((record) => (
              <tr key={record.id}>
                <td>{record.distributorName}</td>
                <td>
                  <div className="item-title">{record.materialTitle}</div>
                  <div className="item-meta">{record.productName}</div>
                </td>
                <td>{record.platform}</td>
                <td>
                  <StatusBadge status={record.status} />
                </td>
                <td>{money(record.gmv)}</td>
                <td>{money(record.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
