"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Shows a photo or video. If the browser cannot display the file (HEIC is not displayed by most
 * non-Apple browsers), it says so and keeps the file. Saving never depends on the preview.
 * Photos are unoptimised on purpose: they are private originals behind a short-lived signed URL.
 */
export function MediaPreview({
  src,
  mime,
  label,
}: {
  readonly src: string;
  readonly mime: string;
  readonly label: string;
}) {
  const [failed, setFailed] = useState(false);
  const isVideo = mime.startsWith("video/");

  if (failed) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-control border border-border bg-surface p-3 text-center text-sm text-text-muted">
        Preview not available in this browser. The file is still saved.
      </div>
    );
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
