update private.reference_resources
set
  route_path = case resource_key
    when 'source-aliases' then '/dashboard/resources/source-aliases'
    when 'jp-peopleid3' then '/dashboard/resources/jp-peopleid3'
    when 'peid' then '/dashboard/resources/peid'
    when 'tier1-merge-priorities' then '/dashboard/resources/tier1-merge-priorities'
    when 'engagement-mappings' then '/dashboard/resources/engagement-mappings'
    else route_path
  end,
  updated_at = now()
where resource_key in (
  'source-aliases',
  'jp-peopleid3',
  'peid',
  'tier1-merge-priorities',
  'engagement-mappings'
);
