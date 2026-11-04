-- Phase 9: a retired identifier typed into Search leads to the canonical Seedling it was merged into. The identifier itself is never
-- reissued; this only resolves it. The canonical Seedling is returned only where the caller could see it anyway (seedling_canonical_id).
-- Identifiers are numbered per grower, so the same text can be a retired alias for several growers. Search never picks one arbitrary
-- match, so this returns a canonical Seedling only when exactly one distinct canonical Seedling is the answer.
create function public.resolve_retired_identifier(p_query text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text := upper(regexp_replace(btrim(coalesce(p_query, '')), '^#', ''));
  v_count integer;
  v_canonical uuid;
begin
  if v_key = '' then return null; end if;
  select count(distinct c.id), min(c.id::text)::uuid into v_count, v_canonical
    from public.seedling_identifiers si
    join public.seedlings s on s.id = si.seedling_id
    cross join lateral (select public.seedling_canonical_id(si.seedling_id) as id) c
   where si.is_retired_alias
     and s.merged_into_id is not null
     and c.id is not null
     and upper(regexp_replace(si.identifier, '^#', '')) = v_key;
  if v_count is distinct from 1 then return null; end if;
  return v_canonical;
end;
$$;

revoke all on function public.resolve_retired_identifier(text) from public;
grant execute on function public.resolve_retired_identifier(text) to anon, authenticated;
