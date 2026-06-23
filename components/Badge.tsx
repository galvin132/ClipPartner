import { badgeTone, statusLabels } from "@/lib/domain";
import type {
  AuthorizationStatus,
  AuthorizationPoolStatus,
  DistributionTaskStatus,
  MaterialStatus,
  OnboardingStatus,
  PublishStatus,
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
  | Settlement["status"]
  | TaskClaimStatus;

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${badgeTone(status)}`}>{statusLabels[status]}</span>;
}
