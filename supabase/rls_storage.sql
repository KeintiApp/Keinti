-- Supabase Storage RLS policies for Keinti
--
-- Buckets
-- - keinti_media: stores avatars, group images, post media, channel media, and account selfies.
--
-- IMPORTANT
-- - All policies below filter by `bucket_id = 'keinti_media'`.
-- - `bucket_id` must match your Storage bucket name EXACTLY (case-sensitive).
--   If your bucket is named `KEINTI_MEDIA` (underscore / uppercase), then replace
--   every occurrence of 'keinti_media' in this file with 'KEINTI_MEDIA'.
-- - Also ensure your backend env matches the same name:
--   `SUPABASE_STORAGE_BUCKET=<your bucket name>`
-- Notes
-- - These policies assume you will (eventually) use Supabase Auth, so `auth.jwt() ->> 'email'` is available.
-- - If you are currently uploading via the backend Service Role key, RLS is bypassed by design.
-- - Paths written by the backend follow the pattern:
--   - avatars/users/<email>/<uuid>.<ext>
--   - group-images/groups/<groupId>/<email>/<uuid>.<ext>
--   - uploads/posts/<postId>/<email>/<uuid>.<ext>
--   - uploads/groups/<groupId>/<email>/<uuid>.<ext>
--   - account-selfies/users/<email>/<uuid>.<ext>

-- 1) RLS enablement
-- In most Supabase projects, `storage.objects` already has RLS enabled.
-- If you try to run `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;` and get:
--   ERROR: 42501: must be owner of table objects
-- your SQL Editor role cannot alter the internal storage table.
--
-- In that case:
-- - Skip the ALTER TABLE step (this file will still define the policies).
-- - Create the policies from the Dashboard UI instead:
--     Storage → Policies → New policy (table: storage.objects)
--
-- Optional (only if you have the privileges):
-- alter table storage.objects enable row level security;

-- 2) Helper expression (inline): normalize email from JWT
--    Supabase includes `email` in JWT for authenticated users.
--    We'll compare using lower(email).

-- 3) READ policies
-- Public-ish reads for app media (adjust as needed).
-- If you want truly public access (without auth), change `to authenticated` to `to anon, authenticated`.
drop policy if exists "keinti_read_media_authenticated" on storage.objects;
create policy "keinti_read_media_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'keinti_media'
  and (
    name like 'avatars/%'
    or name like 'group-images/%'
    or name like 'uploads/%'
  )
);

-- Sensitive: account selfies should only be readable by the owner.
drop policy if exists "keinti_read_account_selfies_owner" on storage.objects;
create policy "keinti_read_account_selfies_owner"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'keinti_media'
  and name like 'account-selfies/users/' || lower(auth.jwt() ->> 'email') || '/%'
);

-- 4) INSERT policies (users can only upload under their own email prefix)
drop policy if exists "keinti_insert_avatars_owner" on storage.objects;
create policy "keinti_insert_avatars_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'keinti_media'
  and name like 'avatars/users/' || lower(auth.jwt() ->> 'email') || '/%'
);

drop policy if exists "keinti_insert_account_selfies_owner" on storage.objects;
create policy "keinti_insert_account_selfies_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'keinti_media'
  and name like 'account-selfies/users/' || lower(auth.jwt() ->> 'email') || '/%'
);

-- Posts and group uploads include extra path segments before the email.
drop policy if exists "keinti_insert_uploads_owner" on storage.objects;
create policy "keinti_insert_uploads_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'keinti_media'
  and (
    name like 'uploads/posts/%/' || lower(auth.jwt() ->> 'email') || '/%'
    or name like 'uploads/groups/%/' || lower(auth.jwt() ->> 'email') || '/%'
    or name like 'group-images/groups/%/' || lower(auth.jwt() ->> 'email') || '/%'
  )
);

-- 5) UPDATE/DELETE policies (optional; recommended only if clients upload directly)
-- By default, let only the owner delete their objects.
drop policy if exists "keinti_delete_owner" on storage.objects;
create policy "keinti_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'keinti_media'
  and (
    name like 'avatars/users/' || lower(auth.jwt() ->> 'email') || '/%'
    or name like 'account-selfies/users/' || lower(auth.jwt() ->> 'email') || '/%'
    or name like 'uploads/posts/%/' || lower(auth.jwt() ->> 'email') || '/%'
    or name like 'uploads/groups/%/' || lower(auth.jwt() ->> 'email') || '/%'
    or name like 'group-images/groups/%/' || lower(auth.jwt() ->> 'email') || '/%'
  )
);
