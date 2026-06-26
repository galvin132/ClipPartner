import type { UserRole } from "./auth.ts";

export function canEditBackendConfig(role: UserRole | null | undefined) {
  return role === "admin";
}

export function isRuntimeModeLocked(appEnv: string | undefined = process.env.NODE_ENV) {
  return appEnv === "production";
}
