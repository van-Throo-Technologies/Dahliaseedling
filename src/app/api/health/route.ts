import { getHealthStatus } from "@/lib/health/status";
import { publicSurfaceActive } from "@/lib/security/public-surface";

// Always evaluate at request time, so the status reflects the running environment.
export const dynamic = "force-dynamic";

/*
 * On the public surface the probe reports status only. The names of missing or malformed variables are for the operator, so they are not
 * returned to anonymous visitors.
 */
export function GET(): Response {
  const { httpStatus, body } = getHealthStatus(process.env, new Date());
  const publicBody =
    publicSurfaceActive(process.env) && body.status === "error"
      ? { status: "error", service: body.service, checkedAt: body.checkedAt, checks: body.checks }
      : body;

  return Response.json(publicBody, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}
