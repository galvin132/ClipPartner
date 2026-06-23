import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPublishVerificationResult,
  buildLocalClipTask,
  buildWalletTransactionFromProvider
} from "../lib/provider-actions.ts";

test("publish verification provider result maps to local publish record status", () => {
  const record = {
    id: "PUB-1",
    distributorName: "Partner A",
    materialTitle: "Clip A",
    productName: "Product A",
    platform: "抖音",
    status: "submitted",
    submittedAt: "2026-06-23 10:00:00",
    publishUrl: "https://example.com/valid",
    reviewNote: "",
    gmv: 0,
    commission: 0
  };

  assert.equal(
    applyPublishVerificationResult(record, { status: "verified", reason: "ok" }).status,
    "verified"
  );
  assert.equal(
    applyPublishVerificationResult(record, { status: "verified", reason: "ok" }).reviewNote,
    "平台核验通过：ok"
  );
  assert.equal(
    applyPublishVerificationResult(record, { status: "invalid", reason: "risk" }).status,
    "invalid"
  );
  assert.equal(
    applyPublishVerificationResult(record, { status: "invalid", reason: "risk" }).reviewNote,
    "平台核验拦截：risk"
  );
  assert.equal(
    applyPublishVerificationResult(record, { status: "manual_review", reason: "unclear" }).status,
    "submitted"
  );
  assert.equal(
    applyPublishVerificationResult(record, { status: "manual_review", reason: "unclear" }).reviewNote,
    "平台核验待人工复核：unclear"
  );
});

test("video provider result builds a local queued clip task", () => {
  assert.deepEqual(
    buildLocalClipTask(
      { recordingTitle: "Live A", ipName: "IP A", sourcePlatform: "douyin" },
      { taskId: "mock-task-1" },
      "2026-06-23 10:00:00"
    ),
    {
      id: "mock-task-1",
      recordingTitle: "Live A",
      ipName: "IP A",
      sourcePlatform: "douyin",
      status: "queued",
      progress: 0,
      outputCount: 0,
      errorMessage: "",
      createdAt: "2026-06-23 10:00:00"
    }
  );
});

test("payment provider result annotates local wallet transaction source", () => {
  const transaction = buildWalletTransactionFromProvider(
    {
      distributorName: "Partner A",
      type: "payout",
      amount: 100,
      status: "pending",
      source: "SET-1",
      note: "manual payout"
    },
    { paymentId: "mock-payout-1", status: "pending" },
    "WT-1",
    "2026-06-23 10:00:00"
  );

  assert.equal(transaction.id, "WT-1");
  assert.equal(transaction.source, "mock-payout-1");
  assert.equal(transaction.note, "manual payout");
});
