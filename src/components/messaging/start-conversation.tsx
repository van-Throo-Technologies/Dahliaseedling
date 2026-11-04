import { startConversationAction } from "@/modules/messaging/actions";

/*
 * A button that opens or continues one conversation. It names the context it belongs to: a direct message, a Seedling, a
 * continuation (kind "rehome") or a seed offer (kind "seedOffer"). The database decides whether the pair may talk.
 */

export type ConversationKind = "direct" | "seedling" | "rehome" | "seedOffer";

interface StartConversationProps {
  readonly kind: ConversationKind;
  /** The user id for "direct", the Seedling id for "seedling", the case id for "rehome", the offer id for "seedOffer". */
  readonly target: string;
  /** The other grower, for a continuation or seed offer. */
  readonly other?: string;
  readonly returnTo: string;
  readonly label: string;
  readonly id: string;
}

export function StartConversation({
  kind,
  target,
  other,
  returnTo,
  label,
  id,
}: StartConversationProps) {
  return (
    <form action={startConversationAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="other" value={other ?? ""} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        id={id}
        type="submit"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border bg-surface px-4 py-2 text-base font-medium text-text-brand transition-colors hover:border-text-brand"
      >
        {label}
      </button>
    </form>
  );
}
