-- Phase 6: Continuation (Rehome). A grower who decides not to continue a Seedling makes it available. Other growers
-- express interest. The current grower chooses one recipient. The holder changes only when that recipient confirms
-- receipt, in the same transaction that appends the provenance event.
--
-- Three concepts stay separate: the Seedling (one persistent UUID), its originator (immutable attribution), and its
-- current holder (who has continuation control, which changes only here). A case is the process. An interest is a
-- request, never a comment. Clients have no write grants on either table: every state change is a function.
--
-- Case states: available -> arranged (one recipient chosen) -> sent (optional) -> completed (receipt confirmed).
-- Any active state may become cancelled. arranged or sent may return to available (reopen).

-- 1. Provenance records the holder change.
alter table public.provenance_events drop constraint if exists provenance_events_event_type_check;
alter table public.provenance_events
  add constraint provenance_events_event_type_check
  check (event_type in ('originated', 'continuation_received'));

-- 2. Cases. One active case per Seedling, enforced by a partial unique index.
create table public.rehome_cases (
  id uuid primary key default gen_random_uuid(),
  seedling_id uuid not null references public.seedlings (id) on delete restrict,
  offering_holder_id uuid not null references public.profiles (id) on delete restrict,
  chosen_recipient_id uuid references public.profiles (id) on delete restrict,
  status text not null default 'available'
    check (status in ('available', 'arranged', 'sent', 'completed', 'cancelled')),
  term text check (term in ('donate', 'sell', 'trade')),
  price_text text check (price_text is null or char_length(btrim(price_text)) between 1 and 80),
  handover_method text check (handover_method in ('pickup', 'shipping', 'both')),
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  received_at timestamptz,
  closed_at timestamptz,
  constraint rehome_price_only_for_sell check (price_text is null or term = 'sell'),
  constraint rehome_recipient_not_holder check (chosen_recipient_id is null or chosen_recipient_id <> offering_holder_id),
  constraint rehome_no_recipient_while_available check (status <> 'available' or chosen_recipient_id is null),
  constraint rehome_recipient_when_arranged
    check (status not in ('arranged', 'sent', 'completed') or chosen_recipient_id is not null)
);

create unique index rehome_one_active_per_seedling
  on public.rehome_cases (seedling_id)
  where status in ('available', 'arranged', 'sent');
create index rehome_cases_available_idx on public.rehome_cases (seedling_id) where status = 'available';
create index rehome_cases_holder_idx on public.rehome_cases (offering_holder_id);
create index rehome_cases_recipient_idx on public.rehome_cases (chosen_recipient_id) where chosen_recipient_id is not null;

-- 2b. Provenance link. A continuation_received event names the exact case that caused it. Other events, including
-- the original Seedling origin, keep a null reference. Only one transfer event can name a given case.
alter table public.provenance_events
  add column rehome_case_id uuid references public.rehome_cases (id) on delete restrict;
alter table public.provenance_events
  add constraint provenance_rehome_case_matches_event
  check ((event_type = 'continuation_received') = (rehome_case_id is not null));
create unique index provenance_one_transfer_per_case
  on public.provenance_events (rehome_case_id) where event_type = 'continuation_received';

-- Readers get the factual provenance columns only. The link to a continuation case is domain integrity, not a public
-- field, so it is not granted to anon or authenticated.
revoke select on table public.provenance_events from anon, authenticated;
grant select (id, seedling_id, event_type, from_holder_id, to_holder_id, occurred_at, metadata)
  on table public.provenance_events to anon, authenticated;

