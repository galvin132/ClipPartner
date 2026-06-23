import { z } from "zod";

import { ApiError } from "./errors.ts";
import type { WorkerEnv } from "./env.ts";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

export function corsHeaders(env: WorkerEnv) {
  return {
    "access-control-allow-origin": env.FRONTEND_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-clip-role,x-clip-user-id,x-clip-display-name,x-clip-auth-provider"
  };
}

export function json(data: unknown, env: WorkerEnv, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...corsHeaders(env),
      ...init.headers
    }
  });
}

export function errorJson(error: unknown, env: WorkerEnv) {
  if (error instanceof ApiError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      env,
      { status: error.status }
    );
  }

  return json(
    {
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error"
      }
    },
    env,
    { status: 500 }
  );
}

export function logError(request: Request, error: unknown) {
  console.error(
    JSON.stringify({
      level: "error",
      path: new URL(request.url).pathname,
      message: error instanceof Error ? error.message : "Unknown error"
    })
  );
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>) {
  const body = await request.json().catch(() => {
    throw new ApiError("invalid_json", "Request body must be valid JSON", 400);
  });
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError("validation_error", "Request body validation failed", 422, z.flattenError(parsed.error));
  }

  return parsed.data;
}
