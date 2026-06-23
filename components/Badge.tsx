import { badgeTone, statusLabels } from "@/lib/domain";
import type {
  AuthorizationPoolStatus,
  AuthorizationStatus,
  DistributionTaskStatus,
  MaterialStatus,
  OnboardingStatus,
  PublishStatus,
  RiskStatus,
  Settlement,
  TaskClaimStatus
} from "@/lib/domain";

type Status =
  | AuthorizationStatus
  | AuthorizationPoolStatus
  | DistributionTaskStatus
  | MaterialStatus
  | OnboardingStatus
  | PublishStatus
  | RiskStatus
  | Settlement["status"]
  | TaskClaimStatus;

const readableStatusLabels: Partial<Record<Status, string>> = {
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
  submitted: "待核验",
  verified: "已核验",
  invalid: "不合规",
  settled: "已结算",
  confirmed: "已确认",
  paid: "已打款",
  blocked: "已冻结",
  open: "开放",
  warning: "警告",
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

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${badgeTone(status)}`}>{readableStatusLabels[status] ?? statusLabels[status]}</span>;
}
