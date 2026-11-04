-- Phase 10A: privilege hardening for SECURITY DEFINER trigger functions.
--
-- These functions run only when a trigger fires. PostgreSQL checks EXECUTE on a trigger function when the trigger is created, not when it
-- fires, so removing these grants does not stop the triggers working. No application code or policy calls them by name. Each one is
-- revoked from PUBLIC, anon and authenticated, so a visitor or grower cannot run them directly.
--
-- Helpers that row-level security policies call (for example _update_is_public) keep their grants. Policies run as the querying role,
-- so the role needs EXECUTE to evaluate them.

revoke all on function public._comment_after() from public, anon, authenticated;
revoke all on function public._messages_after() from public, anon, authenticated;
revoke all on function public._messages_guard() from public, anon, authenticated;
revoke all on function public._rehome_case_after() from public, anon, authenticated;
revoke all on function public._rehome_interest_after() from public, anon, authenticated;
revoke all on function public._rehome_interest_before() from public, anon, authenticated;
revoke all on function public._seed_offer_interest_after() from public, anon, authenticated;
revoke all on function public._seed_offer_interest_before() from public, anon, authenticated;
revoke all on function public._update_after() from public, anon, authenticated;
