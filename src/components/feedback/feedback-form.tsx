"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { useT } from "@/i18n/client";
import { FEEDBACK_CATEGORIES } from "@/modules/feedback/validation";
import { submitFeedbackAction } from "@/modules/feedback/actions";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";

function newKey(): string {
  return crypto.randomUUID();
}

/**
 * One key is kept for each attempt. A retry after a lost response sends the same key, so the database returns the first feedback instead
 * of storing it twice. The key changes only after a successful send, so the next message is new.
 */
export function FeedbackForm({ from }: { readonly from: string }) {
  const t = useT();
  const [state, action] = useActionState(submitFeedbackAction, IDLE_FORM_STATE);
  const [clientKey, setClientKey] = useState(newKey);
  const values = state.status === "error" ? state.values : undefined;
  const errors = state.status === "error" ? state.fieldErrors : {};
  const [length, setLength] = useState(values?.message?.length ?? 0);

  // When a send succeeds, the next message gets a new key. This runs during render, not in an effect.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "saved") {
      setClientKey(newKey());
      setLength(0);
    }
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="clientKey" value={clientKey} />
      <input type="hidden" name="from" value={from} />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-medium text-text">{t("feedback.category.legend")}</legend>
        {FEEDBACK_CATEGORIES.map((category) => (
          <label
            key={category}
            className="flex min-h-11 items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 text-base text-text"
          >
            <input
              type="radio"
              name="category"
              value={category}
              defaultChecked={values?.category === category}
              required
              className="h-5 w-5"
            />
            {t(`feedback.category.${category}`)}
          </label>
        ))}
        {errors.category ? <p className="text-sm text-text-brand">{errors.category}</p> : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="feedback-message" className="text-base font-medium text-text">
          {t("feedback.message.label")}
        </label>
        <textarea
          id="feedback-message"
          name="message"
          rows={6}
          required
          defaultValue={values?.message ?? ""}
          onChange={(event) => setLength(event.currentTarget.value.length)}
          aria-describedby="feedback-message-hint feedback-message-count"
          aria-invalid={errors.message ? true : undefined}
          className="w-full rounded-control border border-border bg-background px-3 py-2 text-base text-text"
        />
        <p id="feedback-message-hint" className="text-sm text-text-muted">
          {t("feedback.message.hint")}
        </p>
        <p id="feedback-message-count" className="text-sm text-text-muted">
          {t("feedback.message.counter").replace("{count}", String(length))}
        </p>
        {errors.message ? <p className="text-sm text-text-brand">{errors.message}</p> : null}
      </div>

      {state.status === "saved" ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <SubmitButton pendingLabel={t("feedback.submitting")}>{t("feedback.submit")}</SubmitButton>
    </form>
  );
}
