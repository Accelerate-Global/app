import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  fieldDefinitionSources,
  fieldDefinitions,
  fieldSourceTypes,
} from "@/db/schema";
import {
  IMB_FIELD_CONTRACT,
  IMB_FIELD_CONTRACT_VERSION,
} from "@/lib/imb-forming/field-contract";
import {
  buildPrivateDataChatSemanticContextPackage,
  type PrivateDataChatSemanticContextFinding,
  type PrivateDataChatSemanticResourceSummary,
  type PrivateDataChatSemanticSourceFieldDefinition,
} from "@/lib/private-data-chat/semantic-context";
import { buildPrivateDataChatSemanticCandidateFromGuidingDocument } from "@/lib/private-data-chat/semantic-guiding-documents";
import { loadPrivateDataChatFilterRegionSource } from "@/lib/private-data-chat/filter-region-source";
import {
  createReferenceResourceCandidate,
  getActiveReferenceResource,
  listReferenceResourceCatalog,
  ReferenceResourceValidationError,
} from "@/lib/reference-resources";
import { SEMANTIC_CONTEXT_RESOURCE_KEY } from "@/lib/reference-resources/types";

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildPrivateDataChatAdditionalSourceVersions(input: {
  fieldSourceMappings: unknown;
  filterRegionChecksum: string;
}) {
  return {
    fieldSourceMappings: checksum(input.fieldSourceMappings),
    filterRegions: input.filterRegionChecksum,
    imbFieldContract: `${IMB_FIELD_CONTRACT_VERSION}:${checksum(
      IMB_FIELD_CONTRACT,
    )}`,
  };
}

function latestSourceTimestamp(input: Awaited<
  ReturnType<typeof loadPrivateDataChatSemanticContextSources>
>) {
  const timestamps = [
    ...input.fieldDefinitions.map((definition) => definition.updatedAt),
    ...input.resourceSummaries.map((resource) => resource.sourceRetrievedAt),
  ]
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  return new Date(timestamps.length > 0 ? Math.max(...timestamps) : 0).toISOString();
}

export async function loadPrivateDataChatSemanticContextSources() {
  const [definitions, mappings, regionSource, catalog] = await Promise.all([
    getDb()
      .select({
        canonicalKey: fieldDefinitions.canonicalKey,
        label: fieldDefinitions.label,
        definition: fieldDefinitions.definition,
        sourcePriorityKeys: fieldDefinitions.sourcePriorityKeys,
        updatedAt: fieldDefinitions.updatedAt,
      })
      .from(fieldDefinitions)
      .orderBy(asc(fieldDefinitions.canonicalKey)),
    getDb()
      .select({
        canonicalKey: fieldDefinitions.canonicalKey,
        sourceType: fieldSourceTypes.key,
        sourceFieldName: fieldDefinitionSources.sourceFieldName,
      })
      .from(fieldDefinitionSources)
      .innerJoin(
        fieldDefinitions,
        eq(fieldDefinitionSources.fieldDefinitionId, fieldDefinitions.id),
      )
      .innerJoin(
        fieldSourceTypes,
        eq(fieldDefinitionSources.sourceTypeId, fieldSourceTypes.id),
      )
      .orderBy(
        asc(fieldDefinitions.canonicalKey),
        asc(fieldSourceTypes.key),
      ),
    loadPrivateDataChatFilterRegionSource(),
    listReferenceResourceCatalog(),
  ]);

  const fieldDefinitionInputs: PrivateDataChatSemanticSourceFieldDefinition[] =
    definitions.map((definition) => ({
      canonicalKey: definition.canonicalKey,
      label: definition.label,
      definition: definition.definition,
      sourcePriorityKeys: definition.sourcePriorityKeys,
      updatedAt: definition.updatedAt.toISOString(),
    }));
  const resourceSummaries: PrivateDataChatSemanticResourceSummary[] = catalog
    .filter(
      (item) =>
        item.resourceKey !== SEMANTIC_CONTEXT_RESOURCE_KEY && item.activeVersion,
    )
    .map((item) => ({
      resourceKey: item.resourceKey,
      label: item.label,
      description: item.description,
      versionId: item.activeVersion!.id,
      versionNumber: item.activeVersion!.versionNumber,
      contentChecksum: item.activeVersion!.contentChecksum,
      sourceRetrievedAt: item.activeVersion!.sourceRetrievedAt,
      entryCount: item.activeVersion!.entryCount,
    }));

  return {
    fieldDefinitions: fieldDefinitionInputs,
    resourceSummaries,
    additionalSourceVersions: buildPrivateDataChatAdditionalSourceVersions({
      fieldSourceMappings: mappings,
      filterRegionChecksum: regionSource.checksum,
    }),
  };
}

