-- Phase 3: Capture & Observations.
--
-- An observation is private documentation of a seedling at a time: photos or short videos, an
-- optional note, and an optional dictation transcript. Observations are private to their author.
-- A seedling's visibility never changes who can read its observations or media.
--
-- Media originals live in the private-media bucket. Nothing in this migration makes an original
-- publicly readable. Clients never insert observations or media rows directly: capture_observation,
-- move_observation and delete_observation are the write paths.

create type public.observation_visibility as enum ('private', 'public');
create type public.media_kind as enum ('image', 'video');
create type public.media_visibility as enum ('private', 'public');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  kind public.media_kind not null,
  storage_path text not null unique check (char_length(storage_path) between 1 and 512),
  public_derivative_path text,
  visibility public.media_visibility not null default 'private',
  mime_type text not null check (
    mime_type in (
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime', 'video/webm'
    )
  ),
  byte_size bigint not null check (byte_size > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint media_kind_matches_type check (
    (kind = 'image' and mime_type like 'image/%') or (kind = 'video' and mime_type like 'video/%')
  ),
  -- Phase 3 has no publication. Public derivatives and public media arrive with Phase 4.
  constraint media_private_in_phase3 check (visibility = 'private' and public_derivative_path is null)
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  seedling_id uuid not null references public.seedlings (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  observed_at timestamptz not null,
  visibility public.observation_visibility not null default 'private',
  note text check (note is null or char_length(note) <= 2000),
  voice_transcript text check (voice_transcript is null or char_length(voice_transcript) <= 2000),
  structured_data jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Phase 3 has no observation publication. Sharing creates an Update in Phase 4.
  constraint observations_private_in_phase3 check (visibility = 'private')
);

create table public.observation_media (
  observation_id uuid not null references public.observations (id) on delete restrict,
  media_id uuid not null references public.media (id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (observation_id, media_id),
  unique (observation_id, media_id)
);

create index observations_seedling_observed_idx
  on public.observations (seedling_id, observed_at desc)
  where deleted_at is null;
create index observations_author_idx on public.observations (author_id);
create index media_owner_idx on public.media (owner_id);
create index observation_media_media_idx on public.observation_media (media_id);

-- ---------------------------------------------------------------------------
-- Triggers: identity and lifecycle invariants hold for every role
-- ---------------------------------------------------------------------------

create trigger observations_set_updated_at
  before update on public.observations
  for each row execute function public.set_updated_at();

create function public.protect_observation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'observations are soft-deleted, never removed' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.author_id <> old.author_id then
      raise exception 'an observation''s author and identity never change' using errcode = '42501';
    end if;
    -- Moving to another seedling is the Change operation only.
    if new.seedling_id <> old.seedling_id
       and coalesce(current_setting('dahlia.observation_move', true), '') <> 'on' then
      raise exception 'observations move only through the Change operation' using errcode = '42501';
    end if;
    if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
      raise exception 'a deleted observation cannot be restored here' using errcode = '42501';
    end if;
  end if;

  -- An observation cannot be dated in the future. A few minutes of clock skew are allowed.
  if new.observed_at > now() + interval '5 minutes' then
    raise exception 'the observed time cannot be in the future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger observations_protect
  before insert or update or delete on public.observations
  for each row execute function public.protect_observation();

create function public.protect_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'media is soft-deleted, never removed' using errcode = '42501';
  end if;
  if new.id <> old.id
     or new.owner_id <> old.owner_id
     or new.kind <> old.kind
     or new.storage_path <> old.storage_path
     or new.mime_type <> old.mime_type
     or new.byte_size <> old.byte_size
     or new.created_at <> old.created_at then
    raise exception 'media identity and original file never change' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger media_protect
  before update or delete on public.media
  for each row execute function public.protect_media();

create function public.links_are_fixed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'observation media links are created once and never changed' using errcode = '42501';
end;
$$;

create trigger observation_media_fixed
  before update or delete on public.observation_media
  for each row execute function public.links_are_fixed();

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------

alter table public.media enable row level security;
alter table public.observations enable row level security;
alter table public.observation_media enable row level security;

-- Observations: private to their author. A visible seedling does not grant access to them.
-- Clients may change only the note and the observed time, and only while not suspended.
grant select on table public.observations to authenticated;
grant update (note, observed_at) on table public.observations to authenticated;

create policy observations_select_author on public.observations for select
  to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null);

create policy observations_update_author on public.observations for update
  to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null and public.caller_can_participate())
  with check (author_id = (select auth.uid()) and deleted_at is null and public.caller_can_participate());

