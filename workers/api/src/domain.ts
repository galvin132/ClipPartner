import type { PlatformValue } from "./query-utils.ts";

export const DOUYIN_LABEL = "\u6296\u97f3";
export const WECHAT_CHANNELS_LABEL = "\u89c6\u9891\u53f7";
export const DEFAULT_DISTRIBUTOR_NAME = "\u5468\u5a67";
export const DEFAULT_AGREEMENT_NAME = "\u76f4\u64ad\u5207\u7247\u6388\u6743\u5408\u4f5c\u534f\u8bae";
export const DEFAULT_AGREEMENT_VERSION = "2026.06";
export const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";
export type PlatformLabel = typeof DOUYIN_LABEL | typeof WECHAT_CHANNELS_LABEL;

export type AuthorizationStatus = "pending" | "approved" | "rejected" | "paused" | "banned" | "expired";
export type MaterialStatus = "draft" | "processing" | "ready" | "published" | "archived";
export type PublishStatus = "claimed" | "downloaded" | "submitted" | "verified" | "invalid" | "settled";
export type SettlementStatus = "pending" | "confirmed" | "paid" | "blocked";
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
export type TaskClaimStatus = "claimed" | "downloaded" | "submitted" | "overdue" | "verified" | "invalid" | "settled";
export type WalletTransactionType = "commission" | "adjustment" | "freeze" | "payout";
export type WalletTransactionStatus = "available" | "frozen" | "pending" | "paid";

export type AuthorizationRequestInput = {
  distributorName?: string;
  socialAccount: string;
  platform: string;
  ipName: string;
  reason: string;
};

export type MaterialInput = {
  title: string;
  ipName: string;
  sourcePlatform: string;
  productName: string;
};

export type ProductInput = {
  name: string;
  platform: string;
  affiliateUrl: string;
  commissionRate: number;
};

export type RiskRecordInput = {
  platform: string;
  account: string;
  issue: string;
  workUrl: string;
};

export type AccountBindingInput = {
  distributorName?: string;
  platform: string;
  accountName: string;
  homepageUrl: string;
  followers: number;
  category: string;
  note?: string;
};

export type ClipTaskInput = {
  recordingTitle: string;
  ipName: string;
  sourcePlatform: string;
};

export const platformToLabel: Record<PlatformValue, PlatformLabel> = {
  douyin: DOUYIN_LABEL,
  wechat_channels: WECHAT_CHANNELS_LABEL
};

export function toPlatformValue(value: string | undefined): PlatformValue {
  if (value === "wechat_channels" || value === WECHAT_CHANNELS_LABEL) return "wechat_channels";
  return "douyin";
}

export function toPlatformLabel(value: string | undefined): PlatformLabel {
  return toPlatformValue(value) === "wechat_channels" ? WECHAT_CHANNELS_LABEL : DOUYIN_LABEL;
}

export function toTaskUiStatus(status: string | undefined): ClipTaskStatus {
  if (status === "running") return "processing";
  if (status === "succeeded") return "completed";
  if (status === "dead") return "failed";
  if (status === "processing" || status === "completed" || status === "failed") return status;
  return "queued";
}

export function toTaskDbStatus(status: ClipTaskStatus) {
  if (status === "processing") return "running";
  if (status === "completed") return "succeeded";
  return status;
}

export function isUsableProduct(product?: {
  is_active?: boolean | null;
  commission_rate?: number | string | null;
  affiliate_url?: string | null;
} | null) {
  const commissionRate = Number(product?.commission_rate ?? 0);
  return Boolean(
    product?.is_active &&
      product.affiliate_url &&
      /^https?:\/\//i.test(product.affiliate_url) &&
      commissionRate > 0 &&
      commissionRate <= 100
  );
}

export function asOnboardingStatus(value: string | null | undefined): OnboardingStatus {
  if (
    value === "registered" ||
    value === "profile_pending" ||
    value === "account_pending" ||
    value === "training_pending" ||
    value === "exam_failed" ||
    value === "agreement_pending" ||
    value === "ready_for_authorization" ||
    value === "suspended" ||
    value === "banned"
  ) {
    return value;
  }
  return "registered";
}
