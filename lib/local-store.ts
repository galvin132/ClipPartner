"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  authorizationRequests as seedAuthorizationRequests,
  materials as seedMaterials,
  products as seedProducts,
  publishRecords as seedPublishRecords,
  riskRecords as seedRiskRecords,
  settlements as seedSettlements
} from "./mock-data";
import { reportClientIssue } from "./client-observability";
import type {
  AuthorizationRequest,
  AuthorizationStatus,
  Material,
  MaterialStatus,
  Product,
  PublishRecord,
  PublishStatus,
  RiskRecord,
  RiskStatus,
  Settlement
} from "./domain";

const STORAGE_KEY = "clip-partner-mvp-state-v1";

export type ClipPartnerState = {
  authorizationRequests: AuthorizationRequest[];
  materials: Material[];
  products: Product[];
  publishRecords: PublishRecord[];
  settlements: Settlement[];
  riskRecords: RiskRecord[];
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

type ListKind = "authorizationRequests" | "materials" | "products" | "publishRecords" | "settlements" | "riskRecords";

const listEndpoints: Record<ListKind, string> = {
  authorizationRequests: "/authorization-requests",
  materials: "/materials",
  products: "/products",
  publishRecords: "/publish-records",
  settlements: "/settlements",
  riskRecords: "/risk-records"
};

const initialState: ClipPartnerState = {
  authorizationRequests: seedAuthorizationRequests,
  materials: seedMaterials,
  products: seedProducts,
  publishRecords: seedPublishRecords,
  settlements: seedSettlements,
  riskRecords: seedRiskRecords
};

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
}

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

function listQuery(params: ListParams = {}) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 50));
  if (params.offset) search.set("offset", String(params.offset));
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.platform && params.platform !== "all") search.set("platform", params.platform);
  return search.toString();
}

async function apiJson<T>(path: string, init: RequestInit = {}) {
  const base = apiBase();
  if (!base) {
    return null;
  }

  const method = init.method ?? "GET";
  let response: Response;

  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init.headers
      }
    });
  } catch (error) {
    void reportClientIssue("api_error", error instanceof Error ? error.message : "API request failed", {
      severity: "error",
      feature: "remote_api",
      details: {
        method,
        path,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    });
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text();
    void reportClientIssue("api_error", `API ${method} ${path} failed with ${response.status}`, {
      severity: response.status >= 500 ? "error" : "warn",
      feature: "remote_api",
      details: {
        method,
        path,
        status: response.status,
        detail: detail.slice(0, 500)
      }
    });
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

async function apiRequest(path: string, init: RequestInit = {}) {
  return apiJson<ClipPartnerState>(path, init);
}

async function loadRemoteState() {
  const listLimit = 50;

  try {
    const [authorizationRequests, materials, products, publishRecords, settlements, riskRecords] = await Promise.all([
      apiJson<{ authorizationRequests: AuthorizationRequest[]; meta?: ListMeta }>(
        `/authorization-requests?limit=${listLimit}`
      ),
      apiJson<{ materials: Material[]; meta?: ListMeta }>(`/materials?limit=${listLimit}`),
      apiJson<{ products: Product[]; meta?: ListMeta }>(`/products?limit=${listLimit}`),
      apiJson<{ publishRecords: PublishRecord[]; meta?: ListMeta }>(`/publish-records?limit=${listLimit}`),
      apiJson<{ settlements: Settlement[]; meta?: ListMeta }>(`/settlements?limit=${listLimit}`),
      apiJson<{ riskRecords: RiskRecord[]; meta?: ListMeta }>(`/risk-records?limit=${listLimit}`)
    ]);

    if (authorizationRequests && materials && products && publishRecords && settlements && riskRecords) {
      return {
        authorizationRequests: authorizationRequests.authorizationRequests,
        materials: materials.materials,
        products: products.products,
        publishRecords: publishRecords.publishRecords,
        settlements: settlements.settlements,
        riskRecords: riskRecords.riskRecords
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
      `/authorization-requests/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => ({
        ...state,
        authorizationRequests: state.authorizationRequests.map((item) => (item.id === id ? { ...item, status } : item))
      })
    );
  }

  function addAuthorizationRequest(
    input: Pick<AuthorizationRequest, "distributorName" | "socialAccount" | "platform" | "ipName" | "reason">
  ) {
    void syncMutation(
      "/authorization-requests",
      { method: "POST", body: JSON.stringify(input) },
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

  async function uploadRecording(file: File, input: Pick<Material, "title" | "ipName" | "sourcePlatform">) {
    const base = apiBase();
    if (!base) {
      addMaterial({ ...input, productName: "待绑定商品" });
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
      void reportClientIssue("upload_error", "Recording upload failed; local material fallback applied", {
        severity: "error",
        feature: "recording_upload",
        details: {
          fileType: file.type || "application/octet-stream",
          fileSize: file.size
        }
      });
      setSyncStatus("error");
      addMaterial({ ...input, productName: "待绑定商品" });
    }
  }

  function updateMaterialStatus(id: string, status: MaterialStatus) {
    void syncMutation(
      `/materials/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => ({
        ...state,
        materials: state.materials.map((item) => (item.id === id ? { ...item, status } : item))
      })
    );
  }

  function bindMaterialProduct(materialId: string, productId: string) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;

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
      { method: "POST", body: JSON.stringify({ distributorName }) },
      () => {
        const material = state.materials.find((item) => item.id === materialId);
        return {
          ...state,
          materials: state.materials.map((item) =>
            item.id === materialId ? { ...item, claims: item.claims + 1, downloads: item.downloads + 1 } : item
          ),
          publishRecords: [
            {
              id: nextId("PUB"),
              distributorName,
              materialTitle: material?.title ?? "未知素材",
              productName: material?.productName ?? "待选择商品",
              platform: "视频号",
              status: "downloaded",
              submittedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
              gmv: 0,
              commission: 0
            },
            ...state.publishRecords
          ]
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
            ? { ...item, status: "submitted", submittedAt: new Date().toLocaleString("zh-CN", { hour12: false }) }
            : item
        )
      })
    );
  }

  function updatePublishStatus(id: string, status: PublishStatus) {
    void syncMutation(
      `/publish-records/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      () => ({
        ...state,
        publishRecords: state.publishRecords.map((item) =>
          item.id === id ? { ...item, status, submittedAt: new Date().toLocaleString("zh-CN", { hour12: false }) } : item
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
        publishRecords: state.publishRecords.map((item) =>
          item.id === id ? { ...item, gmv, commission, status: "verified" } : item
        )
      })
    );
  }

  function generateSettlement() {
    void syncMutation(
      "/settlements/generate",
      { method: "POST" },
      () => {
        const verifiedRecords = state.publishRecords.filter((item) => item.status === "verified");
        return {
          ...state,
          settlements: [
            {
              id: nextId("SET"),
              distributorName: "本月汇总",
              period: new Date().toISOString().slice(0, 7),
              verifiedPosts: verifiedRecords.length,
              payableCommission: verifiedRecords.reduce((sum, item) => sum + item.commission * 0.5, 0),
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
      () => ({
        ...state,
        riskRecords: state.riskRecords.map((item) => (item.id === id ? { ...item, status } : item))
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
    addMaterial,
    addProduct,
    updateProductStatus,
    uploadRecording,
    updateMaterialStatus,
    bindMaterialProduct,
    claimMaterial,
    submitPublishLink,
    updatePublishStatus,
    importPerformance,
    generateSettlement,
    updateSettlementStatus,
    addRiskRecord,
    updateRiskStatus,
    resetDemoData
  };
}
