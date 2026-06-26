import { isMockAuthAllowed } from "./auth-policy.ts";
import { loadIntegrationRuntimeConfig } from "./config-center.ts";
import type { WorkerEnv } from "./env.ts";
import { ApiError } from "./errors.ts";
import { buildListQuery, first, formatDateTime, isUuid, listMeta, listOptions, safeRows, type ListOptions } from "./query-utils.ts";
import { insertRow, patchRows, selectRows } from "./supabase-rest.ts";

export type FfmpegJobInput = {
  clipTaskId: string;
  r2Key: string;
  outputPrefix?: string;
};

export type FfmpegJobPatchInput = {
  status: "queued" | "processing" | "completed" | "failed" | "pending_external_config";
  message?: string;
};

export type FfmpegWebhookInput = {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  message?: string;
};

export async function listFfmpegJobs(env: WorkerEnv, options = listOptions(new URLSearchParams())) {
  const rows = await safeRows(() =>
    selectRows<{
      id: string;
      status: string;
      payload: Record<string, unknown> | null;
      last_error: string | null;
      queued_at: string | null;
      updated_at: string | null;
    }>(
      env,
      "clip_tasks",
      buildListQuery("select=id,status,payload,last_error,queued_at,updated_at", "order=queued_at.desc", options, [])
    )
  );
  const ffmpegJobs = rows.map((row) => ({
    id: row.id,
    status: publicFfmpegStatus(row.status, row.payload),
    payload: row.payload ?? {},
    message: row.last_error ?? "",
    queuedAt: formatDateTime(row.queued_at),
    updatedAt: formatDateTime(row.updated_at)
  }));
  return { items: ffmpegJobs, meta: listMeta(ffmpegJobs, options) };
}

function publicFfmpegStatus(dbStatus: string, payload: Record<string, unknown> | null) {
  if (payload?.externalConfigured === false && dbStatus === "queued") return "pending_external_config";
  if (dbStatus === "running") return "processing";
  if (dbStatus === "succeeded") return "completed";
  return dbStatus;
}

function ffmpegTaskStatus(status: FfmpegJobPatchInput["status"] | "queued") {
  if (status === "processing") return "running";
  if (status === "completed") return "succeeded";
  if (status === "pending_external_config") return "queued";
  return status;
}

export async function createFfmpegJob(env: WorkerEnv, input: FfmpegJobInput) {
  const config = await loadIntegrationRuntimeConfig(env, "ffmpeg");
  const isConfigured = Boolean(
    config.enabled &&
      config.validation.status === "configured" &&
      config.publicConfig.endpoint &&
      config.secrets.token
  );
  const status = isConfigured ? "queued" : "pending_external_config";
  const payload = {
    type: "ffmpeg.job",
    sourceClipTaskId: input.clipTaskId,
    r2Key: input.r2Key,
    outputPrefix: input.outputPrefix ?? "",
    externalConfigured: isConfigured
  };
  const updated = isUuid(input.clipTaskId)
    ? await patchRows<{ id: string }>(env, "clip_tasks", `id=eq.${input.clipTaskId}`, {
        status: ffmpegTaskStatus(status),
        payload: {
          ...payload
        },
        last_error: isConfigured ? null : "FFmpeg worker endpoint is not configured",
        updated_at: new Date().toISOString()
      })
    : [];
  const existing = first(updated);
  const job =
    existing ??
    (await insertRow<{ id: string }>(env, "clip_tasks", {
      id: isUuid(input.clipTaskId) ? input.clipTaskId : undefined,
      type: "ffmpeg.job",
      dedupe_key: `ffmpeg:${input.clipTaskId}:${input.r2Key}`,
      r2_key: input.r2Key,
      status: ffmpegTaskStatus(status),
      payload: {
        ...payload
      },
      last_error: isConfigured ? null : "FFmpeg worker endpoint is not configured"
    }));
  return {
    id: job.id,
    status,
    externalConfigured: isConfigured,
    message: isConfigured ? "Queued for FFmpeg worker" : "FFmpeg worker endpoint is not configured"
  };
}

export async function getFfmpegJob(env: WorkerEnv, id: string) {
  const row = first(
    await safeRows(() =>
      selectRows<{
        id: string;
        status: string;
        payload: Record<string, unknown> | null;
        last_error: string | null;
        queued_at: string | null;
        updated_at: string | null;
      }>(env, "clip_tasks", `select=id,status,payload,last_error,queued_at,updated_at&id=eq.${id}&limit=1`)
    )
  );
  if (!row) throw new ApiError("not_found", "FFmpeg job not found", 404);
  return {
    id: row.id,
    status: publicFfmpegStatus(row.status, row.payload),
    payload: row.payload ?? {},
    message: row.last_error ?? "",
    queuedAt: formatDateTime(row.queued_at),
    updatedAt: formatDateTime(row.updated_at)
  };
}

export async function updateFfmpegJob(env: WorkerEnv, id: string, input: FfmpegJobPatchInput) {
  await patchRows(env, "clip_tasks", `id=eq.${id}`, {
    status: ffmpegTaskStatus(input.status),
    last_error: input.status === "failed" ? input.message ?? "FFmpeg job failed" : null,
    updated_at: new Date().toISOString()
  });
  await insertRow(env, "clip_task_logs", {
    clip_task_id: id,
    level: input.status === "failed" ? "error" : "info",
    message: input.message ?? `FFmpeg job ${input.status}`
  }).catch(() => undefined);
}

export async function handleFfmpegWebhook(env: WorkerEnv, token: string | null, input: FfmpegWebhookInput) {
  const config = await loadIntegrationRuntimeConfig(env, "ffmpeg");
  const configuredToken = config.enabled ? config.secrets.token : "";
  if (configuredToken) {
    if (token !== configuredToken) {
      throw new ApiError("forbidden", "Invalid FFmpeg webhook token", 403);
    }
  } else if (!isMockAuthAllowed(env)) {
    throw new ApiError("integration_not_configured", "FFmpeg webhook token is not configured", 503);
  }
  await updateFfmpegJob(env, input.jobId, { status: input.status, message: input.message });
  return input.jobId;
}
