import Image from "next/image";
import type { PublicImage } from "@/modules/publications/repository";

interface PublicPhotoProps {
  readonly image: PublicImage;
  readonly alt: string;
  readonly className?: string;
}

/**
 * A public image. It is a signed URL to a sanitised derivative, never the private original, and it loads
 * lazily. The width and height come from the derivative, so the frame is reserved before the photo arrives.
 */
export function PublicPhoto({ image, alt, className = "" }: PublicPhotoProps) {
  return (
    <Image
      src={image.url}
      alt={alt}
      width={image.width}
      height={image.height}
      unoptimized
      loading="lazy"
      sizes="(min-width: 640px) 36rem, 100vw"
      className={`h-auto w-full rounded-surface bg-background object-contain ${className}`}
    />
  );
}
