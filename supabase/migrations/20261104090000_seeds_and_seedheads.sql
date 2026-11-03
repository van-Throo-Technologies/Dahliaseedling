-- Phase 7: Seeds and seedheads. Seed material is offspring potential, never a Seedling. A seed source records what is
-- known about the maternal plant. A seed offer makes packets or seedheads available. Neither transfers a Seedling, its
-- holder, its originator or its UUID. Germination creates a new Seedling, and nothing here does that.

-- 1. Unidentified dahlia sources. One exact physical plant whose cultivar is not known. This is an internal record with
-- its own identity. It is never a Cultivar Reference and never a Seedling.
create table public.unidentified_sources (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  description text check (description is null or char_length(btrim(description)) between 1 and 280),
  created_at timestamptz not null default now()
);

-- The private originals of the source plant's photographs. They stay with their uploader.
create table public.unidentified_source_photos (
  source_id uuid not null references public.unidentified_sources (id) on delete restrict,
  media_id uuid not null references public.media (id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (source_id, media_id)
);

-- 2. Seed sources. Exactly one maternal reference: a Seedling, a named cultivar, an unidentified dahlia, or unknown/mixed.
create table public.seed_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  source_seedling_id uuid references public.seedlings (id) on delete restrict,
  source_cultivar_id uuid references public.cultivar_references (id) on delete restrict,
  source_unidentified_id uuid references public.unidentified_sources (id) on delete restrict,
  source_unknown_mixed boolean not null default false,
  -- The photograph of the actual parent plant, required for a named cultivar before an offer can be published.
  actual_parent_media_id uuid references public.media (id) on delete restrict,
  collection_year smallint check (collection_year is null or collection_year between 1900 and 2100),
  notes text check (notes is null or char_length(btrim(notes)) between 1 and 280),
  created_at timestamptz not null default now(),
  constraint seed_source_exactly_one_reference check (
    (source_seedling_id is not null)::integer
    + (source_cultivar_id is not null)::integer
    + (source_unidentified_id is not null)::integer
    + source_unknown_mixed::integer = 1
  ),
  constraint seed_source_parent_photo_only_for_cultivar check (
    actual_parent_media_id is null or source_cultivar_id is not null
  )
);

-- 3. Seed offers. Packets or seedheads, each with a quantity that makes sense for its material. Closing is a state
-- change; the source and its history stay.
create table public.seed_offers (
  id uuid primary key default gen_random_uuid(),
  seed_source_id uuid not null references public.seed_sources (id) on delete restrict,
  seller_id uuid not null references public.profiles (id) on delete restrict,
  material_type text not null check (material_type in ('loose_seeds', 'seedheads')),
  packet_size integer check (packet_size is null or packet_size > 0),
  seedhead_count integer check (seedhead_count is null or seedhead_count > 0),
  mode text not null check (mode in ('free', 'for_sale', 'trade')),
  price_text text check (price_text is null or char_length(btrim(price_text)) between 1 and 80),
  handover_method text not null check (handover_method in ('pickup', 'shipping', 'both')),
  note text check (note is null or char_length(btrim(note)) between 1 and 280),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint seed_offer_quantity_matches_material check (
    (material_type = 'loose_seeds' and packet_size is not null and seedhead_count is null)
    or (material_type = 'seedheads' and seedhead_count is not null and packet_size is null)
  ),
  constraint seed_offer_price_only_for_sale check (price_text is null or mode = 'for_sale'),
  constraint seed_offer_lifecycle check (is_active = (closed_at is null))
);

create index seed_offers_source_idx on public.seed_offers (seed_source_id);
create index seed_offers_seller_idx on public.seed_offers (seller_id);
create index seed_offers_active_idx on public.seed_offers (created_at desc) where is_active;

-- Images shown with an offer are public derivatives only. An original never appears here.
create table public.seed_offer_media (
  offer_id uuid not null references public.seed_offers (id) on delete restrict,
  derivative_id uuid not null references public.public_derivatives (id) on delete restrict,
  role text not null check (role in ('source_photo', 'parent_image')),
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (offer_id, derivative_id)
);

