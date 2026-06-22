# ClipPartner 线上部署配置

## 目标架构

| 部分 | 服务 |
| --- | --- |
| 前台 / 后台页面 | Vercel，使用项目默认域名 `*.vercel.app` |
| API 服务 | Cloudflare Workers |
| 数据库 / Auth | Supabase |
| 文件存储 | Cloudflare R2 |
| 异步任务 | Cloudflare Queues |
| 定时任务 | Cloudflare Cron Triggers |
| 视频处理 | 独立 FFmpeg 服务，先通过 Worker 调用 |

## 需要注册的账号

1. Vercel：部署 Next.js 前台和后台。
2. Cloudflare：Workers、R2、Queues、Cron Triggers。
3. Supabase：PostgreSQL、Auth、数据库 API。
4. 微信开放平台：后续接微信登录时使用。
5. 视频处理服务器：后续部署 FFmpeg 服务。

## Vercel 配置

Vercel 默认域名会类似：

```text
https://clip-partner.vercel.app
```

Vercel 环境变量建议先配置：

```env
NEXT_PUBLIC_APP_URL=https://clip-partner.vercel.app
NEXT_PUBLIC_API_BASE_URL=https://clip-partner-api.<your-subdomain>.workers.dev
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

不要把 `SUPABASE_SERVICE_ROLE_KEY` 放到 `NEXT_PUBLIC_` 变量里，也不要在浏览器侧使用。

## Supabase 配置

1. 创建 Supabase 项目。
2. 打开 SQL Editor。
3. 执行 `supabase/schema.sql`。
4. 在 Project Settings 中复制：
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key -> Cloudflare Worker secret `SUPABASE_SERVICE_ROLE_KEY`

后续正式接入用户数据时，需要补 RLS policy。

## Cloudflare 配置

安装并登录 Wrangler：

```bash
npm install
npx wrangler login
```

创建 R2 bucket：

```bash
npx wrangler r2 bucket create clip-partner-assets
```

创建队列：

```bash
npx wrangler queues create clip-partner-clip-tasks
```

设置 Worker secrets：

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config workers/api/wrangler.toml
npx wrangler secret put WECHAT_OAUTH_APP_SECRET --config workers/api/wrangler.toml
npx wrangler secret put FFMPEG_WORKER_TOKEN --config workers/api/wrangler.toml
```

本地运行 Worker：

```bash
npm run worker:dev
```

部署 Worker：

```bash
npm run worker:deploy
```

部署完成后，把 Worker URL 填回 Vercel：

```env
NEXT_PUBLIC_API_BASE_URL=https://clip-partner-api.<your-subdomain>.workers.dev
```

## 当前已预留 API

```text
GET  /health
GET  /integrations
POST /clip-tasks
```

当前 Next.js 页面仍使用本地 mock 状态。下一步可以把 `lib/local-store.ts` 中的操作逐个替换为 Cloudflare Worker API 调用。
