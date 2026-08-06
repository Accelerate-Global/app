alter table private.tier2_partner_profiles
  drop constraint if exists tier2_partner_profiles_partner_key_key;

create index if not exists tier2_partner_profiles_partner_key_idx
  on private.tier2_partner_profiles(partner_key);
