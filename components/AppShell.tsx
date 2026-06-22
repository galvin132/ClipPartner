import Link from "next/link";
import {
  BadgeCheck,
  Boxes,
  ClipboardList,
  Coins,
  Package,
  Settings,
  LayoutDashboard,
  ShieldAlert,
  UserRoundCheck
} from "lucide-react";

const navItems = [
  { href: "/", label: "运营工作台", icon: LayoutDashboard },
  { href: "/admin/authorizations", label: "授权审核", icon: BadgeCheck },
  { href: "/admin/materials", label: "素材管理", icon: Boxes },
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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-title">ClipPartner</div>
          <div className="brand-subtitle">自有 IP 直播切片授权分发系统</div>
        </div>
        <nav className="nav-group" aria-label="主导航">
          {navItems.map((item) => {
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
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
