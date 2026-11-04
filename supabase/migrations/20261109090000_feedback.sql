-- Phase 10C: in-app feedback. Private to the database: a grower submits it as themselves, and only administrators can read or change it.
--
-- The author comes from the session, never from the request. Status is changed only by an administrator through a function. A deactivated
-- or suspended account is refused by the participation gate. The page context is reduced to a path, with query strings and fragments
-- removed and identifiers replaced by a placeholder, so a sensitive URL parameter is never stored.
--
-- Submission is limited per grower per day through the same counter as the Phase 10A abuse limits. A retry with the same client key returns
-- the first submission and is not counted again.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete restrict,
  client_key uuid not null,
  category text not null check (category in ('idea', 'problem', 'experience')),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  page_context text check (page_context is null or char_length(page_context) <= 200),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, client_key)
);

create index feedback_status_created_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

-- Administrators read everything. Growers have no policy for their own rows: a grower sees no feedback after it is sent.
create policy feedback_select_admin on public.feedback
  for select to authenticated using (public.is_admin());

revoke all on table public.feedback from public, anon, authenticated, service_role;
grant select on table public.feedback to authenticated;

-- Adds the feedback action to the existing counter. The limit is provisional: ten submissions per grower per day.
alter table public.rate_counters drop constraint rate_counters_action_check;
alter table public.rate_counters add constraint rate_counters_action_check check (action in (
  'comment', 'message', 'report', 'rehome_interest', 'seed_offer_interest', 'availability_subscription', 'feedback'
));

create or replace function public._rate_limit_consume(p_action text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_unit text;
  v_window timestamptz;
  v_hits integer;
begin
  if p_user is null then return; end if;

  case p_action
    when 'comment' then v_limit := 60; v_unit := 'hour';
    when 'message' then v_limit := 120; v_unit := 'hour';
    when 'report' then v_limit := 20; v_unit := 'day';
    when 'rehome_interest' then v_limit := 30; v_unit := 'day';
    when 'seed_offer_interest' then v_limit := 50; v_unit := 'day';
    when 'availability_subscription' then v_limit := 50; v_unit := 'day';
    when 'feedback' then v_limit := 10; v_unit := 'day';
    else raise exception 'unknown rate limit action' using errcode = 'XX000';
  end case;

  v_window := date_trunc(v_unit, now());

  insert into public.rate_counters (user_id, action, window_start, hits)
  values (p_user, p_action, v_window, 1)
  on conflict (user_id, action, window_start)
  do update set hits = public.rate_counters.hits + 1
  returning hits into v_hits;

  if v_hits > v_limit then
    raise exception 'rate limit reached' using errcode = '53400';
  end if;

  delete from public.rate_counters
   where ctid in (
     select ctid from public.rate_counters where window_start < now() - interval '2 days' limit 100
   );
end;
$$;

-- Reduces a page address to a path. The query string and fragment are removed. Identifiers in the path are replaced by a placeholder.
-- Anything that is not a plain path of letters, digits and simple punctuation is dropped.
create function public._feedback_context(p_raw text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_path text;
begin
  if p_raw is null then return null; end if;
  v_path := split_part(split_part(btrim(p_raw), '?', 1), '#', 1);
  if left(v_path, 1) <> '/' then return null; end if;
  v_path := regexp_replace(v_path, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', ':id', 'g');
  if v_path !~ '^[A-Za-z0-9/_:.\-\[\]]{1,200}$' then return null; end if;
  return v_path;
end;
$$;

revoke all on function public._feedback_context(text) from public, anon, authenticated;

create function public.submit_feedback(
  p_client_key uuid,
  p_category text,
  p_message text,
  p_page_context text default null,
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended and deactivated accounts cannot send feedback' using errcode = '42501';
  end if;
  if p_client_key is null then
    raise exception 'a feedback form key is required' using errcode = '23514';
  end if;

  -- A repeated submission with the same key returns the first one, and is not counted again.
  select id into v_id from public.feedback where author_id = v_uid and client_key = p_client_key;
  if found then
    return v_id;
  end if;

  if p_category is null or p_category not in ('idea', 'problem', 'experience') then
    raise exception 'choose idea, problem or experience' using errcode = '23514';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception 'feedback must be 1 to 2000 characters' using errcode = '23514';
  end if;

  perform public._rate_limit_consume('feedback', v_uid);

  insert into public.feedback (author_id, client_key, category, message, page_context, app_version)
  values (
    v_uid,
    p_client_key,
    p_category,
    v_message,
    public._feedback_context(p_page_context),
    nullif(left(btrim(coalesce(p_app_version, '')), 40), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create function public.admin_set_feedback_status(p_feedback_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('new', 'reviewing', 'resolved') then
    raise exception 'choose new, reviewing or resolved' using errcode = '23514';
  end if;
  update public.feedback set status = p_status, updated_at = now() where id = p_feedback_id;
  if not found then
    raise exception 'that feedback could not be found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.submit_feedback(uuid, text, text, text, text) from public, anon;
grant execute on function public.submit_feedback(uuid, text, text, text, text) to authenticated;
revoke all on function public.admin_set_feedback_status(uuid, text) from public, anon;
grant execute on function public.admin_set_feedback_status(uuid, text) to authenticated;
