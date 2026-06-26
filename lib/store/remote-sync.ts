"use client";

import { apiJson, optionalApiJson } from "../api-client";
import { reportClientIssue } from "../client-observability";
import type {
  AccountBinding,
  AgreementSignature,
  AuthorizationPool,
  AuthorizationRequest,
  ClipTask,
  CreditScoreEvent,
  DistributorProfile,
  DistributionTask,
  ExamAttempt,
  FormalAuthorization,
  Material,
  Notification,
  Product,
  PublishRecord,
  RiskRecord,
  Settlement,
  TaskClaim,
  TrainingCourse,
  WalletTransaction
} from "../domain";
import type { ClipPartnerState, ListMeta } from "./state";

export async function apiRequest(path: string, init: RequestInit = {}) {
  return apiJson<ClipPartnerState>(path, init);
}

export async function loadRemoteState() {
  const listLimit = 50;

  try {
    const [
      accountBindings,
      authorizationRequests,
      clipTasks,
      materials,
      products,
      publishRecords,
      settlements,
      riskRecords,
      distributorProfiles,
      authorizationPools,
      distributionTasks,
      partnerTasks,
      partnerWallet,
      partnerAuthorizations,
      trainingState,
      notifications
    ] = await Promise.all([
      apiJson<{ accountBindings: AccountBinding[]; meta?: ListMeta }>(`/account-bindings?limit=${listLimit}`),
      apiJson<{ authorizationRequests: AuthorizationRequest[]; meta?: ListMeta }>(
        `/authorization-requests?limit=${listLimit}`
      ),
      apiJson<{ clipTasks: ClipTask[]; meta?: ListMeta }>(`/clip-tasks?limit=${listLimit}`),
      apiJson<{ materials: Material[]; meta?: ListMeta }>(`/materials?limit=${listLimit}`),
      apiJson<{ products: Product[]; meta?: ListMeta }>(`/products?limit=${listLimit}`),
      apiJson<{ publishRecords: PublishRecord[]; meta?: ListMeta }>(`/publish-records?limit=${listLimit}`),
      apiJson<{ settlements: Settlement[]; meta?: ListMeta }>(`/settlements?limit=${listLimit}`),
      apiJson<{ riskRecords: RiskRecord[]; meta?: ListMeta }>(`/risk-records?limit=${listLimit}`),
      optionalApiJson<{ distributorProfiles: DistributorProfile[]; meta?: ListMeta }>(
        `/admin/distributors?limit=${listLimit}`
      ),
      optionalApiJson<{ authorizationPools: AuthorizationPool[]; meta?: ListMeta }>(
        `/admin/authorization-pools?limit=${listLimit}`
      ),
      optionalApiJson<{ distributionTasks: DistributionTask[]; meta?: ListMeta }>(
        `/admin/distribution-tasks?limit=${listLimit}`
      ),
      optionalApiJson<{ distributionTasks: DistributionTask[]; taskClaims: TaskClaim[]; meta?: ListMeta }>(
        `/partner/tasks?limit=${listLimit}`
      ),
      optionalApiJson<{ walletTransactions: WalletTransaction[]; meta?: ListMeta }>(
        `/partner/wallet?limit=${listLimit}`
      ),
      optionalApiJson<{ formalAuthorizations: FormalAuthorization[]; authorizationPools?: AuthorizationPool[]; meta?: ListMeta }>(
        `/partner/authorizations?limit=${listLimit}`
      ),
      optionalApiJson<{
        trainingCourses: TrainingCourse[];
        examAttempts: ExamAttempt[];
        agreementSignatures: AgreementSignature[];
        creditScoreEvents: CreditScoreEvent[];
      }>(`/admin/training?limit=${listLimit}`),
      optionalApiJson<{ notifications: Notification[]; meta?: ListMeta }>(`/notifications?limit=${listLimit}`)
    ]);

    if (
      accountBindings &&
      authorizationRequests &&
      clipTasks &&
      materials &&
      products &&
      publishRecords &&
      settlements &&
      riskRecords
    ) {
      return {
        accountBindings: accountBindings.accountBindings,
        ...(trainingState?.agreementSignatures ? { agreementSignatures: trainingState.agreementSignatures } : {}),
        ...(authorizationPools?.authorizationPools ? { authorizationPools: authorizationPools.authorizationPools } : {}),
        authorizationRequests: authorizationRequests.authorizationRequests,
        ...(trainingState?.creditScoreEvents ? { creditScoreEvents: trainingState.creditScoreEvents } : {}),
        clipTasks: clipTasks.clipTasks,
        ...(distributionTasks?.distributionTasks || partnerTasks?.distributionTasks
          ? { distributionTasks: distributionTasks?.distributionTasks ?? partnerTasks?.distributionTasks ?? [] }
          : {}),
        ...(distributorProfiles?.distributorProfiles ? { distributorProfiles: distributorProfiles.distributorProfiles } : {}),
        ...(trainingState?.examAttempts ? { examAttempts: trainingState.examAttempts } : {}),
        ...(partnerAuthorizations?.formalAuthorizations ? { formalAuthorizations: partnerAuthorizations.formalAuthorizations } : {}),
        materials: materials.materials,
        ...(notifications?.notifications ? { notifications: notifications.notifications } : {}),
        products: products.products,
        publishRecords: publishRecords.publishRecords,
        settlements: settlements.settlements,
        riskRecords: riskRecords.riskRecords,
        ...(partnerTasks?.taskClaims ? { taskClaims: partnerTasks.taskClaims } : {}),
        ...(trainingState?.trainingCourses ? { trainingCourses: trainingState.trainingCourses } : {}),
        ...(partnerWallet?.walletTransactions ? { walletTransactions: partnerWallet.walletTransactions } : {})
      };
    }
  } catch {
    void reportClientIssue("api_fallback", "Remote list endpoint failed; falling back to aggregate state", {
      severity: "warn",
      feature: "initial_remote_load"
    });
    // Fall back to the legacy aggregate endpoint while older Workers are still deployed.
  }

  return apiRequest("/state");
}
