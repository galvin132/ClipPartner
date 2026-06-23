"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "./mock-data";
import { apiBase, apiJson, optionalApiJson } from "./api-client";
import { readAppSettings } from "./app-settings";
import { reportClientIssue } from "./client-observability";
import {
  applyPublishVerificationResult,
  buildLocalClipTask,
  buildWalletTransactionFromProvider
} from "./provider-actions";
import { providers } from "./providers";
import { getProductValidity } from "./product-rules";
import type {
  AccountBinding,
  AccountBindingStatus,
  AgreementSignature,
  AuthorizationPool,
  AuthorizationPoolStatus,
  AuthorizationRequest,
  ClipTask,
  ClipTaskStatus,
  AuthorizationStatus,
  CreditScoreEvent,
  DistributorProfile,
  DistributionTask,
  DistributionTaskStatus,
  ExamAttempt,
  FormalAuthorization,
  Material,
  MaterialStatus,
  Notification,
  Product,
  PublishRecord,
  PublishStatus,
  RiskRecord,
  RiskStatus,
  Settlement,
  TaskClaim,
  TaskClaimStatus,
  TrainingCourse,
  WalletTransaction
} from "./domain";

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

type ListMeta = {
  limit: number;
  offset: number;
  count: number;
  nextOffset: number | null;
};

type ListParams = {
  q?: string;
  status?: string;
  platform?: string;
  limit?: number;
  offset?: number;
};

type ListKind =
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

const listEndpoints: Record<ListKind, string> = {
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

const initialState: ClipPartnerState = {
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

function loadLocalState(): ClipPartnerState {
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

function nextId(prefix: string) {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function isSameLocalDay(value: string) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayLocal = new Date().toLocaleDateString("zh-CN");
  return value.startsWith(todayIso) || value.startsWith(todayLocal);
}

function addLocalClipTaskState(
  current: ClipPartnerState,
  input: Pick<ClipTask, "recordingTitle" | "ipName" | "sourcePlatform">,
  providerResult?: { taskId: string }
): ClipPartnerState {
  return {
    ...current,
    clipTasks: [
      buildLocalClipTask(input, providerResult ?? { taskId: nextId("TASK") }, nowText()),
      ...current.clipTasks
    ]
  };
}

function completeLocalClipTaskState(current: ClipPartnerState, id: string): ClipPartnerState {
  const task = current.clipTasks.find((item) => item.id === id);
  if (!task) return current;

  const generatedMaterials: Material[] = Array.from({ length: 3 }, (_, index) => ({
    id: nextId(`CLIP${index + 1}`),
    title: `${task.recordingTitle} - 模拟切片 ${index + 1}`,
    ipName: task.ipName,
    sourcePlatform: task.sourcePlatform,
    liveDate: new Date().toISOString().slice(0, 10),
    duration: index === 0 ? "00:42" : index === 1 ? "01:08" : "00:36",
    tags: ["模拟切片", index === 1 ? "强卖点" : "待标注"],
    productName: "待绑定商品",
    status: "ready",
    claims: 0,
    downloads: 0
  }));

  return {
    ...current,
    clipTasks: current.clipTasks.map((item) =>
      item.id === id ? { ...item, status: "completed", progress: 100, outputCount: generatedMaterials.length, errorMessage: "" } : item
    ),
    materials: [...generatedMaterials, ...current.materials]
  };
}

function updateLocalPublishRecordStatus(record: PublishRecord, status: PublishStatus, products: Product[]): PublishRecord {
  const productValidity = getProductValidity(products, record.productName, record.platform);

  if (status === "verified" && !productValidity.isValid) {
    return {
      ...record,
      status: "invalid",
      submittedAt: nowText(),
      reviewNote: `人工核验拦截：${productValidity.reason}，本条不进入结算。`
    };
  }

  return {
    ...record,
    status,
    submittedAt: nowText(),
    reviewNote:
      status === "invalid"
        ? "人工核验：作品不合规，本条不进入结算。"
        : status === "verified"
          ? "人工核验：账号、商品挂载与作品链接通过。"
          : record.reviewNote
  };
}

function listQuery(params: ListParams = {}) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 50));
  if (params.offset) search.set("offset", String(params.offset));
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.platform && params.platform !== "all") search.set("platform", params.platform);
  return search.toString();
}

async function apiRequest(path: string, init: RequestInit = {}) {
  return apiJson<ClipPartnerState>(path, init);
}

