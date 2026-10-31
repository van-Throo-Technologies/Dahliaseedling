import Image from "next/image";

interface ProfileAvatarProps {
  readonly name: string;
  readonly url: string | null;
  readonly size?: "md" | "lg";
}

/**
 * Profile photo, or the first letter of the name when there is none. The image is decorative
 * because the name is shown beside it, so the alt text is empty.
 */
export function ProfileAvatar({ name, url, size = "md" }: ProfileAvatarProps) {
  const dimension = size === "lg" ? 96 : 48;
  const frame = size === "lg" ? "h-24 w-24 text-3xl" : "h-12 w-12 text-lg";

  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={dimension}
        height={dimension}
        unoptimized
        className={`${frame} shrink-0 rounded-full border border-border object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${frame} flex shrink-0 items-center justify-center rounded-full border border-border bg-surface font-display text-text-brand`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
