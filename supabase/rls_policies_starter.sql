-- KeintiApp - RLS policies + auth triggers (starter)
--
-- IMPORTANT:
-- 1) If you enable RLS without the right policies, the app will start failing with 401/403.
-- 2) These policies assume the client is authenticated with Supabase Auth.
-- 3) Run in Supabase Dashboard -> SQL Editor.
--
-- Run this in Supabase Dashboard -> SQL Editor.

-- Helper: current user's email from the Supabase JWT.
create or replace function public.current_email()
returns text
language sql
stable
set search_path = public, auth, extensions
as $$
  select nullif(auth.jwt() ->> 'email', '');
$$;

-- Insert a row in public.users when a user is created in Supabase Auth.
-- Standard Supabase pattern so your app can query public.users with RLS.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    email,
    username,
    password,
    preferred_language,
    supabase_user_id,
    created_at,
    updated_at
  )
  values (
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), '@' || replace(split_part(new.email, '@', 1), '.', '')),
    null,
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_language', ''), 'es'),
    new.id,
    now(),
    now()
  )
  on conflict (email) do update
    set supabase_user_id = excluded.supabase_user_id,
        updated_at = now();

  -- Ensure account_auth row exists as well.
  insert into public.account_auth (user_email)
  values (new.email)
  on conflict (user_email) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill: create missing public.users rows for existing auth.users
insert into public.users (
  email,
  username,
  password,
  preferred_language,
  supabase_user_id,
  created_at,
  updated_at
)
select
  au.email,
  coalesce(nullif(au.raw_user_meta_data ->> 'username', ''), '@' || replace(split_part(au.email, '@', 1), '.', '')),
  null,
  coalesce(nullif(au.raw_user_meta_data ->> 'preferred_language', ''), 'es'),
  au.id,
  now(),
  now()
from auth.users au
left join public.users u on lower(u.email) = lower(au.email)
where u.email is null
on conflict (email) do nothing;

insert into public.account_auth (user_email)
select u.email
from public.users u
left join public.account_auth aa on aa.user_email = u.email
where aa.user_email is null
on conflict (user_email) do nothing;

-- Admin allow-list (used for update policies on moderation tables)
create table if not exists public.app_admins (
  supabase_user_id uuid primary key,
  email text unique,
  created_at timestamp not null default now()
);

-- =========================================================
-- Server-only tables (do NOT expose to the mobile app)
-- =========================================================
-- These are used by your backend email verification/password reset flows.
-- We enable RLS and explicitly deny anon/authenticated access.

alter table if exists public.email_verification_codes enable row level security;
drop policy if exists "deny client access" on public.email_verification_codes;
create policy "deny client access"
  on public.email_verification_codes
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table if exists public.password_reset_codes enable row level security;
drop policy if exists "deny client access" on public.password_reset_codes;
create policy "deny client access"
  on public.password_reset_codes
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Backend-only allow-list for production moderation (selfie review admins).
-- If this table exists in public schema, it must NOT be readable/writable by the mobile app.
alter table if exists public.backend_admins enable row level security;
drop policy if exists "deny client access" on public.backend_admins;
create policy "deny client access"
  on public.backend_admins
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- =========================================================
-- Users (public profile)
-- =========================================================
alter table if exists public.users enable row level security;

drop policy if exists "users: select own" on public.users;
create policy "users: select own"
  on public.users
  for select
  to authenticated
  using (supabase_user_id = auth.uid() or email = public.current_email());

drop policy if exists "users: update own" on public.users;
create policy "users: update own"
  on public.users
  for update
  to authenticated
  using (supabase_user_id = auth.uid() or email = public.current_email())
  with check (supabase_user_id = auth.uid() and email = public.current_email());

-- NOTE: inserts are normally handled by the auth trigger above.
drop policy if exists "users: insert own" on public.users;
create policy "users: insert own"
  on public.users
  for insert
  to authenticated
  with check (supabase_user_id = auth.uid() and email = public.current_email());

-- =========================================================
-- account_auth (sensitive; only owner can read)
-- =========================================================
alter table if exists public.account_auth enable row level security;

drop policy if exists "account_auth: select own" on public.account_auth;
create policy "account_auth: select own"
  on public.account_auth
  for select
  to authenticated
  using (user_email = public.current_email());

drop policy if exists "account_auth: update own" on public.account_auth;
create policy "account_auth: update own"
  on public.account_auth
  for update
  to authenticated
  using (user_email = public.current_email())
  with check (user_email = public.current_email());

-- =========================================================
-- Rectifications (admin accepts/rejects in Table Editor)
-- =========================================================
-- Recommended: the mobile app should NOT read other users' rectifications.
-- If you want users to see their own rectification status, allow select/insert for their email.

