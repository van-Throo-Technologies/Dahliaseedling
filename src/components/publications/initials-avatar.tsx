import { initialsOf } from "@/modules/identity/initials";

/*
 * The letters of a person who has no photo, in the brand colours. Decorative: the name is always written beside it.
 */
export function InitialsAvatar({
  name,
  size = "md",
  tone = "neutral",
}: {
  readonly name: string;
  readonly size?: "sm" | "md";
  /** "you" marks the viewer's own composer; "grower" marks the Update's author. */
  readonly tone?: "neutral" | "grower" | "you";
}) {
  const sizing = size === "sm" ? "size-7 text-xs" : "size-9 text-sm";
  const colour =
    tone === "grower"
      ? "bg-text-brand text-background"
      : tone === "you"
        ? "bg-primary text-on-primary"
        : "bg-border text-text-brand";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizing} ${colour}`}
    >
      {initialsOf(name)}
    </span>
  );
}
