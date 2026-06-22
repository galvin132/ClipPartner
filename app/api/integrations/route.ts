import { getIntegrationReadiness } from "@/lib/integration-config";

export async function GET() {
  return Response.json({
    integrations: getIntegrationReadiness()
  });
}
