import assert from "node:assert/strict";
import test from "node:test";

import { integrationConfigs, providerIntegrationConfigs } from "../lib/integration-config.ts";

test("frontend integration config metadata uses backend provider keys", () => {
  assert.equal(providerIntegrationConfigs.some((item) => item.key === "wechat_oauth"), true);
  assert.equal(providerIntegrationConfigs.some((item) => item.key === "tencent_identity"), true);
  assert.equal(providerIntegrationConfigs.some((item) => item.key === "wechatOAuth"), false);
  assert.equal(integrationConfigs.some((item) => item.key === "supabase"), true);
  assert.equal(integrationConfigs.some((item) => item.key === "cloudflareQueue"), true);
  assert.equal(integrationConfigs.some((item) => item.key === "cloudflareQueues"), false);
});
