import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/*
 * The service client is used by one thing: the email delivery worker, which must claim and record outbox rows after the domain
 * transaction has committed. It is not used by any page, action or ordinary query, and the publishable-key client above remains
 * the only client for visitor and grower requests. The secret key is read here and nowhere else, and is never echoed.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  if (!url || !secretKey) {
    throw new Error(
      "Email delivery is not configured: the Supabase service credentials are missing.",
    );
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
