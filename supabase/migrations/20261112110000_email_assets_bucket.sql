-- The email-assets bucket holds approved images that invitation emails link to, such as the founder's photograph.
--
-- It is public, so an image in an email loads without signing in. Public reads are by object URL only: no policy
-- lets a visitor list, upload, update or delete anything. Writes come from the service role, which bypasses row
-- level security and is used only by administrators with the Supabase CLI. The private-media and public-media
-- buckets are not changed here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('email-assets', 'email-assets', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
