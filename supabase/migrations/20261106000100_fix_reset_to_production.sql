-- reset_to_production(): pgcrypto lives in the "extensions" schema on Supabase, which the
-- function's search_path did not include. Qualify gen_random_bytes.
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
    link_code = upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));

  insert into app_settings (key, value) values
    ('demo_mode', '{"enabled": false}'),
    ('autopilot', '{"enabled": false, "min_confidence": 0.9}')
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function reset_to_production() from public, anon, authenticated;
