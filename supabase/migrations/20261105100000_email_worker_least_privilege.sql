-- Least privilege for the email delivery worker, and for objects created in the application schema.
--
-- Why this file exists. On the platform, objects created by the postgres role receive default privileges. Those defaults grant
-- TRUNCATE, REFERENCES, TRIGGER and MAINTAIN on every new table to anon, authenticated and service_role, and EXECUTE on every new
-- function to PUBLIC. TRUNCATE ignores row-level security. Before this file, the email worker's credential could truncate
-- application tables, and anon and authenticated could truncate some of them. This file removes those privileges, and it makes
-- the worker's authority explicit: the five email functions and nothing else.
--
-- What it does not change. Only the public application schema is touched. auth, storage and every Supabase-managed schema keep
-- their platform privileges. The service_role attribute BYPASSRLS is a platform property and cannot be changed here. Row-level
-- security therefore does not constrain the worker; the object and function grants below are the authorization boundary.

-- 1. Before PUBLIC loses EXECUTE, give anon and authenticated the functions they can run today, explicitly. Their effective access
-- does not change; only the route by which they have it does.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature,
           has_function_privilege('anon', p.oid, 'execute') as anon_can,
           has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    if f.anon_can then
      execute format('grant execute on function %s to anon', f.signature);
    end if;
    if f.authenticated_can then
      execute format('grant execute on function %s to authenticated', f.signature);
    end if;
  end loop;
end
$$;

-- 2. PUBLIC no longer executes application functions by default. Each function is reachable only through an explicit grant.
revoke execute on all functions in schema public from public;

-- 3. service_role executes nothing in the application schema except the five email-delivery functions, by exact signature.
revoke execute on all functions in schema public from service_role;
grant execute on function public.email_claim_due(integer, integer) to service_role;
grant execute on function public.email_delivery_context(uuid, uuid) to service_role;
grant execute on function public.email_record_sent(uuid, uuid, text) to service_role;
grant execute on function public.email_record_retry(uuid, uuid, text) to service_role;
grant execute on function public.email_record_failed(uuid, uuid, text) to service_role;

-- 4. Table privileges. service_role has none on application tables; the worker reaches the outbox only through the functions
-- above. anon and authenticated keep the explicit read and write grants their migrations name, and lose the four privileges that
-- are never needed by a client.
revoke all on all tables in schema public from service_role;
revoke truncate, references, trigger, maintain on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from service_role;

-- 5. Future objects. The default privileges of the postgres role, for tables it creates in public, grant nothing to anon,
-- authenticated or service_role. Function defaults do not apply on this platform: a new function still receives implicit EXECUTE
-- for PUBLIC. Every migration therefore revokes PUBLIC execute from each new non-trigger function explicitly, and
-- tests/supabase/conventions.test.ts enforces that rule for every migration file.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from service_role;
