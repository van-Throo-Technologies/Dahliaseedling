-- Phase 2: Seedling Core.
--
-- Series identifiers: {YY} is the seedling's first-grown year (never the record creation date).
-- A pattern with {YY} counts per Series and cohort year; a pattern without {YY} counts per Series.
-- A year-based identifier needs a first-grown year, so it is allocated later through
-- attach_series_identifier if the year is not known when the seedling is created.
--
-- A seedling row is one genetically unique dahlia grown from seed. Its uuid is the immutable
-- internal identity. Human-readable identifiers are labels in seedling_identifiers.
--
-- Clients never insert seedlings, identifiers, parentage or provenance directly. They call the
-- functions at the end of this file, which validate input and write every record in one
-- transaction. Clients may only update three presentation fields on a seedling they hold.

create type public.seedling_visibility as enum ('private', 'public');
create type public.identifier_kind as enum ('automatic', 'series', 'originator', 'local', 'working_alias');
create type public.parent_role as enum ('seed_parent', 'pollen_parent', 'parent_unknown_role');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A breeder-controlled identifier line such as JV. Owned by one profile.
create table public.series (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (name ~ '^[A-Z0-9]{1,8}$'),
  pattern text not null,
  next_sequence integer not null default 1 check (next_sequence >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint series_pattern_matches_name
    check (pattern = name || '-{YY}-{NNN}' or pattern = name || '-{NNN}'),
  constraint series_owner_name_unique unique (owner_id, name)
);

-- Lightweight reference for parentage only. Not a cultivar collection.
create table public.cultivar_references (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  normalized_name text not null unique check (char_length(normalized_name) between 2 and 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.seedlings (
  id uuid primary key default gen_random_uuid(),
  originator_id uuid not null references public.profiles (id) on delete restrict,
  current_holder_id uuid not null references public.profiles (id) on delete restrict,
  visibility public.seedling_visibility not null default 'private',
  working_name text
    check (working_name is null or char_length(working_name) between 1 and 80),
  first_grown_year smallint
    check (first_grown_year is null or first_grown_year between 1900 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.seedling_identifiers (
  id uuid primary key default gen_random_uuid(),
  seedling_id uuid not null references public.seedlings (id) on delete restrict,
  identifier text not null check (char_length(identifier) between 1 and 40),
  kind public.identifier_kind not null,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  series_id uuid references public.series (id) on delete restrict,
  is_primary_for_user boolean not null default false,
  is_retired_alias boolean not null default false,
  created_at timestamptz not null default now(),
  constraint identifier_series_link check ((kind = 'series') = (series_id is not null))
);

create table public.seedling_parentage (
  id uuid primary key default gen_random_uuid(),
  child_seedling_id uuid not null references public.seedlings (id) on delete restrict,
  role public.parent_role not null,
  parent_seedling_id uuid references public.seedlings (id) on delete restrict,
  parent_cultivar_id uuid references public.cultivar_references (id) on delete restrict,
  is_unknown boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 280),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- Exactly one of: a known seedling parent, a known cultivar, or an explicit unknown.
  constraint parentage_exactly_one_reference
    check ((parent_seedling_id is not null)::integer
         + (parent_cultivar_id is not null)::integer
         + is_unknown::integer = 1),
  constraint parentage_not_self
    check (parent_seedling_id is null or parent_seedling_id <> child_seedling_id),
  constraint parentage_one_per_role unique (child_seedling_id, role)
);

create table public.provenance_events (
  id uuid primary key default gen_random_uuid(),
  seedling_id uuid not null references public.seedlings (id) on delete restrict,
  event_type text not null check (event_type in ('originated')),
  from_holder_id uuid references public.profiles (id) on delete restrict,
  to_holder_id uuid references public.profiles (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index seedlings_visibility_updated_idx on public.seedlings (visibility, updated_at);
create index seedlings_current_holder_idx on public.seedlings (current_holder_id);
create index seedlings_originator_idx on public.seedlings (originator_id);

-- One identifier per namespace. The namespace owner is assigned_by. Retired rows stay in the
-- table, so a retired identifier can never be issued again.
create unique index seedling_identifiers_namespace_unique
  on public.seedling_identifiers (assigned_by, identifier);
create index seedling_identifiers_seedling_idx on public.seedling_identifiers (seedling_id);
-- At most one primary, current identifier per seedling.
create unique index seedling_identifiers_primary_unique
  on public.seedling_identifiers (seedling_id)
  where is_primary_for_user and not is_retired_alias;

create index seedling_parentage_parent_seedling_idx on public.seedling_parentage (parent_seedling_id);
create index seedling_parentage_parent_cultivar_idx on public.seedling_parentage (parent_cultivar_id);

create index provenance_events_seedling_idx on public.provenance_events (seedling_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Triggers: identity, identifier and provenance invariants hold for every role
-- ---------------------------------------------------------------------------

create trigger seedlings_set_updated_at
  before update on public.seedlings
  for each row execute function public.set_updated_at();

create function public.protect_seedling_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id then
    raise exception 'seedling identity is immutable' using errcode = '42501';
  end if;
  if new.originator_id <> old.originator_id then
    raise exception 'originator attribution is permanent' using errcode = '42501';
  end if;
  -- Holder changes are reserved for the confirmed-continuation transaction (Phase 6), which sets
  -- this flag for its own transaction only. Nothing else can change the holder.
  if new.current_holder_id <> old.current_holder_id
     and coalesce(current_setting('dahlia.holder_transfer', true), '') <> 'confirmed' then
    raise exception 'current holder changes only through confirmed continuation'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger seedlings_protect_identity
  before update on public.seedlings
  for each row execute function public.protect_seedling_identity();

create function public.forbid_seedling_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'seedlings are never hard-deleted; use deleted_at' using errcode = '42501';
end;
$$;

create trigger seedlings_forbid_delete
  before delete on public.seedlings
  for each row execute function public.forbid_seedling_delete();

create function public.protect_seedling_identifiers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'identifiers are never deleted, so they are never reused' using errcode = '42501';
  end if;
  if new.identifier <> old.identifier
     or new.seedling_id <> old.seedling_id
     or new.kind <> old.kind
     or new.assigned_by <> old.assigned_by
     or new.series_id is distinct from old.series_id then
    raise exception 'identifier values and owners never change' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger seedling_identifiers_protect
  before update or delete on public.seedling_identifiers
  for each row execute function public.protect_seedling_identifiers();

create function public.provenance_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'provenance history is append-only' using errcode = '42501';
end;
$$;

create trigger provenance_events_append_only
  before update or delete on public.provenance_events
  for each row execute function public.provenance_is_append_only();

-- ---------------------------------------------------------------------------
-- Row level security and grants (created with the tables)
-- ---------------------------------------------------------------------------

-- True when the signed-in user has a profile that is not suspended. Used by write policies.
create function public.caller_can_participate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and not is_suspended
  );
$$;

revoke execute on function public.caller_can_participate() from public, anon;
grant execute on function public.caller_can_participate() to authenticated;

alter table public.series enable row level security;
alter table public.cultivar_references enable row level security;
alter table public.seedlings enable row level security;
alter table public.seedling_identifiers enable row level security;
alter table public.seedling_parentage enable row level security;
alter table public.provenance_events enable row level security;

-- Series: private to their owner. Created only through create_series.
grant select on table public.series to authenticated;
grant update (active) on table public.series to authenticated;

create policy series_select_owner on public.series for select to authenticated
  using (owner_id = (select auth.uid()));

create policy series_update_owner on public.series for update to authenticated
  using (owner_id = (select auth.uid()) and public.caller_can_participate())
  with check (owner_id = (select auth.uid()) and public.caller_can_participate());

-- Cultivar references: public lookup data. Created only through set_seedling_parent.
grant select on table public.cultivar_references to anon, authenticated;

create policy cultivar_references_select_all on public.cultivar_references for select
  to anon, authenticated
  using (true);

-- Seedlings. A public seedling is visible to everyone while its current holder's profile is not
-- suspended. A private seedling is visible only to its current holder.
grant select on table public.seedlings to anon, authenticated;
grant update (working_name, first_grown_year, visibility) on table public.seedlings to authenticated;

-- The originator keeps READ access to a seedling they raised, even after the current holder changes.
-- This is read access only. Every write policy and every domain function checks current_holder_id.
create policy seedlings_select_originator on public.seedlings for select
  to authenticated
  using (originator_id = (select auth.uid()) and deleted_at is null);

create policy seedlings_select_public on public.seedlings for select
  to anon, authenticated
  using (
    visibility = 'public'
    and deleted_at is null
    and exists (
      select 1 from public.profiles holder
       where holder.id = seedlings.current_holder_id and not holder.is_suspended
    )
  );

create policy seedlings_select_holder on public.seedlings for select
  to authenticated
  using (current_holder_id = (select auth.uid()) and deleted_at is null);

create policy seedlings_update_holder on public.seedlings for update to authenticated
  using (
    current_holder_id = (select auth.uid()) and deleted_at is null
    and public.caller_can_participate()
  )
  with check (
    current_holder_id = (select auth.uid()) and deleted_at is null
    and public.caller_can_participate()
  );

-- Identifiers, parentage and provenance are readable exactly when their seedling is readable.
-- The subquery runs as the reader, so seedling RLS decides.
grant select on table public.seedling_identifiers to anon, authenticated;
create policy seedling_identifiers_select_visible on public.seedling_identifiers for select
  to anon, authenticated
  using (exists (select 1 from public.seedlings s where s.id = seedling_identifiers.seedling_id));

grant select on table public.provenance_events to anon, authenticated;
create policy provenance_events_select_visible on public.provenance_events for select
  to anon, authenticated
  using (exists (select 1 from public.seedlings s where s.id = provenance_events.seedling_id));

-- Parentage: a link to a parent seedling is shown only when the reader may see that parent, so
-- a private parent's existence is not disclosed through a public child.
grant select on table public.seedling_parentage to anon, authenticated;
create policy seedling_parentage_select_visible on public.seedling_parentage for select
  to anon, authenticated
  using (
    exists (select 1 from public.seedlings c where c.id = seedling_parentage.child_seedling_id)
    and (
      seedling_parentage.parent_seedling_id is null
      or exists (
        select 1 from public.seedlings p where p.id = seedling_parentage.parent_seedling_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Domain functions: the only write path for identity, identifiers, parentage and provenance
-- ---------------------------------------------------------------------------

-- Allocates the next Series identifier for a seedling.
--   * Pattern with {YY}: the year is the seedling's first-grown year, and the sequence is per
--     Series + cohort year. Concurrent allocations for the same pair are serialised by an advisory lock.
--   * Pattern without {YY}: one lifetime sequence per Series, serialised by the row lock on the Series.
-- Retired identifiers remain in seedling_identifiers, so they are counted and never reissued.
-- Internal helper: callers have already verified that the caller owns the Series.
create function public.next_series_identifier(p_series_id uuid, p_first_grown_year smallint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.series;
  v_sequence integer;
  v_prefix text;
begin
  select * into v_series from public.series where id = p_series_id;

  if v_series.pattern like '%{YY}%' then
    if p_first_grown_year is null then
      raise exception 'Enter a first grown year to use series %.', v_series.name
        using errcode = '23514';
    end if;

    v_prefix := replace(
      replace(v_series.pattern, '{YY}', lpad((p_first_grown_year % 100)::text, 2, '0')),
      '{NNN}', ''
    );

    perform pg_advisory_xact_lock(
      hashtextextended('series-cohort:' || p_series_id::text || ':' || p_first_grown_year::text, 0)
    );

    select coalesce(max(substring(identifier from char_length(v_prefix) + 1)::integer), 0) + 1
      into v_sequence
      from public.seedling_identifiers
     where series_id = p_series_id
       and kind = 'series'
       and identifier like (v_prefix || '%');
  else
    update public.series
       set next_sequence = next_sequence + 1
     where id = p_series_id
    returning next_sequence - 1 into v_sequence;

    v_prefix := replace(v_series.pattern, '{NNN}', '');
  end if;

  return v_prefix || lpad(v_sequence::text, 3, '0');
end;
$$;

revoke execute on function public.next_series_identifier(uuid, smallint) from public, anon, authenticated;

-- Creates a seedling with its identity, automatic number, optional Series identifier and the
-- originated provenance event, in one transaction.
create function public.create_seedling(
  p_series_id uuid default null,
  p_working_name text default null,
  p_first_grown_year smallint default null,
  p_visibility public.seedling_visibility default 'private'
)
returns public.seedlings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_series public.series;
  v_seedling public.seedlings;
  v_number integer;
  v_identifier text;
begin
  if v_uid is null then
    raise exception 'sign in to create a seedling' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'create your profile before creating a seedling' using errcode = '42501';
  end if;
  if v_profile.is_suspended then
    raise exception 'suspended accounts cannot create seedlings' using errcode = '42501';
  end if;

  -- Automatic numbers are per grower. The transaction lock serialises concurrent creations by the
  -- same grower, so two of them cannot read the same maximum. The unique index backs this up.
  perform pg_advisory_xact_lock(hashtextextended('seedling-number:' || v_uid::text, 0));
  select coalesce(max(identifier::integer), 0) + 1 into v_number
    from public.seedling_identifiers
   where kind = 'automatic' and assigned_by = v_uid;

  insert into public.seedlings (originator_id, current_holder_id, visibility, working_name, first_grown_year)
  values (
    v_uid,
    v_uid,
    coalesce(p_visibility, 'private'),
    nullif(btrim(p_working_name), ''),
    p_first_grown_year
  )
  returning * into v_seedling;

  insert into public.seedling_identifiers
    (seedling_id, identifier, kind, assigned_by, is_primary_for_user)
  values (v_seedling.id, v_number::text, 'automatic', v_uid, p_series_id is null);

  if p_series_id is not null then
    select * into v_series from public.series
     where id = p_series_id and owner_id = v_uid and active;
    if not found then
      raise exception 'that series is not available to you' using errcode = '42501';
    end if;

    v_identifier := public.next_series_identifier(v_series.id, p_first_grown_year);

    insert into public.seedling_identifiers
      (seedling_id, identifier, kind, assigned_by, series_id, is_primary_for_user)
    values (v_seedling.id, v_identifier, 'series', v_uid, v_series.id, true);
  end if;

  insert into public.provenance_events (seedling_id, event_type, from_holder_id, to_holder_id)
  values (v_seedling.id, 'originated', null, v_uid);

  return v_seedling;
end;
$$;

-- Adds a Series identifier to an existing seedling the caller holds. The seedling's UUID, its
-- automatic number and its first-grown year are not changed. The new identifier becomes the
-- primary display identifier.
create function public.attach_series_identifier(p_seedling_id uuid, p_series_id uuid)
returns public.seedling_identifiers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_seedling public.seedlings;
  v_series public.series;
  v_identifier text;
  v_row public.seedling_identifiers;
begin
  if v_uid is null then
    raise exception 'sign in to change identifiers' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change identifiers' using errcode = '42501';
  end if;

  -- Not holding the seedling and not existing look the same to the caller.
  select * into v_seedling from public.seedlings
   where id = p_seedling_id and current_holder_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'seedling not found' using errcode = 'P0002';
  end if;

  select * into v_series from public.series
   where id = p_series_id and owner_id = v_uid and active;
  if not found then
    raise exception 'that series is not available to you' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.seedling_identifiers
     where seedling_id = p_seedling_id and series_id = p_series_id
  ) then
    raise exception 'this seedling already has an identifier from series %', v_series.name
      using errcode = '23505';
  end if;

  v_identifier := public.next_series_identifier(v_series.id, v_seedling.first_grown_year);

  update public.seedling_identifiers
     set is_primary_for_user = false
   where seedling_id = p_seedling_id and is_primary_for_user;

  insert into public.seedling_identifiers
    (seedling_id, identifier, kind, assigned_by, series_id, is_primary_for_user)
  values (p_seedling_id, v_identifier, 'series', v_uid, v_series.id, true)
  returning * into v_row;

  return v_row;
end;
$$;

-- Creates a Series with an optional year token. The series owns its counter.
create function public.create_series(p_name text, p_include_year boolean)
returns public.series
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := upper(btrim(p_name));
  v_series public.series;
begin
  if v_uid is null then
    raise exception 'sign in to create a series' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot create series' using errcode = '42501';
  end if;
  if v_name !~ '^[A-Z0-9]{1,8}$' then
    raise exception 'use 1 to 8 letters or digits for a series name' using errcode = '23514';
  end if;

  insert into public.series (owner_id, name, pattern)
  values (
    v_uid,
    v_name,
    v_name || case when coalesce(p_include_year, true) then '-{YY}-{NNN}' else '-{NNN}' end
  )
  returning * into v_series;

  return v_series;
end;
$$;

-- Sets one parentage role on a seedling the caller currently holds. kind is one of:
-- 'none' (no parent recorded), 'unknown', 'seedling' (another visible seedling) or 'cultivar'.
create function public.set_seedling_parent(
  p_seedling_id uuid,
  p_role public.parent_role,
  p_kind text,
  p_parent_seedling_id uuid default null,
  p_cultivar_name text default null,
  p_notes text default null
)
returns public.seedling_parentage
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_seedling public.seedlings;
  v_cultivar_id uuid;
  v_row public.seedling_parentage;
  v_name text := regexp_replace(btrim(coalesce(p_cultivar_name, '')), '\s+', ' ', 'g');
begin
  if v_uid is null then
    raise exception 'sign in to change parentage' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change parentage' using errcode = '42501';
  end if;
  if p_role not in ('seed_parent', 'pollen_parent') then
    raise exception 'unsupported parent role' using errcode = '23514';
  end if;

  -- Not holding the seedling and not existing look the same to the caller.
  select * into v_seedling from public.seedlings
   where id = p_seedling_id and current_holder_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'seedling not found' using errcode = 'P0002';
  end if;

  delete from public.seedling_parentage
   where child_seedling_id = p_seedling_id and role = p_role;

  if p_kind = 'none' then
    return null;
  elsif p_kind = 'unknown' then
    insert into public.seedling_parentage (child_seedling_id, role, is_unknown, notes, created_by)
    values (p_seedling_id, p_role, true, nullif(btrim(p_notes), ''), v_uid)
    returning * into v_row;
  elsif p_kind = 'seedling' then
    -- The parent must be a seedling the caller may see. Otherwise the answer is the same as for a
    -- seedling that does not exist.
    if not exists (
      select 1 from public.seedlings p
       where p.id = p_parent_seedling_id
         and p.deleted_at is null
         and p.id <> p_seedling_id
         and (
           p.current_holder_id = v_uid
           or p.originator_id = v_uid
           or (
             p.visibility = 'public'
             and exists (
               select 1 from public.profiles h
                where h.id = p.current_holder_id and not h.is_suspended
             )
           )
         )
    ) then
      raise exception 'parent seedling not found' using errcode = 'P0002';
    end if;

    insert into public.seedling_parentage (child_seedling_id, role, parent_seedling_id, notes, created_by)
    values (p_seedling_id, p_role, p_parent_seedling_id, nullif(btrim(p_notes), ''), v_uid)
    returning * into v_row;
  elsif p_kind = 'cultivar' then
    if char_length(v_name) < 2 or char_length(v_name) > 80 then
      raise exception 'cultivar names are 2 to 80 characters' using errcode = '23514';
    end if;

    insert into public.cultivar_references (name, normalized_name, created_by)
    values (v_name, lower(v_name), v_uid)
    on conflict (normalized_name) do update set name = public.cultivar_references.name
    returning id into v_cultivar_id;

    insert into public.seedling_parentage (child_seedling_id, role, parent_cultivar_id, notes, created_by)
    values (p_seedling_id, p_role, v_cultivar_id, nullif(btrim(p_notes), ''), v_uid)
    returning * into v_row;
  else
    raise exception 'unsupported parent kind' using errcode = '23514';
  end if;

  return v_row;
end;
$$;

-- Resolves a human identifier within the caller's own namespace. Retired aliases still resolve to
-- the canonical seedling. Visibility is applied by RLS, so a private seedling is not returned to
-- anyone else.
create function public.resolve_own_identifier(p_identifier text)
returns table (seedling_id uuid, is_retired_alias boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select si.seedling_id, si.is_retired_alias
    from public.seedling_identifiers si
   where si.assigned_by = (select auth.uid())
     and si.identifier = p_identifier;
$$;

-- Function execution: no PUBLIC or anon access.
revoke execute on function public.create_seedling(uuid, text, smallint, public.seedling_visibility) from public, anon;
revoke execute on function public.create_series(text, boolean) from public, anon;
revoke execute on function public.set_seedling_parent(uuid, public.parent_role, text, uuid, text, text) from public, anon;
revoke execute on function public.resolve_own_identifier(text) from public, anon;

grant execute on function public.create_seedling(uuid, text, smallint, public.seedling_visibility) to authenticated;
grant execute on function public.create_series(text, boolean) to authenticated;
grant execute on function public.set_seedling_parent(uuid, public.parent_role, text, uuid, text, text) to authenticated;
grant execute on function public.resolve_own_identifier(text) to authenticated;

revoke execute on function public.attach_series_identifier(uuid, uuid) from public, anon;
grant execute on function public.attach_series_identifier(uuid, uuid) to authenticated;
