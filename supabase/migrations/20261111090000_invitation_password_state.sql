-- Invitation password setup. An account that Supabase Auth invited (auth.users.invited_at is set) may choose its password once. Ordinary
-- sign-ups are never invited, so an ordinary signed-in session is refused. Completion is recorded here, and the record is what stops a
-- repeat. The record is written only by complete_invitation_password(), and only while an invitation is pending.
--
-- Nothing else is trusted: not a URL, not a client flag, and not the stored password hash, which Supabase Auth also writes when an
-- invitation is verified.

create table public.invitation_completions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  completed_at timestamptz not null default now()
);

alter table public.invitation_completions enable row level security;
revoke all on table public.invitation_completions from public, anon, authenticated, service_role;

create function public.invitation_password_pending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = (select auth.uid())
       and u.invited_at is not null
       and not exists (select 1 from public.invitation_completions c where c.user_id = u.id)
  );
$$;

-- Called after Supabase Auth has stored the chosen password. A caller with no pending invitation is refused.
create function public.complete_invitation_password()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.invitation_password_pending() then
    raise exception 'no invitation is pending for this account' using errcode = '42501';
  end if;
  insert into public.invitation_completions (user_id) values ((select auth.uid()));
end;
$$;

revoke all on function public.invitation_password_pending() from public, anon;
grant execute on function public.invitation_password_pending() to authenticated;
revoke all on function public.complete_invitation_password() from public, anon;
grant execute on function public.complete_invitation_password() to authenticated;
