import { getRuntimeMode, type RuntimeMode } from "./runtime.ts";

export type PublishUrlVerificationInput = {
  publishUrl: string;
  productName: string;
  platform: string;
};

export type PublishUrlVerificationResult = {
  status: "verified" | "invalid" | "manual_review";
  reason: string;
};

export type PerformanceImportRow = {
  publishUrl: string;
  gmv: number;
  commission: number;
};

export type PlatformDataProvider = {
  verifyPublishUrl: (input: PublishUrlVerificationInput) => Promise<PublishUrlVerificationResult>;
  importPerformanceRows: (rows: PerformanceImportRow[]) => Promise<{ accepted: number; rejected: number }>;
};

function validatePublishInput(input: PublishUrlVerificationInput): PublishUrlVerificationResult | null {
  const publishUrl = input.publishUrl.trim();
  if (!publishUrl) {
    return { status: "invalid", reason: "Publish URL is required" };
  }
  if (!/^https?:\/\//i.test(publishUrl)) {
    return { status: "invalid", reason: "Publish URL must be an HTTP URL" };
  }
  if (publishUrl.toLowerCase().includes("risk")) {
    return { status: "invalid", reason: "Publish URL matched a local risk signal" };
  }
  if (!input.productName.trim() || !input.platform.trim()) {
    return { status: "manual_review", reason: "Product or platform is missing" };
  }
  return null;
}

export function createMockPlatformDataProvider(): PlatformDataProvider {
  return {
    async verifyPublishUrl(input) {
      const validation = validatePublishInput(input);
      if (validation) return validation;
      return { status: "verified", reason: "Mock platform verification passed" };
    },
    async importPerformanceRows(rows) {
      return rows.reduce(
        (summary, row) => {
          if (row.publishUrl.trim() && row.gmv >= 0 && row.commission >= 0) {
            summary.accepted += 1;
          } else {
            summary.rejected += 1;
          }
          return summary;
        },
        { accepted: 0, rejected: 0 }
      );
    }
  };
}

export function createManualPlatformDataProvider(): PlatformDataProvider {
  return {
    async verifyPublishUrl(input) {
      const validation = validatePublishInput(input);
      if (validation?.status === "invalid") return validation;
      return { status: "manual_review", reason: "Real platform verification is not configured yet" };
    },
    async importPerformanceRows(rows) {
      return { accepted: 0, rejected: rows.length };
    }
  };
}

export function createPlatformDataProvider(mode: RuntimeMode = getRuntimeMode()): PlatformDataProvider {
  return mode === "real" ? createManualPlatformDataProvider() : createMockPlatformDataProvider();
}

export const platformDataProvider = createPlatformDataProvider();
