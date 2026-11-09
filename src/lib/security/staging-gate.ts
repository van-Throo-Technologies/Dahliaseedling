import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/*
 * A shared testing password for the staging deployment, so testers can reach it without a Vercel account. The gate is off unless
 * STAGING_ACCESS_PASSWORD is set in that deployment's environment. It is never on the production branch, even if the variable is set
 * there by mistake, and a password that is too short turns the gate into a refusal instead of an open door.
 *
 * The session cookie is HMAC-signed with the password, so changing the password ends every session, and it expires on its own. The
 * password itself is only ever compared, never stored in the cookie or sent to the browser.
 */

export const STAGING_GATE_ENV = "STAGING_ACCESS_PASSWORD";
export const STAGING_GATE_COOKIE = "ds_staging_access";
export const STAGING_GATE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
export const STAGING_GATE_LOGIN_PATH = "/staging-access";
export const STAGING_GATE_LOGIN_ACTION = "/api/staging-access";
const MIN_PASSWORD_LENGTH = 16;
const PRODUCTION_BRANCH = "main";

export type StagingGate =
  | { readonly state: "off" }
  | { readonly state: "misconfigured" }
  | { readonly state: "on"; readonly password: string };

export type StagingDecision = "allow" | "login" | "unavailable";

export function stagingGate(env: Readonly<Record<string, string | undefined>>): StagingGate {
  const password = env[STAGING_GATE_ENV];
  if (password === undefined || password === "") return { state: "off" };
  if (env.VERCEL_GIT_COMMIT_REF === PRODUCTION_BRANCH) return { state: "off" };
  if (password.length < MIN_PASSWORD_LENGTH) return { state: "misconfigured" };
  return { state: "on", password };
}

/** Paths a visitor may reach before passing the gate: the login page, its own form handler, and the static files it needs. */
const OPEN_PATHS: readonly string[] = [STAGING_GATE_LOGIN_PATH, STAGING_GATE_LOGIN_ACTION];
const OPEN_PREFIXES: readonly string[] = [
  "/_next/static/",
  "/icons/",
  "/images/",
  "/manifest.webmanifest",
  "/favicon.ico",
];

/** Resolves dot segments and a trailing slash the way a browser would, so "/_next/static/../../capture" is judged as "/capture". */
function normalisePath(pathname: string): string {
  const resolved = new URL(pathname, "http://localhost").pathname;
  return resolved.length > 1 && resolved.endsWith("/") ? resolved.slice(0, -1) : resolved;
}

function isOpenPath(pathname: string): boolean {
  const normal = normalisePath(pathname);
  return OPEN_PATHS.includes(normal) || OPEN_PREFIXES.some((prefix) => normal.startsWith(prefix));
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Compares two strings in constant time. Digests first, so the comparison never depends on the length of the input. */
export function passwordMatches(submitted: string, password: string): boolean {
  return timingSafeEqual(digest(submitted), digest(password));
}

function signature(password: string, expires: number): string {
  return createHmac("sha256", password).update(`staging-access:${expires}`).digest("base64url");
}

/** A session value for the cookie: the expiry in seconds, then a signature over it. */
export function issueStagingToken(password: string, nowSeconds: number): string {
  const expires = nowSeconds + STAGING_GATE_MAX_AGE_SECONDS;
  return `${expires}.${signature(password, expires)}`;
}

export function isValidStagingToken(
  value: string | undefined,
  password: string,
  nowSeconds: number,
): boolean {
  if (!value) return false;
  const [payload, mac, extra] = value.split(".");
  if (payload === undefined || mac === undefined || extra !== undefined) return false;
  const expires = Number(payload);
  if (!Number.isSafeInteger(expires) || expires <= nowSeconds) return false;
  return passwordMatches(mac, signature(password, expires));
}

/**
 * The decision for one request. "login" means the visitor must pass the gate first; "unavailable" means the gate is misconfigured and
 * every request is refused, so a bad setting cannot open staging.
 */
export function stagingDecision(
  gate: StagingGate,
  pathname: string,
  cookieValue: string | undefined,
  nowSeconds: number,
): StagingDecision {
  if (gate.state === "off") return "allow";
  if (gate.state === "misconfigured") return "unavailable";
  if (isOpenPath(pathname)) return "allow";
  return isValidStagingToken(cookieValue, gate.password, nowSeconds) ? "allow" : "login";
}

/** Only a path inside this site is accepted as the place to go after the gate, so the login cannot be used to send visitors elsewhere. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  return value;
}
