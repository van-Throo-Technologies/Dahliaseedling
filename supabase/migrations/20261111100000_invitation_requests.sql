-- Founder-controlled invitation requests. A visitor asks for access without giving an address to anyone else, and no Auth account exists
-- until the founder has approved the request and sent the invitation from Supabase. Requests are read and decided only by administrators.
--
-- Clients cannot read or write the table. The public submission and the administrator actions are functions, so every rule lives in one
-- place. A repeat submission with the same client key, or a second open request for the same address, is answered exactly like a new
-- one, so the response never reveals whether an address has asked before or has an account.

create table public.invitation_requests (
  id uuid primary key default gen_random_uuid(),
  client_key uuid not null unique,
  name text not null check (char_length(name) between 2 and 80),
  country_code character(2) not null check (country_code ~ '^[A-Z]{2}$'),
  email text not null check (email = lower(email) and char_length(email) between 5 and 254),
  reason text not null check (char_length(reason) between 10 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'invited')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz
);

-- One open request per address: pending or approved.
create unique index invitation_requests_open_email
  on public.invitation_requests (email)
  where status in ('pending', 'approved');

alter table public.invitation_requests enable row level security;
revoke all on table public.invitation_requests from public, anon, authenticated, service_role;

-- Public submission. Returns 'received' for a new request and for every repeat, and 'limited' when the daily cap is reached.
-- The cap counts every submission in the last day, so it bounds a flood of spam without a per-visitor identity.
create function public.submit_invitation_request(
  p_client_key uuid,
  p_name text,
  p_country text,
  p_email text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_country text := upper(btrim(coalesce(p_country, '')));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_name) not between 2 and 80
     or v_country !~ '^[A-Z]{2}$'
     or char_length(v_email) not between 5 and 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(v_reason) not between 10 and 500 then
    raise exception 'invalid invitation request' using errcode = '22023';
  end if;

  if exists (select 1 from public.invitation_requests where client_key = p_client_key) then
    return 'received';
  end if;

  if (select count(*) from public.invitation_requests where created_at > now() - interval '1 day') >= 200 then
    return 'limited';
  end if;

  if exists (
    select 1 from public.invitation_requests where email = v_email and status in ('pending', 'approved')
  ) then
    return 'received';
  end if;

  begin
    insert into public.invitation_requests (client_key, name, country_code, email, reason)
    values (p_client_key, v_name, v_country, v_email, v_reason);
  exception when unique_violation then
    -- A concurrent identical submission won the race. The answer is the same either way.
    return 'received';
  end;

  return 'received';
end;
$$;

revoke all on function public.submit_invitation_request(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_invitation_request(uuid, text, text, text, text) to anon, authenticated;

-- Administrator reads. Every function checks is_admin() itself.
create function public.admin_list_invitation_requests(p_status text default 'pending', p_limit integer default 50)
returns table (
  request_id uuid,
  name text,
  country_code text,
  email text,
  reason text,
  status text,
  created_at timestamptz,
  decided_at timestamptz,
  invited_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not an administrator' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'approved', 'declined', 'invited') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  return query
    select r.id, r.name, r.country_code::text, r.email, r.reason, r.status, r.created_at, r.decided_at, r.invited_at
      from public.invitation_requests r
     where r.status = p_status
     order by r.created_at, r.id
     limit least(greatest(p_limit, 1), 100);
end;
$$;

-- Approves or declines a pending request. Only a pending request can be decided, so a second decision changes nothing.
create function public.admin_decide_invitation_request(p_request_id uuid, p_decision text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not an administrator' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'decline') then
    raise exception 'unknown decision' using errcode = '22023';
  end if;

  update public.invitation_requests
     set status = case when p_decision = 'approve' then 'approved' else 'declined' end,
         decided_at = now(),
         decided_by = (select auth.uid())
   where id = p_request_id and status = 'pending';

  if found then
    return case when p_decision = 'approve' then 'approved' else 'declined' end;
  end if;

  if not exists (select 1 from public.invitation_requests where id = p_request_id) then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  raise exception 'request already decided' using errcode = '55000';
end;
$$;

-- Records that the founder has sent the invitation for an approved request. It moves once from approved to invited, so the same
-- invitation cannot be recorded twice.
create function public.admin_mark_invitation_sent(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not an administrator' using errcode = '42501';
  end if;

  update public.invitation_requests
     set status = 'invited', invited_at = now()
   where id = p_request_id and status = 'approved';

  if not found then
    raise exception 'request is not approved' using errcode = '55000';
  end if;
end;
$$;

-- Removes personal details of requests that are finished (declined or invited) once they are older than the retention period. The
-- minimum keeps a mistaken short period from deleting recent records.
create function public.admin_purge_invitation_requests(p_older_than interval default interval '90 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed integer;
begin
  if not public.is_admin() then
    raise exception 'not an administrator' using errcode = '42501';
  end if;
  if p_older_than < interval '30 days' then
    raise exception 'retention below 30 days is not allowed' using errcode = '22023';
  end if;

  delete from public.invitation_requests
   where status in ('declined', 'invited')
     and coalesce(decided_at, created_at) < now() - p_older_than;
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

revoke all on function public.admin_list_invitation_requests(text, integer) from public, anon;
revoke all on function public.admin_decide_invitation_request(uuid, text) from public, anon;
revoke all on function public.admin_mark_invitation_sent(uuid) from public, anon;
revoke all on function public.admin_purge_invitation_requests(interval) from public, anon;
grant execute on function public.admin_list_invitation_requests(text, integer) to authenticated;
grant execute on function public.admin_decide_invitation_request(uuid, text) to authenticated;
grant execute on function public.admin_mark_invitation_sent(uuid) to authenticated;
grant execute on function public.admin_purge_invitation_requests(interval) to authenticated;
