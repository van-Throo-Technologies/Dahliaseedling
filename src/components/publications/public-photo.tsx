import Image from "next/image";
import type { PublicImage } from "@/modules/publications/repository";

interface PublicPhotoProps {
  readonly image: PublicImage;
  readonly alt: string;
  readonly className?: string;
  /** A flush photo has square corners, so it can sit edge to edge inside a card that already has rounded corners. */
  readonly flush?: boolean;
  /** A square photo fills a square tile in a grid. The whole picture is shown inside the tile, never cropped. */
  readonly square?: boolean;
}

/*
 * A public image. It is a signed URL to a sanitised derivative, never the private original, and it loads lazily.
 *
 * The photograph is never cropped. It is contained in a neutral Porcelain frame, so a tall portrait photo or a phone screenshot
 * cannot fill the screen: its height is capped at about 70% of the viewport, and the frame fills any space left beside it. Landscape and
 * square photos keep their natural shape inside the same frame.
 */
export function PublicPhoto({
  image,
  alt,
  className = "",
  flush = false,
  square = false,
}: PublicPhotoProps) {
  const frame = square
    ? "aspect-square w-full overflow-hidden rounded-control bg-background"
    : `w-full bg-background ${flush ? "" : "rounded-surface"}`;
  const picture = square
    ? "h-full w-full object-contain"
    : "h-auto max-h-[min(70svh,34rem)] w-full object-contain";
  return (
    <div className={`${frame} ${square ? "" : "flex items-center justify-center"}`}>
      <Image
        src={image.url}
        alt={alt}
        width={image.width}
        height={image.height}
        unoptimized
        loading="lazy"
        sizes="(min-width: 640px) 40rem, 100vw"
        className={`${picture} ${className}`}
      />
    </div>
  );
}
