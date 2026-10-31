interface FormMessageProps {
  readonly tone: "error" | "success";
  readonly children: string;
}

/**
 * Form-level feedback. Errors use role="alert" so screen readers announce them immediately.
 * Success uses role="status". Both are plain text, so meaning does not depend on colour.
 */
export function FormMessage({ tone, children }: FormMessageProps) {
  if (tone === "error") {
    return (
      <p
        role="alert"
        className="rounded-control border border-destructive px-4 py-3 text-base text-destructive"
      >
        {children}
      </p>
    );
  }
  return (
    <p
      role="status"
      className="rounded-control border border-border bg-surface px-4 py-3 text-base text-text"
    >
      {children}
    </p>
  );
}