alter table if exists public.email_verification_rectifications enable row level security;

drop policy if exists "rectifications: select own" on public.email_verification_rectifications;
create policy "rectifications: select own"
  on public.email_verification_rectifications
  for select
  to authenticated
  using (email = public.current_email());

drop policy if exists "rectifications: insert own" on public.email_verification_rectifications;
create policy "rectifications: insert own"
  on public.email_verification_rectifications
  for insert
  to authenticated
  with check (
    email = public.current_email()
    and char_length(message) <= 220
    and status = 'pending'
  );

-- Admin can update status/decision fields.
drop policy if exists "rectifications: admin update" on public.email_verification_rectifications;
create policy "rectifications: admin update"
  on public.email_verification_rectifications
  for update
  to authenticated
  using (
    exists (select 1 from public.app_admins a where a.supabase_user_id = auth.uid())
  )
  with check (
    email is not null
    and char_length(message) <= 220
    and status in ('pending', 'accepted', 'rejected')
  );

-- Trigger helpers used by the backend/admin workflow.
-- Security Advisor: fix "Function Search Path Mutable" by pinning search_path.
-- Using SECURITY DEFINER so the unlock can run even if RLS denies direct client access.
create or replace function public.trg_set_rectification_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('accepted', 'rejected') then
    if new.reviewed_at is null then
      new.reviewed_at = now();
    end if;
    if new.reviewed_by is null then
      new.reviewed_by = current_user;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.trg_unlock_email_on_rectification_accept()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.status is distinct from old.status and new.status = 'accepted' then
    update public.email_verification_codes
    set locked_until = null,
        verify_failed_attempts = 0,
        send_count = 0,
        verified = false,
        verified_at = null,
        updated_at = current_timestamp
    where email = new.email;
  end if;
  return new;
end;
$$;

-- =========================================================
-- NOTE about the rest of your app tables
-- =========================================================
-- You have many tables using *_email columns (posts, groups, messages, etc.).
-- To safely expose them to the mobile app, you must:
-- - Decide what is public-readable vs private.
-- - Add RLS policies per table (select/insert/update/delete) based on current_email(), group membership, etc.
--
-- I recommend doing that as a second step, table-by-table, once we confirm which screens query which tables.

-- =========================================================
-- Security Advisor clean-up (enable RLS on remaining public tables)
--
-- Goal: remove "RLS Disabled in Public" findings with safe default policies.
-- IMPORTANT: these are minimal policies. If a screen needs broader access,
-- we should widen policies intentionally.
-- =========================================================

-- app_admins should never be readable/writable by normal clients.
alter table if exists public.app_admins enable row level security;
drop policy if exists "deny client access" on public.app_admins;
create policy "deny client access"
  on public.app_admins
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- edit_post_user (draft profile) - owner only
alter table if exists public.edit_post_user enable row level security;
drop policy if exists "edit_post_user: select own" on public.edit_post_user;
create policy "edit_post_user: select own"
  on public.edit_post_user
  for select
  to authenticated
  using (user_email = public.current_email());

drop policy if exists "edit_post_user: insert own" on public.edit_post_user;
create policy "edit_post_user: insert own"
  on public.edit_post_user
  for insert
  to authenticated
  with check (user_email = public.current_email());

drop policy if exists "edit_post_user: update own" on public.edit_post_user;
create policy "edit_post_user: update own"
  on public.edit_post_user
  for update
  to authenticated
  using (user_email = public.current_email())
  with check (user_email = public.current_email());

drop policy if exists "edit_post_user: delete own" on public.edit_post_user;
create policy "edit_post_user: delete own"
  on public.edit_post_user
  for delete
  to authenticated
  using (user_email = public.current_email());

-- post_users - readable to authenticated; only owner can write
alter table if exists public.post_users enable row level security;
drop policy if exists "post_users: select all" on public.post_users;
create policy "post_users: select all"
  on public.post_users
  for select
  to authenticated
  using (deleted_at is null);

drop policy if exists "post_users: insert own" on public.post_users;
create policy "post_users: insert own"
  on public.post_users
  for insert
  to authenticated
  with check (user_email = public.current_email());

drop policy if exists "post_users: update own" on public.post_users;
create policy "post_users: update own"
  on public.post_users
  for update
  to authenticated
  using (user_email = public.current_email())
  with check (user_email = public.current_email());

drop policy if exists "post_users: delete own" on public.post_users;
create policy "post_users: delete own"
  on public.post_users
  for delete
  to authenticated
  using (user_email = public.current_email());

