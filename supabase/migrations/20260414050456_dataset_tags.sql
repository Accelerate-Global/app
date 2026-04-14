alter table public.datasets
add column tags jsonb not null default '[]'::jsonb;
