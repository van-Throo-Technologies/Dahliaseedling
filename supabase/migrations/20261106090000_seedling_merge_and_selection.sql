-- Phase 9: Seedling merge (same current holder only), retired identity, holder-scoped Capture selection.
--
-- A merge records that the grower confirmed two DahliaSeedling records represent one genetically unique Seedling. It does not
-- transfer a holder, rewrite an originator, rewrite provenance, rewrite parentage, or delete anything. The duplicate keeps its UUID
-- and becomes a retired merged identity that resolves to the canonical Seedling. Every new-work path refuses a retired identity.

-- 1. Provenance: one additive event type. Existing rows are untouched; the append-only trigger stays in force.
alter table public.provenance_events drop constraint if exists provenance_events_event_type_check;
alter table public.provenance_events add constraint provenance_events_event_type_check
  check (event_type in ('originated', 'continuation_received', 'merged_into'));

-- 2. Retired identity. A duplicate points at its canonical Seedling and is inactive (deleted_at), so every existing gate
-- that refuses an inactive Seedling refuses it too. Clients cannot read the new column; the functions below expose what is needed.
alter table public.seedlings add column merged_into_id uuid references public.seedlings (id) on delete restrict;
alter table public.seedlings add constraint seedlings_merged_into_not_self check (merged_into_id is null or merged_into_id <> id);
alter table public.seedlings add constraint seedlings_merged_is_retired check (merged_into_id is null or deleted_at is not null);

-- 3. The merge record: who confirmed which canonical identity, and when. Append-only.
create table public.seedling_merges (
  id uuid primary key default gen_random_uuid(),
  retired_seedling_id uuid not null unique references public.seedlings (id) on delete restrict,
  canonical_seedling_id uuid not null references public.seedlings (id) on delete restrict,
  confirmed_by uuid not null references public.profiles (id) on delete restrict,
  merged_at timestamptz not null default now(),
  constraint seedling_merges_distinct check (retired_seedling_id <> canonical_seedling_id)
);

create function public.seedling_merges_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'merge records are append-only' using errcode = '42501';
end;
$$;

create trigger seedling_merges_append_only_guard
  before update or delete on public.seedling_merges
  for each row execute function public.seedling_merges_append_only();

alter table public.seedling_merges enable row level security;
revoke all on table public.seedling_merges from anon, authenticated;
grant select (id, retired_seedling_id, canonical_seedling_id, confirmed_by, merged_at) on table public.seedling_merges to authenticated;

create policy seedling_merges_select_confirmer on public.seedling_merges for select
  to authenticated
  using (confirmed_by = (select auth.uid()));

