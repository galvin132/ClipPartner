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

```bash
npm install
npm run dev
```

打开 `http://localhost:3000` 查看后台工作台，打开 `http://localhost:3000/partner` 查看分发者前台。

## 接口配置

当前功能先使用浏览器 localStorage 跑通完整业务流。后续接入真实接口时，先复制 `.env.example` 为 `.env.local`，逐项补充：

- Supabase：用户、授权、素材、发布、结算数据。
- 微信 OAuth：分发者微信登录。
- Cloudflare R2：录屏、切片、封面、证据截图。
- Cloudflare Queues：异步切片、转码和数据同步任务。
- FFmpeg 服务：真正的视频切片、转码、水印。
- 抖音 / 视频号：后续作品与成交数据同步。
- 打款接口：后续结算自动化。

后台 `接口配置` 页面会展示每个接口需要的环境变量，`/api/integrations` 会返回配置完成度，不会返回密钥原文。

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
