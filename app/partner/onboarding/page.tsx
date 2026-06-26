"use client";

import Link from "next/link";
import { BadgeCheck, BookOpenCheck, FileSignature, GraduationCap, LogOut, UserRoundCheck, ArrowLeft, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Badge";
import { useClipPartnerStore } from "@/lib/local-store";

const steps = [
  { key: "profile", title: "第一步：资料完善", icon: UserRoundCheck, desc: "填写手机号、微信等基础合伙人身份信息，保持联系畅通。" },
  { key: "account", title: "第二步：社交账号绑定", icon: BadgeCheck, desc: "至少绑定一个发布作品的抖音或视频号，并且粉丝达标且审核通过。" },
  { key: "training", title: "第三步：规则必修课学习", icon: BookOpenCheck, desc: "在线完成平台官方运营与二创去重规则的课程学习。" },
  { key: "exam", title: "第四步：平台考试认证", icon: GraduationCap, desc: "通过切片二创与分销防违规考试，达到 80 分即可通过。" },
  { key: "agreement", title: "第五步：合作协议签署", icon: FileSignature, desc: "在线电子签署切片合伙人分发与佣金分成正式协议书。" }
];

export default function PartnerOnboardingPage() {
  return (
    <AuthGate roles={["partner"]}>
      <PartnerOnboardingExperience />
    </AuthGate>
  );
}

function PartnerOnboardingExperience() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const { state, recordExamAttempt, signAgreement, updateDistributorOnboarding, syncStatus, refreshRemoteList } = useClipPartnerStore();
  const distributorName = session?.displayName ?? "";
  
  useEffect(() => {
    void refreshRemoteList("distributorProfiles", { limit: 50 });
    void refreshRemoteList("accountBindings", { limit: 50 });
    void refreshRemoteList("trainingCourses", { limit: 50 });
    void refreshRemoteList("examAttempts", { limit: 50 });
    void refreshRemoteList("agreementSignatures", { limit: 50 });
  }, [refreshRemoteList]);

  const profile = state.distributorProfiles.find((item) => item.displayName === distributorName);
  const accounts = state.accountBindings.filter((item) => item.distributorName === distributorName);
  const attempts = state.examAttempts.filter((item) => item.distributorName === distributorName);
  const signature = state.agreementSignatures.find((item) => item.distributorName === distributorName);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="partner-shell">
      <header className="partner-header-modern">
        <div className="partner-header-inner-modern">
          <div className="partner-header-brand">
            <div className="partner-brand-logo" />
            <div>
              <div className="partner-brand-title">新手入驻与准入进度</div>
              <div className="partner-brand-subtitle">
                <span className="user-tag">{distributorName}</span>
                <span className="dot-divider">·</span>
                <span className="score-tag">我的准入状态：{profile ? <StatusBadge status={profile.onboardingStatus} /> : null}</span>
                <span className="dot-divider">·</span>
                <span className="data-source-tag">{syncStatus === "remote" ? "线上实时" : "本地演示"}</span>
              </div>
            </div>
          </div>
          <div className="partner-header-actions">
            <Link className="button partner-action-btn" href="/partner">
              <ArrowLeft size={14} /> 返回工作台
            </Link>
            <button className="button partner-logout-btn" aria-label="退出" onClick={handleLogout}>
              <LogOut size={15} />
              <span>安全退出</span>
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main-modern">
        <div className="topbar">
          <div>
            <p className="page-kicker">新手准入考核协议流程</p>
            <h1 className="page-title">完成各项准入、考试和协议后即可秒批授权</h1>
            <p className="page-subtitle">
              遵循“众小二”标准的规则考核和独家分发合作协议在线留痕流程。考核通过将获得高信誉底分，确保矩阵安全。
            </p>
          </div>
          {profile ? <StatusBadge status={profile.onboardingStatus} /> : null}
        </div>

        <section className="metrics-grid" style={{ marginBottom: 28 }}>
          <article className="metric-card metric-emerald">
            <div className="metric-label">合伙人信用分</div>
            <div className="metric-value">{profile?.creditScore ?? 100}</div>
            <div className="metric-note">低于 60 分时会暂停新授权与素材下载</div>
          </article>
          <article className="metric-card metric-amber">
            <div className="metric-label">最高规则考试成绩</div>
            <div className="metric-value">{profile?.examScore ?? 0} <span style={{ fontSize: 13, fontWeight: "normal" }}>分</span></div>
            <div className="metric-note">达到 80 分即合格通过考试</div>
          </article>
          <article className="metric-card metric-blue">
            <div className="metric-label">已绑通过媒体账号</div>
            <div className="metric-value">{accounts.filter((i) => i.status === "approved").length} <span style={{ fontSize: 13, fontWeight: "normal" }}>个</span></div>
            <div className="metric-note">累计提交绑定 {accounts.length} 个账号</div>
          </article>
          <article className="metric-card metric-violet">
            <div className="metric-label">正式合作协议签署</div>
            <div className="metric-value">{signature ? "已成功签署" : "待签署"}</div>
            <div className="metric-note">{signature?.version ?? "签署专属协议方可开通提现"}</div>
          </article>
        </section>

        <section className="content-grid">
          <div className="content-card">
            <div className="section-heading-row">
              <h2 className="section-title">🚀 我的五个核心准入步骤</h2>
            </div>
            
            <div className="workflow-steps-modern">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div className="workflow-step-item" key={step.key} style={{ cursor: "default" }}>
                    <div className="step-num">{index + 1}</div>
                    <div className="step-body">
                      <strong>{step.title}</strong>
                      <p>{step.desc}</p>
                      <div className="item-meta" style={{ marginTop: "6px", color: "var(--brand-dark)", fontWeight: "bold" }}>
                        {step.key === "profile"
                          ? `当前填写：${profile?.phone || "未设置手机号"} (微信：${profile?.displayName || "未设置"})`
                          : step.key === "account"
                            ? `已通过绑定的推广账号：${accounts.filter((item) => item.status === "approved").length} 个`
                            : step.key === "training"
                              ? `必修课程：已解锁 ${state.trainingCourses.length} 门核心切片二创指南课`
                              : step.key === "exam"
                                ? `累计答题认证：${attempts.length} 次考试，最高得分：${profile?.examScore ?? 0}分`
                                : signature
                                  ? `✅ 协议：《${signature.templateName}》版本 ${signature.version}`
                                  : "⏳ 签署状态：待在线进行切片合伙人协议电子签署"}
                      </div>
                    </div>
                    
                    <span className={`step-badge ${
                      step.key === "profile" && profile?.phone
                        ? "status-success"
                        : step.key === "account" && accounts.some((i) => i.status === "approved")
                          ? "status-success"
                          : step.key === "training" && state.trainingCourses.length > 0
                            ? "status-success"
                            : step.key === "exam" && (profile?.examScore ?? 0) >= 80
                              ? "status-success"
                              : step.key === "agreement" && signature
                                ? "status-success"
                                : "status-warning"
                    }`}>
                      {step.key === "profile" && profile?.phone
                        ? "已完成"
                        : step.key === "account" && accounts.some((i) => i.status === "approved")
                          ? "已完成"
                          : step.key === "training" && state.trainingCourses.length > 0
                            ? "已完成"
                            : step.key === "exam" && (profile?.examScore ?? 0) >= 80
                              ? "已完成"
                              : step.key === "agreement" && signature
                                ? "已签署"
                                : "进行中"
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="content-card promo-tips-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <h3>💡 新手极速通关向导</h3>
              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                为了方便分发合伙人极速开展带货工作，我们提供了以下一键极速模拟完成准入进度的通道（模拟在真实环境中的相应留痕操作）：
              </p>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button 
                className="button primary-gradient-btn" 
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => updateDistributorOnboarding(distributorName, "training_pending")}
              >
                1. 标记身份与手机资料完成
              </button>
              
              <button 
                className="button primary-gradient-btn" 
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => recordExamAttempt(distributorName, 92)}
              >
                2. 极速模拟考试并获得 92 分
              </button>
              
              <button 
                className="button primary-gradient-btn" 
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => signAgreement(distributorName)}
              >
                3. 在线模拟一键签署授权协议
              </button>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "15px", marginTop: "5px" }}>
              <Link 
                className="button" 
                style={{ width: "100%", justifyContent: "center", background: "var(--panel-soft)", borderColor: "var(--brand)", color: "var(--brand-dark)" }}
                href="/partner/authorizations"
              >
                去申请 IP 授权中心
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
