-- Public, anonymous counters for the Sadaqa screen: how many students are
-- waiting for a gift and how many gifts were already given. Only aggregate
-- numbers leave the database; no row of the waitlist or the gifts is exposed.
create or replace function public.sadaqa_stats()
returns table (waiting bigint, gifted bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.sadaqa_waitlist where status = 'waiting'),
    (select count(*) from public.sadaqa_gifts where status = 'assigned');
$$;

revoke execute on function public.sadaqa_stats() from public;
grant execute on function public.sadaqa_stats() to anon, authenticated;