-- 3. Interests. A request by a grower who may continue the Seedling. Withdrawing sets withdrawn_at; the row stays.
create table public.rehome_interests (
  id uuid primary key default gen_random_uuid(),
  rehome_case_id uuid not null references public.rehome_cases (id) on delete restrict,
  interested_user_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create unique index rehome_interests_one_active
  on public.rehome_interests (rehome_case_id, interested_user_id)
  where withdrawn_at is null;
create index rehome_interests_user_idx on public.rehome_interests (interested_user_id);

-- 4. Row-level security. Visitors see only an available case of a public Seedling, and only its public columns.
-- Parties see their own case; the holder sees the interests on it. Notes and recipients of pending cases are read
-- through rehome_panel, which applies the same rules in one place.
alter table public.rehome_cases enable row level security;
alter table public.rehome_interests enable row level security;

create policy rehome_cases_select_public on public.rehome_cases for select
  to anon, authenticated
  using (
    status = 'available'
    and exists (
      select 1
        from public.seedlings s
        join public.profiles h on h.id = s.current_holder_id
       where s.id = rehome_cases.seedling_id
         and s.visibility = 'public'
         and s.deleted_at is null
         and not h.is_suspended
    )
  );

create policy rehome_cases_select_party on public.rehome_cases for select
  to authenticated
  using (offering_holder_id = (select auth.uid()) or chosen_recipient_id = (select auth.uid()));

grant select (id, seedling_id, offering_holder_id, chosen_recipient_id, status, term, price_text, handover_method,
              created_at, updated_at, sent_at, received_at, closed_at)
  on table public.rehome_cases to anon, authenticated;

create policy rehome_interests_select_own on public.rehome_interests for select
  to authenticated
  using (interested_user_id = (select auth.uid()));

create policy rehome_interests_select_holder on public.rehome_interests for select
  to authenticated
  using (
    exists (
      select 1 from public.rehome_cases c
       where c.id = rehome_interests.rehome_case_id
         and c.offering_holder_id = (select auth.uid())
    )
  );

grant select (id, rehome_case_id, interested_user_id, created_at, withdrawn_at)
  on table public.rehome_interests to authenticated;

-- 5. The panel: what the signed-in or anonymous reader may see about one Seedling's continuation. Returns null when
-- the reader may not see the Seedling at all, so a private Seedling is indistinguishable from a missing one.
create function public.rehome_panel(p_seedling_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  s record;
  c public.rehome_cases;
  v_role text := 'visitor';
  v_interest boolean := false;
  v_interests jsonb := '[]'::jsonb;
  v_case jsonb := null;
  v_has_case boolean := false;
begin
  select sd.id, sd.visibility, sd.current_holder_id, sd.originator_id, sd.deleted_at,
         h.is_suspended as holder_suspended
    into s
    from public.seedlings sd
    join public.profiles h on h.id = sd.current_holder_id
   where sd.id = p_seedling_id;
  if not found or s.deleted_at is not null then
    return null;
  end if;
  if not ((s.visibility = 'public' and not s.holder_suspended)
          or s.current_holder_id = v_uid or s.originator_id = v_uid) then
    return null;
  end if;

  select * into c from public.rehome_cases rc
   where rc.seedling_id = p_seedling_id and rc.status in ('available', 'arranged', 'sent');
  v_has_case := found;

  -- A holder with nothing active still sees the way to start, so the role is set before the case branch.
  if v_uid is not null and s.current_holder_id = v_uid then
    v_role := 'holder';
  end if;

  if v_has_case then
    if c.offering_holder_id = v_uid then
      v_role := 'holder';
    elsif c.chosen_recipient_id = v_uid then
      v_role := 'recipient';
    elsif v_uid is not null and exists (
      select 1 from public.rehome_interests i
       where i.rehome_case_id = c.id and i.interested_user_id = v_uid and i.withdrawn_at is null
    ) then
      v_role := 'interested';
    elsif v_uid is not null then
      v_role := 'member';
    end if;

    v_interest := v_uid is not null and exists (
      select 1 from public.rehome_interests i
       where i.rehome_case_id = c.id and i.interested_user_id = v_uid and i.withdrawn_at is null
    );

    -- Visitors and other members see only an available case, and only its terms.
    if v_role in ('holder', 'recipient', 'interested') or c.status = 'available' then
      v_case := jsonb_build_object(
        'id', c.id,
        'status', c.status,
        'term', c.term,
        'priceText', c.price_text,
        'handover', c.handover_method,
        'note', case when v_role in ('holder', 'recipient', 'interested') then c.note end,
        'sentAt', c.sent_at,
        'chosenRecipientId', case when v_role in ('holder', 'recipient') then c.chosen_recipient_id end
      );
    end if;

    if v_role = 'holder' then
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', i.id,
               'userId', i.interested_user_id,
               'displayName', p.display_name,
               'createdAt', i.created_at,
               'active', i.withdrawn_at is null
             ) order by i.created_at, i.id), '[]'::jsonb)
        into v_interests
        from public.rehome_interests i
        join public.profiles p on p.id = i.interested_user_id
       where i.rehome_case_id = c.id
         and i.withdrawn_at is null;
    end if;
  end if;

  return jsonb_build_object(
    'role', v_role,
    'signedIn', v_uid is not null,
    'case', v_case,
    'hasInterest', v_interest,
    'canExpressInterest', v_has_case and c.status = 'available' and v_uid is not null
      and v_role not in ('holder', 'recipient') and not v_interest and s.visibility = 'public',
    'interests', v_interests
  );
