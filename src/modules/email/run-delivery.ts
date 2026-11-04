import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { deliverDueEmails, type DeliverySummary, type Rpc } from "./delivery";
import { readEmailConfig } from "./config";
import { createResendProvider } from "./resend-provider";

/*
 * Composes the production delivery run from the environment. It is the only place that connects the processor to Resend and to
 * the service client, so the rest of the code never sees either.
 */

export function emailIsConfigured(): boolean {
  try {
    readEmailConfig(process.env);
    return true;
  } catch {
    return false;
  }
}

export async function runConfiguredDelivery(): Promise<DeliverySummary> {
  const config = readEmailConfig(process.env);
  const service = createServiceClient();
  const rpc: Rpc = async (name, args) => {
    const { data, error } = await (service as unknown as { rpc: Rpc }).rpc(name, args);
    return { data, error };
  };
  return deliverDueEmails({
    rpc,
    provider: createResendProvider(config.resendApiKey),
    fromAddress: config.fromAddress,
    appBaseUrl: config.appBaseUrl,
  });
}
