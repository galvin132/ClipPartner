import { getRuntimeMode, type RuntimeMode } from "./runtime.ts";

export type PaymentProvider = {
  createPayoutRecord: (input: {
    distributorName: string;
    amount: number;
    source: string;
  }) => Promise<{ paymentId: string; status: "pending" | "paid" }>;
  freezeWalletAmount: (input: { distributorName: string; source: string; note: string }) => Promise<{ status: "frozen" }>;
};

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createMockPaymentProvider(): PaymentProvider {
  return {
    async createPayoutRecord(input) {
      return {
        paymentId: `mock-payout-${slug(input.distributorName)}-${slug(input.source)}`,
        status: "pending"
      };
    },
    async freezeWalletAmount() {
      return { status: "frozen" };
    }
  };
}

export function createManualPaymentProvider(): PaymentProvider {
  return {
    async createPayoutRecord(input) {
      return {
        paymentId: `manual-payout-${slug(input.distributorName)}-${slug(input.source)}`,
        status: "pending"
      };
    },
    async freezeWalletAmount() {
      return { status: "frozen" };
    }
  };
}

export function createPaymentProvider(mode: RuntimeMode = getRuntimeMode()): PaymentProvider {
  return mode === "real" ? createManualPaymentProvider() : createMockPaymentProvider();
}

export const paymentProvider = createPaymentProvider();