-- 4. Locking guards for new work. Each new Observation, Update, Rehome case, Seed source, Seed Offer, subscription, follow or save
-- takes the Seedling's row lock and refuses an inactive or retired Seedling. The lock serialises the work with a merge, so a race
-- has one valid outcome.
create function public._guard_seedling_for_new_work(p_seedling_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted timestamptz;
  v_found boolean;
begin
  if p_seedling_id is null then return; end if;
  select s.deleted_at, true into v_deleted, v_found from public.seedlings s where s.id = p_seedling_id for update;
  if not found or v_deleted is not null then
    raise exception 'that seedling could not be found' using errcode = 'P0002';
  end if;
end;
$$;

create function public._rehome_cases_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._guard_seedling_for_new_work(new.seedling_id);
  return new;
end;
$$;

create trigger rehome_cases_guard before insert on public.rehome_cases
  for each row execute function public._rehome_cases_guard();

create function public._seed_sources_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._guard_seedling_for_new_work(new.source_seedling_id);
  return new;
end;
$$;

create trigger seed_sources_guard before insert on public.seed_sources
  for each row execute function public._seed_sources_guard();

create function public._seed_offers_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source uuid;
begin
  select ss.source_seedling_id into v_source from public.seed_sources ss where ss.id = new.seed_source_id;
  perform public._guard_seedling_for_new_work(v_source);
  return new;
end;
$$;

create trigger seed_offers_guard before insert on public.seed_offers
  for each row execute function public._seed_offers_guard();

create function public._observations_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._guard_seedling_for_new_work(new.seedling_id);
  return new;
end;
$$;

create trigger observations_guard before insert on public.observations
  for each row execute function public._observations_guard();

create function public._updates_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._guard_seedling_for_new_work(new.seedling_id);
  return new;
end;
$$;

create trigger updates_guard before insert on public.updates
  for each row execute function public._updates_guard();

create function public._subscriptions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._guard_seedling_for_new_work(new.seedling_id);
  return new;
end;
$$;

create trigger availability_subscriptions_guard before insert on public.availability_subscriptions
  for each row execute function public._subscriptions_guard();

create function public._follows_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._guard_seedling_for_new_work(new.seedling_id);
  return new;
end;
$$;

create trigger seedling_follows_guard before insert on public.seedling_follows
  for each row execute function public._follows_guard();

create trigger saved_seedlings_guard before insert on public.saved_seedlings
  for each row execute function public._follows_guard();

-- 5. A retired identity cannot change holder. The Phase 6 confirmation sets the flag for its own transaction only; this trigger
-- additionally refuses the change when the Seedling is already inactive, so a race with a merge cannot move a retired record.
create function public._holder_change_requires_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.current_holder_id is distinct from old.current_holder_id
     and (old.deleted_at is not null or old.merged_into_id is not null) then
    raise exception 'a retired seedling cannot change holder' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger seedlings_holder_change_requires_active before update of current_holder_id on public.seedlings
  for each row execute function public._holder_change_requires_active();

-- 6. Public Updates of a retired duplicate stay public, because their history is preserved and their visibility rule has not
-- changed: the Seedling must still be public, and its holder and author must not be suspended. Only the "inactive Seedling"
-- condition is relaxed for a merged identity.
create or replace function public._update_is_public(p_update_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.updates u
      join public.seedlings s on s.id = u.seedling_id
      join public.profiles holder on holder.id = s.current_holder_id
      join public.profiles author on author.id = u.author_id
     where u.id = p_update_id
       and u.deleted_at is null
       and (s.deleted_at is null or s.merged_into_id is not null)
       and s.visibility = 'public'
       and not holder.is_suspended
       and not author.is_suspended
  );
$$;

-- 7. Canonical identity resolution for a retired identifier. Returns the canonical Seedling only where the caller could see it
-- anyway; otherwise null, which the caller treats as not found.
create function public.seedling_canonical_id(p_seedling_id uuid)
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
begin
  select * into s from public.seedlings where id = p_seedling_id;
  if not found or s.merged_into_id is null then return null; end if;
  select * into c from public.seedlings where id = s.merged_into_id;
  if not found or c.deleted_at is not null or c.merged_into_id is not null then return null; end if;
  if c.visibility = 'public' and exists (
    select 1 from public.profiles p where p.id = c.current_holder_id and not p.is_suspended
  ) then
    return c.id;
  end if;
  if v_uid is not null and c.current_holder_id = v_uid then return c.id; end if;
  return null;
end;
$$;

-- 8. Holder-scoped candidate selection for Capture. The corpus is the caller's own active Seedlings as current holder, and nothing
-- else. Ordering is deterministic: most recent capture, then creation time, then identifier. No popularity, likes or engagement.
create function public.held_seedling_candidates(p_limit integer default 200)
returns table (
  seedling_id uuid,
  working_name text,
  last_capture_at timestamptz,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id,
         s.working_name,
         (select max(o.observed_at) from public.observations o
           where o.seedling_id = s.id and o.deleted_at is null) as last_capture_at,
         s.created_at
    from public.seedlings s
   where s.current_holder_id = (select auth.uid())
     and s.deleted_at is null
   order by last_capture_at desc nulls last, s.created_at desc, s.id asc
   limit least(greatest(p_limit, 1), 200);
$$;

-- 9. The merge. One transaction. Authority is decided here, never in the browser.
create function public.merge_seedlings(p_canonical uuid, p_duplicate uuid, p_confirmed boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.seedlings;
  d public.seedlings;
  v_merge uuid;
begin
  if v_uid is null then raise exception 'sign in to merge seedlings' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot merge seedlings' using errcode = '42501'; end if;
  if p_canonical is null or p_duplicate is null or p_canonical = p_duplicate then
    raise exception 'choose two different seedlings' using errcode = '23514';
  end if;
  if p_confirmed is not true then raise exception 'confirm the merge to continue' using errcode = '23514'; end if;

  -- Lock both rows in identifier order, so two merges can never wait on each other in opposite order.
  perform 1 from public.seedlings where id = least(p_canonical, p_duplicate) for update;
  perform 1 from public.seedlings where id = greatest(p_canonical, p_duplicate) for update;
  select * into c from public.seedlings where id = p_canonical;
  if not found then raise exception 'that seedling could not be found' using errcode = 'P0002'; end if;
  select * into d from public.seedlings where id = p_duplicate;
  if not found then raise exception 'that seedling could not be found' using errcode = 'P0002'; end if;

  if c.deleted_at is not null or c.merged_into_id is not null
     or d.deleted_at is not null or d.merged_into_id is not null then
    raise exception 'a retired seedling cannot be merged' using errcode = '23514';
  end if;
  if c.current_holder_id <> v_uid or d.current_holder_id <> v_uid then
    raise exception 'only the current holder of both seedlings can merge them' using errcode = '42501';
  end if;
  if c.originator_id <> d.originator_id then
    raise exception 'these seedlings have different originators, so they cannot be merged here' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.rehome_cases r
     where r.seedling_id in (c.id, d.id) and r.status in ('available', 'arranged', 'sent')
  ) then
    raise exception 'finish or cancel the continuation of these seedlings first' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.seed_offers o
      join public.seed_sources ss on ss.id = o.seed_source_id
     where ss.source_seedling_id in (c.id, d.id) and o.is_active
  ) then
    raise exception 'close the seed offers from these seedlings first' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.availability_subscriptions a
     where a.seedling_id = d.id and a.closed_at is null
  ) then
    raise exception 'stop the availability alerts for the duplicate first' using errcode = '23514';
  end if;

  -- Identifiers: every identifier of the duplicate stays permanently resolvable as a retired alias. None is reissued or renamed.
  update public.seedling_identifiers set is_retired_alias = true
   where seedling_id = d.id and is_retired_alias = false;

  -- The caller's own Observations move to the canonical Seedling through the existing Change path. Media is not re-uploaded.
  perform set_config('dahlia.observation_move', 'on', true);
  update public.observations set seedling_id = c.id
   where seedling_id = d.id and author_id = v_uid and deleted_at is null;
  perform set_config('dahlia.observation_move', 'off', true);

  -- Follows and saves are consolidated onto the canonical Seedling without duplicate rows.
  insert into public.seedling_follows (user_id, seedling_id, created_at)
  select f.user_id, c.id, f.created_at from public.seedling_follows f where f.seedling_id = d.id
  on conflict (user_id, seedling_id) do nothing;
  delete from public.seedling_follows where seedling_id = d.id;

  insert into public.saved_seedlings (user_id, seedling_id, created_at)
  select sv.user_id, c.id, sv.created_at from public.saved_seedlings sv where sv.seedling_id = d.id
  on conflict (user_id, seedling_id) do nothing;
  delete from public.saved_seedlings where seedling_id = d.id;

  -- Append-only history on the retired record. No holder transfer, no parentage row, no existing provenance row is touched.
  insert into public.provenance_events (seedling_id, event_type, metadata)
  values (d.id, 'merged_into', jsonb_build_object('canonical_seedling_id', c.id, 'confirmed_by', v_uid));

  insert into public.seedling_merges (retired_seedling_id, canonical_seedling_id, confirmed_by)
  values (d.id, c.id, v_uid)
  returning id into v_merge;

  -- The duplicate becomes a retired identity. Its UUID, rows and history remain.
  update public.seedlings
     set merged_into_id = c.id, deleted_at = now(), updated_at = now()
   where id = d.id;

  return v_merge;
