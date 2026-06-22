import type { AuthorizationRequest, Material, Metric, PublishRecord, Settlement } from "./domain";

export const dashboardMetrics: Metric[] = [
  {
    label: "待审核授权",
    value: "18",
    note: "今日新增 6 个申请",
    tone: "warning"
  },
  {
    label: "可领取素材",
    value: "126",
    note: "覆盖 5 个 IP 账号",
    tone: "success"
  },
  {
    label: "待核验发布",
    value: "43",
    note: "需要检查商品挂载",
    tone: "info"
  },
  {
    label: "本月待结算",
    value: "¥38,620",
    note: "不含退款和违规作品",
    tone: "success"
  }
];

export const authorizationRequests: AuthorizationRequest[] = [
  {
    id: "AR-20260622-001",
    distributorName: "李晨",
    phone: "138****3921",
    socialAccount: "晨剪精选",
    platform: "抖音",
    ipName: "老许家居",
    status: "pending",
    appliedAt: "2026-06-22 09:40",
    reason: "已有家居垂类账号，计划每日发布 3 条切片。"
  },
  {
    id: "AR-20260622-002",
    distributorName: "周婧",
    phone: "186****7108",
    socialAccount: "小周好物局",
    platform: "视频号",
    ipName: "晴姐穿搭",
    status: "approved",
    appliedAt: "2026-06-22 10:18",
    reason: "视频号粉丝 1.8 万，女装转化稳定。"
  },
  {
    id: "AR-20260621-014",
    distributorName: "陈凯",
    phone: "159****6245",
    socialAccount: "凯哥剪货",
    platform: "抖音",
    ipName: "林哥数码",
    status: "paused",
    appliedAt: "2026-06-21 18:04",
    reason: "上周有一条作品未挂指定商品，等待复核。"
  }
];

export const materials: Material[] = [
  {
    id: "CLIP-001",
    title: "晴姐讲解夏季通勤套装三件套",
    ipName: "晴姐穿搭",
    sourcePlatform: "抖音",
    liveDate: "2026-06-21",
    duration: "00:48",
    tags: ["女装", "通勤", "高转化"],
    productName: "冰感通勤套装",
    status: "published",
    claims: 32,
    downloads: 28
  },
  {
    id: "CLIP-002",
    title: "老许演示免打孔置物架承重",
    ipName: "老许家居",
    sourcePlatform: "视频号",
    liveDate: "2026-06-20",
    duration: "01:12",
    tags: ["家居", "演示", "强卖点"],
    productName: "免打孔厨房置物架",
    status: "ready",
    claims: 0,
    downloads: 0
  },
  {
    id: "CLIP-003",
    title: "林哥对比无线麦克风收音效果",
    ipName: "林哥数码",
    sourcePlatform: "抖音",
    liveDate: "2026-06-19",
    duration: "01:36",
    tags: ["数码", "对比", "测评"],
    productName: "领夹无线麦克风",
    status: "processing",
    claims: 0,
    downloads: 0
  }
];

export const publishRecords: PublishRecord[] = [
  {
    id: "PUB-001",
    distributorName: "周婧",
    materialTitle: "晴姐讲解夏季通勤套装三件套",
    productName: "冰感通勤套装",
    platform: "视频号",
    status: "verified",
    submittedAt: "2026-06-22 11:24",
    gmv: 12860,
    commission: 1929
  },
  {
    id: "PUB-002",
    distributorName: "李晨",
    materialTitle: "老许演示免打孔置物架承重",
    productName: "免打孔厨房置物架",
    platform: "抖音",
    status: "submitted",
    submittedAt: "2026-06-22 14:05",
    gmv: 0,
    commission: 0
  },
  {
    id: "PUB-003",
    distributorName: "陈凯",
    materialTitle: "林哥对比无线麦克风收音效果",
    productName: "领夹无线麦克风",
    platform: "抖音",
    status: "invalid",
    submittedAt: "2026-06-21 20:16",
    gmv: 2160,
    commission: 0
  }
];

export const settlements: Settlement[] = [
  {
    id: "SET-202606-001",
    distributorName: "周婧",
    period: "2026-06",
    verifiedPosts: 21,
    payableCommission: 8260,
    status: "confirmed"
  },
  {
    id: "SET-202606-002",
    distributorName: "李晨",
    period: "2026-06",
    verifiedPosts: 9,
    payableCommission: 3420,
    status: "pending"
  },
  {
    id: "SET-202606-003",
    distributorName: "陈凯",
    period: "2026-06",
    verifiedPosts: 4,
    payableCommission: 0,
    status: "blocked"
  }
];

export const workflowSteps = [
  {
    title: "授权审核",
    desc: "确认分发者身份、社媒账号和可领取 IP 范围。",
    status: "18 待处理"
  },
  {
    title: "素材生产",
    desc: "上传录屏、人工切点、生成切片、绑定商品。",
    status: "7 个任务"
  },
  {
    title: "发布核验",
    desc: "检查作品链接、平台账号和精选联盟商品挂载。",
    status: "43 待核验"
  },
  {
    title: "佣金结算",
    desc: "导入成交数据，排除退款和违规作品，生成台账。",
    status: "本月进行中"
  }
];
