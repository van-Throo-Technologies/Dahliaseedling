-- Phase 1 repair: avatars are private storage objects.
--
-- A public bucket makes every object readable by URL, forever, even after the profile is
-- suspended. Instead the bucket is private, and an object is readable only when either:
--   * the reader owns it (any state, so a suspended owner keeps their own avatar), or
--   * it is the CURRENT avatar of a profile that the reader is allowed to see.
-- "Allowed to see" reuses profiles RLS, so suspension is enforced in one place. Replaced files
-- stop matching avatar_path, so they are unreadable as soon as the profile points at the new one.
--
-- Delivery goes through the application's /avatars/[profileId] route, which checks the profile
-- on every request and never exposes storage paths or permanent URLs.

update storage.buckets set public = false where id = 'avatars';

create policy avatars_select_visible
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
          from public.profiles p
         where p.id::text = (storage.foldername(name))[1]
           and p.avatar_path = storage.objects.name
           and not p.is_suspended
      )
    )
  );
