-- Seeded "today" updates must never sit in the future (the demo can run at any hour).
-- Wrap the original seed: run it, then pull today's future-dated updates back to just before now.
alter function reseed_demo() rename to reseed_demo_base;
revoke all on function reseed_demo_base() from public, anon, authenticated;

create or replace function reseed_demo() returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Kolkata')::date;
  day_start timestamptz := (d::timestamp + time '00:05') at time zone 'Asia/Kolkata';
begin
  perform reseed_demo_base();

  with future as (
    select id, row_number() over (order by received_at desc) as k
    from updates
    where received_at > now()
  )
  update updates u
  set received_at = greatest(day_start + make_interval(mins => (10 - f.k)::int), now() - make_interval(mins => (20 + 35 * (f.k - 1))::int))
  from future f
  where u.id = f.id;

  update updates
  set reviewed_at = least(received_at + interval '20 minutes', now())
  where reviewed_at is not null and reviewed_at > now();
end;
$$;

revoke all on function reseed_demo() from public, anon, authenticated;
