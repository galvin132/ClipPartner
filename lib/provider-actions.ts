import type { ClipTask, PublishRecord, WalletTransaction } from "./domain";
import type { PublishUrlVerificationResult } from "./providers/platform-data-provider";

export function applyPublishVerificationResult(
  record: PublishRecord,
  result: PublishUrlVerificationResult
): PublishRecord {
  if (result.status === "verified") {
    return {
      ...record,
      status: "verified",
      reviewNote: `平台核验通过：${result.reason}`
    };
  }

  if (result.status === "invalid") {
    return {
      ...record,
      status: "invalid",
      reviewNote: `平台核验拦截：${result.reason}`
    };
  }

  return {
    ...record,
    status: "submitted",
    reviewNote: `平台核验待人工复核：${result.reason}`
  };
}

export function buildLocalClipTask(
  input: Pick<ClipTask, "recordingTitle" | "ipName" | "sourcePlatform">,
  providerResult: { taskId: string },
  createdAt: string
): ClipTask {
  return {
    id: providerResult.taskId,
    status: "queued",
    progress: 0,
    outputCount: 0,
    errorMessage: "",
    createdAt,
    ...input
  };
}

export function buildWalletTransactionFromProvider(
  input: Pick<WalletTransaction, "distributorName" | "type" | "amount" | "status" | "source" | "note">,
  providerResult: { paymentId?: string; status?: string },
  id: string,
  createdAt: string
): WalletTransaction {
  return {
    id,
    createdAt,
    ...input,
    source: providerResult.paymentId ?? input.source
  };
}
