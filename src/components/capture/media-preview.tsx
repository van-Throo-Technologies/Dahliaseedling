"use client";

import Image from "next/image";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { isHeifMime } from "@/modules/capture/media-type";

/**
 * Shows a photo or video. If the browser cannot display a file, the page says so and keeps the file. In Capture, a HEIC or HEIF photo
 * the browser cannot show gets the save-first explanation, because its preview becomes available after saving.
 * Saving never depends on the preview. Photos are unoptimised on purpose: they are behind an owner-only address.
 */
export function MediaPreview({
  src,
  mime,
  label,
  beforeSave = false,
}: {
  readonly src: string | null;
  readonly mime: string;
  readonly label: string;
  /** True in Capture, before saving: a HEIC photo the browser cannot show then gets the save-first explanation. */
  readonly beforeSave?: boolean;
}) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const isVideo = mime.startsWith("video/");
  const placeholder =
    "flex aspect-square items-center justify-center rounded-control border border-border bg-surface p-3 text-center text-sm text-text-muted";

  if (failed && beforeSave && isHeifMime(mime)) {
    return <div className={placeholder}>{t("capture.capture.previewCannotShowYet")}</div>;
  }

  if (failed || src === null) {
    return <div className={placeholder}>{t("capture.capture.previewUnavailable")}</div>;
  }

  if (isVideo) {
    return (
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label={label}
        onError={() => setFailed(true)}
        className="aspect-square w-full rounded-control bg-surface object-cover"
      />
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-control bg-surface">
      <Image
        src={src}
        alt={label}
        fill
        unoptimized
        sizes="(max-width: 640px) 50vw, 25vw"
        onError={() => setFailed(true)}
        className="object-cover"
      />
    </div>
  );
}
