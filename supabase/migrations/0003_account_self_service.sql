-- Account self-service, called by the signed-in user through RPC.
-- Both functions only ever touch the caller's own rows (auth.uid()), run as
-- the owner (security definer, pinned search_path) because review_logs has
-- no delete policy and auth.users is not writable by clients, and are
-- executable by authenticated users only.

-- Erases the learning progress kept in the cloud, keeping the account.
create or replace function public.delete_my_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.review_logs where user_id = uid;
  delete from public.memorization_items where user_id = uid;
  update public.profiles
     set streak = 0, last_session_day = null, active_surah = null
   where id = uid;
end;
$$;

-- Deletes the account itself (App Store guideline 5.1.1(v)). Every table
-- referencing auth.users cascades, except sadaqa_gifts which keeps the gift
-- record with the donor set to null.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_progress() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_progress() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
