-- Backend-only tables in the public schema must not be readable through PostgREST.
-- We intentionally enable RLS without public-facing policies so anon/authenticated
-- cannot access them directly, while backend/admin roles keep working.

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_interaction_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.device_push_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.channel_interaction_states FROM PUBLIC, anon, authenticated;