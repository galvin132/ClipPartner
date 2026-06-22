import { KeyRound, ServerCog } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getIntegrationReadiness } from "@/lib/integration-config";

export default function SettingsPage() {
  const integrations = getIntegrationReadiness();

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
