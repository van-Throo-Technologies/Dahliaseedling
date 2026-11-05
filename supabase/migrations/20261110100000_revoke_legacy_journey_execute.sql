-- list_seedling_updates is the earlier public journey read. The application reads the canonical history through
-- list_canonical_seedling_updates, which follows merged Seedlings. No client needs the earlier function, so its client
-- execute rights are removed here. The function itself and its body are unchanged.

revoke all on function public.list_seedling_updates(uuid) from public, anon, authenticated;
