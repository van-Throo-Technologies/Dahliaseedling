-- Phase 1: admin authorization foundation and avatar storage.
--
-- Admin status is NOT a profile field and NOT an account_type_label. It lives in admin_users,
-- which clients can read only for their own row and cannot write at all. Operators grant admin
-- with a privileged SQL statement (see README, "Admin access").

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

grant select on table public.admin_users to authenticated;

create policy admin_users_select_own
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert, update or delete grant or policy: only privileged database roles can change admins.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- The only path that changes suspension. It checks admin status itself, so the RLS
-- bypass inside a security definer function is limited to this one update.
create function public.admin_set_suspended(target_profile_id uuid, suspended boolean)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.profiles
     set is_suspended = admin_set_suspended.suspended
   where id = target_profile_id
  returning * into updated_profile;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

revoke execute on function public.admin_set_suspended(uuid, boolean) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;

-- Avatars: a public bucket (avatars are shown on public profiles). Only the owner can write
-- objects, and only under a folder named after their own user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
