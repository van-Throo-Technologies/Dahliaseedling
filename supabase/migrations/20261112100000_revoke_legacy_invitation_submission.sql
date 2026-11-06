-- Closes the legacy five-argument invitation submission route.
--
-- The active application submits through the eight-argument function, which needs a server-signed proof. The five-argument wrapper needs
-- no proof and shares one hourly allowance, so it was kept only for the rollout. The rollout has been verified: a signed submission was
-- stored through the deployed application, and the deployment does not call the five-argument signature.
--
-- Rollback dependency. The previous deployment calls the five-argument signature, so restoring that deployment requires restoring the
-- grant first. The runbook records the exact statement.
--
-- The function itself stays in place, so the migration history is not rewritten, and a rebuild from empty applies this revocation after it
-- is created. Nothing else about the eight-argument function, its proof or the private key changes.

revoke execute on function public.submit_invitation_request(uuid, text, text, text, text) from public, anon, authenticated;
