import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

const TIER2_DEFINITION_CONTRACT = Object.freeze({
  definitionKey: "tier2-complete-partners",
  stage: "tier2-union",
  displayName: "Tier 2 provenance-preserving partner union",
  version: "v1",
  requiredInputPolicy: "all-active-tier2-partner-profiles-ordered-by-profile-key",
  outputClassification: "PGIC",
  publicationTargetKey: "tier2-pgic",
  isWorkspaceVisible: true,
  rowSemantics: "provenance-preserving-union",
  duplicatePolicy: "retain-all-and-block-publish",
} as const);

const AGGREGATE2_DEFINITION_CONTRACT = Object.freeze({
  definitionKey: "aggregate2-exact-union",
  stage: "aggregate2",
  displayName: "Aggregate 2 Combined Release",
  version: "v1",
  requiredInputKeys: ["tier2", "imb", "jp"] as const,
  outputClassification: "PGIC",
  publicationTargetKey: "aggregate2-pgic",
  isWorkspaceVisible: true,
  rowSemantics: "provenance-preserving-combined-release",
  duplicatePolicy: "retain-all-and-block-publish",
} as const);

export const TIER2_PRODUCT_DEFINITIONS = Object.freeze({
  tier2: Object.freeze({
    ...TIER2_DEFINITION_CONTRACT,
    checksum: checksumSourceFormingValue(TIER2_DEFINITION_CONTRACT),
  }),
  aggregate2: Object.freeze({
    ...AGGREGATE2_DEFINITION_CONTRACT,
    checksum: checksumSourceFormingValue(AGGREGATE2_DEFINITION_CONTRACT),
  }),
});

export function getTier2ProductDefinitionContract(
  productKind: keyof typeof TIER2_PRODUCT_DEFINITIONS,
) {
  return TIER2_PRODUCT_DEFINITIONS[productKind];
}

export function createTier2ProductInputFingerprint(input: {
  candidateFingerprint: string;
  resourceSetId: string;
  resourceSetChecksum: string;
  registryRevisionId: string;
  registryRevisionChecksum: string;
  databaseDefinitionChecksum: string;
  codeDefinitionChecksum: string;
  expectedCurrentPublicationId: string | null;
}) {
  return checksumSourceFormingValue(input);
}
