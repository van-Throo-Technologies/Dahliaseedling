-- Phase 1: application profiles.
--
-- A profile row is the public identity of one auth user. Its id is the auth user's id, and
-- it is created by that user only (see profiles_insert_own). Protected fields (is_suspended)
-- are not grantable to client roles; they change only through a checked database function
-- (see identity_admin_and_avatars).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 2 and 60),
  avatar_path text
    check (avatar_path is null or char_length(avatar_path) <= 512),
  country_code char(2) not null
    check (country_code ~ '^[A-Z]{2}$'),
  region_city text
    check (region_city is null or char_length(btrim(region_city)) between 1 and 100),
  bio text
    check (bio is null or char_length(bio) <= 500),
  account_type_label text
    check (account_type_label is null or account_type_label in ('individual', 'breeder', 'farm')),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Column-level grants: clients may write presentation fields only. id, created_at, updated_at
-- and is_suspended are deliberately absent.
grant select on table public.profiles to anon, authenticated;
grant insert (id, display_name, avatar_path, country_code, region_city, bio, account_type_label)
  on table public.profiles to authenticated;
grant update (display_name, avatar_path, country_code, region_city, bio, account_type_label)
  on table public.profiles to authenticated;

-- Visitors and other users read non-suspended profiles. Owners also read their own profile.
create policy profiles_select_public
  on public.profiles for select
  to anon, authenticated
  using (not is_suspended);

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- A profile can only be created for the signed-in user. The id is checked, never trusted.
create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

-- Suspended owners cannot edit their profile until an admin reinstates the account.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and not is_suspended)
  with check (id = (select auth.uid()) and not is_suspended);

-- No delete grant or policy: profiles are never removed by clients.
