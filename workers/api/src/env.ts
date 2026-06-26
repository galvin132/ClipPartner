/// <reference types="@cloudflare/workers-types" />

export type WorkerEnv = Cloudflare.Env & {
  APP_ENV?: string;
  ALLOW_MOCK_AUTH?: string;
  FRONTEND_ORIGIN: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  HYPERDRIVE?: Hyperdrive;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  FFMPEG_WORKER_ENDPOINT?: string;
  FFMPEG_WORKER_TOKEN?: string;
  WECHAT_OAUTH_APP_ID?: string;
  WECHAT_OAUTH_APP_SECRET?: string;
  WECHAT_OAUTH_REDIRECT_URI?: string;
  DOUYIN_CLIENT_KEY?: string;
  DOUYIN_CLIENT_SECRET?: string;
  WECHAT_CHANNELS_CLIENT_ID?: string;
  WECHAT_CHANNELS_CLIENT_SECRET?: string;
  PAYMENT_PROVIDER_ENDPOINT?: string;
  PAYMENT_PROVIDER_TOKEN?: string;
  CONFIG_ENCRYPTION_KEY?: string;
  CLIP_PARTNER_BUCKET: R2Bucket;
  CLIP_TASK_QUEUE: Queue;
};