end;
$$;

-- 10. Grants. Each new function is granted explicitly, and PUBLIC is revoked from each (the repository convention). Trigger
-- functions are not called by clients, but they are revoked too, so the worker role never gains execute through PUBLIC.
revoke all on function public._rehome_cases_guard() from public, anon, authenticated, service_role;
revoke all on function public._seed_sources_guard() from public, anon, authenticated, service_role;
revoke all on function public._seed_offers_guard() from public, anon, authenticated, service_role;
revoke all on function public._observations_guard() from public, anon, authenticated, service_role;
revoke all on function public._updates_guard() from public, anon, authenticated, service_role;
revoke all on function public._subscriptions_guard() from public, anon, authenticated, service_role;
revoke all on function public._follows_guard() from public, anon, authenticated, service_role;
revoke all on function public._holder_change_requires_active() from public, anon, authenticated, service_role;
-- Every new function is granted explicitly, and PUBLIC is revoked from each (the repository convention).
revoke all on function public._guard_seedling_for_new_work(uuid) from public, anon, authenticated, service_role;
revoke all on function public.seedling_merges_append_only() from public, anon, authenticated, service_role;
revoke all on function public.merge_seedlings(uuid, uuid, boolean) from public, anon;
revoke all on function public.seedling_canonical_id(uuid) from public;
revoke all on function public.held_seedling_candidates(integer) from public, anon;
grant execute on function public.merge_seedlings(uuid, uuid, boolean) to authenticated;
grant execute on function public.seedling_canonical_id(uuid) to anon, authenticated;
grant execute on function public.held_seedling_candidates(integer) to authenticated;
