import type { CsvColumn } from "@/lib/api-types";
import type { DatasetFormingFinding } from "@/lib/dataset-forming/types";
import type {
  EngagementMappingRow,
  JpPeopleId3Row,
  PeidRow,
  SourceAliasRow,
} from "@/lib/reference-resources/pipeline-types";
import type {
  SourceCountryReference,
  SourceRopReference,
} from "@/lib/source-forming/types";

export const TIER2_TRACKING_ID_SOURCES = [
  "peopleid3",
  "peid",
  "rop3",
  "provider-native",
] as const;

export type Tier2TrackingIdSource =
  (typeof TIER2_TRACKING_ID_SOURCES)[number];

export const TIER2_PRODUCT_KINDS = ["tier2", "aggregate2"] as const;
export type Tier2ProductKind = (typeof TIER2_PRODUCT_KINDS)[number];

export const TIER2_CANDIDATE_STATUSES = [
  "building",
  "valid",
  "invalid",
  "rejected",
  "publishing",
  "published",
  "failed",
] as const;

export type Tier2CandidateStatus =
  (typeof TIER2_CANDIDATE_STATUSES)[number];

export type Tier2PartnerProfileConfig = Readonly<{
  profileKey: string;
  partnerKey: string;
  displayName: string;
  apiConnectionId: string;
  spreadsheetId: string;
  sheetId: number;
  sheetTitle: string;
  stableRowKeyColumn: string;
  trackingIdColumn: string;
  trackingIdSource: Tier2TrackingIdSource;
  sourceRop3Column: string | null;
  sourceCountryColumn: string | null;
  sourceIso3Column: string | null;
  contractVersion: string;
  contractChecksum: string;
  active: boolean;
}>;

export type Tier2PartnerProfile = Tier2PartnerProfileConfig &
  Readonly<{
    id: string;
    createdByOwnerId: string;
    updatedByOwnerId: string;
    createdAt: string;
    updatedAt: string;
  }>;

export type Tier2ProfileValidationIssue = Readonly<{
  field: keyof Tier2PartnerProfileConfig | "profile";
  code: string;
  message: string;
}>;

export type Tier2PartnerResources = Readonly<{
  countries: readonly SourceCountryReference[];
  ropEntries: readonly SourceRopReference[];
  peopleId3Entries: readonly JpPeopleId3Row[];
  peidEntries: readonly PeidRow[];
  engagementMappings: readonly EngagementMappingRow[];
  sourceAliases: readonly SourceAliasRow[];
  lineage: Readonly<{
    countryVersionId: string;
    countryChecksum: string;
    ropVersionId: string;
    ropChecksum: string;
    sourceAliasesVersionId: string;
    sourceAliasesChecksum: string;
    peopleId3VersionId: string;
    peopleId3Checksum: string;
    peidVersionId: string;
    peidChecksum: string;
    engagementMappingsVersionId: string;
    engagementMappingsChecksum: string;
  }>;
}>;

export type Tier2FormingInput = Readonly<{
  profile: Tier2PartnerProfileConfig;
  sourceRunId: string;
  columns: readonly CsvColumn[];
  rows: readonly Record<string, string>[];
  resources: Tier2PartnerResources;
}>;

export type Tier2FormingValidation = Readonly<{
  warningCount: number;
  errorCount: number;
  inputRowCount: number;
  outputRowCount: number;
  missingStableKeyRows: number;
  duplicateStableKeyRows: number;
  unresolvedTrackingRows: number;
  ambiguousTrackingRows: number;
  invalidSourceRop3Rows: number;
  conflictingSourceRop3Rows: number;
  unresolvedCountryRows: number;
  invalidValueCount: number;
}>;

export type Tier2FormingResult = Readonly<{
  columns: CsvColumn[];
  rows: Record<string, string>[];
  findings: DatasetFormingFinding[];
  validation: Tier2FormingValidation;
  outputChecksum: string;
  valid: boolean;
  resourceLineage: Tier2PartnerResources["lineage"];
}>;

export type Tier2IdentityEvidence = Readonly<{
  sourceProfileKey: string;
  stableRowKey: string;
  trackingIdSource: Tier2TrackingIdSource;
  trackingId: string;
  peopleId3: string | null;
  peid: string | null;
  rop3: string | null;
  iso3: string | null;
  providerNativeId: string | null;
}>;

export type Tier2IdentityResolution = Readonly<{
  identityId: string;
  canonicalPgic: string;
  registryRevisionId: string;
  reused: boolean;
}>;

export type Tier2IdentityCandidateResult = Readonly<{
  columns: CsvColumn[];
  rows: Record<string, string>[];
  resolutions: Tier2IdentityResolution[];
  outputChecksum: string;
  registryRevisionIds: string[];
}>;

export type Tier2IdentityRegistryPort = Readonly<{
  resolveOrReserve(
    evidence: Tier2IdentityEvidence,
  ): Promise<Tier2IdentityResolution>;
  cancelReservations(reason: string): Promise<void>;
}>;

export type Tier2PartnerPublication = Readonly<{
  publicationId: string;
  profileKey: string;
  partnerKey: string;
  registryRevisionId: string;
  outputChecksum: string;
  publishedAt: string;
  columns: readonly CsvColumn[];
  rows: readonly Record<string, string>[];
}>;

export type Tier2ReleaseDefinition = Readonly<{
  key: string;
  version: string;
  requiredProfileKeys: readonly string[];
}>;

export type Tier2ReleaseFinding = Readonly<{
  severity: "warning" | "error";
  ruleCode: string;
  message: string;
  memberPosition: number | null;
  rowIndex: number | null;
  canonicalPgic: string | null;
  details: Readonly<Record<string, unknown>>;
}>;

export type Tier2ReleaseCandidate = Readonly<{
  kind: "tier2";
  definitionKey: string;
  definitionVersion: string;
  columns: CsvColumn[];
  rows: Record<string, string>[];
  memberPublicationIds: string[];
  registryRevisionIds: string[];
  findings: Tier2ReleaseFinding[];
  outputChecksum: string;
  inputFingerprint: string;
  valid: boolean;
}>;

export type Aggregate2InputPublications = Readonly<{
  tier2: Tier2ProductPublicationSnapshot;
  imb: Tier2ProductPublicationSnapshot;
  jp: Tier2ProductPublicationSnapshot;
}>;

export type Tier2ProductPublicationSnapshot = Readonly<{
  publicationId: string;
  outputChecksum: string;
  columns: readonly CsvColumn[];
  rows: readonly Record<string, string>[];
}>;

export type Aggregate2Candidate = Readonly<{
  kind: "aggregate2";
  columns: CsvColumn[];
  rows: Record<string, string>[];
  exactPublicationIds: Readonly<{
    tier2: string;
    imb: string;
    jp: string;
  }>;
  findings: Tier2ReleaseFinding[];
  outputChecksum: string;
  inputFingerprint: string;
  valid: boolean;
}>;

export type Tier2ProductCandidate =
  | Tier2ReleaseCandidate
  | Aggregate2Candidate;

export type Tier2PublicationRecord = Readonly<{
  id: string;
  candidateId: string;
  productKind: Tier2ProductKind;
  versionNumber: number;
  outputChecksum: string;
  rowCount: number;
  reason: string;
  publishedByOwnerId: string;
  publishedAt: string;
  supersedesPublicationId: string | null;
}>;

export type Tier2OutOfDateState = Readonly<{
  outOfDate: boolean;
  changedInputs: Array<"tier2" | "imb" | "jp">;
}>;
