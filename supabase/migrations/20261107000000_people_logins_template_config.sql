-- Personal logins and configurable templates. Additive only.

-- 1. Every person can have their own login: a username and a passphrase (PBKDF2 hash, never the text).
alter table people add column if not exists username text;
alter table people add column if not exists pass_hash text;
alter table people add column if not exists pass_set_at timestamptz;
alter table people add column if not exists last_login_at timestamptz;
create unique index if not exists people_username_key on people (lower(username)) where username is not null;

-- Who approved or held an update (null = the shared office login or autopilot).
alter table updates add column if not exists reviewed_by uuid references people(id) on delete set null;
create index if not exists updates_reviewed_by_idx on updates (reviewed_by);

-- 2. Templates describe how an office works, set up once by the coordinator (the setup wizard):
--    phases (ordered names), task statuses (label + one of the four kinds the system reasons with),
--    trades, zone names, and the contacts or details every project must record.
alter table templates add column if not exists phases jsonb;
alter table templates add column if not exists task_statuses jsonb;
alter table templates add column if not exists trades jsonb;
alter table templates add column if not exists zone_labels jsonb;
alter table templates add column if not exists project_fields jsonb;
alter table templates add column if not exists created_at timestamptz not null default now();

-- Projects keep a copy, so editing a template later never changes a running project.
alter table projects add column if not exists task_statuses jsonb;
alter table projects add column if not exists trades jsonb;
alter table projects add column if not exists zone_labels jsonb;
alter table projects add column if not exists project_fields jsonb;
alter table projects add column if not exists details jsonb not null default '{}'::jsonb;

-- A task's status stays one of todo | doing | done | blocked (what late, slip and reports use);
-- status_label is the office's own word for it when they defined more than one per kind.
alter table tasks add column if not exists status_label text;

-- The template that exists today was the original IVF setup: give it the matching configuration.
update templates set
  phases = coalesce(phases, '["Site setup","Services","Build","Finishes","HVAC","Handover"]'::jsonb),
  task_statuses = coalesce(task_statuses, '[{"label":"Not started","kind":"todo"},{"label":"In progress","kind":"doing"},{"label":"Done","kind":"done"},{"label":"Blocked","kind":"blocked"}]'::jsonb),
  trades = coalesce(trades, '["Civil","Electrical","MGPS","HVAC","Panelling","Glazing","Flooring","Sanitary","Doors","Coordination"]'::jsonb),
  zone_labels = coalesce(zone_labels, '{"critical":"Critical","general":"General"}'::jsonb),
  project_fields = coalesce(project_fields, '[]'::jsonb);
