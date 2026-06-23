import type { ClipPartnerState } from "./local-store";

type PublishRecord = ClipPartnerState["publishRecords"][number];

const effectiveStatuses = new Set(["verified", "settled"]);
const distributorNameAliases: Record<string, string> = {
  "鍛ㄥ┃": "周婧",
  "鏉庢櫒": "李晨",
  "闄堝嚡": "陈凯"
};

export function displayDistributorName(name: string) {
  return distributorNameAliases[name] ?? name;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function isEffectiveRecord(record: PublishRecord) {
  return effectiveStatuses.has(record.status);
}

function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

function findMaterialForRecord(state: ClipPartnerState, record: PublishRecord) {
  return state.materials.find(
    (material) =>
      material.title === record.materialTitle ||
      record.materialTitle.includes(material.title) ||
      material.title.includes(record.materialTitle)
  );
}

function inferIpNameForRecord(state: ClipPartnerState, record: PublishRecord) {
  const material = findMaterialForRecord(state, record);
  if (material) return material.ipName;

  const task = state.distributionTasks.find(
    (item) => item.productName === record.productName || item.materialIds.some((id) => record.materialTitle.includes(id))
  );
  return task?.ipName ?? "未归因IP";
}

export type GrowthSummary = {
  totalGmv: number;
  effectivePosts: number;
  activeDistributors: number;
  payableCommission: number;
  riskIntercepts: number;
  roiMultiplier: number;
  contentOutputs: number;
  distributedWorks: number;
};

export type IpTalentPerformance = {
  ipName: string;
  platforms: string[];
  materialCount: number;
  publishedMaterialCount: number;
  claimCount: number;
  downloadCount: number;
  taskCount: number;
  productCount: number;
  effectivePosts: number;
  submittedPosts: number;
  invalidPosts: number;
  gmv: number;
  commission: number;
  riskCount: number;
};

export type DistributorPerformance = {
  name: string;
  posts: number;
  effectivePosts: number;
  submittedPosts: number;
  invalidPosts: number;
  gmv: number;
  commission: number;
  creditScore: number;
  violationCount: number;
};

export type ProductPerformance = {
  productName: string;
  platform: string;
  posts: number;
  effectivePosts: number;
  gmv: number;
  commission: number;
  materialCount: number;
};

export type MaterialPerformance = {
  id: string;
  title: string;
  ipName: string;
  productName: string;
  status: string;
  heat: number;
  claims: number;
  downloads: number;
  gmv: number;
  effectivePosts: number;
};

export type PartnerPersonalStats = {
  distributorName: string;
  estimatedIncome: number;
  availableIncome: number;
  frozenIncome: number;
  paidIncome: number;
  totalGmv: number;
  effectivePosts: number;
  pendingPublish: number;
  pendingReview: number;
  invalidPosts: number;
  activeAuthorizations: number;
  claimCount: number;
  availableTaskCount: number;
  rankByGmv: number;
  creditScore: number;
};

export function buildGrowthSummary(state: ClipPartnerState): GrowthSummary {
  const effectiveRecords = state.publishRecords.filter(isEffectiveRecord);
  const payableCommission = sum(
    state.settlements
      .filter((item) => item.status !== "paid" && item.status !== "blocked")
      .map((item) => item.payableCommission)
  );

  return {
    totalGmv: sum(state.publishRecords.map((record) => record.gmv)),
    effectivePosts: effectiveRecords.length,
    activeDistributors: uniqueCount(state.publishRecords.map((record) => record.distributorName)),
    payableCommission,
    riskIntercepts: state.publishRecords.filter((record) => record.status === "invalid").length + state.riskRecords.length,
    roiMultiplier: payableCommission > 0 ? sum(effectiveRecords.map((record) => record.gmv)) / payableCommission : 0,
    contentOutputs: state.materials.length,
    distributedWorks: state.publishRecords.length
  };
}

export function buildIpTalentPerformance(state: ClipPartnerState): IpTalentPerformance[] {
  const ipNames = new Set<string>();
  state.materials.forEach((item) => ipNames.add(item.ipName));
  state.distributionTasks.forEach((item) => ipNames.add(item.ipName));
  state.publishRecords.forEach((item) => ipNames.add(inferIpNameForRecord(state, item)));

  return Array.from(ipNames)
    .map((ipName) => {
      const materials = state.materials.filter((item) => item.ipName === ipName);
      const tasks = state.distributionTasks.filter((item) => item.ipName === ipName);
      const records = state.publishRecords.filter((item) => inferIpNameForRecord(state, item) === ipName);
      const products = new Set<string>();
      materials.forEach((item) => products.add(item.productName));
      tasks.forEach((item) => products.add(item.productName));
      records.forEach((item) => products.add(item.productName));
      const riskCount = state.riskRecords.filter((item) => {
        const haystack = [item.account, item.issue, item.workUrl].join(" ");
        return haystack.includes(ipName) || materials.some((material) => haystack.includes(material.title));
      }).length;

      return {
        ipName,
        platforms: Array.from(new Set([...materials.map((item) => item.sourcePlatform), ...tasks.map((item) => item.platform)])),
        materialCount: materials.length,
        publishedMaterialCount: materials.filter((item) => item.status === "published").length,
        claimCount: sum(materials.map((item) => item.claims)),
        downloadCount: sum(materials.map((item) => item.downloads)),
        taskCount: tasks.length,
        productCount: products.size,
        effectivePosts: records.filter(isEffectiveRecord).length,
        submittedPosts: records.filter((item) => item.status === "submitted").length,
        invalidPosts: records.filter((item) => item.status === "invalid").length,
        gmv: sum(records.map((item) => item.gmv)),
        commission: sum(records.map((item) => item.commission)),
        riskCount
      };
    })
    .sort((a, b) => b.gmv - a.gmv);
}

export function buildDistributorPerformance(state: ClipPartnerState): DistributorPerformance[] {
  const profilesByName = new Map(state.distributorProfiles.map((item) => [displayDistributorName(item.displayName), item]));

  return Object.values(
    state.publishRecords.reduce<Record<string, DistributorPerformance>>((acc, record) => {
      const name = displayDistributorName(record.distributorName);
      const profile = profilesByName.get(name);
      acc[name] ??= {
        name,
        posts: 0,
        effectivePosts: 0,
        submittedPosts: 0,
        invalidPosts: 0,
        gmv: 0,
        commission: 0,
        creditScore: profile?.creditScore ?? 100,
        violationCount: profile?.violationCount ?? 0
      };

      acc[name].posts += 1;
      acc[name].effectivePosts += isEffectiveRecord(record) ? 1 : 0;
      acc[name].submittedPosts += record.status === "submitted" ? 1 : 0;
      acc[name].invalidPosts += record.status === "invalid" ? 1 : 0;
      acc[name].gmv += record.gmv;
      acc[name].commission += record.commission;
      return acc;
    }, {})
  ).sort((a, b) => b.gmv - a.gmv);
}

export function buildProductPerformance(state: ClipPartnerState): ProductPerformance[] {
  const productsByName = new Map(state.products.map((item) => [item.name, item]));

  return Object.values(
    state.publishRecords.reduce<Record<string, ProductPerformance>>((acc, record) => {
      const product = productsByName.get(record.productName);
      acc[record.productName] ??= {
        productName: record.productName,
        platform: product?.platform ?? record.platform,
        posts: 0,
        effectivePosts: 0,
        gmv: 0,
        commission: 0,
        materialCount: product?.materialCount ?? state.materials.filter((item) => item.productName === record.productName).length
      };

      acc[record.productName].posts += 1;
      acc[record.productName].effectivePosts += isEffectiveRecord(record) ? 1 : 0;
      acc[record.productName].gmv += record.gmv;
      acc[record.productName].commission += record.commission;
      return acc;
    }, {})
  ).sort((a, b) => b.gmv - a.gmv);
}

export function buildMaterialPerformance(state: ClipPartnerState): MaterialPerformance[] {
  return state.materials
    .map((material) => {
      const records = state.publishRecords.filter(
        (record) =>
          record.materialTitle === material.title ||
          record.materialTitle.includes(material.title) ||
          material.title.includes(record.materialTitle)
      );

      return {
        id: material.id,
        title: material.title,
        ipName: material.ipName,
        productName: material.productName,
        status: material.status,
        heat: material.claims + material.downloads,
        claims: material.claims,
        downloads: material.downloads,
        gmv: sum(records.map((item) => item.gmv)),
        effectivePosts: records.filter(isEffectiveRecord).length
      };
    })
    .sort((a, b) => b.gmv + b.heat * 100 - (a.gmv + a.heat * 100));
}

export function buildPartnerPersonalStats(state: ClipPartnerState, distributorName: string): PartnerPersonalStats {
  const records = state.publishRecords.filter((item) => displayDistributorName(item.distributorName) === distributorName);
  const transactions = state.walletTransactions.filter((item) => displayDistributorName(item.distributorName) === distributorName);
  const claims = state.taskClaims.filter((item) => displayDistributorName(item.distributorName) === distributorName);
  const profile = state.distributorProfiles.find((item) => displayDistributorName(item.displayName) === distributorName);
  const distributorRank = buildDistributorPerformance(state);
  const rankIndex = distributorRank.findIndex((item) => item.name === distributorName);
  const activeAuthorizations = state.formalAuthorizations.filter(
    (item) => displayDistributorName(item.distributorName) === distributorName && item.status === "approved"
  );
  const availableTaskCount = state.distributionTasks.filter(
    (task) =>
      task.status === "open" &&
      task.claimedCount < task.claimLimit &&
      activeAuthorizations.some((auth) => auth.ipName === task.ipName && auth.platform === task.platform)
  ).length;

  return {
    distributorName,
    estimatedIncome: sum(records.filter(isEffectiveRecord).map((item) => item.commission)),
    availableIncome: sum(transactions.filter((item) => item.status === "available").map((item) => item.amount)),
    frozenIncome: sum(transactions.filter((item) => item.status === "frozen").map((item) => Math.abs(item.amount))),
    paidIncome: sum(
      state.settlements
        .filter((item) => displayDistributorName(item.distributorName) === distributorName && item.status === "paid")
        .map((item) => item.payableCommission)
    ),
    totalGmv: sum(records.map((item) => item.gmv)),
    effectivePosts: records.filter(isEffectiveRecord).length,
    pendingPublish: claims.filter((item) => ["claimed", "downloaded"].includes(item.status)).length,
    pendingReview: records.filter((item) => item.status === "submitted").length + claims.filter((item) => item.status === "submitted").length,
    invalidPosts: records.filter((item) => item.status === "invalid").length,
    activeAuthorizations: activeAuthorizations.length,
    claimCount: claims.length,
    availableTaskCount,
    rankByGmv: rankIndex >= 0 ? rankIndex + 1 : distributorRank.length + 1,
    creditScore: profile?.creditScore ?? 100
  };
}
