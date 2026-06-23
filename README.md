# ClipPartner

ClipPartner 切片合伙人是面向自有 IP 直播素材的授权分发与佣金结算系统。项目参考“众小二 / 三只羊”直播切片分发模式，但系统、素材、数据和结算沉淀在平台方自己手里。

## 当前进度

- Next.js 应用骨架和 Cloudflare Worker API 预留。
- Mock 登录与角色权限：管理员、审核员、财务、分发者。
- 后台运营工作台、授权审核、素材管理、切片任务、商品库、发布核验、佣金结算、风控记录、接口配置。
- 分发者素材中心和账号绑定页面。
- 素材详情页：预览占位、状态流转、绑定商品、模拟领取下载、相关发布记录。
- 切片任务中心：创建任务、处理中、失败、重试、模拟完成并生成素材。
- 发布核验：回填链接、模拟自动核验、风险链接进入风控。
- 佣金结算：结算单、作品级明细、CSV 导出、确认/打款/冻结。
- 运营配置：Mock/混合/真实模式、佣金规则、领取限制、风控关键词。
- 数据看板：发布漏斗、分发者排行、高领取素材排行。
- 核心业务类型和模拟数据。
- 本地可操作 MVP 状态流：授权审核、账号绑定、素材上下架、领取下载、发布回填、表现导入、风控处理、结算状态流转。
- 外部接口配置预留：`.env.example`、后台接口配置页、`/api/integrations` 配置状态接口。
- Supabase PostgreSQL 表结构草案。
- 新版全量升级骨架：分发者入驻、课程考试、协议签署、授权池、正式授权、分发任务、任务领取、下载凭证、收益钱包、信用分、公告通知、后台分发者管理和课程考试入口。
- Worker 已预留 `/me`、分发任务、授权池、钱包、风控、FFmpeg provider 等新版接口契约；当前先返回 contract stub，后续可替换真实微信、抖音 / 视频号、FFmpeg 和打款接口。

## 本轮排期执行结果

已按“先本地可测、再接真实接口”的顺序完成以下批次，代码暂未自动发布：

1. Worker API 与前端同步模式：新增账号绑定、切片任务列表和任务状态接口，本地 localStorage 与远程 Worker 均可走同一套页面流程。
2. 授权与领取校验：分发者素材中心只展示已通过 IP 授权的素材，领取时校验已通过账号、已通过授权和每日领取上限。
3. 录屏到切片任务：录屏上传在本地模式下进入切片任务中心，不再直接跳过队列生成素材；任务模拟完成后生成待完善素材。
4. 配置中心规则：运行模式、佣金分成、每日领取上限、风控关键字会保存到浏览器本地，并参与领取、核验和结算逻辑。
5. 发布核验与风控结算：自动核验读取风控关键字，不合规作品不进入结算；表现导入不会覆盖不合规状态；风控冻结会联动分发者结算状态。
6. 上线前验证：烟测已覆盖 `/login`、`/admin/clip-tasks`、`/partner/accounts`、Worker `/account-bindings` 和 `/clip-tasks` 只读接口。
7. 全量大版本第一批骨架：新增 `/partner/onboarding`、`/partner/authorizations`、`/partner/tasks`、`/partner/wallet`、`/admin/distributors`、`/admin/authorization-pools`、`/admin/distribution-tasks`、`/admin/training`，用于内测准入、授权、任务、钱包和治理流程。

如果 Supabase 还没有创建 `clip_tasks` 表，Worker 会先返回空任务列表，避免阻断页面测试；补跑 `supabase/schema.sql` 最新结构后会自动读取真实任务记录。

精选联盟商品有效性规则已统一到前台、后台和 Worker：素材开放领取、分发者领取、发布核验、表现导入和结算生成都会校验商品是否存在、平台是否匹配、是否启用、推广链接是否有效、佣金比例是否在 0-100 之间。无效商品会被拦截或在结算明细中以 0 元和扣减原因展示，避免停用商品或未绑定商品进入结算。

## Worker/Supabase 持久化闭环

本轮把新版业务模块从 contract stub 推进到远程优先读写，同时保留 localStorage/mock fallback：

- Worker 已实现 `/me`、分发者聚合、课程考试、协议签署、授权池、授权审核生成正式授权、分发任务、任务领取、下载凭证、作品回填、钱包、风控动作、申诉和通知读取。
- 前端 store 已改成远程优先：考试、协议、授权池、分发任务、任务领取/回填、钱包流水、通知已读和准入状态都会先调用 Worker，失败后自动使用本地 fallback。
- Supabase schema 补齐准入、账号、素材字段，新增基础 RLS policy，并增加 `distributor_summaries`、`authorization_pool_summaries`、`distribution_task_summaries`、`partner_wallet_summaries` 四个 summary view。
- 外部微信、抖音/视频号、FFmpeg、打款接口仍保留 provider 占位，不阻塞本轮业务主链路。

本轮已验证：

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run worker:types
npm.cmd run build
npm.cmd run smoke
```

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

预置测试账号：

| 角色 | 账号 | 密码 | 默认入口 |
| --- | --- | --- | --- |
| 管理员 | `admin` | `admin123` | `/` |
| 审核员 | `reviewer` | `reviewer123` | `/admin/authorizations` |
| 财务 | `finance` | `finance123` | `/admin/settlements` |
| 分发者 | `partner` | `partner123` | `/partner` |

常用验证命令：

```bash
npm run verify
npm run smoke
```

协作约定：功能更新后先保留在本地测试，不自动 `git push`、不自动部署 Cloudflare Worker、不自动触发 Vercel。确认测试通过后再单独执行发布。

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

## 后续真实接口接入顺序

1. Supabase Auth 与微信 OAuth：替换当前 Mock 登录 Provider。
2. 抖音 / 视频号账号校验：替换手动账号绑定。
3. FFmpeg 服务：替换切片任务中心的“模拟完成”。
4. 平台作品和商品核验：替换发布核验里的 `valid` / `risk` 模拟规则。
5. 精选联盟 / 订单数据：替换手动导入表现数据。
6. 财务打款接口：替换结算页的“标记已打款”。
7. Supabase RLS 和 Worker 鉴权：正式运营前必须完成。
