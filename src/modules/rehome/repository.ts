import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Continuation read model. One call returns what this reader may see about a Seedling's continuation: the database
 * decides, in rehome_panel, using the same visibility rules as the Seedling itself. A null result means the reader
 * may not see the Seedling at all. Notes and interests are returned only to the parties who may see them.
 */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type RehomeStatus = "available" | "arranged" | "sent" | "completed" | "cancelled";
export type RehomeTerm = "donate" | "sell" | "trade";
export type RehomeHandover = "pickup" | "shipping" | "both";
export type RehomeRole = "visitor" | "member" | "holder" | "recipient" | "interested";

export interface RehomeCase {
  readonly id: string;
  readonly status: RehomeStatus;
  readonly term: RehomeTerm | null;
  readonly priceText: string | null;
  readonly handover: RehomeHandover | null;
  /** Only the holder, the chosen recipient and interested growers see the note. */
  readonly note: string | null;
  readonly sentAt: string | null;
  readonly chosenRecipientId: string | null;
}

export interface RehomeInterest {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly createdAt: string;
  readonly active: boolean;
}

export interface RehomePanel {
  readonly role: RehomeRole;
  readonly signedIn: boolean;
  readonly case: RehomeCase | null;
  readonly hasInterest: boolean;
  readonly canExpressInterest: boolean;
  /** Only the current holder receives the interests. Everyone else receives an empty list. */
  readonly interests: readonly RehomeInterest[];
}

interface RawPanel {
  role: RehomeRole;
  signedIn: boolean;
  case: {
    id: string;
    status: RehomeStatus;
    term: RehomeTerm | null;
    priceText: string | null;
    handover: RehomeHandover | null;
    note: string | null;
    sentAt: string | null;
    chosenRecipientId: string | null;
  } | null;
  hasInterest: boolean;
  canExpressInterest: boolean;
  interests: {
    id: string;
    userId: string;
    displayName: string;
    createdAt: string;
    active: boolean;
  }[];
}

export async function readRehomePanel(
  client: Client,
  seedlingId: string,
): Promise<RehomePanel | null> {
  const { data, error } = await client.rpc("rehome_panel", { p_seedling_id: seedlingId });
  if (error) throw new Error("the continuation could not be read");
  if (!data) return null;
  const raw = data as unknown as RawPanel;
  return {
    role: raw.role,
    signedIn: raw.signedIn,
    case: raw.case
      ? {
          id: raw.case.id,
          status: raw.case.status,
          term: raw.case.term,
          priceText: raw.case.priceText,
          handover: raw.case.handover,
          note: raw.case.note,
          sentAt: raw.case.sentAt,
          chosenRecipientId: raw.case.chosenRecipientId,
        }
      : null,
    hasInterest: raw.hasInterest,
    canExpressInterest: raw.canExpressInterest,
    interests: raw.interests.map((item) => ({
      id: item.id,
      userId: item.userId,
      displayName: item.displayName,
      createdAt: item.createdAt,
      active: item.active,
    })),
  };
}
