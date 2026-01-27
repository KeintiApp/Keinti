-- Enable RLS for post_poll_votes and deny direct client access.
-- This keeps behavior unchanged when using the backend with Service Role.
-- Run in Supabase Dashboard -> SQL Editor.

alter table if exists public.post_poll_votes enable row level security;

drop policy if exists "deny client access" on public.post_poll_votes;
create policy "deny client access"
  on public.post_poll_votes
  for all
  to anon, authenticated
  using (false)
  with check (false);
