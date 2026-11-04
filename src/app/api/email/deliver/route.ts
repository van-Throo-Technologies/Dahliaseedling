import { emailIsConfigured, runConfiguredDelivery } from "@/modules/email/run-delivery";
import { handleDeliveryRequest } from "@/modules/email/delivery-route";

/*
 * Scheduled delivery of pending availability emails. The platform scheduler calls this with the deployment's CRON_SECRET. It is
 * not a public endpoint: without the secret, every request is refused before any outbox row is touched.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleDeliveryRequest(request, {
    secret: process.env.CRON_SECRET,
    notConfigured: () => !emailIsConfigured(),
    run: runConfiguredDelivery,
  });
}
