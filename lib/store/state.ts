"use client";

import {
  accountBindings as seedAccountBindings,
  agreementSignatures as seedAgreementSignatures,
  authorizationPools as seedAuthorizationPools,
  authorizationRequests as seedAuthorizationRequests,
  clipTasks as seedClipTasks,
  creditScoreEvents as seedCreditScoreEvents,
  distributionTasks as seedDistributionTasks,
  distributorProfiles as seedDistributorProfiles,
  examAttempts as seedExamAttempts,
  formalAuthorizations as seedFormalAuthorizations,
  materials as seedMaterials,
  notifications as seedNotifications,
  products as seedProducts,
  publishRecords as seedPublishRecords,
  riskRecords as seedRiskRecords,
  settlements as seedSettlements,
  taskClaims as seedTaskClaims,
  trainingCourses as seedTrainingCourses,
  walletTransactions as seedWalletTransactions
} from "../mock-data";
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

const STORAGE_KEY = "clip-partner-mvp-state-v1";

export type ClipPartnerState = {
  accountBindings: AccountBinding[];
  agreementSignatures: AgreementSignature[];
  authorizationPools: AuthorizationPool[];
  authorizationRequests: AuthorizationRequest[];
  creditScoreEvents: CreditScoreEvent[];
  clipTasks: ClipTask[];
  distributionTasks: DistributionTask[];
  distributorProfiles: DistributorProfile[];
  examAttempts: ExamAttempt[];
  formalAuthorizations: FormalAuthorization[];
  materials: Material[];
  notifications: Notification[];
  products: Product[];
  publishRecords: PublishRecord[];
  settlements: Settlement[];
  riskRecords: RiskRecord[];
  taskClaims: TaskClaim[];
  trainingCourses: TrainingCourse[];
  walletTransactions: WalletTransaction[];
};

export type ListMeta = {
  limit: number;
  offset: number;
  count: number;
  nextOffset: number | null;
};

export type ListParams = {
  q?: string;
  status?: string;
  platform?: string;
  limit?: number;
  offset?: number;
};

export type ListKind =
  | "accountBindings"
  | "authorizationPools"
  | "authorizationRequests"
  | "clipTasks"
  | "distributionTasks"
  | "distributorProfiles"
  | "examAttempts"
  | "formalAuthorizations"
  | "agreementSignatures"
  | "creditScoreEvents"
  | "materials"
  | "notifications"
  | "products"
  | "publishRecords"
  | "settlements"
  | "riskRecords"
  | "taskClaims"
  | "trainingCourses"
  | "walletTransactions";

export const listEndpoints: Record<ListKind, string> = {
  accountBindings: "/account-bindings",
  authorizationPools: "/admin/authorization-pools",
  authorizationRequests: "/authorization-requests",
  clipTasks: "/clip-tasks",
  distributionTasks: "/admin/distribution-tasks",
  distributorProfiles: "/admin/distributors",
  examAttempts: "/admin/training",
  formalAuthorizations: "/partner/authorizations",
  agreementSignatures: "/admin/training",
  creditScoreEvents: "/admin/training",
  materials: "/materials",
  notifications: "/notifications",
  products: "/products",
  publishRecords: "/publish-records",
  settlements: "/settlements",
  riskRecords: "/risk-records",
  taskClaims: "/partner/tasks",
  trainingCourses: "/admin/training",
  walletTransactions: "/partner/wallet"
};

export const initialState: ClipPartnerState = {
  accountBindings: seedAccountBindings,
  agreementSignatures: seedAgreementSignatures,
  authorizationPools: seedAuthorizationPools,
  authorizationRequests: seedAuthorizationRequests,
  creditScoreEvents: seedCreditScoreEvents,
  clipTasks: seedClipTasks,
  distributionTasks: seedDistributionTasks,
  distributorProfiles: seedDistributorProfiles,
  examAttempts: seedExamAttempts,
  formalAuthorizations: seedFormalAuthorizations,
  materials: seedMaterials,
  notifications: seedNotifications,
  products: seedProducts,
  publishRecords: seedPublishRecords,
  settlements: seedSettlements,
  riskRecords: seedRiskRecords,
  taskClaims: seedTaskClaims,
  trainingCourses: seedTrainingCourses,
  walletTransactions: seedWalletTransactions
};

export function loadLocalState(): ClipPartnerState {
  if (typeof window === "undefined") {
    return initialState;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return initialState;
  }

  try {
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return initialState;
  }
}

export function writeLocalState(state: ClipPartnerState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearLocalState() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function nextId(prefix: string) {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

export function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

export function isSameLocalDay(value: string) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayLocal = new Date().toLocaleDateString("zh-CN");
  return value.startsWith(todayIso) || value.startsWith(todayLocal);
}

export function listQuery(params: ListParams = {}) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 50));
  if (params.offset) search.set("offset", String(params.offset));
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.platform && params.platform !== "all") search.set("platform", params.platform);
  return search.toString();
}
