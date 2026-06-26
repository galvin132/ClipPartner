"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Save, ServerCog, TestTube2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import {
  defaultAppSettings,
  normalizeRiskKeywords,
  readAppSettings,
  readRemoteAppSettings,
  type RuntimeMode,
  writeAppSettings,
  writeRemoteAppSettings
} from "@/lib/app-settings";
import { canEditBackendConfig, isRuntimeModeLocked } from "@/lib/admin-settings-access";
import { apiJson } from "@/lib/api-client";
import { getIntegrationReadiness, integrationConfigs, providerIntegrationConfigs, type ProviderIntegrationKey } from "@/lib/integration-config";

type IntegrationReadiness = ReturnType<typeof getIntegrationReadiness>[number] & {
  enabled?: boolean;
  invalidKeys?: string[];
  lastCheckedAt?: string | null;
  lastCheckStatus?: string | null;
};

type IntegrationDetail = {
  key: ProviderIntegrationKey;
  enabled: boolean;
  publicConfig: Record<string, unknown>;
  secretFields: Record<string, { configured: boolean; fingerprint: string | null }>;
  lastCheckedAt: string | null;
  lastCheckStatus: string | null;
};

type IntegrationDraft = {
  enabled: boolean;
  publicConfig: Record<string, string>;
  secrets: Record<string, string>;
};

function toStringRecord(value: Record<string, unknown> = {}) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === "string" ? item : ""]));
}

function blankDraft(key: ProviderIntegrationKey): IntegrationDraft {
  const config = providerIntegrationConfigs.find((item) => item.key === key);
  return {
    enabled: false,
    publicConfig: Object.fromEntries((config?.publicFields ?? []).map((field) => [field.key, ""])),
    secrets: Object.fromEntries((config?.secretFields ?? []).map((field) => [field.key, ""]))
  };
}

