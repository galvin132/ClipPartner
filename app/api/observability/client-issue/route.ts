import { z } from "zod";
import { logServerEvent, withApiLogging } from "@/lib/server-observability";

const deviceSchema = z
  .object({
    userAgent: z.string().max(2000).optional(),
    platform: z.string().max(120).optional(),
    platformVersion: z.string().max(80).optional(),
    browser: z.string().max(120).optional(),
    model: z.string().max(120).optional(),
    mobile: z.boolean().optional(),
    viewport: z.string().max(40).optional(),
    screen: z.string().max(40).optional(),
    dpr: z.number().optional(),
    memoryGb: z.number().optional(),
    connection: z.string().max(40).optional(),
    saveData: z.boolean().optional(),
    riskTags: z.array(z.string().max(80)).max(20).optional()
  })
  .optional();

const clientIssueSchema = z.object({
  issueType: z.enum([
    "app_loaded",
    "client_error",
    "unhandled_rejection",
    "api_error",
    "api_fallback",
    "upload_error",
    "sync_error",
    "device_issue"
  ]),
  severity: z.enum(["info", "warn", "error"]).default("warn"),
  message: z.string().max(1000),
  route: z.string().max(300).optional(),
  feature: z.string().max(120).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  device: deviceSchema
});

export async function POST(request: Request) {
  return withApiLogging(request, "/api/observability/client-issue", async () => {
    const payload = clientIssueSchema.parse(await request.json());
    const logType = payload.issueType === "device_issue" ? "device_issue" : "client_issue";

    logServerEvent({
      level: payload.severity,
      log_type: logType,
      event: payload.issueType,
      route: payload.route,
      feature: payload.feature,
      message: payload.message,
      device: payload.device
        ? {
            platform: payload.device.platform,
            platformVersion: payload.device.platformVersion,
            browser: payload.device.browser,
            model: payload.device.model,
            mobile: payload.device.mobile,
            viewport: payload.device.viewport,
            screen: payload.device.screen,
            dpr: payload.device.dpr,
            memoryGb: payload.device.memoryGb,
            connection: payload.device.connection,
            saveData: payload.device.saveData,
            riskTags: payload.device.riskTags
          }
        : undefined,
      details: payload.details
    });

    return Response.json({ ok: true });
  });
}
