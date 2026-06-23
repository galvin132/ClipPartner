export type UserRole = "admin" | "reviewer" | "finance" | "partner";

export type MockUser = {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  roleLabel: string;
  description: string;
};

export type AuthSession = Omit<MockUser, "password"> & {
  authProvider?: "mock" | "supabase";
  accessToken?: string;
  expiresAt?: number;
};

export const mockUsers: MockUser[] = [
  {
    id: "user-admin",
    username: "admin",
    password: "admin123",
    displayName: "平台管理员",
    role: "admin",
    roleLabel: "管理员",
    description: "查看赚钱大屏、IP达人、分发者、素材、任务、风控和结算全链路。"
  },
  {
    id: "user-reviewer",
    username: "reviewer",
    password: "reviewer123",
    displayName: "运营审核",
    role: "reviewer",
    roleLabel: "审核员",
    description: "负责授权审核、素材上架、发布核验、风险处理和IP达人表现追踪。"
  },
  {
    id: "user-finance",
    username: "finance",
    password: "finance123",
    displayName: "财务",
    role: "finance",
    roleLabel: "财务",
    description: "查看成交作品、生成结算单、确认佣金、处理打款和冻结记录。"
  },
  {
    id: "user-partner",
    username: "partner",
    password: "partner123",
    displayName: "周婧",
    role: "partner",
    roleLabel: "分发者",
    description: "查看自己的收益、排名、授权、待回填作品、可领取任务和钱包流水。"
  }
];

const routePermissions: Record<UserRole, string[]> = {
  admin: ["*"],
  reviewer: [
    "/",
    "/admin/ip-talents",
    "/admin/authorizations",
    "/admin/authorization-pools",
    "/admin/distributors",
    "/admin/distribution-tasks",
    "/admin/training",
    "/admin/materials",
    "/admin/clip-tasks",
    "/admin/products",
    "/admin/publish-records",
    "/admin/risk",
    "/admin/settings"
  ],
  finance: ["/", "/admin/publish-records", "/admin/settlements", "/admin/settings"],
  partner: ["/partner", "/partner/accounts", "/partner/onboarding", "/partner/authorizations", "/partner/tasks", "/partner/wallet"]
};

const defaultRoutes: Record<UserRole, string> = {
  admin: "/",
  reviewer: "/admin/authorizations",
  finance: "/admin/settlements",
  partner: "/partner"
};

export function toSession(user: MockUser): AuthSession {
  const { password: _password, ...session } = user;
  return { ...session, authProvider: "mock" };
}

export function authenticateMockUser(username: string, password: string) {
  const normalized = username.trim().toLowerCase();
  const user = mockUsers.find((item) => item.username === normalized && item.password === password);
  return user ? toSession(user) : null;
}

export function canAccessPath(role: UserRole, path: string) {
  const allowed = routePermissions[role];
  if (allowed.includes("*")) return true;
  return allowed.some((route) => (route === "/" ? path === "/" : path === route || path.startsWith(`${route}/`)));
}

export function getDefaultPath(role: UserRole) {
  return defaultRoutes[role];
}
