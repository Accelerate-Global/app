import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

export const TIER2_FORMING_ENGINE_VERSION =
  "tier2-partner-forming-v1" as const;
export const TIER2_FORMING_ENGINE_CHECKSUM = checksumSourceFormingValue({
  engine: TIER2_FORMING_ENGINE_VERSION,
  semantics: [
    "stable-sheet-tab",
    "typed-tracking-discriminator",
    "exact-country-rop-crosswalk",
    "preserve-conflicting-evidence",
  ],
});

export const TIER2_IDENTITY_TRANSFORMATION_VERSION =
  "tier2-partner-identity-v1" as const;
export const TIER2_IDENTITY_TRANSFORMATION_CHECKSUM =
  checksumSourceFormingValue({
    transformation: TIER2_IDENTITY_TRANSFORMATION_VERSION,
    semantics: [
      "immutable-forming-publication-input",
      "typed-partner-identity-evidence",
      "base-registry-revision-cas",
      "non-recycled-identity-reservations",
    ],
  });

export const TIER2_PARTNER_FLOW_SEMANTIC_DEPENDENCIES = Object.freeze([
  Object.freeze({
    kind: "source-engine" as const,
    key: "tier2-partner-forming",
    version: TIER2_FORMING_ENGINE_VERSION,
    checksum: TIER2_FORMING_ENGINE_CHECKSUM,
  }),
  Object.freeze({
    kind: "transformation-contract" as const,
    key: "tier2-partner-identity",
    version: TIER2_IDENTITY_TRANSFORMATION_VERSION,
    checksum: TIER2_IDENTITY_TRANSFORMATION_CHECKSUM,
  }),
]);
