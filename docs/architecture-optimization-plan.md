# ClipPartner 架构优化方案

版本：2026-06-24 v1

## 最终结论

ClipPartner 采用统一服务端 API 架构：

```text
Next.js Web / Expo App / 微信入口
        |
Cloudflare Workers + Hono + Zod OpenAPI
        |
Better Auth session / bearer token / role middleware
        |
Supabase Postgres + Cloudflare R2 + Queues/Cron
        |
微信、视频号、抖音、结算、素材、授权、风控
```

不采用客户端直连 Supabase 作为主业务方案。Supabase 保留为核心 Postgres 数据库；App/Web 不直接操作业务表。

## 为什么保留 Worker

项目核心不是简单 CRUD，而是授权、素材下载、任务领取、作品回填、平台授权、结算、风控、上传签名和后续 App/微信入口统一。

Worker 的必要性：

- 统一承接 App、Web、微信、抖音、视频号入口。
- 隐藏 Supabase `service_role`、R2 secret、微信/抖音 secret。
- 统一处理 Better Auth session、角色、账号绑定。
- 在服务端判断 partner 数据归属，避免客户端伪造身份。
- 生成 R2 上传/下载凭证，控制素材和证据文件权限。
- 承接 webhook、队列、定时任务、授权刷新和结算任务。

## 已采纳方案

| 模块 | 决策 |
| --- | --- |
| Web 后台 | Next.js + React |
| App | 后续 Expo React Native |
| API | Cloudflare Workers + Hono |
| 校验与契约 | Zod + OpenAPI |
| 认证 | Better Auth |
| 数据库 | Supabase Postgres |
| 文件 | Cloudflare R2 |
| 异步任务 | Cloudflare Queues + Cron |
| 观测 | 暂不上 Sentry + OpenTelemetry |

## 权限原则

固定角色：

- `admin`
- `reviewer`
- `finance`
- `partner`

规则：

- 生产不接受 mock 身份头。
- 真实业务接口使用 Better Auth bearer token。
- partner 只能访问自己的任务、授权、钱包、结算和上传数据。
- 管理员、审核、财务按 Worker 权限矩阵分权。
- RLS 作为数据库防线，不承载全部复杂业务流程。

## Supabase 使用方式

保留：

- Postgres 表和迁移。
- RLS 和 `security_invoker` view。
- service role 作为 Worker 数据访问通道。

收敛：

- 撤回 `anon/authenticated` 对 public 业务表的直接 grants。
- Better Auth 表放入 `auth_app` schema。
- 业务用户映射表使用 `public.app_user_profiles`，由 Worker service role 访问。

暂不做：

- 暂不关闭 Supabase Data API。
- 暂不引入 Drizzle/Kysely 作为主业务 ORM。
- 暂不把 App/Web 改成直连 Supabase。

## Better Auth

作用：

- 登录、退出、session。
- bearer token。
- 用户角色。
- 后续微信/视频号/抖音账号绑定能力的统一入口。

当前落地：

- `/api/auth/*` 挂在 Worker。
- 开发测试可用内存存储。
- 生产要求 Hyperdrive 或数据库连接。
- Better Auth 使用 Supabase Postgres 持久化。

## Hono + Zod OpenAPI

作用：

- 统一 Worker 路由结构。
- 暴露 `/openapi.json` 和 `/docs`。
- 给 App、小程序、后台共用同一套接口契约。
- 所有写入接口逐步补齐 Zod request body。

当前策略：

- 保持现有 API 路径兼容。
- 不一次性重写所有 legacy handler。
- 高风险写入接口优先补 schema。
- 后续按领域拆分 route/service。

## 成本原则

- R2 继续作为素材和视频存储，避免对象存储成本失控。
- Workers + Queues + Cron 覆盖当前阶段，不提前引入付费工作流平台。
- Sentry + OpenTelemetry 等生产观测在核心链路稳定后再接入。
- 不为了“省代码”把核心权限和资金链路下放到客户端。

## 后续路线

1. 继续把大型 Worker handler 拆成 Hono route module。
2. 将 Supabase REST 字符串查询逐步收敛到 service/repository。
3. App 启动时直接复用 OpenAPI 和 Better Auth bearer session。
4. 微信登录、视频号、抖音授权作为 Worker adapter 接入。
5. 结算、支付、风控链路补幂等键、审计日志和队列任务。

