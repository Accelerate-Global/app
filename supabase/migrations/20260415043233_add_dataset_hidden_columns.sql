alter table if exists public.datasets
add column if not exists hidden_column_keys jsonb not null default '[]'::jsonb;
