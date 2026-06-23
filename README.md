# ClipPartner

ClipPartner 是面向直播 IP、品牌方和内容团队的切片分销增长系统。它把直播录屏、IP 素材、商品、授权、达人分发、作品回填、风控和佣金结算放进同一套流程里，让更多授权账号帮品牌持续种草和卖货。

## 当前架构

| 层级 | 技术方案 |
| --- | --- |
| Web 后台 | Next.js 16 / React 19，部署到 Vercel |
| 后续 App | Expo React Native，复用同一套 Worker API |
| 统一 API | Cloudflare Workers + Hono |
| API 契约 | Zod + OpenAPI，提供 `/openapi.json` 和 `/docs` |
| 认证权限 | Better Auth，服务端统一 session、bearer token、角色 |
| 数据库 | Supabase Postgres，仅作为核心数据库 |
| 文件存储 | Cloudflare R2 |
| 异步任务 | Cloudflare Queues + Cron |
| 第三方入口 | 微信、视频号、抖音授权和回调全部进入 Worker |

核心原则：

- App/Web 不直接操作 Supabase 业务表。
- Supabase `service_role` 只放在 Worker 或本地脚本环境，不能进入前端。
- 生产环境不接受前端伪造的 `x-clip-*` mock 身份头。
- Better Auth 是主账号体系；Supabase Auth 不再作为主登录系统。
- RLS 作为数据库防线，业务权限主要放在 Worker。
- R2 继续承载素材、视频和证据文件，控制长期存储成本。

## 本地启动

建议使用 Node.js 22.13.0 或以上。

```bash
npm install
npm run dev
```

常用验证：

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run worker:types
```

完整验证：

```bash
npm run verify
```

## 关键环境变量

前端：

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
NEXT_PUBLIC_RUNTIME_MODE=mock
```

Worker：

```env
APP_ENV=development
ALLOW_MOCK_AUTH=false
FRONTEND_ORIGIN=http://localhost:3000
BETTER_AUTH_URL=http://localhost:8787
BETTER_AUTH_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

`NEXT_PUBLIC_RUNTIME_MODE`：

- `mock`：本地演示账号和 mock provider。
- `hybrid`：逐步联调真实 API，同时保留 fallback。
- `real`：使用 Better Auth 登录，不展示本地一键演示账号。

## 认证说明

开发环境可以使用演示账号：

| 角色 | 账号 | 密码 | 默认入口 |
| --- | --- | --- | --- |
| 管理员 | `admin` | `admin123` | `/` |
| 审核 | `reviewer` | `reviewer123` | `/admin/authorizations` |
| 财务 | `finance` | `finance123` | `/admin/settlements` |
| 分发者 | `partner` | `partner123` | `/partner` |

真实环境登录走 Worker 内的 Better Auth：

- 登录：`POST /api/auth/sign-in/email`
- 退出：`POST /api/auth/sign-out`
- Session：`GET /api/auth/get-session`
- 业务接口通过 `Authorization: Bearer <token>` 鉴权。

## API 文档

Worker 暴露：

- `GET /openapi.json`
- `GET /docs`
- `GET /health`
- `GET /integrations`
- `/api/auth/*`

新增或修改写入接口时，必须同步补 Zod 校验和 OpenAPI request body。

## 数据库与存储

Supabase migration 位于 `supabase/migrations`。

当前迁移包含：

- Better Auth 私有 schema：`auth_app`
- Better Auth 表：`user`、`session`、`account`、`verification`
- 业务用户映射表：`public.app_user_profiles`
- 业务表 direct grants 收敛：撤回 `anon/authenticated` 对 public 业务表的直接访问，保留 `service_role`

Cloudflare R2 用于素材、视频、录屏、证据文件。上传、下载和鉴权都应通过 Worker 完成。

## 部署文档

查看：

- [Cloudflare / Supabase / Vercel 部署说明](./docs/deployment-cloudflare-supabase-vercel.md)
- [架构优化方案](./docs/architecture-optimization-plan.md)
