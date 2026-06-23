"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Archive, Download, Link2, PlayCircle, Scissors, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badge";
import { useClipPartnerStore } from "@/lib/local-store";
import { getProductValidity } from "@/lib/product-rules";

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, bindMaterialProduct, claimMaterial, updateMaterialStatus } = useClipPartnerStore();
  const material = state.materials.find((item) => item.id === params.id);

  if (!material) {
    return (
      <AppShell active="/admin/materials">
        <section className="content-card">
          <h1 className="page-title">素材不存在</h1>
          <p className="page-subtitle">当前素材可能已被删除，或本地演示数据已重置。</p>
          <Link className="button primary" href="/admin/materials">
            返回素材管理
          </Link>
        </section>
      </AppShell>
    );
  }

  const activeProducts = state.products.filter((product) => getProductValidity(state.products, product.name, product.platform).isValid);
  const relatedRecords = state.publishRecords.filter((record) => record.materialTitle === material.title);
  const productValidity = getProductValidity(state.products, material.productName, material.sourcePlatform);

  return (
    <AppShell active="/admin/materials">
      <div className="topbar">
        <div>
          <p className="page-kicker">素材详情</p>
          <h1 className="page-title">{material.title}</h1>
          <p className="page-subtitle">
            管理素材预览、状态、标签、绑定商品和领取发布记录。真实视频文件接入前，这里先提供可测试的预览占位和模拟下载闭环。
          </p>
        </div>
        <div className="toolbar">
          <Link className="button" href="/admin/materials">
            返回列表
          </Link>
          <button
            className="button primary"
            disabled={!productValidity.isValid}
            title={productValidity.isValid ? "开放领取" : productValidity.reason}
            onClick={() => updateMaterialStatus(material.id, "published")}
          >
            <UploadCloud size={16} aria-hidden /> 开放领取
          </button>
        </div>
      </div>

      <section className="detail-grid">
        <div className="content-card">
          <div className="video-preview">
            <PlayCircle size={54} aria-hidden />
            <div>
              <div className="item-title">视频预览占位</div>
              <div className="item-meta">R2 文件或 FFmpeg 输出地址配置后，这里替换为真实播放器。</div>
            </div>
          </div>
          <div className="material-detail-meta">
            <span className="badge info">{material.ipName}</span>
            <span className="badge">{material.sourcePlatform}</span>
            <StatusBadge status={material.status} />
            {material.tags.map((tag) => (
              <span className="badge" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="content-card">
          <h2 className="section-title">素材信息</h2>
          <div className="info-list">
            <div>
              <span>直播日期</span>
              <strong>{material.liveDate}</strong>
            </div>
            <div>
              <span>时长</span>
              <strong>{material.duration}</strong>
            </div>
            <div>
              <span>领取 / 下载</span>
              <strong>
                {material.claims} / {material.downloads}
              </strong>
            </div>
            <div>
              <span>当前商品</span>
              <strong>{material.productName}</strong>
              {!productValidity.isValid ? <div className="item-meta">{productValidity.reason}</div> : null}
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: 16 }}>
            <button className="button" disabled={!productValidity.isValid || material.status !== "published"} onClick={() => claimMaterial(material.id)}>
              <Download size={16} aria-hidden /> 模拟领取下载
            </button>
            <button className="button" onClick={() => updateMaterialStatus(material.id, "ready")}>
              <Scissors size={16} aria-hidden /> 退回待完善
            </button>
            <button className="button" onClick={() => updateMaterialStatus(material.id, "archived")}>
              <Archive size={16} aria-hidden /> 下架
            </button>
          </div>
        </div>
      </section>

      <section className="content-card" style={{ marginTop: 18 }}>
        <div className="table-header compact">
          <h2 className="table-title">绑定商品</h2>
          <span className="badge warning">开放领取前建议绑定指定商品</span>
        </div>
        <div className="product-bind-grid">
          {activeProducts.map((product) => (
            <button className="account-card" key={product.id} onClick={() => bindMaterialProduct(material.id, product.id)}>
              <div>
                <div className="item-title">{product.name}</div>
                <div className="item-meta">
                  {product.platform} · 佣金 {product.commissionRate}%
                </div>
              </div>
              <Link2 size={18} aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <section className="table-card" style={{ marginTop: 18 }}>
        <div className="table-header">
          <h2 className="table-title">相关发布记录</h2>
          <span className="badge info">{relatedRecords.length} 条</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发者</th>
              <th>商品</th>
              <th>平台</th>
              <th>状态</th>
              <th>GMV</th>
              <th>佣金</th>
            </tr>
          </thead>
          <tbody>
            {relatedRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.distributorName}</td>
                <td>{record.productName}</td>
                <td>{record.platform}</td>
                <td>
                  <StatusBadge status={record.status} />
                </td>
                <td>{record.gmv.toLocaleString("zh-CN")}</td>
                <td>{record.commission.toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
