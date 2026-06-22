import { getIntegrationReadiness } from "@/lib/integration-config";
import { withApiLogging } from "@/lib/server-observability";

export async function GET(request: Request) {
  return withApiLogging(request, "/api/integrations", () => {
    return Response.json({
      integrations: getIntegrationReadiness()
    });
  });
}
