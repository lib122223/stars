import { apiSuccess } from "@/lib/api-response";
import { upcomingShowers } from "@/lib/astronomy/meteor-showers";

export async function GET() {
  const events = upcomingShowers();
  return apiSuccess({ events });
}