-- post_reactions - readable to authenticated; only reactor can write
alter table if exists public.post_reactions enable row level security;
drop policy if exists "post_reactions: select all" on public.post_reactions;
create policy "post_reactions: select all"
  on public.post_reactions
  for select
  to authenticated
  using (true);

drop policy if exists "post_reactions: insert own" on public.post_reactions;
create policy "post_reactions: insert own"
  on public.post_reactions
  for insert
  to authenticated
  with check (user_email = public.current_email());

drop policy if exists "post_reactions: update own" on public.post_reactions;
create policy "post_reactions: update own"
  on public.post_reactions
  for update
  to authenticated
  using (user_email = public.current_email())
  with check (user_email = public.current_email());

drop policy if exists "post_reactions: delete own" on public.post_reactions;
create policy "post_reactions: delete own"
  on public.post_reactions
  for delete
  to authenticated
  using (user_email = public.current_email());

-- post_intimidades_opens - allow insert by opener; allow select by opener or creator
alter table if exists public.post_intimidades_opens enable row level security;
drop policy if exists "post_intimidades_opens: select related" on public.post_intimidades_opens;
create policy "post_intimidades_opens: select related"
  on public.post_intimidades_opens
  for select
  to authenticated
  using (opener_email = public.current_email() or creator_email = public.current_email());

drop policy if exists "post_intimidades_opens: insert own" on public.post_intimidades_opens;
create policy "post_intimidades_opens: insert own"
  on public.post_intimidades_opens
  for insert
  to authenticated
  with check (opener_email = public.current_email());

-- channels: access if viewer is subscribed OR publisher owns the post
alter table if exists public.channel_subscriptions enable row level security;
drop policy if exists "channel_subscriptions: select related" on public.channel_subscriptions;
create policy "channel_subscriptions: select related"
  on public.channel_subscriptions
  for select
  to authenticated
  using (viewer_email = public.current_email() or publisher_email = public.current_email());

drop policy if exists "channel_subscriptions: insert own" on public.channel_subscriptions;
create policy "channel_subscriptions: insert own"
  on public.channel_subscriptions
  for insert
  to authenticated
  with check (viewer_email = public.current_email());

drop policy if exists "channel_subscriptions: delete own" on public.channel_subscriptions;
create policy "channel_subscriptions: delete own"
  on public.channel_subscriptions
  for delete
  to authenticated
  using (viewer_email = public.current_email());

alter table if exists public.channel_messages enable row level security;
drop policy if exists "channel_messages: select if participant" on public.channel_messages;
create policy "channel_messages: select if participant"
  on public.channel_messages
  for select
  to authenticated
  using (
    sender_email = public.current_email()
    or exists (
      select 1
      from public.channel_subscriptions s
      where s.post_id = channel_messages.post_id
        and (s.viewer_email = public.current_email() or s.publisher_email = public.current_email())
    )
    or exists (
      select 1
      from public.post_users p
      where p.id = channel_messages.post_id
        and p.user_email = public.current_email()
        and p.deleted_at is null
    )
  );

drop policy if exists "channel_messages: insert own if participant" on public.channel_messages;
create policy "channel_messages: insert own if participant"
  on public.channel_messages
  for insert
  to authenticated
  with check (
    sender_email = public.current_email()
    and (
      exists (
        select 1
        from public.channel_subscriptions s
        where s.post_id = channel_messages.post_id
          and (s.viewer_email = public.current_email() or s.publisher_email = public.current_email())
      )
      or exists (
        select 1
        from public.post_users p
        where p.id = channel_messages.post_id
          and p.user_email = public.current_email()
          and p.deleted_at is null
      )
    )
  );

-- groups helpers
create or replace function public.is_group_owner(gid int)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.user_groups g where g.id = gid and g.owner_email = public.current_email());
$$;

create or replace function public.is_group_member(gid int)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.group_members m where m.group_id = gid and m.member_email = public.current_email());
$$;

create or replace function public.is_group_participant(gid int)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_group_owner(gid) or public.is_group_member(gid);
$$;

-- user_groups: participants can read; only owner can write
alter table if exists public.user_groups enable row level security;
drop policy if exists "user_groups: select participant" on public.user_groups;
create policy "user_groups: select participant"
  on public.user_groups
  for select
  to authenticated
  using (public.is_group_participant(id));

drop policy if exists "user_groups: insert own" on public.user_groups;
create policy "user_groups: insert own"
  on public.user_groups
  for insert
  to authenticated
  with check (owner_email = public.current_email());

drop policy if exists "user_groups: update own" on public.user_groups;
create policy "user_groups: update own"
  on public.user_groups
  for update
  to authenticated
  using (owner_email = public.current_email())
  with check (owner_email = public.current_email());

