-- Create post_reactions (one reaction per user per post)
-- Migration-safe: infers referenced column types to avoid FK type mismatches.
-- Run in Supabase Dashboard -> SQL Editor.

DO $$
DECLARE
  post_id_type text;
  user_email_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO post_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'post_users'
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF post_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot find public.post_users.id (required for FK)';
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO user_email_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'users'
    AND a.attname = 'email'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF user_email_type IS NULL THEN
    RAISE EXCEPTION 'Cannot find public.users.email (required for FK)';
  END IF;

  EXECUTE format($SQL$
    create table if not exists public.post_reactions (
      id bigserial primary key,
      post_id %s not null references public.post_users(id) on delete cascade,
      user_email %s not null references public.users(email) on delete cascade,
      emoji varchar(10) not null,
      created_at timestamp without time zone not null default now(),
      constraint post_reactions_unique unique (post_id, user_email)
    );
  $SQL$, post_id_type, user_email_type);
END $$;

create index if not exists idx_post_reactions_post_id
  on public.post_reactions (post_id);
