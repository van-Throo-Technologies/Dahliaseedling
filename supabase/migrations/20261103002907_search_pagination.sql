-- Phase 5 repair: cursor-based pagination for Search. Each group is paged by keyset, not by offset. The total
-- order is (match tier, sort text, id), so a continuation resumes exactly after the last row returned and a row
-- can never be repeated or skipped while the data does not change.
--
-- Each function returns at most one row more than the requested page, so the caller can tell whether a further
-- page exists without a separate count. The functions remain SECURITY INVOKER: row-level security decides the
-- rows, and the explicit public predicates repeat the public rules. The database does the bounded continuation;
-- the application never loads the full match set.
--
-- The earlier Phase 5 functions are replaced, because their return types gain a sort_text column.

drop function public.search_seedlings(text, char, integer);
drop function public.search_cultivars(text, integer);
drop function public.search_growers(text, char, integer);

-- Seedlings. Sort text: the working name, or the primary identifier when there is no working name.
create function public.search_seedlings(
  p_query text,
  p_country char(2) default null,
  p_limit integer default 12,
  p_after_tier smallint default null,
  p_after_text text default null,
  p_after_id uuid default null
)
returns table (
  seedling_id uuid,
  match_tier smallint,
  match_reason text,
  primary_identifier text,
  primary_kind public.identifier_kind,
  working_name text,
  holder_id uuid,
  holder_name text,
  holder_country char(2),
  sort_text text
)
language sql
stable
security invoker
set search_path = ''
as $$
with query as (
  select public.search_text(p_query) as text_q,
         public.search_identifier(p_query) as ident_q
),
visible as (
  -- Public Seedlings whose current holder is not suspended, optionally in one country.
  select s.id, s.working_name, s.current_holder_id, h.display_name, h.country_code
    from public.seedlings s
    join public.profiles h on h.id = s.current_holder_id
   where s.visibility = 'public'
     and s.deleted_at is null
     and not h.is_suspended
     and (p_country is null or h.country_code = p_country)
),
identifier_hits as (
  select v.id, 1::smallint as tier, 'identifier'::text as reason, si.identifier as matched
    from query q
    cross join public.seedling_identifiers si
    join visible v on v.id = si.seedling_id
   where q.ident_q is not null
     and upper(regexp_replace(si.identifier, '^#', '')) = q.ident_q
  union all
  select v.id, 3::smallint, 'identifier', si.identifier
    from query q
    cross join public.seedling_identifiers si
    join visible v on v.id = si.seedling_id
   where q.ident_q is not null
     and length(q.ident_q) >= 2
     and upper(regexp_replace(si.identifier, '^#', '')) <> q.ident_q
     and left(upper(regexp_replace(si.identifier, '^#', '')), length(q.ident_q)) = q.ident_q
),
name_hits as (
  select v.id,
         (case
            when public.search_text(v.working_name) = q.text_q then 2
            when left(public.search_text(v.working_name), length(q.text_q)) = q.text_q then 3
            else 4
          end)::smallint as tier,
         'working_name'::text as reason,
         null::text as matched
    from query q
    join visible v on v.working_name is not null
   where q.text_q is not null
     and strpos(public.search_text(v.working_name), q.text_q) > 0
),
direct_hits as (
  select * from identifier_hits
  union all
  select * from name_hits
),
matched_cultivars as (
  select cr.id
    from query q
    join public.cultivar_references cr on strpos(cr.normalized_name, q.text_q) > 0
   where q.text_q is not null
),
parent_hits as (
  -- A child whose recorded parent is a matching cultivar.
  select sp.child_seedling_id as id, 5::smallint as tier, 'parent_cultivar'::text as reason, null::text as matched
    from public.seedling_parentage sp
    join matched_cultivars mc on mc.id = sp.parent_cultivar_id
    join visible v on v.id = sp.child_seedling_id
  union all
  -- A child whose recorded parent is a Seedling that matched directly.
  select sp.child_seedling_id, 5::smallint, 'parent_seedling', null
    from public.seedling_parentage sp
    join (select distinct d.id as parent_id from direct_hits d) parent on parent.parent_id = sp.parent_seedling_id
    join visible v on v.id = sp.child_seedling_id
),
country_hits as (
  select v.id, 6::smallint as tier, 'country'::text as reason, null::text as matched
    from query q
    cross join visible v
   where q.text_q is null
     and q.ident_q is null
     and p_country is not null
),
all_hits as (
  select * from direct_hits
  union all
  select * from parent_hits
  union all
  select * from country_hits
),
best as (
  -- One row per Seedling: the strongest reason it matched for.
  select distinct on (h.id) h.id, h.tier, h.reason, h.matched
    from all_hits h
   order by h.id, h.tier, h.reason, h.matched nulls last
),
ranked as (
  select b.id,
         b.tier,
         b.reason,
         pi.identifier,
         pi.kind,
         v.working_name,
         v.current_holder_id,
         v.display_name,
         v.country_code,
         lower(coalesce(v.working_name, pi.identifier, '')) as sort_text
    from best b
    join visible v on v.id = b.id
    left join lateral (
      select si.identifier, si.kind
        from public.seedling_identifiers si
       where si.seedling_id = v.id
         and si.is_primary_for_user
         and not si.is_retired_alias
       limit 1
    ) pi on true
)
select r.id,
       r.tier,
       r.reason,
       r.identifier,
       r.kind,
       r.working_name,
       r.current_holder_id,
       r.display_name,
       r.country_code,
       r.sort_text
  from ranked r
 where p_after_tier is null
    or (r.tier, r.sort_text, r.id) > (p_after_tier, p_after_text, p_after_id)
 order by r.tier, r.sort_text, r.id
 limit least(greatest(p_limit, 1), 13);
