import assert from "node:assert/strict";
import test from "node:test";

import { createAuthProvider, createMockAuthProvider } from "../lib/providers/auth-provider.ts";
import { createProviderAdapters } from "../lib/providers/index.ts";
import { getRuntimeMode, parseRuntimeMode } from "../lib/providers/runtime.ts";
import { createMockPaymentProvider, createPaymentProvider } from "../lib/providers/payment-provider.ts";
import { createMockPlatformDataProvider, createPlatformDataProvider } from "../lib/providers/platform-data-provider.ts";
import { createMockVideoProvider, createVideoProvider } from "../lib/providers/video-provider.ts";

function memoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

test("runtime mode parser defaults invalid and missing values to mock", () => {
  assert.equal(parseRuntimeMode(undefined), "mock");
  assert.equal(parseRuntimeMode(""), "mock");
  assert.equal(parseRuntimeMode("unknown"), "mock");
  assert.equal(parseRuntimeMode("hybrid"), "hybrid");
  assert.equal(parseRuntimeMode("real"), "real");
  assert.equal(getRuntimeMode({ NEXT_PUBLIC_RUNTIME_MODE: "real" }), "real");
});

test("mock auth provider accepts demo users and rejects wrong passwords", () => {
  const provider = createMockAuthProvider(memoryStorage());

  const session = provider.login("admin", "admin123");
  assert.equal(session?.role, "admin");
  assert.equal(provider.getStoredSession()?.username, "admin");

  assert.equal(provider.login("admin", "wrong-password"), null);

  const partnerSession = provider.loginAs("partner");
  assert.equal(partnerSession?.role, "partner");

  provider.logout();
  assert.equal(provider.getStoredSession(), null);
});

test("auth provider factory keeps mock login out of real mode", () => {
  const storage = memoryStorage();
  const provider = createAuthProvider("real", storage);

  assert.equal(provider.login("admin", "admin123"), null);
  assert.equal(provider.loginAs("admin"), null);
  assert.equal(provider.getStoredSession(), null);
});

test("mock platform provider verifies valid urls and rejects empty or risk urls", async () => {
  const provider = createMockPlatformDataProvider();

  assert.deepEqual(await provider.verifyPublishUrl({ publishUrl: "", productName: "A", platform: "douyin" }), {
    status: "invalid",
    reason: "Publish URL is required"
  });
  assert.equal(
    (await provider.verifyPublishUrl({ publishUrl: "https://example.com/risk-work", productName: "A", platform: "douyin" }))
      .status,
    "invalid"
  );
  assert.equal(
    (await provider.verifyPublishUrl({ publishUrl: "https://example.com/valid-work", productName: "A", platform: "douyin" }))
      .status,
    "verified"
  );

  assert.deepEqual(
    await provider.importPerformanceRows([
      { publishUrl: "https://example.com/valid", gmv: 100, commission: 10 },
      { publishUrl: "", gmv: 100, commission: 10 }
    ]),
    { accepted: 1, rejected: 1 }
  );
});

test("mock video and payment providers return deterministic local results", async () => {
  const videoProvider = createMockVideoProvider();
  const paymentProvider = createMockPaymentProvider();

  assert.deepEqual(
    await videoProvider.createClipTask({ recordingTitle: "Live A", ipName: "IP A", sourcePlatform: "douyin" }),
    { taskId: "mock-clip-live-a-ip-a-douyin" }
  );
  assert.deepEqual(await videoProvider.completeClipTask("task-1"), { outputCount: 3 });
  assert.equal((await videoProvider.createDownloadToken("claim-1")).token, "mock-download-claim-1");

  assert.deepEqual(
    await paymentProvider.createPayoutRecord({ distributorName: "Partner A", amount: 100, source: "SET-1" }),
    { paymentId: "mock-payout-partner-a-set-1", status: "pending" }
  );
  assert.deepEqual(
    await paymentProvider.freezeWalletAmount({ distributorName: "Partner A", source: "RISK-1", note: "risk" }),
    { status: "frozen" }
  );
});

test("provider factories centralize runtime mode selection", async () => {
  assert.equal(createAuthProvider("mock", memoryStorage()).login("admin", "admin123")?.role, "admin");
  assert.equal(
    (await createPlatformDataProvider("hybrid").verifyPublishUrl({
      publishUrl: "https://example.com/valid-work",
      productName: "A",
      platform: "douyin"
    })).status,
    "verified"
  );

  assert.equal(
    (await createPlatformDataProvider("real").verifyPublishUrl({
      publishUrl: "https://example.com/valid-work",
      productName: "A",
      platform: "douyin"
    })).status,
    "manual_review"
  );
  assert.match(
    (await createVideoProvider("real").createClipTask({
      recordingTitle: "Live A",
      ipName: "IP A",
      sourcePlatform: "douyin"
    })).taskId,
    /^local-clip-/
  );
  assert.match(
    (await createPaymentProvider("real").createPayoutRecord({
      distributorName: "Partner A",
      amount: 100,
      source: "SET-1"
    })).paymentId,
    /^manual-payout-/
  );

  const adapters = createProviderAdapters("hybrid", memoryStorage());
  assert.equal(adapters.auth.login("admin", "admin123")?.role, "admin");
  assert.equal((await adapters.video.completeClipTask("task-1")).outputCount, 3);
});