drop policy if exists "user_groups: delete own" on public.user_groups;
create policy "user_groups: delete own"
  on public.user_groups
  for delete
  to authenticated
  using (owner_email = public.current_email());

-- group_members: participants can read; only owner can manage
alter table if exists public.group_members enable row level security;
drop policy if exists "group_members: select participant" on public.group_members;
create policy "group_members: select participant"
  on public.group_members
  for select
  to authenticated
  using (public.is_group_participant(group_id));

drop policy if exists "group_members: owner insert" on public.group_members;
create policy "group_members: owner insert"
  on public.group_members
  for insert
  to authenticated
  with check (public.is_group_owner(group_id));

drop policy if exists "group_members: owner delete" on public.group_members;
create policy "group_members: owner delete"
  on public.group_members
  for delete
  to authenticated
  using (public.is_group_owner(group_id));

-- group_member_limits: participants can read; only owner can manage
alter table if exists public.group_member_limits enable row level security;
drop policy if exists "group_member_limits: select participant" on public.group_member_limits;
create policy "group_member_limits: select participant"
  on public.group_member_limits
  for select
  to authenticated
  using (public.is_group_participant(group_id));

drop policy if exists "group_member_limits: owner insert" on public.group_member_limits;
create policy "group_member_limits: owner insert"
  on public.group_member_limits
  for insert
  to authenticated
  with check (public.is_group_owner(group_id));

drop policy if exists "group_member_limits: owner delete" on public.group_member_limits;
create policy "group_member_limits: owner delete"
  on public.group_member_limits
  for delete
  to authenticated
  using (public.is_group_owner(group_id));

-- group_messages: participants can read; members can write unless limited
alter table if exists public.group_messages enable row level security;
drop policy if exists "group_messages: select participant" on public.group_messages;
create policy "group_messages: select participant"
  on public.group_messages
  for select
  to authenticated
  using (public.is_group_participant(group_id));

drop policy if exists "group_messages: insert member" on public.group_messages;
create policy "group_messages: insert member"
  on public.group_messages
  for insert
  to authenticated
  with check (
    sender_email = public.current_email()
    and public.is_group_participant(group_id)
    and not exists (
      select 1 from public.group_member_limits l
      where l.group_id = group_messages.group_id
        and l.member_email = public.current_email()
    )
  );

-- group_join_requests: requester/target can read; requester inserts; target updates
alter table if exists public.group_join_requests enable row level security;
drop policy if exists "group_join_requests: select related" on public.group_join_requests;
create policy "group_join_requests: select related"
  on public.group_join_requests
  for select
  to authenticated
  using (requester_email = public.current_email() or target_email = public.current_email());

drop policy if exists "group_join_requests: insert requester" on public.group_join_requests;
create policy "group_join_requests: insert requester"
  on public.group_join_requests
  for insert
  to authenticated
  with check (requester_email = public.current_email());

drop policy if exists "group_join_requests: update target" on public.group_join_requests;
create policy "group_join_requests: update target"
  on public.group_join_requests
  for update
  to authenticated
  using (target_email = public.current_email())
  with check (target_email = public.current_email());

-- user_reports: reporter inserts; reporter sees own; admin sees all
alter table if exists public.user_reports enable row level security;
drop policy if exists "user_reports: insert reporter" on public.user_reports;
create policy "user_reports: insert reporter"
  on public.user_reports
  for insert
  to authenticated
  with check (reporter_email = public.current_email());

drop policy if exists "user_reports: select own" on public.user_reports;
create policy "user_reports: select own"
  on public.user_reports
  for select
  to authenticated
  using (reporter_email = public.current_email());

drop policy if exists "user_reports: admin select" on public.user_reports;
create policy "user_reports: admin select"
  on public.user_reports
  for select
  to authenticated
  using (exists (select 1 from public.app_admins a where a.supabase_user_id = auth.uid()));

-- Highly sensitive binary data tables: deny mobile access.
-- Recommended: serve images via Supabase Storage (bucket policies) instead of BYTEA columns.
alter table if exists public.uploaded_images enable row level security;
drop policy if exists "deny client access" on public.uploaded_images;
create policy "deny client access"
  on public.uploaded_images
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table if exists public.user_avatars enable row level security;
drop policy if exists "deny client access" on public.user_avatars;
create policy "deny client access"
  on public.user_avatars
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- =========================================================
-- How to add an admin
-- =========================================================
-- 1) Find the user's auth UID (auth.users.id) or from the JWT (sub)
-- 2) Insert into app_admins:
-- insert into public.app_admins (supabase_user_id, email) values ('<uuid>', '<email>');
