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

export type RiskStatus = "pending" | "open" | "warning" | "blocked" | "resolved";
export type AccountBindingStatus = "pending" | "approved" | "rejected" | "paused";
export type ClipTaskStatus = "queued" | "processing" | "completed" | "failed";
export type OnboardingStatus =
  | "registered"
  | "profile_pending"
  | "account_pending"
  | "training_pending"
  | "exam_failed"
  | "agreement_pending"
  | "ready_for_authorization"
  | "suspended"
  | "banned";
export type AuthorizationPoolStatus = "open" | "paused" | "full";
export type DistributionTaskStatus = "draft" | "open" | "paused" | "closed";
export type TaskClaimStatus =
  | "claimed"
  | "downloaded"
  | "submitted"
  | "overdue"
  | "verified"
  | "invalid"
  | "settled";
export type WalletTransactionType = "commission" | "adjustment" | "freeze" | "payout";
export type NotificationAudience = "all" | "admin" | "partner";

export type Metric = {
  label: string;
  value: string;
  note: string;
  tone?: "success" | "warning" | "danger" | "info";
};

export type Product = {
  id: string;
  name: string;
  platform: "抖音" | "视频号";
  affiliateUrl: string;
  commissionRate: number;
  isActive: boolean;
  materialCount: number;
  createdAt: string;
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

export type AccountBinding = {
  id: string;
  distributorName: string;
  platform: "抖音" | "视频号";
  accountName: string;
  homepageUrl: string;
  followers: number;
  category: string;
  status: AccountBindingStatus;
  boundAt: string;
  note: string;
  shopWindowStatus?: "unknown" | "open" | "closed";
  riskTag?: string;
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
  coverUrl?: string;
  sellingPoint?: string;
  recommendedCopy?: string;
  forbiddenWords?: string[];
  qualityScore?: number;
  expiresAt?: string;
};

export type ClipTask = {
  id: string;
  recordingTitle: string;
  ipName: string;
  sourcePlatform: "抖音" | "视频号";
  status: ClipTaskStatus;
  progress: number;
  outputCount: number;
  errorMessage: string;
  createdAt: string;
};

export type PublishRecord = {
  id: string;
  distributorName: string;
  materialTitle: string;
  productName: string;
  platform: "抖音" | "视频号";
  status: PublishStatus;
  submittedAt: string;
  publishUrl?: string;
  reviewNote?: string;
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

export type RiskRecord = {
  id: string;
  platform: "抖音" | "视频号";
  account: string;
  issue: string;
  workUrl: string;
  status: RiskStatus;
  createdAt: string;
};

export type DistributorProfile = {
  id: string;
  displayName: string;
  phone: string;
  wechatId: string;
  onboardingStatus: OnboardingStatus;
  creditScore: number;
  examScore: number;
  agreementSigned: boolean;
  accountCount: number;
  authorizationCount: number;
  violationCount: number;
  payableCommission: number;
  createdAt: string;
};

export type AuthorizationPool = {
  id: string;
  ipName: string;
  platform: "抖音" | "视频号";
  status: AuthorizationPoolStatus;
  totalQuota: number;
  usedQuota: number;
  minCreditScore: number;
  defaultShareRate: number;
  dailyClaimLimit: number;
  requirement: string;
};

export type FormalAuthorization = {
  id: string;
  distributorName: string;
  socialAccount: string;
  ipName: string;
  platform: "抖音" | "视频号";
  status: AuthorizationStatus;
  shareRate: number;
  dailyClaimLimit: number;
  startsAt: string;
  expiresAt: string;
  agreementVersion: string;
  pausedReason?: string;
};

export type TrainingCourse = {
  id: string;
  title: string;
  lessonCount: number;
  estimatedMinutes: number;
  isRequired: boolean;
};

export type ExamAttempt = {
  id: string;
  distributorName: string;
  score: number;
  passed: boolean;
  attemptedAt: string;
};

export type AgreementSignature = {
  id: string;
  distributorName: string;
  templateName: string;
  version: string;
  signedAt: string;
};

export type DistributionTask = {
  id: string;
  title: string;
  ipName: string;
  platform: "抖音" | "视频号";
  materialIds: string[];
  productName: string;
  status: DistributionTaskStatus;
  startAt: string;
  endAt: string;
  rewardRule: string;
  claimLimit: number;
  claimedCount: number;
  publishedCount: number;
  requirement: string;
};

export type TaskClaim = {
  id: string;
  taskId: string;
  distributorName: string;
  socialAccount: string;
  materialTitle: string;
  productName: string;
  platform: "抖音" | "视频号";
  status: TaskClaimStatus;
  claimToken: string;
  downloadExpiresAt: string;
  claimedAt: string;
  submittedUrl?: string;
};

export type WalletTransaction = {
  id: string;
  distributorName: string;
  type: WalletTransactionType;
  amount: number;
  status: "available" | "frozen" | "pending" | "paid";
  source: string;
  note: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  audience: NotificationAudience;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
};

export type CreditScoreEvent = {
  id: string;
  distributorName: string;
  delta: number;
  reason: string;
  createdAt: string;
};

export const statusLabels: Record<
  | AuthorizationStatus
  | MaterialStatus
  | PublishStatus
  | Settlement["status"]
  | RiskStatus
  | OnboardingStatus
  | AuthorizationPoolStatus
  | DistributionTaskStatus
  | TaskClaimStatus,
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
  blocked: "已冻结",
  open: "待处理",
  warning: "已警告",
  resolved: "已关闭",
  registered: "已注册",
  profile_pending: "待完善资料",
  account_pending: "账号待审",
  training_pending: "待学习考试",
  exam_failed: "考试未通过",
  agreement_pending: "待签协议",
  ready_for_authorization: "可申请授权",
  suspended: "已暂停",
  full: "名额已满",
  closed: "已关闭",
  overdue: "已逾期"
};

export function badgeTone(
  status:
    | AuthorizationStatus
    | MaterialStatus
    | PublishStatus
    | Settlement["status"]
    | RiskStatus
    | OnboardingStatus
    | AuthorizationPoolStatus
    | DistributionTaskStatus
    | TaskClaimStatus
) {
  if (["approved", "published", "verified", "paid", "settled", "resolved", "ready_for_authorization", "open"].includes(status)) {
    return "success";
  }

  if (
    [
      "pending",
      "processing",
      "ready",
      "submitted",
      "confirmed",
      "open",
      "warning",
      "profile_pending",
      "account_pending",
      "training_pending",
      "agreement_pending",
      "claimed",
      "downloaded",
      "draft"
    ].includes(status)
  ) {
    return "warning";
  }

  if (["rejected", "banned", "invalid", "blocked", "exam_failed", "full", "overdue"].includes(status)) {
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
