"use client";

import { useEffect, useState } from "react";
import { Copy, Pause, Play, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useClipPartnerStore } from "@/lib/local-store";

export default function ProductsPage() {
  const { state, addProduct, updateProductStatus, syncStatus, refreshRemoteList } = useClipPartnerStore();
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"抖音" | "视频号">("抖音");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [commissionRate, setCommissionRate] = useState(15);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshRemoteList("products", {
        q: query,
        platform: platformFilter,
        limit: 50
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [platformFilter, query, refreshRemoteList]);

  const products = state.products.filter((product) => {
    const keyword = query.trim().toLowerCase();
    const matchesKeyword =
      !keyword || [product.name, product.platform, product.affiliateUrl].join(" ").toLowerCase().includes(keyword);
    const matchesPlatform = platformFilter === "all" || product.platform === platformFilter;
    return matchesKeyword && matchesPlatform;
  });

  function submitProduct() {
    const finalName = name.trim() || "新精选联盟商品";
    const finalUrl = affiliateUrl.trim() || "https://example.com/affiliate-product";
    addProduct({
      name: finalName,
      platform,
      affiliateUrl: finalUrl,
      commissionRate
    });
    setName("");
    setAffiliateUrl("");
    setCommissionRate(15);
  }

  return (
    <AppShell active="/admin/products">
      <PageHeader
        kicker="商品库"
        title="管理精选联盟商品和分发链接"
        subtitle="素材发布前必须绑定平台指定商品。第一版先维护商品名称、平台、佣金比例和推广链接，后续再接精选联盟订单数据。"
        actions={
          <button className="button primary" onClick={submitProduct}>
            <Plus size={16} aria-hidden /> 新增商品
          </button>
        }
      />

      <section className="content-card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">新增商品</h2>
        <div className="filter-bar">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="商品名称" />
          <select className="select" value={platform} onChange={(event) => setPlatform(event.target.value as "抖音" | "视频号")}>
            <option value="抖音">抖音</option>
            <option value="视频号">视频号</option>
          </select>
          <input
            className="input"
            style={{ minWidth: 320 }}
            value={affiliateUrl}
            onChange={(event) => setAffiliateUrl(event.target.value)}
            placeholder="精选联盟 / 推广链接"
          />
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={commissionRate}
            onChange={(event) => setCommissionRate(Number(event.target.value))}
            aria-label="佣金比例"
          />
        </div>
      </section>

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 280 }}>
          <Search size={16} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品名称 / 链接" />
        </label>
        <select className="select" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)} aria-label="商品平台">
          <option value="all">全部平台</option>
          <option value="抖音">抖音</option>
          <option value="视频号">视频号</option>
        </select>
        <span className={syncStatus === "remote" ? "badge success" : syncStatus === "error" ? "badge danger" : "badge"}>
          {syncStatus === "remote" ? "已连接线上数据" : syncStatus === "syncing" ? "同步中" : syncStatus === "error" ? "同步失败" : "本地模式"}
        </span>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">商品列表</h2>
          <span className="badge info">素材绑定商品后才能开放领取</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>商品</th>
              <th>平台</th>
              <th>佣金比例</th>
              <th>绑定素材</th>
              <th>链接</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="item-title">{product.name}</div>
                  <div className="item-meta">创建于 {product.createdAt}</div>
                </td>
                <td>{product.platform}</td>
                <td>{product.commissionRate}%</td>
                <td>{product.materialCount}</td>
                <td>
                  <button
                    className="button"
                    title="复制链接"
                    aria-label="复制链接"
                    onClick={() => void navigator.clipboard?.writeText(product.affiliateUrl)}
                  >
                    <Copy size={16} aria-hidden />
                  </button>
                </td>
                <td>
                  <span className={product.isActive ? "badge success" : "badge"}>{product.isActive ? "启用" : "停用"}</span>
                </td>
                <td>
                  <button
                    className="button"
                    onClick={() => updateProductStatus(product.id, !product.isActive)}
                    title={product.isActive ? "停用商品" : "启用商品"}
                    aria-label={product.isActive ? "停用商品" : "启用商品"}
                  >
                    {product.isActive ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
