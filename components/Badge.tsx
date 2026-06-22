import { badgeTone, statusLabels } from "@/lib/domain";
import type {
  AuthorizationStatus,
  MaterialStatus,
  PublishStatus,
  Settlement
} from "@/lib/domain";

type Status = AuthorizationStatus | MaterialStatus | PublishStatus | Settlement["status"];

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${badgeTone(status)}`}>{statusLabels[status]}</span>;
}
