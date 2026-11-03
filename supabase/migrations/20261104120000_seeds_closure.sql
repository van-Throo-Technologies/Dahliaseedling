-- Phase 7 closure: seed and seedhead offers in Search, and the grower's own unidentified sources for the parentage form.

-- 1. Offers in Search. An invoker function: it reads only through the policies and column grants of the caller, so a
-- visitor sees exactly the live public offers and their public context. It selects no interest rows, no owner ids, no
-- private media, and no inactive offers. Matching is on public text only: the cultivar name, the seedling's working name,
-- the seller's display name, and the grower's own description of an unidentified dahlia (descriptive text, never identity).
create function public.search_seed_offers(
  p_query text default null,
  p_country char(2) default null,
  p_limit integer default 12,
  p_after_text text default null,
  p_after_id uuid default null
)
returns table (
  offer_id uuid,
  match_tier smallint,
  sort_text text,
  material_type text,
  packet_size integer,
  seedhead_count integer,
  mode text,
  price_text text,
  handover_method text,
  source_kind text,
  source_seedling_id uuid,
  source_seedling_name text,
  source_cultivar_name text,
  source_description text,
  seller_name text,
  seller_country char(2),
  photo_path text
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select
      o.id,
      o.material_type,
      o.packet_size,
      o.seedhead_count,
      o.mode,
      o.price_text,
      o.handover_method,
      o.created_at,
      s.source_seedling_id,
      s.source_cultivar_id,
      s.source_unidentified_id,
      sl.working_name as seedling_name,
      cr.name as cultivar_name,
      ud.description as description,
      p.display_name as seller_name,
      p.country_code as seller_country
    from public.seed_offers o
    join public.seed_sources s on s.id = o.seed_source_id
    join public.profiles p on p.id = o.seller_id
    left join public.seedlings sl on sl.id = s.source_seedling_id
    left join public.cultivar_references cr on cr.id = s.source_cultivar_id
    left join public.unidentified_sources ud on ud.id = s.source_unidentified_id
    where o.is_active
      and (p_country is null or p.country_code = p_country)
      and (
        p_query is null
        or strpos(lower(coalesce(cr.name, '')), lower(p_query)) > 0
        or strpos(lower(coalesce(sl.working_name, '')), lower(p_query)) > 0
        or strpos(lower(coalesce(ud.description, '')), lower(p_query)) > 0
        or strpos(lower(coalesce(p.display_name, '')), lower(p_query)) > 0
      )
      and (
        p_after_text is null
        or (o.created_at, o.id) < (p_after_text::timestamptz, p_after_id)
      )
  )
  select
    b.id,
    1::smallint,
    b.created_at::text,
    b.material_type,
    b.packet_size,
    b.seedhead_count,
    b.mode,
    b.price_text,
    b.handover_method,
    case
      when b.source_seedling_id is not null then 'seedling'
      when b.source_cultivar_id is not null then 'cultivar'
      when b.source_unidentified_id is not null then 'unidentified'
      else 'unknown_mixed'
    end,
    b.source_seedling_id,
    b.seedling_name,
    b.cultivar_name,
    b.description,
    b.seller_name,
    b.seller_country,
    ph.storage_path
  from base b
  left join lateral (
    select d.storage_path
      from public.seed_offer_media m
      join public.public_derivatives d on d.id = m.derivative_id
     where m.offer_id = b.id
       and public._derivative_is_public(d.id)
     order by (m.role = 'source_photo') desc, m.sort_order, d.id
     limit 1
  ) ph on true
  order by b.created_at desc, b.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.search_seed_offers(text, char, integer, text, uuid) from public;
grant execute on function public.search_seed_offers(text, char, integer, text, uuid) to anon, authenticated;

-- 2. The grower's own unidentified sources, for reuse in the parentage form. The creator column is not granted to
-- clients, so this definer function filters on the caller's identity only and returns nothing else.
create function public.list_my_unidentified_sources()
returns table (source_id uuid, description text, photo_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
         u.description,
         (select count(*)::integer from public.unidentified_source_photos sp where sp.source_id = u.id)
    from public.unidentified_sources u
   where u.created_by = (select auth.uid())
   order by u.created_at desc, u.id desc
   limit 20;
$$;

revoke all on function public.list_my_unidentified_sources() from public, anon;
grant execute on function public.list_my_unidentified_sources() to authenticated;
