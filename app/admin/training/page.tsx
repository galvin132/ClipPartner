"use client";

import { BookOpenCheck, FileSignature, GraduationCap } from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useClipPartnerStore } from "@/lib/local-store";

export default function TrainingAdminPage() {
  const { state, refreshRemoteList } = useClipPartnerStore();
  useEffect(() => {
    void refreshRemoteList("trainingCourses", { limit: 50 });
    void refreshRemoteList("examAttempts", { limit: 50 });
    void refreshRemoteList("agreementSignatures", { limit: 50 });
    void refreshRemoteList("creditScoreEvents", { limit: 50 });
  }, [refreshRemoteList]);

  return (
    <AppShell active="/admin/training">
      <PageHeader
        kicker="课程考试"
        title="管理分发者准入课程、考试记录和协议签署"
        subtitle="首版先沉淀课程、考试和协议状态，后续可接视频学习进度、题库配置和电子签。"
        actions={<span className="badge info">80 分及格 · 初始信用分 100</span>}
      />

      <section className="content-grid">
        <div className="content-card">
          <h2 className="section-title">
            <BookOpenCheck size={18} aria-hidden /> 必修课程
          </h2>
          <div className="workflow">
            {state.trainingCourses.map((course) => (
              <div className="workflow-row" key={course.id}>
                <span className="step-index">{course.lessonCount}</span>
                <div>
                  <div className="step-title">{course.title}</div>
                  <div className="step-desc">
                    预计 {course.estimatedMinutes} 分钟 · {course.isRequired ? "必修" : "选修"}
                  </div>
                </div>
                <span className="badge success">已启用</span>
              </div>
            ))}
          </div>
        </div>

        <div className="content-card">
          <h2 className="section-title">
            <FileSignature size={18} aria-hidden /> 协议签署
          </h2>
          <div className="workflow">
            {state.agreementSignatures.map((signature) => (
              <div className="workflow-row" key={signature.id}>
                <span className="step-index">签</span>
                <div>
                  <div className="step-title">{signature.distributorName}</div>
                  <div className="step-desc">
                    {signature.templateName} · {signature.version} · {signature.signedAt}
                  </div>
                </div>
                <span className="badge success">已签</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="table-card" style={{ marginTop: 18 }}>
        <div className="table-header">
          <h2 className="table-title">
            <GraduationCap size={18} aria-hidden /> 考试记录
          </h2>
          <span className="badge warning">低于 80 分不能进入授权申请</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发者</th>
              <th>得分</th>
              <th>是否通过</th>
              <th>考试时间</th>
            </tr>
          </thead>
          <tbody>
            {state.examAttempts.map((attempt) => (
              <tr key={attempt.id}>
                <td>{attempt.distributorName}</td>
                <td>{attempt.score}</td>
                <td>
                  <span className={attempt.passed ? "badge success" : "badge danger"}>{attempt.passed ? "通过" : "未通过"}</span>
                </td>
                <td>{attempt.attemptedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="table-card" style={{ marginTop: 18 }}>
        <div className="table-header">
          <h2 className="table-title">信用分事件</h2>
          <span className="badge info">风控会自动生成扣分事件</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>分发者</th>
              <th>变动</th>
              <th>原因</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {state.creditScoreEvents.map((event) => (
              <tr key={event.id}>
                <td>{event.distributorName}</td>
                <td>
                  <span className={event.delta >= 0 ? "badge success" : "badge danger"}>{event.delta >= 0 ? `+${event.delta}` : event.delta}</span>
                </td>
                <td>{event.reason}</td>
                <td>{event.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
