"use client";

import type { AuthSession } from "./auth.ts";
import { reportClientIssue } from "./client-observability.ts";

const AUTH_STORAGE_KEY = "clip-partner-auth-session-v1";
const AUTH_ROLES = new Set(["admin", "reviewer", "finance", "partner"]);

export function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
}

export function headersForSession(session: Partial<AuthSession> | null | undefined) {
  if (!session || typeof session.role !== "string" || !AUTH_ROLES.has(session.role)) return {};

  if (
    (session.authProvider === "better-auth" || session.authProvider === "supabase") &&
    typeof session.accessToken === "string" &&
    session.accessToken
  ) {
    return { authorization: `Bearer ${session.accessToken}` };
  }

  if (session.authProvider !== "mock") return {};

  return {
    "x-clip-role": session.role,
    "x-clip-user-id": typeof session.id === "string" ? session.id : `mock-${session.role}`,
    "x-clip-display-name": typeof session.displayName === "string" ? session.displayName : "",
    "x-clip-auth-provider": "mock"
  };
}

export function sessionHeaders() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return {};
    return headersForSession(JSON.parse(raw) as Partial<AuthSession>);
  } catch {
    return {};
  }
}

export async function apiJson<T>(path: string, init: RequestInit = {}) {
  const base = apiBase();
  if (!base) {
    return null;
  }

  const method = init.method ?? "GET";
  let response: Response;

  try {
    const headers = new Headers(init.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    Object.entries(sessionHeaders()).forEach(([key, value]) => headers.set(key, value));

    response = await fetch(`${base}${path}`, {
      ...init,
      credentials: init.credentials ?? "include",
      headers
    });
  } catch (error) {
    void reportClientIssue("api_error", error instanceof Error ? error.message : "API request failed", {
      severity: "error",
      feature: "remote_api",
      details: {
        method,
        path,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    });
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text();
    void reportClientIssue("api_error", `API ${method} ${path} failed with ${response.status}`, {
      severity: response.status >= 500 ? "error" : "warn",
      feature: "remote_api",
      details: {
        method,
        path,
        status: response.status,
        detail: detail.slice(0, 500)
      }
    });
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function optionalApiJson<T>(path: string) {
  try {
    return await apiJson<T>(path);
  } catch {
    return null;
  }
}
