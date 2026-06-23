import type {
  AccountBinding,
  AgreementSignature,
  AuthorizationPool,
  AuthorizationRequest,
  ClipTask,
  CreditScoreEvent,
  DistributorProfile,
  DistributionTask,
  ExamAttempt,
  FormalAuthorization,
  Material,
  Metric,
  Notification,
  Product,
  PublishRecord,
  RiskRecord,
  Settlement,
  TaskClaim,
  TrainingCourse,
  WalletTransaction
} from "./domain";

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

export const accountBindings: AccountBinding[] = [
  {
    id: "ACCT-001",
    distributorName: "周婧",
    platform: "视频号",
    accountName: "小周好物局",
    homepageUrl: "https://example.com/channels/xiaozhou",
    followers: 18000,
    category: "女装 / 好物",
    status: "approved",
    boundAt: "2026-06-22 10:12",
    note: "模拟账号，微信接入前用于测试领取和回填。",
    shopWindowStatus: "open",
    riskTag: "低风险"
  },
  {
    id: "ACCT-002",
    distributorName: "周婧",
    platform: "抖音",
    accountName: "周周剪货",
    homepageUrl: "https://example.com/douyin/zhouzhou",
    followers: 8600,
    category: "家居 / 日用",
    status: "pending",
    boundAt: "2026-06-22 14:18",
    note: "等待管理员审核。",
    shopWindowStatus: "open",
    riskTag: "待核验"
  }
];

export const materials: Material[] = [
  {
    id: "CLIP-001",
    title: "晴姐讲解夏季通勤套装三件套",
    ipName: "晴姐穿搭",
    sourcePlatform: "视频号",
    liveDate: "2026-06-21",
    duration: "00:48",
    tags: ["女装", "通勤", "高转化"],
    productName: "冰感通勤套装",
    status: "published",
    claims: 32,
    downloads: 28,
    sellingPoint: "冰感面料、通勤场景、三件套组合提升客单价。",
    recommendedCopy: "夏季通勤不用纠结，这套三件套直接解决搭配和闷热问题。",
    forbiddenWords: ["全网最低", "永久有效"],
    qualityScore: 92,
    expiresAt: "2026-07-15"
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
    downloads: 0,
    sellingPoint: "免打孔、强承重、厨房收纳前后对比明显。",
    recommendedCopy: "不用打孔也能把厨房台面救回来，承重演示看得见。",
    forbiddenWords: ["绝对不掉", "承重无限"],
    qualityScore: 86,
    expiresAt: "2026-07-08"
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
    downloads: 0,
    sellingPoint: "户外收音、降噪对比、适合口播和直播场景。",
    recommendedCopy: "同样是无线麦，收音差距在户外一听就知道。",
    forbiddenWords: ["专业级第一", "秒杀所有"],
    qualityScore: 78,
    expiresAt: "2026-07-10"
  }
];

export const distributorProfiles: DistributorProfile[] = [
  {
    id: "DIST-001",
    displayName: "周婧",
    phone: "186****7108",
    wechatId: "zhoujing_clip",
    onboardingStatus: "ready_for_authorization",
    creditScore: 96,
    examScore: 92,
    agreementSigned: true,
    accountCount: 2,
    authorizationCount: 1,
    violationCount: 0,
    payableCommission: 8260,
    createdAt: "2026-06-20 10:24"
  },
  {
    id: "DIST-002",
    displayName: "李晨",
    phone: "138****3921",
    wechatId: "lichen_home",
    onboardingStatus: "agreement_pending",
    creditScore: 88,
    examScore: 84,
    agreementSigned: false,
    accountCount: 1,
    authorizationCount: 0,
    violationCount: 0,
    payableCommission: 3420,
    createdAt: "2026-06-21 09:10"
  },
  {
    id: "DIST-003",
    displayName: "陈凯",
    phone: "159****6245",
    wechatId: "chenkai_clip",
    onboardingStatus: "suspended",
    creditScore: 58,
    examScore: 81,
    agreementSigned: true,
    accountCount: 1,
    authorizationCount: 1,
    violationCount: 2,
    payableCommission: 0,
    createdAt: "2026-06-18 16:30"
  }
];

export const trainingCourses: TrainingCourse[] = [
  {
    id: "COURSE-001",
    title: "切片授权基础与版权边界",
    lessonCount: 4,
    estimatedMinutes: 28,
    isRequired: true
  },
  {
    id: "COURSE-002",
    title: "商品挂载与违规案例",
    lessonCount: 3,
    estimatedMinutes: 22,
    isRequired: true
  }
];

