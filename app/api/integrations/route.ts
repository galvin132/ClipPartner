import { getIntegrationReadiness } from "@/lib/integration-config";
import { withApiLogging } from "@/lib/server-observability";

export async function GET(request: Request) {
  return withApiLogging(request, "/api/integrations", async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
    if (apiBase) {
      try {
        const response = await fetch(`${apiBase}/integrations`, { cache: "no-store" });
        if (response.ok) {
          return Response.json(await response.json());
        }
      } catch {
        // Fall back to the local deployment environment snapshot below.
      }
    }

    return Response.json({
      integrations: getIntegrationReadiness()
    });
  });
}