-- Media: readable only by its owner. Visitors and other growers never see a row, so the delivery
-- route and the storage policy both refuse them.
grant select on table public.media to authenticated;

create policy media_select_owner on public.media for select
  to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null);

-- Links are readable exactly when their observation is readable by the caller.
grant select on table public.observation_media to authenticated;

create policy observation_media_select_author on public.observation_media for select
  to authenticated
  using (
    exists (
      select 1 from public.observations o
       where o.id = observation_media.observation_id
         and o.author_id = (select auth.uid())
         and o.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: the private-media bucket
-- ---------------------------------------------------------------------------

-- Private bucket. The per-object limit is the largest allowed video (50 MB). Images are limited to
-- 15 MB by _register_media_object, which can tell them apart.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-media',
  'private-media',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do nothing;

-- Objects are stored under {owner_id}/{file}. A grower may upload only into their own folder.
create policy private_media_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'private-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.caller_can_participate()
  );

-- An object is readable only by its owner. A registered original is readable only while its media is live,
-- so a soft-deleted observation's photos are out of reach. An upload that never became media is the owner's
-- own file and stays readable to them, so they can remove it after a cancelled or failed capture.
-- The exact path is not enough: the policy checks ownership and the media row.
-- Whether an object has no media row at all. It runs as its definer, so RLS on public.media cannot hide
-- a soft-deleted row. A deleted original is still a registered original: its owner may not read it, or
-- remove it, through storage.
create or replace function public._media_object_unregistered(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.media m where m.storage_path = p_name);
$$;

revoke all on function public._media_object_unregistered(text) from public, anon;
grant execute on function public._media_object_unregistered(text) to authenticated;

create policy private_media_select_owner
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'private-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (
      exists (
        select 1 from public.media m
         where m.storage_path = storage.objects.name
           and m.owner_id = (select auth.uid())
           and m.deleted_at is null
      )
      or public._media_object_unregistered(storage.objects.name)
    )
  );

-- An owner may remove an upload that never became media (a cancelled or failed capture).
-- Registered media is never removed through storage.
create policy private_media_delete_unregistered
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'private-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.caller_can_participate()
    and public._media_object_unregistered(storage.objects.name)
  );

-- ---------------------------------------------------------------------------
-- Domain functions: the only write paths
-- ---------------------------------------------------------------------------

