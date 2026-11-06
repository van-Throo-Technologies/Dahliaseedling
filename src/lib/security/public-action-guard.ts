import "server-only";

import { notFound } from "next/navigation";
import { publicSurfaceActive } from "./public-surface";

/*
 * Every server action outside the public invitation journey calls this as its first statement. On the public surface it ends the request
 * as not found before any business logic, session lookup or database call runs. Next.js dispatches an action by its identifier on any
 * route, so the route allowlist alone cannot stop an action, and this guard is the control for it.
 */
export function refuseOnPublicSurface(): void {
  if (publicSurfaceActive(process.env)) notFound();
}
