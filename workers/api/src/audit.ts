import type { WorkerEnv } from "./env.ts";
import { insertRow } from "./supabase-rest.ts";

type AuditEventType = "credit_adjust" | "wallet_freeze" | "settlement_block";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function auditEvent(
  env: WorkerEnv,
  event: {
    type: AuditEventType;
    targetId: string;
    status: "ok" | "failed";
    detail: Record<string, unknown>;
    error?: string;
  }
) {
  try {
    await insertRow(env, "audit_events", {
      event_type: event.type,
      target_id: event.targetId,
      status: event.status,
      detail: event.detail,
      error_message: event.error ?? null,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "audit_event_persist_failed",
        event,
        error: errorMessage(error)
      })
    );
  }
}

export async function runAuditedSideEffect(
  env: WorkerEnv,
  event: Omit<Parameters<typeof auditEvent>[1], "status" | "error">,
  action: () => Promise<unknown>
) {
  try {
    await action();
    await auditEvent(env, { ...event, status: "ok" });
  } catch (error) {
    await auditEvent(env, { ...event, status: "failed", error: errorMessage(error) });
  }
}
