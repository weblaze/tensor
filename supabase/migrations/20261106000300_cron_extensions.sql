-- Hourly checks: pg_cron schedules, pg_net calls the app. The job itself (with the app URL and
-- the CRON_SECRET from Vault) is created per environment; see docs/09-run-and-deploy.md.
create extension if not exists pg_cron;
create extension if not exists pg_net;
