"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCommentAction, editCommentAction } from "@/modules/publications/actions";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";

/** Posts a comment, or a reply when a parent is given. The label always names what the text is for. */
export function CommentForm({
  updateId,
  parentId,
  label,
  submitLabel,
}: {
  readonly updateId: string;
  readonly parentId?: string;
  readonly label: string;
  readonly submitLabel: string;
}) {
  const [state, action] = useActionState(addCommentAction, IDLE_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyId = `comment-body-${parentId ?? "root"}`;

  // A posted comment clears the box. An error keeps what was typed, so nothing is lost.
  useEffect(() => {
    if (state.status === "saved") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="updateId" value={updateId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <div className="flex flex-col gap-2">
        <label htmlFor={bodyId} className="text-base font-medium text-text">
          {label}
        </label>
        <textarea
          id={bodyId}
          name="body"
          rows={3}
          maxLength={2000}
          required
          className="w-full rounded-control border border-border bg-surface p-3 text-base text-text"
        />
      </div>
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      <SubmitButton pendingLabel="Posting…">{submitLabel}</SubmitButton>
    </form>
  );
}

/** Edits the signed-in author's own comment. Only the author's form is ever rendered with this. */
export function CommentEditForm({
  updateId,
  commentId,
  body,
}: {
  readonly updateId: string;
  readonly commentId: string;
  readonly body: string;
}) {
  const [state, action] = useActionState(editCommentAction, IDLE_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="updateId" value={updateId} />
      <input type="hidden" name="commentId" value={commentId} />
      <label htmlFor={`edit-${commentId}`} className="text-base font-medium text-text">
        Edit your comment
      </label>
      <textarea
        id={`edit-${commentId}`}
        name="body"
        rows={3}
        maxLength={2000}
        required
        defaultValue={body}
        className="w-full rounded-control border border-border bg-surface p-3 text-base text-text"
      />
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}
