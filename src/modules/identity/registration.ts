/*
 * Public self-registration. During the invitation-only beta, a production deployment refuses new accounts from the sign-up form. Growers
 * are invited from the Supabase dashboard, and an invitation link sets the password without going through sign-up.
 *
 * The rule follows the deployment environment that Vercel reports, not the Git branch name. Supabase's own sign-up switch is the first
 * control; this check is the second, so a change to the hosted switch alone does not reopen registration.
 */

/** True when a visitor may create an account through the sign-up form. Closed in a production deployment; open everywhere else. */
export function selfRegistrationOpen(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.VERCEL_ENV !== "production";
}
