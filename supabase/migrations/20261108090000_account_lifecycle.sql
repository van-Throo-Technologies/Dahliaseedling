-- Phase 10B: account deactivation and erasure foundations.
--
-- Three states are distinct. "deactivated" stops every new action through the existing suspension gate and hides the profile publicly.
-- "pending_erasure" means personal data has been cleared and at least one step is outstanding. "erased" is reserved for the point
-- where every step, including the Supabase Auth identity and original media, has completed; that point is not reachable until the
-- privileged steps are approved, so the state is never set by this migration.
--
-- Provenance is never changed. Seedling, identifier, parentage, holder and originator references all remain. A deleted grower's profile
-- row remains as a tombstone, labelled "Former grower" by the interface and holding a non-geographic country placeholder. Nothing here
-- deletes an Auth identity, original media or a storage object.

alter table public.profiles
  add column account_state text not null default 'active'
    check (account_state in ('active', 'deactivated', 'pending_erasure', 'erased')),
  add column state_changed_at timestamptz not null default now();

-- The grower cannot write these columns: the profile update grant covers only display fields, and the update policy refuses a suspended
-- profile. Clients therefore cannot reactivate or un-suspend themselves.

create table public.account_erasures (
  profile_id uuid primary key references public.profiles (id) on delete restrict,
  requested_at timestamptz not null default now(),
  records_erased_at timestamptz not null default now(),
  avatar_removed_at timestamptz,
  auth_identity_removed_at timestamptz,
  completed_at timestamptz
);

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('export', 'deactivation', 'erasure')),
  created_at timestamptz not null default now()
);

create index privacy_requests_profile_idx on public.privacy_requests (profile_id, created_at);

alter table public.account_erasures enable row level security;
alter table public.privacy_requests enable row level security;

create policy account_erasures_select_own on public.account_erasures
  for select to authenticated using (profile_id = (select auth.uid()));
create policy privacy_requests_select_own on public.privacy_requests
  for select to authenticated using (profile_id = (select auth.uid()));

revoke all on table public.account_erasures from public, anon, authenticated, service_role;
revoke all on table public.privacy_requests from public, anon, authenticated, service_role;
grant select on table public.account_erasures to authenticated;
grant select on table public.privacy_requests to authenticated;

-- Storage objects to purge later. Nothing consumes this queue yet: no purge runs until the operational authorization is approved. Items
-- are appended once per object and are never removed by a client.
create table public.storage_purge_queue (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('private-media', 'public-media', 'avatars')),
  object_path text not null,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  reason text not null check (reason in ('observation_erased', 'update_erased', 'account_erased')),
  state text not null default 'awaiting_authorization' check (state in ('awaiting_authorization', 'purged')),
  queued_at timestamptz not null default now(),
  purged_at timestamptz,
  unique (bucket, object_path)
);

alter table public.storage_purge_queue enable row level security;
revoke all on table public.storage_purge_queue from public, anon, authenticated, service_role;

-- A storage object is referenced only by a live row. A soft-deleted row does not keep its object alive.
create function public._storage_object_referenced(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.media m
     where m.deleted_at is null
       and ((p_bucket = 'private-media' and m.storage_path = p_name)
         or (p_bucket = 'public-media' and m.public_derivative_path = p_name))
  ) or exists (
    select 1 from public.public_derivatives d
     where d.deleted_at is null and p_bucket = 'public-media' and d.storage_path = p_name
  ) or exists (
    select 1 from public.profiles p
     where p_bucket = 'avatars' and p.avatar_path = p_name
  );
$$;

revoke all on function public._storage_object_referenced(text, text) from public, anon, authenticated;

-- The deactivation. Idempotent: a second call finds the account already deactivated and changes nothing.
-- Active Rehome cases that have not been sent are cancelled. A case in "sent" is left as it is, because sent-but-unconfirmed material
-- must keep its status. Active Seed Offers are closed. Open interests and subscriptions are withdrawn or closed. Reports do not block it.
create function public.deactivate_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  p public.profiles;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  select * into p from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'that account could not be found' using errcode = 'P0002';
  end if;
  if p.account_state <> 'active' then
    return;
  end if;

  update public.rehome_cases
     set status = 'cancelled', closed_at = now(), updated_at = now()
   where offering_holder_id = v_uid and status in ('available', 'arranged');

  update public.seed_offers set is_active = false, closed_at = now()
   where seller_id = v_uid and is_active;

  update public.rehome_interests set withdrawn_at = now()
   where interested_user_id = v_uid and withdrawn_at is null;

  update public.seed_offer_interests set withdrawn_at = now()
   where interested_user_id = v_uid and withdrawn_at is null;

  update public.availability_subscriptions set closed_at = now()
   where user_id = v_uid and closed_at is null;

  update public.profiles
     set account_state = 'deactivated', is_suspended = true, state_changed_at = now()
   where id = v_uid;

  insert into public.privacy_requests (profile_id, kind) values (v_uid, 'deactivation');
