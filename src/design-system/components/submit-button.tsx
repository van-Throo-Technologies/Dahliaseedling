"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

interface SubmitButtonProps {
  readonly children: ReactNode;
  readonly pendingLabel: string;
}

/** Primary action. Dark text on Apricot (see theme.css): never white text on Apricot. */
export function SubmitButton({ children, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 py-2 text-base font-medium text-on-primary transition-colors hover:brightness-95 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
