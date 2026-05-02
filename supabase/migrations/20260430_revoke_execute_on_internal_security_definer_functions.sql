-- Internal SECURITY DEFINER trigger functions should not be callable through PostgREST RPC.
-- Keep SECURITY DEFINER because the triggers need elevated privileges, but revoke EXECUTE
-- from public-facing API roles so anon/authenticated users cannot invoke them directly.

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.trg_set_rectification_review_fields() from public, anon, authenticated;
revoke execute on function public.trg_unlock_email_on_rectification_accept() from public, anon, authenticated;