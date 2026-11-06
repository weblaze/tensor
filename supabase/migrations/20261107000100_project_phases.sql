-- Projects keep their own phase order too (copied from the template), like statuses and trades.
alter table projects add column if not exists phases jsonb;
