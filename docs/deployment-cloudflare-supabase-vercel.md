# ClipPartner 部署说明

## 目标架构

| 部分 | 服务 |
| --- | --- |
| Web 后台 | Vercel / Next.js |
| API | Cloudflare Workers |
| 认证 | Better Auth inside Worker |
| 数据库 | Supabase Postgres |
| DB 连接池 | Cloudflare Hyperdrive |
| 文件 | Cloudflare R2 |
| 异步任务 | Cloudflare Queues + Cron |

## Vercel

生产环境变量：

```env
NEXT_PUBLIC_APP_URL=https://clip-partner.vercel.app
NEXT_PUBLIC_API_BASE_URL=https://clip-partner-api.<your-subdomain>.workers.dev
NEXT_PUBLIC_RUNTIME_MODE=real
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

不要把 `SUPABASE_SERVICE_ROLE_KEY`、R2 secret、微信/抖音 secret 放进任何 `NEXT_PUBLIC_` 变量。

## Supabase

1. 创建 Supabase 项目。
2. 执行 `supabase/schema.sql` 或现有迁移。
3. 执行 `supabase/migrations/20260623200336_better_auth_gateway_foundation.sql`。
4. 保存 Project URL、anon key、service role key。

当前方案中 Supabase 只作为 Postgres 数据库，不作为 App/Web 主数据直连通道。

生产建议：

- 保留 RLS 作为数据库防线。
- 不让客户端直接访问业务表。
- 不关闭 Data API，直到 Worker 业务数据访问从 Supabase REST 完成迁移。
- Better Auth 表放在 `auth_app` schema，Worker 的 Hyperdrive 连接使用 `search_path=auth_app,public`。

## Cloudflare

安装并登录：

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

创建 Hyperdrive，连接 Supabase Postgres direct connection string：

```bash
npx wrangler hyperdrive create clip-partner-supabase \
  --connection-string="postgresql://<user>:<password>@<supabase-host>:5432/postgres"
```

拿到 Hyperdrive id 后，在 `workers/api/wrangler.toml` 中添加：

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-id>"
```

Worker secrets：

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config workers/api/wrangler.toml
npx wrangler secret put BETTER_AUTH_SECRET --config workers/api/wrangler.toml
npx wrangler secret put R2_ACCOUNT_ID --config workers/api/wrangler.toml
npx wrangler secret put R2_ACCESS_KEY_ID --config workers/api/wrangler.toml
npx wrangler secret put R2_SECRET_ACCESS_KEY --config workers/api/wrangler.toml
npx wrangler secret put WECHAT_OAUTH_APP_SECRET --config workers/api/wrangler.toml
npx wrangler secret put DOUYIN_APP_SECRET --config workers/api/wrangler.toml
npx wrangler secret put WECHAT_CHANNELS_APP_SECRET --config workers/api/wrangler.toml
```

生成 Better Auth secret：

```bash
openssl rand -base64 32
```

本地 Worker：

```bash
npm run worker:dev
```

部署 Worker：

```bash
npm run worker:deploy
```

## Mock 登录

Worker 默认不接受 mock 身份头。

仅本地联调可以在 `.dev.vars` 中设置：

```env
ALLOW_MOCK_AUTH=true
```

生产必须保持：

```env
APP_ENV=production
ALLOW_MOCK_AUTH=false
```

前端生产使用：

```env
NEXT_PUBLIC_RUNTIME_MODE=real
```

## 验证

部署前运行：

```bash
npm run verify
```

部署后检查：

- `GET /health`
- `GET /integrations`
- `GET /openapi.json`
- `GET /docs`
- `GET /api/auth/get-session`
