export type VercelLogLevel = "info" | "warn" | "error";

export type VercelLogType =
  | "api_request_started"
  | "api_request_completed"
  | "api_request_failed"
  | "client_issue"
  | "device_issue";

type LogPayload = {
  level?: VercelLogLevel;
  log_type: VercelLogType;
  event: string;
  route?: string;
  method?: string;
  request_id?: string | null;
  vercel_id?: string | null;
  status?: number;
  ms?: number;
  [key: string]: unknown;
};

function writeLog(level: VercelLogLevel, payload: LogPayload) {
  const line = JSON.stringify({
    service: "clip-partner-web",
    level,
    ...payload
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

function getRequestContext(request: Request, route: string) {
  return {
    route,
    method: request.method,
    request_id: request.headers.get("x-request-id"),
    vercel_id: request.headers.get("x-vercel-id")
  };
}

export function logServerEvent(payload: LogPayload) {
  writeLog(payload.level ?? "info", payload);
}

export async function withApiLogging(
  request: Request,
  route: string,
  handler: () => Response | Promise<Response>
) {
  const start = Date.now();
  const context = getRequestContext(request, route);

  logServerEvent({
    ...context,
    log_type: "api_request_started",
    event: "request_started"
  });

  try {
    const response = await handler();
    logServerEvent({
      ...context,
      log_type: "api_request_completed",
      event: "request_completed",
      status: response.status,
      ms: Date.now() - start
    });
    return response;
  } catch (error) {
    logServerEvent({
      ...context,
      level: "error",
      log_type: "api_request_failed",
      event: "request_failed",
      ms: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    throw error;
  }
}
