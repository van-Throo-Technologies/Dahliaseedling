"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/*
 * One comment and its replies. The replies disclosure starts collapsed, and its open state belongs to this comment alone. A reply form
 * inside the comment opens the disclosure when a reply is saved, so the new reply is visible. A failed reply changes nothing.
 */

const ExpandRepliesContext = createContext<(() => void) | null>(null);

/** Opens this comment's replies. Returns null outside a comment branch, such as the thread's own composer. */
export function useExpandReplies() {
  return useContext(ExpandRepliesContext);
}

export function CommentBranch({
  replyCount,
  summary,
  replies,
  children,
}: {
  readonly replyCount: number;
  readonly summary: string;
  readonly replies: ReactNode;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expand = useCallback(() => setOpen(true), []);

  return (
    <ExpandRepliesContext.Provider value={expand}>
      {children}
      {replyCount > 0 ? (
        <details
          className="mt-1"
          open={open}
          onToggle={(event) => setOpen(event.currentTarget.open)}
        >
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-base text-text-muted">
            {summary}
          </summary>
          {replies}
        </details>
      ) : null}
    </ExpandRepliesContext.Provider>
  );
}
