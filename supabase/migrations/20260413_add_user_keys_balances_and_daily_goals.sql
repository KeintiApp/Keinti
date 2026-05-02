alter table public.users
  add column if not exists white_keys_balance integer not null default 0,
  add column if not exists gradient_keys_balance integer not null default 0,
  add column if not exists white_keys_daily_goals_state jsonb not null default '{}'::jsonb;