"use client";

import Link from "next/link";
import { ClipboardCheck, Copy, Download, LogOut, Plus, Search } from "lucide-react";
import { money } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

export default function PartnerPage() {
  const { state, addAuthorizationRequest, claimMaterial, submitPublishLink } = useClipPartnerStore();
  const publishedMaterials = state.materials.filter((material) => material.status === "published");
  const myRecords = state.publishRecords.filter((record) => record.distributorName === "周婧");
  const payable = state.settlements
    .filter((settlement) => settlement.distributorName === "周婧" && settlement.status !== "blocked")
    .reduce((sum, settlement) => sum + settlement.payableCommission, 0);

  return (
    <div className="partner-shell">
      <header className="partner-header">
        <div className="partner-header-inner">
          <div>
            <div className="brand-title">切片合伙人</div>
            <div className="brand-subtitle">已授权 IP：晴姐穿搭、老许家居</div>
          </div>
          <div className="toolbar">
            <Link className="button" href="/">
              返回后台预览
            </Link>
            <button className="button" aria-label="退出">
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main">
        <div className="topbar">
          <div>
            <p className="page-kicker">分发者素材中心</p>
            <h1 className="page-title">领取授权素材并回填发布链接</h1>
            <p className="page-subtitle">
              这里只展示已授权 IP 的可领取素材。领取时需要选择推广商品和发布账号，下载、发布和结算都会保留记录。
            </p>
          </div>
          <div className="content-card" style={{ minWidth: 280 }}>
            <div className="metric-label">本月预计可结算</div>
            <div className="metric-value">{money(payable)}</div>
            <div className="metric-note">我的发布记录 {myRecords.length} 条</div>
          </div>
        </div>

        <div className="filter-bar">
          <div className="input" style={{ minWidth: 280 }}>
            <Search size={16} aria-hidden /> 搜索素材 / 商品
          </div>
          <select className="select" defaultValue="all" aria-label="IP 筛选">
            <option value="all">全部授权 IP</option>
            <option value="fashion">晴姐穿搭</option>
            <option value="home">老许家居</option>
          </select>
          <button
            className="button"
            onClick={() =>
              addAuthorizationRequest({
                distributorName: "周婧",
                socialAccount: "小周好物局",
                platform: "视频号",
                ipName: "林哥数码",
                reason: "申请新增数码 IP 授权，用于测评账号分发。"
              })
            }
          >
            <Plus size={16} aria-hidden /> 申请新 IP
          </button>
        </div>

        <section className="material-grid">
          {publishedMaterials.map((material) => (
            <article className="material-card" key={material.id}>
              <div className="material-cover" />
              <div className="material-body">
                <div>
                  <div className="item-title">{material.title}</div>
                  <div className="item-meta">
                    {material.ipName} · {material.duration} · {material.liveDate}
                  </div>
                </div>
                <div className="toolbar">
                  {material.tags.map((tag) => (
                    <span className="badge" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="item-meta">指定商品：{material.productName}</div>
                <div className="material-actions">
                  <button className="button">
                    <Copy size={16} aria-hidden /> 文案
                  </button>
                  <button className="button primary" onClick={() => claimMaterial(material.id, "周婧")}>
                    <Download size={16} aria-hidden /> 领取
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="table-card" style={{ marginTop: 18 }}>
          <div className="table-header">
            <h2 className="table-title">我的发布记录</h2>
            <span className="badge info">发布后回填链接，后台才可核验结算</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>素材</th>
                <th>商品</th>
                <th>平台</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {myRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.materialTitle}</td>
                  <td>{record.productName}</td>
                  <td>{record.platform}</td>
                  <td>{record.status}</td>
                  <td>
                    <button className="button" onClick={() => submitPublishLink(record.id)}>
                      <ClipboardCheck size={16} aria-hidden /> 回填发布链接
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
