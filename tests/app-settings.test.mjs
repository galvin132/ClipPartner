import assert from "node:assert/strict";
import test from "node:test";

import {
  readAppSettings,
  readRemoteAppSettings,
  writeAppSettings,
  writeRemoteAppSettings
} from "../lib/app-settings.ts";

function installLocalStorage() {
  const store = new Map();
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key)
      }
    }
  });
  return () => {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }
  };
}

test("remote app settings read and write through the Worker admin API", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const calls = [];

  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.test";
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ input: String(input), init });
    if ((init.method ?? "GET") === "PATCH") {
      return Response.json({
        settings: {
          runtimeMode: "real",
          commissionShare: 60,
          dailyClaimLimit: 12,
          riskKeywords: ["risk"]
        }
      });
    }
    return Response.json({
      settings: {
        runtimeMode: "hybrid",
        commissionShare: 45,
        dailyClaimLimit: 8,
        riskKeywords: ["搬运", "refund"]
      }
    });
  };

  try {
    assert.deepEqual(await readRemoteAppSettings(), {
      runtimeMode: "hybrid",
      commissionShare: 45,
      dailyClaimLimit: 8,
      riskKeywords: ["搬运", "refund"]
    });

    assert.deepEqual(
      await writeRemoteAppSettings({
        runtimeMode: "real",
        commissionShare: 60,
        dailyClaimLimit: 12,
        riskKeywords: ["risk"]
      }),
      {
        runtimeMode: "real",
        commissionShare: 60,
        dailyClaimLimit: 12,
        riskKeywords: ["risk"]
      }
    );
    assert.equal(calls[1].input, "https://api.test/admin/settings");
    assert.equal(calls[1].init.method, "PATCH");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBase;
    }
  }
});

test("local app settings fallback uses the same daily claim limit range as the Worker", () => {
  const restore = installLocalStorage();
  try {
    writeAppSettings({
      runtimeMode: "hybrid",
      commissionShare: 50,
      dailyClaimLimit: 5000,
      riskKeywords: ["risk"]
    });

    assert.equal(readAppSettings().dailyClaimLimit, 5000);
  } finally {
    restore();
  }
});