create index seed_offer_media_derivative_idx on public.seed_offer_media (derivative_id);

-- 4. Interest. Structured only: who wants which offer, and how much. A conversation is a later phase.
create table public.seed_offer_interests (
  id uuid primary key default gen_random_uuid(),
  seed_offer_id uuid not null references public.seed_offers (id) on delete restrict,
  interested_user_id uuid not null references public.profiles (id) on delete restrict,
  requested_quantity text check (requested_quantity is null or char_length(btrim(requested_quantity)) between 1 and 80),
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create unique index seed_offer_interests_one_active
  on public.seed_offer_interests (seed_offer_id, interested_user_id) where withdrawn_at is null;

-- 5. Seedling parentage can name the unidentified dahlia. Existing rows keep their meaning: the new column is null for them.
alter table public.seedling_parentage
  add column parent_unidentified_source_id uuid references public.unidentified_sources (id) on delete restrict;

alter table public.seedling_parentage drop constraint parentage_exactly_one_reference;
alter table public.seedling_parentage add constraint parentage_exactly_one_reference check (
  (parent_seedling_id is not null)::integer
  + (parent_cultivar_id is not null)::integer
  + is_unknown::integer
  + (parent_unidentified_source_id is not null)::integer = 1
);

-- 6. Visibility helpers. A live offer is public when it is active, its seller is not suspended, and a seedling source is
-- itself public. Source records are readable only through a live public offer, or by their owner.
create function public._seed_offer_is_public(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.seed_offers o
      join public.seed_sources s on s.id = o.seed_source_id
      join public.profiles seller on seller.id = o.seller_id
     where o.id = p_offer_id
       and o.is_active
       and not seller.is_suspended
       and (
         s.source_seedling_id is null
         or exists (
           select 1
             from public.seedlings p
             join public.profiles h on h.id = p.current_holder_id
            where p.id = s.source_seedling_id
              and p.visibility = 'public'
              and p.deleted_at is null
              and not h.is_suspended
         )
       )
  );
$$;

create function public._seed_source_is_public(p_source_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.seed_offers o
     where o.seed_source_id = p_source_id
       and public._seed_offer_is_public(o.id)
  );
$$;

create function public._unidentified_source_is_public(p_source_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.seed_sources s
     where s.source_unidentified_id = p_source_id
       and public._seed_source_is_public(s.id)
  );
$$;

-- A public derivative is also readable while a live public offer shows it. This extends the Phase 4 rule without
-- changing what it protects: the original is still never public.
create or replace function public._derivative_is_public(p_derivative_id uuid)
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
  )
  or exists (
    select 1
      from public.public_derivatives d
      join public.seed_offer_media m on m.derivative_id = d.id
     where d.id = p_derivative_id
       and d.deleted_at is null
       and public._seed_offer_is_public(m.offer_id)
  );
$$;

revoke all on function public._seed_offer_is_public(uuid) from public;
revoke all on function public._seed_source_is_public(uuid) from public;
revoke all on function public._unidentified_source_is_public(uuid) from public;
revoke all on function public._derivative_is_public(uuid) from public;
grant execute on function public._seed_offer_is_public(uuid) to anon, authenticated;
grant execute on function public._seed_source_is_public(uuid) to anon, authenticated;
grant execute on function public._unidentified_source_is_public(uuid) to anon, authenticated;
grant execute on function public._derivative_is_public(uuid) to anon, authenticated;

-- 7. Row-level security. Clients never write these tables directly. Each table exposes only the columns the public or
-- the party needs. Owner identity and the private parent image are never granted to anon.
alter table public.unidentified_sources enable row level security;
alter table public.unidentified_source_photos enable row level security;
alter table public.seed_sources enable row level security;
alter table public.seed_offers enable row level security;
alter table public.seed_offer_media enable row level security;
alter table public.seed_offer_interests enable row level security;

