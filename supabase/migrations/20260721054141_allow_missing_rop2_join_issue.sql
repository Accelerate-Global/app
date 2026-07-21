alter table private.rop_reference_people
  drop constraint if exists rop_reference_people_join_issue_check;

alter table private.rop_reference_people
  add constraint rop_reference_people_join_issue_check
  check (
    join_issue is null
    or join_issue in (
      'missing-rop25',
      'missing-rop2',
      'rop2-conflict',
      'parent-only-rop25'
    )
  );
