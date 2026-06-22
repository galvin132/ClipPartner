export type IntegrationKey =
  | "supabase"
  | "wechatOAuth"
  | "cloudflareR2"
  | "cloudflareQueues"
  | "ffmpegWorker"
  | "douyin"
  | "wechatChannels"
  | "payment";

export type IntegrationConfigItem = {
  key: IntegrationKey;
  name: string;
  purpose: string;
  phase: "MVP 必需" | "后续接入" | "可选增强";
  envKeys: string[];
};

export const integrationConfigs: IntegrationConfigItem[] = [
  {
    key: "supabase",
    name: "Supabase",
    purpose: "用户、授权、素材、发布、结算等业务数据存储和 Auth",
    phase: "MVP 必需",
    envKeys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
  },
  {
    key: "wechatOAuth",
    name: "微信 OAuth",
    purpose: "分发者微信登录与身份绑定",
    phase: "MVP 必需",
    envKeys: ["WECHAT_OAUTH_APP_ID", "WECHAT_OAUTH_APP_SECRET", "WECHAT_OAUTH_REDIRECT_URI"]
  },
  {
    key: "cloudflareR2",
    name: "Cloudflare R2",
    purpose: "直播录屏、切片视频、封面图、证据截图存储",
    phase: "MVP 必需",
    envKeys: [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_R2_BUCKET",
      "CLOUDFLARE_R2_PUBLIC_BASE_URL"
    ]
  },
  {
    key: "cloudflareQueues",
    name: "Cloudflare Queues",
    purpose: "异步切片、转码、数据同步任务队列",
    phase: "后续接入",
    envKeys: ["CLOUDFLARE_QUEUE_NAME"]
  },
  {
    key: "ffmpegWorker",
    name: "FFmpeg 服务",
    purpose: "执行真正的视频切片、转码和水印处理",
    phase: "MVP 必需",
    envKeys: ["FFMPEG_WORKER_ENDPOINT", "FFMPEG_WORKER_TOKEN"]
  },
  {
    key: "douyin",
    name: "抖音开放平台",
    purpose: "后续同步作品数据、播放互动和商品成交数据",
    phase: "后续接入",
    envKeys: ["DOUYIN_APP_ID", "DOUYIN_APP_SECRET"]
  },
  {
    key: "wechatChannels",
    name: "视频号接口",
    purpose: "后续同步视频号作品和互动数据",
    phase: "后续接入",
    envKeys: ["WECHAT_CHANNELS_APP_ID", "WECHAT_CHANNELS_APP_SECRET"]
  },
  {
    key: "payment",
    name: "打款 / 财务接口",
    purpose: "后续自动打款、付款回执和财务对账",
    phase: "可选增强",
    envKeys: ["PAYMENT_PROVIDER", "PAYMENT_API_ENDPOINT", "PAYMENT_API_KEY"]
  }
];

export function getIntegrationReadiness() {
  return integrationConfigs.map((item) => {
    const configuredKeys = item.envKeys.filter((envKey) => Boolean(process.env[envKey]));
    return {
      ...item,
      configuredCount: configuredKeys.length,
      missingKeys: item.envKeys.filter((envKey) => !process.env[envKey]),
      isConfigured: configuredKeys.length === item.envKeys.length
    };
  });
}
