"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { addCommentAction, editCommentAction } from "@/modules/publications/actions";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { useT } from "@/i18n/client";
import { useExpandReplies } from "./comment-branch";

/** Posts a comment, or a reply when a parent is given. The label always names what the text is for. */
export function CommentForm({
  updateId,
  parentId,
  label,
  submitLabel,
  onSaved,
}: {
  readonly updateId: string;
  readonly parentId?: string;
  readonly label: string;
  readonly submitLabel: string;
  /** Called only after a successful post, never after an error, with the text that was posted. */
  readonly onSaved?: (posted: { readonly body: string }) => void;
}) {
  const t = useT();
  const [state, action] = useActionState(addCommentAction, IDLE_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  // React clears an uncontrolled form when its action starts, whatever the result. The text is kept here so an error can put it back.
  const typedRef = useRef("");
  const bodyId = useId();

  useEffect(() => {
    if (state.status === "error") {
      const textarea = formRef.current?.elements.namedItem("body");
      if (textarea instanceof HTMLTextAreaElement) textarea.value = typedRef.current;
      return;
    }
    if (state.status !== "saved") return;
    formRef.current?.reset();
    onSaved?.({ body: typedRef.current.trim() });
  }, [state, onSaved]);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => {
        typedRef.current = String(new FormData(event.currentTarget).get("body") ?? "");
      }}
      className="flex flex-col gap-3"
    >
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
      <SubmitButton pendingLabel={t("publication.comments.posting")}>{submitLabel}</SubmitButton>
    </form>
  );
}

/** A reply under one comment. A saved reply opens that comment's replies, so the new reply is visible. */
export function ReplyForm({
  updateId,
  parentId,
  label,
  submitLabel,
}: {
  readonly updateId: string;
  readonly parentId: string;
  readonly label: string;
  readonly submitLabel: string;
}) {
  const expandReplies = useExpandReplies();
  return (
    <CommentForm
      updateId={updateId}
      parentId={parentId}
      label={label}
      submitLabel={submitLabel}
      onSaved={expandReplies ?? undefined}
    />
  );
}

/** Edits the signed-in author's own comment. Only the author's form is ever rendered with this. */
export function CommentEditForm({
  updateId,
  commentId,
  body,
  onSaved,
}: {
  readonly updateId: string;
  readonly commentId: string;
  readonly body: string;
  /** Called after a successful save, so the caller can show the comment text again. */
  readonly onSaved?: () => void;
}) {
  const t = useT();
  const [state, action] = useActionState(editCommentAction, IDLE_FORM_STATE);
  useEffect(() => {
    if (state.status === "saved") onSaved?.();
  }, [state, onSaved]);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="updateId" value={updateId} />
      <input type="hidden" name="commentId" value={commentId} />
      <label htmlFor={`edit-${commentId}`} className="text-base font-medium text-text">
        {t("publication.comments.editLabel")}
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
      <SubmitButton pendingLabel={t("publication.comments.saving")}>
        {t("publication.comments.saveChanges")}
      </SubmitButton>
    </form>
  );
}
