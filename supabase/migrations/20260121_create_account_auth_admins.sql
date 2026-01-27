-- Keinti - Account Auth (selfie) admin allow-list + columns
-- Safe to run multiple times.

-- 1) Admin allow-list used by the backend (NOT the mobile app)
create table if not exists public.backend_admins (
  email varchar(255) primary key,
  created_at timestamp not null default now()
);

-- 2) Account-auth selfie block fields (for "blocked cannot retry" workflow)
alter table if exists public.account_auth
  add column if not exists selfie_blocked boolean not null default false;

alter table if exists public.account_auth
  add column if not exists selfie_blocked_at timestamp null;

alter table if exists public.account_auth
  add column if not exists selfie_blocked_reason text null;

alter table if exists public.account_auth
  add column if not exists selfie_blocked_by varchar(255) null;

-- 3) Helpful index for admin queues
create index if not exists idx_account_auth_selfie_status
  on public.account_auth (selfie_status);

-- 4) Storage pointers for uploaded_images when using Supabase Storage
alter table if exists public.uploaded_images
  alter column image_data drop not null;

alter table if exists public.uploaded_images
  add column if not exists storage_bucket text;

alter table if exists public.uploaded_images
  add column if not exists storage_path text;
