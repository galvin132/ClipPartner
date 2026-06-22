"use client";

import { track } from "@vercel/analytics";

export type ClientIssueType =
  | "app_loaded"
  | "client_error"
  | "unhandled_rejection"
  | "api_error"
  | "api_fallback"
  | "upload_error"
  | "sync_error"
  | "device_issue";

export type ClientIssueSeverity = "info" | "warn" | "error";

type HighEntropyValues = {
  architecture?: string;
  bitness?: string;
  brands?: Array<{ brand: string; version: string }>;
  mobile?: boolean;
  model?: string;
  platform?: string;
  platformVersion?: string;
  uaFullVersion?: string;
};

type UserAgentDataLike = {
  mobile: boolean;
  platform: string;
  brands?: Array<{ brand: string; version: string }>;
  getHighEntropyValues?: (hints: string[]) => Promise<HighEntropyValues>;
};

type ConnectionLike = {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
};

type NavigatorWithClientHints = Navigator & {
  connection?: ConnectionLike;
  deviceMemory?: number;
  userAgentData?: UserAgentDataLike;
};

export type DeviceContext = {
  userAgent: string;
  platform?: string;
  platformVersion?: string;
  browser?: string;
  model?: string;
  mobile?: boolean;
  viewport?: string;
  screen?: string;
  dpr?: number;
  memoryGb?: number;
  connection?: string;
  saveData?: boolean;
  riskTags: string[];
};

const issueEndpoint = "/api/observability/client-issue";

function detectBrowser(userAgent: string) {
  if (/MicroMessenger/i.test(userAgent)) return "WeChat WebView";
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/Chrome\//i.test(userAgent) && /Android/i.test(userAgent)) return "Chrome Android";
  if (/CriOS/i.test(userAgent)) return "Chrome iOS";
  if (/Safari/i.test(userAgent) && /Mobile/i.test(userAgent)) return "Mobile Safari";
  if (/Chrome\//i.test(userAgent)) return "Chrome";
  return "Unknown";
}

function majorVersion(value?: string) {
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function detectRiskTags(device: Omit<DeviceContext, "riskTags">) {
  const tags: string[] = [];
  const userAgent = device.userAgent;
  const platformVersion = majorVersion(device.platformVersion);

  if (/MicroMessenger/i.test(userAgent)) tags.push("wechat_webview");
  if (/Android/i.test(userAgent) && /wv\)/i.test(userAgent)) tags.push("android_system_webview");
  if (/iPhone|iPad/i.test(userAgent) && platformVersion !== null && platformVersion < 16) tags.push("old_ios");
  if (/Android/i.test(userAgent) && platformVersion !== null && platformVersion < 10) tags.push("old_android");
  if (device.memoryGb !== undefined && device.memoryGb <= 4) tags.push("low_memory_device");
  if (device.connection && /2g|slow-2g/i.test(device.connection)) tags.push("slow_network");
  if (device.saveData) tags.push("save_data_enabled");

  return tags;
}

export async function getDeviceContext(): Promise<DeviceContext> {
  const nav = window.navigator as NavigatorWithClientHints;
  const userAgent = nav.userAgent;
  const uaData = nav.userAgentData;
  const highEntropy = await uaData
    ?.getHighEntropyValues?.(["architecture", "bitness", "model", "platform", "platformVersion", "uaFullVersion"])
    .catch(() => undefined);

  const base = {
    userAgent,
    platform: highEntropy?.platform ?? uaData?.platform ?? nav.platform,
    platformVersion: highEntropy?.platformVersion,
    browser: detectBrowser(userAgent),
    model: highEntropy?.model || undefined,
    mobile: highEntropy?.mobile ?? uaData?.mobile ?? /Mobile|Android|iPhone|iPad/i.test(userAgent),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    dpr: window.devicePixelRatio,
    memoryGb: nav.deviceMemory,
    connection: nav.connection?.effectiveType,
    saveData: nav.connection?.saveData
  };

  return {
    ...base,
    riskTags: detectRiskTags(base)
  };
}

function toTrackProperties(device?: DeviceContext, extra?: Record<string, unknown>) {
  return {
    issue_type: String(extra?.issueType ?? ""),
    severity: String(extra?.severity ?? ""),
    route: String(extra?.route ?? window.location.pathname),
    platform: device?.platform ?? "unknown",
    browser: device?.browser ?? "unknown",
    model: device?.model ?? "unknown",
    mobile: String(device?.mobile ?? false),
    risk_tags: device?.riskTags.join(",") ?? "",
    viewport: device?.viewport ?? "unknown"
  };
}

export async function reportClientIssue(
  issueType: ClientIssueType,
  message: string,
  options: {
    severity?: ClientIssueSeverity;
    feature?: string;
    route?: string;
    details?: Record<string, unknown>;
    device?: DeviceContext;
  } = {}
) {
  const severity = options.severity ?? (issueType === "app_loaded" ? "info" : "warn");
  const device = options.device ?? (await getDeviceContext().catch(() => undefined));
  const route = options.route ?? window.location.pathname;

  track(issueType, toTrackProperties(device, { issueType, severity, route }));

  window
    .fetch(issueEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        issueType,
        severity,
        message: message.slice(0, 1000),
        route,
        feature: options.feature,
        details: options.details,
        device
      }),
      keepalive: true
    })
    .catch(() => undefined);
}
