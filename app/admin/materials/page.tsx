"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, FileUp, Link2, Plus, Scissors, Search, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badge";
import { useClipPartnerStore } from "@/lib/local-store";
import { getProductValidity } from "@/lib/product-rules";

export default function MaterialsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, addMaterial, uploadRecording, updateMaterialStatus, bindMaterialProduct, syncStatus, refreshRemoteList } =
    useClipPartnerStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshRemoteList("materials", {
        q: query,
        status: statusFilter,
        limit: 50
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, refreshRemoteList, statusFilter]);

  const materials = state.materials.filter((material) => {
    const keyword = query.trim().toLowerCase();
    const matchesKeyword =
      !keyword ||
      [material.title, material.ipName, material.sourcePlatform, material.productName, ...material.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    const matchesStatus = statusFilter === "all" || material.status === statusFilter;
    return matchesKeyword && matchesStatus;
  });
  const activeProducts = state.products.filter((product) => getProductValidity(state.products, product.name, product.platform).isValid);

  return (
    <AppShell active="/admin/materials">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void uploadRecording(file, {
            title: file.name.replace(/\.[^.]+$/, ""),
            ipName: "晴姐穿搭",
            sourcePlatform: "视频号"
          });
          event.target.value = "";
        }}
      />

      <PageHeader
        kicker="素材管理"
        title="从直播录屏到可领取切片"
        subtitle="运营上传直播录屏，人工选择切点生成素材，再补充标题、标签、卖点、推荐文案并绑定精选联盟商品。"
        actions={
          <>
            <button className="button" onClick={() => fileInputRef.current?.click()}>
              <FileUp size={16} aria-hidden /> 上传录屏
            </button>
            <button
              className="button primary"
              onClick={() =>
                addMaterial({
                  title: "人工切点生成的新素材",
                  ipName: "晴姐穿搭",
                  sourcePlatform: "视频号",
                  productName: "冰感通勤套装"
                })
              }
            >
              <Scissors size={16} aria-hidden /> 创建切点
            </button>
          </>
        }
      />

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 280 }}>
          <Search size={16} aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索素材标题 / 商品"
          />
        </label>
        <select
          className="select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="素材状态"
        >
          <option value="all">全部状态</option>
          <option value="published">可领取</option>
          <option value="ready">待完善</option>
          <option value="processing">处理中</option>
        </select>
        <button
          className="button"
          onClick={() =>
            addMaterial({
              title: "后台手动新增素材",
              ipName: "林哥数码",
              sourcePlatform: "抖音",
              productName: "领夹无线麦克风"
            })
          }
        >
          <Plus size={16} aria-hidden /> 新建素材
        </button>
        <span className={syncStatus === "remote" ? "badge success" : syncStatus === "error" ? "badge danger" : "badge"}>
          {syncStatus === "remote" ? "已连接线上数据" : syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "同步失败" : "本地模式"}
        </span>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">素材列表</h2>
          <span className="badge info">录屏上传到 R2，切片任务后续接 FFmpeg</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>素材</th>
              <th>来源</th>
              <th>标签</th>
              <th>绑定商品</th>
              <th>质量 / 有效期</th>
              <th>领取 / 下载</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((material) => {
              const productValidity = getProductValidity(state.products, material.productName, material.sourcePlatform);
              return (
              <tr key={material.id}>
                <td>
                  <div className="item-title">{material.title}</div>
                  <div className="item-meta">时长 {material.duration} · 直播日 {material.liveDate}</div>
                </td>
                <td>
                  <div className="item-title">{material.ipName}</div>
                  <div className="item-meta">{material.sourcePlatform}</div>
                </td>
                <td>
                  <div className="toolbar">
                    {material.tags.map((tag) => (
                      <span className="badge" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="item-title">{material.productName}</div>
                  {!productValidity.isValid ? <div className="item-meta">{productValidity.reason}</div> : null}
                </td>
                <td>
                  <div className="item-title">{material.qualityScore ?? 0} 分</div>
                  <div className="item-meta">有效至 {material.expiresAt ?? "待设置"}</div>
                  <div className="item-meta">{material.sellingPoint ?? "待补充卖点"}</div>
                </td>
                <td>
                  {material.claims} / {material.downloads}
                </td>
                <td>
                  <StatusBadge status={material.status} />
                </td>
                <td>
                  <div className="toolbar">
                    <Link className="button" href={`/admin/materials/${material.id}`} title="查看详情" aria-label="查看详情">
                      详情
                    </Link>
                    <button
                      className="button"
                      title="绑定启用商品"
                      aria-label="绑定启用商品"
                      onClick={() => {
                        const product = activeProducts[0];
                        if (product) bindMaterialProduct(material.id, product.id);
                      }}
                    >
                      <Link2 size={16} aria-hidden />
                    </button>
                    <button
                      className="button"
                      title={productValidity.isValid ? "设为可领取" : productValidity.reason}
                      aria-label="设为可领取"
                      disabled={!productValidity.isValid}
                      onClick={() => updateMaterialStatus(material.id, "published")}
                    >
                      <UploadCloud size={16} aria-hidden />
                    </button>
                    <button
                      className="button"
                      title="退回待完善"
                      aria-label="退回待完善"
                      onClick={() => updateMaterialStatus(material.id, "ready")}
                    >
                      <Scissors size={16} aria-hidden />
                    </button>
                    <button
                      className="button"
                      title="下架"
                      aria-label="下架"
                      onClick={() => updateMaterialStatus(material.id, "archived")}
                    >
                      <Archive size={16} aria-hidden />
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
