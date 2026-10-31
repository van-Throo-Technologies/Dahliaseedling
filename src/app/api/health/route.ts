import { getHealthStatus } from "@/lib/health/status";

// Always evaluate at request time, so the status reflects the running environment.
export const dynamic = "force-dynamic";

export function GET(): Response {
  const { httpStatus, body } = getHealthStatus(process.env, new Date());

  return Response.json(body, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}
