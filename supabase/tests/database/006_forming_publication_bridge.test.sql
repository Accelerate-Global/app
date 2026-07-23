begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

select has_column(
  'private',
  'dataset_forming_runs',
  'publication_id',
  'formed runs expose their immutable source publication'
);

select has_column(
  'private',
  'dataset_forming_runs',
  'publishing_started_at',
  'formed publication claims carry a recoverable lease timestamp'
);

select fk_ok(
  'private',
  'dataset_forming_runs',
  'publication_id',
  'private',
  'pipeline_publications',
  'id',
  'formed publication lineage is protected by a foreign key'
);

select has_index(
  'private',
  'dataset_forming_runs',
  'dataset_forming_runs_publication_idx',
  'one immutable source publication can belong to only one forming run'
);

select has_trigger(
  'private',
  'dataset_forming_runs',
  'dataset_forming_runs_immutable',
  'forming publication lineage remains protected by the run immutability trigger'
);

select * from finish();
rollback;