revoke all on table public.unidentified_sources from anon, authenticated;
revoke all on table public.unidentified_source_photos from anon, authenticated;
revoke all on table public.seed_sources from anon, authenticated;
revoke all on table public.seed_offers from anon, authenticated;
revoke all on table public.seed_offer_media from anon, authenticated;
revoke all on table public.seed_offer_interests from anon, authenticated;

create policy unidentified_sources_select on public.unidentified_sources for select
  to anon, authenticated
  using (created_by = (select auth.uid()) or public._unidentified_source_is_public(id));
grant select (id, description, created_at) on table public.unidentified_sources to anon, authenticated;

-- The creator is checked by a definer helper: the creator column is not granted to clients, and a policy's subquery
-- runs with the client's own column privileges.
create function public._unidentified_source_is_owned(p_source_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.unidentified_sources u
     where u.id = p_source_id and u.created_by = (select auth.uid())
  );
$$;
revoke all on function public._unidentified_source_is_owned(uuid) from public, anon;
grant execute on function public._unidentified_source_is_owned(uuid) to authenticated;

create policy unidentified_source_photos_select_owner on public.unidentified_source_photos for select
  to authenticated
  using (public._unidentified_source_is_owned(source_id));
grant select (source_id, media_id, sort_order) on table public.unidentified_source_photos to authenticated;

create policy seed_sources_select on public.seed_sources for select
  to anon, authenticated
  using (owner_id = (select auth.uid()) or public._seed_source_is_public(id));
grant select (id, source_seedling_id, source_cultivar_id, source_unidentified_id, source_unknown_mixed,
              collection_year, notes, created_at)
  on table public.seed_sources to anon, authenticated;

create policy seed_offers_select on public.seed_offers for select
  to anon, authenticated
  using (seller_id = (select auth.uid()) or public._seed_offer_is_public(id));
grant select (id, seed_source_id, seller_id, material_type, packet_size, seedhead_count, mode, price_text,
              handover_method, note, is_active, created_at, closed_at)
  on table public.seed_offers to anon, authenticated;

create policy seed_offer_media_select on public.seed_offer_media for select
  to anon, authenticated
  using (exists (
    select 1 from public.seed_offers o
     where o.id = seed_offer_media.offer_id
       and (o.seller_id = (select auth.uid()) or public._seed_offer_is_public(o.id))
  ));
grant select (offer_id, derivative_id, role, sort_order) on table public.seed_offer_media to anon, authenticated;

create policy seed_offer_interests_select on public.seed_offer_interests for select
  to authenticated
  using (
    interested_user_id = (select auth.uid())
    or exists (
      select 1 from public.seed_offers o
       where o.id = seed_offer_interests.seed_offer_id and o.seller_id = (select auth.uid())
    )
  );
grant select (id, seed_offer_id, interested_user_id, requested_quantity, created_at, withdrawn_at)
  on table public.seed_offer_interests to authenticated;

