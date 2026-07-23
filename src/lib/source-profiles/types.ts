export const CONFIGURABLE_SOURCE_PROFILE_KEYS = [
  "accelerate-owned-people-groups",
  "wcd-people-groups",
] as const;

export type ConfigurableSourceProfileKey =
  (typeof CONFIGURABLE_SOURCE_PROFILE_KEYS)[number];

export type SourceProfileSummary = {
  key: string;
  engineKey: string;
  label: string;
  stableKeyColumn: string | null;
  configurable: boolean;
};

export type SourceProfileBinding = {
  connectionId: string;
  sourceProfileKey: ConfigurableSourceProfileKey;
  stableKeyColumn: string;
  configuredByOwnerId: string;
  configuredAt: string;
  updatedAt: string;
};
