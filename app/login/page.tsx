"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeDollarSign, LogIn, ShieldCheck, UsersRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getDefaultPath, mockUsers } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { session, login, loginAs, isHydrated } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const isMockLoginEnabled = process.env.NEXT_PUBLIC_RUNTIME_MODE !== "real";
  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("next") || "";
  }, []);

  useEffect(() => {
    if (isHydrated && session) {
      router.replace(nextPath || getDefaultPath(session.role));
    }
  }, [isHydrated, nextPath, router, session]);

  function goAfterLogin(nextSession: NonNullable<typeof session>) {
    router.replace(nextPath || getDefaultPath(nextSession.role));
  }

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSession = await login(username, password);
    if (!nextSession) {
      setError("账号或密码不正确，请使用右侧预置演示账号。");
      return;
    }
    setError("");
    goAfterLogin(nextSession);
  }

  async function quickLogin(usernameValue: string) {
    const nextSession = await loginAs(usernameValue);
    if (nextSession) {
      setError("");
      goAfterLogin(nextSession);
    }
  }

  return (
    <main className="login-shell sales-login-shell">
      <section className="login-panel sales-login-panel">
        <div className="login-visual" aria-hidden />
        <div>
          <p className="page-kicker">ClipPartner 切片分销增长系统</p>
          <h1 className="login-title">让更多授权账号帮你卖货，按结果结算，风险可控。</h1>
          <p className="page-subtitle">
            把直播录屏和IP素材变成可领取、可核验、可结算的分发任务。客户第一眼看到的是GMV、达人排行、爆款素材和风险拦截，而不是一堆后台表格。
          </p>
        </div>

        <div className="login-value-grid">
          <div>
            <BadgeDollarSign size={18} aria-hidden />
            <strong>新增成交</strong>
            <span>让授权分发达人矩阵持续种草带货。</span>
          </div>
          <div>
            <UsersRound size={18} aria-hidden />
            <strong>达人可追踪</strong>
            <span>谁领素材、谁发作品、谁卖得动都能看见。</span>
          </div>
          <div>
            <ShieldCheck size={18} aria-hidden />
            <strong>结算有边界</strong>
            <span>作品先核验，风险先拦截，再进入佣金结算。</span>
          </div>
        </div>

        <form className="login-form" onSubmit={submitLogin}>
          <label>
            <span>账号</span>
            <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            <span>密码</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="button primary" type="submit">
            <LogIn size={16} aria-hidden /> 进入赚钱大屏
          </button>
        </form>
      </section>

      {isMockLoginEnabled ? (
      <section className="login-panel">
        <div className="table-header compact">
          <h2 className="table-title">演示账号</h2>
          <span className="badge info">一键进入</span>
        </div>
        <div className="account-grid">
          {mockUsers.map((user) => (
            <button className="account-card" key={user.id} onClick={() => quickLogin(user.username)}>
              <div>
                <div className="item-title">{user.roleLabel}</div>
                <div className="item-meta">
                  {user.username} / {user.password}
                </div>
                <div className="account-desc">{user.description}</div>
              </div>
              <ArrowRight size={18} aria-hidden />
            </button>
          ))}
        </div>
      </section>
      ) : null}
    </main>
  );
}
