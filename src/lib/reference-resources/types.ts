import type { IsoCountryCodeResource } from "@/lib/iso-country-codes";
import type { RopCodeResource } from "@/lib/rop-codes";
import type {
  PrivateDataChatSemanticCard,
  PrivateDataChatSemanticContextPackage,
} from "@/lib/private-data-chat/semantic-context";

import {
  PIPELINE_RESOURCE_KEYS,
  type PipelineResourceEntryByKey,
  type PipelineResourceKey,
  type PipelineResourcePayloadByKey,
} from "./pipeline-types";

export const COUNTRY_RESOURCE_KEY = "country-territory-codes" as const;
export const ROP_RESOURCE_KEY = "rop-codes" as const;
export const SEMANTIC_CONTEXT_RESOURCE_KEY = "semantic-context-catalog" as const;

export type ReferenceResourceKey =
  | typeof COUNTRY_RESOURCE_KEY
  | typeof ROP_RESOURCE_KEY
  | typeof SEMANTIC_CONTEXT_RESOURCE_KEY
  | PipelineResourceKey;

export function isReferenceResourceKey(value: string): value is ReferenceResourceKey {
  return (
    value === COUNTRY_RESOURCE_KEY ||
    value === ROP_RESOURCE_KEY ||
    value === SEMANTIC_CONTEXT_RESOURCE_KEY ||
    (PIPELINE_RESOURCE_KEYS as readonly string[]).includes(value)
  );
}

export type ReferenceResourceKind =
  | "country-geography"
  | "rop-taxonomy"
  | "source-registry"
  | "people-crosswalk"
  | "merge-priority"
  | "field-mapping"
  | "semantic-catalog";
export type ReferenceResourceLifecycleState =
  | "building"
  | "valid"
  | "invalid"
  | "rejected";
export type ReferenceResourceActivationAction =
  | "activate"
  | "rollback"
  | "alias-edit";
export type ReferenceResourceValidationSeverity = "info" | "warning" | "error";

export type ReferenceResourcePayloadByKey = {
  [COUNTRY_RESOURCE_KEY]: IsoCountryCodeResource;
  [ROP_RESOURCE_KEY]: RopCodeResource;
  [SEMANTIC_CONTEXT_RESOURCE_KEY]: PrivateDataChatSemanticContextPackage;
} & PipelineResourcePayloadByKey;

export type ReferenceResourcePayload =
  ReferenceResourcePayloadByKey[ReferenceResourceKey];

export type ReferenceResourceEntryByKey = {
  [COUNTRY_RESOURCE_KEY]: IsoCountryCodeResource["entries"][number];
  [ROP_RESOURCE_KEY]: RopCodeResource["entries"][number];
  [SEMANTIC_CONTEXT_RESOURCE_KEY]: PrivateDataChatSemanticCard;
} & PipelineResourceEntryByKey;

export type ReferenceResourceValidationFinding = {
  severity: ReferenceResourceValidationSeverity;
  ruleCode: string;
  message: string;
  stableEntryKey?: string | null;
  fieldName?: string | null;
  details?: Record<string, unknown>;
};

export type ReferenceResourceDiffSummary = {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
  highRisk: number;
};

export type ReferenceResourceVersionSummary = {
  id: string;
  resourceKey: ReferenceResourceKey;
  versionNumber: number;
  lifecycleState: ReferenceResourceLifecycleState;
  schemaVersion: number;
  contentChecksum: string | null;
  sourceRetrievedAt: string;
  entryCount: number;
  validationSummary: Record<string, unknown>;
  diffSummary: Record<string, unknown>;
  createdByOwnerId: string;
  createdAt: string;
  finalizedAt: string | null;
  rejectionReason: string | null;
  isActive: boolean;
};

export type ReferenceResourceCatalogItem = {
  id: string;
  resourceKey: ReferenceResourceKey;
  resourceKind: ReferenceResourceKind;
  label: string;
  description: string;
  routePath: string;
  sortOrder: number;
  activeVersion: ReferenceResourceVersionSummary | null;
  attentionState?: "valid-candidate" | "invalid-build" | "interrupted-build" | null;
  impact: {
    affectedEngines: string[];
    olderOutputCount: number;
  };
};

export type ReferenceResourceCandidateResult = {
  unchanged: boolean;
  version: ReferenceResourceVersionSummary;
};

export type ReferenceResourceQueryResult<T> = {
  entries: T[];
  nextCursor: string | null;
  version: ReferenceResourceVersionSummary;
};

export type ReferenceResourcePageByKey = {
  [COUNTRY_RESOURCE_KEY]: ReferenceResourceQueryResult<
    IsoCountryCodeResource["entries"][number]
  > & { resource: IsoCountryCodeResource };
  [ROP_RESOURCE_KEY]: ReferenceResourceQueryResult<
    RopCodeResource["entries"][number]
  > & { resource: RopCodeResource };
  [SEMANTIC_CONTEXT_RESOURCE_KEY]: ReferenceResourceQueryResult<
    PrivateDataChatSemanticCard
  > & { resource: PrivateDataChatSemanticContextPackage };
} & {
  [Key in PipelineResourceKey]: ReferenceResourceQueryResult<
    PipelineResourceEntryByKey[Key]
  > & { resource: PipelineResourcePayloadByKey[Key] };
};

export type ReferenceResourceHealthItem = {
  resourceKey: ReferenceResourceKey;
  healthy: boolean;
  activeVersionId: string | null;
  problems: string[];
};

export type ReferenceResourceHealth = {
  healthy: boolean;
  resources: ReferenceResourceHealthItem[];
  currentSetId: string | null;
};
