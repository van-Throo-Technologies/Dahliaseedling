-- Phase 10B: the grower's own export document.
--
-- Several source tables (updates, comments, Rehome, Seed Offers, messages, notifications, reports) are not readable directly by the
-- authenticated role; they are read through functions. So this document is SECURITY DEFINER, and it does not rely on row-level security.
-- Its safety rests on two things, both tested in tests/db/account-export.test.ts: it takes no parameter, so the caller cannot name another
-- grower; and every source query is filtered to auth.uid(), with other people's identities replaced by a role or omitted.
--
-- Included: the caller's profile; Seedlings the caller holds or originated, with their identifiers and the provenance events that name the
-- caller (as "from" or "to", without the other holder's identity); parentage the caller created; the caller's observations and media;
-- the caller's Updates and comments and their likes; follows and saves; Rehome and Seed Offer records the caller took part in; the caller's
-- interests; the caller's messages and the messages they received, with the other participant unnamed; the caller's notifications and
-- subscriptions; a count of blocks; and the caller's own reports, without the reviewer or the reported person.
-- Not included: reports about the caller, reviewer identities, administrator records, and any other grower's profile fields.

create function public.account_export_document()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'format', 'dahliaseedling.account-export',
    'version', 1,
    'generated_at', now(),
    'profile', (
      select jsonb_build_object(
               'display_name', p.display_name, 'country_code', p.country_code,
               'region_city', p.region_city, 'bio', p.bio,
               'account_type_label', p.account_type_label, 'created_at', p.created_at,
               'account_state', p.account_state)
        from public.profiles p where p.id = (select auth.uid())
    ),
    'seedlings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'working_name', s.working_name, 'first_grown_year', s.first_grown_year,
               'visibility', s.visibility, 'created_at', s.created_at,
               'role', case when s.current_holder_id = (select auth.uid()) then 'holder' else 'originator' end,
               'identifiers', coalesce((
                  select jsonb_agg(jsonb_build_object('identifier', si.identifier, 'kind', si.kind,
                                                      'is_retired_alias', si.is_retired_alias, 'created_at', si.created_at))
                    from public.seedling_identifiers si where si.seedling_id = s.id), '[]'::jsonb),
               'provenance', coalesce((
                  select jsonb_agg(jsonb_build_object('event_type', pe.event_type, 'occurred_at', pe.occurred_at,
                      'direction', case when pe.to_holder_id = (select auth.uid()) then 'to_me' else 'from_me' end))
                    from public.provenance_events pe
                   where pe.seedling_id = s.id
                     and (pe.from_holder_id = (select auth.uid()) or pe.to_holder_id = (select auth.uid()))),
                  '[]'::jsonb))
      order by s.created_at)
      from public.seedlings s
     where s.current_holder_id = (select auth.uid()) or s.originator_id = (select auth.uid())
  ), '[]'::jsonb),
    'parentage', coalesce((
      select jsonb_agg(jsonb_build_object('child_seedling_id', sp.child_seedling_id, 'role', sp.role,
                                          'parent_seedling_id', sp.parent_seedling_id, 'is_unknown', sp.is_unknown,
                                          'notes', sp.notes, 'created_at', sp.created_at))
        from public.seedling_parentage sp where sp.created_by = (select auth.uid())), '[]'::jsonb),
    'observations', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'seedling_id', o.seedling_id, 'observed_at', o.observed_at,
               'visibility', o.visibility, 'note', o.note, 'voice_transcript', o.voice_transcript,
               'structured_data', o.structured_data, 'created_at', o.created_at, 'deleted_at', o.deleted_at,
               'media', coalesce((
                  select jsonb_agg(jsonb_build_object('media_id', om.media_id, 'sort_order', om.sort_order)
                                   order by om.sort_order)
                    from public.observation_media om where om.observation_id = o.id), '[]'::jsonb))
             order by o.observed_at)
        from public.observations o where o.author_id = (select auth.uid())), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'mime_type', m.mime_type,
               'byte_size', m.byte_size, 'width', m.width, 'height', m.height,
               'duration_seconds', m.duration_seconds, 'created_at', m.created_at, 'storage_path', m.storage_path)
             order by m.created_at)
        from public.media m where m.owner_id = (select auth.uid()) and m.deleted_at is null), '[]'::jsonb),
    'updates', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'seedling_id', u.seedling_id, 'caption', u.caption,
               'observed_at', u.observed_at, 'published_at', u.published_at, 'deleted_at', u.deleted_at)
             order by u.published_at)
        from public.updates u where u.author_id = (select auth.uid())), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'update_id', c.update_id, 'body', c.body,
               'created_at', c.created_at, 'edited_at', c.edited_at, 'deleted_at', c.deleted_at)
             order by c.created_at)
        from public.comments c where c.author_id = (select auth.uid())), '[]'::jsonb),
    'likes', coalesce((
      select jsonb_agg(jsonb_build_object('update_id', l.update_id, 'created_at', l.created_at))
        from public.likes l where l.user_id = (select auth.uid())), '[]'::jsonb),
    'follows', jsonb_build_object(
      'seedlings', coalesce((select jsonb_agg(jsonb_build_object('seedling_id', f.seedling_id, 'created_at', f.created_at))
                               from public.seedling_follows f where f.user_id = (select auth.uid())), '[]'::jsonb),
      'growers', coalesce((select jsonb_agg(jsonb_build_object('followed_profile_id', g.followed_profile_id, 'created_at', g.created_at))
                             from public.grower_follows g where g.follower_id = (select auth.uid())), '[]'::jsonb)),
    'saved_seedlings', coalesce((select jsonb_agg(jsonb_build_object('seedling_id', s.seedling_id, 'created_at', s.created_at))
                                   from public.saved_seedlings s where s.user_id = (select auth.uid())), '[]'::jsonb),
    'rehome', jsonb_build_object(
      'cases', coalesce((
         select jsonb_agg(jsonb_build_object('id', r.id, 'seedling_id', r.seedling_id,
                  'role', case when r.offering_holder_id = (select auth.uid()) then 'offering' else 'recipient' end,
                  'status', r.status, 'term', r.term, 'handover_method', r.handover_method, 'note', r.note,
                  'created_at', r.created_at, 'sent_at', r.sent_at, 'received_at', r.received_at, 'closed_at', r.closed_at))
           from public.rehome_cases r
          where r.offering_holder_id = (select auth.uid()) or r.chosen_recipient_id = (select auth.uid())), '[]'::jsonb),
      'interests', coalesce((select jsonb_agg(jsonb_build_object('rehome_case_id', i.rehome_case_id,
                  'created_at', i.created_at, 'withdrawn_at', i.withdrawn_at))
                  from public.rehome_interests i where i.interested_user_id = (select auth.uid())), '[]'::jsonb)),
    'seeds', jsonb_build_object(
      'sources', coalesce((select jsonb_agg(jsonb_build_object('id', ss.id, 'source_seedling_id', ss.source_seedling_id,
                  'source_unknown_mixed', ss.source_unknown_mixed, 'collection_year', ss.collection_year,
                  'notes', ss.notes, 'created_at', ss.created_at))
                  from public.seed_sources ss where ss.owner_id = (select auth.uid())), '[]'::jsonb),
      'offers', coalesce((select jsonb_agg(jsonb_build_object('id', so.id, 'seed_source_id', so.seed_source_id,
                  'material_type', so.material_type, 'packet_size', so.packet_size, 'seedhead_count', so.seedhead_count,
                  'mode', so.mode, 'price_text', so.price_text, 'handover_method', so.handover_method, 'note', so.note,
                  'is_active', so.is_active, 'created_at', so.created_at, 'closed_at', so.closed_at))
                  from public.seed_offers so where so.seller_id = (select auth.uid())), '[]'::jsonb),
      'interests', coalesce((select jsonb_agg(jsonb_build_object('seed_offer_id', soi.seed_offer_id,
                  'requested_quantity', soi.requested_quantity, 'created_at', soi.created_at, 'withdrawn_at', soi.withdrawn_at))
                  from public.seed_offer_interests soi where soi.interested_user_id = (select auth.uid())), '[]'::jsonb)),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('conversation_id', msg.conversation_id,
               'direction', case when msg.sender_id = (select auth.uid()) then 'sent' else 'received' end,
               'body', msg.body, 'created_at', msg.created_at,
               'photo_media_id', case when msg.sender_id = (select auth.uid()) then msg.photo_media_id end)
             order by msg.created_at)
        from public.messages msg
       where msg.conversation_id in (
         select c.id from public.conversations c
          where c.user_a_id = (select auth.uid()) or c.user_b_id = (select auth.uid()))), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object('type', n.type, 'created_at', n.created_at, 'read_at', n.read_at,
               'seedling_id', n.seedling_id, 'rehome_case_id', n.rehome_case_id, 'seed_offer_id', n.seed_offer_id)
             order by n.created_at)
        from public.notifications n where n.recipient_id = (select auth.uid())), '[]'::jsonb),
    'availability_subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('seedling_id', a.seedling_id, 'locale', a.locale,
               'created_at', a.created_at, 'closed_at', a.closed_at))
        from public.availability_subscriptions a where a.user_id = (select auth.uid())), '[]'::jsonb),
    'blocks', jsonb_build_object(
      'count', (select count(*) from public.blocks b where b.blocker_id = (select auth.uid())),
      'note', 'The identities of the people you blocked are not listed here.'),
    'reports_made', coalesce((
      select jsonb_agg(jsonb_build_object('target_type', r.target_type, 'reason', r.reason, 'status', r.status,
               'created_at', r.created_at, 'resolved_at', r.resolved_at))
        from public.reports r where r.reporter_id = (select auth.uid())), '[]'::jsonb),
    'excluded', jsonb_build_array(
      'Reports about you, and the identity of anyone who made them.',
      'Reviewer identities and administrator records.',
      'Other growers'' profile fields, private observations and private media.')
  );
$$;

revoke all on function public.account_export_document() from public, anon;
grant execute on function public.account_export_document() to authenticated;

-- Records that an export was requested, so the grower's own page can show the history. The document itself is not stored.
create function public.note_my_export()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.privacy_requests (profile_id, kind) values ((select auth.uid()), 'export');
$$;

revoke all on function public.note_my_export() from public, anon;
grant execute on function public.note_my_export() to authenticated;
