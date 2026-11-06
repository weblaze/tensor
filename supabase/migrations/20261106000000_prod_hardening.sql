-- Production hardening.
-- 1. login_attempts: failed office logins, for lockout after repeated wrong passphrases.
-- 2. demo_mode setting: reseed_demo() refuses to run unless it is on, so a production
--    database can never be replaced with demo data, whatever the app does.
-- 3. reset_to_production(): clears the demo projects, demo doctors and their history,
--    keeps templates and staff, gives everyone fresh link codes and turns demo mode off.

create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ip text not null,
  ok boolean not null default false
);
create index if not exists login_attempts_ip_at_idx on login_attempts (ip, at desc);
alter table login_attempts enable row level security;

insert into app_settings (key, value) values ('demo_mode', '{"enabled": true}')
on conflict (key) do nothing;

alter function reseed_demo() rename to reseed_demo_unguarded;
revoke all on function reseed_demo_unguarded() from public, anon, authenticated;

create or replace function reseed_demo() returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not coalesce((select (value->>'enabled')::boolean from app_settings where key = 'demo_mode'), false) then
    raise exception 'Demo reset is disabled: this database is in production mode';
  end if;
  perform reseed_demo_unguarded();
  insert into app_settings (key, value) values ('demo_mode', '{"enabled": true}')
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function reseed_demo() from public, anon, authenticated;

create or replace function reset_to_production() returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  truncate notifications, decisions, updates, materials, tasks, projects, login_attempts restart identity cascade;

  -- Demo doctors are fictional; staff names are real and stay, without the sample phone numbers.
  delete from people where role = 'doctor' and is_demo;
  update people set
    phone = case when is_demo then null else phone end,
    is_demo = false,
    telegram_chat_id = null,
    current_project_id = null,
    link_code = upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  insert into app_settings (key, value) values
    ('demo_mode', '{"enabled": false}'),
    ('autopilot', '{"enabled": false, "min_confidence": 0.9}')
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function reset_to_production() from public, anon, authenticated;
