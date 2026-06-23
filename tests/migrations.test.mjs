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
