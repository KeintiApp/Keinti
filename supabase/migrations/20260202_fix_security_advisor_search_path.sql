-- Fix Security Advisor warnings: pin search_path for SECURITY DEFINER trigger functions.
-- Using pg_catalog prevents search_path hijacking; public objects are schema-qualified.

create or replace function public.trg_set_rectification_review_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
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
set search_path = pg_catalog
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
