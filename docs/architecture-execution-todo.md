# ClipPartner 架构执行待办

版本：2026-06-24

## 本次已执行

1. Supabase migration 已应用到项目 `qhlesjopsqzcefsyjvgk`。
   - 远程记录：`20260623202057 better_auth_gateway_foundation`
   - 已创建 `auth_app` schema、Better Auth 表、`public.app_user_profiles`
   - 已收敛 `anon`/`authenticated` 对业务表的直接 grants

2. Cloudflare Hyperdrive 已创建并绑定 Worker。
   - Hyperdrive：`clip-partner-supabase`
   - ID：`d294784a3c4440b1939989e8123f5098`
   - 运行角色：`auth_app_runtime`
   - 已禁用 SQL 缓存，避免认证/session 读到旧值

3. Worker 已部署。
   - URL：`https://clip-partner-api.jm-realheart.workers.dev`
   - 已验证：`/health`、`/openapi.json`、`/docs`、`/api/auth/get-session`
   - `APP_ENV=production`
   - `ALLOW_MOCK_AUTH=false`

4. Worker 大文件已继续拆分。
   - 新增 `env.ts`
   - 新增 `errors.ts`
   - 新增 `http-utils.ts`
   - 新增 `supabase-rest.ts`
   - 新增模块测试 `tests/worker-modules.test.mjs`

## 暂缓待办

### P0：真实账号初始化

- 增加第一个管理员账号 bootstrap/seed 流程。
- 明确生产环境 `disableSignUp=true` 后，管理员如何创建 reviewer、finance、partner。
- 增加管理员角色变更审计日志。

### P0：Vercel 前端切换真实 API

- Vercel 设置 `NEXT_PUBLIC_RUNTIME_MODE=real`。
- Vercel 设置 `NEXT_PUBLIC_API_BASE_URL=https://clip-partner-api.jm-realheart.workers.dev`。
- 验证后台登录、退出、session 恢复和角色页面权限。
- 生产环境不展示 quick login。

### P1：Supabase 权限复查

- 继续审查所有 public 表的 RLS policy。
- 确认仍需通过 Supabase REST/service role 访问的业务表。
- 等 Worker 业务读写逐步切到 Postgres service/repository 后，再评估是否关闭 Data API。

### P1：继续拆 Worker 业务模块

- 按领域拆 route/service：
  - 认证与用户资料
  - partner 钱包和任务
  - 授权池和授权审核
  - 素材、R2 上传、切片任务
  - 风控、申诉、结算
- 每迁移一组接口，同步 OpenAPI schema 和权限测试。

### P1：微信、视频号、抖音核心入口

- 微信登录接入 Better Auth 或 Worker auth adapter。
- 视频号授权刷新和回调进入 Worker。
- 抖音授权、账号绑定、作品回填进入 Worker。
- 所有平台 token 不进入前端。

### P2：队列/Cron 业务化

- 把当前 Cron/Queue 占位升级为真实任务：
  - 切片状态扫描
  - 授权状态同步
  - 平台 token 刷新
  - 结算生成和支付状态同步

### P2：观测与告警

- 当前继续使用 Cloudflare logs/metrics。
- 核心链路稳定后再评估 Sentry + OpenTelemetry。
- 增加结构化错误码、请求 ID、关键业务审计日志。

## 继续保持不做

- 不让 App/Web 直接操作 Supabase 业务表。
- 不把 Supabase `service_role` 放到前端或 App。
- 不把小程序作为主架构目标。
- 不引入复杂 monorepo。
- 不把 Drizzle/Kysely 作为主业务 ORM。
