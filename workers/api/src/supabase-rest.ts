import { ApiError } from "./errors.ts";
import type { WorkerEnv } from "./env.ts";

export function requireSupabase(env: WorkerEnv) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiError("supabase_not_configured", "Supabase is not configured", 503);
  }

  return {
    restUrl: `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}

export async function supabase<T>(env: WorkerEnv, path: string, init: RequestInit = {}): Promise<T> {
  const { restUrl, serviceKey } = requireSupabase(env);
  const response = await fetch(`${restUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const status = response.status >= 500 ? 502 : response.status === 401 || response.status === 403 ? 503 : 400;
    throw new ApiError("supabase_request_failed", `Supabase ${response.status}: ${detail.slice(0, 500)}`, status, {
      upstreamStatus: response.status
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function selectRows<T>(env: WorkerEnv, table: string, query = "select=*") {
  return supabase<T[]>(env, `/${table}?${query}`);
}

export async function insertRow<T>(env: WorkerEnv, table: string, body: Record<string, unknown>) {
  return supabase<T[]>(env, `/${table}`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(body)
  }).then((rows) => rows[0]);
}

export async function patchRows<T>(env: WorkerEnv, table: string, filter: string, body: Record<string, unknown>) {
  return supabase<T[]>(env, `/${table}?${filter}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(body)
  });
}

export async function deleteByFilter(env: WorkerEnv, table: string, filter: string) {
  await supabase<void>(env, `/${table}?${filter}`, {
    method: "DELETE"
  });
}

export async function deleteRows(env: WorkerEnv, table: string) {
  await supabase<void>(env, `/${table}?id=not.is.null`, {
    method: "DELETE"
  });
}
