alter table public.datasets
  add column if not exists default_filters jsonb;
