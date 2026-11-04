/*
 * Structured server logging with an allowlist. A log line carries an event name, a time, and only the fields named here. A value must be
 * a short code, a number or a boolean. Free text, addresses, message bodies, tokens, signed URLs and exports cannot pass, even when a caller
 * passes them by mistake: the field is dropped, not truncated.
 */

export type LogLevel = "info" | "warn" | "error";

export type LogValue = string | number | boolean | null;

/** The only field names a log line may carry. Adding one is a reviewed change. */
export const LOG_FIELDS = ["outcome", "code", "count", "status", "durationMs", "route"] as const;

const CODE = /^[a-z0-9_.-]{1,64}$/;

export function sanitiseFields(
  fields: Readonly<Record<string, LogValue | undefined>>,
): Record<string, LogValue> {
  const safe: Record<string, LogValue> = {};
  for (const name of LOG_FIELDS) {
    const value = fields[name];
    if (value === undefined) continue;
    if (typeof value === "number" && Number.isFinite(value)) safe[name] = value;
    else if (typeof value === "boolean" || value === null) safe[name] = value;
    else if (typeof value === "string" && CODE.test(value)) safe[name] = value;
  }
  return safe;
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Readonly<Record<string, LogValue | undefined>> = {},
  sink: (line: string) => void = (line) => console[level](line),
): void {
  if (!CODE.test(event)) return;
  sink(
    JSON.stringify({
      level,
      event,
      at: new Date().toISOString(),
      ...sanitiseFields(fields),
    }),
  );
}
