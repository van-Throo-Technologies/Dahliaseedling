-- Phase 9: canonical public Update history, read at display time. No Update, comment, like, provenance row or media row is written.
--
-- A merge folds a retired identity into its canonical Seedling. The canonical page shows the public history of the canonical Seedling
-- and of every retired identity folded into it, following merge chains (A merged into B, then B merged into C). Each Update still
-- passes the existing public visibility rule, so private, moderated, removed and suspended content stays hidden.

-- 1. Canonical resolution follows the whole chain, not one hop. Merges only ever accept active Seedlings on both sides, so a chain
-- cannot loop; the bound below is a defence in depth that answers "no identity" instead of looping.
create or replace function public.seedling_canonical_id(p_seedling_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  s public.seedlings;
  c public.seedlings;
  v_target uuid;
  i integer;
begin
  select * into s from public.seedlings where id = p_seedling_id;
  if not found or s.merged_into_id is null then return null; end if;

  v_target := s.merged_into_id;
  for i in 1..50 loop
    select * into c from public.seedlings where id = v_target;
    if not found then return null; end if;
    exit when c.merged_into_id is null;
    v_target := c.merged_into_id;
    if i = 50 then return null; end if;
  end loop;

  if c.deleted_at is not null then return null; end if;
  if c.visibility = 'public' and exists (
    select 1 from public.profiles p where p.id = c.current_holder_id and not p.is_suspended
  ) then
    return c.id;
  end if;
  if v_uid is not null and c.current_holder_id = v_uid then return c.id; end if;
  return null;
end;
$$;

-- 2. The canonical Seedling's Update history: its own Updates and those of every retired identity folded into it, directly or through a
-- chain. The family is found by walking merged_into_id down from the canonical identity; UNION makes the walk terminate even if the data were ever
-- cyclic. Each Update is returned only if _update_is_public holds for it, which is the same rule every other public Update read uses.
create function public.list_canonical_seedling_updates(p_seedling_id uuid)
returns table (
  update_id uuid,
  author_id uuid,
  author_name text,
  caption text,
  observed_at timestamptz,
  published_at timestamptz,
  media jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive family(id) as (
    select p_seedling_id
    union
    select s.id from public.seedlings s join family f on s.merged_into_id = f.id
  )
  select u.id,
         p.id,
         p.display_name,
         u.caption,
         u.observed_at,
         u.published_at,
         (select jsonb_agg(jsonb_build_object(
                   'id', d.id, 'path', d.storage_path, 'width', d.width, 'height', d.height)
                 order by um.sort_order, d.id)
            from public.update_media um
            join public.public_derivatives d on d.id = um.derivative_id
           where um.update_id = u.id and d.deleted_at is null)
    from public.updates u
    join family f on f.id = u.seedling_id
    join public.profiles p on p.id = u.author_id
   where public._update_is_public(u.id)
   order by u.observed_at, u.published_at, u.id;
$$;

revoke all on function public.list_canonical_seedling_updates(uuid) from public;
grant execute on function public.list_canonical_seedling_updates(uuid) to anon, authenticated;
