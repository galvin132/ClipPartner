# ClipPartner

ClipPartner 是面向直播 IP、品牌方和内容团队的切片分销增长系统。

它帮助团队把直播录屏和 IP 素材变成可领取、可核验、可结算的分发任务，让更多授权账号帮品牌持续种草和卖货，同时把授权、商品、发布链接、风控和佣金结算放进同一套流程里。

## 核心价值

- **让内容继续赚钱**：直播结束后，录屏和切片素材可以继续被分发达人发布，形成二次成交。
- **让更多人帮你卖货**：通过授权池、任务中心和下载凭证，组织一批可管理的切片合伙人。
- **按结果结算**：作品回填后先核验账号、链接、商品和内容合规，通过后才进入佣金结算。
- **安全可控**：未授权、错挂商品、风险话术、异常作品可以被拦截、冻结、扣信用分或暂停授权。
- **数据可追踪**：谁领了素材、谁发了作品、谁卖得好、哪个 IP 和商品值得加码，都能在大屏里看见。

## 当前重点页面

| 页面 | 路由 | 用途 |
| --- | --- | --- |
| 赚钱大屏 | `/` | 对外演示第一屏，展示 GMV、有效作品、达人排行、素材排行、商品榜和风险拦截 |
| IP达人管理 | `/admin/ip-talents` | 按 IP/主播聚合素材、任务、GMV、佣金、商品和风险 |
| 分发者管理 | `/admin/distributors` | 查看每个分发达人的账号、授权、信用分、GMV、佣金和违规 |
| 素材管理 | `/admin/materials` | 管理直播切片、商品绑定、卖点、禁用词和上下架 |
| 分发任务 | `/admin/distribution-tasks` | 创建可领取任务，配置素材、商品、奖励和领取限制 |
| 发布核验 | `/admin/publish-records` | 核验作品链接、账号、商品挂载和风险状态 |
| 佣金结算 | `/admin/settlements` | 生成结算单，确认、打款或冻结佣金 |
| 分发者赚钱中心 | `/partner` | 分发者查看收益、排名、授权、待回填、待核验和钱包 |

## 演示账号

| 角色 | 账号 | 密码 | 默认入口 |
| --- | --- | --- | --- |
| 管理员 | `admin` | `admin123` | `/` |
| 审核员 | `reviewer` | `reviewer123` | `/admin/authorizations` |
| 财务 | `finance` | `finance123` | `/admin/settlements` |
| 分发者 | `partner` | `partner123` | `/partner` |

## 本地启动

建议使用 Node.js 22.13.0 或以上。

```bash
npm install
npm run dev
```

打开：

- 前端：`http://localhost:3000`
- 分发者端：`http://localhost:3000/partner`

常用验证：

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run smoke
```

## 技术架构

| 层级 | 技术 |
| --- | --- |
| 前端 | Next.js / React |
| 图标 | lucide-react |
| API | Cloudflare Workers |
| 数据库 | Supabase PostgreSQL |
| 文件存储 | Cloudflare R2 |
| 异步处理 | Cloudflare Queues / FFmpeg provider |
| 部署 | Vercel + Cloudflare |

当前版本保留 localStorage / mock fallback，方便本地演示和开发；生产环境可逐步接入微信 OAuth、抖音/视频号平台数据、精选联盟数据、R2 直传、FFmpeg 切片和打款接口。

外部接口申请期间，前端可以继续使用演示账号和本地 fallback。Worker 默认不接受前端伪造的 mock 角色头；如果本地联调确实要让 Worker 接受演示账号请求，请只在本机 `.dev.vars` 中设置 `ALLOW_MOCK_AUTH=true`。生产环境必须保持关闭，并改用 Supabase/微信 OAuth 的 Bearer token。

### Runtime / Provider 模式

外部接口未完成申请前，页面不要直接依赖第三方 SDK。统一从 `lib/providers` 进入：

- `NEXT_PUBLIC_RUNTIME_MODE=mock`：默认模式，使用演示账号、本地平台核验、本地视频任务和模拟打款记录。
- `NEXT_PUBLIC_RUNTIME_MODE=hybrid`：用于本地/测试联调，保留 mock fallback，同时允许逐步接入已配置的 API。
- `NEXT_PUBLIC_RUNTIME_MODE=real`：不再允许 mock 登录；平台数据转人工复核，视频和支付走本地/人工占位，不发起第三方网络请求。

后续接微信登录、Supabase Auth、抖音/视频号数据、FFmpeg 或打款接口时，只替换 provider/adapter 实现，页面和本地 fallback 流程保持不变。

## 对外介绍话术

> ClipPartner 帮直播 IP 和品牌方搭建自己的切片合伙人体系，让更多授权账号帮你卖货。系统负责管授权、发素材、收作品、验链接、算佣金和控风险。你获得的是新增分发渠道和成交增量，同时不用担心素材乱传、账号乱发、佣金算不清。

更短一点：

> 客户买的不是系统，而是更多成交、更低管理成本、更可控的分发风险。

## 协作约定

- 非必要资料不要提交到 GitHub，例如实施方案、路线图、调研草稿和本地配置。
- `.env.local`、`.env.development`、`.env.production`、`.vercel/`、`.local/` 已加入忽略规则。
- 功能提交前至少运行 `typecheck`、`lint` 和 `build`。
