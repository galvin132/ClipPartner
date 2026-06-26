"use client";

import { apiJson } from "./api-client.ts";

const SETTINGS_KEY = "clip-partner-app-settings-v1";
const DAILY_CLAIM_LIMIT_MAX = 10000;

export type RuntimeMode = "mock" | "hybrid" | "real";

export type AppSettings = {
  runtimeMode: RuntimeMode;
  commissionShare: number;
  dailyClaimLimit: number;
  riskKeywords: string[];
};

export const defaultAppSettings: AppSettings = {
  runtimeMode: "mock",
  commissionShare: 50,
  dailyClaimLimit: 10,
  riskKeywords: ["搬运", "非指定商品", "risk"]
};

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

export function normalizeRiskKeywords(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(/[,，\n]/);
  return raw.map((item) => item.trim()).filter(Boolean);
}

export function readAppSettings(): AppSettings {
  if (typeof window === "undefined") {
    return defaultAppSettings;
  }

  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return defaultAppSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      runtimeMode: parsed.runtimeMode === "hybrid" || parsed.runtimeMode === "real" ? parsed.runtimeMode : "mock",
      commissionShare: clampNumber(parsed.commissionShare, defaultAppSettings.commissionShare, 0, 100),
      dailyClaimLimit: clampNumber(parsed.dailyClaimLimit, defaultAppSettings.dailyClaimLimit, 0, DAILY_CLAIM_LIMIT_MAX),
      riskKeywords: normalizeRiskKeywords(parsed.riskKeywords ?? defaultAppSettings.riskKeywords)
    };
  } catch {
    return defaultAppSettings;
  }
}

export function writeAppSettings(settings: AppSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      runtimeMode: settings.runtimeMode,
      commissionShare: clampNumber(settings.commissionShare, defaultAppSettings.commissionShare, 0, 100),
      dailyClaimLimit: clampNumber(settings.dailyClaimLimit, defaultAppSettings.dailyClaimLimit, 0, DAILY_CLAIM_LIMIT_MAX),
      riskKeywords: normalizeRiskKeywords(settings.riskKeywords)
    })
  );
}

function normalizeRemoteSettings(value: unknown): AppSettings | null {
  if (!value || typeof value !== "object") return null;
  const settings = value as Partial<AppSettings>;
  return {
    runtimeMode: settings.runtimeMode === "hybrid" || settings.runtimeMode === "real" ? settings.runtimeMode : "mock",
    commissionShare: clampNumber(settings.commissionShare, defaultAppSettings.commissionShare, 0, 100),
    dailyClaimLimit: clampNumber(settings.dailyClaimLimit, defaultAppSettings.dailyClaimLimit, 0, DAILY_CLAIM_LIMIT_MAX),
    riskKeywords: normalizeRiskKeywords(settings.riskKeywords ?? defaultAppSettings.riskKeywords)
  };
}

export async function readRemoteAppSettings() {
  const payload = await apiJson<{ settings?: unknown }>("/admin/settings");
  return normalizeRemoteSettings(payload?.settings);
}

export async function writeRemoteAppSettings(settings: AppSettings) {
  const payload = await apiJson<{ settings?: unknown }>("/admin/settings", {
    method: "PATCH",
    body: JSON.stringify({
      runtimeMode: settings.runtimeMode,
      commissionShare: settings.commissionShare,
      dailyClaimLimit: settings.dailyClaimLimit,
      riskKeywords: normalizeRiskKeywords(settings.riskKeywords)
    })
  });
  return normalizeRemoteSettings(payload?.settings);
}
