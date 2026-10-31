import { ConfigError, type EnvSource, parseAppConfig } from "@/lib/config/env";

export interface HealthResult {
  readonly httpStatus: 200 | 503;
  readonly body: HealthBody;
}

export type HealthBody =
  | {
      readonly status: "ok";
      readonly service: "dahliaseedling";
      readonly checkedAt: string;
      readonly checks: { readonly configuration: "ok" };
    }
  | {
      readonly status: "error";
      readonly service: "dahliaseedling";
      readonly checkedAt: string;
      readonly checks: { readonly configuration: "error" };
      readonly problems: {
        readonly missing: readonly string[];
        readonly invalid: readonly string[];
      };
    };

/**
 * Smoke-test status for the app. It proves the process starts and responds, and that the
 * configuration it needs is present and well-formed. It deliberately makes no network calls,
 * so a Supabase outage or a cold local stack never makes the app look dead.
 */
export function getHealthStatus(source: EnvSource, now: Date): HealthResult {
  const checkedAt = now.toISOString();

  try {
    parseAppConfig(source);
    return {
      httpStatus: 200,
      body: {
        status: "ok",
        service: "dahliaseedling",
        checkedAt,
        checks: { configuration: "ok" },
      },
    };
  } catch (error) {
    if (!(error instanceof ConfigError)) {
      throw error;
    }
    return {
      httpStatus: 503,
      body: {
        status: "error",
        service: "dahliaseedling",
        checkedAt,
        checks: { configuration: "error" },
        problems: error.problems,
      },
    };
  }
}
