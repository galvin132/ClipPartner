"use client";

import { useEffect, useMemo, useState } from "react";
import {
  authorizationRequests as seedAuthorizationRequests,
  materials as seedMaterials,
  publishRecords as seedPublishRecords,
  settlements as seedSettlements
} from "./mock-data";
import type {
  AuthorizationRequest,
  AuthorizationStatus,
  Material,
  MaterialStatus,
  PublishRecord,
  PublishStatus,
  Settlement
} from "./domain";

const STORAGE_KEY = "clip-partner-mvp-state-v1";

export type ClipPartnerState = {
  authorizationRequests: AuthorizationRequest[];
  materials: Material[];
  publishRecords: PublishRecord[];
  settlements: Settlement[];
};

const initialState: ClipPartnerState = {
  authorizationRequests: seedAuthorizationRequests,
  materials: seedMaterials,
  publishRecords: seedPublishRecords,
  settlements: seedSettlements
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

async function apiRequest(path: string, init: RequestInit = {}) {
  const base = apiBase();
  if (!base) {
    return null;
  }

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as ClipPartnerState;
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
        const remoteState = await apiRequest("/state");
        if (remoteState) {
          setState(remoteState);
          setSyncStatus("remote");
        }
      } catch {
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
          setState(remoteState);
          setSyncStatus("remote");
          return;
        }
      }
      setState(localFallback());
    } catch {
      setSyncStatus("error");
      setState(localFallback());
    }
  }

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

  function submitPublishLink(recordId: string) {
    void syncMutation(
      `/publish-records/${recordId}/submit`,
      { method: "POST" },
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
    updateAuthorizationStatus,
    addAuthorizationRequest,
    addMaterial,
    updateMaterialStatus,
    claimMaterial,
    submitPublishLink,
    updatePublishStatus,
    importPerformance,
    generateSettlement,
    updateSettlementStatus,
    resetDemoData
  };
}
