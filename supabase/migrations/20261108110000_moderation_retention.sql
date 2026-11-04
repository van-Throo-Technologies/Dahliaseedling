-- Phase 10B: configurable, legally reviewed retention for moderation evidence and administrator audit reasons.
--
-- No period is chosen here. Each category starts with no period, and while it has none, applying retention changes nothing. A period can be
-- set only by an administrator, with a basis that names the legal review that approved it. Disposal never deletes a report or an
-- administrator action: it clears only the personal text inside them, so the accountability record stays.

create table public.retention_policies (
  category text primary key check (category in ('moderation_snapshot', 'suspension_reason')),
  retain_days integer check (retain_days is null or retain_days >= 1),
  basis text check (basis is null or char_length(btrim(basis)) between 10 and 300),
  set_by uuid references public.profiles (id) on delete restrict,
  set_at timestamptz,
  check (retain_days is null or basis is not null)
);

insert into public.retention_policies (category) values ('moderation_snapshot'), ('suspension_reason');

create table public.retention_runs (
  id uuid primary key default gen_random_uuid(),
  category text not null references public.retention_policies (category),
  admin_id uuid not null references public.profiles (id) on delete restrict,
  rows_cleared integer not null check (rows_cleared >= 0),
  applied_at timestamptz not null default now()
);

alter table public.retention_policies enable row level security;
alter table public.retention_runs enable row level security;

create policy retention_policies_admin_select on public.retention_policies
  for select to authenticated using (public.is_admin());
create policy retention_runs_admin_select on public.retention_runs
  for select to authenticated using (public.is_admin());

revoke all on table public.retention_policies from public, anon, authenticated, service_role;
revoke all on table public.retention_runs from public, anon, authenticated, service_role;
grant select on table public.retention_policies to authenticated;
grant select on table public.retention_runs to authenticated;

create function public.set_retention_period(p_category text, p_days integer, p_basis text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 then
    raise exception 'a retention period needs a whole number of days' using errcode = '23514';
  end if;
  if char_length(btrim(coalesce(p_basis, ''))) < 10 then
    raise exception 'record the legal review that approved this period' using errcode = '23514';
  end if;
  update public.retention_policies
     set retain_days = p_days, basis = btrim(p_basis), set_by = (select auth.uid()), set_at = now()
   where category = p_category;
  if not found then
    raise exception 'unknown retention category' using errcode = '23514';
  end if;
end;
$$;

-- Clears personal text from decided moderation records, or from suspension reasons, once the category's period has passed. Returns the
-- number of rows changed. With no period set, it changes nothing and returns zero.
create function public.apply_retention_period(p_category text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_cleared integer := 0;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select retain_days into v_days from public.retention_policies where category = p_category;
  if not found then
    raise exception 'unknown retention category' using errcode = '23514';
  end if;
  if v_days is null then
    return 0;
  end if;

  if p_category = 'moderation_snapshot' then
    with cleared as (
      update public.reports
         set content_snapshot = null, details = null
       where status <> 'open' and resolved_at is not null
         and resolved_at < now() - make_interval(days => v_days)
         and (content_snapshot is not null or details is not null)
       returning 1
    )
    select count(*)::integer into v_cleared from cleared;
  else
    with cleared as (
      update public.admin_actions
         set reason = null
       where action_type in ('account_suspended', 'account_restored')
         and reason is not null
         and created_at < now() - make_interval(days => v_days)
       returning 1
    )
    select count(*)::integer into v_cleared from cleared;
  end if;

  insert into public.retention_runs (category, admin_id, rows_cleared)
  values (p_category, (select auth.uid()), v_cleared);
  return v_cleared;
end;
$$;

revoke all on function public.set_retention_period(text, integer, text) from public, anon;
revoke all on function public.apply_retention_period(text) from public, anon;
grant execute on function public.set_retention_period(text, integer, text) to authenticated;
grant execute on function public.apply_retention_period(text) to authenticated;