function toReferenceFinding(
  finding: PrivateDataChatSemanticContextFinding,
) {
  return {
    severity: finding.severity,
    ruleCode: finding.ruleCode,
    message: finding.message,
    stableEntryKey: finding.stableEntryKey,
    fieldName: finding.fieldName,
  };
}

export async function createPrivateDataChatSemanticContextCandidate(input: {
  actorOwnerId: string;
  sourceRetrievedAt?: string;
}) {
  const sources = await loadPrivateDataChatSemanticContextSources();
  const built = buildPrivateDataChatSemanticContextPackage({
    sourceRetrievedAt:
      input.sourceRetrievedAt ?? latestSourceTimestamp(sources),
    ...sources,
  });
  const candidate = await createReferenceResourceCandidate({
    resourceKey: SEMANTIC_CONTEXT_RESOURCE_KEY,
    payload: built.package,
    actorOwnerId: input.actorOwnerId,
    schemaVersion: built.package.schemaVersion,
    findings: built.findings.map(toReferenceFinding),
    rawManifest: {
      sourceVersionManifest: built.package.sourceVersionManifest,
      definitionPackageChecksum: built.package.definitionPackageChecksum,
      guidingDocumentChecksum: built.package.guidingDocumentChecksum,
    },
  });

  return { ...candidate, findings: built.findings };
}

export async function getActivePrivateDataChatSemanticContext() {
  return getActiveReferenceResource(SEMANTIC_CONTEXT_RESOURCE_KEY);
}

export async function createPrivateDataChatSemanticContextCandidateFromGuidingDocument(
  input: {
    actorOwnerId: string;
    document: string;
    expectedDefinitionPackageChecksum: string;
    blakeApproved: boolean;
    sourceRetrievedAt?: string;
  },
) {
  if (!input.blakeApproved) {
    throw new ReferenceResourceValidationError(
      "Blake's approval is required before a guiding-document edit can become a candidate.",
    );
  }

  const active = await getActivePrivateDataChatSemanticContext();
  const built = buildPrivateDataChatSemanticCandidateFromGuidingDocument({
    base: active.payload,
    document: input.document,
    expectedDefinitionPackageChecksum:
      input.expectedDefinitionPackageChecksum,
    sourceRetrievedAt: input.sourceRetrievedAt ?? new Date().toISOString(),
  });
  if (!built.candidate) {
    throw new ReferenceResourceValidationError(
      built.findings.map((finding) => finding.message).join(" ") ||
        "The guiding document could not be converted into a valid candidate.",
    );
  }

  const candidate = await createReferenceResourceCandidate({
    resourceKey: SEMANTIC_CONTEXT_RESOURCE_KEY,
    payload: built.candidate,
    actorOwnerId: input.actorOwnerId,
    schemaVersion: built.candidate.schemaVersion,
    findings: built.findings.map(toReferenceFinding),
    rawManifest: {
      operation: "guiding-document-edit",
      baseVersionId: active.version.id,
      expectedDefinitionPackageChecksum:
        input.expectedDefinitionPackageChecksum,
      changedKeys: built.changedKeys,
      blakeApproved: true,
    },
  });

  return {
    ...candidate,
    changedKeys: built.changedKeys,
    findings: built.findings,
  };
}
