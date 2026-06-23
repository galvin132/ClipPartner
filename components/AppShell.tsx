"use client";

import Link from "next/link";
import {
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  ClipboardList,
  Coins,
  Goal,
  Package,
  Scissors,
  Settings,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  UserCircle2,
  UserRoundCheck
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { canAccessPath } from "@/lib/auth";

const navItems = [
  { href: "/", label: "运营工作台", icon: LayoutDashboard },
  { href: "/admin/distributors", label: "分发者管理", icon: UserCircle2 },
  { href: "/admin/authorization-pools", label: "授权池", icon: Goal },
  { href: "/admin/authorizations", label: "授权审核", icon: BadgeCheck },
  { href: "/admin/distribution-tasks", label: "分发任务", icon: ClipboardList },
  { href: "/admin/training", label: "课程考试", icon: BookOpenCheck },
  { href: "/admin/materials", label: "素材管理", icon: Boxes },
  { href: "/admin/clip-tasks", label: "切片任务", icon: Scissors },
  { href: "/admin/products", label: "商品库", icon: Package },
  { href: "/admin/publish-records", label: "发布核验", icon: ClipboardList },
  { href: "/admin/settlements", label: "佣金结算", icon: Coins },
  { href: "/admin/risk", label: "风控记录", icon: ShieldAlert },
  { href: "/admin/settings", label: "接口配置", icon: Settings },
  { href: "/partner", label: "分发者前台", icon: UserRoundCheck }
];

export function AppShell({
  active,
  children
}: {
  active: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { session, logout } = useAuth();
  const visibleNavItems = session ? navItems.filter((item) => canAccessPath(session.role, item.href)) : [];

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <AuthGate>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <div className="brand-title">ClipPartner</div>
            <div className="brand-subtitle">自有 IP 直播切片授权分发系统</div>
          </div>
          <nav className="nav-group" aria-label="主导航">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  className={`nav-link ${active === item.href ? "active" : ""}`}
                  href={item.href}
                >
                  <Icon size={18} aria-hidden />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          {session ? (
            <div className="sidebar-user">
              <div className="sidebar-user-main">
                <UserCircle2 size={18} aria-hidden />
                <div>
                  <div className="sidebar-user-name">{session.displayName}</div>
                  <div className="sidebar-user-role">{session.roleLabel}</div>
                </div>
              </div>
              <button className="sidebar-logout" onClick={handleLogout}>
                <LogOut size={16} aria-hidden /> 退出登录
              </button>
            </div>
          ) : null}
        </aside>
        <main className="main">{children}</main>
      </div>
    </AuthGate>
  );
}
