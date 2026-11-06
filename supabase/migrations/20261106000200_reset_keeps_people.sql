-- reset_to_production(): TRUNCATE projects ... CASCADE also truncated people (people.current_project_id
-- references projects). Delete projects instead, so people's FK is set null and staff are kept.
create or replace function reset_to_production() returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  truncate notifications, decisions, updates, materials, tasks, login_attempts restart identity;
  update people set current_project_id = null;
  delete from projects;

  -- Demo doctors are fictional; staff names are real and stay, without the sample phone numbers.
  delete from people where role = 'doctor' and is_demo;
  update people set
    phone = case when is_demo then null else phone end,
    is_demo = false,
    telegram_chat_id = null,
    link_code = upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));

  insert into app_settings (key, value) values
    ('demo_mode', '{"enabled": false}'),
    ('autopilot', '{"enabled": false, "min_confidence": 0.9}')
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function reset_to_production() from public, anon, authenticated;

-- Staff removed by the first run on 2026-11-06 (no real data: only sample phone numbers were lost).
insert into people (name, role)
select v.name, v.role
from (values ('Abhay', 'coordinator'), ('Om', 'supervisor'), ('Rinku', 'supervisor'), ('Anil', 'procurement'), ('Prashant', 'head')) as v(name, role)
where not exists (select 1 from people p where p.name = v.name and p.role = v.role);
