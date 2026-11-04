-- Phase 8: private messaging, notifications, blocks, reports and Notify-me-if-available.
--
-- One messaging architecture: one-to-one conversations, optionally contextual to a Seedling, a Rehome case or a Seed
-- Offer. One notification architecture: typed notification rows with stable references, rendered in the reader's language.
-- Notifications are created in the same transaction as the event that caused them (trigger-driven), so an interest never
-- exists without its notification. Messages are never Notifications, and notifications never appear in the Inbox.

-- 1. Conversations. The two participants are stored in order (user_a_id < user_b_id), so a pair has one identity.
-- Context is typed and structural: each context reference is a real foreign key, and a check ties the type to exactly one.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles (id) on delete restrict,
  user_b_id uuid not null references public.profiles (id) on delete restrict,
  context_type text not null check (context_type in ('direct', 'seedling', 'rehome_case', 'seed_offer')),
  seedling_id uuid references public.seedlings (id) on delete restrict,
  rehome_case_id uuid references public.rehome_cases (id) on delete restrict,
  seed_offer_id uuid references public.seed_offers (id) on delete restrict,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_pair_ordered check (user_a_id < user_b_id),
  constraint conversations_context_matches check (
    (context_type = 'direct' and seedling_id is null and rehome_case_id is null and seed_offer_id is null)
    or (context_type = 'seedling' and seedling_id is not null and rehome_case_id is null and seed_offer_id is null)
    or (context_type = 'rehome_case' and seedling_id is null and rehome_case_id is not null and seed_offer_id is null)
    or (context_type = 'seed_offer' and seedling_id is null and rehome_case_id is null and seed_offer_id is not null)
  )
);

-- One conversation per pair and context. Repeated presses open the same thread, never a duplicate.
create unique index conversations_one_per_context
  on public.conversations (user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id)
  nulls not distinct;
create index conversations_user_a_activity_idx on public.conversations (user_a_id, last_message_at desc, id desc);
create index conversations_user_b_activity_idx on public.conversations (user_b_id, last_message_at desc, id desc);

-- 2. Messages. Text and/or one photograph, from a participant. Immutable: there is no edit or delete path.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete restrict,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  body text check (body is null or char_length(btrim(body)) between 1 and 2000),
  photo_media_id uuid references public.media (id) on delete restrict,
  client_key uuid not null,
  created_at timestamptz not null default now(),
  constraint messages_need_content check (body is not null or photo_media_id is not null),
  constraint messages_one_client_key unique (conversation_id, sender_id, client_key)
);

create index messages_conversation_idx on public.messages (conversation_id, created_at, id);

-- 3. Read state, one row per participant and conversation. Unread means a message from the other participant later than this.
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  read_at timestamptz not null,
  primary key (conversation_id, user_id)
);

-- 4. Blocks. A block is directional in storage and mutual in effect for new private interaction.
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete restrict,
  blocked_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

-- 5. Notifications. Attention signals, not messages. The record stores references and a type, never rendered text.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete restrict,
  type text not null check (type in (
    'comment', 'reply', 'message', 'rehome_interest', 'rehome_selected', 'rehome_sent', 'rehome_received',
    'seed_offer_interest', 'followed_seedling_update', 'availability_trigger'
  )),
  actor_id uuid references public.profiles (id) on delete restrict,
  seedling_id uuid references public.seedlings (id) on delete restrict,
  update_id uuid references public.updates (id) on delete restrict,
  comment_id uuid references public.comments (id) on delete restrict,
  conversation_id uuid references public.conversations (id) on delete restrict,
  rehome_case_id uuid references public.rehome_cases (id) on delete restrict,
  seed_offer_id uuid references public.seed_offers (id) on delete restrict,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

-- 6. Notify me if available. Exact Seedling identity only; closes after a successful continuation.
create table public.availability_subscriptions (
  user_id uuid not null references public.profiles (id) on delete restrict,
  seedling_id uuid not null references public.seedlings (id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  -- The language the grower was reading when they subscribed. It is used only for the availability email.
  locale text not null default 'en' check (locale in ('en', 'nl', 'fr')),
  primary key (user_id, seedling_id)
);

create index availability_subscriptions_seedling_idx on public.availability_subscriptions (seedling_id) where closed_at is null;

-- 7. Email outbox for Cull-availability alerts. One row per subscriber and availability event, so an alert is sent at most
-- once. Delivery is performed by a provider worker that is not part of this phase (see the README).
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('availability_alert')),
  seedling_id uuid not null references public.seedlings (id) on delete restrict,
  rehome_case_id uuid references public.rehome_cases (id) on delete restrict,
  locale text not null default 'en' check (locale in ('en', 'nl', 'fr')),
  -- One logical email per availability event and subscriber. A repeated event returns the same row.
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  claimed_until timestamptz,
  last_failure text check (last_failure in (
    'provider_temporary', 'provider_rejected', 'recipient_unavailable',
    'subscription_closed', 'no_longer_available', 'attempts_exhausted'
  )),
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint email_outbox_sent_at check ((status = 'sent') = (sent_at is not null)),
  constraint email_outbox_claim check ((claim_token is null) = (claimed_until is null))
);

-- The delivery worker looks only at rows that are pending and due.
create index email_outbox_due_idx on public.email_outbox (next_attempt_at, created_at) where status = 'pending';

-- 8. Reports. The reporter and an administrator see a report; the reported grower never does. Each report keeps the reported
-- grower and the content as it was when reported, so review does not depend on later state.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete restrict,
  reported_user_id uuid not null references public.profiles (id) on delete restrict,
  target_type text not null check (target_type in ('update', 'comment', 'profile', 'message')),
  target_id uuid not null,
  reason text not null check (reason in ('harassment', 'spam', 'inappropriate', 'other')),
  details text check (details is null or char_length(btrim(details)) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  target_update_id uuid references public.updates (id) on delete restrict,
  conversation_id uuid references public.conversations (id) on delete restrict,
  content_snapshot text,
  message_photo_media_id uuid references public.media (id) on delete restrict,
  reviewed_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_not_self check (reporter_id <> reported_user_id),
  constraint reports_message_context check (target_type <> 'message' or conversation_id is not null),
  constraint reports_comment_context check (target_type <> 'comment' or target_update_id is not null),
  constraint reports_resolution check ((status = 'open') = (resolved_at is null))
);

