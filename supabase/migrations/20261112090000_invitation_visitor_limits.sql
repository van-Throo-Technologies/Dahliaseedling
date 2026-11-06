-- Per-visitor limit for invitation requests, an administrator activity summary, and a rollout-safe submission path.
--
-- A visitor is counted by a keyed hash of their network address. The server computes that hash from the connecting address, which the
-- platform sets, using a secret salt. The database never sees a raw address.
--
-- Trust. The database cannot see a visitor's address, so it cannot decide who a caller is. A caller who could choose the visitor hash
-- could choose a fresh one for every request, which would defeat the limit. Therefore the database accepts a submission only with a proof:
-- an HMAC over the visitor hash, the allowance and the client key, made with a key that only the server and the database hold. The
-- allowance is part of the proof too, so a caller cannot raise it. A caller without the key cannot produce a valid proof, and the function
-- refuses. If no key is configured, every submission is refused.
--
-- The key lives in the private schema, which the API does not expose. Clients have no privilege on it.
--
-- Rollout compatibility. The deployed application calls the five-argument function, which knows no visitor and holds no key. It keeps
-- working through a wrapper that stores requests under one shared hourly allowance of 100. That wrapper is the only route that does not
-- require a proof, so it stays open only for the rollout. Its refusals are raised as errors, because the deployed application treats only
-- an error as a failure. The error rolls back the counter increment in the same transaction, so the allowance still holds but a legacy
-- refusal is not counted on the activity page. A later migration removes the wrapper once no deployed application calls it.
--
-- Clients cannot read or write the counter table, the key or the private functions. The activity summary returns counts only, and it
-- checks is_admin() itself.

create schema private;
revoke all on schema private from public, anon, authenticated;

create table private.invitation_intake_keys (
  id smallint primary key check (id = 1),
  secret text not null check (char_length(secret) >= 32)
);
alter table private.invitation_intake_keys enable row level security;
revoke all on table private.invitation_intake_keys from public, anon, authenticated, service_role;

create table public.invitation_visitor_buckets (
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  submissions integer not null default 0 check (submissions >= 0),
  refused integer not null default 0 check (refused >= 0),
  primary key (visitor_hash, window_start)
);

alter table public.invitation_visitor_buckets enable row level security;
revoke all on table public.invitation_visitor_buckets from public, anon, authenticated, service_role;

-- The shared validation, counting and storage. It trusts its visitor hash and allowance, so only the two functions below may call it.
create function private.accept_invitation_request(
  p_client_key uuid,
  p_name text,
  p_country text,
  p_email text,
  p_reason text,
  p_visitor_hash text,
  p_visitor_limit integer
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
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{64}$'
     or p_visitor_limit is null or p_visitor_limit not between 1 and 100 then
    raise exception 'invalid visitor limit' using errcode = '22023';
  end if;

  if char_length(v_name) not between 2 and 80
     or v_country !~ '^[A-Z]{2}$'
     or char_length(v_email) not between 5 and 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(v_reason) not between 10 and 500 then
    raise exception 'invalid invitation request' using errcode = '22023';
  end if;

  -- Count every attempt in this hour, then refuse once the allowance is passed.
  insert into public.invitation_visitor_buckets (visitor_hash, window_start)
  values (p_visitor_hash, v_window)
  on conflict do nothing;

  update public.invitation_visitor_buckets
     set submissions = submissions + 1
   where visitor_hash = p_visitor_hash and window_start = v_window
   returning submissions into v_count;

  if v_count > p_visitor_limit then
    update public.invitation_visitor_buckets
       set refused = refused + 1
     where visitor_hash = p_visitor_hash and window_start = v_window;
    return 'visitor_limited';
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

revoke all on function private.accept_invitation_request(uuid, text, text, text, text, text, integer) from public, anon, authenticated;

-- The submission the new application makes. The server signs the visitor hash, the allowance and the client key, and the database
-- verifies the signature before anything else. Nothing else in the request can change the visitor or the allowance.
create function public.submit_invitation_request(
  p_client_key uuid,
  p_name text,
  p_country text,
  p_email text,
  p_reason text,
  p_visitor_hash text,
  p_visitor_limit integer,
  p_proof text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select secret into v_secret from private.invitation_intake_keys where id = 1;
  if v_secret is null then
    raise exception 'invitation intake is not configured' using errcode = '55000';
  end if;

  if p_proof is null
     or p_visitor_hash is null or p_visitor_limit is null or p_client_key is null
     or p_proof <> encode(
       extensions.hmac(p_visitor_hash || '|' || p_visitor_limit::text || '|' || p_client_key::text, v_secret, 'sha256'),
       'hex'
     ) then
    raise exception 'invalid intake proof' using errcode = '42501';
  end if;

  return private.accept_invitation_request(
    p_client_key, p_name, p_country, p_email, p_reason, p_visitor_hash, p_visitor_limit
  );
end;
$$;

revoke all on function public.submit_invitation_request(uuid, text, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.submit_invitation_request(uuid, text, text, text, text, text, integer, text) to anon, authenticated;

-- Rollout wrapper for the deployed five-argument signature. Requests share one bucket, kept per hour, with a cap of 100 for all legacy
-- submissions together. A refusal of any kind is raised as an error.
create or replace function public.submit_invitation_request(
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
  v_result text;
begin
  v_result := private.accept_invitation_request(
    p_client_key,
    p_name,
    p_country,
    p_email,
    p_reason,
    encode(sha256(convert_to('legacy-submissions', 'UTF8')), 'hex'),
    100
  );
  if v_result <> 'received' then
    raise exception 'invitation request not accepted: %', v_result using errcode = 'P0001';
  end if;
  return v_result;
end;
$$;

revoke all on function public.submit_invitation_request(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_invitation_request(uuid, text, text, text, text) to anon, authenticated;

-- Counts for the review page: requests, decisions and refusals in the last day. No names, addresses or reasons.
create function public.admin_invitation_activity()
returns table (
  requests_24h bigint,
  pending bigint,
  approved bigint,
  declined bigint,
  invited bigint,
  refusals_24h bigint,
  visitors_24h bigint
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

  return query
    select
      (select count(*) from public.invitation_requests r where r.created_at > now() - interval '1 day'),
      (select count(*) from public.invitation_requests r where r.status = 'pending'),
      (select count(*) from public.invitation_requests r where r.status = 'approved'),
      (select count(*) from public.invitation_requests r where r.status = 'declined'),
      (select count(*) from public.invitation_requests r where r.status = 'invited'),
      (select coalesce(sum(b.refused), 0) from public.invitation_visitor_buckets b where b.window_start > now() - interval '1 day'),
      (select count(distinct b.visitor_hash) from public.invitation_visitor_buckets b where b.window_start > now() - interval '1 day');
end;
$$;

-- Retention: finished requests and visitor counters are removed. The earlier minimum still applies to requests.
create or replace function public.admin_purge_invitation_requests(p_older_than interval default interval '90 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed integer;
  v_counters integer;
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

  delete from public.invitation_visitor_buckets where window_start < now() - interval '2 days';
  get diagnostics v_counters = row_count;

  return v_removed;
end;
$$;

revoke all on function public.admin_invitation_activity() from public, anon;
grant execute on function public.admin_invitation_activity() to authenticated;
