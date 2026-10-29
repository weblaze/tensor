-- Workstream 0, migration 2: learning views, notification log, demo reseed.
-- All demo dates are relative to "today" in India (Asia/Kolkata) so the demo always looks live.

-- Actual lead times from past deliveries (received - ordered), per template and item.
create or replace view learned_lead_times with (security_invoker = true) as
select p.template_id,
       m.item,
       round(avg(m.received_at::date - m.ordered_at::date))::int as lead_time_days,
       count(*)::int as samples
from materials m
join projects p on p.id = m.project_id
where m.received_at is not null and m.ordered_at is not null and p.template_id is not null
group by p.template_id, m.item;

-- Tasks coordinators added by hand in 2+ past projects of the same template.
create or replace view learned_tasks with (security_invoker = true) as
select p.template_id,
       t.title,
       min(t.phase) as phase,
       min(t.trade) as trade,
       min(t.zone) as zone,
       round(avg(t.planned_start - p.start_date))::int as start_day,
       greatest(1, round(avg(t.planned_end - t.planned_start + 1)))::int as duration_days,
       count(distinct p.id)::int as projects
from tasks t
join projects p on p.id = t.project_id
where t.source = 'manual' and p.template_id is not null
group by p.template_id, lower(t.title), t.title
having count(distinct p.id) >= 2;

-- Every outgoing message (Telegram or skipped because the person is not linked), for the office to see.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  person_id uuid references people(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  kind text not null,
  body text not null,
  channel text not null default 'telegram',
  status text not null default 'sent' check (status in ('sent','skipped','failed')),
  error text
);
create index if not exists notifications_created_idx on notifications (created_at desc);
alter table notifications enable row level security;

-- Telegram callback / ambiguity state per update (which projects were offered).
alter table updates add column if not exists offered_project_ids uuid[];
-- Demo marker so the UI can label seeded people.
alter table people add column if not exists is_demo boolean not null default false;

create or replace function reseed_demo() returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Kolkata')::date;
  tpl uuid;
  p_abhay uuid; p_om uuid; p_rinku uuid; p_anil uuid; p_prashant uuid; p_gunjan uuid; p_mehta uuid;
  pj_kaw uuid; pj_rkl uuid; pj_gun uuid; pj_bho uuid;
  glass_id uuid;
  r record;
