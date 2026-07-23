drop index if exists private.source_profile_bindings_profile_idx;

create unique index if not exists source_profile_bindings_source_profile_unique
  on private.source_profile_bindings(source_profile_key);

comment on index private.source_profile_bindings_source_profile_unique is
  'Each configurable source engine is bound to exactly one dataset connection.';
