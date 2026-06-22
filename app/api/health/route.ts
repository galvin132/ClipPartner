import { withApiLogging } from "@/lib/server-observability";

export async function GET(request: Request) {
  return withApiLogging(request, "/api/health", () => {
    return Response.json({
      service: "clip-partner",
      status: "ok"
    });
  });
}
