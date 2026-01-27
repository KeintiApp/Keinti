-- Create post_poll_votes (poll/survey votes per post/intimidad)
-- Run in Supabase Dashboard -> SQL Editor.

create table if not exists public.post_poll_votes (
  id bigserial primary key,
  post_id bigint not null references public.post_users(id) on delete cascade,
  user_email text not null references public.users(email) on delete cascade,
  intimidad_index int not null,
  option_key text not null,
  created_at timestamp without time zone not null default now(),
  constraint post_poll_votes_unique unique (post_id, user_email, intimidad_index)
);

create index if not exists idx_post_poll_votes_post_intimidad
  on public.post_poll_votes (post_id, intimidad_index);
