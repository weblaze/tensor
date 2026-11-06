-- Supabase advisor fixes.
-- pg_net was created in "public"; it is not relocatable, so recreate it in "extensions".
-- Its functions live in the "net" schema either way, so the cron job is unaffected.
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;

-- Cover every foreign key with an index.
create index if not exists decisions_project_id_idx on decisions (project_id);
create index if not exists materials_project_id_idx on materials (project_id);
create index if not exists notifications_person_id_idx on notifications (person_id);
create index if not exists notifications_project_id_idx on notifications (project_id);
create index if not exists people_current_project_id_idx on people (current_project_id);
create index if not exists projects_coordinator_id_idx on projects (coordinator_id);
create index if not exists projects_doctor_id_idx on projects (doctor_id);
create index if not exists projects_supervisor_id_idx on projects (supervisor_id);
create index if not exists projects_template_id_idx on projects (template_id);
create index if not exists tasks_project_id_idx on tasks (project_id);
create index if not exists template_materials_template_id_idx on template_materials (template_id);
create index if not exists template_tasks_template_id_idx on template_tasks (template_id);
create index if not exists updates_person_id_idx on updates (person_id);
