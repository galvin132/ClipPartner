"use client";

import Link from "next/link";
import {
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  ClipboardList,
  Coins,
  Crown,
  Goal,
  LayoutDashboard,
  LogOut,
  Package,
  Scissors,
  Settings,
  ShieldAlert,
  UserCircle2,
  UserRoundCheck,
  ChevronDown,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { canAccessPath } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: "overview",
    label: "数据大屏",
    items: [
      { href: "/", label: "大盘概览", icon: LayoutDashboard }
    ]
  },
  {
    id: "auth_management",
    label: "用户与授权",
    items: [
      { href: "/admin/ip-talents", label: "IP 达人管理", icon: Crown },
      { href: "/admin/distributors", label: "分发者管理", icon: UserCircle2 },
      { href: "/admin/authorization-pools", label: "授权池管理", icon: Goal },
      { href: "/admin/authorizations", label: "授权审核申请", icon: BadgeCheck }
    ]
  },
  {
    id: "content_distribution",
    label: "内容与分发",
    items: [
      { href: "/admin/materials", label: "素材管理", icon: Boxes },
      { href: "/admin/clip-tasks", label: "切片任务调度", icon: Scissors },
      { href: "/admin/distribution-tasks", label: "分发任务管理", icon: ClipboardList },
      { href: "/admin/products", label: "主推商品库", icon: Package }
    ]
  },
  {
    id: "settlements_ops",
    label: "结算与运营",
    items: [
      { href: "/admin/publish-records", label: "发布核验凭证", icon: ClipboardList },
      { href: "/admin/settlements", label: "佣金结算记录", icon: Coins },
      { href: "/admin/risk", label: "平台风控记录", icon: ShieldAlert },
      { href: "/admin/training", label: "合伙人考试课程", icon: BookOpenCheck }
    ]
  },
  {
    id: "system",
    label: "系统管理",
    items: [
      { href: "/admin/settings", label: "核心接口配置", icon: Settings },
      { href: "/partner", label: "切换到分发者前台", icon: UserRoundCheck }
    ]
  }
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initialOpenGroups: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      if (group.items.some((item) => item.href === active)) {
        initialOpenGroups[group.id] = true;
      }
    });
    return initialOpenGroups;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  // 过滤出当前角色有权限访问的组和菜单项
  const filteredNavGroups = navGroups
    .map((group) => {
      const allowedItems = session
        ? group.items.filter((item) => canAccessPath(session.role, item.href))
        : [];
      return {
        ...group,
        items: allowedItems
      };
    })
    .filter((group) => group.items.length > 0);

  return (
    <AuthGate>
      <div className={`app-shell-container ${mobileMenuOpen ? "mobile-open" : ""}`}>
        {/* 移动端顶部通栏导航 */}
        <header className="mobile-header">
          <div className="brand-block-compact">
            <div className="brand-title-compact">ClipPartner</div>
            <div className="brand-subtitle-compact">分销增长系统</div>
          </div>
          <button 
            className="mobile-menu-toggle" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* 遮罩层，点击关闭移动端侧边栏 */}
        {mobileMenuOpen && (
          <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />
        )}

        <aside className="sidebar-modern">
          <div className="brand-block-modern">
            <div className="brand-logo-glow" />
            <div className="brand-title-modern">ClipPartner</div>
            <div className="brand-subtitle-modern">直播切片分销增长系统</div>
          </div>

          <nav className="nav-group-modern" aria-label="分级导航">
            {filteredNavGroups.map((group) => {
              const isOpen = openGroups[group.id];
              const isGroupActive = group.items.some((item) => item.href === active);

              return (
                <div key={group.id} className="nav-section-modern">
                  <button
                    className={`nav-section-header-modern ${isGroupActive ? "group-active" : ""}`}
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                  >
                    <span>{group.label}</span>
                    <span className="chevron-icon">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>

                  <div className={`nav-section-content-modern ${isOpen ? "expanded" : "collapsed"}`}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isItemActive = active === item.href;
                      return (
                        <Link
                          key={item.href}
                          className={`nav-link-modern ${isItemActive ? "active" : ""}`}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Icon size={16} className="nav-link-icon" />
                          <span className="nav-link-text">{item.label}</span>
                          {isItemActive && <span className="active-indicator" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {session ? (
            <div className="sidebar-user-modern">
              <div className="sidebar-user-main-modern">
                <div className="avatar-placeholder">
                  {session.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="user-info-modern">
                  <div className="sidebar-user-name-modern">{session.displayName}</div>
                  <div className="sidebar-user-role-modern">{session.roleLabel}</div>
                </div>
              </div>
              <button className="sidebar-logout-modern" onClick={handleLogout}>
                <LogOut size={14} /> <span>退出系统</span>
              </button>
            </div>
          ) : null}
        </aside>

        <main className="main-modern">{children}</main>
      </div>
    </AuthGate>
  );
}