export const examAttempts: ExamAttempt[] = [
  {
    id: "EXAM-001",
    distributorName: "周婧",
    score: 92,
    passed: true,
    attemptedAt: "2026-06-22 09:36"
  },
  {
    id: "EXAM-002",
    distributorName: "李晨",
    score: 84,
    passed: true,
    attemptedAt: "2026-06-22 10:05"
  },
  {
    id: "EXAM-003",
    distributorName: "陈凯",
    score: 81,
    passed: true,
    attemptedAt: "2026-06-19 11:20"
  }
];

export const agreementSignatures: AgreementSignature[] = [
  {
    id: "SIGN-001",
    distributorName: "周婧",
    templateName: "直播切片授权合作协议",
    version: "2026.06",
    signedAt: "2026-06-22 09:42"
  },
  {
    id: "SIGN-002",
    distributorName: "陈凯",
    templateName: "直播切片授权合作协议",
    version: "2026.06",
    signedAt: "2026-06-19 11:45"
  }
];

export const authorizationPools: AuthorizationPool[] = [
  {
    id: "POOL-001",
    ipName: "晴姐穿搭",
    platform: "视频号",
    status: "open",
    totalQuota: 500,
    usedQuota: 126,
    minCreditScore: 80,
    defaultShareRate: 40,
    dailyClaimLimit: 10,
    requirement: "账号需完成课程考试、签署协议，女装或好物类账号优先。"
  },
  {
    id: "POOL-002",
    ipName: "老许家居",
    platform: "抖音",
    status: "open",
    totalQuota: 300,
    usedQuota: 284,
    minCreditScore: 80,
    defaultShareRate: 35,
    dailyClaimLimit: 8,
    requirement: "家居收纳类账号优先，需开通商品橱窗。"
  },
  {
    id: "POOL-003",
    ipName: "林哥数码",
    platform: "抖音",
    status: "paused",
    totalQuota: 200,
    usedQuota: 198,
    minCreditScore: 85,
    defaultShareRate: 30,
    dailyClaimLimit: 6,
    requirement: "数码测评类账号，需等待新素材和商品池补充。"
  }
];

export const formalAuthorizations: FormalAuthorization[] = [
  {
    id: "AUTH-001",
    distributorName: "周婧",
    socialAccount: "小周好物局",
    ipName: "晴姐穿搭",
    platform: "视频号",
    status: "approved",
    shareRate: 40,
    dailyClaimLimit: 10,
    startsAt: "2026-06-22",
    expiresAt: "2026-09-22",
    agreementVersion: "2026.06"
  },
  {
    id: "AUTH-002",
    distributorName: "陈凯",
    socialAccount: "凯哥剪货",
    ipName: "林哥数码",
    platform: "抖音",
    status: "paused",
    shareRate: 30,
    dailyClaimLimit: 0,
    startsAt: "2026-06-19",
    expiresAt: "2026-08-19",
    agreementVersion: "2026.06",
    pausedReason: "连续违规，等待运营复核。"
  }
];

export const distributionTasks: DistributionTask[] = [
  {
    id: "DT-001",
    title: "晴姐通勤套装 7 日起量任务",
    ipName: "晴姐穿搭",
    platform: "视频号",
    materialIds: ["CLIP-001"],
    productName: "冰感通勤套装",
    status: "open",
    startAt: "2026-06-23",
    endAt: "2026-06-30",
    rewardRule: "核验通过后按佣金 40% 结算，单条 GMV 超 5000 额外奖励 80 元。",
    claimLimit: 120,
    claimedCount: 32,
    publishedCount: 21,
    requirement: "发布到已审核视频号账号，必须挂指定商品链接，不得使用全网最低等绝对化话术。"
  },
  {
    id: "DT-002",
    title: "老许厨房收纳承重演示任务",
    ipName: "老许家居",
    platform: "抖音",
    materialIds: ["CLIP-002"],
    productName: "免打孔厨房置物架",
    status: "open",
    startAt: "2026-06-23",
    endAt: "2026-07-02",
    rewardRule: "基础分成 35%，前 20 条核验通过作品额外 30 元。",
    claimLimit: 80,
    claimedCount: 12,
    publishedCount: 5,
    requirement: "需突出免打孔和承重演示，禁止夸大承重。"
  }
];

export const taskClaims: TaskClaim[] = [
  {
    id: "CLAIM-001",
    taskId: "DT-001",
    distributorName: "周婧",
    socialAccount: "小周好物局",
    materialTitle: "晴姐讲解夏季通勤套装三件套",
    productName: "冰感通勤套装",
    platform: "视频号",
    status: "submitted",
    claimToken: "CP-CLAIM-001",
    downloadExpiresAt: "2026-06-23 23:59",
    claimedAt: "2026-06-22 11:10",
    submittedUrl: "https://example.com/channels/work/valid-001"
  },
  {
    id: "CLAIM-002",
    taskId: "DT-002",
    distributorName: "李晨",
    socialAccount: "晨剪精选",
    materialTitle: "老许演示免打孔置物架承重",
    productName: "免打孔厨房置物架",
    platform: "抖音",
    status: "downloaded",
    claimToken: "CP-CLAIM-002",
    downloadExpiresAt: "2026-06-23 23:59",
    claimedAt: "2026-06-22 14:30"
  }
];

