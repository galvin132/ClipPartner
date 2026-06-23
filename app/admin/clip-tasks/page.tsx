"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Play, Plus, RotateCcw, Search, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { type ClipTaskStatus } from "@/lib/domain";
import { useClipPartnerStore } from "@/lib/local-store";

const taskStatusLabels: Record<ClipTaskStatus, string> = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败"
};

const taskStatusTone: Record<ClipTaskStatus, string> = {
  queued: "info",
  processing: "warning",
  completed: "success",
  failed: "danger"
};

export default function ClipTasksPage() {
  const { state, addClipTask, updateClipTaskStatus, completeClipTask } = useClipPartnerStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recordingTitle, setRecordingTitle] = useState("新直播录屏");
  const [ipName, setIpName] = useState("晴姐穿搭");
  const [sourcePlatform, setSourcePlatform] = useState<"抖音" | "视频号">("视频号");

  const tasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return state.clipTasks.filter((task) => {
      const matchesKeyword =
        !keyword || [task.recordingTitle, task.ipName, task.sourcePlatform, task.errorMessage].join(" ").toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [query, state.clipTasks, statusFilter]);

  function submitTask() {
    addClipTask({
      recordingTitle: recordingTitle.trim() || "新直播录屏",
      ipName,
      sourcePlatform
    });
    setRecordingTitle("新直播录屏");
  }

  return (
    <AppShell active="/admin/clip-tasks">
      <PageHeader
        kicker="切片任务"
        title="录屏上传后进入任务队列，等待 FFmpeg 服务处理"
        subtitle="当前先用模拟任务跑通流程。后续填入 FFMPEG_WORKER_ENDPOINT 和 FFMPEG_WORKER_TOKEN 后，可把模拟完成替换成真实切片与转码。"
        actions={
          <button className="button primary" onClick={submitTask}>
            <Plus size={16} aria-hidden /> 创建任务
          </button>
        }
      />

      <section className="content-card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">新建切片任务</h2>
        <div className="filter-bar">
          <input
            className="input"
            style={{ minWidth: 280 }}
            value={recordingTitle}
            onChange={(event) => setRecordingTitle(event.target.value)}
            placeholder="录屏标题"
          />
          <select className="select" value={ipName} onChange={(event) => setIpName(event.target.value)}>
            <option value="晴姐穿搭">晴姐穿搭</option>
            <option value="老许家居">老许家居</option>
            <option value="林哥数码">林哥数码</option>
          </select>
          <select className="select" value={sourcePlatform} onChange={(event) => setSourcePlatform(event.target.value as "抖音" | "视频号")}>
            <option value="视频号">视频号</option>
            <option value="抖音">抖音</option>
          </select>
        </div>
      </section>

      <div className="filter-bar">
        <label className="input search-control" style={{ minWidth: 300 }}>
          <Search size={16} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索录屏 / IP / 错误信息" />
        </label>
        <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="任务状态">
          <option value="all">全部状态</option>
          <option value="queued">排队中</option>
          <option value="processing">处理中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
        </select>
      </div>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">任务列表</h2>
          <span className="badge info">完成后自动生成 3 条待完善素材</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>录屏</th>
              <th>来源</th>
              <th>进度</th>
              <th>输出</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <div className="item-title">{task.recordingTitle}</div>
                  <div className="item-meta">{task.createdAt}</div>
                  {task.errorMessage ? <div className="item-meta">{task.errorMessage}</div> : null}
                </td>
                <td>
                  <div className="item-title">{task.ipName}</div>
                  <div className="item-meta">{task.sourcePlatform}</div>
                </td>
                <td>
                  <div className="progress-track">
                    <span style={{ width: `${task.progress}%` }} />
                  </div>
                  <div className="item-meta">{task.progress}%</div>
                </td>
                <td>{task.outputCount} 条素材</td>
                <td>
                  <span className={`badge ${taskStatusTone[task.status]}`}>{taskStatusLabels[task.status]}</span>
                </td>
                <td>
                  <div className="toolbar">
                    <button className="button" onClick={() => updateClipTaskStatus(task.id, "processing")}>
                      <Play size={16} aria-hidden /> 处理
                    </button>
                    <button className="button" onClick={() => completeClipTask(task.id)}>
                      <CheckCircle2 size={16} aria-hidden /> 模拟完成
                    </button>
                    <button className="button" onClick={() => updateClipTaskStatus(task.id, "failed")}>
                      <XCircle size={16} aria-hidden /> 失败
                    </button>
                    <button className="button" onClick={() => updateClipTaskStatus(task.id, "queued")}>
                      <RotateCcw size={16} aria-hidden /> 重试
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
