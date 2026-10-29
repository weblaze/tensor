-- ALREADY APPLIED to Supabase project "tensor" (ref gwgthatwoxuggidblodi) on 2026-10-30.
-- Kept here as the source of truth. New changes go in new migration files.
create extension if not exists pgcrypto;

create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('coordinator','supervisor','procurement','head','doctor')),
  phone text,
  telegram_chat_id bigint unique,
  link_code text unique not null default upper(substr(encode(gen_random_bytes(4),'hex'),1,6)),
  current_project_id uuid,
  created_at timestamptz not null default now()
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_days int not null default 45
);

create table template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  phase text not null,
  title text not null,
  trade text not null,
  zone text not null check (zone in ('critical','general')),
  start_day int not null,
  duration_days int not null default 1,
  sort int not null default 0
);

create table template_materials (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  item text not null,
  trade text not null,
  qty numeric,
  unit text,
  lead_time_days int not null,
  need_day int not null
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  city text not null,
  template_id uuid references templates(id),
  doctor_id uuid references people(id),
  supervisor_id uuid references people(id),
  coordinator_id uuid references people(id),
  start_date date not null,
  planned_days int not null,
  status text not null default 'active' check (status in ('active','handover','closed')),
  order_notes text,
  report_token text unique not null default encode(gen_random_bytes(12),'hex'),
  last_report_sent_on date,
  created_at timestamptz not null default now()
);
alter table people add constraint people_current_project_fk foreign key (current_project_id) references projects(id) on delete set null;

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase text not null,
  title text not null,
  trade text not null,
  zone text not null check (zone in ('critical','general')),
  planned_start date not null,
  planned_end date not null,
  status text not null default 'todo' check (status in ('todo','doing','done','blocked')),
  done_at timestamptz,
  source text not null default 'template' check (source in ('template','learned','ai','manual')),
  sort int not null default 0
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  item text not null,
  trade text not null,
  qty numeric,
  unit text,
  lead_time_days int not null,
  need_by date not null,
  order_by date generated always as (need_by - lead_time_days) stored,
  status text not null default 'to_order' check (status in ('to_order','ordered','received','issue')),
  vendor text,
  note text,
  ordered_at timestamptz,
  received_at timestamptz,
  alert_sent_at timestamptz,
  escalated_at timestamptz,
  source text not null default 'template' check (source in ('template','learned','ai','manual'))
);

create table updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  person_id uuid references people(id),
  received_at timestamptz not null default now(),
  kind text not null check (kind in ('photo','voice','text','location','video')),
  media_path text,
  raw_text text,
  transcript text,
  note text,
  trade text,
  zone text check (zone in ('critical','general')),
  is_issue boolean not null default false,
  suggested_routes text[] not null default '{}',
  suggested_action jsonb,
  ai_confidence numeric,
  final_routes text[],
  status text not null default 'pending' check (status in ('pending','approved','held')),
  reviewed_at timestamptz,
  auto_routed boolean not null default false,
  lat double precision,
  lng double precision,
  telegram_message_id bigint
);
create index on updates (project_id, received_at desc);
create index on updates (status);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  question text not null,
  asked_at timestamptz not null default now(),
  answer text check (answer in ('approved','change')),
  answer_note text,
  answered_at timestamptz
);

create table app_settings (
  key text primary key,
  value jsonb not null
);
insert into app_settings values ('autopilot', '{"enabled": false, "min_confidence": 0.9}');

-- Server uses the Supabase secret key; RLS on with no policies = anon/public clients get nothing.
alter table people enable row level security;
alter table templates enable row level security;
alter table template_tasks enable row level security;
alter table template_materials enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table materials enable row level security;
alter table updates enable row level security;
alter table decisions enable row level security;
alter table app_settings enable row level security;

insert into storage.buckets (id, name, public) values ('site-media', 'site-media', false)
on conflict (id) do nothing;
