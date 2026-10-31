/*
 * Typed application configuration.
 *
 * Everything here is browser-safe (NEXT_PUBLIC_*). Server-only secrets (for example the Supabase
 * secret key, added in Phase 1 if needed) must never be read through this module and must never
 * use the NEXT_PUBLIC_ prefix.
 */

export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface AppConfig {
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
}

export interface ConfigProblems {
  readonly missing: readonly string[];
  readonly invalid: readonly string[];
}

/**
 * Raised when required configuration is absent or malformed.
 * Messages name the variables, never their values, so they are safe to log.
 */
export class ConfigError extends Error {
  readonly problems: ConfigProblems;

  constructor(problems: ConfigProblems) {
    const parts: string[] = [];
    if (problems.missing.length > 0) {
      parts.push(`missing ${problems.missing.join(", ")}`);
    }
    if (problems.invalid.length > 0) {
      parts.push(`invalid ${problems.invalid.join(", ")}`);
    }
    super(
      `Configuration error: ${parts.join("; ")}. Copy .env.example to .env.local and fill it in.`,
    );
    this.name = "ConfigError";
    this.problems = problems;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Validates the environment and returns typed configuration, or throws a ConfigError. */
export function parseAppConfig(source: EnvSource): AppConfig {
  const supabaseUrl = source.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabasePublishableKey = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  const missing: string[] = [];
  const invalid: string[] = [];

  if (supabaseUrl === "") {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  } else if (!isHttpUrl(supabaseUrl)) {
    invalid.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (supabasePublishableKey === "") {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if (missing.length > 0 || invalid.length > 0) {
    throw new ConfigError({ missing, invalid });
  }

  return { supabaseUrl, supabasePublishableKey };
}
