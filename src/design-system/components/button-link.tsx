import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkVariant = "primary" | "secondary";

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: ButtonLinkVariant;
}

// Visible focus comes from globals.css (:focus-visible). min-h-11 / min-w-11 = 44px touch target.
// Dark text on Apricot (text-on-primary) is required for primary actions. See theme.css.
const baseClasses =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-4 py-2 text-base font-medium no-underline transition-colors";

const variantClasses: Record<ButtonLinkVariant, string> = {
  primary: "bg-primary text-on-primary hover:brightness-95",
  secondary: "border border-border bg-surface text-text-brand hover:border-text-brand",
};

/** A navigation control that looks like a button. Use it for links that act as actions. */
export function ButtonLink({ href, children, variant = "primary" }: ButtonLinkProps) {
  return (
    <Link href={href} className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </Link>
  );
}