end;
$$;

revoke all on function public.rehome_panel(uuid) from public;
grant execute on function public.rehome_panel(uuid) to anon, authenticated;

-- 6. Start: the current holder makes a Seedling available. A private Seedling becomes public only when the holder
-- says so in the same call, so the public representation is always a deliberate decision.
create function public.start_rehome(
  p_seedling_id uuid,
  p_term text,
  p_price_text text default null,
  p_handover text default null,
  p_note text default null,
  p_make_public boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  s public.seedlings;
  v_case uuid;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change a seedling' using errcode = '42501';
  end if;
  select * into s from public.seedlings where id = p_seedling_id and deleted_at is null for update;
  if not found or s.current_holder_id <> v_uid then
    raise exception 'only the current grower can make this seedling available' using errcode = '42501';
  end if;
  if p_term is null or p_term not in ('donate', 'sell', 'trade') then
    raise exception 'choose donate, sell or trade' using errcode = '23514';
  end if;
  if p_handover is not null and p_handover not in ('pickup', 'shipping', 'both') then
    raise exception 'choose pickup, shipping or both' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_price_text, '')), '') is not null and p_term <> 'sell' then
    raise exception 'a price belongs to a sale' using errcode = '23514';
  end if;
  if char_length(coalesce(p_note, '')) > 280 then
    raise exception 'notes are 280 characters or fewer' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.rehome_cases rc
     where rc.seedling_id = p_seedling_id and rc.status in ('available', 'arranged', 'sent')
  ) then
    raise exception 'this seedling is already available' using errcode = '23505';
  end if;
  if s.visibility = 'private' then
    if not p_make_public then
      raise exception 'make the seedling public before it is available' using errcode = '23514';
    end if;
    update public.seedlings set visibility = 'public', updated_at = now() where id = p_seedling_id;
  end if;

  insert into public.rehome_cases (seedling_id, offering_holder_id, status, term, price_text, handover_method, note)
  values (p_seedling_id, v_uid, 'available', p_term, nullif(btrim(coalesce(p_price_text, '')), ''),
          p_handover, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_case;
  return v_case;
end;
$$;

-- 7. Interest: a signed-in grower other than the holder asks to continue an available Seedling. Idempotent.
create function public.express_rehome_interest(p_case_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.rehome_cases;
  v_interest uuid;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot express interest' using errcode = '42501';
  end if;
  select * into c from public.rehome_cases where id = p_case_id for share;
  if not found then
    raise exception 'that continuation could not be found' using errcode = 'P0002';
  end if;
  if c.offering_holder_id = v_uid then
    raise exception 'the current grower cannot express interest in their own seedling' using errcode = '42501';
  end if;
  if c.status <> 'available' then
    raise exception 'this seedling is not accepting interest now' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.seedlings where id = c.seedling_id and visibility = 'public' and deleted_at is null) then
    raise exception 'that continuation could not be found' using errcode = 'P0002';
  end if;

  insert into public.rehome_interests (rehome_case_id, interested_user_id)
  values (c.id, v_uid)
  on conflict (rehome_case_id, interested_user_id) where withdrawn_at is null do nothing;

  select id into v_interest from public.rehome_interests
   where rehome_case_id = c.id and interested_user_id = v_uid and withdrawn_at is null;
  return v_interest;
end;
$$;

-- 8. Withdraw interest, while the case is still available.
create function public.withdraw_rehome_interest(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.rehome_cases;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  select * into c from public.rehome_cases where id = p_case_id for share;
  if not found or c.status <> 'available' then
    raise exception 'this interest can no longer be withdrawn' using errcode = 'P0001';
  end if;
  update public.rehome_interests set withdrawn_at = now()
   where rehome_case_id = c.id and interested_user_id = v_uid and withdrawn_at is null;
  if not found then
    raise exception 'there is no active interest to withdraw' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

-- 9. The holder chooses exactly one recipient. The case row is locked, so two choices cannot both succeed.
create function public.choose_rehome_recipient(p_case_id uuid, p_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.rehome_cases;
  s public.seedlings;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot choose a recipient' using errcode = '42501';
  end if;
  select * into c from public.rehome_cases where id = p_case_id for update;
  if not found then
    raise exception 'that continuation could not be found' using errcode = 'P0002';
  end if;
  select * into s from public.seedlings where id = c.seedling_id for share;
  if c.offering_holder_id <> v_uid or s.current_holder_id <> v_uid then
    raise exception 'only the current grower can choose a recipient' using errcode = '42501';
  end if;
  if p_recipient_id = v_uid then
    raise exception 'the current grower cannot choose themselves' using errcode = '23514';
  end if;
  if c.status <> 'available' then
    raise exception 'a recipient is already chosen for this seedling' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.rehome_interests i
     where i.rehome_case_id = c.id and i.interested_user_id = p_recipient_id and i.withdrawn_at is null
  ) then
    raise exception 'only a grower who has expressed interest can be chosen' using errcode = 'P0001';
  end if;

  update public.rehome_cases
     set chosen_recipient_id = p_recipient_id, status = 'arranged', updated_at = now()
   where id = c.id;
  return c.id;
end;
$$;

-- 10. The holder records that the material was sent. This does not change the holder.
create function public.mark_rehome_sent(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.rehome_cases;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change a continuation' using errcode = '42501';
  end if;
  select * into c from public.rehome_cases where id = p_case_id for update;
  if not found or c.offering_holder_id <> v_uid then
    raise exception 'only the current grower can change this continuation' using errcode = '42501';
  end if;
  if c.status <> 'arranged' then
    raise exception 'only an arranged continuation can be marked sent' using errcode = 'P0001';
  end if;
  update public.rehome_cases set status = 'sent', sent_at = now(), updated_at = now() where id = c.id;
  return true;
end;
$$;

-- 11. Reopen a failed arrangement: back to available, with no recipient chosen.
create function public.reopen_rehome(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.rehome_cases;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change a continuation' using errcode = '42501';
  end if;
  select * into c from public.rehome_cases where id = p_case_id for update;
  if not found or c.offering_holder_id <> v_uid then
    raise exception 'only the current grower can change this continuation' using errcode = '42501';
  end if;
  if c.status not in ('arranged', 'sent') then
    raise exception 'only an arranged or sent continuation can be reopened' using errcode = 'P0001';
  end if;
  update public.rehome_cases
     set status = 'available', chosen_recipient_id = null, sent_at = null, updated_at = now()
   where id = c.id;
  return true;
end;
$$;

-- 12. Withdraw availability. No holder change is recorded. The Seedling stays with its current grower.
create function public.cancel_rehome(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.rehome_cases;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change a continuation' using errcode = '42501';
  end if;
  select * into c from public.rehome_cases where id = p_case_id for update;
  if not found or c.offering_holder_id <> v_uid then
    raise exception 'only the current grower can withdraw availability' using errcode = '42501';
  end if;
  if c.status not in ('available', 'arranged', 'sent') then
    raise exception 'this continuation is already closed' using errcode = 'P0001';
  end if;
  update public.rehome_cases
     set status = 'cancelled', closed_at = now(), updated_at = now()
   where id = c.id;
  return true;
end;
$$;

-- 13. Receipt. Only the selected recipient can confirm, and only once. The holder, the originator, and any other
-- interested grower are refused. The holder change, provenance event, case completion and withdrawal of other
-- interests happen together, or not at all. If the holder changed unexpectedly, the case is cancelled rather than
-- transferred, so it cannot move the Seedling from a stale position.
create function public.confirm_rehome_received(p_case_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.rehome_cases;
  s public.seedlings;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot confirm a continuation' using errcode = '42501';
  end if;
  select * into c from public.rehome_cases where id = p_case_id for update;
  if not found then
    raise exception 'that continuation could not be found' using errcode = 'P0002';
  end if;
  if c.chosen_recipient_id is distinct from v_uid then
    raise exception 'only the selected recipient can confirm receipt' using errcode = '42501';
  end if;
  if c.status = 'completed' then
    return 'already_completed';
  end if;
  if c.status not in ('arranged', 'sent') then
    raise exception 'this continuation is not waiting for receipt' using errcode = 'P0001';
  end if;

  select * into s from public.seedlings where id = c.seedling_id for update;
  if s.current_holder_id <> c.offering_holder_id then
    update public.rehome_cases set status = 'cancelled', closed_at = now(), updated_at = now() where id = c.id;
    return 'stale';
  end if;

  perform set_config('dahlia.holder_transfer', 'confirmed', true);
  update public.seedlings set current_holder_id = v_uid, updated_at = now() where id = s.id;
  insert into public.provenance_events (seedling_id, event_type, from_holder_id, to_holder_id, rehome_case_id)
  values (s.id, 'continuation_received', c.offering_holder_id, v_uid, c.id);
  update public.rehome_cases
     set status = 'completed', received_at = now(), closed_at = now(), updated_at = now()
   where id = c.id;
  update public.rehome_interests set withdrawn_at = now()
   where rehome_case_id = c.id and withdrawn_at is null;
  return 'completed';
end;
$$;

revoke all on function public.start_rehome(uuid, text, text, text, text, boolean) from public, anon;
revoke all on function public.express_rehome_interest(uuid) from public, anon;
revoke all on function public.withdraw_rehome_interest(uuid) from public, anon;
revoke all on function public.choose_rehome_recipient(uuid, uuid) from public, anon;
revoke all on function public.mark_rehome_sent(uuid) from public, anon;
revoke all on function public.reopen_rehome(uuid) from public, anon;
revoke all on function public.cancel_rehome(uuid) from public, anon;
revoke all on function public.confirm_rehome_received(uuid) from public, anon;

grant execute on function public.start_rehome(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.express_rehome_interest(uuid) to authenticated;
grant execute on function public.withdraw_rehome_interest(uuid) to authenticated;
grant execute on function public.choose_rehome_recipient(uuid, uuid) to authenticated;
grant execute on function public.mark_rehome_sent(uuid) to authenticated;
grant execute on function public.reopen_rehome(uuid) to authenticated;
grant execute on function public.cancel_rehome(uuid) to authenticated;
grant execute on function public.confirm_rehome_received(uuid) to authenticated;

-- 13b. Recipient decline. Only the selected recipient, only while the arrangement is arranged (not sent, never after
-- receipt). It returns the case to available, clears the recipient, and leaves the holder and provenance unchanged.
-- The recipient's own interest is withdrawn but kept, so the history of who was interested stays intact.
create function public.decline_rehome(p_case_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c public.rehome_cases;
  s public.seedlings;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = '42501';
  end if;
  if not public.caller_can_participate() then
    raise exception 'suspended accounts cannot change a continuation' using errcode = '42501';
  end if;
  select * into c from public.rehome_cases where id = p_case_id for update;
  if not found then
    raise exception 'that continuation could not be found' using errcode = 'P0002';
  end if;
  select * into s from public.seedlings where id = c.seedling_id for update;
  if c.chosen_recipient_id is distinct from v_uid then
    raise exception 'only the selected recipient can decline' using errcode = '42501';
  end if;
  if c.status <> 'arranged' then
    raise exception 'only an arranged continuation can be declined' using errcode = 'P0001';
  end if;
  if s.current_holder_id <> c.offering_holder_id then
    raise exception 'this continuation no longer matches the current grower' using errcode = 'P0001';
  end if;

  update public.rehome_cases
     set status = 'available', chosen_recipient_id = null, sent_at = null, updated_at = now()
   where id = c.id;
  update public.rehome_interests
     set withdrawn_at = now()
   where rehome_case_id = c.id and interested_user_id = v_uid and withdrawn_at is null;
  return 'declined';
end;
$$;

revoke all on function public.decline_rehome(uuid) from public, anon;
grant execute on function public.decline_rehome(uuid) to authenticated;

-- 14. Search: an availability filter. It is a canonical state check, never a display label. Only an available case of
-- a public Seedling matches; arranged, sent, completed and cancelled cases never do. The function keeps its
-- Phase 5 contract, with one optional parameter at the end.
drop function public.search_seedlings(text, char, integer, smallint, text, uuid);

create function public.search_seedlings(
  p_query text,
  p_country char(2) default null,
  p_limit integer default 12,
  p_after_tier smallint default null,
  p_after_text text default null,
  p_after_id uuid default null,
  p_available boolean default false
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
  -- Public Seedlings whose current holder is not suspended, optionally in one country and, when asked, only
  -- those with an available continuation.
  select s.id, s.working_name, s.current_holder_id, h.display_name, h.country_code
    from public.seedlings s
    join public.profiles h on h.id = s.current_holder_id
   where s.visibility = 'public'
     and s.deleted_at is null
     and not h.is_suspended
     and (p_country is null or h.country_code = p_country)
     and (not p_available or exists (
       select 1 from public.rehome_cases rc
        where rc.seedling_id = s.id and rc.status = 'available'
     ))
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
  select sp.child_seedling_id as id, 5::smallint as tier, 'parent_cultivar'::text as reason, null::text as matched
    from public.seedling_parentage sp
    join matched_cultivars mc on mc.id = sp.parent_cultivar_id
    join visible v on v.id = sp.child_seedling_id
  union all
  select sp.child_seedling_id, 5::smallint, 'parent_seedling', null
    from public.seedling_parentage sp
    join (select distinct d.id as parent_id from direct_hits d) parent on parent.parent_id = sp.parent_seedling_id
    join visible v on v.id = sp.child_seedling_id
),
filter_hits as (
  -- No query: the filters alone (country, availability) list the matching public Seedlings.
  select v.id, 6::smallint as tier,
         (case when p_available then 'available' else 'country' end)::text as reason,
         null::text as matched
    from query q
    cross join visible v
   where q.text_q is null
     and q.ident_q is null
     and (p_country is not null or p_available)
),
all_hits as (
  select * from direct_hits
  union all
  select * from parent_hits
  union all
  select * from filter_hits
),
best as (
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

revoke all on function public.search_seedlings(text, char, integer, smallint, text, uuid, boolean) from public;
grant execute on function public.search_seedlings(text, char, integer, smallint, text, uuid, boolean) to anon, authenticated;

-- The availability state must be readable by Search, which runs as the visitor. Only the two columns it needs are
-- granted, and the policy above limits rows to available cases of public Seedlings.
grant select (seedling_id, status) on table public.rehome_cases to anon, authenticated;
