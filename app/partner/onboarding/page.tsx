"use client";

import Link from "next/link";
import { BadgeCheck, BookOpenCheck, FileSignature, GraduationCap, LogOut, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Badge";
import { useClipPartnerStore } from "@/lib/local-store";

const steps = [
  { key: "profile", title: "资料完善", icon: UserRoundCheck },
  { key: "account", title: "账号审核", icon: BadgeCheck },
  { key: "training", title: "课程学习", icon: BookOpenCheck },
  { key: "exam", title: "规则考试", icon: GraduationCap },
  { key: "agreement", title: "协议签署", icon: FileSignature }
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
  const { state, recordExamAttempt, signAgreement, updateDistributorOnboarding, refreshRemoteList } = useClipPartnerStore();
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
      <header className="partner-header">
        <div className="partner-header-inner">
          <div>
            <div className="brand-title">入驻准入</div>
            <div className="brand-subtitle">{distributorName} · 课程考试、协议和账号审核</div>
          </div>
          <div className="toolbar">
            <Link className="button" href="/partner">
              工作台
            </Link>
            <button className="button" aria-label="退出" onClick={handleLogout}>
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="partner-main">
        <div className="topbar">
          <div>
            <p className="page-kicker">准入进度</p>
            <h1 className="page-title">完成资料、账号、考试和协议后才能申请授权</h1>
            <p className="page-subtitle">
              按众小二类流程先做规则学习和授权协议留痕。当前为可替换模拟流程，后续可接微信、实名和电子签。
            </p>
          </div>
          {profile ? <StatusBadge status={profile.onboardingStatus} /> : null}
        </div>

        <section className="metrics-grid">
          <article className="metric-card">
            <div className="metric-label">信用分</div>
            <div className="metric-value">{profile?.creditScore ?? 100}</div>
            <div className="metric-note">低于 60 将暂停新授权</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">最高考试分</div>
            <div className="metric-value">{profile?.examScore ?? 0}</div>
            <div className="metric-note">80 分及格</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">绑定账号</div>
            <div className="metric-value">{accounts.length}</div>
            <div className="metric-note">需至少一个审核通过账号</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">协议状态</div>
            <div className="metric-value">{signature ? "已签" : "待签"}</div>
            <div className="metric-note">{signature?.version ?? "签署后才可授权"}</div>
          </article>
        </section>

        <section className="content-grid">
          <div className="content-card">
            <h2 className="section-title">准入步骤</h2>
            <div className="workflow">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div className="workflow-row" key={step.key}>
                    <span className="step-index">{index + 1}</span>
                    <div>
                      <div className="step-title">
                        <Icon size={16} aria-hidden /> {step.title}
                      </div>
                      <div className="step-desc">
                        {step.key === "profile"
                          ? profile?.phone ?? "待填写手机号和微信"
                          : step.key === "account"
                            ? `${accounts.filter((item) => item.status === "approved").length} 个账号已通过`
                            : step.key === "training"
                              ? `${state.trainingCourses.length} 门必修课程`
                              : step.key === "exam"
                                ? `${attempts.length} 次考试记录`
                                : signature
                                  ? `${signature.templateName} ${signature.version}`
                                  : "待签署授权合作协议"}
                      </div>
                    </div>
                    <span className="badge info">可模拟</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="content-card">
            <h2 className="section-title">模拟准入动作</h2>
            <div className="workflow">
              <button className="button" onClick={() => updateDistributorOnboarding(distributorName, "training_pending")}>
                标记资料完成
              </button>
              <button className="button" onClick={() => recordExamAttempt(distributorName, 92)}>
                模拟考试 92 分
              </button>
              <button className="button" onClick={() => signAgreement(distributorName)}>
                签署授权协议
              </button>
              <Link className="button primary" href="/partner/authorizations">
                去申请授权
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
