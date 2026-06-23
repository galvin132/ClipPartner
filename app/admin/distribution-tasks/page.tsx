"use client";

import { Pause, Play, Plus, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { useClipPartnerStore } from "@/lib/local-store";

export default function DistributionTasksPage() {
  const { state, addDistributionTask, updateDistributionTaskStatus, refreshRemoteList } = useClipPartnerStore();
  const [query, setQuery] = useState("");
  useEffect(() => {
    void refreshRemoteList("distributionTasks", { q: query, limit: 50 });
  }, [query, refreshRemoteList]);

  const tasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return state.distributionTasks.filter(
      (item) =>
        !keyword ||
        [item.title, item.ipName, item.productName, item.platform, item.requirement].join(" ").toLowerCase().includes(keyword)
    );
  }, [query, state.distributionTasks]);

  return (
    <AppShell active="/admin/distribution-tasks">
      <PageHeader
        kicker="分发任务"
        title="把素材、商品、授权和奖励组合成可领取任务"
        subtitle="任务中心是新版分发者端的核心，领取时会生成 claim、下载凭证和发布待办。"
        actions={
          <button
            className="button primary"
            onClick={() =>
              addDistributionTask({
                title: "新素材起量任务",
                ipName: "晴姐穿搭",
                platform: "视频号",
                productName: "冰感通勤套装",
                materialIds: ["CLIP-001"],
                endAt: "2026-07-05",
                rewardRule: "按授权分成结算，前 20 条核验作品额外奖励 30 元。",
                claimLimit: 50,
                requirement: "必须发布到已审核账号并挂指定商品链接。"
              })
            }
          >
            <Plus size={16} aria-hidden /> 新建任务
          </button>
        }
      />

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 320 }}>
          <Search size={16} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务 / IP / 商品" />
        </label>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">任务列表</h2>
          <span className="badge info">领取后进入分发者待办</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>任务</th>
              <th>素材 / 商品</th>
              <th>周期</th>
              <th>领取 / 发布</th>
              <th>奖励规则</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const materialTitles = state.materials
                .filter((material) => task.materialIds.includes(material.id))
                .map((material) => material.title)
                .join("、");
              return (
                <tr key={task.id}>
                  <td>
                    <div className="item-title">{task.title}</div>
                    <div className="item-meta">
                      {task.ipName} · {task.platform}
                    </div>
                  </td>
                  <td>
                    <div className="item-title">{materialTitles || "待绑定素材"}</div>
                    <div className="item-meta">{task.productName}</div>
                  </td>
                  <td>
                    {task.startAt} 至 {task.endAt}
                  </td>
                  <td>
                    <div className="item-title">
                      {task.claimedCount} / {task.claimLimit}
                    </div>
                    <div className="item-meta">已发布 {task.publishedCount}</div>
                  </td>
                  <td>{task.rewardRule}</td>
                  <td>
                    <StatusBadge status={task.status} />
                  </td>
                  <td>
                    <div className="toolbar">
                      <button className="button" onClick={() => updateDistributionTaskStatus(task.id, "open")} title="开放">
                        <Play size={16} aria-hidden />
                      </button>
                      <button className="button" onClick={() => updateDistributionTaskStatus(task.id, "paused")} title="暂停">
                        <Pause size={16} aria-hidden />
                      </button>
                      <button className="button" onClick={() => updateDistributionTaskStatus(task.id, "closed")} title="关闭">
                        <XCircle size={16} aria-hidden />
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
