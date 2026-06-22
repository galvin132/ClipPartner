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

function loadState(): ClipPartnerState {
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

export function useClipPartnerStore() {
  const [state, setState] = useState<ClipPartnerState>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(loadState());
      setIsHydrated(true);
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

  function updateAuthorizationStatus(id: string, status: AuthorizationStatus) {
    setState((current) => ({
      ...current,
      authorizationRequests: current.authorizationRequests.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    }));
  }

  function addAuthorizationRequest(input: Pick<AuthorizationRequest, "distributorName" | "socialAccount" | "platform" | "ipName" | "reason">) {
    const request: AuthorizationRequest = {
      id: nextId("AR"),
      phone: "待绑定",
      status: "pending",
      appliedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      ...input
    };

    setState((current) => ({
      ...current,
      authorizationRequests: [request, ...current.authorizationRequests]
    }));
  }

  function addMaterial(input: Pick<Material, "title" | "ipName" | "sourcePlatform" | "productName">) {
    const material: Material = {
      id: nextId("CLIP"),
      liveDate: new Date().toISOString().slice(0, 10),
      duration: "待切片",
      tags: ["待标注"],
      status: "processing",
      claims: 0,
      downloads: 0,
      ...input
    };

    setState((current) => ({
      ...current,
      materials: [material, ...current.materials]
    }));
  }

  function updateMaterialStatus(id: string, status: MaterialStatus) {
    setState((current) => ({
      ...current,
      materials: current.materials.map((item) => (item.id === id ? { ...item, status } : item))
    }));
  }

  function claimMaterial(materialId: string, distributorName = "周婧") {
    setState((current) => ({
      ...current,
      materials: current.materials.map((item) =>
        item.id === materialId ? { ...item, claims: item.claims + 1, downloads: item.downloads + 1 } : item
      ),
      publishRecords: [
        {
          id: nextId("PUB"),
          distributorName,
          materialTitle: current.materials.find((item) => item.id === materialId)?.title ?? "未知素材",
          productName: current.materials.find((item) => item.id === materialId)?.productName ?? "待选择商品",
          platform: "视频号",
          status: "downloaded",
          submittedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
          gmv: 0,
          commission: 0
        },
        ...current.publishRecords
      ]
    }));
  }

  function submitPublishLink(recordId: string) {
    updatePublishStatus(recordId, "submitted");
  }

  function updatePublishStatus(id: string, status: PublishStatus) {
    setState((current) => ({
      ...current,
      publishRecords: current.publishRecords.map((item) =>
        item.id === id ? { ...item, status, submittedAt: new Date().toLocaleString("zh-CN", { hour12: false }) } : item
      )
    }));
  }

  function importPerformance(id: string, gmv: number, commission: number) {
    setState((current) => ({
      ...current,
      publishRecords: current.publishRecords.map((item) =>
        item.id === id ? { ...item, gmv, commission, status: "verified" } : item
      )
    }));
  }

  function generateSettlement() {
    const verifiedRecords = state.publishRecords.filter((item) => item.status === "verified");
    const payableCommission = verifiedRecords.reduce((sum, item) => sum + item.commission * 0.5, 0);

    const settlement: Settlement = {
      id: nextId("SET"),
      distributorName: "本月汇总",
      period: new Date().toISOString().slice(0, 7),
      verifiedPosts: verifiedRecords.length,
      payableCommission,
      status: "pending"
    };

    setState((current) => ({
      ...current,
      settlements: [settlement, ...current.settlements]
    }));
  }

  function updateSettlementStatus(id: string, status: Settlement["status"]) {
    setState((current) => ({
      ...current,
      settlements: current.settlements.map((item) => (item.id === id ? { ...item, status } : item))
    }));
  }

  function resetDemoData() {
    setState(initialState);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    state,
    metrics,
    isHydrated,
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
