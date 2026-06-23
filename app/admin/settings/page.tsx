"use client";

import { useEffect, useState } from "react";
import { KeyRound, Save, ServerCog } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { defaultAppSettings, normalizeRiskKeywords, readAppSettings, type RuntimeMode, writeAppSettings } from "@/lib/app-settings";
import { getIntegrationReadiness } from "@/lib/integration-config";

export default function SettingsPage() {
  const integrations = getIntegrationReadiness();
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(defaultAppSettings.runtimeMode);
  const [commissionShare, setCommissionShare] = useState(defaultAppSettings.commissionShare);
  const [dailyClaimLimit, setDailyClaimLimit] = useState(defaultAppSettings.dailyClaimLimit);
  const [riskKeywords, setRiskKeywords] = useState(defaultAppSettings.riskKeywords.join(", "));
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const settings = readAppSettings();
      setRuntimeMode(settings.runtimeMode);
      setCommissionShare(settings.commissionShare);
      setDailyClaimLimit(settings.dailyClaimLimit);
      setRiskKeywords(settings.riskKeywords.join(", "));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function saveLocalRules() {
    writeAppSettings({
      runtimeMode,
      commissionShare,
      dailyClaimLimit,
      riskKeywords: normalizeRiskKeywords(riskKeywords)
    });
    setSavedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
  }

  return (
    <AppShell active="/admin/settings">
      <PageHeader
        kicker="接口配置"
        title="外部接口先预留位置，后续逐个补齐"
        subtitle="当前系统先用本地 mock 状态跑通功能。这里集中列出后续接入 Supabase、微信 OAuth、Cloudflare R2、FFmpeg、抖音 / 视频号和打款接口所需的配置项。"
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
            >
              <option value="mock">Mock 模式：全部外部接口用模拟数据</option>
              <option value="hybrid">混合模式：已配置接口走真实服务，其余模拟</option>
              <option value="real">真实模式：所有关键接口必须配置</option>
            </select>
            <button className="button primary" onClick={saveLocalRules}>
              <Save size={16} aria-hidden /> 保存本地规则
            </button>
          </div>
          <p className="item-meta">
            当前选择：{runtimeMode === "mock" ? "Mock 模式" : runtimeMode === "hybrid" ? "混合模式" : "真实模式"}
            {savedAt ? ` · 已保存 ${savedAt}` : ""}
          </p>
        </div>

        <div className="content-card">
          <h2 className="section-title">业务规则</h2>
          <div className="settings-grid">
            <label>
              <span>分发者佣金分成</span>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={commissionShare}
                onChange={(event) => setCommissionShare(Number(event.target.value))}
              />
            </label>
            <label>
              <span>单账号每日领取上限</span>
              <input
                className="input"
                type="number"
                min={0}
                value={dailyClaimLimit}
                onChange={(event) => setDailyClaimLimit(Number(event.target.value))}
              />
            </label>
            <label className="settings-wide">
              <span>风控关键词</span>
              <input className="input" value={riskKeywords} onChange={(event) => setRiskKeywords(event.target.value)} />
            </label>
          </div>
          <p className="item-meta">
            当前模拟结算规则：平台佣金的 {commissionShare}% 结算给分发者；领取超过 {dailyClaimLimit} 条后需要运营复核。
          </p>
        </div>
      </section>

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">集成配置清单</h2>
          <span className="badge info">参考 .env.example 填写</span>
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
            {integrations.map((item) => (
              <tr key={item.key}>
                <td>
                  <div className="item-title">{item.name}</div>
                  <div className="item-meta">{item.configuredCount} / {item.envKeys.length} 已配置</div>
                </td>
                <td>{item.purpose}</td>
                <td>
                  <span className={item.phase === "MVP 必需" ? "badge warning" : "badge info"}>{item.phase}</span>
                </td>
                <td>
                  <div className="config-list">
                    {item.envKeys.map((envKey) => (
                      <code className="config-key" key={envKey}>
                        <KeyRound size={13} aria-hidden /> {envKey}
                      </code>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={item.isConfigured ? "badge success" : "badge"}>
                    {item.isConfigured ? "已配置" : "待补充"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
