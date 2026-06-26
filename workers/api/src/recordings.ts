/// <reference types="@cloudflare/workers-types" />

import { AwsClient } from "aws4fetch";
import { z } from "zod";

import type { WorkerEnv } from "./env.ts";
import { ApiError } from "./errors.ts";
import { eq, first } from "./query-utils.ts";
import { insertRow, selectRows } from "./supabase-rest.ts";

type PlatformValue = "douyin" | "wechat_channels";
const WECHAT_CHANNELS_LABEL = "视频号";

export type DirectUploadInitInput = {
  title: string;
  ipName: string;
  sourcePlatform: string;
  fileName: string;
  contentType?: string;
  size?: number;
};

export type DirectUploadCompleteInput = {
  uploadId: string;
  key: string;
  title: string;
  ipName: string;
  sourcePlatform: string;
};

export type RecordingUploadMeta = {
  title: string;
  ipName: string;
  sourcePlatform: string;
};

export type RecordingUploadResult = {
  recordingId: string;
  clipAssetId: string;
  r2Key: string;
  meta: RecordingUploadMeta;
};

export type ClipTaskPayload = {
  type: "clip.create" | "cron.scan";
  taskId: string;
  recordingId?: string;
  clipAssetId?: string;
  r2Key?: string;
  meta?: RecordingUploadMeta;
  createdAt: string;
};

type RecordingDeps = {
  findOrCreateIp: (env: WorkerEnv, name: string, platform: string) => Promise<{ id: string }>;
  toPlatformValue: (value: string | undefined) => PlatformValue;
};

const uploadMetaSchema = z.object({
  title: z.string().trim().min(1).max(160),
  ipName: z.string().trim().min(1).max(120),
  sourcePlatform: z.union([z.literal("douyin"), z.literal("wechat_channels"), z.literal("抖音"), z.literal("视频号")])
});

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function createRecordingAsset(
  env: WorkerEnv,
  deps: RecordingDeps,
  meta: RecordingUploadMeta,
  key: string
): Promise<RecordingUploadResult> {
  const ip = await deps.findOrCreateIp(env, meta.ipName, meta.sourcePlatform);
  const recording = await insertRow<{ id: string }>(env, "live_recordings", {
    ip_account_id: ip.id,
    source_platform: deps.toPlatformValue(meta.sourcePlatform),
    live_date: new Date().toISOString().slice(0, 10),
    title: meta.title,
    r2_key: key
  });

  const clip = await insertRow<{ id: string }>(env, "clip_assets", {
    live_recording_id: recording.id,
    ip_account_id: ip.id,
    title: `${meta.title} - pending clip`,
    status: "processing",
    tags: ["recording-upload", "pending-clip"],
    start_second: 0,
    end_second: 0
  });

  return {
    recordingId: recording.id,
    clipAssetId: clip.id,
    r2Key: key,
    meta
  };
}

export async function uploadRecording(env: WorkerEnv, request: Request, deps: RecordingDeps): Promise<RecordingUploadResult> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiError("missing_recording_file", "Missing recording file", 400);
  }

  const meta: RecordingUploadMeta = {
    title: String(form.get("title") || file.name || "Uploaded recording pending clip"),
    ipName: String(form.get("ipName") || "Demo IP"),
    sourcePlatform: String(form.get("sourcePlatform") || WECHAT_CHANNELS_LABEL)
  };
  const parsed = uploadMetaSchema.safeParse(meta);
  if (!parsed.success) {
    throw new ApiError("validation_error", "Upload metadata validation failed", 422, z.flattenError(parsed.error));
  }

  const key = `recordings/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

  await env.CLIP_PARTNER_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    },
    customMetadata: {
      title: meta.title,
      ipName: meta.ipName,
      sourcePlatform: deps.toPlatformValue(meta.sourcePlatform)
    }
  });

  return createRecordingAsset(env, deps, meta, key);
}

function requireR2Signing(env: WorkerEnv) {
  const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"].filter(
    (key) => !env[key as keyof WorkerEnv]
  );
  if (missing.length) {
    throw new ApiError("r2_signing_not_configured", "R2 direct upload signing is not configured", 503, { missing });
  }

  return {
    accountId: env.R2_ACCOUNT_ID as string,
    accessKeyId: env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
    bucketName: env.R2_BUCKET_NAME as string
  };
}

export async function createDirectUpload(env: WorkerEnv, input: DirectUploadInitInput) {
  const config = requireR2Signing(env);
  const uploadId = crypto.randomUUID();
  const contentType = input.contentType || "application/octet-stream";
  const key = `recordings/uploads/${new Date().toISOString().slice(0, 10)}/${uploadId}-${safeFileName(input.fileName)}`;
  const url = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${key}`;
  const signer = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 0
  });
  const signed = await signer.sign(url, {
    method: "PUT",
    headers: {
      "content-type": contentType
    },
    aws: {
      signQuery: true,
      allHeaders: true
    }
  });

  return {
    uploadId,
    key,
    uploadUrl: signed.url,
    method: "PUT",
    expiresIn: 900,
    expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
    headers: {
      "content-type": contentType
    }
  };
}

export async function completeDirectUpload(
  env: WorkerEnv,
  input: DirectUploadCompleteInput,
  deps: RecordingDeps
) {
  if (!input.key.startsWith("recordings/uploads/") || !input.key.includes(input.uploadId)) {
    throw new ApiError("invalid_upload_key", "Upload key does not match the upload session", 400);
  }

  const object = await env.CLIP_PARTNER_BUCKET.head(input.key);
  if (!object) {
    throw new ApiError("upload_not_found", "Uploaded object was not found in R2", 404);
  }

  return createRecordingAsset(
    env,
    deps,
    {
      title: input.title,
      ipName: input.ipName,
      sourcePlatform: input.sourcePlatform
    },
    input.key
  );
}

async function createClipTask(env: WorkerEnv, upload: RecordingUploadResult) {
  const dedupeKey = `clip.create:${upload.clipAssetId}`;
  try {
    const existing = await selectRows<{ id: string }>(env, "clip_tasks", `select=id&${eq("dedupe_key", dedupeKey)}&limit=1`);
    if (first(existing)) {
      return first(existing).id;
    }

    const task = await insertRow<{ id: string }>(env, "clip_tasks", {
      type: "clip.create",
      dedupe_key: dedupeKey,
      recording_id: upload.recordingId,
      clip_asset_id: upload.clipAssetId,
      r2_key: upload.r2Key,
      status: "queued",
      payload: upload
    });
    return task.id;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "clip_tasks table unavailable; queueing without persistent task record",
        detail: error instanceof Error ? error.message : "Unknown error"
      })
    );
    return dedupeKey;
  }
}

export async function queueClipTask(env: WorkerEnv, upload: RecordingUploadResult) {
  const taskId = await createClipTask(env, upload);
  const payload: ClipTaskPayload = {
    type: "clip.create",
    taskId,
    recordingId: upload.recordingId,
    clipAssetId: upload.clipAssetId,
    r2Key: upload.r2Key,
    meta: upload.meta,
    createdAt: new Date().toISOString()
  };

  return env.CLIP_TASK_QUEUE.send(payload);
}