-- Registers an uploaded object as media. It reads the type and size from storage metadata, not from the
-- client, and it refuses files over the image or video limit. Internal: called only by capture_observation.
create function public._register_media_object(p_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_object storage.objects;
  v_mime text;
  v_size bigint;
  v_kind public.media_kind;
  v_limit bigint;
  v_id uuid;
begin
  select * into v_object from storage.objects
   where bucket_id = 'private-media' and name = p_path;
  if not found then
    raise exception 'that upload could not be found' using errcode = 'P0002';
  end if;
  if (storage.foldername(v_object.name))[1] <> v_uid::text then
    raise exception 'that upload belongs to another grower' using errcode = '42501';
  end if;

  v_mime := v_object.metadata ->> 'mimetype';
  v_size := nullif(v_object.metadata ->> 'size', '')::bigint;

  if v_mime in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif') then
    v_kind := 'image';
    v_limit := 15 * 1024 * 1024;
  elsif v_mime in ('video/mp4', 'video/quicktime', 'video/webm') then
    v_kind := 'video';
    v_limit := 50 * 1024 * 1024;
  else
    raise exception 'that file type is not supported' using errcode = '23514';
  end if;

  if v_size is null or v_size <= 0 or v_size > v_limit then
    raise exception 'that file is larger than the limit for its type' using errcode = '23514';
  end if;

  insert into public.media (owner_id, kind, storage_path, mime_type, byte_size)
  values (v_uid, v_kind, p_path, v_mime, v_size)
  returning id into v_id;

  return v_id;
end;
$$;

-- Creates one observation with its media, in one transaction. Either a seedling is created or chosen,
-- and the observation and all its media are written, or nothing is. Retrying the same uploads returns the
-- observation that already exists, so a double submission cannot create a duplicate.
create function public.capture_observation(
  p_seedling_id uuid default null,
  p_new_seedling boolean default false,
  p_observed_at timestamptz default null,
  p_note text default null,
  p_voice_transcript text default null,
  p_paths text[] default null
)
returns public.observations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer := coalesce(array_length(p_paths, 1), 0);
  v_existing public.observations;
  v_seedling uuid;
  v_obs public.observations;
  v_media uuid;
  v_note text := nullif(btrim(p_note), '');
  v_voice text := nullif(btrim(p_voice_transcript), '');
  i integer;
begin
  if v_uid is null then
    raise exception 'sign in to capture' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot capture' using errcode = '42501';
  end if;
  if v_count < 1 or v_count > 6 then
    raise exception 'choose between 1 and 6 files for one capture' using errcode = '23514';
  end if;
  if (select count(distinct p) from unnest(p_paths) as p) <> v_count then
    raise exception 'the same file was listed twice' using errcode = '23514';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'notes are 2000 characters or fewer' using errcode = '23514';
  end if;

  -- Retry safety: if these uploads are already part of an observation by this grower, return it.
  select o.* into v_existing
    from public.observations o
    join public.observation_media om on om.observation_id = o.id
    join public.media m on m.id = om.media_id
   where m.storage_path = p_paths[1] and m.owner_id = v_uid
   limit 1;
  if found then
    return v_existing;
  end if;

  if p_new_seedling then
    select (public.create_seedling()).id into v_seedling;
  else
    select s.id into v_seedling from public.seedlings s
     where s.id = p_seedling_id and s.current_holder_id = v_uid and s.deleted_at is null;
    if not found then
      raise exception 'seedling not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.observations (seedling_id, author_id, observed_at, note, voice_transcript)
  values (v_seedling, v_uid, coalesce(p_observed_at, now()), v_note, v_voice)
  returning * into v_obs;

  for i in 1..v_count loop
    v_media := public._register_media_object(p_paths[i]);
    insert into public.observation_media (observation_id, media_id, sort_order)
    values (v_obs.id, v_media, i - 1);
  end loop;

  return v_obs;
end;
$$;

-- Moves an observation to another seedling the author currently holds. The media is not touched, so the
-- observation and its media keep their identities and their storage paths. The author must hold the target.
create function public.move_observation(
  p_observation_id uuid,
  p_target_seedling_id uuid default null,
  p_new_seedling boolean default false
)
returns public.observations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_obs public.observations;
  v_target uuid;
begin
  if v_uid is null then
    raise exception 'sign in to move an observation' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot move observations' using errcode = '42501';
  end if;

  -- Not the author and not existing look the same to the caller.
  select * into v_obs from public.observations
   where id = p_observation_id and author_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'observation not found' using errcode = 'P0002';
  end if;

  if p_new_seedling then
    select (public.create_seedling()).id into v_target;
  else
    select s.id into v_target from public.seedlings s
     where s.id = p_target_seedling_id and s.current_holder_id = v_uid and s.deleted_at is null;
    if not found then
      raise exception 'seedling not found' using errcode = 'P0002';
    end if;
  end if;

  if v_target = v_obs.seedling_id then
    return v_obs;
  end if;

  perform set_config('dahlia.observation_move', 'on', true);
  update public.observations
     set seedling_id = v_target
   where id = v_obs.id
  returning * into v_obs;
  perform set_config('dahlia.observation_move', 'off', true);

  return v_obs;
end;
$$;

-- Soft-deletes an observation and its media. The original files stay in private storage, out of reach,
-- until a later retention process removes them.
create function public.delete_observation(p_observation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'sign in to delete an observation' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot delete observations' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.observations
     where id = p_observation_id and author_id = v_uid and deleted_at is null
  ) then
    raise exception 'observation not found' using errcode = 'P0002';
  end if;

  update public.observations set deleted_at = now() where id = p_observation_id;
  update public.media m set deleted_at = now()
    from public.observation_media om
   where om.media_id = m.id and om.observation_id = p_observation_id and m.deleted_at is null;
end;
$$;

-- Function execution: authenticated growers only.
revoke execute on function public._register_media_object(text) from public, anon, authenticated;
revoke execute on function public.capture_observation(uuid, boolean, timestamptz, text, text, text[]) from public, anon;
revoke execute on function public.move_observation(uuid, uuid, boolean) from public, anon;
revoke execute on function public.delete_observation(uuid) from public, anon;

grant execute on function public.capture_observation(uuid, boolean, timestamptz, text, text, text[]) to authenticated;
grant execute on function public.move_observation(uuid, uuid, boolean) to authenticated;
grant execute on function public.delete_observation(uuid) to authenticated;
