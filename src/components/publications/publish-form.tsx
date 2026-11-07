"use client";

import { photoSrc } from "@/modules/capture/media-type";
import { useActionState, useState } from "react";
import { MediaPreview } from "@/components/capture/media-preview";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { publishUpdateAction } from "@/modules/publications/actions";
import { PUBLISH_LIMITS } from "@/modules/publications/limits";
import { useT } from "@/i18n/client";
import { formatCount } from "@/i18n/format";
import { useLocale } from "@/i18n/client";

export interface ShareableImage {
  readonly id: string;
  readonly label: string;
  readonly mime: string;
  readonly shareable: boolean;
}

/**
 * Chooses what becomes public. Nothing is selected by default: the grower picks each image. Videos are shown
 * but cannot be chosen, and the server refuses them even if the control is bypassed.
 */
export function PublishForm({
  observationId,
  clientKey,
  images,
  videoCount,
}: {
  readonly observationId: string;
  readonly clientKey: string;
  readonly images: readonly ShareableImage[];
  readonly videoCount: number;
}) {
  const t = useT();
  const locale = useLocale();
  const [state, action] = useActionState(publishUpdateAction, IDLE_FORM_STATE);
  // The choice and the caption are mirrored in component state. The fields keep their DOM values, but their
  // defaults follow the state, so the browser reset React applies after a form action restores what the grower chose.
  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState("");

  function toggle(id: string, on: boolean) {
    setSelected((current) => (on ? [...current, id] : current.filter((value) => value !== id)));
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="observationId" value={observationId} />
      <input type="hidden" name="clientKey" value={clientKey} />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-medium text-text">
          {t("publication.publish.chooseTitle")}
        </legend>
        <p className="text-base text-text-muted">{t("publication.publish.chooseText")}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map((image) => (
            <li key={image.id}>
              <label
                className={`flex min-h-11 flex-col gap-3 rounded-surface border border-border bg-surface p-3 has-[:checked]:border-text-brand ${image.shareable ? "cursor-pointer" : "opacity-70"}`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="mediaId"
                    value={image.id}
                    disabled={!image.shareable}
                    defaultChecked={selected.includes(image.id)}
                    onChange={(event) => toggle(image.id, event.currentTarget.checked)}
                    className="h-6 w-6 shrink-0 accent-[var(--color-text-brand)]"
                  />
                  <span className="text-base text-text">
                    {image.shareable
                      ? t("publication.publish.share", { label: image.label })
                      : t("publication.publish.stayPrivate", { label: image.label })}
                  </span>
                </span>
                <MediaPreview
                  src={photoSrc(image.id, image.mime)}
                  mime={image.mime}
                  label={image.label}
                />
              </label>
            </li>
          ))}
        </ul>
        {images.some((image) => !image.shareable) ? (
          <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
            {t("publication.publish.privateOnly")}
          </p>
        ) : null}
        {videoCount > 0 ? (
          <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
            {videoCount === 1
              ? t("publication.publish.videoOne")
              : t("publication.publish.videoMany", { count: formatCount(videoCount, locale) })}{" "}
            {t("publication.publish.videoNotAvailable")}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="caption" className="text-lg font-medium text-text">
          {t("publication.publish.captionLabel")}
        </label>
        <p id="caption-hint" className="text-base text-text-muted">
          {t("publication.publish.captionHint")}
        </p>
        <textarea
          id="caption"
          name="caption"
          rows={4}
          maxLength={PUBLISH_LIMITS.captionMaxLength}
          aria-describedby="caption-hint"
          defaultValue={caption}
          onChange={(event) => setCaption(event.currentTarget.value)}
          className="w-full rounded-control border border-border bg-surface p-3 text-base text-text"
        />
      </div>

      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {images.some((image) => image.shareable) ? (
        <SubmitButton pendingLabel={t("publication.publish.pending")}>
          {t("publication.publish.submit")}
        </SubmitButton>
      ) : null}
    </form>
  );
}
