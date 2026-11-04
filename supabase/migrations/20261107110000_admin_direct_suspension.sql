-- Phase 10A: direct administrator suspension, without a preceding report.
--
-- Every direct suspension or restoration is an administrator action with an explicit reason and a durable admin_actions row that records
-- the acting administrator and the time. An administrator cannot suspend their own account. Suspended accounts are refused by the same
-- database rules as before (caller_can_participate and the public read filters); nothing is deleted.
--
-- admin_set_suspended stays in place as the internal primitive that the report-linked path and this function both call. It loses its
-- client grants, so the only way to change suspension is through an audited function.

create function public.admin_suspend_profile(p_profile_id uuid, p_suspended boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_profile_id = v_uid then
    raise exception 'you cannot suspend your own account' using errcode = '23514';
  end if;
  if v_reason is null or char_length(v_reason) < 10 or char_length(v_reason) > 500 then
    raise exception 'a reason of 10 to 500 characters is required' using errcode = '23514';
  end if;

  perform public.admin_set_suspended(p_profile_id, p_suspended);

  insert into public.admin_actions (admin_id, action_type, target_type, target_id, reason)
  values (
    v_uid,
    case when p_suspended then 'account_suspended' else 'account_restored' end,
    'profile',
    p_profile_id,
    v_reason
  );
end;
$$;

revoke all on function public.admin_suspend_profile(uuid, boolean, text) from public, anon;
grant execute on function public.admin_suspend_profile(uuid, boolean, text) to authenticated;

revoke execute on function public.admin_set_suspended(uuid, boolean) from anon, authenticated;
