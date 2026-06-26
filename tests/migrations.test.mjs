import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationText = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .map((file) => readFileSync(join("supabase/migrations", file), "utf8"))
  .join("\n");

test("Supabase migrations add Better Auth persistence and business user mapping", () => {
  assert.match(migrationText, /create schema if not exists auth_app/i);
  assert.match(migrationText, /create table if not exists auth_app\."user"/i);
  assert.match(migrationText, /create table if not exists public\.app_user_profiles/i);
  assert.match(migrationText, /better_auth_user_id/i);
});

test("Supabase migrations retract direct anon and authenticated business table access", () => {
  assert.match(migrationText, /revoke all on all tables in schema public from anon/i);
  assert.match(migrationText, /revoke all on all tables in schema public from authenticated/i);
  assert.match(migrationText, /grant select, insert, update, delete on all tables in schema public to service_role/i);
});

test("Supabase migrations add backend configuration tables with RLS", () => {
  assert.match(migrationText, /create table if not exists public\.system_settings/i);
  assert.match(migrationText, /commission_share/i);
  assert.match(migrationText, /risk_keywords/i);
  assert.match(migrationText, /create table if not exists public\.integration_configs/i);
  assert.match(migrationText, /encrypted_secrets/i);
  assert.match(migrationText, /secret_fingerprints/i);
  assert.match(migrationText, /alter table public\.system_settings enable row level security/i);
  assert.match(migrationText, /alter table public\.integration_configs enable row level security/i);
  assert.match(migrationText, /system_settings_service_role_all/i);
  assert.match(migrationText, /integration_configs_service_role_all/i);
});