-- 8. Functions: the only write path. Each checks the caller, participation, ownership and the state it needs.
create function public.create_unidentified_source(p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot create seed sources' using errcode = '42501';
  end if;
  if v_description is not null and char_length(v_description) > 280 then
    raise exception 'descriptions are 280 characters or fewer' using errcode = '23514';
  end if;
  insert into public.unidentified_sources (created_by, description)
  values (v_uid, v_description)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.register_source_photo(p_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_media uuid;
  v_kind public.media_kind;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot add seed photos' using errcode = '42501';
  end if;
  v_media := public._register_media_object(p_path);
  select kind into v_kind from public.media where id = v_media;
  if v_kind <> 'image' then
    raise exception 'a source photograph must be an image' using errcode = '23514';
  end if;
  return v_media;
end;
$$;

create function public.add_unidentified_source_photo(p_source_id uuid, p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change seed sources' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.unidentified_sources u where u.id = p_source_id and u.created_by = v_uid
  ) then
    raise exception 'that source could not be found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.media m
     where m.id = p_media_id and m.owner_id = v_uid and m.kind = 'image' and m.deleted_at is null
  ) then
    raise exception 'that photograph could not be found' using errcode = 'P0002';
  end if;
  select count(*) into v_count from public.unidentified_source_photos where source_id = p_source_id;
  if v_count >= 4 then
    raise exception 'use up to four photographs of the source plant' using errcode = '23514';
  end if;
  insert into public.unidentified_source_photos (source_id, media_id, sort_order)
  values (p_source_id, p_media_id, v_count)
  on conflict (source_id, media_id) do nothing;
end;
$$;

create function public.create_seed_source(
  p_kind text,
  p_seedling_id uuid default null,
  p_cultivar_name text default null,
  p_unidentified_source_id uuid default null,
  p_collection_year smallint default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := regexp_replace(btrim(coalesce(p_cultivar_name, '')), '\s+', ' ', 'g');
  v_cultivar uuid;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot create seed sources' using errcode = '42501';
  end if;
  if p_kind not in ('seedling', 'cultivar', 'unidentified', 'unknown_mixed') then
    raise exception 'unsupported source kind' using errcode = '23514';
  end if;

  if p_kind = 'seedling' then
    -- Only the grower who currently holds the seedling may use it as a seed parent. Otherwise the answer is the same
    -- as for a seedling that does not exist.
    if not exists (
      select 1 from public.seedlings s
       where s.id = p_seedling_id and s.current_holder_id = v_uid and s.deleted_at is null
    ) then
      raise exception 'seedling not found' using errcode = 'P0002';
    end if;
    insert into public.seed_sources (owner_id, source_seedling_id, collection_year, notes)
    values (v_uid, p_seedling_id, p_collection_year, v_notes)
    returning id into v_id;

  elsif p_kind = 'cultivar' then
    if char_length(v_name) < 2 or char_length(v_name) > 80 then
      raise exception 'cultivar names are 2 to 80 characters' using errcode = '23514';
    end if;
    insert into public.cultivar_references (name, normalized_name, created_by)
    values (v_name, lower(v_name), v_uid)
    on conflict (normalized_name) do update set name = public.cultivar_references.name
    returning id into v_cultivar;
    insert into public.seed_sources (owner_id, source_cultivar_id, collection_year, notes)
    values (v_uid, v_cultivar, p_collection_year, v_notes)
    returning id into v_id;

  elsif p_kind = 'unidentified' then
    if not exists (
      select 1 from public.unidentified_sources u where u.id = p_unidentified_source_id and u.created_by = v_uid
    ) then
      raise exception 'that source could not be found' using errcode = 'P0002';
    end if;
    -- The source is usable only with at least one photograph of the actual plant.
    if not exists (
      select 1 from public.unidentified_source_photos where source_id = p_unidentified_source_id
    ) then
      raise exception 'a photograph of the actual source plant is required' using errcode = '23514';
    end if;
    insert into public.seed_sources (owner_id, source_unidentified_id, collection_year, notes)
    values (v_uid, p_unidentified_source_id, p_collection_year, v_notes)
    returning id into v_id;

  else
    insert into public.seed_sources (owner_id, source_unknown_mixed, collection_year, notes)
    values (v_uid, true, p_collection_year, v_notes)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Publishing checks the source's image rule against the photographs the caller submits. The photographs are made into
-- public derivatives first, by the server action, in the same way as Phase 4. This function records them in one
-- transaction with the offer. A failure leaves nothing referenced.
create function public.publish_seed_offer(
  p_source_id uuid,
  p_material_type text,
  p_packet_size integer default null,
  p_seedhead_count integer default null,
  p_mode text default 'free',
  p_price_text text default null,
  p_handover_method text default 'pickup',
  p_note text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  s public.seed_sources;
  v_offer uuid;
  v_price text := nullif(btrim(coalesce(p_price_text, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_item jsonb;
  v_media uuid;
  v_derivative uuid;
  v_photos integer;
  v_parent_derivative uuid;
  v_source_photo_items integer := 0;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot publish seed offers' using errcode = '42501';
  end if;

  -- Lock the source so a concurrent change to it cannot slip past the image rule.
  select * into s from public.seed_sources where id = p_source_id for update;
  if not found or s.owner_id <> v_uid then
    raise exception 'that source could not be found' using errcode = 'P0002';
  end if;

  if p_material_type not in ('loose_seeds', 'seedheads') then
    raise exception 'choose loose seeds or seedheads' using errcode = '23514';
  end if;
  if p_mode not in ('free', 'for_sale', 'trade') then
    raise exception 'choose free, for sale or trade' using errcode = '23514';
  end if;
  if p_handover_method not in ('pickup', 'shipping', 'both') then
    raise exception 'choose pickup, shipping or both' using errcode = '23514';
  end if;
  if v_price is not null and p_mode <> 'for_sale' then
    raise exception 'a price belongs to a sale' using errcode = '23514';
  end if;
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'notes are 280 characters or fewer' using errcode = '23514';
  end if;

  -- The image rule, by source kind.
  if s.source_seedling_id is not null then
    -- The seed parent must be a public seedling held by the caller, with a public image already on the record.
    if not exists (
      select 1 from public.seedlings p
        join public.profiles h on h.id = p.current_holder_id
       where p.id = s.source_seedling_id and p.current_holder_id = v_uid
         and p.visibility = 'public' and p.deleted_at is null and not h.is_suspended
    ) then
      raise exception 'the seed parent must be a public seedling you hold' using errcode = '42501';
    end if;
    select d.id into v_parent_derivative
      from public.public_derivatives d
      join public.update_media um on um.derivative_id = d.id
      join public.updates u on u.id = um.update_id
     where u.seedling_id = s.source_seedling_id
       and public._derivative_is_public(d.id)
     order by d.created_at desc, d.id
     limit 1;
    if v_parent_derivative is null then
      raise exception 'a public photograph of the seed parent is required' using errcode = '23514';
    end if;

  elsif s.source_cultivar_id is not null then
    if s.actual_parent_media_id is null then
      raise exception 'a photograph of the actual parent plant is required' using errcode = '23514';
    end if;

  elsif s.source_unidentified_id is not null then
    select count(*) into v_photos from public.unidentified_source_photos where source_id = s.source_unidentified_id;
    if v_photos = 0 then
      raise exception 'a photograph of the actual source plant is required' using errcode = '23514';
    end if;

  else
    if p_items is not null and jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
      raise exception 'an unknown or mixed source has no photograph to show' using errcode = '23514';
    end if;
  end if;

  if p_material_type = 'loose_seeds' and (p_packet_size is null or p_packet_size <= 0 or p_seedhead_count is not null) then
    raise exception 'a packet offer needs the number of seeds per packet' using errcode = '23514';
  end if;
  if p_material_type = 'seedheads' and (p_seedhead_count is null or p_seedhead_count <= 0 or p_packet_size is not null) then
    raise exception 'a seedhead offer needs the number of seedheads' using errcode = '23514';
  end if;

  insert into public.seed_offers (
    seed_source_id, seller_id, material_type, packet_size, seedhead_count, mode, price_text,
    handover_method, note
  )
  values (
    s.id, v_uid, p_material_type,
    case when p_material_type = 'loose_seeds' then p_packet_size end,
    case when p_material_type = 'seedheads' then p_seedhead_count end,
    p_mode,
    case when p_mode = 'for_sale' then v_price end,
    p_handover_method,
    v_note
  )
  returning id into v_offer;

  if v_parent_derivative is not null then
    insert into public.seed_offer_media (offer_id, derivative_id, role, sort_order)
    values (v_offer, v_parent_derivative, 'parent_image', 0);
  end if;

  -- The derivatives the server action made for the caller's submitted photographs.
  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_media := (v_item ->> 'media_id')::uuid;
      if not exists (
        select 1 from public.media m
         where m.id = v_media and m.owner_id = v_uid and m.kind = 'image' and m.deleted_at is null
      ) then
        raise exception 'that photograph could not be found' using errcode = 'P0002';
      end if;

      if v_item ->> 'role' = 'source_photo' then
        if s.source_unidentified_id is null or not exists (
          select 1 from public.unidentified_source_photos sp
           where sp.source_id = s.source_unidentified_id and sp.media_id = v_media
        ) then
          raise exception 'that photograph is not one of this source' using errcode = '23514';
        end if;
        v_source_photo_items := v_source_photo_items + 1;
      elsif v_item ->> 'role' = 'parent_image' then
        if s.actual_parent_media_id is distinct from v_media then
          raise exception 'that photograph is not the actual parent plant' using errcode = '23514';
        end if;
      else
        raise exception 'unsupported photograph role' using errcode = '23514';
      end if;

      insert into public.public_derivatives (source_media_id, owner_id, storage_path, byte_size, width, height)
      values (
        v_media, v_uid, v_item ->> 'derivative_path',
        (v_item ->> 'byte_size')::bigint, (v_item ->> 'width')::integer, (v_item ->> 'height')::integer
      )
      returning id into v_derivative;

      insert into public.seed_offer_media (offer_id, derivative_id, role, sort_order)
      values (v_offer, v_derivative, v_item ->> 'role', 0);
    end loop;
  end if;

  if s.source_unidentified_id is not null and v_source_photo_items = 0 then
    raise exception 'a photograph of the actual source plant is required' using errcode = '23514';
  end if;
  if s.source_cultivar_id is not null and not exists (
    select 1 from public.seed_offer_media m where m.offer_id = v_offer and m.role = 'parent_image'
  ) then
    -- The cultivar's photograph arrives as a submitted item, so it is recorded above; this proves it is present.
    raise exception 'a photograph of the actual parent plant is required' using errcode = '23514';
  end if;

  return v_offer;
end;
$$;

create function public.close_seed_offer(p_offer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  o public.seed_offers;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change seed offers' using errcode = '42501';
  end if;
  select * into o from public.seed_offers where id = p_offer_id for update;
  if not found or o.seller_id <> v_uid then
    raise exception 'that offer could not be found' using errcode = 'P0002';
  end if;
  if not o.is_active then
    return false;
  end if;
  update public.seed_offers set is_active = false, closed_at = now() where id = p_offer_id;
  return true;
end;
$$;

create function public.express_seed_offer_interest(p_offer_id uuid, p_requested_quantity text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  o public.seed_offers;
  v_quantity text := nullif(btrim(coalesce(p_requested_quantity, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot express interest' using errcode = '42501';
  end if;
  if v_quantity is not null and char_length(v_quantity) > 80 then
    raise exception 'quantities are 80 characters or fewer' using errcode = '23514';
  end if;
  -- Share-lock the offer, so a concurrent close is either before or after this interest, never in the middle.
  select * into o from public.seed_offers where id = p_offer_id for share;
  if not found or not public._seed_offer_is_public(p_offer_id) then
    raise exception 'that offer could not be found' using errcode = 'P0002';
  end if;
  if o.seller_id = v_uid then
    raise exception 'the seller cannot express interest in their own offer' using errcode = '23514';
  end if;
  insert into public.seed_offer_interests (seed_offer_id, interested_user_id, requested_quantity)
  values (p_offer_id, v_uid, v_quantity)
  on conflict (seed_offer_id, interested_user_id) where withdrawn_at is null do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.seed_offer_interests
     where seed_offer_id = p_offer_id and interested_user_id = v_uid and withdrawn_at is null;
  end if;
  return v_id;
end;
$$;

create function public.withdraw_seed_offer_interest(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change interest' using errcode = '42501';
  end if;
  update public.seed_offer_interests
     set withdrawn_at = now()
   where seed_offer_id = p_offer_id and interested_user_id = v_uid and withdrawn_at is null;
  if not found then
    raise exception 'there is no active interest to withdraw' using errcode = 'P0002';
  end if;
end;
$$;

-- Records the unidentified dahlia as a parent. The caller must be the current holder and the owner of the source. The
-- seedling stays its own identity; the parent is the known physical plant, never a fabricated name or identity.
create function public.set_seedling_parent_unidentified(
  p_seedling_id uuid,
  p_role public.parent_role,
  p_source_id uuid,
  p_notes text default null
)
returns public.seedling_parentage
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.seedling_parentage;
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
  if not exists (
    select 1 from public.seedlings where id = p_seedling_id and current_holder_id = v_uid and deleted_at is null
  ) then
    raise exception 'seedling not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.unidentified_sources u where u.id = p_source_id and u.created_by = v_uid
  ) then
    raise exception 'that source could not be found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.unidentified_source_photos where source_id = p_source_id
  ) then
    raise exception 'a photograph of the actual source plant is required' using errcode = '23514';
  end if;

  delete from public.seedling_parentage where child_seedling_id = p_seedling_id and role = p_role;
  insert into public.seedling_parentage (child_seedling_id, role, parent_unidentified_source_id, notes, created_by)
  values (p_seedling_id, p_role, p_source_id, nullif(btrim(coalesce(p_notes, '')), ''), v_uid)
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_unidentified_source(text) from public, anon;
revoke all on function public.register_source_photo(text) from public, anon;
revoke all on function public.add_unidentified_source_photo(uuid, uuid) from public, anon;
revoke all on function public.create_seed_source(text, uuid, text, uuid, smallint, text) from public, anon;
revoke all on function public.publish_seed_offer(uuid, text, integer, integer, text, text, text, text, jsonb) from public, anon;
revoke all on function public.close_seed_offer(uuid) from public, anon;
revoke all on function public.express_seed_offer_interest(uuid, text) from public, anon;
revoke all on function public.withdraw_seed_offer_interest(uuid) from public, anon;
revoke all on function public.set_seedling_parent_unidentified(uuid, public.parent_role, uuid, text) from public, anon;

grant execute on function public.create_unidentified_source(text) to authenticated;
grant execute on function public.register_source_photo(text) to authenticated;
grant execute on function public.add_unidentified_source_photo(uuid, uuid) to authenticated;
grant execute on function public.create_seed_source(text, uuid, text, uuid, smallint, text) to authenticated;
grant execute on function public.publish_seed_offer(uuid, text, integer, integer, text, text, text, text, jsonb) to authenticated;
grant execute on function public.close_seed_offer(uuid) to authenticated;
grant execute on function public.express_seed_offer_interest(uuid, text) to authenticated;
grant execute on function public.withdraw_seed_offer_interest(uuid) to authenticated;
grant execute on function public.set_seedling_parent_unidentified(uuid, public.parent_role, uuid, text) to authenticated;

-- Records the photograph of the actual parent plant for a named cultivar source. The caller owns the source and the
-- photograph. The photograph is private until a live offer shows its public derivative.
create function public.set_cultivar_parent_photo(p_source_id uuid, p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change seed sources' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.seed_sources s
     where s.id = p_source_id and s.owner_id = v_uid and s.source_cultivar_id is not null
  ) then
    raise exception 'that source could not be found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.media m
     where m.id = p_media_id and m.owner_id = v_uid and m.kind = 'image' and m.deleted_at is null
  ) then
    raise exception 'that photograph could not be found' using errcode = 'P0002';
  end if;
  update public.seed_sources set actual_parent_media_id = p_media_id where id = p_source_id;
end;
$$;

revoke all on function public.set_cultivar_parent_photo(uuid, uuid) from public, anon;
grant execute on function public.set_cultivar_parent_photo(uuid, uuid) to authenticated;
