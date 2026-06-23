"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LogIn } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getDefaultPath, mockUsers } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { session, login, loginAs, isHydrated } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
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

  function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSession = login(username, password);
    if (!nextSession) {
      setError("账号或密码不正确，请使用下方预置测试账号。");
      return;
    }
    setError("");
    goAfterLogin(nextSession);
  }

  function quickLogin(usernameValue: string) {
    const nextSession = loginAs(usernameValue);
    if (nextSession) {
      setError("");
      goAfterLogin(nextSession);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div>
          <p className="page-kicker">ClipPartner 测试登录</p>
          <h1 className="login-title">先用模拟账号跑通完整权限流程</h1>
          <p className="page-subtitle">
            微信 OAuth 和 Supabase Auth 接入前，系统会使用本地模拟会话。后续只需要替换认证 Provider，页面权限和业务流程可以继续沿用。
          </p>
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
            <LogIn size={16} aria-hidden /> 登录
          </button>
        </form>
      </section>

      <section className="login-panel">
        <div className="table-header compact">
          <h2 className="table-title">预置测试账号</h2>
          <span className="badge info">Mock 模式</span>
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
    </main>
  );
}