export const walletTransactions: WalletTransaction[] = [
  {
    id: "WT-001",
    distributorName: "周婧",
    type: "commission",
    amount: 772,
    status: "available",
    source: "晴姐通勤套装作品 PUB-001",
    note: "平台佣金 1929 元，按授权分成 40% 计入。",
    createdAt: "2026-06-22 11:50"
  },
  {
    id: "WT-002",
    distributorName: "陈凯",
    type: "freeze",
    amount: -648,
    status: "frozen",
    source: "林哥麦克风作品 PUB-003",
    note: "作品不合规且授权账号暂停，结算冻结。",
    createdAt: "2026-06-21 20:30"
  }
];

export const creditScoreEvents: CreditScoreEvent[] = [
  {
    id: "CREDIT-001",
    distributorName: "周婧",
    delta: 2,
    reason: "连续 7 日按时回填发布链接。",
    createdAt: "2026-06-22 20:00"
  },
  {
    id: "CREDIT-002",
    distributorName: "陈凯",
    delta: -30,
    reason: "授权账号发布后删除作品，且存在商品挂载异常。",
    createdAt: "2026-06-21 20:16"
  }
];

export const notifications: Notification[] = [
  {
    id: "NOTICE-001",
    audience: "partner",
    title: "晴姐通勤套装新增任务",
    content: "任务开放 7 天，核验通过后按授权分成结算，请使用指定商品链接。",
    createdAt: "2026-06-23 09:00",
    isRead: false
  },
  {
    id: "NOTICE-002",
    audience: "admin",
    title: "老许家居授权池接近满额",
    content: "当前授权池已用 284/300，请评估是否暂停申请或扩容。",
    createdAt: "2026-06-23 09:20",
    isRead: false
  }
];

export const clipTasks: ClipTask[] = [
  {
    id: "TASK-001",
    recordingTitle: "晴姐 6 月 21 日晚场录屏",
    ipName: "晴姐穿搭",
    sourcePlatform: "视频号",
    status: "completed",
    progress: 100,
    outputCount: 3,
    errorMessage: "",
    createdAt: "2026-06-22 09:18"
  },
  {
    id: "TASK-002",
    recordingTitle: "老许家居置物架专场录屏",
    ipName: "老许家居",
    sourcePlatform: "抖音",
    status: "processing",
    progress: 62,
    outputCount: 0,
    errorMessage: "",
    createdAt: "2026-06-22 13:40"
  },
  {
    id: "TASK-003",
    recordingTitle: "林哥数码麦克风测试录屏",
    ipName: "林哥数码",
    sourcePlatform: "抖音",
    status: "failed",
    progress: 38,
    outputCount: 0,
    errorMessage: "模拟失败：FFmpeg 服务暂未配置。",
    createdAt: "2026-06-22 15:25"
  }
];

export const products: Product[] = [
  {
    id: "PROD-001",
    name: "冰感通勤套装",
    platform: "抖音",
    affiliateUrl: "https://example.com/fashion-set",
    commissionRate: 15,
    isActive: true,
    materialCount: 1,
    createdAt: "2026-06-22"
  },
  {
    id: "PROD-002",
    name: "免打孔厨房置物架",
    platform: "视频号",
    affiliateUrl: "https://example.com/kitchen-shelf",
    commissionRate: 18,
    isActive: true,
    materialCount: 1,
    createdAt: "2026-06-22"
  },
  {
    id: "PROD-003",
    name: "领夹无线麦克风",
    platform: "抖音",
    affiliateUrl: "https://example.com/wireless-mic",
    commissionRate: 12,
    isActive: false,
    materialCount: 1,
    createdAt: "2026-06-22"
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

export const riskRecords: RiskRecord[] = [
  {
    id: "RISK-001",
    platform: "抖音",
    account: "好物搬运站",
    issue: "疑似未授权搬运晴姐穿搭素材",
    workUrl: "https://example.com/douyin/work/001",
    status: "open",
    createdAt: "2026-06-22 15:20"
  },
  {
    id: "RISK-002",
    platform: "视频号",
    account: "家居精选合集",
    issue: "作品挂载非平台指定商品链接",
    workUrl: "https://example.com/channels/work/002",
    status: "warning",
    createdAt: "2026-06-22 16:05"
  },
  {
    id: "RISK-003",
    platform: "抖音",
    account: "凯哥剪货",
    issue: "授权账号发布后删除作品，结算冻结",
    workUrl: "https://example.com/douyin/work/003",
    status: "blocked",
    createdAt: "2026-06-21 20:16"
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
