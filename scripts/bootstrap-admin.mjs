import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.BETTER_AUTH_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const name = process.env.BOOTSTRAP_ADMIN_NAME || "ClipPartner Admin";

if (!connectionString) {
  throw new Error("Set BETTER_AUTH_DATABASE_URL, DATABASE_URL, POSTGRES_URL, or SUPABASE_DB_URL.");
}
if (!email || !password) {
  throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.");
}
if (password.length < 8) {
  throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
}

const pool = new Pool({
  connectionString,
  max: 1,
  options: "-c search_path=auth_app,public"
});

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

const client = await pool.connect();
try {
  await client.query("begin");

  const existing = await client.query('select id from auth_app."user" where email = $1 limit 1', [email]);
  const userId = existing.rows[0]?.id ?? id("usr");
  const passwordHash = await hashPassword(password);

  await client.query(
    `insert into auth_app."user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
     values ($1, $2, $3, 'admin', true, now(), now())
     on conflict (email) do update
       set name = excluded.name,
           role = 'admin',
           "emailVerified" = true,
           "updatedAt" = now()`,
    [userId, name, email]
  );

  await client.query(
    `insert into auth_app.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     values ($1, $2, 'credential', $2, $3, now(), now())
     on conflict ("providerId", "accountId") do update
       set password = excluded.password,
           "updatedAt" = now()`,
    [id("acc"), userId, passwordHash]
  );

  await client.query(
    `insert into public.app_user_profiles (better_auth_user_id, role, display_name, email, status, created_at, updated_at)
     values ($1, 'admin', $2, $3, 'active', now(), now())
     on conflict (better_auth_user_id) do update
       set role = 'admin',
           display_name = excluded.display_name,
           email = excluded.email,
           status = 'active',
           updated_at = now()`,
    [userId, name, email]
  );

  await client.query(
    `insert into public.audit_logs (action, entity_type, entity_id, after_data)
     values ('auth.bootstrap_admin', 'auth_app.user', $1, $2::jsonb)`,
    [userId, JSON.stringify({ email, role: "admin" })]
  ).catch(() => undefined);

  await client.query("commit");
  console.log(`Bootstrapped admin ${email} (${userId}).`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
