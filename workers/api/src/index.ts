/// <reference types="@cloudflare/workers-types" />

export interface Env {
  APP_ENV: string;
  FRONTEND_ORIGIN: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WECHAT_OAUTH_APP_ID?: string;
  WECHAT_OAUTH_APP_SECRET?: string;
  WECHAT_OAUTH_REDIRECT_URI?: string;
  FFMPEG_WORKER_ENDPOINT?: string;
  FFMPEG_WORKER_TOKEN?: string;
  CLIP_PARTNER_BUCKET: R2Bucket;
  CLIP_TASK_QUEUE: Queue;
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

function corsHeaders(env: Env) {
  return {
    "access-control-allow-origin": env.FRONTEND_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  };
}

function json(data: unknown, env: Env, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...corsHeaders(env),
      ...init.headers
    }
  });
}

function integrationStatus(env: Env) {
  const groups = [
    {
      key: "supabase",
      required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    },
    {
      key: "wechatOAuth",
      required: ["WECHAT_OAUTH_APP_ID", "WECHAT_OAUTH_APP_SECRET", "WECHAT_OAUTH_REDIRECT_URI"]
    },
    {
      key: "ffmpegWorker",
      required: ["FFMPEG_WORKER_ENDPOINT", "FFMPEG_WORKER_TOKEN"]
    }
  ];

  return groups.map((group) => {
    const configured = group.required.filter((key) => Boolean(env[key as keyof Env]));
    return {
      key: group.key,
      configuredCount: configured.length,
      totalCount: group.required.length,
      missingKeys: group.required.filter((key) => !env[key as keyof Env]),
      isConfigured: configured.length === group.required.length
    };
  });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === "/health") {
      return json({ service: "clip-partner-api", runtime: "cloudflare-workers", status: "ok" }, env);
    }

    if (url.pathname === "/integrations") {
      return json({ integrations: integrationStatus(env) }, env);
    }

    if (url.pathname === "/clip-tasks" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      await env.CLIP_TASK_QUEUE.send({
        type: "clip.create",
        payload: body,
        createdAt: new Date().toISOString()
      });

      return json({ ok: true, queued: true }, env, { status: 202 });
    }

    return json({ error: "Not found" }, env, { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await env.CLIP_TASK_QUEUE.send({
      type: "cron.scan",
      createdAt: new Date().toISOString()
    });
  }
};

export default worker;
