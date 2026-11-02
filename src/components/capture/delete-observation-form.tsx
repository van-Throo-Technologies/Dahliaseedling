"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { deleteObservationAction } from "@/modules/capture/actions";

/** Two steps, so an observation is not removed by one stray tap. Deletion is soft and private. */
export function DeleteObservationForm({ observationId }: { readonly observationId: string }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 rounded-control px-1 text-base font-medium text-destructive underline underline-offset-4"
      >
        {t("capture.observation.deleteThis")}
      </button>
    );
  }

  return (
    <form
      action={deleteObservationAction}
      className="flex flex-col gap-3 rounded-surface border border-destructive p-4"
    >
      <input type="hidden" name="observationId" value={observationId} />
      <p className="text-base text-text">{t("capture.observation.deleteConfirm")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="min-h-11 rounded-control bg-destructive px-4 text-base font-medium text-on-destructive"
        >
          {t("capture.observation.deleteYes")}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-11 rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand"
        >
          {t("capture.observation.deleteKeep")}
        </button>
      </div>
    </form>
  );
}
