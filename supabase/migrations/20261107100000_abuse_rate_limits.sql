-- Phase 10A: bounded abuse prevention at the mutation boundary.
--
-- Each limited action has a BEFORE INSERT trigger on its table. The trigger counts the insert against the row's actor in a fixed window
-- and refuses it once the window's limit is reached. Triggers run for every insert, whichever RPC, server action or direct statement
-- made it, so the limit is not a UI convention. The counter increment and the insert share one transaction, so a refused insert also
-- leaves no count behind.
--
-- Defaults are provisional pre-launch values. They are generous on purpose: they stop scripted bursts and leave ordinary use alone.
--   comment                  60 per user per hour
--   message                 120 per sender per hour
--   report                   20 per reporter per day
--   rehome_interest          30 per grower per day
--   seed_offer_interest      50 per grower per day
--   availability_subscription 50 per grower per day
-- They are documented in docs/operations.md and should be reviewed once real usage exists.
--
-- Counter growth is bounded: each action is one row per user, action and window, and each consume deletes up to 100 rows older than
-- two days, so the table stays near the number of active users times actions times two days.

create table public.rate_counters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in (
    'comment', 'message', 'report', 'rehome_interest', 'seed_offer_interest', 'availability_subscription'
  )),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (user_id, action, window_start)
);

create index rate_counters_window_idx on public.rate_counters (window_start);

alter table public.rate_counters enable row level security;
revoke all on table public.rate_counters from public, anon, authenticated, service_role;

-- The counter is written only by the trigger functions below. Clients have no policy and no grant, so they cannot read or change it.
create function public._rate_limit_consume(p_action text, p_user uuid)
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

revoke all on function public._rate_limit_consume(text, uuid) from public, anon, authenticated;

create function public._rate_limit_comments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._rate_limit_consume('comment', new.author_id);
  return new;
end;
$$;

create function public._rate_limit_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._rate_limit_consume('message', new.sender_id);
  return new;
end;
$$;

create function public._rate_limit_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._rate_limit_consume('report', new.reporter_id);
  return new;
end;
$$;

create function public._rate_limit_rehome_interests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._rate_limit_consume('rehome_interest', new.interested_user_id);
  return new;
end;
$$;

create function public._rate_limit_seed_offer_interests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._rate_limit_consume('seed_offer_interest', new.interested_user_id);
  return new;
end;
$$;

create function public._rate_limit_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._rate_limit_consume('availability_subscription', new.user_id);
  return new;
end;
$$;

revoke all on function public._rate_limit_comments() from public, anon, authenticated;
revoke all on function public._rate_limit_messages() from public, anon, authenticated;
revoke all on function public._rate_limit_reports() from public, anon, authenticated;
revoke all on function public._rate_limit_rehome_interests() from public, anon, authenticated;
revoke all on function public._rate_limit_seed_offer_interests() from public, anon, authenticated;
revoke all on function public._rate_limit_availability() from public, anon, authenticated;

create trigger comments_rate_limit before insert on public.comments
  for each row execute function public._rate_limit_comments();
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public._rate_limit_messages();
create trigger reports_rate_limit before insert on public.reports
  for each row execute function public._rate_limit_reports();
create trigger rehome_interests_rate_limit before insert on public.rehome_interests
  for each row execute function public._rate_limit_rehome_interests();
create trigger seed_offer_interests_rate_limit before insert on public.seed_offer_interests
  for each row execute function public._rate_limit_seed_offer_interests();
create trigger availability_subscriptions_rate_limit before insert on public.availability_subscriptions
  for each row execute function public._rate_limit_availability();
