export type AuthorizationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paused"
  | "banned"
  | "expired";

export type MaterialStatus = "draft" | "processing" | "ready" | "published" | "archived";

export type PublishStatus =
  | "claimed"
  | "downloaded"
  | "submitted"
  | "verified"
  | "invalid"
  | "settled";

export type Metric = {
  label: string;
  value: string;
  note: string;
  tone?: "success" | "warning" | "danger" | "info";
};

export type AuthorizationRequest = {
  id: string;
  distributorName: string;
  phone: string;
  socialAccount: string;
  platform: "抖音" | "视频号";
  ipName: string;
  status: AuthorizationStatus;
  appliedAt: string;
  reason: string;
};

export type Material = {
  id: string;
  title: string;
  ipName: string;
  sourcePlatform: "抖音" | "视频号";
  liveDate: string;
  duration: string;
  tags: string[];
  productName: string;
  status: MaterialStatus;
  claims: number;
  downloads: number;
};

export type PublishRecord = {
  id: string;
  distributorName: string;
  materialTitle: string;
  productName: string;
  platform: "抖音" | "视频号";
  status: PublishStatus;
  submittedAt: string;
  gmv: number;
  commission: number;
};

export type Settlement = {
  id: string;
  distributorName: string;
  period: string;
  verifiedPosts: number;
  payableCommission: number;
  status: "pending" | "confirmed" | "paid" | "blocked";
};

export const statusLabels: Record<
  AuthorizationStatus | MaterialStatus | PublishStatus | Settlement["status"],
  string
> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  paused: "已暂停",
  banned: "已封禁",
  expired: "已过期",
  draft: "草稿",
  processing: "处理中",
  ready: "待完善",
  published: "可领取",
  archived: "已下架",
  claimed: "已领取",
  downloaded: "已下载",
  submitted: "待审核",
  verified: "已核验",
  invalid: "不合规",
  settled: "已结算",
  confirmed: "已确认",
  paid: "已打款",
  blocked: "已冻结"
};

export function badgeTone(
  status: AuthorizationStatus | MaterialStatus | PublishStatus | Settlement["status"]
) {
  if (["approved", "published", "verified", "paid", "settled"].includes(status)) {
    return "success";
  }

  if (["pending", "processing", "ready", "submitted", "confirmed"].includes(status)) {
    return "warning";
  }

  if (["rejected", "banned", "invalid", "blocked"].includes(status)) {
    return "danger";
  }

  return "info";
}

export function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0
  }).format(value);
}