export default function SettingsPage() {
  const { session } = useAuth();
  const canEditConfig = canEditBackendConfig(session?.role);
  const runtimeModeLocked = isRuntimeModeLocked();
  const fallbackIntegrations = useMemo(() => getIntegrationReadiness(), []);
  const [integrations, setIntegrations] = useState<IntegrationReadiness[]>(fallbackIntegrations);
  const [integrationDetails, setIntegrationDetails] = useState<Partial<Record<ProviderIntegrationKey, IntegrationDetail>>>({});
  const [integrationDrafts, setIntegrationDrafts] = useState<Partial<Record<ProviderIntegrationKey, IntegrationDraft>>>({});
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(runtimeModeLocked ? "real" : defaultAppSettings.runtimeMode);
  const [commissionShare, setCommissionShare] = useState(defaultAppSettings.commissionShare);
  const [dailyClaimLimit, setDailyClaimLimit] = useState(defaultAppSettings.dailyClaimLimit);
  const [riskKeywords, setRiskKeywords] = useState(defaultAppSettings.riskKeywords.join(", "));
  const [savedAt, setSavedAt] = useState("");
  const [statusText, setStatusText] = useState("本地配置待同步");

  useEffect(() => {
    let isActive = true;
    const timer = window.setTimeout(async () => {
      const localSettings = readAppSettings();
      setRuntimeMode(runtimeModeLocked ? "real" : localSettings.runtimeMode);
      setCommissionShare(localSettings.commissionShare);
      setDailyClaimLimit(localSettings.dailyClaimLimit);
      setRiskKeywords(localSettings.riskKeywords.join(", "));

      try {
        const [remoteSettings, readinessPayload] = await Promise.all([
          readRemoteAppSettings(),
          apiJson<{ integrations: IntegrationReadiness[] }>("/integrations")
        ]);
        if (!isActive) return;
        if (remoteSettings) {
          setRuntimeMode(runtimeModeLocked ? "real" : remoteSettings.runtimeMode);
          setCommissionShare(remoteSettings.commissionShare);
          setDailyClaimLimit(remoteSettings.dailyClaimLimit);
          setRiskKeywords(remoteSettings.riskKeywords.join(", "));
          writeAppSettings(remoteSettings);
          setStatusText("已连接服务端配置");
        }
        if (readinessPayload?.integrations) {
          setIntegrations(readinessPayload.integrations);
        }
      } catch {
        setStatusText("服务端不可用，使用本地 fallback");
      }

      try {
        const details = await Promise.all(
          providerIntegrationConfigs.map(async (item) => {
            const payload = await apiJson<{ integration: IntegrationDetail }>(`/admin/integrations/${item.key}`);
            return payload?.integration;
          })
        );
        if (!isActive) return;
        const nextDetails: Partial<Record<ProviderIntegrationKey, IntegrationDetail>> = {};
        const nextDrafts: Partial<Record<ProviderIntegrationKey, IntegrationDraft>> = {};
        details.filter(Boolean).forEach((detail) => {
          const integration = detail as IntegrationDetail;
          nextDetails[integration.key] = integration;
          nextDrafts[integration.key] = {
            enabled: integration.enabled,
            publicConfig: {
              ...blankDraft(integration.key).publicConfig,
              ...toStringRecord(integration.publicConfig)
            },
            secrets: blankDraft(integration.key).secrets
          };
        });
        setIntegrationDetails(nextDetails);
        setIntegrationDrafts((current) => ({ ...current, ...nextDrafts }));
      } catch {
        // Readiness still shows env fallback when authenticated admin APIs are unavailable.
      }
    }, 0);
    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [runtimeModeLocked]);

  async function saveRules() {
    if (!canEditConfig) return;
    const settings = {
      runtimeMode: runtimeModeLocked ? "real" : runtimeMode,
      commissionShare,
      dailyClaimLimit,
      riskKeywords: normalizeRiskKeywords(riskKeywords)
    };

    try {
      const remoteSettings = await writeRemoteAppSettings(settings);
      writeAppSettings(remoteSettings ?? settings);
      if (remoteSettings) {
        setRuntimeMode(runtimeModeLocked ? "real" : remoteSettings.runtimeMode);
        setCommissionShare(remoteSettings.commissionShare);
        setDailyClaimLimit(remoteSettings.dailyClaimLimit);
        setRiskKeywords(remoteSettings.riskKeywords.join(", "));
      }
      setStatusText(remoteSettings ? "已保存到服务端配置" : "服务端不可用，已保存本地 fallback");
    } catch {
      writeAppSettings(settings);
      setStatusText("服务端保存失败，已保存本地 fallback");
    }
    setSavedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
  }

  function updateDraft(key: ProviderIntegrationKey, updater: (draft: IntegrationDraft) => IntegrationDraft) {
    if (!canEditConfig) return;
    setIntegrationDrafts((current) => ({
      ...current,
      [key]: updater(current[key] ?? blankDraft(key))
    }));
  }

  async function saveIntegration(key: ProviderIntegrationKey) {
    if (!canEditConfig) return;
    const draft = integrationDrafts[key] ?? blankDraft(key);
    try {
      const payload = await apiJson<{ integration: IntegrationDetail }>(`/admin/integrations/${key}`, {
        method: "PATCH",
        body: JSON.stringify(draft)
      });
      if (payload?.integration) {
        setIntegrationDetails((current) => ({ ...current, [key]: payload.integration }));
        setIntegrationDrafts((current) => ({
          ...current,
          [key]: {
            enabled: payload.integration.enabled,
            publicConfig: {
              ...blankDraft(key).publicConfig,
              ...toStringRecord(payload.integration.publicConfig)
            },
            secrets: blankDraft(key).secrets
          }
        }));
      }
      setStatusText("集成配置已保存");
    } catch (error) {
      setStatusText(error instanceof Error && error.message.includes("config_encryption_not_configured") ? "缺少 CONFIG_ENCRYPTION_KEY，不能保存密钥" : "集成配置保存失败");
    }
  }

  async function testIntegration(key: ProviderIntegrationKey) {
    if (!canEditConfig) return;
    try {
      const payload = await apiJson<{ result: { status: string } }>(`/admin/integrations/${key}/test`, { method: "POST" });
      setStatusText(payload?.result.status === "configured" ? "配置检查通过" : "配置检查未通过，请补齐字段");
    } catch {
      setStatusText("配置检查失败");
    }
  }

  const integrationByKey = new Map(integrations.map((item) => [item.key, item]));

  return (
    <AppShell active="/admin/settings">
      <PageHeader
        kicker="接口配置"
        title="外部接口先预留位置，后续逐个补齐"
        subtitle="后台可维护业务规则和第三方接口绑定；Supabase、R2、Queue、Better Auth 等基础设施仍由部署环境控制。"
        actions={
          <a className="button primary" href="/api/integrations" target="_blank" rel="noreferrer">
            <ServerCog size={16} aria-hidden /> 查看配置状态 API
          </a>
        }
      />

      <section className="content-grid" style={{ marginBottom: 18 }}>
        <div className="content-card">
          <h2 className="section-title">运行模式</h2>
          <div className="filter-bar">
            <select
              className="select"
              value={runtimeMode}
              onChange={(event) => setRuntimeMode(event.target.value as RuntimeMode)}
              aria-label="运行模式"
              disabled={!canEditConfig || runtimeModeLocked}
            >
              <option value="mock">Mock 模式：全部外部接口用模拟数据</option>
              <option value="hybrid">混合模式：已配置接口走真实服务，其余模拟</option>
              <option value="real">真实模式：所有关键接口必须配置</option>
            </select>
            <button className="button primary" onClick={saveRules} disabled={!canEditConfig}>
              <Save size={16} aria-hidden /> 保存规则
            </button>
          </div>
          <p className="item-meta">
            当前选择：{runtimeMode === "mock" ? "Mock 模式" : runtimeMode === "hybrid" ? "混合模式" : "真实模式"}
            {savedAt ? ` · 已保存 ${savedAt}` : ""} · {statusText}
            {!canEditConfig ? " · 当前角色仅可查看" : ""}
            {runtimeModeLocked ? " · 生产环境由部署配置锁定为真实模式" : ""}
          </p>
        </div>

        <div className="content-card">
          <h2 className="section-title">业务规则</h2>
          <div className="settings-grid">
            <label>
              <span>分发者佣金分成</span>
              <input className="input" type="number" min={0} max={100} value={commissionShare} onChange={(event) => setCommissionShare(Number(event.target.value))} disabled={!canEditConfig} />
            </label>
            <label>
              <span>单账号每日领取上限</span>
              <input className="input" type="number" min={0} value={dailyClaimLimit} onChange={(event) => setDailyClaimLimit(Number(event.target.value))} disabled={!canEditConfig} />
            </label>
            <label className="settings-wide">
              <span>风控关键词</span>
              <input className="input" value={riskKeywords} onChange={(event) => setRiskKeywords(event.target.value)} disabled={!canEditConfig} />
            </label>
          </div>
          <p className="item-meta">
            平台佣金的 {commissionShare}% 结算给分发者；领取超过 {dailyClaimLimit} 条后需要运营复核。
          </p>
        </div>
      </section>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">集成配置清单</h2>
          <span className="badge info">密钥仅显示配置状态</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>接口</th>
              <th>用途</th>
              <th>阶段</th>
              <th>配置项</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {integrationConfigs.map((item) => {
              const readiness = integrationByKey.get(item.key) ?? fallbackIntegrations.find((fallback) => fallback.key === item.key);
              const totalCount = readiness?.totalCount ?? item.envKeys.length;
              const hasInvalidKeys = Boolean(readiness?.invalidKeys?.length);
              return (
                <tr key={item.key}>
                  <td>
                    <div className="item-title">{item.name}</div>
                    <div className="item-meta">{readiness?.configuredCount ?? 0} / {totalCount} 已配置</div>
                  </td>
                  <td>{item.purpose}</td>
                  <td>
                    <span className={item.phase === "MVP 必需" ? "badge warning" : "badge info"}>{item.phase}</span>
                  </td>
                  <td>
                    <div className="config-list">
                      {item.envKeys.concat((item.publicFields ?? []).map((field) => field.key), (item.secretFields ?? []).map((field) => field.key)).map((field) => (
                        <code className="config-key" key={field}>
                          <KeyRound size={13} aria-hidden /> {field}
                        </code>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={readiness?.isConfigured ? "badge success" : "badge"}>
                      {readiness?.isConfigured ? "已配置" : hasInvalidKeys ? "格式错误" : "待补充"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="content-grid" style={{ marginTop: 18 }}>
        {providerIntegrationConfigs.map((item) => {
          const detail = integrationDetails[item.key];
          const draft = integrationDrafts[item.key] ?? blankDraft(item.key);
          return (
            <div className="content-card" key={item.key}>
              <div className="table-header">
                <h2 className="section-title">{item.name}</h2>
                <span className={detail?.secretFields && Object.values(detail.secretFields).some((field) => field.configured) ? "badge success" : "badge"}>
                  {detail?.lastCheckStatus ?? "未检查"}
                </span>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => updateDraft(item.key, (current) => ({ ...current, enabled: event.target.checked }))}
                  disabled={!canEditConfig}
                />
                <span>启用此接口</span>
              </label>
              <div className="settings-grid">
                {(item.publicFields ?? []).map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <input
                      className="input"
                      placeholder={field.placeholder}
                      value={draft.publicConfig[field.key] ?? ""}
                      disabled={!canEditConfig}
                      onChange={(event) =>
                        updateDraft(item.key, (current) => ({
                          ...current,
                          publicConfig: { ...current.publicConfig, [field.key]: event.target.value }
                        }))
                      }
                    />
                  </label>
                ))}
                {(item.secretFields ?? []).map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <input
                      className="input"
                      type="password"
                      placeholder={detail?.secretFields[field.key]?.configured ? "已配置，留空不修改" : "待配置"}
                      value={draft.secrets[field.key] ?? ""}
                      disabled={!canEditConfig}
                      onChange={(event) =>
                        updateDraft(item.key, (current) => ({
                          ...current,
                          secrets: { ...current.secrets, [field.key]: event.target.value }
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="filter-bar">
                <button className="button primary" onClick={() => saveIntegration(item.key)} disabled={!canEditConfig}>
                  <Save size={16} aria-hidden /> 保存
                </button>
                <button className="button" onClick={() => testIntegration(item.key)} disabled={!canEditConfig}>
                  <TestTube2 size={16} aria-hidden /> 检查
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </AppShell>
  );
}