end;
$$;

-- Erasure of personal data. Requires a deactivated account. It clears what the grower controls and leaves provenance untouched. It is
-- idempotent: once the account is pending erasure, a repeat call returns the same previous avatar path without new work.
-- It returns the avatar path that was cleared, so the caller can remove that object through the grower's own session.
create function public.request_my_erasure()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  p public.profiles;
  v_avatar text;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  select * into p from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'that account could not be found' using errcode = 'P0002';
  end if;
  if p.account_state = 'pending_erasure' or p.account_state = 'erased' then
    return null;
  end if;
  if p.account_state <> 'deactivated' then
    raise exception 'deactivate the account before requesting erasure' using errcode = '23514';
  end if;

  v_avatar := p.avatar_path;

  -- Comments keep their place in threads, and lose their text.
  update public.comments
     set body = '[removed]', deleted_at = coalesce(deleted_at, now())
   where author_id = v_uid and (deleted_at is null or body <> '[removed]');

  -- Ordinary public Updates leave public view. Provenance does not depend on them.
  create temporary table _erased_derivatives on commit drop as
    select d.id, d.storage_path
      from public.public_derivatives d
     where d.deleted_at is null
       and exists (select 1 from public.update_media um join public.updates u on u.id = um.update_id
                    where um.derivative_id = d.id and u.author_id = v_uid);

  update public.updates set deleted_at = coalesce(deleted_at, now()), caption = null
   where author_id = v_uid and (deleted_at is null or caption is not null);

  -- A derivative used by another live Update stays. Only derivatives with no live Update left are retired.
  create temporary table _retired_derivatives on commit drop as
    select e.id, e.storage_path from _erased_derivatives e
     where not exists (select 1 from public.update_media um join public.updates u on u.id = um.update_id
                        where um.derivative_id = e.id and u.deleted_at is null);

  update public.seedlings set cover_derivative_id = null
   where cover_derivative_id in (select id from _retired_derivatives);
  update public.public_derivatives set deleted_at = now()
   where id in (select id from _retired_derivatives);

  -- Observations are private documentation of their author. Their text is cleared, and their own media is retired. Media also sent in
  -- a message stays, because the other participant's message history depends on it.
  create temporary table _erased_media on commit drop as
    select m.id, m.storage_path, m.public_derivative_path
      from public.media m
     where m.owner_id = v_uid and m.deleted_at is null
       and exists (select 1 from public.observation_media om join public.observations o on o.id = om.observation_id
                    where om.media_id = m.id and o.author_id = v_uid)
       and not exists (select 1 from public.messages msg where msg.photo_media_id = m.id);

  update public.observations
     set note = null, voice_transcript = null, deleted_at = coalesce(deleted_at, now())
   where author_id = v_uid and (deleted_at is null or note is not null or voice_transcript is not null);

  update public.media set deleted_at = now()
   where id in (select id from _erased_media);

  -- Objects that the database no longer serves are queued for purge, never removed here.
  insert into public.storage_purge_queue (bucket, object_path, owner_id, reason)
    select 'private-media', storage_path, v_uid, 'observation_erased' from _erased_media
  on conflict (bucket, object_path) do nothing;
  insert into public.storage_purge_queue (bucket, object_path, owner_id, reason)
    select 'public-media', public_derivative_path, v_uid, 'observation_erased' from _erased_media
     where public_derivative_path is not null
  on conflict (bucket, object_path) do nothing;
  insert into public.storage_purge_queue (bucket, object_path, owner_id, reason)
    select 'public-media', storage_path, v_uid, 'update_erased' from _retired_derivatives
  on conflict (bucket, object_path) do nothing;

  -- Relationships and interests that exist only because of this account.
  delete from public.likes where user_id = v_uid;
  delete from public.seedling_follows where user_id = v_uid;
  delete from public.saved_seedlings where user_id = v_uid;
  delete from public.grower_follows where follower_id = v_uid or followed_profile_id = v_uid;
  delete from public.availability_subscriptions where user_id = v_uid;
  delete from public.rehome_interests where interested_user_id = v_uid;
  delete from public.seed_offer_interests where interested_user_id = v_uid;
  delete from public.conversation_reads where user_id = v_uid;
  delete from public.blocks where blocker_id = v_uid or blocked_id = v_uid;
  delete from public.rate_counters where user_id = v_uid;
  delete from public.notifications where recipient_id = v_uid;
  update public.notifications set actor_id = null where actor_id = v_uid;

  -- The profile remains as a tombstone. Its references are what keep provenance valid.
  update public.profiles
     set display_name = 'Former grower', bio = null, region_city = null, avatar_path = null,
         account_type_label = null, country_code = 'XX',
         account_state = 'pending_erasure', state_changed_at = now()
   where id = v_uid;

  insert into public.account_erasures (profile_id) values (v_uid) on conflict (profile_id) do nothing;
  insert into public.privacy_requests (profile_id, kind) values (v_uid, 'erasure');

  return v_avatar;