async function loadRemoteState() {
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

export function useClipPartnerStore() {
  const [state, setState] = useState<ClipPartnerState>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"local" | "remote" | "syncing" | "error">("local");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setState(loadLocalState());
      setIsHydrated(true);

      if (!apiBase()) {
        return;
      }

      try {
        setSyncStatus("syncing");
        const remoteState = await loadRemoteState();
        if (remoteState) {
          setState({ ...initialState, ...remoteState });
          setSyncStatus("remote");
        }
      } catch {
        void reportClientIssue("sync_error", "Initial remote state sync failed", {
          severity: "warn",
          feature: "initial_remote_load"
        });
        setSyncStatus("error");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [isHydrated, state]);

  const metrics = useMemo(() => {
    const pendingAuthorizations = state.authorizationRequests.filter((item) => item.status === "pending").length;
    const publishedMaterials = state.materials.filter((item) => item.status === "published").length;
    const submittedRecords = state.publishRecords.filter((item) => item.status === "submitted").length;
    const payable = state.settlements
      .filter((item) => item.status !== "blocked")
      .reduce((sum, item) => sum + item.payableCommission, 0);

    return {
      pendingAuthorizations,
      publishedMaterials,
      submittedRecords,
      payable
    };
  }, [state]);

  async function syncMutation(path: string, init: RequestInit, localFallback: () => ClipPartnerState) {
    try {
      if (apiBase()) {
        setSyncStatus("syncing");
        const remoteState = await apiRequest(path, init);
        if (remoteState) {
          setState({ ...initialState, ...remoteState });
          setSyncStatus("remote");
          return;
        }
      }
      setState(localFallback());
    } catch {
      void reportClientIssue("sync_error", "Remote mutation failed; local fallback applied", {
        severity: "warn",
        feature: "mutation",
        details: {
          path,
          method: init.method ?? "GET"
        }
      });
      setSyncStatus("error");
      setState(localFallback());
    }
  }

  const refreshRemoteList = useCallback(async (kind: ListKind, params: ListParams = {}) => {
    const endpoint = listEndpoints[kind];
    const query = listQuery(params);

    try {
      if (!apiBase()) {
        return null;
      }

      setSyncStatus("syncing");
      const response = await apiJson<Partial<ClipPartnerState> & { meta?: ListMeta }>(`${endpoint}?${query}`);
      const items = response?.[kind];
      if (!items) {
        return null;
      }

      setState((current) => ({ ...current, [kind]: items }));
      setSyncStatus("remote");
      return response.meta ?? null;
    } catch {
      void reportClientIssue("sync_error", "Remote list refresh failed", {
        severity: "warn",
        feature: "list_refresh",
        details: {
          kind,
          endpoint
        }
      });
      setSyncStatus("error");
      return null;
    }
  }, []);

  function updateAuthorizationStatus(id: string, status: AuthorizationStatus) {
    void syncMutation(
      `/admin/authorization-requests/${id}/review`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => {
        const request = state.authorizationRequests.find((item) => item.id === id);
        const existingAuthorization = request
          ? state.formalAuthorizations.some(
              (item) =>
                item.distributorName === request.distributorName &&
                item.ipName === request.ipName &&
                item.socialAccount === request.socialAccount
            )
          : false;
        const nextState: ClipPartnerState = {
          ...state,
          authorizationRequests: state.authorizationRequests.map((item) => (item.id === id ? { ...item, status } : item))
        };

        if (request && status === "approved" && !existingAuthorization) {
          const pool = state.authorizationPools.find(
            (item) => item.ipName === request.ipName && item.platform === request.platform
          );
          return {
            ...nextState,
            formalAuthorizations: [
              {
                id: nextId("AUTH"),
                distributorName: request.distributorName,
                socialAccount: request.socialAccount,
                ipName: request.ipName,
                platform: request.platform,
                status: "approved",
                shareRate: pool?.defaultShareRate ?? readAppSettings().commissionShare,
                dailyClaimLimit: pool?.dailyClaimLimit ?? readAppSettings().dailyClaimLimit,
                startsAt: new Date().toISOString().slice(0, 10),
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                agreementVersion: "2026.06"
              },
              ...state.formalAuthorizations
            ],
            authorizationPools: pool
              ? state.authorizationPools.map((item) =>
                  item.id === pool.id ? { ...item, usedQuota: Math.min(item.totalQuota, item.usedQuota + 1) } : item
                )
              : state.authorizationPools,
            distributorProfiles: state.distributorProfiles.map((item) =>
              item.displayName === request.distributorName
                ? {
                    ...item,
                    onboardingStatus: "ready_for_authorization",
                    authorizationCount: item.authorizationCount + 1
                  }
                : item
            )
          };
        }

        return nextState;
      }
    );
  }

  function addAuthorizationRequest(
    input: Pick<AuthorizationRequest, "distributorName" | "socialAccount" | "platform" | "ipName" | "reason">
  ) {
    const { distributorName: _distributorName, ...remoteInput } = input;
    void _distributorName;
    void syncMutation(
      "/authorization-requests",
      { method: "POST", body: JSON.stringify(remoteInput) },
      () => ({
        ...state,
        authorizationRequests: [
          {
            id: nextId("AR"),
            phone: "待绑定",
            status: "pending",
            appliedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
            ...input
          },
          ...state.authorizationRequests
        ]
      })
    );
  }

  function addAccountBinding(
    input: Pick<
      AccountBinding,
      "distributorName" | "platform" | "accountName" | "homepageUrl" | "followers" | "category" | "note"
    >
  ) {
    const { distributorName: _distributorName, ...remoteInput } = input;
    void _distributorName;
    void syncMutation(
      "/account-bindings",
      { method: "POST", body: JSON.stringify(remoteInput) },
      () => ({
        ...state,
        accountBindings: [
          {
            id: nextId("ACCT"),
            status: "pending",
            boundAt: new Date().toLocaleString("zh-CN", { hour12: false }),
            ...input
          },
          ...state.accountBindings
        ]
      })
    );
  }

  function updateAccountBindingStatus(id: string, status: AccountBindingStatus) {
    void syncMutation(
      `/account-bindings/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => ({
        ...state,
        accountBindings: state.accountBindings.map((item) => (item.id === id ? { ...item, status } : item))
      })
    );
  }

  function updateDistributorOnboarding(distributorName: string, onboardingStatus: DistributorProfile["onboardingStatus"]) {
    void syncMutation(
      "/partner/profile",
      { method: "POST", body: JSON.stringify({ onboardingStatus }) },
      () => ({
        ...state,
        distributorProfiles: state.distributorProfiles.map((item) =>
          item.displayName === distributorName ? { ...item, onboardingStatus } : item
        )
      })
    );
  }

  function recordExamAttempt(distributorName: string, score: number) {
    const passed = score >= 80;
    void syncMutation(
      "/partner/exam-attempts",
      { method: "POST", body: JSON.stringify({ score }) },
      () => ({
        ...state,
        examAttempts: [
          {
            id: nextId("EXAM"),
            distributorName,
            score,
            passed,
            attemptedAt: nowText()
          },
          ...state.examAttempts
        ],
        distributorProfiles: state.distributorProfiles.map((item) =>
          item.displayName === distributorName
            ? {
                ...item,
                examScore: score,
                onboardingStatus: passed ? "agreement_pending" : "exam_failed"
              }
            : item
        )
      })
    );
  }

  function signAgreement(distributorName: string) {
    void syncMutation(
      "/partner/agreements/sign",
      { method: "POST", body: JSON.stringify({}) },
      () => ({
      ...state,
      agreementSignatures: [
        {
          id: nextId("SIGN"),
          distributorName,
          templateName: "直播切片授权合作协议",
          version: "2026.06",
          signedAt: nowText()
        },
        ...state.agreementSignatures
      ],
      distributorProfiles: state.distributorProfiles.map((item) =>
        item.displayName === distributorName
          ? {
              ...item,
              agreementSigned: true,
              onboardingStatus: "ready_for_authorization"
            }
          : item
      )
      })
    );
  }

  function addAuthorizationPool(
    input: Pick<
      AuthorizationPool,
      "ipName" | "platform" | "totalQuota" | "minCreditScore" | "defaultShareRate" | "dailyClaimLimit" | "requirement"
    >
  ) {
    void syncMutation(
      "/admin/authorization-pools",
      { method: "POST", body: JSON.stringify(input) },
      () => ({
        ...state,
        authorizationPools: [
          {
            id: nextId("POOL"),
            status: "open",
            usedQuota: 0,
            ...input
          },
          ...state.authorizationPools
        ]
      })
    );
  }

  function updateAuthorizationPoolStatus(id: string, status: AuthorizationPoolStatus) {
    void syncMutation(
      `/admin/authorization-pools/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => ({
        ...state,
        authorizationPools: state.authorizationPools.map((item) => (item.id === id ? { ...item, status } : item))
      })
    );
  }

  function addMaterial(input: Pick<Material, "title" | "ipName" | "sourcePlatform" | "productName">) {
    void syncMutation(
      "/materials",
      { method: "POST", body: JSON.stringify(input) },
      () => ({
        ...state,
        materials: [
          {
            id: nextId("CLIP"),
            liveDate: new Date().toISOString().slice(0, 10),
            duration: "待切片",
            tags: ["待标注"],
            status: "processing",
            claims: 0,
            downloads: 0,
            ...input
          },
          ...state.materials
        ]
      })
    );
  }

  function addClipTask(input: Pick<ClipTask, "recordingTitle" | "ipName" | "sourcePlatform">) {
    void (async () => {
      const providerResult = await providers.video.createClipTask(input);
      await syncMutation(
        "/clip-tasks",
        { method: "POST", body: JSON.stringify(input) },
        () => addLocalClipTaskState(state, input, providerResult)
      );
    })();
  }

  function updateClipTaskStatus(id: string, status: ClipTaskStatus) {
    void syncMutation(
      `/clip-tasks/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => ({
        ...state,
        clipTasks: state.clipTasks.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                progress: status === "processing" ? Math.max(item.progress, 35) : item.progress,
                errorMessage: status === "failed" ? "模拟失败：等待重新处理。" : ""
              }
            : item
        )
      })
    );
  }

  function completeClipTask(id: string) {
    void syncMutation(
      `/clip-tasks/${id}/complete`,
      { method: "POST" },
      () => completeLocalClipTaskState(state, id)
    );
  }

  function addProduct(input: Pick<Product, "name" | "platform" | "affiliateUrl" | "commissionRate">) {
    void syncMutation(
      "/products",
      { method: "POST", body: JSON.stringify(input) },
      () => ({
        ...state,
        products: [
          {
            id: nextId("PROD"),
            isActive: true,
            materialCount: 0,
            createdAt: new Date().toISOString().slice(0, 10),
            ...input
          },
          ...state.products
        ]
      })
    );
  }

  function updateProductStatus(id: string, isActive: boolean) {
    void syncMutation(
      `/products/${id}`,
      { method: "PATCH", body: JSON.stringify({ isActive }) },
      () => ({
        ...state,
        products: state.products.map((item) => (item.id === id ? { ...item, isActive } : item))
      })
    );
  }

  function addDistributionTask(
    input: Pick<
      DistributionTask,
      "title" | "ipName" | "platform" | "productName" | "materialIds" | "endAt" | "rewardRule" | "claimLimit" | "requirement"
    >
  ) {
    void syncMutation(
      "/admin/distribution-tasks",
      { method: "POST", body: JSON.stringify(input) },
      () => ({
        ...state,
        distributionTasks: [
          {
            id: nextId("DT"),
            status: "open",
            startAt: new Date().toISOString().slice(0, 10),
            claimedCount: 0,
            publishedCount: 0,
            ...input
          },
          ...state.distributionTasks
        ]
      })
    );
  }

  function updateDistributionTaskStatus(id: string, status: DistributionTaskStatus) {
    void syncMutation(
      `/admin/distribution-tasks/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => ({
        ...state,
        distributionTasks: state.distributionTasks.map((item) => (item.id === id ? { ...item, status } : item))
      })
    );
  }

  async function uploadRecording(file: File, input: Pick<Material, "title" | "ipName" | "sourcePlatform">) {
    const base = apiBase();
    if (!base) {
      setState((current) =>
        addLocalClipTaskState(current, {
          recordingTitle: input.title,
          ipName: input.ipName,
          sourcePlatform: input.sourcePlatform
        })
      );
      return;
    }

    try {
      setSyncStatus("syncing");
      try {
        const init = await apiJson<{
          upload: {
            uploadId: string;
            key: string;
            uploadUrl: string;
            method: "PUT";
            headers: Record<string, string>;
          };
        }>("/recordings/direct-upload/init", {
          method: "POST",
          body: JSON.stringify({
            ...input,
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size
          })
        });

        if (init?.upload) {
          const uploadResponse = await fetch(init.upload.uploadUrl, {
            method: init.upload.method,
            headers: init.upload.headers,
            body: file
          });
          if (!uploadResponse.ok) {
            throw new Error(await uploadResponse.text());
          }

          const remoteState = await apiJson<ClipPartnerState>("/recordings/direct-upload/complete", {
            method: "POST",
            body: JSON.stringify({
              uploadId: init.upload.uploadId,
              key: init.upload.key,
              ...input
            })
          });
          if (remoteState) {
            setState({ ...initialState, ...remoteState });
            setSyncStatus("remote");
            return;
          }
        }
      } catch {
        void reportClientIssue("upload_error", "Direct upload failed; falling back to form upload", {
          severity: "warn",
          feature: "recording_direct_upload",
          details: {
            fileType: file.type || "application/octet-stream",
            fileSize: file.size
          }
        });
        // Direct upload may be unavailable in local/dev until R2 S3 credentials are configured.
      }

      const form = new FormData();
      form.append("file", file);
      form.append("title", input.title);
      form.append("ipName", input.ipName);
      form.append("sourcePlatform", input.sourcePlatform);

      const response = await fetch(`${base}/recordings/upload`, {
        method: "POST",
        body: form
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setState((await response.json()) as ClipPartnerState);
      setSyncStatus("remote");
    } catch {
      void reportClientIssue("upload_error", "Recording upload failed; local clip task fallback applied", {
        severity: "error",
        feature: "recording_upload",
        details: {
          fileType: file.type || "application/octet-stream",
          fileSize: file.size
        }
      });
      setSyncStatus("error");
      setState((current) =>
        addLocalClipTaskState(current, {
          recordingTitle: input.title,
          ipName: input.ipName,
          sourcePlatform: input.sourcePlatform
        })
      );
    }
  }

  function updateMaterialStatus(id: string, status: MaterialStatus) {
    void syncMutation(
      `/materials/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => {
        const material = state.materials.find((item) => item.id === id);
        if (material && status === "published") {
          const productValidity = getProductValidity(state.products, material.productName, material.sourcePlatform);
          if (!productValidity.isValid) {
            return state;
          }
        }

        return {
          ...state,
          materials: state.materials.map((item) => (item.id === id ? { ...item, status } : item))
        };
      }
    );
  }

  function bindMaterialProduct(materialId: string, productId: string) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const productValidity = getProductValidity(state.products, product.name, product.platform);
    if (!productValidity.isValid) return;

    void syncMutation(
      `/materials/${materialId}/product`,
      { method: "POST", body: JSON.stringify({ productId }) },
      () => ({
        ...state,
        materials: state.materials.map((item) =>
          item.id === materialId ? { ...item, productName: product.name } : item
        ),
        products: state.products.map((item) => {
          const material = state.materials.find((current) => current.id === materialId);
          if (item.id === productId && material?.productName !== product.name) {
            return { ...item, materialCount: item.materialCount + 1 };
          }
          if (material?.productName === item.name && item.id !== productId) {
            return { ...item, materialCount: Math.max(0, item.materialCount - 1) };
          }
          return item;
        })
      })
    );
  }

  function claimMaterial(materialId: string, distributorName = "周婧") {
    void syncMutation(
      `/materials/${materialId}/claim`,
      { method: "POST", body: JSON.stringify({}) },
      () => {
        const material = state.materials.find((item) => item.id === materialId);
        if (!material) return state;

        const productValidity = getProductValidity(state.products, material.productName, material.sourcePlatform);
        const settings = readAppSettings();
        const hasApprovedAuthorization = state.authorizationRequests.some(
          (item) => item.distributorName === distributorName && item.ipName === material.ipName && item.status === "approved"
        );
        const hasApprovedAccount = state.accountBindings.some(
          (item) => item.distributorName === distributorName && item.platform === material.sourcePlatform && item.status === "approved"
        );
        const todayClaimCount = state.publishRecords.filter(
          (record) => record.distributorName === distributorName && isSameLocalDay(record.submittedAt)
        ).length;

        if (
          material.status !== "published" ||
          !productValidity.isValid ||
          !hasApprovedAuthorization ||
          !hasApprovedAccount ||
          todayClaimCount >= settings.dailyClaimLimit
        ) {
          return state;
        }

        return {
          ...state,
          materials: state.materials.map((item) =>
            item.id === materialId ? { ...item, claims: item.claims + 1, downloads: item.downloads + 1 } : item
          ),
          publishRecords: [
            {
              id: nextId("PUB"),
              distributorName,
              materialTitle: material.title,
              productName: material.productName,
              platform: material.sourcePlatform,
              status: "downloaded",
              submittedAt: nowText(),
              publishUrl: "",
              reviewNote: "已领取素材，等待分发者回填作品链接。",
              gmv: 0,
              commission: 0
            },
            ...state.publishRecords
          ]
        };
      }
    );
  }

  function claimDistributionTask(taskId: string, distributorName = "周婧") {
    void syncMutation(
      `/partner/tasks/${taskId}/claim`,
      { method: "POST", body: JSON.stringify({}) },
      () => {
      const task = state.distributionTasks.find((item) => item.id === taskId);
      if (!task || task.status !== "open" || task.claimedCount >= task.claimLimit) return state;

      const distributor = state.distributorProfiles.find((item) => item.displayName === distributorName);
      const authorization = state.formalAuthorizations.find(
        (item) =>
          item.distributorName === distributorName &&
          item.ipName === task.ipName &&
          item.platform === task.platform &&
          item.status === "approved"
      );
      const account = state.accountBindings.find(
        (item) => item.distributorName === distributorName && item.platform === task.platform && item.status === "approved"
      );
      const productValidity = getProductValidity(state.products, task.productName, task.platform);
      const material = state.materials.find((item) => task.materialIds.includes(item.id) && item.status === "published");

      if (!distributor || distributor.creditScore < 60 || !authorization || !account || !productValidity.isValid || !material) {
        return state;
      }

      const claim: TaskClaim = {
        id: nextId("CLAIM"),
        taskId,
        distributorName,
        socialAccount: account.accountName,
        materialTitle: material.title,
        productName: task.productName,
        platform: task.platform,
        status: "downloaded",
        claimToken: nextId("CP-CLAIM"),
        downloadExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toLocaleString("zh-CN", { hour12: false }),
        claimedAt: nowText()
      };

      return {
        ...state,
        distributionTasks: state.distributionTasks.map((item) =>
          item.id === taskId ? { ...item, claimedCount: item.claimedCount + 1 } : item
        ),
        taskClaims: [claim, ...state.taskClaims],
        materials: state.materials.map((item) =>
          item.id === material.id ? { ...item, claims: item.claims + 1, downloads: item.downloads + 1 } : item
        ),
        publishRecords: [
          {
            id: nextId("PUB"),
            distributorName,
            materialTitle: material.title,
            productName: task.productName,
            platform: task.platform,
            status: "downloaded",
            submittedAt: nowText(),
            publishUrl: "",
            reviewNote: `任务领取 ${task.title}，下载凭证 ${claim.claimToken}，等待回填作品链接。`,
            gmv: 0,
            commission: 0
          },
          ...state.publishRecords
        ]
      };
      }
    );
  }

  function updateTaskClaimStatus(id: string, status: TaskClaimStatus) {
    setState((current) => ({
      ...current,
      taskClaims: current.taskClaims.map((item) => (item.id === id ? { ...item, status } : item))
    }));
  }

  function submitTaskClaim(id: string, publishUrl: string) {
    void syncMutation(
      `/claims/${id}/submit`,
      { method: "POST", body: JSON.stringify({ publishUrl }) },
      () => {
      const claim = state.taskClaims.find((item) => item.id === id);
      if (!claim) return state;

      return {
        ...state,
        taskClaims: state.taskClaims.map((item) =>
          item.id === id ? { ...item, status: "submitted", submittedUrl: publishUrl } : item
        ),
        distributionTasks: state.distributionTasks.map((item) =>
          item.id === claim.taskId ? { ...item, publishedCount: item.publishedCount + 1 } : item
        ),
        publishRecords: state.publishRecords.map((record) =>
          record.distributorName === claim.distributorName &&
          record.materialTitle === claim.materialTitle &&
          record.status === "downloaded"
            ? {
                ...record,
                status: "submitted",
                publishUrl,
                submittedAt: nowText(),
                reviewNote: "任务作品已回填，等待后台核验账号与商品挂载。"
              }
            : record
        )
      };
      }
    );
  }

  function submitPublishLink(recordId: string, publishUrl = "https://example.com/published-work") {
    void syncMutation(
      `/publish-records/${recordId}/submit`,
      { method: "POST", body: JSON.stringify({ publishUrl }) },
      () => ({
        ...state,
        publishRecords: state.publishRecords.map((item) =>
          item.id === recordId
            ? {
                ...item,
                status: "submitted",
                publishUrl,
                reviewNote: publishUrl.includes("valid")
                  ? "链接包含 valid，可在后台一键模拟核验通过。"
                  : publishUrl.includes("risk")
                    ? "链接包含 risk，可在后台一键进入风控。"
                    : "已回填作品链接，等待人工核验。",
                submittedAt: new Date().toLocaleString("zh-CN", { hour12: false })
              }
            : item
        )
      })
    );
  }

  function autoReviewPublishRecord(id: string) {
    void (async () => {
      const record = state.publishRecords.find((item) => item.id === id);
      if (!record) return;
      const providerResult = await providers.platformData.verifyPublishUrl({
        publishUrl: record.publishUrl ?? "",
        productName: record.productName,
        platform: record.platform
      });

      setState((current) => {
      const record = current.publishRecords.find((item) => item.id === id);
      if (!record) return current;

      const url = record.publishUrl ?? "";
      const settings = readAppSettings();
      const productValidity = getProductValidity(current.products, record.productName, record.platform);
      const reviewText = [url, record.materialTitle, record.productName, record.reviewNote ?? ""].join(" ").toLowerCase();
      const hasRiskKeyword = settings.riskKeywords.some((keyword) => reviewText.includes(keyword.toLowerCase()));

      if (!productValidity.isValid) {
        return {
          ...current,
          publishRecords: current.publishRecords.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "invalid",
                  reviewNote: `模拟核验：${productValidity.reason}，本条不进入结算。`
                }
              : item
          )
        };
      }

      if (hasRiskKeyword) {
        return {
          ...current,
          publishRecords: current.publishRecords.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "invalid",
                  reviewNote: `模拟核验：命中风控关键字，已标记不合规并生成风控线索。`
                }
              : item
          ),
          riskRecords: [
            {
              id: nextId("RISK"),
              platform: record.platform,
              account: record.distributorName,
              issue: `作品核验异常：${record.materialTitle}`,
              workUrl: url || "https://example.com/risk-work",
              status: "open",
              createdAt: new Date().toLocaleString("zh-CN", { hour12: false })
            },
            ...current.riskRecords
          ]
        };
      }

      if (providerResult.status !== "manual_review") {
        return {
          ...current,
          publishRecords: current.publishRecords.map((item) =>
            item.id === id ? applyPublishVerificationResult(item, providerResult) : item
          )
        };
      }

      return {
        ...current,
        publishRecords: current.publishRecords.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "submitted",
                reviewNote: "模拟核验：未命中自动规则，保留人工待审核。"
              }
            : item
        )
      };
    });
    })();
  }

  function updatePublishStatus(id: string, status: PublishStatus) {
    void syncMutation(
      `/publish-records/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => ({
        ...state,
        publishRecords: state.publishRecords.map((item) =>
          item.id === id ? updateLocalPublishRecordStatus(item, status, state.products) : item
        )
      })
    );
  }

  function importPerformance(id: string, gmv: number, commission: number) {
    void syncMutation(
      `/publish-records/${id}/performance`,
      { method: "POST", body: JSON.stringify({ gmv, commission }) },
      () => ({
        ...state,
        publishRecords: state.publishRecords.map((item) => {
          if (item.id !== id) return item;
          const productValidity = getProductValidity(state.products, item.productName, item.platform);
          if (!productValidity.isValid || item.status === "invalid") {
            return {
              ...item,
              gmv,
              commission,
              status: "invalid",
              reviewNote: item.status === "invalid" ? item.reviewNote : `表现数据已导入，但${productValidity.reason}，不进入结算。`
            };
          }

          return { ...item, gmv, commission, status: "verified" };
        })
      })
    );
  }

  function generateSettlement() {
    void syncMutation(
      "/settlements/generate",
      { method: "POST" },
      () => {
        const shareRate = readAppSettings().commissionShare / 100;
        const verifiedRecords = state.publishRecords.filter(
          (item) => item.status === "verified" && getProductValidity(state.products, item.productName, item.platform).isValid
        );
        return {
          ...state,
          settlements: [
            {
              id: nextId("SET"),
              distributorName: "本月汇总",
              period: new Date().toISOString().slice(0, 7),
              verifiedPosts: verifiedRecords.length,
              payableCommission: verifiedRecords.reduce((sum, item) => sum + item.commission * shareRate, 0),
              status: "pending"
            },
            ...state.settlements
          ]
        };
      }
    );
  }

  function updateSettlementStatus(id: string, status: Settlement["status"]) {
    void syncMutation(
      `/settlements/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => ({
        ...state,
        settlements: state.settlements.map((item) => (item.id === id ? { ...item, status } : item))
      })
    );
  }

  function addRiskRecord(input: Pick<RiskRecord, "platform" | "account" | "issue" | "workUrl">) {
    void syncMutation(
      "/risk-records",
      { method: "POST", body: JSON.stringify(input) },
      () => ({
        ...state,
        riskRecords: [
          {
            id: nextId("RISK"),
            status: "open",
            createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
            ...input
          },
          ...state.riskRecords
        ]
      })
    );
  }

  function updateRiskStatus(id: string, status: RiskStatus) {
    void syncMutation(
      `/risk-records/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => {
        const risk = state.riskRecords.find((item) => item.id === id);
        return {
          ...state,
          riskRecords: state.riskRecords.map((item) => (item.id === id ? { ...item, status } : item)),
          creditScoreEvents:
            status === "blocked" && risk
              ? [
                  {
                    id: nextId("CREDIT"),
                    distributorName: risk.account,
                    delta: -30,
                    reason: `风控冻结：${risk.issue}`,
                    createdAt: nowText()
                  },
                  ...state.creditScoreEvents
                ]
              : state.creditScoreEvents,
          distributorProfiles:
            status === "blocked" && risk
              ? state.distributorProfiles.map((item) =>
                  item.displayName === risk.account
                    ? {
                        ...item,
                        creditScore: Math.max(0, item.creditScore - 30),
                        onboardingStatus: item.creditScore - 30 < 60 ? "suspended" : item.onboardingStatus,
                        violationCount: item.violationCount + 1
                      }
                    : item
                )
              : state.distributorProfiles,
          walletTransactions:
            status === "blocked" && risk
              ? [
                  {
                    id: nextId("WT"),
                    distributorName: risk.account,
                    type: "freeze",
                    amount: 0,
                    status: "frozen",
                    source: risk.workUrl,
                    note: `风控冻结：${risk.issue}`,
                    createdAt: nowText()
                  },
                  ...state.walletTransactions
                ]
              : state.walletTransactions,
          settlements:
            status === "blocked" && risk
              ? state.settlements.map((item) =>
                  item.distributorName === risk.account ? { ...item, status: "blocked" } : item
                )
              : state.settlements
        };
      }
    );
  }

  function addWalletTransaction(input: Pick<WalletTransaction, "distributorName" | "type" | "amount" | "status" | "source" | "note">) {
    const { distributorName: _distributorName, ...remoteInput } = input;
    void _distributorName;
    void (async () => {
      const providerResult =
        input.type === "payout"
          ? await providers.payment.createPayoutRecord(input)
          : input.type === "freeze"
            ? await providers.payment.freezeWalletAmount(input)
            : {};
      await syncMutation(
        "/partner/wallet/transactions",
        { method: "POST", body: JSON.stringify(remoteInput) },
        () => ({
          ...state,
          walletTransactions: [
            buildWalletTransactionFromProvider(input, providerResult, nextId("WT"), nowText()),
            ...state.walletTransactions
          ]
        })
      );
    })();
  }

  function markNotificationRead(id: string) {
    void syncMutation(
      `/notifications/${id}/read`,
      { method: "POST" },
      () => ({
        ...state,
        notifications: state.notifications.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      })
    );
  }

  function resetDemoData() {
    void syncMutation("/state/reset", { method: "POST" }, () => initialState);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    state,
    metrics,
    isHydrated,
    syncStatus,
    refreshRemoteList,
    updateAuthorizationStatus,
    addAuthorizationRequest,
    addAccountBinding,
    updateAccountBindingStatus,
    updateDistributorOnboarding,
    recordExamAttempt,
    signAgreement,
    addAuthorizationPool,
    updateAuthorizationPoolStatus,
    addMaterial,
    addClipTask,
    updateClipTaskStatus,
    completeClipTask,
    addProduct,
    updateProductStatus,
    addDistributionTask,
    updateDistributionTaskStatus,
    uploadRecording,
    updateMaterialStatus,
    bindMaterialProduct,
    claimMaterial,
    claimDistributionTask,
    updateTaskClaimStatus,
    submitTaskClaim,
    submitPublishLink,
    autoReviewPublishRecord,
    updatePublishStatus,
    importPerformance,
    generateSettlement,
    updateSettlementStatus,
    addRiskRecord,
    updateRiskStatus,
    addWalletTransaction,
    markNotificationRead,
    resetDemoData
  };
}
