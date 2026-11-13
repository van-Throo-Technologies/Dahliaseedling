"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { addCommentAction, editCommentAction } from "@/modules/publications/actions";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { useT } from "@/i18n/client";
import { useExpandReplies } from "./comment-branch";

/*
 * Each saved result is a new object, so giving each one its own key makes a screen reader announce every post, even when the text repeats.
 */
const resultKeys = new WeakMap<object, number>();
let resultCount = 0;

function resultKey(result: object): number {
  let key = resultKeys.get(result);
  if (key === undefined) {
    resultCount += 1;
    key = resultCount;
    resultKeys.set(result, key);
  }
  return key;
}

/**
 * Posts a comment, or a reply when a parent is given. The label always names what the text is for.
 *
 * With submitOnEnter, Enter sends and Shift+Enter starts a new line. That applies only where a fine pointer is present, so a phone's
 * keyboard keeps its own Enter key. Enter that ends an IME composition never sends.
 */
export function CommentForm({
  updateId,
  parentId,
  label,
  submitLabel,
  submitOnEnter = false,
  onSaved,
}: {
  readonly updateId: string;
  readonly parentId?: string;
  readonly label: string;
  readonly submitLabel: string;
  readonly submitOnEnter?: boolean;
  /** Called only after a successful post, never after an error, with the text that was posted. */
  readonly onSaved?: (posted: { readonly body: string }) => void;
}) {
  const t = useT();
  const [state, action] = useActionState(addCommentAction, IDLE_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  // React clears an uncontrolled form when its action starts, whatever the result. The text is kept here so an error can put it back.
  const typedRef = useRef("");
  // Set from the first submit until the result arrives, so a second Send or Enter cannot post the same text twice.
  const sendingRef = useRef(false);
  const bodyId = useId();

  useEffect(() => {
    sendingRef.current = false;
    if (state.status === "error") {
      const textarea = formRef.current?.elements.namedItem("body");
      if (textarea instanceof HTMLTextAreaElement) textarea.value = typedRef.current;
      return;
    }
    if (state.status !== "saved") return;
    formRef.current?.reset();
    // The Send button was disabled while the post was sent, which can take focus with it. The box is focused again, ready for the next one.
    const textarea = formRef.current?.elements.namedItem("body");
    if (textarea instanceof HTMLTextAreaElement) textarea.focus();
    onSaved?.({ body: typedRef.current.trim() });
  }, [state, onSaved]);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => {
        if (sendingRef.current) {
          event.preventDefault();
          return;
        }
        sendingRef.current = true;
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
          onKeyDown={(event) => {
            if (!submitOnEnter || event.key !== "Enter" || event.shiftKey) return;
            if (event.nativeEvent.isComposing) return;
            if (!window.matchMedia("(pointer: fine)").matches) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          className="w-full rounded-control border border-border bg-surface p-3 text-base text-text"
        />
      </div>
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" ? (
        <p key={resultKey(state)} role="status" className="sr-only">
          {state.message}
        </p>
      ) : null}
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
