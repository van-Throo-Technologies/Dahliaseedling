-- Phase 10C: the former-grower label is a reserved display name. An active account may not use it, so a grower who chooses that text is never
-- mistaken for an erased account. The erasure step sets the reserved name together with a non-active state, which this rule allows.
-- Identifiers, originator attribution, holder references and provenance are not touched.

create function public._profiles_reserved_display_name()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.account_state = 'active' and lower(btrim(new.display_name)) = 'former grower' then
    raise exception 'that display name is reserved' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_reserved_display_name
  before insert or update of display_name, account_state on public.profiles
  for each row execute function public._profiles_reserved_display_name();

-- A trigger fires without the EXECUTE right, so the right is removed from every client and worker role. The email worker keeps exactly
-- its five functions.
revoke all on function public._profiles_reserved_display_name() from public, anon, authenticated, service_role;