end;
$$;

-- The grower records that the avatar object was removed through their own session. Idempotent.
create function public.record_my_avatar_removed()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.account_erasures
     set avatar_removed_at = coalesce(avatar_removed_at, now())
   where profile_id = (select auth.uid());
$$;

-- A status for the grower's own page. "Completed" needs every step, so with the Auth identity still outstanding it is always false.
create function public.my_privacy_status()
returns table (
  account_state text,
  state_changed_at timestamptz,
  erasure_requested_at timestamptz,
  avatar_removed boolean,
  auth_identity_removed boolean,
  media_purge_outstanding boolean,
  completed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.account_state,
         p.state_changed_at,
         e.requested_at,
         coalesce(e.avatar_removed_at is not null, false),
         coalesce(e.auth_identity_removed_at is not null, false),
         exists (select 1 from public.storage_purge_queue q
                  where q.owner_id = p.id and q.state = 'awaiting_authorization'),
         coalesce(e.completed_at is not null, false)
    from public.profiles p
    left join public.account_erasures e on e.profile_id = p.id
   where p.id = (select auth.uid());
$$;

-- Administrator-only detection of storage objects that no live row references. Read-only.
create function public.storage_orphan_candidates(p_limit integer default 200)
returns table (bucket_id text, object_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name, o.created_at
    from storage.objects o
   where public.is_admin()
     and o.bucket_id in ('private-media', 'public-media', 'avatars')
     and not public._storage_object_referenced(o.bucket_id, o.name)
   order by o.created_at, o.name
   limit least(greatest(p_limit, 1), 1000);
$$;

-- Administrator-only list of queued objects that no live row references. Read-only: nothing is purged by this function.
create function public.storage_purge_eligible(p_limit integer default 200)
returns table (id uuid, bucket text, object_path text, owner_id uuid, queued_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.bucket, q.object_path, q.owner_id, q.queued_at
    from public.storage_purge_queue q
   where public.is_admin()
     and q.state = 'awaiting_authorization'
     and not public._storage_object_referenced(q.bucket, q.object_path)
   order by q.queued_at, q.id
   limit least(greatest(p_limit, 1), 1000);
$$;

-- Administrators cannot reinstate a deactivated or erased account. Other suspension rules are unchanged.
create or replace function public.admin_set_suspended(target_profile_id uuid, suspended boolean)
returns profiles
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

  if not admin_set_suspended.suspended and exists (
    select 1 from public.profiles p
     where p.id = target_profile_id and p.account_state <> 'active'
  ) then
    raise exception 'deactivated or erased accounts cannot be reinstated' using errcode = '23514';
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

revoke all on function public.deactivate_my_account() from public, anon;
revoke all on function public.request_my_erasure() from public, anon;
revoke all on function public.record_my_avatar_removed() from public, anon;
revoke all on function public.my_privacy_status() from public, anon;
revoke all on function public.storage_orphan_candidates(integer) from public, anon;
revoke all on function public.storage_purge_eligible(integer) from public, anon;
grant execute on function public.deactivate_my_account() to authenticated;
grant execute on function public.request_my_erasure() to authenticated;
grant execute on function public.record_my_avatar_removed() to authenticated;
grant execute on function public.my_privacy_status() to authenticated;
grant execute on function public.storage_orphan_candidates(integer) to authenticated;
grant execute on function public.storage_purge_eligible(integer) to authenticated;