$$;

-- Cultivar References. Sort text: the cultivar name.
create function public.search_cultivars(
  p_query text,
  p_limit integer default 12,
  p_after_tier smallint default null,
  p_after_text text default null,
  p_after_id uuid default null
)
returns table (
  cultivar_id uuid,
  cultivar_name text,
  match_tier smallint,
  seed_parent_count integer,
  pollen_parent_count integer,
  sort_text text
)
language sql
stable
security invoker
set search_path = ''
as $$
with query as (
  select public.search_text(p_query) as text_q
),
hits as (
  select cr.id,
         cr.name,
         (case
            when cr.normalized_name = q.text_q then 1
            when left(cr.normalized_name, length(q.text_q)) = q.text_q then 2
            else 3
          end)::smallint as tier
    from query q
    join public.cultivar_references cr on strpos(cr.normalized_name, q.text_q) > 0
   where q.text_q is not null
),
ranked as (
  select h.id,
         h.name,
         h.tier,
         (select count(*)::integer
            from public.seedling_parentage sp
            join public.seedlings s on s.id = sp.child_seedling_id
            join public.profiles c on c.id = s.current_holder_id
           where sp.parent_cultivar_id = h.id
             and sp.role = 'seed_parent'
             and s.visibility = 'public'
             and s.deleted_at is null
             and not c.is_suspended) as seed_count,
         (select count(*)::integer
            from public.seedling_parentage sp
            join public.seedlings s on s.id = sp.child_seedling_id
            join public.profiles c on c.id = s.current_holder_id
           where sp.parent_cultivar_id = h.id
             and sp.role = 'pollen_parent'
             and s.visibility = 'public'
             and s.deleted_at is null
             and not c.is_suspended) as pollen_count
    from hits h
)
select r.id, r.name, r.tier, r.seed_count, r.pollen_count, r.name
  from ranked r
 where p_after_tier is null
    or (r.tier, r.name, r.id) > (p_after_tier, p_after_text, p_after_id)
 order by r.tier, r.name, r.id
 limit least(greatest(p_limit, 1), 13);
$$;

-- Growers: active, non-suspended profiles. Sort text: the lower-cased display name.
create function public.search_growers(
  p_query text,
  p_country char(2) default null,
  p_limit integer default 12,
  p_after_tier smallint default null,
  p_after_text text default null,
  p_after_id uuid default null
)
returns table (
  profile_id uuid,
  display_name text,
  country_code char(2),
  account_type_label text,
  match_tier smallint,
  sort_text text
)
language sql
stable
security invoker
set search_path = ''
as $$
with query as (
  select public.search_text(p_query) as text_q
),
ranked as (
  select p.id,
         p.display_name,
         p.country_code,
         p.account_type_label,
         (case
            when public.search_text(p.display_name) = q.text_q then 1
            when left(public.search_text(p.display_name), length(q.text_q)) = q.text_q then 2
            when strpos(public.search_text(p.display_name), q.text_q) > 0 then 3
            when p.account_type_label = q.text_q then 4
            else 5
          end)::smallint as tier,
         lower(p.display_name) as sort_text
    from query q
    join public.profiles p on not p.is_suspended
   where (p_country is null or p.country_code = p_country)
     and (
       (q.text_q is not null
         and (strpos(public.search_text(p.display_name), q.text_q) > 0
              or p.account_type_label = q.text_q))
       or (q.text_q is null and p_country is not null)
     )
)
select r.id, r.display_name, r.country_code, r.account_type_label, r.tier, r.sort_text
  from ranked r
 where p_after_tier is null
    or (r.tier, r.sort_text, r.id) > (p_after_tier, p_after_text, p_after_id)
 order by r.tier, r.sort_text, r.id
 limit least(greatest(p_limit, 1), 13);
$$;

revoke all on function public.search_seedlings(text, char, integer, smallint, text, uuid) from public;
revoke all on function public.search_cultivars(text, integer, smallint, text, uuid) from public;
revoke all on function public.search_growers(text, char, integer, smallint, text, uuid) from public;

grant execute on function public.search_seedlings(text, char, integer, smallint, text, uuid) to anon, authenticated;
grant execute on function public.search_cultivars(text, integer, smallint, text, uuid) to anon, authenticated;
grant execute on function public.search_growers(text, char, integer, smallint, text, uuid) to anon, authenticated;
