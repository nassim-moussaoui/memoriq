-- Hardening flagged by the Supabase security advisors after 0001:
-- pin the search_path of set_updated_at, and stop PostgREST exposing the
-- trigger functions as RPC (triggers still run as table owner).
alter function public.set_updated_at() set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