-- A repeated report of the same target by the same grower, while it is open, returns the existing report.
create unique index reports_one_open_per_target on public.reports (reporter_id, target_type, target_id) where status = 'open';
create index reports_status_idx on public.reports (status, created_at desc);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete restrict,
  action_type text not null check (action_type in ('report_resolved', 'content_removed', 'account_suspended', 'account_restored')),
  target_type text not null,
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

-- 9. Helpers. Each is SECURITY DEFINER with an empty search_path, and reads only what its caller would already be allowed.
create function public._is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
     where c.id = p_conversation_id
       and (c.user_a_id = (select auth.uid()) or c.user_b_id = (select auth.uid()))
  );
$$;

create function public._blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

create function public._profile_active(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = p_id and not is_suspended);
$$;

create function public._message_media_is_readable(p_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where m.photo_media_id = p_media_id
       and (c.user_a_id = (select auth.uid()) or c.user_b_id = (select auth.uid()))
  );
$$;

-- Every path that reads or changes block state for a pair takes this lock first: starting a conversation, sending, expressing
-- interest, blocking and unblocking. A block then commits either before such a write, which is refused, or after it.
create function public._lock_pair(p_a uuid, p_b uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(least(p_a, p_b)::text || ':' || greatest(p_a, p_b)::text, 0));
end;
$$;

revoke all on function public._lock_pair(uuid, uuid) from public, anon, authenticated;
revoke all on function public._is_conversation_participant(uuid) from public, anon;
revoke all on function public._blocked_between(uuid, uuid) from public, anon;
revoke all on function public._profile_active(uuid) from public, anon;
revoke all on function public._message_media_is_readable(uuid) from public, anon;
grant execute on function public._is_conversation_participant(uuid) to authenticated;
grant execute on function public._message_media_is_readable(uuid) to authenticated;

-- 10. Row-level security. Clients read through the policies and column grants below, and write only through functions.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.availability_subscriptions enable row level security;
alter table public.email_outbox enable row level security;
alter table public.reports enable row level security;
alter table public.admin_actions enable row level security;

revoke all on table public.conversations from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.conversation_reads from anon, authenticated;
revoke all on table public.blocks from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.availability_subscriptions from anon, authenticated;
revoke all on table public.email_outbox from anon, authenticated;
-- The provider worker reads pending rows and marks them sent, with the service role only. Clients have no access.
revoke all on table public.email_outbox from service_role;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.admin_actions from anon, authenticated;

create policy conversations_select_participant on public.conversations for select
  to authenticated
  using (user_a_id = (select auth.uid()) or user_b_id = (select auth.uid()));
grant select (id, user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id, last_message_at, created_at)
  on table public.conversations to authenticated;

create policy messages_select_participant on public.messages for select
  to authenticated
  using (public._is_conversation_participant(conversation_id));
grant select (id, conversation_id, sender_id, body, photo_media_id, client_key, created_at)
  on table public.messages to authenticated;

create policy conversation_reads_select_own on public.conversation_reads for select
  to authenticated
  using (user_id = (select auth.uid()));
grant select (conversation_id, user_id, read_at) on table public.conversation_reads to authenticated;

create policy blocks_select_blocker on public.blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));
grant select (blocker_id, blocked_id, created_at) on table public.blocks to authenticated;

create policy notifications_select_recipient on public.notifications for select
  to authenticated
  using (recipient_id = (select auth.uid()));
grant select (id, recipient_id, type, actor_id, seedling_id, update_id, comment_id, conversation_id,
              rehome_case_id, seed_offer_id, read_at, created_at)
  on table public.notifications to authenticated;

create policy availability_subscriptions_select_own on public.availability_subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));
grant select (user_id, seedling_id, created_at, closed_at) on table public.availability_subscriptions to authenticated;

create policy reports_select_reporter_or_admin on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());
grant select (id, reporter_id, target_type, target_id, reason, details, status, target_update_id, conversation_id,
              content_snapshot, reviewed_by, created_at, resolved_at)
  on table public.reports to authenticated;

create policy admin_actions_select_admin on public.admin_actions for select
  to authenticated
  using (public.is_admin());
grant select (id, admin_id, action_type, target_type, target_id, reason, created_at) on table public.admin_actions to authenticated;

-- A participant can read a message photo's media row, so the existing media route serves it to the other participant only.
create policy media_select_message_participant on public.media for select
  to authenticated
  using (public._message_media_is_readable(id));

-- The private-media object for a message photo is readable by its participants, and only while the message exists.
create policy private_media_select_message_participant on storage.objects for select
  to authenticated
  using (
    bucket_id = 'private-media'
    and exists (
      select 1 from public.media m
       where m.storage_path = storage.objects.name
         and public._message_media_is_readable(m.id)
    )
  );

-- 11. Context authorization. A conversation is opened only between the two people that its context legitimately names.
create function public.start_direct_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_a uuid := least(v_uid, p_other);
  v_b uuid := greatest(v_uid, p_other);
  v_id uuid;
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot start conversations' using errcode = '42501'; end if;
  if p_other is null or p_other = v_uid then raise exception 'that grower could not be found' using errcode = 'P0002'; end if;
  if not public._profile_active(p_other) then raise exception 'that grower could not be found' using errcode = 'P0002'; end if;
  perform public._lock_pair(v_uid, p_other);
  if public._blocked_between(v_uid, p_other) then raise exception 'messaging is not available between these growers' using errcode = '42501'; end if;

  insert into public.conversations (user_a_id, user_b_id, context_type)
  values (v_a, v_b, 'direct')
  on conflict (user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id) do nothing;
  select id into v_id from public.conversations
   where user_a_id = v_a and user_b_id = v_b and context_type = 'direct'
     and seedling_id is null and rehome_case_id is null and seed_offer_id is null;
  return v_id;