begin
  create temp table _keep on commit drop as
    select name, telegram_chat_id, link_code from people;

  truncate notifications, decisions, updates, materials, tasks, projects, template_materials, template_tasks, templates, people restart identity cascade;

  -- People (keep Telegram links and link codes by name)
  insert into people (name, role, phone, telegram_chat_id, link_code, is_demo)
  select v.name, v.role, v.phone, k.telegram_chat_id, coalesce(k.link_code, v.code), true
  from (values
    ('Abhay', 'coordinator', '+91 98100 00001', 'ABHAY1'),
    ('Om', 'supervisor', '+91 98100 00002', 'OM0142'),
    ('Rinku', 'supervisor', '+91 98100 00003', 'RINKU5'),
    ('Anil', 'procurement', '+91 98100 00004', 'ANIL01'),
    ('Prashant', 'head', '+91 98100 00005', 'HEAD01'),
    ('Dr. Gunjan', 'doctor', '+91 98100 00006', 'GUNJAN'),
    ('Dr. Mehta', 'doctor', '+91 98100 00007', 'MEHTA1')
  ) as v(name, role, phone, code)
  left join _keep k on k.name = v.name;

  select id into p_abhay from people where name = 'Abhay';
  select id into p_om from people where name = 'Om';
  select id into p_rinku from people where name = 'Rinku';
  select id into p_anil from people where name = 'Anil';
  select id into p_prashant from people where name = 'Prashant';
  select id into p_gunjan from people where name = 'Dr. Gunjan';
  select id into p_mehta from people where name = 'Dr. Mehta';

  -- Template
  insert into templates (name, description, default_days)
  values ('IVF lab — standard fit-out', 'Turnkey IVF clinic: OT, embryology lab, cryostorage, collection room plus reception and consult.', 45)
  returning id into tpl;

  insert into template_tasks (template_id, phase, title, trade, zone, start_day, duration_days, sort)
  select tpl, v.* from (values
    ('Site setup', 'Site survey and marking', 'Civil', 'general', 0, 2, 1),
    ('Site setup', 'Demolition and debris removal', 'Civil', 'general', 1, 3, 2),
    ('Services', 'Electrical conduit rough-in', 'Electrical', 'general', 4, 5, 3),
    ('Services', 'MGPS copper piping', 'MGPS', 'critical', 6, 5, 4),
    ('Services', 'Ducting installation', 'HVAC', 'critical', 8, 6, 5),
    ('Build', 'Gypsum partitions and ceiling', 'Civil', 'general', 10, 7, 6),
    ('Build', 'Modular OT wall panels', 'Panelling', 'critical', 16, 6, 7),
    ('Build', 'Glass partitions, embryology lab', 'Glazing', 'critical', 18, 3, 8),
    ('Finishes', 'Epoxy flooring, OT and lab', 'Flooring', 'critical', 22, 4, 9),
    ('Finishes', 'Vinyl flooring, reception', 'Flooring', 'general', 24, 3, 10),
    ('Finishes', 'Sanitary fittings', 'Sanitary', 'general', 26, 3, 11),
    ('Finishes', 'Hermetic doors', 'Doors', 'critical', 28, 2, 12),
    ('HVAC', 'AHU installation', 'HVAC', 'critical', 24, 5, 13),
    ('HVAC', 'HEPA filters and validation', 'HVAC', 'critical', 34, 3, 14),
    ('Handover', 'Cryostorage room fit-out', 'Panelling', 'critical', 32, 4, 15),
    ('Handover', 'Deep clean and snag list', 'Civil', 'general', 40, 3, 16),
    ('Handover', 'Handover to client', 'Coordination', 'general', 44, 1, 17)
  ) as v(phase, title, trade, zone, start_day, duration_days, sort);

  insert into template_materials (template_id, item, trade, qty, unit, lead_time_days, need_day)
  select tpl, v.* from (values
    ('Gypsum boards', 'Civil', 120, 'sheets', 4, 10),
    ('MGPS copper pipes', 'MGPS', 1, 'set', 10, 6),
    ('GI ducting', 'HVAC', 1, 'set', 7, 8),
    ('Modular OT wall panels', 'Panelling', 1, 'set', 21, 16),
    ('Glass partition panels', 'Glazing', 6, 'panels', 10, 18),
    ('Cleanroom LED lights', 'Electrical', 24, 'fixtures', 12, 20),
    ('Epoxy flooring kit', 'Flooring', 1, 'kit', 7, 22),
    ('Vinyl flooring', 'Flooring', 80, 'sqm', 7, 24),
    ('AHU unit', 'HVAC', 1, 'unit', 28, 24),
    ('Sanitary fittings', 'Sanitary', 1, 'set', 5, 26),
    ('Hermetic doors', 'Doors', 3, 'doors', 18, 28),
    ('HEPA filters', 'HVAC', 8, 'filters', 14, 34)
  ) as v(item, trade, qty, unit, lead_time_days, need_day);

  -- Projects
  insert into projects (code, name, city, template_id, doctor_id, supervisor_id, coordinator_id, start_date, planned_days, status, order_notes)
  values ('DM-0131', 'Kawardha Fertility Centre', 'Kawardha', tpl, null, p_om, p_abhay, d - 90, 45, 'closed', 'Standard fit-out.')
  returning id into pj_kaw;
  insert into projects (code, name, city, template_id, doctor_id, supervisor_id, coordinator_id, start_date, planned_days, status, order_notes)
  values ('DM-0136', 'Rourkela IVF Centre', 'Rourkela', tpl, null, p_rinku, p_abhay, d - 70, 45, 'closed', 'Standard fit-out.')
  returning id into pj_rkl;
  insert into projects (code, name, city, template_id, doctor_id, supervisor_id, coordinator_id, start_date, planned_days, status, order_notes, report_token)
  values ('DM-0142', 'Gunjan IVF', 'Sonipat', tpl, p_gunjan, p_om, p_abhay, d - 19, 45, 'active',
          'Ground floor, 2,400 sq ft. Client wants white antimicrobial finish in OT. Two collection rooms.', 'demo-gunjan-7f3a9c2e5b')
  returning id into pj_gun;
  insert into projects (code, name, city, template_id, doctor_id, supervisor_id, coordinator_id, start_date, planned_days, status, order_notes, report_token)
  values ('DM-0145', 'Bhopal Fertility Clinic', 'Bhopal', tpl, p_mehta, p_rinku, p_abhay, d - 6, 45, 'active',
          'First floor. Existing AC to be removed. Cryostorage room needs extra power point.', 'demo-bhopal-4d81e6a0c9')
  returning id into pj_bho;

  update people set current_project_id = pj_gun where id = p_om;
  update people set current_project_id = pj_bho where id = p_rinku;

  -- Tasks for every project from the template
  insert into tasks (project_id, phase, title, trade, zone, planned_start, planned_end, status, done_at, source, sort)
  select p.id, tt.phase, tt.title, tt.trade, tt.zone,
         p.start_date + tt.start_day,
         p.start_date + tt.start_day + tt.duration_days - 1,
         case
           when p.status = 'closed' then 'done'
           when tt.start_day + tt.duration_days - 1 < (d - p.start_date) - 1 and tt.title <> 'Gypsum partitions and ceiling' then 'done'
           when tt.start_day <= (d - p.start_date) then 'doing'
           else 'todo'
         end,
         case
           when p.status = 'closed' or (tt.start_day + tt.duration_days - 1 < (d - p.start_date) - 1 and tt.title <> 'Gypsum partitions and ceiling')
           then ((p.start_date + tt.start_day + tt.duration_days - 1)::timestamp + time '18:00') at time zone 'Asia/Kolkata'
         end,
         'template', tt.sort
  from projects p
  join template_tasks tt on tt.template_id = p.template_id;

  -- Manual tasks in past projects (MGPS pressure test in both -> learned; Fire NOC only once -> not learned)
  insert into tasks (project_id, phase, title, trade, zone, planned_start, planned_end, status, done_at, source, sort)
  select p.id, 'Services', 'MGPS pressure test', 'MGPS', 'critical', p.start_date + 11, p.start_date + 11, 'done',
         ((p.start_date + 11)::timestamp + time '17:00') at time zone 'Asia/Kolkata', 'manual', 5
  from projects p where p.id in (pj_kaw, pj_rkl);
  insert into tasks (project_id, phase, title, trade, zone, planned_start, planned_end, status, done_at, source, sort)
  select pj_kaw, 'Handover', 'Fire NOC inspection', 'Coordination', 'general', p.start_date + 42, p.start_date + 42, 'done',
         ((p.start_date + 42)::timestamp + time '15:00') at time zone 'Asia/Kolkata', 'manual', 16
  from projects p where p.id = pj_kaw;

  -- Materials for every project from the template
  insert into materials (project_id, item, trade, qty, unit, lead_time_days, need_by, status, source)
  select p.id, tm.item, tm.trade, tm.qty, tm.unit, tm.lead_time_days, p.start_date + tm.need_day, 'to_order', 'template'
  from projects p
  join template_materials tm on tm.template_id = p.template_id;

  -- Past projects: everything received, with real lead times (longer than the template for some items)
  update materials m set
    status = 'received',
    ordered_at = ((m.need_by - x.actual)::timestamp + time '11:00') at time zone 'Asia/Kolkata',
    received_at = ((m.need_by)::timestamp + time '15:00') at time zone 'Asia/Kolkata',
    vendor = 'Past vendor'
  from (
    select mm.id, case mm.item
      when 'Glass partition panels' then 13
      when 'AHU unit' then 32
      when 'Modular OT wall panels' then 24
      when 'Hermetic doors' then 21
      else mm.lead_time_days end as actual
    from materials mm
  ) x
  where x.id = m.id and m.project_id in (pj_kaw, pj_rkl);

  -- Gunjan: earlier materials received, some ordered, three still to order
  update materials set status = 'received',
    ordered_at = ((order_by - 1)::timestamp + time '11:00') at time zone 'Asia/Kolkata',
    received_at = ((need_by - 1)::timestamp + time '14:00') at time zone 'Asia/Kolkata'
  where project_id = pj_gun and item in ('Gypsum boards', 'MGPS copper pipes', 'GI ducting', 'Modular OT wall panels');
  update materials set status = 'ordered', vendor = case item when 'Glass partition panels' then 'Saint-Gobain dealer, Delhi' when 'AHU unit' then 'Zeco Aircon' else null end,
    ordered_at = ((order_by)::timestamp + time '12:00') at time zone 'Asia/Kolkata'
  where project_id = pj_gun and item in ('Glass partition panels', 'AHU unit', 'Epoxy flooring kit', 'Cleanroom LED lights', 'Vinyl flooring');
  -- Hermetic doors (order-by 9 days ago), HEPA (tomorrow), Sanitary (in 2 days) stay to_order.
  -- Hermetic doors were alerted 2 days ago and escalated yesterday.
  update materials set alert_sent_at = now() - interval '2 days', escalated_at = now() - interval '1 day'
  where project_id = pj_gun and item = 'Hermetic doors';

  -- Bhopal: anything due within 2 days already ordered, the rest waits
  update materials set status = 'ordered', ordered_at = ((least(order_by, d))::timestamp + time '12:00') at time zone 'Asia/Kolkata'
  where project_id = pj_bho and order_by <= d + 2;

  select id into glass_id from materials where project_id = pj_gun and item = 'Glass partition panels';

  -- Reviewed history (feeds the timeline, the doctor report and the autopilot meter)
  for r in
    select * from (values
      (pj_gun, p_om, 17, '10:05', 'Site survey done, marking complete for OT and lab', 'Civil', 'general', false, array['doctor'], array['doctor'], 0.92),
      (pj_gun, p_om, 15, '16:40', 'Demolition finished, debris cleared', 'Civil', 'general', false, array['doctor'], array['doctor'], 0.9),
      (pj_gun, p_om, 13, '12:15', 'Electrical conduits laid in reception and consult', 'Electrical', 'general', false, array['doctor'], array['doctor'], 0.88),
      (pj_gun, p_om, 11, '15:30', 'MGPS copper piping started in OT', 'MGPS', 'critical', false, array['doctor'], array['doctor'], 0.91),
      (pj_gun, p_om, 9, '11:50', 'MGPS piping complete, pressure test passed', 'MGPS', 'critical', false, array['doctor','head'], array['doctor','head'], 0.86),
      (pj_gun, p_om, 7, '17:10', 'Ducting installed above OT ceiling', 'HVAC', 'critical', false, array['doctor'], array['doctor'], 0.9),
      (pj_gun, p_om, 5, '13:20', 'Gypsum boards short by 10 sheets', 'Civil', 'general', true, array['procurement'], array['procurement','head'], 0.74),
      (pj_gun, p_om, 3, '10:45', 'OT wall panels delivered to site', 'Panelling', 'critical', false, array['doctor'], array['doctor'], 0.89),
      (pj_gun, p_om, 2, '16:05', 'OT wall panel fixing started', 'Panelling', 'critical', false, array['doctor'], array['doctor'], 0.9),
      (pj_gun, p_om, 1, '18:20', 'Embryology lab glass frame marked', 'Glazing', 'critical', false, array['doctor'], array[]::text[], 0.62),
      (pj_bho, p_rinku, 5, '11:00', 'Site survey and marking done', 'Civil', 'general', false, array['doctor'], array['doctor'], 0.92),
      (pj_bho, p_rinku, 4, '15:45', 'Old AC units removed', 'Civil', 'general', false, array['doctor'], array['doctor'], 0.87),
      (pj_bho, p_rinku, 3, '12:30', 'Demolition 70 percent done', 'Civil', 'general', false, array['doctor'], array['doctor'], 0.9),
      (pj_bho, p_rinku, 2, '17:30', 'Debris removal complete, conduit work from tomorrow', 'Civil', 'general', false, array['doctor'], array['doctor'], 0.91)
    ) as v(project_id, person_id, days_ago, at_time, note, trade, zone, is_issue, suggested, final, conf)
  loop
    insert into updates (project_id, person_id, received_at, kind, raw_text, note, trade, zone, is_issue,
                         suggested_routes, ai_confidence, final_routes, status, reviewed_at)
    values (r.project_id, r.person_id,
            ((d - r.days_ago)::timestamp + r.at_time::time) at time zone 'Asia/Kolkata',
            'photo', r.note, r.note, r.trade, r.zone, r.is_issue,
            r.suggested, r.conf, r.final, 'approved',
            ((d - r.days_ago)::timestamp + r.at_time::time + interval '25 minutes') at time zone 'Asia/Kolkata');
  end loop;

  -- Approved for the doctor today
  insert into updates (project_id, person_id, received_at, kind, raw_text, note, trade, zone, is_issue,
                       suggested_routes, ai_confidence, final_routes, status, reviewed_at)
  values
    (pj_gun, p_om, (d::timestamp + time '11:20') at time zone 'Asia/Kolkata', 'photo',
     'epoxy base coat ho gaya OT mein, kal second coat', 'Epoxy base coat done in OT, second coat tomorrow',
     'Flooring', 'critical', false, array['doctor'], 0.93, array['doctor'], 'approved',
     (d::timestamp + time '11:40') at time zone 'Asia/Kolkata'),
    (pj_gun, p_om, (d::timestamp + time '13:05') at time zone 'Asia/Kolkata', 'photo',
     'AHU base frame installed', 'AHU base frame installed',
     'HVAC', 'critical', false, array['doctor','head'], 0.9, array['doctor','head'], 'approved',
     (d::timestamp + time '13:30') at time zone 'Asia/Kolkata');

  -- Waiting in the coordinator's inbox
  insert into updates (project_id, person_id, received_at, kind, raw_text, note, trade, zone, is_issue,
                       suggested_routes, suggested_action, ai_confidence, status)
  values
    (pj_gun, p_om, (d::timestamp + time '15:12') at time zone 'Asia/Kolkata', 'photo',
     'glass panels received but 2 broken, please reorder', 'Glass panels received, 2 broken, please reorder',
     'Glazing', 'critical', true, array['procurement','head'],
     jsonb_build_object('type', 'material_status', 'material_id', glass_id, 'status', 'issue', 'note', '2 broken, reorder'),
     0.86, 'pending'),
    (pj_gun, p_om, (d::timestamp + time '16:48') at time zone 'Asia/Kolkata', 'text',
     'phase 1 complete', 'Phase 1 complete',
     'Coordination', 'general', false, array['doctor','head'],
     jsonb_build_object('type', 'phase_done', 'phase', 'Services'),
     0.72, 'pending'),
    (pj_gun, p_om, (d::timestamp + time '17:31') at time zone 'Asia/Kolkata', 'voice',
     'aaj labour kam hai, 3 aadmi nahi aaye', 'Labour short today, 3 men absent',
     'Civil', 'general', true, array['head'], null, 0.9, 'pending');
  update updates set transcript = raw_text where kind = 'voice';

  -- Decision waiting for the doctor
  insert into decisions (project_id, question, asked_at)
  values (pj_gun, 'Approve OT wall finish: white antimicrobial HPL', ((d - 2)::timestamp + time '12:00') at time zone 'Asia/Kolkata');

  insert into app_settings (key, value) values ('autopilot', '{"enabled": false, "min_confidence": 0.9}')
  on conflict (key) do update set value = excluded.value;
end;
$$;

revoke all on function reseed_demo() from public, anon, authenticated;
