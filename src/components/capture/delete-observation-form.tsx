"use client";

import { useState } from "react";
import { deleteObservationAction } from "@/modules/capture/actions";

/** Two steps, so an observation is not removed by one stray tap. Deletion is soft and private. */
export function DeleteObservationForm({ observationId }: { readonly observationId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 rounded-control px-1 text-base font-medium text-destructive underline underline-offset-4"
      >
        Delete this observation
      </button>
    );
  }

  return (
    <form
      action={deleteObservationAction}
      className="flex flex-col gap-3 rounded-surface border border-destructive p-4"
    >
      <input type="hidden" name="observationId" value={observationId} />
      <p className="text-base text-text">
        It will be removed from your records. Its photos are kept privately and are no longer shown.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="min-h-11 rounded-control bg-destructive px-4 text-base font-medium text-on-destructive"
        >
          Yes, delete it
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-11 rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand"
        >
          Keep it
        </button>
      </div>
    </form>
  );
}
