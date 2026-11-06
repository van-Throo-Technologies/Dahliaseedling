/*
 * The public surface. When PUBLIC_SURFACE is "invitations", the deployment serves only the invitation journey. Every other path is
 * not found, and the proxy applies this to every request before any page, action or API route runs, so nothing relies on hiding a
 * link. The rules are paths, not content, and they fail closed: a path that is not listed here is refused.
 *
 * The database still enforces its own boundaries (is_admin(), row-level security and the function grants), so an allowed page cannot
 * reach administrator data even by calling an action directly.
 */

export const PUBLIC_SURFACE_ENV = "PUBLIC_SURFACE";
export const PUBLIC_SURFACE_INVITATIONS = "invitations";

/** Pages and endpoints the invitation journey needs. */
const PUBLIC_PATHS: readonly string[] = [
  "/join",
  // Onboarding, reached once an invitee has set a password.
  "/profile/setup",
  "/auth/confirm",
  "/auth/set-password",
  "/sign-in",
  "/legal/privacy",
  "/legal/terms",
  "/api/health",
  "/manifest.webmanifest",
  "/favicon.ico",
];

/**
 * The only server actions the public surface runs. Every other action refuses on that surface, before it does anything. These five are
 * the invitation request, sign-in, password setup, onboarding, and the language switch that appears in the header of each public page.
 */
export const PUBLIC_ACTIONS: readonly string[] = [
  "submitInvitationRequestAction",
  "signInAction",
  "setPasswordAction",
  "createProfileAction",
  "setLocaleAction",
];

/** Static files the allowed pages load: the compiled scripts and styles, and the one founder photograph. */
const PUBLIC_PREFIXES: readonly string[] = ["/_next/static/", "/icons/", "/images/"];

export type PublicSurfaceDecision = "allow" | "home" | "deny";

export function publicSurfaceActive(env: Readonly<Record<string, string | undefined>>): boolean {
  return env[PUBLIC_SURFACE_ENV] === PUBLIC_SURFACE_INVITATIONS;
}

/** The decision for one request path. A trailing slash is ignored; anything not listed is refused. */
export function publicSurfaceDecision(pathname: string): PublicSurfaceDecision {
  // Resolve dot segments the way a browser does, so "/images/../capture" is judged as "/capture".
  const resolved = new URL(pathname, "http://localhost").pathname;
  const normal = resolved.length > 1 && resolved.endsWith("/") ? resolved.slice(0, -1) : resolved;
  if (normal === "/") return "home";
  if (PUBLIC_PATHS.includes(normal)) return "allow";
  if (PUBLIC_PREFIXES.some((prefix) => normal.startsWith(prefix))) return "allow";
  return "deny";
}
