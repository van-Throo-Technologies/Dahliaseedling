/*
 * Turns a refusal from admin_suspend_profile into a stable key. The database text is never shown: the reason check and the self-suspension
 * check are recognised by SQLSTATE, and the message is matched only to tell two 23514 refusals apart.
 */

export type AccountFailure = "notAllowed" | "notFound" | "ownAccount" | "reason" | "generic";

export function accountFailure(error: { code?: string; message?: string } | null): AccountFailure {
  const message = error?.message ?? "";
  if (error?.code === "42501") return "notAllowed";
  if (error?.code === "P0002") return "notFound";
  if (message.includes("cannot suspend your own")) return "ownAccount";
  if (message.includes("reason of")) return "reason";
  return "generic";
}
