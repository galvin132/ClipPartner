export type InfrastructureIntegrationKey = "supabase" | "cloudflareR2" | "cloudflareQueue" | "r2DirectUpload";
export type ProviderIntegrationKey = "wechat_oauth" | "douyin" | "wechat_channels" | "tencent_identity" | "payment" | "ffmpeg";
export type IntegrationKey = InfrastructureIntegrationKey | ProviderIntegrationKey;

type IntegrationField = {
  key: string;
  label: string;
  placeholder?: string;
};

export type IntegrationConfigItem<K extends IntegrationKey = IntegrationKey> = {
  key: K;
  name: string;
  purpose: string;
  phase: "MVP 必需" | "后续接入" | "可选增强";
  envKeys: string[];
  publicFields?: IntegrationField[];
  secretFields?: IntegrationField[];
};

export const infrastructureIntegrationConfigs: IntegrationConfigItem<InfrastructureIntegrationKey>[] = [
  {
    key: "supabase",
    name: "Supabase",
    purpose: "用户、授权、素材、发布、结算等业务数据存储和 Auth",
    phase: "MVP 必需",
    envKeys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
  },
  {
    key: "cloudflareR2",
    name: "Cloudflare R2",
    purpose: "直播录屏、切片视频、封面图、证据截图存储",
    phase: "MVP 必需",
    envKeys: ["CLIP_PARTNER_BUCKET", "R2_BUCKET_NAME"]
  },
  {
    key: "r2DirectUpload",
    name: "R2 直传签名",
    purpose: "浏览器直传录屏时由 Worker 签发短时上传地址",
    phase: "MVP 必需",
    envKeys: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]
  },
  {
    key: "cloudflareQueue",
    name: "Cloudflare Queues",
    purpose: "异步切片、转码、数据同步任务队列",
    phase: "后续接入",
    envKeys: ["CLIP_TASK_QUEUE"]
  }
];

export const providerIntegrationConfigs: IntegrationConfigItem<ProviderIntegrationKey>[] = [
  {
    key: "wechat_oauth",
    name: "微信 OAuth",
    purpose: "分发者微信登录与身份绑定",
    phase: "MVP 必需",
    envKeys: ["WECHAT_OAUTH_APP_ID", "WECHAT_OAUTH_APP_SECRET", "WECHAT_OAUTH_REDIRECT_URI"],
    publicFields: [
      { key: "appId", label: "App ID" },
      { key: "redirectUri", label: "回调地址", placeholder: "https://api.example.com/auth/wechat/callback" }
    ],
    secretFields: [{ key: "appSecret", label: "App Secret" }]
  },
  {
    key: "douyin",
    name: "抖音开放平台",
    purpose: "后续同步作品数据、播放互动和商品成交数据",
    phase: "后续接入",
    envKeys: ["DOUYIN_CLIENT_KEY", "DOUYIN_CLIENT_SECRET"],
    publicFields: [{ key: "clientKey", label: "Client Key" }],
    secretFields: [{ key: "clientSecret", label: "Client Secret" }]
  },
  {
    key: "wechat_channels",
    name: "视频号接口",
    purpose: "后续同步视频号作品和互动数据",
    phase: "后续接入",
    envKeys: ["WECHAT_CHANNELS_CLIENT_ID", "WECHAT_CHANNELS_CLIENT_SECRET"],
    publicFields: [{ key: "clientId", label: "Client ID" }],
    secretFields: [{ key: "clientSecret", label: "Client Secret" }]
  },
  {
    key: "tencent_identity",
    name: "腾讯认证",
    purpose: "后续接入腾讯身份认证或实名校验",
    phase: "后续接入",
    envKeys: [],
    publicFields: [
      { key: "appId", label: "App ID" },
      { key: "endpoint", label: "接口地址", placeholder: "https://example.tencentcloudapi.com" }
    ],
    secretFields: [{ key: "appSecret", label: "App Secret" }]
  },
  {
    key: "payment",
    name: "打款 / 财务接口",
    purpose: "后续自动打款、付款回执和财务对账",
    phase: "可选增强",
    envKeys: ["PAYMENT_PROVIDER_ENDPOINT", "PAYMENT_PROVIDER_TOKEN"],
    publicFields: [{ key: "endpoint", label: "接口地址", placeholder: "https://payment.example.com" }],
    secretFields: [{ key: "token", label: "访问令牌" }]
  },
  {
    key: "ffmpeg",
    name: "FFmpeg 服务",
    purpose: "执行真实的视频切片、转码和水印处理",
    phase: "MVP 必需",
    envKeys: ["FFMPEG_WORKER_ENDPOINT", "FFMPEG_WORKER_TOKEN"],
    publicFields: [{ key: "endpoint", label: "任务接口", placeholder: "https://ffmpeg.example.com/jobs" }],
    secretFields: [{ key: "token", label: "Webhook / API Token" }]
  }
];

export const integrationConfigs: IntegrationConfigItem[] = [
  ...infrastructureIntegrationConfigs,
  ...providerIntegrationConfigs
];

export function getIntegrationReadiness() {
  return integrationConfigs.map((item) => {
    const configuredKeys = item.envKeys.filter((envKey) => Boolean(process.env[envKey]));
    return {
      ...item,
      configuredCount: configuredKeys.length,
      totalCount: item.envKeys.length,
      missingKeys: item.envKeys.filter((envKey) => !process.env[envKey]),
      invalidKeys: [],
      isConfigured: configuredKeys.length === item.envKeys.length && item.envKeys.length > 0,
      source: "environment"
    };
  });
}
