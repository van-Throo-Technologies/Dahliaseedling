-- Phase 4: public community core.
--
-- An Update is a deliberate public publication about one seedling. It is created from an
-- observation, and it carries only the public derivatives of the images the grower selected.
-- The private observation, its private originals, its note, transcript and structured data stay
-- private. Nothing here changes an observation's or a media original's visibility.
--
-- Public images are sanitised derivatives in the public-media bucket. They are private storage
-- objects reached through signed URLs, so visibility is decided by the database at every request.
-- Removing an Update removes what it exposes, without destroying anything the grower documented.
--
-- Clients never write these tables directly. publish_update, delete_update, set_seedling_cover,
-- add_comment, edit_comment, delete_comment, set_like, set_seedling_follow, set_grower_follow and
-- set_seedling_save are the write paths. Public reads go through RLS, and public visibility is
-- decided by the security-definer helpers below, so the same rule applies to every reader.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.public_derivatives (
  id uuid primary key default gen_random_uuid(),
  -- The private original this image was made from. Never returned to clients.
  source_media_id uuid not null references public.media (id) on delete restrict,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  storage_path text not null unique check (char_length(storage_path) between 1 and 512),
  mime_type text not null default 'image/webp' check (mime_type = 'image/webp'),
  byte_size bigint not null check (byte_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index public_derivatives_source_idx on public.public_derivatives (source_media_id);

create table public.updates (
  id uuid primary key default gen_random_uuid(),
  seedling_id uuid not null references public.seedlings (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  caption text check (caption is null or char_length(caption) <= 2000),
  -- Phase 4 publishes from an observation only. The observation stays private.
  source_observation_id uuid not null references public.observations (id) on delete restrict,
  observed_at timestamptz not null,
  published_at timestamptz not null default now(),
  -- Set by the browser once per publication attempt. A repeated submission returns the same Update.
  client_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (author_id, client_key)
);

create index updates_published_idx on public.updates (published_at desc, id desc) where deleted_at is null;
create index updates_seedling_idx on public.updates (seedling_id, observed_at, published_at) where deleted_at is null;
create index updates_author_idx on public.updates (author_id) where deleted_at is null;

create table public.update_media (
  update_id uuid not null references public.updates (id) on delete restrict,
  derivative_id uuid not null references public.public_derivatives (id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (update_id, derivative_id)
);

create index update_media_derivative_idx on public.update_media (derivative_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.updates (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  parent_comment_id uuid references public.comments (id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index comments_update_created_idx on public.comments (update_id, created_at, id);

create table public.likes (
  update_id uuid not null references public.updates (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (update_id, user_id)
);

create table public.seedling_follows (
  user_id uuid not null references public.profiles (id) on delete restrict,
  seedling_id uuid not null references public.seedlings (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, seedling_id)
);

create index seedling_follows_seedling_idx on public.seedling_follows (seedling_id);

create table public.grower_follows (
  follower_id uuid not null references public.profiles (id) on delete restrict,
  followed_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_profile_id),
  constraint grower_follows_not_self check (follower_id <> followed_profile_id)
);

create index grower_follows_followed_idx on public.grower_follows (followed_profile_id);

-- Private bookmark. Only the saver can read it, and no count is published.
create table public.saved_seedlings (
  user_id uuid not null references public.profiles (id) on delete restrict,
  seedling_id uuid not null references public.seedlings (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, seedling_id)
);

-- The seedling's chosen cover. It must be a live public derivative of that seedling, or the default
-- (the most recently shared image) applies. See seedling_cover().
alter table public.seedlings
  add column cover_derivative_id uuid references public.public_derivatives (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Triggers: identity and lifecycle invariants hold for every role
-- ---------------------------------------------------------------------------

create trigger updates_set_updated_at
  before update on public.updates
  for each row execute function public.set_updated_at();

create function public.protect_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'updates are soft-deleted, never removed' using errcode = '42501';
  end if;
  if new.seedling_id is distinct from old.seedling_id
     or new.author_id is distinct from old.author_id
     or new.source_observation_id is distinct from old.source_observation_id
     or new.observed_at is distinct from old.observed_at
     or new.published_at is distinct from old.published_at
     or new.client_key is distinct from old.client_key then
    raise exception 'an update''s seedling, author, source and publication time are fixed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger updates_protect
  before update or delete on public.updates
  for each row execute function public.protect_update();

create function public.protect_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'comments are soft-deleted, never removed' using errcode = '42501';
  end if;
  if new.update_id is distinct from old.update_id
     or new.author_id is distinct from old.author_id
     or new.parent_comment_id is distinct from old.parent_comment_id
     or new.created_at is distinct from old.created_at then
    raise exception 'a comment''s update, author, parent and creation time are fixed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger comments_protect
  before update or delete on public.comments
  for each row execute function public.protect_comment();

-- A reply belongs to the same Update as its parent. The database refuses a cross-Update reply even if
-- a caller bypasses add_comment.
create function public.comment_parent_in_same_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_comment_id is not null and not exists (
    select 1 from public.comments parent
     where parent.id = new.parent_comment_id and parent.update_id = new.update_id
  ) then
    raise exception 'a reply must belong to the same update as its parent' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger comments_parent_same_update
  before insert on public.comments
  for each row execute function public.comment_parent_in_same_update();

create function public.protect_derivative()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'public derivatives are retired, never removed' using errcode = '42501';
  end if;
  if new.source_media_id is distinct from old.source_media_id
     or new.owner_id is distinct from old.owner_id
     or new.storage_path is distinct from old.storage_path then
    raise exception 'a public derivative''s source, owner and path are fixed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger public_derivatives_protect
  before update or delete on public.public_derivatives
  for each row execute function public.protect_derivative();

create function public.update_media_links_are_fixed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'an update''s media links are created once and never changed' using errcode = '42501';
end;
$$;

create trigger update_media_fixed
  before update or delete on public.update_media
  for each row execute function public.update_media_links_are_fixed();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.public_derivatives enable row level security;
alter table public.updates enable row level security;
alter table public.update_media enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.seedling_follows enable row level security;
alter table public.grower_follows enable row level security;
alter table public.saved_seedlings enable row level security;

-- ---------------------------------------------------------------------------
-- Visibility helpers
-- ---------------------------------------------------------------------------

-- An Update is public when it is live, its seedling is public and live, and neither the current
-- holder nor the author is suspended. Suspension therefore hides a grower's public content without
-- destroying it. The check runs as the definer so RLS on the joined tables cannot change the answer.
create function public._update_is_public(p_update_id uuid)
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
       and s.deleted_at is null
       and s.visibility = 'public'
       and not holder.is_suspended
       and not author.is_suspended
  );
$$;

-- A derivative is public while at least one public Update references it.
create function public._derivative_is_public(p_derivative_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.public_derivatives d
      join public.update_media um on um.derivative_id = d.id
     where d.id = p_derivative_id
       and d.deleted_at is null
       and public._update_is_public(um.update_id)
  );
$$;

-- A public-media object is unregistered when no derivative row names it. It is the uploader's own
-- file, such as a derivative from an interrupted publication. Only that uploader is told so: for anyone
-- else, and for visitors, the answer is always false.
create function public._public_media_object_unregistered(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and (storage.foldername(p_name))[1] = (select auth.uid())::text
     and not exists (select 1 from public.public_derivatives d where d.storage_path = p_name);
$$;

-- Whether a public-media object is a live public derivative, by its storage name.
create function public._public_media_object_is_public(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.public_derivatives d
     where d.storage_path = p_name and public._derivative_is_public(d.id)
  );
$$;

revoke all on function public._update_is_public(uuid) from public, anon;
revoke all on function public._derivative_is_public(uuid) from public, anon;
revoke all on function public._public_media_object_unregistered(text) from public, anon;
revoke all on function public._public_media_object_is_public(text) from public, anon;
grant execute on function public._update_is_public(uuid) to anon, authenticated;
grant execute on function public._derivative_is_public(uuid) to anon, authenticated;
grant execute on function public._public_media_object_unregistered(text) to anon, authenticated;
grant execute on function public._public_media_object_is_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies and column grants
-- ---------------------------------------------------------------------------

-- Public derivatives are readable through the helper only. The source and owner are never granted.
grant select (id, storage_path, width, height, created_at) on table public.public_derivatives
  to anon, authenticated;
create policy public_derivatives_select_public on public.public_derivatives for select
  to anon, authenticated
  using (public._derivative_is_public(id));

-- The source observation is private, so it is never granted to readers.
grant select (id, seedling_id, author_id, caption, observed_at, published_at, created_at)
  on table public.updates to anon, authenticated;
create policy updates_select_public on public.updates for select
  to anon, authenticated
  using (public._update_is_public(id));

grant select (update_id, derivative_id, sort_order) on table public.update_media to anon, authenticated;
create policy update_media_select_public on public.update_media for select
  to anon, authenticated
  using (public._update_is_public(update_id));

-- Comment bodies are read through list_update_comments, which hides the body of a removed comment, so
-- the table grant leaves the body out. Comments by a suspended grower are hidden here too.
grant select (id, update_id, author_id, parent_comment_id, created_at, edited_at, deleted_at)
  on table public.comments to anon, authenticated;
create policy comments_select_public on public.comments for select
  to anon, authenticated
  using (
    public._update_is_public(update_id)
    and exists (select 1 from public.profiles p where p.id = comments.author_id and not p.is_suspended)
  );

-- Likes are read as counts through get_public_update and the Feed. A reader sees only their own likes,
-- so nobody can list who liked an Update.
grant select (update_id, user_id, created_at) on table public.likes to authenticated;
create policy likes_select_own on public.likes for select
  to authenticated
  using (user_id = (select auth.uid()));
create policy seedling_follows_select_own on public.seedling_follows for select to authenticated
  using (user_id = (select auth.uid()));
create policy grower_follows_select_own on public.grower_follows for select to authenticated
  using (follower_id = (select auth.uid()));
create policy saved_seedlings_select_own on public.saved_seedlings for select to authenticated
  using (user_id = (select auth.uid()));

grant select on table public.seedling_follows to authenticated;
grant select on table public.grower_follows to authenticated;
grant select on table public.saved_seedlings to authenticated;

-- No table grants for writes. Every write goes through a domain function below.

-- ---------------------------------------------------------------------------
-- Storage: the public-media bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- Uploads are the owner's own, into their folder, and only while they may participate.
create policy public_media_insert_own on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.caller_can_participate()
  );

-- A derivative is readable by anyone, and only while it is public. Unregistered files are readable
-- by their owner, so an interrupted publication can be seen and removed.
create policy public_media_select on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'public-media'
    and (
      public._public_media_object_is_public(name)
      or public._public_media_object_unregistered(name)
    )
  );

create policy public_media_delete_unregistered on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.caller_can_participate()
    and public._public_media_object_unregistered(name)
  );

-- ---------------------------------------------------------------------------
-- Domain functions: the only write paths
-- ---------------------------------------------------------------------------

-- Publishes selected images of one observation as one Update. The caller must be the observation's
-- author and the seedling's current holder. The seedling must already be public. Each selected image
-- must belong to this observation, be an image, and have a derivative the caller uploaded.
-- Returns created = false when the same client_key was already published, and then nothing is added.
create function public.publish_update(
  p_observation_id uuid,
  p_client_key uuid,
  p_items jsonb,
  p_caption text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_obs public.observations%rowtype;
  v_seedling public.seedlings%rowtype;
  v_update_id uuid;
  v_item jsonb;
  v_media public.media%rowtype;
  v_derivative_id uuid;
  v_order integer := 0;
  v_caption text := nullif(btrim(p_caption), '');
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;

  select * into v_obs from public.observations where id = p_observation_id and deleted_at is null;
  if not found or v_obs.author_id <> v_uid then
    raise exception 'observation not found' using errcode = 'P0002';
  end if;

  select * into v_seedling from public.seedlings where id = v_obs.seedling_id and deleted_at is null;
  if not found or v_seedling.current_holder_id <> v_uid then
    raise exception 'only the current holder can publish' using errcode = '42501';
  end if;
  if v_seedling.visibility <> 'public' then
    raise exception 'the seedling must be public before it can be shared' using errcode = '23514';
  end if;

  if v_caption is not null and char_length(v_caption) > 2000 then
    raise exception 'a caption can be at most 2000 characters' using errcode = '22001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 6 then
    raise exception 'choose between one and six images' using errcode = '22023';
  end if;

  -- A repeated publication with the same client key is a no-op, decided by the unique constraint.
  insert into public.updates (seedling_id, author_id, caption, source_observation_id, observed_at, client_key)
  values (v_seedling.id, v_uid, v_caption, v_obs.id, v_obs.observed_at, p_client_key)
  on conflict (author_id, client_key) do nothing
  returning id into v_update_id;

  if v_update_id is null then
    select id into v_update_id from public.updates where author_id = v_uid and client_key = p_client_key;
    return jsonb_build_object('id', v_update_id, 'created', false);
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select m.* into v_media
      from public.media m
      join public.observation_media om on om.media_id = m.id
     where m.id = (v_item ->> 'media_id')::uuid
       and om.observation_id = v_obs.id
       and m.owner_id = v_uid
       and m.deleted_at is null;
    if not found then
      raise exception 'a selected item is not part of this observation' using errcode = 'P0002';
    end if;
    if v_media.kind <> 'image' then
      raise exception 'public video sharing is not available yet' using errcode = '0A000';
    end if;

    if not exists (
      select 1 from storage.objects o
       where o.bucket_id = 'public-media'
         and o.name = v_item ->> 'derivative_path'
         and o.owner = v_uid
         and (storage.foldername(o.name))[1] = v_uid::text
    ) then
      raise exception 'the prepared image is missing' using errcode = 'P0002';
    end if;

    insert into public.public_derivatives (source_media_id, owner_id, storage_path, byte_size, width, height)
    values (
      v_media.id,
      v_uid,
      v_item ->> 'derivative_path',
      (v_item ->> 'byte_size')::bigint,
      (v_item ->> 'width')::integer,
      (v_item ->> 'height')::integer
    )
    returning id into v_derivative_id;

    insert into public.update_media (update_id, derivative_id, sort_order)
    values (v_update_id, v_derivative_id, v_order);
    v_order := v_order + 1;
  end loop;

  return jsonb_build_object('id', v_update_id, 'created', true);
end;
$$;

-- Removes an Update from every public surface. Its derivatives are retired only when no other live
-- Update references them. The private observation and originals are not touched.
create function public.delete_update(p_update_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;

  update public.updates set deleted_at = now()
   where id = p_update_id and author_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'update not found' using errcode = 'P0002';
  end if;

  update public.seedlings s set cover_derivative_id = null
    from public.update_media um
   where um.update_id = p_update_id and um.derivative_id = s.cover_derivative_id;

  update public.public_derivatives d set deleted_at = now()
   where d.deleted_at is null
     and d.id in (select um.derivative_id from public.update_media um where um.update_id = p_update_id)
     and not exists (
       select 1 from public.update_media um2
         join public.updates u2 on u2.id = um2.update_id
        where um2.derivative_id = d.id and u2.deleted_at is null
     );
end;
$$;

-- The seedling's current holder chooses the public cover. Null restores the default.
create function public.set_seedling_cover(p_seedling_id uuid, p_derivative_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.seedlings s
     where s.id = p_seedling_id and s.current_holder_id = v_uid and s.deleted_at is null
  ) then
    raise exception 'seedling not found' using errcode = 'P0002';
  end if;

  if p_derivative_id is not null and not exists (
    select 1
      from public.update_media um
      join public.updates u on u.id = um.update_id
     where um.derivative_id = p_derivative_id
       and u.seedling_id = p_seedling_id
       and public._derivative_is_public(p_derivative_id)
  ) then
    raise exception 'the cover must be a public image of this seedling' using errcode = '23514';
  end if;

  update public.seedlings set cover_derivative_id = p_derivative_id where id = p_seedling_id;
end;
$$;

-- The seedling's public cover: the chosen one while it is still public, otherwise the most recently
-- shared public image. Video never appears here, because only images are published.
create function public.seedling_cover(p_seedling_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.cover_derivative_id
       from public.seedlings s
      where s.id = p_seedling_id
        and s.cover_derivative_id is not null
        and public._derivative_is_public(s.cover_derivative_id)),
    (select d.id
       from public.updates u
       join public.update_media um on um.update_id = u.id
       join public.public_derivatives d on d.id = um.derivative_id
      where u.seedling_id = p_seedling_id
        and d.deleted_at is null
        and public._update_is_public(u.id)
      order by u.published_at desc, u.id desc, um.sort_order
      limit 1)
  );
$$;

revoke all on function public.seedling_cover(uuid) from public, anon;
grant execute on function public.seedling_cover(uuid) to anon, authenticated;

-- The public Feed: live public Updates, newest first. The cursor is (published_at, id), so equal
-- timestamps still give a single, stable order. Following restricts the result to followed seedlings
-- and followed growers.
create function public.list_public_updates(
  p_limit integer,
  p_before_published timestamptz default null,
  p_before_id uuid default null,
  p_following_only boolean default false
)
returns table (
  update_id uuid,
  seedling_id uuid,
  seedling_name text,
  author_id uuid,
  author_name text,
  author_has_avatar boolean,
  caption text,
  observed_at timestamptz,
  published_at timestamptz,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean,
  media jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  return query
  select u.id,
         s.id,
         s.working_name,
         p.id,
         p.display_name,
         p.avatar_path is not null,
         u.caption,
         u.observed_at,
         u.published_at,
         (select count(*) from public.likes l where l.update_id = u.id),
         (select count(*) from public.comments c where c.update_id = u.id and c.deleted_at is null),
         exists (select 1 from public.likes l where l.update_id = u.id and l.user_id = v_uid),
         (select jsonb_agg(jsonb_build_object(
                   'id', d.id, 'path', d.storage_path, 'width', d.width, 'height', d.height)
                 order by um.sort_order, d.id)
            from public.update_media um
            join public.public_derivatives d on d.id = um.derivative_id
           where um.update_id = u.id and d.deleted_at is null)
    from public.updates u
    join public.seedlings s on s.id = u.seedling_id
    join public.profiles p on p.id = u.author_id
   where public._update_is_public(u.id)
     and (p_before_published is null or (u.published_at, u.id) < (p_before_published, p_before_id))
     and (
       not p_following_only
       or (v_uid is not null and (
         exists (select 1 from public.seedling_follows f where f.user_id = v_uid and f.seedling_id = u.seedling_id)
         or exists (select 1 from public.grower_follows g where g.follower_id = v_uid and g.followed_profile_id = u.author_id)
       ))
     )
   order by u.published_at desc, u.id desc
   limit p_limit;
end;
$$;

-- The public journey of one seedling, in the order the observations were made.
create function public.list_seedling_updates(p_seedling_id uuid)
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
    join public.profiles p on p.id = u.author_id
   where u.seedling_id = p_seedling_id
     and public._update_is_public(u.id)
   order by u.observed_at, u.published_at, u.id;
$$;

-- One Update, if it is public.
create function public.get_public_update(p_update_id uuid)
returns table (
  update_id uuid,
  seedling_id uuid,
  seedling_name text,
  author_id uuid,
  author_name text,
  author_has_avatar boolean,
  caption text,
  observed_at timestamptz,
  published_at timestamptz,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean,
  media jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  return query
  select u.id, s.id, s.working_name, p.id, p.display_name, p.avatar_path is not null,
         u.caption, u.observed_at, u.published_at,
         (select count(*) from public.likes l where l.update_id = u.id),
         (select count(*) from public.comments c where c.update_id = u.id and c.deleted_at is null),
         exists (select 1 from public.likes l where l.update_id = u.id and l.user_id = v_uid),
         (select jsonb_agg(jsonb_build_object(
                   'id', d.id, 'path', d.storage_path, 'width', d.width, 'height', d.height)
                 order by um.sort_order, d.id)
            from public.update_media um
            join public.public_derivatives d on d.id = um.derivative_id
           where um.update_id = u.id and d.deleted_at is null)
    from public.updates u
    join public.seedlings s on s.id = u.seedling_id
    join public.profiles p on p.id = u.author_id
   where u.id = p_update_id and public._update_is_public(u.id);
end;
$$;

-- Comments on a public Update. A removed comment keeps its place in the thread, without its text.
-- Comments by suspended growers are not shown, consistent with suspension.
create function public.list_update_comments(p_update_id uuid)
returns table (
  comment_id uuid,
  parent_comment_id uuid,
  author_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  is_removed boolean,
  is_mine boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public._update_is_public(p_update_id) then
    return;
  end if;
  return query
  select c.id,
         c.parent_comment_id,
         p.id,
         p.display_name,
         case when c.deleted_at is null then c.body end,
         c.created_at,
         c.edited_at,
         c.deleted_at is not null,
         c.author_id = v_uid
    from public.comments c
    join public.profiles p on p.id = c.author_id
   where c.update_id = p_update_id
     and not p.is_suspended
   order by c.created_at, c.id;
end;
$$;

create function public.add_comment(p_update_id uuid, p_body text, p_parent_comment_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;
  if not public._update_is_public(p_update_id) then
    raise exception 'update not found' using errcode = 'P0002';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'a comment must be between 1 and 2000 characters' using errcode = '22001';
  end if;

  insert into public.comments (update_id, author_id, parent_comment_id, body)
  values (p_update_id, v_uid, p_parent_comment_id, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.edit_comment(p_comment_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_update uuid;
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'a comment must be between 1 and 2000 characters' using errcode = '22001';
  end if;

  update public.comments set body = v_body, edited_at = now()
   where id = p_comment_id and author_id = v_uid and deleted_at is null
   returning update_id into v_update;
  if not found or not public._update_is_public(v_update) then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;
  update public.comments set deleted_at = now()
   where id = p_comment_id and author_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Likes are idempotent: liking twice keeps one row, and unliking an unliked Update changes nothing.
create function public.set_like(p_update_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;
  if not public._update_is_public(p_update_id) then
    raise exception 'update not found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.likes (update_id, user_id) values (p_update_id, v_uid)
    on conflict (update_id, user_id) do nothing;
  else
    delete from public.likes where update_id = p_update_id and user_id = v_uid;
  end if;
end;
$$;

-- Follows a seedling by its uuid, so the follow survives a change of holder.
create function public.set_seedling_follow(p_seedling_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.seedlings s
      join public.profiles h on h.id = s.current_holder_id
     where s.id = p_seedling_id and s.deleted_at is null and s.visibility = 'public' and not h.is_suspended
  ) then
    raise exception 'seedling not found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.seedling_follows (user_id, seedling_id) values (v_uid, p_seedling_id)
    on conflict (user_id, seedling_id) do nothing;
  else
    delete from public.seedling_follows where user_id = v_uid and seedling_id = p_seedling_id;
  end if;
end;
$$;

create function public.set_grower_follow(p_profile_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;
  if p_profile_id = v_uid then
    raise exception 'you cannot follow yourself' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_profile_id and not p.is_suspended) then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.grower_follows (follower_id, followed_profile_id) values (v_uid, p_profile_id)
    on conflict (follower_id, followed_profile_id) do nothing;
  else
    delete from public.grower_follows where follower_id = v_uid and followed_profile_id = p_profile_id;
  end if;
end;
$$;

-- Saving is private. A grower can save a seedling they can read, and nobody else learns of it.
create function public.set_seedling_save(p_seedling_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.caller_can_participate() then
    raise exception 'participation is not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.seedlings s
      join public.profiles h on h.id = s.current_holder_id
     where s.id = p_seedling_id and s.deleted_at is null
       and (s.current_holder_id = v_uid or (s.visibility = 'public' and not h.is_suspended))
  ) then
    raise exception 'seedling not found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.saved_seedlings (user_id, seedling_id) values (v_uid, p_seedling_id)
    on conflict (user_id, seedling_id) do nothing;
  else
    delete from public.saved_seedlings where user_id = v_uid and seedling_id = p_seedling_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: the write paths are callable by signed-in growers and by no one else
-- ---------------------------------------------------------------------------

revoke all on function public.publish_update(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.delete_update(uuid) from public, anon;
revoke all on function public.set_seedling_cover(uuid, uuid) from public, anon;
revoke all on function public.add_comment(uuid, text, uuid) from public, anon;
revoke all on function public.edit_comment(uuid, text) from public, anon;
revoke all on function public.delete_comment(uuid) from public, anon;
revoke all on function public.set_like(uuid, boolean) from public, anon;
revoke all on function public.set_seedling_follow(uuid, boolean) from public, anon;
revoke all on function public.set_grower_follow(uuid, boolean) from public, anon;
revoke all on function public.set_seedling_save(uuid, boolean) from public, anon;
grant execute on function public.publish_update(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.delete_update(uuid) to authenticated;
grant execute on function public.set_seedling_cover(uuid, uuid) to authenticated;
grant execute on function public.add_comment(uuid, text, uuid) to authenticated;
grant execute on function public.edit_comment(uuid, text) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;
grant execute on function public.set_like(uuid, boolean) to authenticated;
grant execute on function public.set_seedling_follow(uuid, boolean) to authenticated;
grant execute on function public.set_grower_follow(uuid, boolean) to authenticated;
grant execute on function public.set_seedling_save(uuid, boolean) to authenticated;

revoke all on function public.list_public_updates(integer, timestamptz, uuid, boolean) from public;
revoke all on function public.list_seedling_updates(uuid) from public;
revoke all on function public.get_public_update(uuid) from public;
revoke all on function public.list_update_comments(uuid) from public;
grant execute on function public.list_public_updates(integer, timestamptz, uuid, boolean) to anon, authenticated;
grant execute on function public.list_seedling_updates(uuid) to anon, authenticated;
grant execute on function public.get_public_update(uuid) to anon, authenticated;
grant execute on function public.list_update_comments(uuid) to anon, authenticated;

