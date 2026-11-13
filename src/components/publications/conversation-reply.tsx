"use client";

import { createContext, useContext } from "react";
import { useT } from "@/i18n/client";

/** Who the conversation's composer is replying to. Null when it writes an ordinary comment. */
export type ReplyTarget = { readonly id: string; readonly name: string } | null;

/*
 * The conversation has one composer, shared by comments and replies. Reply on a comment hands its id and name to the dialog, which
 * switches that composer into reply mode. After a reply is saved, its parent's replies open so the new one is visible. A parent's
 * replies stay open only while the reader has not closed them.
 */
export interface ReplyControl {
  readonly expandedParentId: string | null;
  readonly startReply: (target: NonNullable<ReplyTarget>) => void;
  readonly releaseExpanded: (parentId: string) => void;
}

export const ReplyContext = createContext<ReplyControl | null>(null);

export function useReplyControl(): ReplyControl | null {
  return useContext(ReplyContext);
}

/** The Reply action beneath a comment in the conversation. It drives the one composer, so no second text box appears. */
export function ReplyButton({
  parentId,
  name,
}: {
  readonly parentId: string;
  readonly name: string;
}) {
  const t = useT();
  const control = useReplyControl();
  return (
    <button
      type="button"
      onClick={() => control?.startReply({ id: parentId, name })}
      className="-my-2 inline-flex min-h-9 items-center font-semibold text-text-muted hover:text-text-brand"
    >
      {t("publication.comments.reply")}
    </button>
  );
}
