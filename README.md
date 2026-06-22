# ClipPartner

ClipPartner 切片合伙人是面向自有 IP 直播素材的授权分发与佣金结算系统。项目参考“众小二 / 三只羊”直播切片分发模式，但系统、素材、数据和结算沉淀在平台方自己手里。

## 当前进度

- Next.js 应用骨架。
- 后台运营工作台。
- 授权审核、素材管理、发布核验、佣金结算、风控记录页面。
- 分发者素材中心页面。
- 核心业务类型和模拟数据。
- 本地可操作 MVP 状态流：授权审核、素材上下架、领取下载、发布回填、表现导入、结算状态流转。
- 外部接口配置预留：`.env.example`、后台接口配置页、`/api/integrations` 配置状态接口。
- Supabase PostgreSQL 表结构草案。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前台 / 后台 | Next.js / React |
| UI 图标 | lucide-react |
| 数据库 | Supabase PostgreSQL |
| 文件存储 | Cloudflare R2 |
| API | Cloudflare Workers |
| 视频处理 | 独立 FFmpeg 服务 |

## 本地开发

建议使用 Node.js 22.13.0 以上；当前 Wrangler、ESLint 相关工具链已经按 Node 22 基线更新。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000` 查看后台工作台，打开 `http://localhost:3000/partner` 查看分发者前台。

常用验证命令：

```bash
npm run verify
npm run smoke
```

## 接口配置

当前功能先使用浏览器 localStorage 跑通完整业务流。后续接入真实接口时，先复制 `.env.example` 为 `.env.local`，逐项补充。本地和生产不要在同一个 env 文件里重复写同名变量；`.env.local` 只放本机覆盖和私密值，`.env.development` / `.env.production` 只放可提交的公共默认值，Vercel 线上敏感值放项目环境变量。

- Supabase：用户、授权、素材、发布、结算数据。
- 微信 OAuth：分发者微信登录。
- Cloudflare R2：录屏、切片、封面、证据截图。
- Cloudflare Queues：异步切片、转码和数据同步任务。
- FFmpeg 服务：真正的视频切片、转码、水印。
- 抖音 / 视频号：后续作品与成交数据同步。
- 打款接口：后续结算自动化。

后台 `接口配置` 页面会展示每个接口需要的环境变量，`/api/integrations` 会返回配置完成度，不会返回密钥原文。

## 架构与性能优化

- Worker 列表接口支持 `limit`、`offset`、`q`、`status`、`platform` 参数，例如 `/materials?limit=50&offset=0&q=直播`。返回体会包含 `meta.nextOffset`，方便前端后续做远程分页和无限滚动。
- Supabase 查询优先走 `*_summaries` 汇总视图，把素材、商品、发布记录、结算记录的关联统计下沉到数据库，减少 Worker 与浏览器之间的全量传输。
- 大文件继续放 Cloudflare R2。前端优先使用 `/recordings/direct-upload/init` 获取 R2 直传签名 URL，上传完成后调用 `/recordings/direct-upload/complete` 入库并投递切片任务；如果直传密钥未配置，会回退旧的 Worker 表单上传。
- Worker 使用 Zod 做运行时校验，错误统一返回 `{ error: { code, message, details } }`。
- 切片任务会写入 `clip_tasks` 幂等任务表，再通过 Cloudflare Queues 异步触发，避免上传请求长时间占用。
- 新增索引和 `security_invoker` 视图后，建议生产库执行 `EXPLAIN ANALYZE` 验证高频筛选条件，再根据真实慢查询补充组合索引。
- 依赖审计若仍提示 Wrangler 相关漏洞，优先确认本机 Node.js 已升级到 22.13.0 以上；Node 20.11.x 会限制最新工具链安装和运行。

## 生产化任务拆分

1. API 契约：Worker mutation 接口使用 Zod 校验，统一错误码和结构化日志。
2. R2 直传：浏览器直传 R2，Worker 只负责签名、完成入库和投递 Queue。
3. Queue 幂等：`clip_tasks` 记录任务、去重键、尝试次数、失败原因和状态。
4. 数据安全：Supabase 启用 RLS，增加管理员和分发者基础 policy，汇总视图使用 `security_invoker`。
5. 远程分页：前端列表按搜索、状态和平台调用 Worker 分页接口，保留 localStorage 回退。
6. 分环境配置：Node 22、Wrangler 4、R2 S3 credentials、Supabase service role 均通过环境变量或 secret 管理。
7. 验证：每轮改动运行 `npm run typecheck`、`npm run lint`、`npm run build`、`npm run worker:types` 和 `npm audit`。

R2 直传生产环境需要配置：

```bash
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Windows 可以直接运行安全输入脚本，脚本不会把密钥写入文件：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/set-worker-secrets.ps1
```

脚本会优先读取 `.env.local` 中的 `R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`SUPABASE_SERVICE_ROLE_KEY`，缺失时才提示手动输入。

R2 的 `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` 在 Cloudflare Dashboard 获取：进入 **R2** -> **Manage API Tokens** -> **Create API token**，权限选择 Object Read & Write，并限制到 `clip-partner-assets` bucket。创建后立即复制 Access Key ID 和 Secret Access Key，Secret 只显示一次。

Supabase 的 `SUPABASE_SERVICE_ROLE_KEY` 在 Supabase Dashboard 的项目 `clippartner` 中获取：进入 **Project Settings** -> **API Keys**，复制 `service_role` / secret key。该值只能放在 Worker、服务器或 CI secrets，不能放到任何 `NEXT_PUBLIC_` 变量。

## 目录

```text
app/                    Next.js App Router 页面
components/             共享界面组件
lib/                    业务类型与模拟数据
lib/local-store.ts      本地 MVP 状态流，后续可替换为真实 API 调用
supabase/schema.sql     Supabase 表结构草案
ClipPartner项目实施方案.md  项目实施方案
```

## 下一步

1. 接入 Supabase Auth 与微信 OAuth。
2. 将模拟数据替换为 Supabase 查询。
3. 增加后台表单和 Server Actions。
4. 搭建 Cloudflare Workers API。
5. 增加 R2 上传、下载签名 URL。
6. 接入 FFmpeg 异步切片任务。
