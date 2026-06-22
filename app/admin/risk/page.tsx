import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";

const riskItems = [
  {
    platform: "抖音",
    account: "好物搬运站",
    issue: "疑似未授权搬运晴姐穿搭素材",
    status: "待确认"
  },
  {
    platform: "视频号",
    account: "家居精选合集",
    issue: "作品挂载非平台指定商品链接",
    status: "已警告"
  },
  {
    platform: "抖音",
    account: "凯哥剪货",
    issue: "授权账号发布后删除作品，结算冻结",
    status: "处理中"
  }
];

export default function RiskPage() {
  return (
    <AppShell active="/admin/risk">
      <PageHeader
        kicker="风控记录"
        title="素材出库后仍要可追踪、可处理"
        subtitle="第一版重点做授权前置、领取下载留痕、可见水印、违规记录和结算拦截，后续再升级视频指纹和自动监测。"
        actions={
          <button className="button primary">
            <ShieldAlert size={16} aria-hidden /> 新增违规线索
          </button>
        }
      />

      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">违规线索</h2>
          <span className="badge danger">违规作品不结算</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>平台</th>
              <th>账号</th>
              <th>问题</th>
              <th>处理状态</th>
            </tr>
          </thead>
          <tbody>
            {riskItems.map((item) => (
              <tr key={`${item.platform}-${item.account}`}>
                <td>{item.platform}</td>
                <td>{item.account}</td>
                <td>{item.issue}</td>
                <td>
                  <span className="badge warning">{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
