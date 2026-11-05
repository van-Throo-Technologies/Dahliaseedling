-- LOCAL ONLY. This reproduces the default privileges that Supabase's hosted platform gives objects created by the postgres role, so the
-- local database behaves like a hosted project. The migration 20261110090000_privilege_model_correction.sql removes these rights from the
-- public schema, and the database tests must run with this file present.
--
-- Never pass --include-roles to `supabase db push` for a hosted project: that would restore the rights the correction removes.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