end;
$$;

create function public.start_seedling_conversation(p_seedling_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  s public.seedlings;
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot start conversations' using errcode = '42501'; end if;
  select * into s from public.seedlings where id = p_seedling_id and deleted_at is null;
  if not found or s.visibility <> 'public' or not public._profile_active(s.current_holder_id) then
    raise exception 'that seedling could not be found' using errcode = 'P0002';
  end if;
  if s.current_holder_id = v_uid then raise exception 'you hold this seedling' using errcode = '23514'; end if;
  perform public._lock_pair(v_uid, s.current_holder_id);
  if public._blocked_between(v_uid, s.current_holder_id) then
    raise exception 'messaging is not available between these growers' using errcode = '42501';
  end if;
  v_a := least(v_uid, s.current_holder_id);
  v_b := greatest(v_uid, s.current_holder_id);
  insert into public.conversations (user_a_id, user_b_id, context_type, seedling_id)
  values (v_a, v_b, 'seedling', s.id)
  on conflict (user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id) do nothing;
  select id into v_id from public.conversations
   where user_a_id = v_a and user_b_id = v_b and context_type = 'seedling' and seedling_id = s.id;
  return v_id;
end;
$$;

-- A Rehome conversation is between the holder and one interested grower. The holder may open it with a grower who has an
-- interest in the case or who was chosen; that grower may open it with the holder. Nothing here changes the holder.
create function public.start_rehome_conversation(p_case_id uuid, p_with uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.rehome_cases;
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot start conversations' using errcode = '42501'; end if;
  select * into c from public.rehome_cases where id = p_case_id;
  if not found or c.status not in ('available', 'arranged', 'sent', 'completed') then
    raise exception 'that continuation could not be found' using errcode = 'P0002';
  end if;
  if v_uid = c.offering_holder_id then
    -- A null recipient never compares equal, so the chosen recipient is tested as a plain boolean.
    if p_with is null or not (
      exists (select 1 from public.rehome_interests i
               where i.rehome_case_id = c.id and i.interested_user_id = p_with)
      or (c.chosen_recipient_id is not null and c.chosen_recipient_id = p_with)
    ) then
      raise exception 'that grower has not expressed interest in this continuation' using errcode = 'P0002';
    end if;
  else
    -- The interested grower may open it only with the holder, and only while they were interested or were chosen.
    if p_with is distinct from c.offering_holder_id or not (
      exists (select 1 from public.rehome_interests i
               where i.rehome_case_id = c.id and i.interested_user_id = v_uid)
      or (c.chosen_recipient_id is not null and c.chosen_recipient_id = v_uid)
    ) then
      raise exception 'that continuation could not be found' using errcode = 'P0002';
    end if;
  end if;
  if not public._profile_active(p_with) then raise exception 'that grower could not be found' using errcode = 'P0002'; end if;
  perform public._lock_pair(v_uid, p_with);
  if public._blocked_between(v_uid, p_with) then
    raise exception 'messaging is not available between these growers' using errcode = '42501';
  end if;
  v_a := least(v_uid, p_with);
  v_b := greatest(v_uid, p_with);
  insert into public.conversations (user_a_id, user_b_id, context_type, rehome_case_id)
  values (v_a, v_b, 'rehome_case', c.id)
  on conflict (user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id) do nothing;
  select id into v_id from public.conversations
   where user_a_id = v_a and user_b_id = v_b and context_type = 'rehome_case' and rehome_case_id = c.id;
  return v_id;
end;
$$;

-- A Seed Offer conversation is between the seller and one interested grower, in the same way.
create function public.start_seed_offer_conversation(p_offer_id uuid, p_with uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  o public.seed_offers;
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot start conversations' using errcode = '42501'; end if;
  select * into o from public.seed_offers where id = p_offer_id;
  if not found then raise exception 'that offer could not be found' using errcode = 'P0002'; end if;
  if v_uid = o.seller_id then
    if p_with is null or not exists (
      select 1 from public.seed_offer_interests i where i.seed_offer_id = o.id and i.interested_user_id = p_with
    ) then
      raise exception 'that grower has not expressed interest in this offer' using errcode = 'P0002';
    end if;
  else
    if p_with is distinct from o.seller_id or not exists (
      select 1 from public.seed_offer_interests i where i.seed_offer_id = o.id and i.interested_user_id = v_uid
    ) then
      raise exception 'that offer could not be found' using errcode = 'P0002';
    end if;
  end if;
  if not public._profile_active(p_with) then raise exception 'that grower could not be found' using errcode = 'P0002'; end if;
  perform public._lock_pair(v_uid, p_with);
  if public._blocked_between(v_uid, p_with) then
    raise exception 'messaging is not available between these growers' using errcode = '42501';
  end if;
  v_a := least(v_uid, p_with);
  v_b := greatest(v_uid, p_with);
  insert into public.conversations (user_a_id, user_b_id, context_type, seed_offer_id)
  values (v_a, v_b, 'seed_offer', o.id)
  on conflict (user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id) do nothing;
  select id into v_id from public.conversations
   where user_a_id = v_a and user_b_id = v_b and context_type = 'seed_offer' and seed_offer_id = o.id;
  return v_id;
end;
$$;

-- 12. Messages. The sender is always the caller. Sending is idempotent on the client key. The conversation row is locked so a
-- concurrent block is ordered with this send: either the message is written before the block, or it is refused after it.
create function public.register_message_photo(p_path text)
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
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot send messages' using errcode = '42501'; end if;
  v_media := public._register_media_object(p_path);
  select kind into v_kind from public.media where id = v_media;
  if v_kind <> 'image' then raise exception 'a message photograph must be an image' using errcode = '23514'; end if;
  return v_media;
end;
$$;

create function public.send_message(
  p_conversation_id uuid,
  p_client_key uuid,
  p_body text default null,
  p_photo_media_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.conversations;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_id uuid;
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot send messages' using errcode = '42501'; end if;
  select * into c from public.conversations where id = p_conversation_id;
  if found then perform public._lock_pair(c.user_a_id, c.user_b_id); end if;
  select * into c from public.conversations where id = p_conversation_id for update;
  if not found or (c.user_a_id <> v_uid and c.user_b_id <> v_uid) then
    raise exception 'that conversation could not be found' using errcode = 'P0002';
  end if;
  if public._blocked_between(c.user_a_id, c.user_b_id) then
    raise exception 'messaging is not available between these growers' using errcode = '42501';
  end if;
  if not public._profile_active(case when c.user_a_id = v_uid then c.user_b_id else c.user_a_id end) then
    raise exception 'that grower cannot receive messages' using errcode = '42501';
  end if;
  if v_body is null and p_photo_media_id is null then
    raise exception 'a message needs text or a photograph' using errcode = '23514';
  end if;
  if v_body is not null and char_length(v_body) > 2000 then
    raise exception 'messages are 2000 characters or fewer' using errcode = '23514';
  end if;
  if p_photo_media_id is not null and not exists (
    select 1 from public.media m where m.id = p_photo_media_id and m.owner_id = v_uid and m.kind = 'image' and m.deleted_at is null
  ) then
    raise exception 'that photograph could not be found' using errcode = 'P0002';
  end if;

  -- Retried or doubled submissions return the message already written with this client key.
  insert into public.messages (conversation_id, sender_id, body, photo_media_id, client_key)
  values (c.id, v_uid, v_body, p_photo_media_id, p_client_key)
  on conflict (conversation_id, sender_id, client_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.messages
     where conversation_id = c.id and sender_id = v_uid and client_key = p_client_key;
  end if;
  -- The sender has read their own conversation up to this message, so only the other participant's messages are unread.
  insert into public.conversation_reads (conversation_id, user_id, read_at)
  values (c.id, v_uid, now())
  on conflict (conversation_id, user_id) do update
    set read_at = greatest(public.conversation_reads.read_at, excluded.read_at);
  return v_id;
end;
$$;

create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public._is_conversation_participant(p_conversation_id) then
    raise exception 'that conversation could not be found' using errcode = 'P0002';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, read_at)
  values (p_conversation_id, v_uid, now())
  on conflict (conversation_id, user_id) do update
    set read_at = greatest(public.conversation_reads.read_at, excluded.read_at);
  update public.notifications
     set read_at = now()
   where recipient_id = v_uid and conversation_id = p_conversation_id and type = 'message' and read_at is null;
end;
$$;

-- 13. Blocks. Blocking prevents new messages, new conversations and new interest in either direction. Existing history is kept.
create function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot block' using errcode = '42501'; end if;
  if p_target is null or p_target = v_uid or not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'that grower could not be found' using errcode = 'P0002';
  end if;
  perform public._lock_pair(v_uid, p_target);
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_target)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

create function public.unblock_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot change blocks' using errcode = '42501'; end if;
  perform public._lock_pair(v_uid, p_target);
  delete from public.blocks where blocker_id = v_uid and blocked_id = p_target;
end;
$$;

-- 14. Reports. Reporting never notifies the reported grower and never blocks anyone. Each target is resolved from the database,
-- never from a browser-supplied grower id, and its content is copied into the report at the moment it is reported.
create function public.create_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_reported uuid;
  v_update uuid;
  v_conversation uuid;
  v_content text;
  v_photo uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot report' using errcode = '42501'; end if;
  if p_reason not in ('harassment', 'spam', 'inappropriate', 'other') then
    raise exception 'choose a reason' using errcode = '23514';
  end if;
  if v_details is not null and char_length(v_details) > 1000 then
    raise exception 'details are 1000 characters or fewer' using errcode = '23514';
  end if;
  if p_target_type not in ('update', 'comment', 'profile', 'message') then
    raise exception 'that cannot be reported' using errcode = '23514';
  end if;

  if p_target_type = 'message' then
    select m.sender_id, m.conversation_id, m.body, m.photo_media_id
      into v_reported, v_conversation, v_content, v_photo
      from public.messages m
     where m.id = p_target_id and public._is_conversation_participant(m.conversation_id);
    if not found then raise exception 'that message could not be found' using errcode = 'P0002'; end if;
  elsif p_target_type = 'update' then
    select u.author_id, coalesce(u.caption, '')
      into v_reported, v_content
      from public.updates u
     where u.id = p_target_id and u.deleted_at is null and public._update_is_public(u.id);
    if not found then raise exception 'that update could not be found' using errcode = 'P0002'; end if;
  elsif p_target_type = 'comment' then
    select c.author_id, c.update_id, c.body
      into v_reported, v_update, v_content
      from public.comments c
     where c.id = p_target_id and c.deleted_at is null
       and public._update_is_public(c.update_id) and public._profile_active(c.author_id);
    if not found then raise exception 'that comment could not be found' using errcode = 'P0002'; end if;
  else
    select p.id into v_reported from public.profiles p where p.id = p_target_id and not p.is_suspended;
    if not found then raise exception 'that profile could not be found' using errcode = 'P0002'; end if;
  end if;

  if v_reported = v_uid then
    raise exception 'you cannot report your own content or yourself' using errcode = '23514';
  end if;

  insert into public.reports (
    reporter_id, reported_user_id, target_type, target_id, reason, details,
    target_update_id, conversation_id, content_snapshot, message_photo_media_id
  )
  values (
    v_uid, v_reported, p_target_type, p_target_id, p_reason, v_details,
    case when p_target_type = 'comment' then v_update end, v_conversation, v_content, v_photo
  )
  on conflict (reporter_id, target_type, target_id) where status = 'open' do nothing
  returning id into v_id;
  if v_id is null then
    select r.id into v_id from public.reports r
     where r.reporter_id = v_uid and r.target_type = p_target_type and r.target_id = p_target_id and r.status = 'open';
  end if;
  return v_id;
end;
$$;

-- An administrator resolves an open report once. A resolved report cannot change, so the audit trail stays one row per decision.
create function public.resolve_report(p_report_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  r public.reports;
begin
  if v_uid is null or not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('reviewed', 'actioned', 'dismissed') then raise exception 'choose a resolution' using errcode = '23514'; end if;
  select * into r from public.reports where id = p_report_id for update;
  if not found then raise exception 'that report could not be found' using errcode = 'P0002'; end if;
  if r.status <> 'open' then raise exception 'this report has already been resolved' using errcode = 'P0001'; end if;
  update public.reports
     set status = p_status, reviewed_by = v_uid, resolved_at = now()
   where id = p_report_id;
  insert into public.admin_actions (admin_id, action_type, target_type, target_id, reason)
  values (v_uid, 'report_resolved', r.target_type, r.target_id, nullif(btrim(coalesce(p_reason, '')), ''));
end;
$$;

-- 14b. Administrator review. Every function starts from a report, so an administrator never browses conversations or profiles
-- directly. Only administrators call these; each one checks is_admin() itself.
create function public.admin_list_reports(p_show_all boolean default false, p_limit integer default 50)
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  reason text,
  details text,
  status text,
  created_at timestamptz,
  resolved_at timestamptz,
  reporter_name text,
  reported_user_id uuid,
  reported_name text,
  reported_suspended boolean,
  content_snapshot text,
  target_live boolean,
  target_update_id uuid,
  is_message boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.details,
    r.status,
    r.created_at,
    r.resolved_at,
    reporter.display_name,
    r.reported_user_id,
    reported.display_name,
    reported.is_suspended,
    r.content_snapshot,
    case r.target_type
      when 'update' then public._update_is_public(r.target_id)
      when 'comment' then public._update_is_public(r.target_update_id)
        and exists (select 1 from public.comments c where c.id = r.target_id and c.deleted_at is null)
      when 'profile' then not reported.is_suspended
      else false
    end,
    r.target_update_id,
    r.target_type = 'message'
  from public.reports r
  join public.profiles reporter on reporter.id = r.reporter_id
  join public.profiles reported on reported.id = r.reported_user_id
  where p_show_all or r.status = 'open'
  order by r.created_at desc, r.id desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

-- Removes a public Update or comment that a report concerns. It is a soft delete, the same as the author's own delete, and
-- Seedling identity and provenance are never touched. Idempotent: removing already removed content records nothing new.
create function public.admin_remove_content(p_report_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  r public.reports;
  v_changed integer := 0;
begin
  if v_uid is null or not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into r from public.reports where id = p_report_id;
  if not found then raise exception 'that report could not be found' using errcode = 'P0002'; end if;
  if r.target_type not in ('update', 'comment') then
    raise exception 'only a public Update or comment can be removed' using errcode = '23514';
  end if;

  if r.target_type = 'update' then
    update public.updates set deleted_at = now() where id = r.target_id and deleted_at is null;
    get diagnostics v_changed = row_count;
    if v_changed > 0 then
      update public.seedlings s set cover_derivative_id = null
        from public.update_media um
       where um.update_id = r.target_id and um.derivative_id = s.cover_derivative_id;
      update public.public_derivatives d set deleted_at = now()
       where d.deleted_at is null
         and d.id in (select um.derivative_id from public.update_media um where um.update_id = r.target_id)
         and not exists (
           select 1 from public.update_media um2
             join public.updates u2 on u2.id = um2.update_id
            where um2.derivative_id = d.id and u2.deleted_at is null
         );
    end if;
  else
    update public.comments set deleted_at = now() where id = r.target_id and deleted_at is null;
    get diagnostics v_changed = row_count;
  end if;

  if v_changed > 0 then
    insert into public.admin_actions (admin_id, action_type, target_type, target_id, reason)
    values (v_uid, 'content_removed', r.target_type, r.target_id, nullif(btrim(coalesce(p_reason, '')), ''));
  end if;
end;
$$;

-- Suspends or restores the reported grower through the Phase 1 authority, admin_set_suspended. It does not add a flag, and it
-- does not delete anything: suspension is enforced by the existing database rules.
create function public.admin_set_reported_suspension(p_report_id uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  r public.reports;
begin
  if v_uid is null or not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into r from public.reports where id = p_report_id;
  if not found then raise exception 'that report could not be found' using errcode = 'P0002'; end if;
  if r.reported_user_id = v_uid then
    raise exception 'you cannot suspend your own account from a report' using errcode = '23514';
  end if;
  perform public.admin_set_suspended(r.reported_user_id, p_suspended);
  insert into public.admin_actions (admin_id, action_type, target_type, target_id, reason)
  values (
    v_uid,
    case when p_suspended then 'account_suspended' else 'account_restored' end,
    'profile',
    r.reported_user_id,
    nullif(btrim(coalesce(p_reason, '')), '')
  );
end;
$$;

-- 15. Notifications: read state. Each action changes only the caller's own rows.
create function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  update public.notifications set read_at = now()
   where id = p_notification_id and recipient_id = v_uid and read_at is null;
end;
$$;

create function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  update public.notifications set read_at = now() where recipient_id = v_uid and read_at is null;
end;
$$;

-- 16. Notify me if available. A grower who is not the holder subscribes to one exact Seedling.
create function public.subscribe_availability(p_seedling_id uuid, p_locale text default 'en')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_locale text := case when p_locale in ('en', 'nl', 'fr') then p_locale else 'en' end;
  s public.seedlings;
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  if not public.caller_can_participate() then raise exception 'suspended accounts cannot subscribe' using errcode = '42501'; end if;
  select * into s from public.seedlings where id = p_seedling_id and deleted_at is null;
  if not found or s.current_holder_id = v_uid or not (
    s.visibility = 'public' or s.current_holder_id = v_uid or s.originator_id = v_uid
  ) then
    raise exception 'that seedling could not be found' using errcode = 'P0002';
  end if;
  insert into public.availability_subscriptions (user_id, seedling_id, locale)
  values (v_uid, s.id, v_locale)
  on conflict (user_id, seedling_id) do update set closed_at = null, locale = excluded.locale;
end;
$$;

create function public.unsubscribe_availability(p_seedling_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sign in to continue' using errcode = '42501'; end if;
  update public.availability_subscriptions set closed_at = now()
   where user_id = v_uid and seedling_id = p_seedling_id and closed_at is null;
end;
$$;

-- Grants for the functions. Each is callable by signed-in users only; the triggers below run inside the caller's transaction.
revoke all on function public.start_direct_conversation(uuid) from public, anon;
revoke all on function public.start_seedling_conversation(uuid) from public, anon;
revoke all on function public.start_rehome_conversation(uuid, uuid) from public, anon;
revoke all on function public.start_seed_offer_conversation(uuid, uuid) from public, anon;
revoke all on function public.register_message_photo(text) from public, anon;
revoke all on function public.send_message(uuid, uuid, text, uuid) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.create_report(text, uuid, text, text) from public, anon;
revoke all on function public.resolve_report(uuid, text, text) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
revoke all on function public.subscribe_availability(uuid, text) from public, anon;
revoke all on function public.unsubscribe_availability(uuid) from public, anon;

grant execute on function public.start_direct_conversation(uuid) to authenticated;
grant execute on function public.start_seedling_conversation(uuid) to authenticated;
grant execute on function public.start_rehome_conversation(uuid, uuid) to authenticated;
grant execute on function public.start_seed_offer_conversation(uuid, uuid) to authenticated;
grant execute on function public.register_message_photo(text) to authenticated;
grant execute on function public.send_message(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.create_report(text, uuid, text, text) to authenticated;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.subscribe_availability(uuid, text) to authenticated;
grant execute on function public.unsubscribe_availability(uuid) to authenticated;

-- 17. Triggers: messages. Authorship and the participant rule are enforced where the row is written, not only in the function.
create function public._messages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  v_other uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if not found or (c.user_a_id <> new.sender_id and c.user_b_id <> new.sender_id) then
    raise exception 'a message can only be sent by a participant' using errcode = '42501';
  end if;
  v_other := case when c.user_a_id = new.sender_id then c.user_b_id else c.user_a_id end;
  if public._blocked_between(c.user_a_id, c.user_b_id) then
    raise exception 'messaging is not available between these growers' using errcode = '42501';
  end if;
  if not public._profile_active(new.sender_id) or not public._profile_active(v_other) then
    raise exception 'suspended accounts cannot exchange messages' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger messages_guard before insert on public.messages
  for each row execute function public._messages_guard();

-- After a message: the conversation's activity moves, and the other participant gets one bundled unread notification.
create function public._messages_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  v_recipient uuid;
  v_updated integer;
begin
  select * into c from public.conversations where id = new.conversation_id;
  update public.conversations set last_message_at = new.created_at where id = c.id;
  v_recipient := case when c.user_a_id = new.sender_id then c.user_b_id else c.user_a_id end;
  if not public._profile_active(v_recipient) then return new; end if;

  perform pg_advisory_xact_lock(hashtext(c.id::text || v_recipient::text));
  update public.notifications
     set created_at = new.created_at, actor_id = new.sender_id, dedupe_key = 'message:' || c.id::text || ':' || v_recipient::text || ':' || new.id::text
   where recipient_id = v_recipient and conversation_id = c.id and type = 'message' and read_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    insert into public.notifications (recipient_id, type, actor_id, conversation_id, dedupe_key, created_at)
    values (v_recipient, 'message', new.sender_id, c.id,
            'message:' || c.id::text || ':' || v_recipient::text || ':' || new.id::text, new.created_at)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger messages_after after insert on public.messages
  for each row execute function public._messages_after();

-- 18. Triggers: Rehome interest and Seed Offer interest. The block rule and the holder notification are part of the same write.
create function public._rehome_interest_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holder uuid;
begin
  select offering_holder_id into v_holder from public.rehome_cases where id = new.rehome_case_id;
  if v_holder is not null then perform public._lock_pair(new.interested_user_id, v_holder); end if;
  if v_holder is not null and public._blocked_between(new.interested_user_id, v_holder) then
    raise exception 'messaging is not available between these growers' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger rehome_interest_before before insert on public.rehome_interests
  for each row execute function public._rehome_interest_before();

create function public._rehome_interest_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.rehome_cases;
  v_a uuid;
  v_b uuid;
begin
  select * into c from public.rehome_cases where id = new.rehome_case_id;
  if public._profile_active(c.offering_holder_id) then
    insert into public.notifications (recipient_id, type, actor_id, seedling_id, rehome_case_id, dedupe_key)
    values (c.offering_holder_id, 'rehome_interest', new.interested_user_id, c.seedling_id, c.id, 'rhi:' || new.id::text)
    on conflict (dedupe_key) do nothing;
  end if;
  v_a := least(new.interested_user_id, c.offering_holder_id);
  v_b := greatest(new.interested_user_id, c.offering_holder_id);
  insert into public.conversations (user_a_id, user_b_id, context_type, rehome_case_id)
  values (v_a, v_b, 'rehome_case', c.id)
  on conflict (user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id) do nothing;
  return new;
end;
$$;

create trigger rehome_interest_after after insert on public.rehome_interests
  for each row execute function public._rehome_interest_after();

create function public._seed_offer_interest_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid;
begin
  select seller_id into v_seller from public.seed_offers where id = new.seed_offer_id;
  if v_seller is not null then perform public._lock_pair(new.interested_user_id, v_seller); end if;
  if v_seller is not null and public._blocked_between(new.interested_user_id, v_seller) then
    raise exception 'messaging is not available between these growers' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger seed_offer_interest_before before insert on public.seed_offer_interests
  for each row execute function public._seed_offer_interest_before();

create function public._seed_offer_interest_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.seed_offers;
  v_a uuid;
  v_b uuid;
begin
  select * into o from public.seed_offers where id = new.seed_offer_id;
  if public._profile_active(o.seller_id) then
    insert into public.notifications (recipient_id, type, actor_id, seed_offer_id, dedupe_key)
    values (o.seller_id, 'seed_offer_interest', new.interested_user_id, o.id, 'soi:' || new.id::text)
    on conflict (dedupe_key) do nothing;
  end if;
  v_a := least(new.interested_user_id, o.seller_id);
  v_b := greatest(new.interested_user_id, o.seller_id);
  insert into public.conversations (user_a_id, user_b_id, context_type, seed_offer_id)
  values (v_a, v_b, 'seed_offer', o.id)
  on conflict (user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id) do nothing;
  return new;
end;
$$;

create trigger seed_offer_interest_after after insert on public.seed_offer_interests
  for each row execute function public._seed_offer_interest_after();

-- 19. Triggers: Rehome events and availability. Only meaningful transitions notify: selection, sent, completed, and becoming
-- available. Decline, cancellation and internal bookkeeping do not notify.
create function public._availability_alert(p_case public.rehome_cases)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
begin
  for s in
    select a.user_id, a.locale from public.availability_subscriptions a
     where a.seedling_id = p_case.seedling_id and a.closed_at is null and a.user_id <> p_case.offering_holder_id
  loop
    if public._profile_active(s.user_id) then
      insert into public.notifications (recipient_id, type, actor_id, seedling_id, rehome_case_id, dedupe_key)
      values (s.user_id, 'availability_trigger', p_case.offering_holder_id, p_case.seedling_id, p_case.id,
              'avail:' || p_case.id::text || ':' || s.user_id::text)
      on conflict (dedupe_key) do nothing;
      insert into public.email_outbox (recipient_id, kind, seedling_id, rehome_case_id, locale, dedupe_key)
      values (s.user_id, 'availability_alert', p_case.seedling_id, p_case.id, s.locale, 'avail-email:' || p_case.id::text || ':' || s.user_id::text)
      on conflict (dedupe_key) do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function public._availability_alert(public.rehome_cases) from public, anon, authenticated;

create function public._rehome_case_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'available' then
      perform public._availability_alert(new);
    end if;
    return new;
  end if;

  -- A grower who becomes available again is announced to the subscribers, once per case and subscriber.
  if new.status = 'available' and old.status <> 'available' then
    perform public._availability_alert(new);
  end if;

  -- Selection of a recipient: the recipient is told.
  if new.chosen_recipient_id is not null and old.chosen_recipient_id is distinct from new.chosen_recipient_id
     and public._profile_active(new.chosen_recipient_id) then
    insert into public.notifications (recipient_id, type, actor_id, seedling_id, rehome_case_id, dedupe_key)
    values (new.chosen_recipient_id, 'rehome_selected', new.offering_holder_id, new.seedling_id, new.id,
            'rhsel:' || new.id::text || ':' || new.chosen_recipient_id::text)
    on conflict (dedupe_key) do nothing;
  end if;

  -- Sent: the recipient is asked to confirm receipt once it arrives.
  if new.status = 'sent' and old.status <> 'sent' and new.chosen_recipient_id is not null
     and public._profile_active(new.chosen_recipient_id) then
    insert into public.notifications (recipient_id, type, actor_id, seedling_id, rehome_case_id, dedupe_key)
    values (new.chosen_recipient_id, 'rehome_sent', new.offering_holder_id, new.seedling_id, new.id,
            'rhsent:' || new.id::text)
    on conflict (dedupe_key) do nothing;
  end if;

  -- Completion: the former holder is told the continuation is complete, and the alerts for this Seedling close.
  if new.status = 'completed' and old.status <> 'completed' then
    if public._profile_active(old.offering_holder_id) then
      insert into public.notifications (recipient_id, type, actor_id, seedling_id, rehome_case_id, dedupe_key)
      values (old.offering_holder_id, 'rehome_received', new.chosen_recipient_id, new.seedling_id, new.id,
              'rhrec:' || new.id::text)
      on conflict (dedupe_key) do nothing;
    end if;
    update public.availability_subscriptions set closed_at = now()
     where seedling_id = new.seedling_id and closed_at is null;
  end if;
  return new;
end;
$$;

create trigger rehome_case_after after insert or update on public.rehome_cases
  for each row execute function public._rehome_case_after();

-- 20. Triggers: comments and Updates. No self-notification, and deleted content does not notify.
create function public._comment_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_update_author uuid;
  v_parent_author uuid;
begin
  select author_id into v_update_author from public.updates where id = new.update_id;
  if new.parent_comment_id is not null then
    select author_id into v_parent_author from public.comments where id = new.parent_comment_id;
    if v_parent_author is not null and v_parent_author <> new.author_id and public._profile_active(v_parent_author) then
      insert into public.notifications (recipient_id, type, actor_id, update_id, comment_id, dedupe_key)
      values (v_parent_author, 'reply', new.author_id, new.update_id, new.id, 'cm:' || new.id::text || ':' || v_parent_author::text)
      on conflict (dedupe_key) do nothing;
    end if;
  elsif v_update_author is not null and v_update_author <> new.author_id and public._profile_active(v_update_author) then
    insert into public.notifications (recipient_id, type, actor_id, update_id, comment_id, dedupe_key)
    values (v_update_author, 'comment', new.author_id, new.update_id, new.id, 'cm:' || new.id::text || ':' || v_update_author::text)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger comments_after after insert on public.comments
  for each row execute function public._comment_after();

create function public._update_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
begin
  -- Only a live, public seedling's Update is announced to followers of that exact Seedling.
  for f in
    select sf.user_id from public.seedling_follows sf
     where sf.seedling_id = new.seedling_id and sf.user_id <> new.author_id
  loop
    if public._profile_active(f.user_id) then
      insert into public.notifications (recipient_id, type, actor_id, seedling_id, update_id, dedupe_key)
      values (f.user_id, 'followed_seedling_update', new.author_id, new.seedling_id, new.id,
              'upd:' || new.id::text || ':' || f.user_id::text)
      on conflict (dedupe_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

create trigger updates_after after insert on public.updates
  for each row execute function public._update_after();

-- 21. Realtime is not used. Counts for the navigation badges are read by indexed queries, through these functions.
create function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.notifications
   where recipient_id = (select auth.uid()) and read_at is null;
$$;

create function public.unread_conversation_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.conversations c
   where (c.user_a_id = (select auth.uid()) or c.user_b_id = (select auth.uid()))
     and exists (
       select 1 from public.messages m
        where m.conversation_id = c.id
          and m.sender_id <> (select auth.uid())
          and m.created_at > coalesce(
            (select r.read_at from public.conversation_reads r where r.conversation_id = c.id and r.user_id = (select auth.uid())),
            'epoch'::timestamptz)
     );
$$;

revoke all on function public.unread_notification_count() from public, anon;
revoke all on function public.unread_conversation_count() from public, anon;
grant execute on function public.unread_notification_count() to authenticated;
grant execute on function public.unread_conversation_count() to authenticated;

revoke all on function public.admin_list_reports(boolean, integer) from public, anon;
revoke all on function public.admin_remove_content(uuid, text) from public, anon;
revoke all on function public.admin_set_reported_suspension(uuid, boolean, text) from public, anon;
grant execute on function public.admin_list_reports(boolean, integer) to authenticated;
grant execute on function public.admin_remove_content(uuid, text) to authenticated;
grant execute on function public.admin_set_reported_suspension(uuid, boolean, text) to authenticated;

-- 22. Email delivery for availability alerts. The worker runs with the service role after the domain transaction has committed.
-- Claims are leased, so a crashed worker's row becomes due again, and every write names the claim token it holds, so a stale
-- worker cannot record an outcome for a row someone else now owns.
create function public.email_claim_due(p_limit integer default 10, p_lease_seconds integer default 300)
returns table (
  id uuid,
  claim_token uuid,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select o.id
      from public.email_outbox o
     where o.status = 'pending'
       and o.next_attempt_at <= now()
       and (o.claimed_until is null or o.claimed_until < now())
     order by o.next_attempt_at, o.created_at, o.id
     limit greatest(least(p_limit, 50), 1)
     for update skip locked
  )
  update public.email_outbox o
     set claim_token = gen_random_uuid(),
         claimed_until = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
         attempts = o.attempts + 1
    from due
   where o.id = due.id
  returning o.id, o.claim_token, o.attempts;
end;
$$;

-- Everything the worker needs to send one alert, and whether the alert should still be sent at all. The address is read here,
-- at send time, and is not copied into the outbox. Suppression is decided from current state, not from the event time.
create function public.email_delivery_context(p_id uuid, p_claim_token uuid)
returns table (
  recipient_email text,
  locale text,
  seedling_id uuid,
  seedling_name text,
  suppressed_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.email_outbox;
  v_email text;
  v_name text;
  v_reason text;
begin
  select * into o from public.email_outbox where id = p_id and claim_token = p_claim_token and status = 'pending';
  if not found then raise exception 'this email is not claimed by this worker' using errcode = 'P0002'; end if;

  select u.email::text into v_email from auth.users u where u.id = o.recipient_id;
  select s.working_name into v_name from public.seedlings s where s.id = o.seedling_id;

  if not exists (select 1 from public.profiles p where p.id = o.recipient_id and not p.is_suspended) then
    v_reason := 'recipient_unavailable';
  elsif not exists (
    select 1 from public.availability_subscriptions a
     where a.user_id = o.recipient_id and a.seedling_id = o.seedling_id and a.closed_at is null
  ) then
    v_reason := 'subscription_closed';
  elsif not exists (
    select 1 from public.rehome_cases c where c.id = o.rehome_case_id and c.status = 'available'
  ) then
    v_reason := 'no_longer_available';
  end if;

  return query select v_email, o.locale, o.seedling_id, v_name, v_reason;
end;
$$;

create function public.email_record_sent(p_id uuid, p_claim_token uuid, p_provider_message_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_outbox
     set status = 'sent', sent_at = now(), provider_message_id = left(p_provider_message_id, 100),
         claim_token = null, claimed_until = null, last_failure = null
   where id = p_id and claim_token = p_claim_token and status = 'pending';
  if not found then raise exception 'this email is not claimed by this worker' using errcode = 'P0002'; end if;
end;
$$;

-- A temporary failure stays pending with a backoff, up to five attempts. The last failure is stored as a code only.
create function public.email_record_retry(p_id uuid, p_claim_token uuid, p_failure text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.email_outbox;
begin
  select * into o from public.email_outbox where id = p_id and claim_token = p_claim_token and status = 'pending';
  if not found then raise exception 'this email is not claimed by this worker' using errcode = 'P0002'; end if;
  if o.attempts >= 5 then
    update public.email_outbox
       set status = 'failed', last_failure = 'attempts_exhausted', claim_token = null, claimed_until = null
     where id = p_id;
  else
    update public.email_outbox
       set last_failure = p_failure, claim_token = null, claimed_until = null,
           next_attempt_at = now() + least(make_interval(mins => power(2, o.attempts)::integer), interval '60 minutes')
     where id = p_id;
  end if;
end;
$$;

-- A permanent failure, or a suppressed alert, is final. Nothing is deleted and no account is changed.
create function public.email_record_failed(p_id uuid, p_claim_token uuid, p_failure text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_outbox
     set status = 'failed', last_failure = p_failure, claim_token = null, claimed_until = null
   where id = p_id and claim_token = p_claim_token and status = 'pending';
  if not found then raise exception 'this email is not claimed by this worker' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.email_claim_due(integer, integer) from public, anon, authenticated;
revoke all on function public.email_delivery_context(uuid, uuid) from public, anon, authenticated;
revoke all on function public.email_record_sent(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.email_record_retry(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.email_record_failed(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.email_claim_due(integer, integer) to service_role;
grant execute on function public.email_delivery_context(uuid, uuid) to service_role;
grant execute on function public.email_record_sent(uuid, uuid, text) to service_role;
grant execute on function public.email_record_retry(uuid, uuid, text) to service_role;
grant execute on function public.email_record_failed(uuid, uuid, text) to service_role;
